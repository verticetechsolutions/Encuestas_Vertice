'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

// Catches React render errors in the App Router root and forwards them to Sentry.
// Required by @sentry/nextjs to suppress the "no global error handler" warning.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es-MX">
      <body>
        <h1>Algo salió mal</h1>
        <p>Ocurrió un error inesperado. Por favor recarga la página o contacta a soporte.</p>
      </body>
    </html>
  );
}
