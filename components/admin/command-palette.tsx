'use client';

// Command palette — admin global search.
//
// Diseño: macOS Spotlight + design system Vértice. Surface cream translúcido
// sobre backdrop ink/40 frosted, gold seam top, kbd legend footer. Active row
// = ink/7 fill + gold left bar (3px) en lugar del fill azul macOS, para no
// pelearse con el brand.
//
// Búsqueda cubre:
//   1. Acciones locales (instantáneas, sin red): navegación, crear, exportar,
//      logout. Filtro client-side por substring sobre label+keywords.
//   2. Cuentas/instituciones (server, /admin/api/search).
//   3. Sesiones (server) — por uuid o por nombre de institución.
//   4. Magic links (server) — por uuid o por nombre de institución.
//
// Keyboard: ↑↓ navega, ↵ ejecuta, esc cierra (vía Base UI Dialog).
// El item seleccionado se conecta al input vía aria-activedescendant para
// que los lectores de pantalla anuncien el cambio sin perder focus en el input.

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@base-ui/react/dialog';
import { ScrollArea } from '@base-ui/react/scroll-area';
import {
  Search,
  Building2,
  Activity,
  Loader2,
  LayoutDashboard,
  Link as LinkIcon,
  Plus,
  Download,
  LogOut,
  CornerDownLeft,
  Sparkles,
} from 'lucide-react';

import { logoutAdmin } from '@/app/actions/adminAuth';
import {
  magicTokenStatus,
  type MagicStatus,
} from '@/lib/admin/magic-token-status';
import { useLockLenisScroll } from '@/components/providers/smooth-scroll';

// === Server result types ====================================================

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
interface LinkResult {
  id: string;
  institucion_id: string;
  razon_social: string;
  expires_at: string;
  consumed_at: string | null;
  revoked_at: string | null;
}
interface SearchResults {
  instituciones: InstResult[];
  sesiones: SesionResult[];
  links: LinkResult[];
}

const EMPTY: SearchResults = { instituciones: [], sesiones: [], links: [] };
const DEBOUNCE_MS = 140;

// === Actions =================================================================
// Comandos estáticos disponibles siempre — el cuerpo del palette cuando no hay
// query es la lista de acciones (patrón Raycast/Spotlight de "recents"). El
// orden de los grupos es jerárquico mental: navegar → crear → exportar → cuenta.

type ActionRun =
  | { kind: 'route'; href: string }
  | { kind: 'url'; href: string }
  | { kind: 'fn'; run: () => void };

interface ActionDef {
  id: string;
  label: string;
  hint?: string;
  group: 'Navegación' | 'Acciones' | 'Exportar' | 'Cuenta';
  icon: React.ComponentType<{ className?: string }>;
  keywords: string;
  run: ActionRun;
}

const ENTITIES = ['instituciones', 'sesiones', 'extracciones', 'perfiles'] as const;

const ACTIONS: readonly ActionDef[] = [
  {
    id: 'nav-overview',
    label: 'Vista general',
    group: 'Navegación',
    icon: LayoutDashboard,
    keywords: 'resumen dashboard inicio home admin overview',
    run: { kind: 'route', href: '/admin' },
  },
  {
    id: 'nav-inst',
    label: 'Instituciones',
    group: 'Navegación',
    icon: Building2,
    keywords: 'cuentas empresas listado clientes',
    run: { kind: 'route', href: '/admin/instituciones' },
  },
  {
    id: 'nav-ses',
    label: 'Sesiones',
    group: 'Navegación',
    icon: Activity,
    keywords: 'entrevistas listado conversaciones',
    run: { kind: 'route', href: '/admin/sesiones' },
  },
  {
    id: 'nav-magic',
    label: 'Magic links',
    group: 'Navegación',
    icon: LinkIcon,
    keywords: 'tokens enlaces invitaciones links',
    run: { kind: 'route', href: '/admin/magic-links' },
  },
  {
    id: 'new-inst',
    label: 'Nueva institución',
    group: 'Acciones',
    icon: Plus,
    keywords: 'crear cuenta empresa nueva agregar add new',
    run: { kind: 'route', href: '/admin/instituciones/nueva' },
  },
  ...ENTITIES.flatMap((entity) =>
    (['csv', 'json'] as const).map<ActionDef>((format) => ({
      id: `export-${entity}-${format}`,
      label: `Exportar ${entity}`,
      hint: format.toUpperCase(),
      group: 'Exportar',
      icon: Download,
      keywords: `descargar download ${format} snapshot ${entity}`,
      run: { kind: 'url', href: `/admin/api/export/${entity}?format=${format}` },
    }))
  ),
  {
    id: 'logout',
    label: 'Cerrar sesión',
    group: 'Cuenta',
    icon: LogOut,
    keywords: 'salir logout cerrar exit signout sign out',
    run: {
      kind: 'fn',
      run: () => {
        void logoutAdmin();
      },
    },
  },
];

