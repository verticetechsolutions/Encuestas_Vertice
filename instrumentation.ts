import * as Sentry from '@sentry/nextjs';

// Server + edge runtime Sentry initialization. No-ops gracefully when
// SENTRY_DSN is unset (typical in local dev without observability keys).

export async function register() {
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
