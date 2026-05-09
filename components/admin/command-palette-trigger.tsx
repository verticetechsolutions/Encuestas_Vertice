'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { CommandPalette } from './command-palette';

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
      <button
        type="button"
        aria-label="Abrir búsqueda"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full bg-forest/40 px-3 py-1.5 text-xs font-medium text-primary-foreground/85 ring-1 ring-primary-foreground/10 transition hover:bg-forest/70"
      >
        <Search className="size-3.5" />
        <span className="hidden md:inline">Buscar…</span>
        <span className="hidden rounded bg-foreground/20 px-1.5 py-0.5 font-mono text-[10px] text-primary-foreground/80 md:inline">
          {shortcutLabel}
        </span>
      </button>
      {open && <CommandPalette open={open} onOpenChange={setOpen} />}
    </>
  );
}
