'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@base-ui/react/dialog';
import { Search, Building2, Activity, Loader2 } from 'lucide-react';

interface InstResult {
  id: string;
  razon_social: string;
  tipo: string;
}
interface SesionResult {
  id: string;
  status: string;
  started_at: string;
  razon_social: string;
}
interface SearchResults {
  instituciones: InstResult[];
  sesiones: SesionResult[];
}

const EMPTY: SearchResults = { instituciones: [], sesiones: [] };
const DEBOUNCE_MS = 150;

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset al abrir/cerrar
  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults(EMPTY);
      setError(null);
      setSelectedIdx(0);
      abortRef.current?.abort();
    }
  }, [open]);

  // Fetch debounced
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      setError(null);
      fetch(`/admin/api/search?q=${encodeURIComponent(query)}`, {
        signal: ctrl.signal,
        cache: 'no-store',
      })
        .then(async (r) => {
          if (r.status === 401) {
            onOpenChange(false);
            const next = encodeURIComponent(window.location.pathname);
            router.push(`/admin/login?next=${next}`);
            return null;
          }
          if (!r.ok) throw new Error(`status ${r.status}`);
          return r.json();
        })
        .then((data: SearchResults | null) => {
          if (data) {
            setResults(data);
            setSelectedIdx(0);
          }
        })
        .catch((e: unknown) => {
          if ((e as { name?: string }).name === 'AbortError') return;
          setError('Búsqueda no disponible');
          setResults(EMPTY);
        })
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, router, onOpenChange]);

  // Lista flat para keyboard nav: [...instituciones, ...sesiones]
  const flatItems: Array<
    { kind: 'inst'; data: InstResult } | { kind: 'ses'; data: SesionResult }
  > = [
    ...results.instituciones.map((i) => ({ kind: 'inst' as const, data: i })),
    ...results.sesiones.map((s) => ({ kind: 'ses' as const, data: s })),
  ];

  function navigate(item: (typeof flatItems)[number]) {
    onOpenChange(false);
    if (item.kind === 'inst') {
      router.push(`/admin/instituciones/${item.data.id}`);
    } else {
      router.push(`/admin/sesiones/${item.data.id}`);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => (flatItems.length === 0 ? 0 : (i + 1) % flatItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) =>
        flatItems.length === 0 ? 0 : (i - 1 + flatItems.length) % flatItems.length
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = flatItems[selectedIdx];
      if (item) navigate(item);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-foreground/30 backdrop-blur-sm" />
        <Dialog.Popup
          className="fixed left-1/2 top-24 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl bg-cream shadow-2xl ring-1 ring-foreground/10 md:top-32"
          onKeyDown={onKeyDown}
        >
          <div className="flex items-center gap-2 border-b border-foreground/10 px-4 py-3">
            <Search className="size-4 text-muted-foreground" />
            <input
              autoFocus
              type="text"
              placeholder="Buscar instituciones o sesión por id…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {error && (
              <p className="px-4 py-6 text-center text-xs text-amber-700">{error}</p>
            )}
            {!error && query.trim().length < 2 && (
              <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                Empieza a escribir (min. 2 caracteres)…
              </p>
            )}
            {!error && query.trim().length >= 2 && flatItems.length === 0 && !loading && (
              <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                Sin resultados para &ldquo;{query}&rdquo;
              </p>
            )}
            {!error && results.instituciones.length > 0 && (
              <ResultGroup label="Instituciones">
                {results.instituciones.map((inst, idx) => (
                  <ResultRow
                    key={inst.id}
                    icon={<Building2 className="size-4" />}
                    title={inst.razon_social}
                    subtitle={inst.tipo}
                    selected={selectedIdx === idx}
                    onClick={() => navigate({ kind: 'inst', data: inst })}
                    onMouseEnter={() => setSelectedIdx(idx)}
                  />
                ))}
              </ResultGroup>
            )}
            {!error && results.sesiones.length > 0 && (
              <ResultGroup label="Sesiones">
                {results.sesiones.map((ses, i) => {
                  const idx = results.instituciones.length + i;
                  return (
                    <ResultRow
                      key={ses.id}
                      icon={<Activity className="size-4" />}
                      title={`${ses.razon_social} · ${ses.status}`}
                      subtitle={ses.id}
                      selected={selectedIdx === idx}
                      onClick={() => navigate({ kind: 'ses', data: ses })}
                      onMouseEnter={() => setSelectedIdx(idx)}
                    />
                  );
                })}
              </ResultGroup>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ResultGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-1">
      <p className="px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <ul>{children}</ul>
    </div>
  );
}

function ResultRow({
  icon,
  title,
  subtitle,
  selected,
  onClick,
  onMouseEnter,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  selected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${
          selected ? 'bg-forest/10' : 'hover:bg-foreground/[0.02]'
        }`}
      >
        <span className="text-muted-foreground">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">
            {title}
          </span>
          <span className="block truncate font-mono text-[10px] text-muted-foreground">
            {subtitle}
          </span>
        </span>
      </button>
    </li>
  );
}
