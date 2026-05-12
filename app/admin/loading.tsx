// loading.tsx genérico para todas las rutas /admin/* sin loading propio.
//
// Razón: sin loading.tsx, Next.js App Router retiene la página vieja durante
// toda la fase server-render de la nueva — con TTFB de 700-1000ms en este
// admin la navegación se siente "congelada". El skeleton se monta
// instantáneamente al disparar el Link, antes incluso de que el server
// empiece a procesar. Patrón canónico de Vercel/Resend/Stripe dashboards.
//
// El esqueleto vive en components/admin/loading-skeleton para que pueda
// reusarse en loading.tsx específicos de detail pages si los agregamos.

import { AdminLoadingSkeleton } from '@/components/admin/loading-skeleton';

export default function AdminLoading() {
  return <AdminLoadingSkeleton />;
}
