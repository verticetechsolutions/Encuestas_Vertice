import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  // Project config goes here as the codebase grows.
};

// Wrap with Sentry. The wrapper is a no-op at build time when
// SENTRY_AUTH_TOKEN is missing (no source map upload in dev/CI without keys).
export default withSentryConfig(nextConfig, {
  silent: true,
  tunnelRoute: '/monitoring',
});
