// Smoke E2E del pipeline de Fase 8 (storage + email notif).
//
// Bypassea Opus: construye un PerfilDecisionFinal sintético, lo persiste
// en DB, dispara el step de generar-pdf + notificar-admin manualmente y
// reporta cada etapa. Útil para validar el cierre de Fase 8 sin gastar Opus
// API y sin esperar 60-90s de síntesis real.
//
// Uso:
//   npx tsx scripts/smoke_fase8.ts
//
// Requiere .env.local con: DATABASE_URL, RESEND_API_KEY, EMAIL_FROM,
// ADMIN_EMAILS. BLOB_READ_WRITE_TOKEN es opcional (sin token,
// uploadPdfToBlob devuelve null y el email sale con sólo el admin link).
//
// El script es idempotente: usa una sesion fake con UUID determinista. Si
// se corre dos veces, el upsert reemplaza el perfil anterior.

import { config } from 'dotenv';
config({ path: '.env.local' });

import { randomUUID } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  sesiones,
  instituciones,
  perfil_decision_final,
} from '@/db/schema';
import type { PerfilDecisionFinal } from '@/lib/schemas/perfil_decision_final';
import { generarPdfSintesis } from '@/lib/motor/sintesis_pdf';
import { uploadPdfToBlob } from '@/lib/storage/blob';
import { sendSintesisCompleta, parseAdminEmails } from '@/lib/email/resend';

const INSTITUCION_DEMO_ID = '930b78e0-8323-45a9-85de-2d4fc76594cb';

function log(stage: string, status: 'ok' | 'warn' | 'fail' | 'info', detail?: Record<string, unknown>) {
  const tag = { ok: '✓', warn: '⚠', fail: '✗', info: 'i' }[status];
  const det = detail ? ' ' + JSON.stringify(detail) : '';
  console.log(`${tag} ${stage}${det}`);
}

function buildPerfilSintetico(institucion: typeof instituciones.$inferSelect, sesion_id: string): PerfilDecisionFinal {
  return {
    schema_version: '1.0',
    institucion: {
      id: institucion.id,
      razon_social: institucion.razon_social,
      nombre_comercial: institucion.nombre_comercial,
      tipo: institucion.tipo,
    },
    sesion_id,
    generado_at: new Date().toISOString(),
    metricas: {
      cajas_llenas: 42,
      cajas_aplicables: 49,
      completitud: 42 / 49,
      confianza_global: 0.78,
      cajas_criticas_pct: 0.85,
      cajas_blandas_pct: 0.62,
      casos_sinteticos_aplicados: 2,
      fatiga_detectada: false,
    },
    cajas: {
      id_razon_social: {
        valor: institucion.razon_social,
        confianza: 0.99,
        fuente: 'manual',
        evidencia_textual: null,
        intentos: 1,
      },
      id_tipo_institucion: {
        valor: institucion.tipo,
        confianza: 0.98,
        fuente: 'manual',
        evidencia_textual: null,
        intentos: 1,
      },
    },
    resumen_ejecutivo:
      'Smoke E2E Fase 8: perfil sintético generado por scripts/smoke_fase8.ts. Validar storage Blob + notif email. No es un perfil de entrevista real.',
  };
}

