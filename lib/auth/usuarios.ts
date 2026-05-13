// Resolver de identidad de usuario tras Google SSO.
//
// Sprint 1 del security audit 2026-05-12. Llamado desde el `signIn` callback
// de Auth.js (auth.ts).
//
// Flow:
//   1. Buscar `usuarios` por email (case-insensitive).
//   2. Si existe → opcionalmente rellenar google_sub si era NULL (merge),
//      retornar usuario.
//   3. Si no existe:
//      a. Si dominio = VERTICE_ADMIN_DOMAIN ('verticemexico.com'):
//         crear usuario con role='admin', institucion_id=NULL.
//      b. Si dominio ∈ institucion_dominios_permitidos:
//         crear usuario con role='entrevistado', institucion_id=match.
//      c. Si no match: retornar null (rechazo).
//
// Concurrencia: el INSERT puede competir con otro login del mismo email.
// Manejo: INSERT ... ON CONFLICT (LOWER(email)) DO UPDATE — el segundo login
// concurrente actualiza ultimo_login_at sobre el row existente en lugar de
// crear dos.

import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  usuarios,
  institucion_dominios_permitidos,
} from '@/db/schema';
import { logger } from '@/lib/observability/axiom';

// Dominio(s) reservados para el equipo Vértice → role='admin', sin
// institucion_id. Configurable vía env `VERTICE_ADMIN_DOMAINS` (lista
// separada por comas) para soportar tanto el dominio corporativo
// (verticemexico.com cuando se active Google Workspace) como cuentas
// individuales (verticetechsolutions@gmail.com en pre-alpha).
//
// Formato env: `verticemexico.com,verticetechsolutions@gmail.com`
//   - Sin @ → matchea el dominio (cualquier email @ese-dominio entra como admin).
//   - Con @ → matchea el email completo (whitelist específica).
//
// Default si la env está vacía: `verticemexico.com` solamente.
const VERTICE_ADMIN_DOMAINS = (
  process.env.VERTICE_ADMIN_DOMAINS ?? 'verticemexico.com'
)
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

/** Decide si un email tiene role='admin' según la whitelist configurada. */
function esAdminEmail(emailNormalizado: string, dominio: string): boolean {
  return VERTICE_ADMIN_DOMAINS.some((entry) => {
    if (entry.includes('@')) return entry === emailNormalizado;
    return entry === dominio;
  });
}

export type Usuario = {
  id: string;
  institucion_id: string | null;
  email: string;
  google_sub: string | null;
  nombre: string | null;
  picture_url: string | null;
  role: 'entrevistado' | 'admin';
};

/** Extrae el dominio (parte después de @) en lowercase. Maneja edge cases:
 *  emails sin @, espacios, caps. Retorna null si no se puede parsear. */
export function dominioDeEmail(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.indexOf('@');
  if (at <= 0 || at === trimmed.length - 1) return null;
  return trimmed.slice(at + 1);
}

interface ResolverOpts {
  googleSub: string;
  nombre: string | null;
  pictureUrl: string | null;
}

/**
 * Encuentra o crea el usuario para este email tras un Google SSO exitoso.
 * Retorna null si el dominio no está permitido (rechazo del login).
 */
export async function resolverUsuarioPorEmail(
  email: string,
  opts: ResolverOpts
): Promise<Usuario | null> {
  const emailNormalizado = email.trim().toLowerCase();
  const dominio = dominioDeEmail(emailNormalizado);
  if (!dominio) {
    logger.warn('auth.resolver.dominio_invalido', { email });
    return null;
  }

  // 1. ¿Existe ya el usuario? Lookup case-insensitive vía LOWER(email).
  //    El índice usuarios_email_lower_unique hace esto O(log n).
  const [existente] = await db
    .select()
    .from(usuarios)
    .where(sql`LOWER(${usuarios.email}) = ${emailNormalizado}`)
    .limit(1);

  if (existente) {
    // Merge: si el usuario fue creado vía magic-link y no tenía google_sub,
    // lo rellenamos ahora. Esto permite que un usuario que recibió magic-link
    // antes pueda usar Google de aquí en adelante sin cuentas duplicadas.
    if (!existente.google_sub) {
      await db
        .update(usuarios)
        .set({
          google_sub: opts.googleSub,
          nombre: opts.nombre ?? existente.nombre,
          picture_url: opts.pictureUrl ?? existente.picture_url,
        })
        .where(eq(usuarios.id, existente.id));
      logger.info('auth.resolver.google_sub_merge', {
        usuario_id: existente.id,
      });
    }
    return {
      id: existente.id,
      institucion_id: existente.institucion_id,
      email: existente.email,
      google_sub: opts.googleSub,
      nombre: existente.nombre,
      picture_url: existente.picture_url,
      role: existente.role,
    };
  }

  // 2. Usuario no existe — resolver dominio → institución/admin.

  // 2a. Equipo Vértice (whitelist por env VERTICE_ADMIN_DOMAINS) → admin
  //     sin institución.
  if (esAdminEmail(emailNormalizado, dominio)) {
    const creado = await crearUsuarioInternal({
      institucion_id: null,
      email: emailNormalizado,
      role: 'admin',
      opts,
    });
    logger.info('auth.resolver.admin_creado', {
      usuario_id: creado.id,
      email: emailNormalizado,
    });
    return creado;
  }

  // 2b. Dominio permitido por alguna institución.
  const [match] = await db
    .select({
      institucion_id: institucion_dominios_permitidos.institucion_id,
    })
    .from(institucion_dominios_permitidos)
    .where(
      sql`LOWER(${institucion_dominios_permitidos.dominio}) = ${dominio}`
    )
    .limit(1);

  if (!match) {
    logger.warn('auth.resolver.dominio_no_whitelist', {
      email: emailNormalizado,
      dominio,
    });
    return null;
  }

  const creado = await crearUsuarioInternal({
    institucion_id: match.institucion_id,
    email: emailNormalizado,
    role: 'entrevistado',
    opts,
  });
  logger.info('auth.resolver.entrevistado_creado', {
    usuario_id: creado.id,
    institucion_id: match.institucion_id,
    email: emailNormalizado,
  });
  return creado;
}

/** Crea el row en `usuarios` y devuelve la representación typed. */
async function crearUsuarioInternal({
  institucion_id,
  email,
  role,
  opts,
}: {
  institucion_id: string | null;
  email: string;
  role: 'entrevistado' | 'admin';
  opts: ResolverOpts;
}): Promise<Usuario> {
  const [inserted] = await db
    .insert(usuarios)
    .values({
      institucion_id,
      email,
      google_sub: opts.googleSub,
      nombre: opts.nombre,
      picture_url: opts.pictureUrl,
      role,
    })
    .returning();
  return {
    id: inserted.id,
    institucion_id: inserted.institucion_id,
    email: inserted.email,
    google_sub: inserted.google_sub,
    nombre: inserted.nombre,
    picture_url: inserted.picture_url,
    role: inserted.role,
  };
}

/** Update no-bloqueante de ultimo_login_at. Fire-and-forget desde signIn. */
export async function registrarLoginUsuario(usuarioId: string): Promise<void> {
  await db
    .update(usuarios)
    .set({ ultimo_login_at: new Date() })
    .where(eq(usuarios.id, usuarioId));
}
