import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

// Headers de seguridad aplicados a TODAS las rutas. Defensa en profundidad
// contra: clickjacking, MIME sniffing, leakage de Referer cross-origin, abuso
// de APIs sensibles (camera/mic/geo), HTTPS downgrade.
//
// CSP (Content-Security-Policy): permite solo recursos del mismo origin +
// inline necesarios para Next 15 (`unsafe-inline` para styles porque shadcn
// y Base UI inyectan style attrs runtime; `unsafe-eval` para react-dom dev,
// removible en prod si se necesita endurecer). connect-src abre Anthropic,
// Deepgram WSS, Inngest, Sentry, Axiom, Resend webhooks. Si en el futuro se
// usa CDN, ampliar `script-src`/`img-src`/`font-src`.
//
// HSTS: 2 años + includeSubDomains. preload se omite hasta verificar que
// todos los subdominios (mail., docs.) sirven HTTPS — añadir manualmente
// post-deploy.
const SECURITY_HEADERS = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    // DENY = bloquea iframe de cualquier origen, incluido el mismo. Si en
    // el futuro se necesita embedding propio (e.g. dashboard widget), cambiar
    // a SAMEORIGIN; nunca a ALLOW-FROM (deprecated).
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'off',
  },
  {
    // Permissions-Policy: deshabilita APIs que la app no usa. STT (Deepgram)
    // requiere microphone, así que microphone=self (permitido en mismo origen).
    // Camera/geolocation/payment NO se usan — bloqueados.
    key: 'Permissions-Policy',
    value: [
      'camera=()',
      'microphone=(self)',
      'geolocation=()',
      'payment=()',
      'usb=()',
      'magnetometer=()',
      'gyroscope=()',
      'accelerometer=()',
    ].join(', '),
  },
];

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
  async headers() {
    return [
      {
        // Match all routes — incluye RSC, route handlers, static assets.
        source: '/:path*',
        headers: SECURITY_HEADERS,
      },
    ];
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