async function main() {
  console.log('--- Smoke Fase 8: storage + email notif ---\n');

  // 1. Verificar institución demo
  log('1.find-institucion', 'info');
  const [inst] = await db
    .select()
    .from(instituciones)
    .where(eq(instituciones.id, INSTITUCION_DEMO_ID))
    .limit(1);
  if (!inst) {
    log('1.find-institucion', 'fail', { msg: 'Institución demo no existe', id: INSTITUCION_DEMO_ID });
    process.exit(1);
  }
  log('1.find-institucion', 'ok', { razon_social: inst.razon_social });

  // 2. Crear o reutilizar sesión fake
  const sesion_id = '99999999-9999-9999-9999-999999999999';
  log('2.upsert-sesion', 'info');
  const [existingSesion] = await db
    .select()
    .from(sesiones)
    .where(eq(sesiones.id, sesion_id))
    .limit(1);
  if (!existingSesion) {
    await db.insert(sesiones).values({
      id: sesion_id,
      institucion_id: inst.id,
      status: 'completa',
      consentimiento_at: new Date(),
      cajas_aplicables: 49,
    });
    log('2.upsert-sesion', 'ok', { sesion_id, created: true });
  } else {
    log('2.upsert-sesion', 'ok', { sesion_id, created: false });
  }

  // 3. Build + persist perfil
  log('3.build-perfil', 'info');
  const perfil = buildPerfilSintetico(inst, sesion_id);
  const perfil_id = randomUUID();
  const existing = await db
    .select({ id: perfil_decision_final.id, version: perfil_decision_final.version })
    .from(perfil_decision_final)
    .where(eq(perfil_decision_final.sesion_id, sesion_id))
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(perfil_decision_final)
      .set({
        perfil_json: perfil,
        completitud: perfil.metricas.completitud,
        confianza_global: perfil.metricas.confianza_global,
        // pdf_url limpio para que el smoke valide reupload
        pdf_url: null,
      })
      .where(eq(perfil_decision_final.sesion_id, sesion_id));
    log('3.build-perfil', 'ok', { perfil_id: existing[0]!.id, reused: true });
  } else {
    await db.insert(perfil_decision_final).values({
      id: perfil_id,
      institucion_id: inst.id,
      sesion_id,
      version: 1,
      perfil_json: perfil,
      schema_version: '1.0',
      completitud: perfil.metricas.completitud,
      confianza_global: perfil.metricas.confianza_global,
    });
    log('3.build-perfil', 'ok', { perfil_id, reused: false });
  }
  const [{ id: persistedPerfilId }] = await db
    .select({ id: perfil_decision_final.id })
    .from(perfil_decision_final)
    .where(eq(perfil_decision_final.sesion_id, sesion_id))
    .limit(1) as [{ id: string }];

  // 4. Generar PDF
  log('4.generar-pdf', 'info');
  const tStart = Date.now();
  let pdfBytes = 0;
  let pdfBuffer: Buffer | null = null;
  try {
    const pdf = await generarPdfSintesis(perfil);
    pdfBytes = pdf.bytes;
    pdfBuffer = pdf.buffer;
    log('4.generar-pdf', 'ok', { bytes: pdf.bytes, ms: Date.now() - tStart });
    // Guardar a disk para inspección humana
    try {
      mkdirSync('tmp', { recursive: true });
      writeFileSync('tmp/smoke-fase8.pdf', pdf.buffer);
      log('4.generar-pdf', 'info', { saved: 'tmp/smoke-fase8.pdf' });
    } catch (writeErr) {
      log('4.generar-pdf', 'warn', { write_skip: String(writeErr) });
    }
  } catch (err) {
    log('4.generar-pdf', 'fail', { error: err instanceof Error ? err.message : String(err) });
    process.exit(1);
  }

  // 5. Subir a Blob (gracefully degrade si BLOB_READ_WRITE_TOKEN no está)
  log('5.upload-blob', 'info', {
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN ? 'set' : 'NOT_SET',
  });
  let pdf_url: string | null = null;
  if (pdfBuffer) {
    pdf_url = await uploadPdfToBlob(pdfBuffer, `sintesis/${persistedPerfilId}.pdf`);
  }
  if (pdf_url) {
    log('5.upload-blob', 'ok', { url: pdf_url });
    // Persistir URL en DB
    await db
      .update(perfil_decision_final)
      .set({ pdf_url })
      .where(eq(perfil_decision_final.id, persistedPerfilId));
    log('5.upload-blob', 'ok', { persisted: true });
  } else {
    log('5.upload-blob', 'warn', {
      msg: 'Blob no provisionado o falló subida — verificando degradación grácil',
    });
  }

  // 6. Enviar email notificación
  log('6.notif-email', 'info');
  const recipients = parseAdminEmails(process.env.ADMIN_EMAILS);
  if (recipients.length === 0) {
    log('6.notif-email', 'warn', { msg: 'ADMIN_EMAILS vacío — skip' });
  } else if (!process.env.RESEND_API_KEY) {
    log('6.notif-email', 'warn', { msg: 'RESEND_API_KEY vacío — skip' });
  } else {
    try {
      await sendSintesisCompleta({
        to: recipients,
        razon_social: perfil.institucion.razon_social,
        sesion_id,
        perfil_id: persistedPerfilId,
        pdf_url,
        completitud: perfil.metricas.completitud,
        confianza_global: perfil.metricas.confianza_global,
        cajas_llenas: perfil.metricas.cajas_llenas,
        cajas_aplicables: perfil.metricas.cajas_aplicables,
        app_url: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
      });
      log('6.notif-email', 'ok', { recipients, pdf_url_included: pdf_url !== null });
    } catch (err) {
      log('6.notif-email', 'fail', { error: err instanceof Error ? err.message : String(err) });
    }
  }

  // 7. Verificar admin viewer
  log('7.admin-viewer', 'info', {
    url: `http://localhost:3000/admin/sesiones/${sesion_id}`,
    nota: 'Abrir en navegador con cookie admin para validar visualmente',
  });

  console.log('\n--- Smoke completo ---');
  process.exit(0);
}

main().catch((err) => {
  console.error('FATAL', err);
  process.exit(1);
});