// === Filtering ===============================================================

function matchesAction(q: string, a: ActionDef): boolean {
  if (!q) return true;
  const haystack = `${a.label} ${a.group} ${a.keywords}`.toLowerCase();
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  return tokens.every((tok) => haystack.includes(tok));
}

// === Flat item model =========================================================
// Aplanamos en orden de render para que la navegación con flechas siga el
// mismo orden visual.

type FlatItem =
  | { kind: 'action'; action: ActionDef }
  | { kind: 'inst'; data: InstResult }
  | { kind: 'ses'; data: SesionResult }
  | { kind: 'link'; data: LinkResult };

function buildFlat(
  filteredActions: ActionDef[],
  results: SearchResults
): FlatItem[] {
  return [
    ...filteredActions.map<FlatItem>((a) => ({ kind: 'action', action: a })),
    ...results.instituciones.map<FlatItem>((data) => ({ kind: 'inst', data })),
    ...results.sesiones.map<FlatItem>((data) => ({ kind: 'ses', data })),
    ...results.links.map<FlatItem>((data) => ({ kind: 'link', data })),
  ];
}

// === Helpers =================================================================

function linkStatus(link: LinkResult): MagicStatus {
  return magicTokenStatus({
    expires_at: new Date(link.expires_at),
    consumed_at: link.consumed_at ? new Date(link.consumed_at) : null,
    revoked_at: link.revoked_at ? new Date(link.revoked_at) : null,
  });
}

