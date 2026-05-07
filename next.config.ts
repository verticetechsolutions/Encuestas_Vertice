import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  experimental: {
    // Reduce el cold-compile en dev y el bundle en prod: cada `import { X } from
    // 'lucide-react'` (y similares) se trata como subpath import, en vez de
    // resolver el barrel completo del paquete. Mide hasta -50% de cold compile
    // en rutas con muchos iconos. Listado: librerías con barrel pesado que
    // efectivamente importamos por nombre (no namespace).
    optimizePackageImports: [
      'lucide-react',
      '@base-ui/react',
      '@radix-ui/react-select',
    ],
  },
};

// Sentry wrapper solo en producción: en dev añadía ~1-2s al cold compile
// (instrumentación de RSC + bundling de @sentry/nextjs) y los `Sentry.init`
// están guarded con `enabled: NODE_ENV==='production'` así que el wrapper no
// hace ningún trabajo útil en dev. En prod sigue activo para source-map upload
// y request-error capture.
const config =
  process.env.NODE_ENV === 'production'
    ? withSentryConfig(nextConfig, {
        silent: true,
        tunnelRoute: '/monitoring',
      })
    : nextConfig;

export default config;
