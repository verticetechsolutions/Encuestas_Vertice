// Auth.js v6 (next-auth@5 beta) — root config para Google SSO.
//
// Sprint 1 del security audit 2026-05-12. Reemplaza el mockup
// "Próximamente" del landing y el ADMIN_PANEL_TOKEN compartido por
// identidad real per-user con Google + role en DB.
//
// JWT strategy (sin DB adapter):
//   El cookie encripted lleva `usuarioId`, `institucionId`, `role`. Lookup a
//   la tabla `usuarios` ocurre solo en el `signIn` callback al primer login
//   (resolver email→institución vía dominio) y en `jwt` callback para
//   rellenar el token. Después, cada request gated solo lee el JWT decoded
//   sin tocar DB. Trade-off aceptado: revocación server-side de sesiones no
//   es instantánea (se invalida al expirar el JWT). Mitigación: TTL corto
//   (8h) + obligatorio re-login para escalar a admin.
//
// Cookie name `vertice_auth` para distinguir del `vertice_session` que
// identifica la sesión-de-entrevista (sigue siendo el sesion_id opaco).
//
// Por qué Auth.js v6 y no Clerk: cero costo, control total, no vendor
// lock-in. Ver reporte security 2026-05-12 sección Auth lib decision.

import NextAuth from 'next-auth';
import 'next-auth/jwt';
import Google from 'next-auth/providers/google';
import {
  resolverUsuarioPorEmail,
  registrarLoginUsuario,
  type Usuario,
} from '@/lib/auth/usuarios';
import { logger } from '@/lib/observability/axiom';

// 8 horas. Suficiente para una sesión de trabajo continuo del entrevistado
// (12 min reales pero con pausas) o del admin (revisar dashboard en horario
// laboral). Renovación automática via Auth.js `update` callback en cada
// request — la cookie se actualiza si quedan <2h antes de expirar.
const SESSION_MAX_AGE_S = 60 * 60 * 8;

// Augmenta los tipos de next-auth para que session.user.usuarioId etc.
// queden tipados. Vive aquí (no en types.d.ts) para mantener todo el contrato
// de Auth.js en un solo archivo, evita drift entre el augmentation y el
// callback que lo produce.
declare module 'next-auth' {
  interface Session {
    user: {
      usuarioId: string;
      institucionId: string | null;
      role: 'entrevistado' | 'admin';
      email: string;
      name?: string | null;
      image?: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    usuarioId: string;
    institucionId: string | null;
    role: 'entrevistado' | 'admin';
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      // clientId y clientSecret se leen de env (AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET
      // por convención next-auth v5, o los explícitos GOOGLE_CLIENT_ID /
      // GOOGLE_CLIENT_SECRET que documentamos en el reporte). Auth.js los toma
      // automáticamente sin necesidad de pasarlos si los nombres son
      // AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET.
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // prompt: 'select_account' fuerza el selector de cuenta en cada login.
      // Útil si el usuario tiene multiples cuentas Google logueadas en el
      // browser (laboral + personal) y queremos que elija explícitamente.
      authorization: { params: { prompt: 'select_account' } },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: SESSION_MAX_AGE_S,
  },
  cookies: {
    // Nombre custom — `vertice_auth` distingue del `vertice_session`
    // (sesión-de-entrevista). En prod Auth.js prefija con `__Secure-`.
    sessionToken: {
      name: process.env.NODE_ENV === 'production'
        ? '__Secure-vertice_auth'
        : 'vertice_auth',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  pages: {
    // Custom error page que enseña por qué se rechazó el login (ej. dominio
    // no permitido). Vive bajo /(auth)/* para coherencia con magic-link.
    error: '/acceso/expirado',
  },
  callbacks: {
    /**
     * signIn — gate del flujo OAuth. Validamos:
     *   1. email verificado por Google (`email_verified` claim).
     *   2. resolverUsuarioPorEmail: busca o auto-crea `usuarios` row según
     *      dominio del email. Si dominio no está en
     *      institucion_dominios_permitidos NI es @verticemexico.com → rechazo.
     *   3. Registramos ultimo_login_at (no bloqueante).
     *
     * Return true → continúa flujo. Return string → redirect (ver pages.error).
     * Return false → muestra error genérico.
     */
    async signIn({ user, account, profile }) {
      // account?.provider === 'google' siempre en este flow (solo Google
      // configurado). Guard defensivo igual.
      if (account?.provider !== 'google') return false;

      const email = user.email ?? profile?.email;
      if (!email) {
        logger.warn('auth.signin.sin_email', { provider: account.provider });
        return '/acceso/expirado?razon=sin_email';
      }

      // Google id_token claim email_verified. Si Google no verificó el email,
      // significa que el usuario no demostró control del inbox — rechazo.
      const emailVerified =
        (profile as { email_verified?: boolean } | undefined)?.email_verified;
      if (emailVerified === false) {
        logger.warn('auth.signin.email_no_verificado', { email });
        return '/acceso/expirado?razon=email_no_verificado';
      }

      try {
        const resolved = await resolverUsuarioPorEmail(email, {
          googleSub: account.providerAccountId,
          nombre: user.name ?? profile?.name ?? null,
          pictureUrl: user.image ?? null,
        });
        if (!resolved) {
          logger.warn('auth.signin.dominio_no_permitido', { email });
          return '/acceso/expirado?razon=dominio_no_permitido';
        }
        // Stash en user para que jwt() callback lo lea sin re-query.
        // next-auth pasa este `user` solo en el primer login del JWT lifecycle.
        (user as unknown as { _vertice: Usuario })._vertice = resolved;
        // Fire-and-forget: registrar el login. Si falla, no bloquear el flow.
        registrarLoginUsuario(resolved.id).catch((err) => {
          logger.error('auth.signin.registrar_login_fallido', {
            usuario_id: resolved.id,
            error: err instanceof Error ? err.message : String(err),
          });
        });
        return true;
      } catch (err) {
        logger.error('auth.signin.error_inesperado', {
          email,
          error: err instanceof Error ? err.message : String(err),
        });
        return '/acceso/expirado?razon=error_interno';
      }
    },

    /**
     * jwt — se invoca (a) al login (con `user` presente) y (b) en cada
     * request gated por `auth()`. Solo al login enriquecemos el token con
     * datos persistentes; las llamadas subsecuentes son no-op.
     */
    async jwt({ token, user }) {
      const vertice = (user as unknown as { _vertice?: Usuario } | undefined)?._vertice;
      if (vertice) {
        token.usuarioId = vertice.id;
        token.institucionId = vertice.institucion_id;
        token.role = vertice.role;
      }
      return token;
    },

    /**
     * session — proyecta el JWT al session object que ven los components.
     * Cualquier campo que no proyectes aquí NO está disponible en `useSession`
     * o `auth()`.
     */
    async session({ session, token }) {
      // Coerción explícita: el JWT de Auth.js es typed como Record<string, unknown>
      // hasta que el module augmentation tope. Las verificaciones runtime de
      // signIn garantizan que estos campos son string|null válidos.
      session.user.usuarioId = token.usuarioId as string;
      session.user.institucionId = token.institucionId as string | null;
      session.user.role = token.role as 'entrevistado' | 'admin';
      return session;
    },
  },
});
