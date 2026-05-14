// Resend client + magic-link email. Server-only.

import { Resend } from 'resend';

let _client: Resend | null = null;
function client(): Resend {
  if (_client) return _client;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY no configurada en .env.local');
  _client = new Resend(key);
  return _client;
}

const FROM = process.env.EMAIL_FROM ?? 'hola@verticemexico.com';

export interface SendMagicLinkArgs {
  to: string;
  url: string;
  razon_social: string;
  expiresAt: Date;
}

export async function sendMagicLink({ to, url, razon_social, expiresAt }: SendMagicLinkArgs): Promise<void> {
  const fechaExpira = expiresAt.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const subject = `Tu acceso a Vértice — ${razon_social}`;
  const text = [
    `Hola,`,
    ``,
    `Te invitamos a participar en Vértice. Da click en el siguiente enlace para iniciar tu entrevista:`,
    ``,
    url,
    ``,
    `Este enlace es de un solo uso y expira el ${fechaExpira}. Después de ese momento, pídenos uno nuevo.`,
    ``,
    `— Vértice`,
  ].join('\n');
  const html = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
      <h2 style="margin: 0 0 16px;">Tu acceso a Vértice</h2>
      <p>Hola,</p>
      <p>Te invitamos a participar en Vértice. Da click para iniciar tu entrevista para <strong>${escapeHtml(razon_social)}</strong>:</p>
      <p style="margin: 24px 0;">
        <a href="${url}" style="display: inline-block; padding: 12px 20px; background: #111; color: #fff; text-decoration: none; border-radius: 6px;">Iniciar entrevista</a>
      </p>
      <p style="font-size: 13px; color: #666;">Este enlace es de un solo uso y expira el ${fechaExpira}. Si no funciona, pídenos uno nuevo.</p>
      <p style="font-size: 13px; color: #666;">Si el botón no abre, copia esta liga: <br/><code style="font-size: 11px;">${url}</code></p>
    </div>
  `;
  const { error } = await client().emails.send({
    from: FROM,
    to,
    subject,
    text,
    html,
  });
  if (error) throw new Error(`Resend rechazó el envío: ${error.name} — ${error.message}`);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// -- Síntesis completa (Fase 8) -------------------------------------------------

export interface SendSintesisCompletaArgs {
  to: string[];
  razon_social: string;
  sesion_id: string;
  perfil_id: string;
  pdf_url: string | null;
  completitud: number;
  confianza_global: number;
  cajas_llenas: number;
  cajas_aplicables: number;
  app_url: string;
}

/**
 * Notifica a la lista de admins que la síntesis final de una sesión completó.
 * Body incluye link a /admin/sesiones/{id} + link al PDF (si Blob lo subió) +
 * métricas resumen (completitud %, confianza %, ratio cajas).
 *
 * Throws si Resend rechaza. El caller (`sintetizarSesion` step) lo trata como
 * non-fatal: el perfil ya está persistido, el email es nice-to-have.
 */
export async function sendSintesisCompleta({
  to,
  razon_social,
  sesion_id,
  perfil_id,
  pdf_url,
  completitud,
  confianza_global,
  cajas_llenas,
  cajas_aplicables,
  app_url,
}: SendSintesisCompletaArgs): Promise<void> {
  if (to.length === 0) {
    // Defensa: el caller ya filtra, pero aquí evitamos enviar email vacío
    // que Resend rechaza con error 422 confuso.
    throw new Error('sendSintesisCompleta requiere al menos un recipient');
  }
  const adminUrl = `${app_url.replace(/\/$/, '')}/admin/sesiones/${sesion_id}`;
  const completitudPct = Math.round(completitud * 100);
  const confianzaPct = Math.round(confianza_global * 100);
  const subject = `Vértice · Síntesis lista: ${razon_social}`;
  const textLines = [
    `La entrevista de ${razon_social} terminó y su perfil ya está sintetizado.`,
    ``,
    `Métricas:`,
    `  · Completitud: ${completitudPct}% (${cajas_llenas} de ${cajas_aplicables} cajas)`,
    `  · Confianza global: ${confianzaPct}%`,
    `  · Perfil ID: ${perfil_id}`,
    ``,
    `Ver detalle en admin:`,
    `  ${adminUrl}`,
  ];
  if (pdf_url) {
    textLines.push(``, `Descargar PDF de síntesis:`, `  ${pdf_url}`);
  } else {
    textLines.push(
      ``,
      `Nota: el PDF se generó pero no se subió al storage (BLOB_READ_WRITE_TOKEN no configurado).`
    );
  }
  textLines.push(``, `— Vértice`);
  const text = textLines.join('\n');

  const pdfRow = pdf_url
    ? `
      <p style="margin: 20px 0 8px;">
        <a href="${pdf_url}" style="display: inline-block; padding: 10px 18px; background: #111; color: #fff; text-decoration: none; border-radius: 6px; font-size: 14px;">Descargar PDF</a>
      </p>`
    : `<p style="margin: 16px 0 8px; font-size: 13px; color: #888;">PDF generado pero no almacenado (storage pendiente de provisionar).</p>`;

  const html = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
      <h2 style="margin: 0 0 16px; font-size: 20px;">Síntesis lista</h2>
      <p>La entrevista de <strong>${escapeHtml(razon_social)}</strong> terminó y su perfil ya está sintetizado.</p>
      <table style="margin: 16px 0; border-collapse: collapse; font-size: 14px; width: 100%;">
        <tr><td style="padding: 6px 0; color: #666;">Completitud</td><td style="padding: 6px 0; text-align: right;"><strong>${completitudPct}%</strong> <span style="color: #888;">(${cajas_llenas}/${cajas_aplicables} cajas)</span></td></tr>
        <tr><td style="padding: 6px 0; color: #666;">Confianza global</td><td style="padding: 6px 0; text-align: right;"><strong>${confianzaPct}%</strong></td></tr>
        <tr><td style="padding: 6px 0; color: #666;">Perfil ID</td><td style="padding: 6px 0; text-align: right; font-family: ui-monospace, monospace; font-size: 12px;">${escapeHtml(perfil_id)}</td></tr>
      </table>
      <p style="margin: 20px 0 8px;">
        <a href="${adminUrl}" style="display: inline-block; padding: 12px 20px; background: #111; color: #fff; text-decoration: none; border-radius: 6px;">Ver en admin</a>
      </p>
      ${pdfRow}
      <p style="font-size: 12px; color: #888; margin-top: 24px;">Vértice · Notificación automática de síntesis</p>
    </div>
  `;

  const { error } = await client().emails.send({
    from: FROM,
    to,
    subject,
    text,
    html,
  });
  if (error) {
    throw new Error(`Resend rechazó el envío: ${error.name} — ${error.message}`);
  }
}

/**
 * Parsea ADMIN_EMAILS env (comma-separated) a array limpio. Filtra entradas
 * vacías y trim de whitespace. Devuelve `[]` si la var no está o sale vacía.
 */
export function parseAdminEmails(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
