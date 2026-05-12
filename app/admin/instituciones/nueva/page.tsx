// La creación de institución ahora vive en un modal disparado desde
// /admin/instituciones (CTA "Nueva institución"). Esta ruta se mantiene para
// no romper enlaces antiguos: redirige al catálogo.

import { redirect } from 'next/navigation';

export default function NuevaInstitucionPage() {
  redirect('/admin/instituciones');
}
