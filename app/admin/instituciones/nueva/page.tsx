import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { NuevaInstitucionForm } from './nueva-form';

export default function NuevaInstitucionPage() {
  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/instituciones"
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Volver al catálogo
      </Link>
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Onboarding
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          Nueva institución
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Registra los 5 cajas de identidad. Generaremos un magic link que tú
          envías manualmente al contacto.
        </p>
      </header>
      <NuevaInstitucionForm />
    </div>
  );
}
