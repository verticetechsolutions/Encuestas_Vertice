// Audit log helper para Server Actions admin.
//
// Sprint 1 del security audit 2026-05-12. Cualquier acción admin destructiva
// o modificatoria (crear/editar/borrar institución, emitir/revocar magic link,
// export de datos) debe envolverse con `withAuditLog` para que quede registro
// inmutable en `audit_admin_actions`.
//
// Patrón de uso:
//
//   export const deleteInstitucion = async (id: string) =>
//     withAuditLog('instituciones.eliminar', { target_type: 'institucion', target_id: id },
//       async () => {
//         await adminGuardOrThrow();
//         await db.delete(instituciones).where(eq(instituciones.id, id));
//       });
//
// El wrapper:
//   1. Captura IP y user-agent del request actual (via headers()).
//   2. Resuelve el admin_user_id vía getAdminUserId() (NULL si emergency mode).
//   3. Ejecuta fn().
//   4. Pase lo que pase (success o throw), INSERT en audit_admin_actions.
//      Si fn throws, lo re-lanza después de loguear.
//
// Append-only: NUNCA hacer DELETE/UPDATE sobre audit_admin_actions.

import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { audit_admin_actions } from '@/db/schema';
import { getAdminUserId } from '@/lib/auth/admin';
import { logger } from '@/lib/observability/axiom';

interface AuditMeta {
  /** Tipo de recurso afectado (e.g. 'institucion', 'magic_link', 'sesion'). */
  target_type?: string;
  /** ID del recurso afectado. */
  target_id?: string;
  /** Payload arbitrario para forensics (zod-parsed inputs, snapshots). */
  payload?: Record<string, unknown>;
}

/** IP del cliente desde headers Vercel/proxy. Best-effort; NULL si no se puede. */
async function getClientIpFromHeaders(): Promise<string | null> {
  try {
    const h = await headers();
    // x-forwarded-for puede ser "client, proxy1, proxy2". El primero es el real.
    const xff = h.get('x-forwarded-for');
    if (xff) return xff.split(',')[0].trim();
    // Vercel también setea x-real-ip y x-vercel-forwarded-for.
    return h.get('x-real-ip') ?? h.get('x-vercel-forwarded-for') ?? null;
  } catch {
    // headers() puede throw fuera de un request scope (e.g. tests).
    return null;
  }
}

async function getUserAgentFromHeaders(): Promise<string | null> {
  try {
    const h = await headers();
    return h.get('user-agent') ?? null;
  } catch {
    return null;
  }
}

/**
 * Envuelve un Server Action admin con audit log automático.
 *
 * @param action — identificador del action (convención: '<recurso>.<verbo>').
 * @param meta — info opcional sobre el target + payload para forensics.
 * @param fn — el server action mismo. Re-lanzado si throws.
 */
export async function withAuditLog<T>(
  action: string,
  meta: AuditMeta,
  fn: () => Promise<T>
): Promise<T> {
  const [adminUserId, ip, userAgent] = await Promise.all([
    getAdminUserId(),
    getClientIpFromHeaders(),
    getUserAgentFromHeaders(),
  ]);

  let outcome: 'success' | 'error' = 'success';
  let errorMessage: string | undefined;
  let result: T;

  try {
    result = await fn();
    return result;
  } catch (err) {
    outcome = 'error';
    errorMessage = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    // Append-only INSERT. Si esto falla (DB caída, schema drift), loguear pero
    // NO romper el flow del action — el audit es side-effect, no should
    // bloquear el resultado al usuario.
    try {
      await db.insert(audit_admin_actions).values({
        admin_user_id: adminUserId,
        action,
        target_type: meta.target_type ?? null,
        target_id: meta.target_id ?? null,
        payload: {
          outcome,
          ...(errorMessage ? { error: errorMessage } : {}),
          ...(meta.payload ?? {}),
        },
        ip,
        user_agent: userAgent,
      });
    } catch (auditErr) {
      logger.error('audit.insert_fallido', {
        action,
        admin_user_id: adminUserId,
        outcome,
        error:
          auditErr instanceof Error ? auditErr.message : String(auditErr),
      });
    }
  }
}
