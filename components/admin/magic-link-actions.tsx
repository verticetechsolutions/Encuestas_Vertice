'use client';

import { useState, useTransition } from 'react';
import { Mail, Link2, Ban, Copy, Check } from 'lucide-react';
import {
  reenviarMagicLink,
  revocarMagicLink,
} from '@/app/actions/adminMagicLinks';

// ---- ReenviarPorCorreoButton ----------------------------------------------

export function ReenviarPorCorreoButton({
  institucion_id,
}: {
  institucion_id: string;
}) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setFeedback(null);
          setError(null);
          startTransition(async () => {
            const result = await reenviarMagicLink(institucion_id, 'email');
            if (result.ok) {
              setFeedback(`Enviado a ${result.sent_to ?? 'el contacto registrado'}.`);
            } else {
              setError(result.error);
            }
          });
        }}
        className="inline-flex items-center gap-2 rounded-full bg-forest px-4 py-2 text-xs font-medium text-primary-foreground transition hover:bg-forest-soft disabled:opacity-50"
      >
        <Mail className="size-3.5" />
        {pending ? 'Enviando…' : 'Reenviar por correo'}
      </button>
      {feedback && (
        <p className="text-xs text-forest">{feedback}</p>
      )}
      {error && (
        <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900 ring-1 ring-amber-200/70">
          {error}
        </p>
      )}
    </div>
  );
}

// ---- GenerarUrlButton -----------------------------------------------------

export function GenerarUrlButton({
  institucion_id,
}: {
  institucion_id: string;
}) {
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('No se pudo copiar al portapapeles.');
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setUrl(null);
          setError(null);
          startTransition(async () => {
            const result = await reenviarMagicLink(institucion_id, 'dry_run');
            if (result.ok) setUrl(result.magic_url);
            else setError(result.error);
          });
        }}
        className="inline-flex items-center gap-2 rounded-full bg-cream px-4 py-2 text-xs font-medium text-foreground ring-1 ring-foreground/10 transition hover:bg-foreground/5 disabled:opacity-50"
      >
        <Link2 className="size-3.5" />
        {pending ? 'Generando…' : 'Generar URL'}
      </button>
      {url && (
        <div className="flex items-center gap-2 rounded-lg bg-foreground/5 p-2">
          <code className="flex-1 truncate font-mono text-[11px] text-foreground/80">
            {url}
          </code>
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1 rounded-full bg-foreground px-2.5 py-1 text-[10px] font-medium text-primary-foreground transition hover:bg-foreground/85"
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      )}
      {error && (
        <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900 ring-1 ring-amber-200/70">
          {error}
        </p>
      )}
    </div>
  );
}

// ---- RevocarButton --------------------------------------------------------

export function RevocarButton({ token_id }: { token_id: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm('¿Revocar este token? Esta acción no se puede deshacer.')) {
            return;
          }
          setError(null);
          startTransition(async () => {
            const result = await revocarMagicLink(token_id);
            if (!result.ok) setError(result.error);
          });
        }}
        className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.04] px-2.5 py-1 text-[10px] font-medium text-foreground/70 ring-1 ring-foreground/10 transition hover:bg-amber-50 hover:text-amber-900 hover:ring-amber-200/70 disabled:opacity-50"
      >
        <Ban className="size-3" />
        {pending ? 'Revocando…' : 'Revocar'}
      </button>
      {error && <p className="text-[10px] text-amber-700">{error}</p>}
    </div>
  );
}