// === Component ===============================================================

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
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listboxId = useId();

  // Detiene el RAF loop de Lenis mientras el palette está abierto. El
  // data-lenis-prevent del Dialog.Popup ya bloquea wheel/touch sobre el
  // contenido del modal, pero sin este lock la página de fondo seguiría
  // animando inercia residual si se abrió mid-scroll.
  useLockLenisScroll(open);

  // Reset on close — defer hasta animación out terminada en próximo abrir,
  // pero limpiamos abort para no completar fetches que ya no se rendirán.
  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults(EMPTY);
      setError(null);
      setSelectedIdx(0);
      abortRef.current?.abort();
    }
  }, [open]);

  // Fetch debounced — sólo cuando q >= 2. Para q vacío o de 1 char, mostramos
  // solo acciones locales (sin red).
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
            // Normalizamos por si una versión vieja del server no devuelve links
            setResults({
              instituciones: data.instituciones ?? [],
              sesiones: data.sesiones ?? [],
              links: data.links ?? [],
            });
            setSelectedIdx(0);
          }
        })
        .catch((e: unknown) => {
          if ((e as { name?: string }).name === 'AbortError') return;
          setError('Búsqueda no disponible');
          setResults(EMPTY);
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, router, onOpenChange]);

  // Filtered actions + grouping. useMemo para que la lista flat no se recree
  // en cada keystroke sin cambio real de query/results.
  const filteredActions = useMemo(
    () => ACTIONS.filter((a) => matchesAction(query.trim(), a)),
    [query]
  );

  const flatItems = useMemo(
    () => buildFlat(filteredActions, results),
    [filteredActions, results]
  );

  // Reset index si el array se encoge bajo el cursor (ej: typing reduce
  // resultados). Clamp a 0 si lista quedó vacía.
  useEffect(() => {
    setSelectedIdx((i) =>
      flatItems.length === 0 ? 0 : Math.min(i, flatItems.length - 1)
    );
  }, [flatItems.length]);

  // Scroll selected into view — block: 'nearest' evita saltos cuando el
  // siguiente ya es visible. Sin scroll-margin custom porque el contenedor
  // tiene padding propio.
  useEffect(() => {
    if (!open) return;
    itemRefs.current[selectedIdx]?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx, open]);

  const execute = useCallback(
    (item: FlatItem) => {
      onOpenChange(false);
      if (item.kind === 'action') {
        const { run } = item.action;
        if (run.kind === 'route') router.push(run.href);
        else if (run.kind === 'url') window.location.assign(run.href);
        else run.run();
        return;
      }
      if (item.kind === 'inst') {
        router.push(`/admin/instituciones/${item.data.id}`);
      } else if (item.kind === 'ses') {
        router.push(`/admin/sesiones/${item.data.id}`);
      } else {
        // Magic links: navegar a la institución dueña — ahí viven los controles
        // de revoke/reissue del token, que es el siguiente paso natural.
        router.push(`/admin/instituciones/${item.data.institucion_id}`);
      }
    },
    [onOpenChange, router]
  );

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) =>
        flatItems.length === 0 ? 0 : (i + 1) % flatItems.length
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) =>
        flatItems.length === 0
          ? 0
          : (i - 1 + flatItems.length) % flatItems.length
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = flatItems[selectedIdx];
      if (item) execute(item);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setSelectedIdx(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setSelectedIdx(Math.max(0, flatItems.length - 1));
    }
  }

  // Grupos pre-calculados para render ordenado. Indexamos cada item según su
  // posición global en flatItems para que el cursor se mantenga sincronizado.
  const actionsByGroup = useMemo(() => {
    const map = new Map<ActionDef['group'], ActionDef[]>();
    for (const a of filteredActions) {
      const list = map.get(a.group) ?? [];
      list.push(a);
      map.set(a.group, list);
    }
    return map;
  }, [filteredActions]);

  const ACTION_GROUP_ORDER: ReadonlyArray<ActionDef['group']> = [
    'Navegación',
    'Acciones',
    'Exportar',
    'Cuenta',
  ];

  const isEmptyState =
    flatItems.length === 0 &&
    !loading &&
    !error &&
    query.trim().length >= 2;

  const showActionsAsHero = query.trim().length === 0;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-ink/40 backdrop-blur-md transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup
          aria-label="Búsqueda global"
          // data-lenis-prevent: el smooth-scroll global (Lenis, root layout)
          // intercepta wheel/touch a nivel window. Sin este attr, hacer scroll
          // dentro del ScrollArea del palette movería la página de fondo en
          // lugar de la lista de resultados. Lenis ignora eventos cuyo target
          // o ancestor tenga este attr.
          data-lenis-prevent
          className="fixed left-1/2 top-[12%] z-[60] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 overflow-hidden rounded-2xl bg-cream/95 ring-1 ring-foreground/10 backdrop-blur-2xl transition-all duration-150 data-[ending-style]:scale-[0.98] data-[starting-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 md:top-[14%]"
          style={{
            boxShadow: 'var(--shadow-dialog)',
            // Gold seam top — replica el manifest card del landing. La línea
            // dorada hairline da la firma de marca sin meter color de fondo.
            backgroundImage:
              'linear-gradient(to bottom, rgb(200 168 100 / 0.18) 0, rgb(200 168 100 / 0) 1px)',
          }}
          onKeyDown={onKeyDown}
        >
          {/* Input row — px-5 py-4 para tamaño Spotlight. Icon size-5, text-base. */}
          <div className="flex items-center gap-3 border-b border-foreground/8 px-5 py-4">
            <Search
              aria-hidden
              className="size-[18px] shrink-0 text-muted-foreground"
            />
            <input
              autoFocus
              type="text"
              role="combobox"
              aria-expanded
              aria-controls={listboxId}
              aria-activedescendant={
                flatItems[selectedIdx]
                  ? `${listboxId}-item-${selectedIdx}`
                  : undefined
              }
              placeholder="Buscar acciones, cuentas, sesiones, magic links…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-[15px] leading-none text-foreground outline-none placeholder:text-muted-foreground/65"
            />
            {loading && (
              <Loader2
                aria-hidden
                className="size-4 shrink-0 animate-spin text-muted-foreground"
              />
            )}
            <Kbd className="hidden sm:inline-flex">esc</Kbd>
          </div>

          {/* Result list — Base UI ScrollArea para custom overlay scrollbar
              estilo macOS. Viewport oculta el scrollbar nativo (que en Windows
              trae las flechas arriba/abajo que se ven pesadas) y la Scrollbar
              custom hace fade-in solo cuando hovering o scrolling, fade-out al
              idle. listbox semantic vive en Content para que las options
              queden adentro del aria-controls del input.

              opacity-0 default + data-[hovering]:opacity-100 +
              data-[scrolling]:opacity-100 = macOS auto-hide. duration-0 en
              scrolling para que no fade-in con delay cuando el usuario empieza
              a hacer rueda (responsive feel). pointer-events: auto cuando
              visible permite agarrar el thumb con el mouse. */}
          <ScrollArea.Root className="relative max-h-[60vh] overflow-hidden">
            <ScrollArea.Viewport
              className="max-h-[60vh] w-full overscroll-contain outline-none"
              // overscroll-contain evita que el wheel del palette propague
              // al documento padre cuando llegas al tope/fondo (sino el
              // backdrop del Dialog scrollea atrás del palette).
            >
              <ScrollArea.Content
                id={listboxId}
                role="listbox"
                className="p-2"
              >
                {error && (
                  <p className="px-4 py-8 text-center text-xs text-burgundy">
                    {error}
                  </p>
                )}

                {!error && isEmptyState && (
                  <p className="px-4 py-10 text-center text-xs text-muted-foreground">
                    Sin resultados para &ldquo;{query}&rdquo;
                  </p>
                )}

                {!error &&
                  ACTION_GROUP_ORDER.map((group) => {
                    const items = actionsByGroup.get(group);
                    if (!items || items.length === 0) return null;
                    return (
                      <Group
                        key={group}
                        label={
                          showActionsAsHero && group === 'Navegación'
                            ? 'Acciones rápidas'
                            : group
                        }
                      >
                        {items.map((a) => {
                          const idx = flatItems.findIndex(
                            (it) =>
                              it.kind === 'action' && it.action.id === a.id
                          );
                          const Icon = a.icon;
                          return (
                            <Row
                              key={a.id}
                              ref={(el) => {
                                itemRefs.current[idx] = el;
                              }}
                              id={`${listboxId}-item-${idx}`}
                              icon={<Icon className="size-4" />}
                              title={a.label}
                              subtitle={a.group}
                              hint={a.hint}
                              selected={selectedIdx === idx}
                              onClick={() =>
                                execute({ kind: 'action', action: a })
                              }
                              onMouseEnter={() => setSelectedIdx(idx)}
                            />
                          );
                        })}
                      </Group>
                    );
                  })}

                {!error && results.instituciones.length > 0 && (
                  <Group label="Cuentas">
                    {results.instituciones.map((inst) => {
                      const idx = flatItems.findIndex(
                        (it) => it.kind === 'inst' && it.data.id === inst.id
                      );
                      return (
                        <Row
                          key={inst.id}
                          ref={(el) => {
                            itemRefs.current[idx] = el;
                          }}
                          id={`${listboxId}-item-${idx}`}
                          icon={<Building2 className="size-4" />}
                          title={inst.razon_social}
                          subtitle={inst.tipo}
                          selected={selectedIdx === idx}
                          onClick={() =>
                            execute({ kind: 'inst', data: inst })
                          }
                          onMouseEnter={() => setSelectedIdx(idx)}
                        />
                      );
                    })}
                  </Group>
                )}

                {!error && results.sesiones.length > 0 && (
                  <Group label="Sesiones">
                    {results.sesiones.map((ses) => {
                      const idx = flatItems.findIndex(
                        (it) => it.kind === 'ses' && it.data.id === ses.id
                      );
                      return (
                        <Row
                          key={ses.id}
                          ref={(el) => {
                            itemRefs.current[idx] = el;
                          }}
                          id={`${listboxId}-item-${idx}`}
                          icon={<Activity className="size-4" />}
                          title={ses.razon_social}
                          subtitle={`${ses.status} · ${ses.id.slice(0, 8)}`}
                          selected={selectedIdx === idx}
                          onClick={() => execute({ kind: 'ses', data: ses })}
                          onMouseEnter={() => setSelectedIdx(idx)}
                        />
                      );
                    })}
                  </Group>
                )}

                {!error && results.links.length > 0 && (
                  <Group label="Magic links">
                    {results.links.map((lnk) => {
                      const idx = flatItems.findIndex(
                        (it) => it.kind === 'link' && it.data.id === lnk.id
                      );
                      const status = linkStatus(lnk);
                      return (
                        <Row
                          key={lnk.id}
                          ref={(el) => {
                            itemRefs.current[idx] = el;
                          }}
                          id={`${listboxId}-item-${idx}`}
                          icon={<LinkIcon className="size-4" />}
                          title={lnk.razon_social}
                          subtitle={`${status} · ${lnk.id.slice(0, 8)}`}
                          selected={selectedIdx === idx}
                          onClick={() => execute({ kind: 'link', data: lnk })}
                          onMouseEnter={() => setSelectedIdx(idx)}
                        />
                      );
                    })}
                  </Group>
                )}
              </ScrollArea.Content>
            </ScrollArea.Viewport>

            {/* Scrollbar overlay — w-1.5 (6px) thumb pill, m-1 gutter para no
                pegarse al borde del popup. Track totalmente transparente; sólo
                el thumb tiene color. ink/25 idle, ink/45 hover thumb (no la
                scrollbar — el thumb es lo que el usuario agarra). */}
            <ScrollArea.Scrollbar
              orientation="vertical"
              className="pointer-events-none m-1 flex w-1.5 justify-center rounded-full opacity-0 transition-opacity duration-300 ease-out data-[hovering]:pointer-events-auto data-[hovering]:opacity-100 data-[scrolling]:pointer-events-auto data-[scrolling]:opacity-100 data-[scrolling]:duration-0"
            >
              <ScrollArea.Thumb className="w-full rounded-full bg-ink/25 transition-colors duration-150 hover:bg-ink/45" />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>

          {/* Footer — kbd legend tipo Spotlight. Gold-seam top hairline para
              cerrar la composición de marca. */}
          <div
            className="flex items-center justify-between border-t border-foreground/8 bg-foreground/[0.02] px-4 py-2.5 text-[11px] text-muted-foreground"
            style={{ boxShadow: 'inset 0 1px 0 rgb(200 168 100 / 0.12)' }}
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd>
                <span className="hidden sm:inline">navegar</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Kbd>
                  <CornerDownLeft className="size-2.5" />
                </Kbd>
                <span className="hidden sm:inline">abrir</span>
              </span>
            </div>
            <span className="inline-flex items-center gap-1.5 font-mono">
              <Sparkles className="size-2.5 text-gold-deep" />
              {flatItems.length} resultado{flatItems.length === 1 ? '' : 's'}
            </span>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// === Subcomponents ===========================================================

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pb-1 pt-2 first:pt-1">
      <p className="px-3 pb-1 pt-1 font-mono text-[9.5px] uppercase tracking-[0.28em] text-muted-foreground/80">
        {label}
      </p>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}

