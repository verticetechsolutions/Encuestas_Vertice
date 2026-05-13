import * as Sentry from '@sentry/nextjs';
import { validarEnvProd } from '@/lib/env';

// Server + edge runtime Sentry initialization. No-ops gracefully when
// SENTRY_DSN is unset (typical in local dev without observability keys).
//
// También ejecutamos `validarEnvProd()` al boot: fail-fast si faltan
// vars críticas o están mal formadas. Sin esto, la app arranca y los
// errores aparecen en runtime cuando el primer request necesita la var,
// haciendo el debug post-deploy mucho más lento.

export async function register() {
  // Fail-fast en boot si env mal configurado. Solo aplica en Node runtime
  // (edge tiene su propio entry). En dev tira warning pero no peta hasta
  // que la var requerida sea accedida; en prod peta inmediatamente.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      validarEnvProd();
    } catch (err) {
      // En production, hacer crash. En dev/test, loggear y continuar para
      // no romper el dev server cuando alguien está iterando local con
      // .env.local incompleto.
      const msg = err instanceof Error ? err.message : String(err);
      if (process.env.NODE_ENV === 'production') {
        throw err;
      } else {
        console.warn('[instrumentation]', msg);
      }
    }
  }

  if (!process.env.SENTRY_DSN) return;

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.1,
      enabled: process.env.NODE_ENV === 'production',
    });
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.1,
      enabled: process.env.NODE_ENV === 'production',
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
