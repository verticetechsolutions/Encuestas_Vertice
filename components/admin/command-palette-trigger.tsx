'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { CommandPalette } from './command-palette';
import { AdminTooltip } from './tooltip';

export function CommandPaletteTrigger() {
  const [open, setOpen] = useState(false);
  const [shortcutLabel, setShortcutLabel] = useState('Ctrl K');

  useEffect(() => {
    const isMac =
      typeof navigator !== 'undefined' &&
      /Mac|iPhone|iPad|iPod/.test(navigator.platform);
    setShortcutLabel(isMac ? '⌘ K' : 'Ctrl K');

    function onKey(e: KeyboardEvent) {
      const meta = isMac ? e.metaKey : e.ctrlKey;
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <AdminTooltip
        content="Búsqueda global"
        shortcut={shortcutLabel}
        side="bottom"
      >
        <button
          type="button"
          aria-label="Abrir búsqueda global"
          aria-keyshortcuts={
            shortcutLabel === '⌘ K' ? 'Meta+K' : 'Control+K'
          }
          onClick={() => setOpen(true)}
          // Pill macOS Spotlight-style sobre ink. cream-pure/8 fill + hairline
          // cream-pure/10 da affordance sin pesar. min-w-[220px] desktop reserva
          // espacio al placeholder para que no salte cuando el title de la página
          // cambia de longitud. Mobile colapsa a icon-only.
          className="group/trigger inline-flex h-9 cursor-pointer items-center gap-2 rounded-full bg-cream-pure/[0.08] py-1.5 pl-3 pr-1.5 text-xs text-primary-foreground/70 ring-1 ring-cream-pure/10 transition hover:bg-cream-pure/15 hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 md:min-w-[220px]"
        >
          <Search className="size-3.5 shrink-0 opacity-80 transition-opacity group-hover/trigger:opacity-100" />
          <span className="hidden flex-1 text-left text-[12px] font-medium tracking-tight text-primary-foreground/55 transition-colors group-hover/trigger:text-primary-foreground/75 md:inline">
            Buscar en todo…
          </span>
          <kbd className="hidden h-[22px] items-center justify-center rounded-full bg-cream-pure/[0.06] px-2 font-mono text-[10px] tracking-[0.04em] text-primary-foreground/70 ring-1 ring-cream-pure/10 md:inline-flex">
            {shortcutLabel}
          </kbd>
        </button>
      </AdminTooltip>
      {open && <CommandPalette open={open} onOpenChange={setOpen} />}
    </>
  );
}
