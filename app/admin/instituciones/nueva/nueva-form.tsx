'use client';

// Form admin: crear institución + recibir magic link copiable. Usa
// useActionState (React 19) para que la Server Action devuelva el state que
// el form renderiza inline.

import { useActionState, useState } from 'react';
import {
  crearInstitucionConLink,
  type CrearInstitucionConLinkState,
} from '@/app/actions/adminInstituciones';
import { Check, Copy, Link as LinkIcon, Loader2 } from 'lucide-react';

const TIPOS = [
  { value: 'banco', label: 'Banco' },
  { value: 'sofom_er', label: 'SOFOM E.R.' },
  { value: 'sofom_enr', label: 'SOFOM E.N.R.' },
  { value: 'sofipo', label: 'SOFIPO' },
  { value: 'socap', label: 'SOCAP' },
  { value: 'arrendadora', label: 'Arrendadora' },
  { value: 'factoraje', label: 'Factoraje' },
  { value: 'ifc', label: 'IFC' },
  { value: 'otro', label: 'Otro' },
] as const;

const initialState: CrearInstitucionConLinkState = { ok: null };

export function NuevaInstitucionForm() {
  const [state, formAction, pending] = useActionState(
    crearInstitucionConLink,
    initialState
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_minmax(320px,400px)]">
      <form
        action={formAction}
        className="rounded-3xl bg-cream p-6 shadow-sm ring-1 ring-foreground/5 md:p-8"
      >
        <div className="grid gap-4">
          <Field
            name="razon_social"
            label="Razón social"
            placeholder="Banco Multiva, S.A., Institución de Banca Múltiple"
            required
          />
          <Field
            name="nombre_comercial"
            label="Nombre comercial (opcional)"
            placeholder="Multiva"
          />
          <div className="grid gap-2">
            <label className="text-xs font-semibold tracking-tight text-foreground/85">
              Tipo
            </label>
            <select
              name="tipo"
              required
              defaultValue="banco"
              className="rounded-xl border-0 bg-background px-3 py-2.5 text-sm text-foreground ring-1 ring-foreground/10 outline-none focus:ring-2 focus:ring-ink/30"
            >
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <Field
            name="email_contacto"
            label="Email de contacto"
            type="email"
            placeholder="ceo@institucion.mx"
            required
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold tracking-tight text-primary-foreground transition hover:bg-[var(--ink-raised)] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Creando…
            </>
          ) : (
            <>
              <LinkIcon className="size-4" />
              Crear y generar magic link
            </>
          )}
        </button>
      </form>

      <ResultPanel state={state} />
    </div>
  );
}

function Field({
  name,
  label,
  type = 'text',
  placeholder,
  required = false,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <label className="text-xs font-semibold tracking-tight text-foreground/85">
        {label}
      </label>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        className="rounded-xl border-0 bg-background px-3 py-2.5 text-sm text-foreground ring-1 ring-foreground/10 outline-none focus:ring-2 focus:ring-ink/30"
      />
    </div>
  );
}

function ResultPanel({ state }: { state: CrearInstitucionConLinkState }) {
  if (state.ok === null) {
    return (
      <aside className="rounded-3xl bg-foreground/[0.03] p-6 ring-1 ring-foreground/8">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Resultado
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Cuando crees la institución, generaremos un magic link que tú podrás
          copiar y enviar manualmente. El email <em>no</em> se manda mientras{' '}
          <code className="font-mono text-foreground/80">RESEND_API_KEY</code>{' '}
          esté vacío.
        </p>
      </aside>
    );
  }

  if (state.ok === false) {
    return (
      <aside className="rounded-3xl bg-amber-50 p-6 ring-1 ring-amber-200/70">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-amber-900/80">
          Error
        </p>
        <p className="mt-2 text-sm leading-relaxed text-amber-900">
          {state.error}
        </p>
      </aside>
    );
  }

  // ok === true — institución creada
  return <SuccessPanel state={state} />;
}

function SuccessPanel({
  state,
}: {
  state: Extract<CrearInstitucionConLinkState, { ok: true }>;
}) {
  const [copied, setCopied] = useState(false);
  const expira = new Date(state.expires_at).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  async function copy() {
    try {
      await navigator.clipboard.writeText(state.magic_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback ultra-simple: select + copy es flaky cross-browser; mejor
      // dejar el textarea visible para copiar manual.
    }
  }

  return (
    <aside className="rounded-3xl bg-ink p-6 text-cream-pure shadow-md ring-1 ring-ink/40">
      <div className="flex items-center gap-2">
        <Check className="size-4 text-gold" />
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary-foreground/70">
          Magic link listo
        </p>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-primary-foreground/90">
        La institución se registró ({state.cajas_aplicables} cajas aplicables).
        Copia el link y envíalo manualmente — expira el {expira}.
      </p>
      <textarea
        readOnly
        value={state.magic_url}
        rows={3}
        className="mt-3 w-full rounded-xl bg-[var(--ink-raised)]/60 px-3 py-2 font-mono text-[11px] leading-relaxed text-primary-foreground ring-1 ring-primary-foreground/10 outline-none"
      />
      <button
        type="button"
        onClick={copy}
        className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-gold text-sm font-semibold tracking-tight text-ink transition hover:bg-gold-bright active:scale-[0.98]"
      >
        {copied ? (
          <>
            <Check className="size-4" />
            Copiado al portapapeles
          </>
        ) : (
          <>
            <Copy className="size-4" />
            Copiar al portapapeles
          </>
        )}
      </button>
      <a
        href={`/admin/instituciones/${state.institucion_id}`}
        className="mt-2 inline-flex h-9 w-full items-center justify-center rounded-full bg-[var(--ink-raised)]/40 text-xs font-medium text-primary-foreground/85 ring-1 ring-primary-foreground/10 transition hover:bg-[var(--ink-raised)]/70"
      >
        Ver detalle de la institución
      </a>
    </aside>
  );
}