interface RowProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  hint?: string;
  selected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  id?: string;
}

// Row con ref forwarding para scrollIntoView desde el padre. Active state:
// fill ink/7 + barra gold de 3px en el leading edge. El icon container cambia
// a cream-pure cuando está activo (fintech-card feel).
const Row = ({
  ref,
  icon,
  title,
  subtitle,
  hint,
  selected,
  onClick,
  onMouseEnter,
  id,
}: RowProps & { ref?: React.Ref<HTMLButtonElement> }) => {
  return (
    <li>
      <button
        ref={ref}
        type="button"
        role="option"
        id={id}
        aria-selected={selected}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        className={`relative flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
          selected
            ? 'bg-ink/[0.07]'
            : 'hover:bg-foreground/[0.025]'
        }`}
      >
        {selected && (
          <span
            aria-hidden
            className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-gold"
            style={{ boxShadow: '0 0 0 1px rgb(200 168 100 / 0.35)' }}
          />
        )}
        <span
          className={`flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
            selected
              ? 'bg-cream-pure text-ink'
              : 'bg-foreground/5 text-muted-foreground'
          }`}
          style={
            selected
              ? { boxShadow: 'inset 0 0 0 1px rgb(10 15 28 / 0.06)' }
              : undefined
          }
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-medium leading-tight text-foreground">
            {title}
          </span>
          {subtitle && (
            <span className="mt-0.5 block truncate text-[11px] leading-tight text-muted-foreground">
              {subtitle}
            </span>
          )}
        </span>
        {hint && (
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {hint}
          </span>
        )}
        {selected && (
          <CornerDownLeft
            aria-hidden
            className="size-3.5 shrink-0 text-muted-foreground/70"
          />
        )}
      </button>
    </li>
  );
};

function Kbd({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <kbd
      className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] bg-foreground/10 px-1 font-mono text-[10px] leading-none text-foreground/70 ring-1 ring-foreground/5 ${className}`}
    >
      {children}
    </kbd>
  );
}
