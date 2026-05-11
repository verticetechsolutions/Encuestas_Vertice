'use client';

// AdminScrollArea — wrapper de Base UI ScrollArea con el styling del command
// palette (thumb pill bg-ink/25, fade-in en hover/scrolling) y `data-lenis-
// prevent` ya conectado al viewport.
//
// Por qué existe: el smooth-scroll global (Lenis, root layout) intercepta
// wheel/touch a nivel window. Un overflow-y-auto nativo dentro de la página
// no recibe sus eventos hasta que el viewport del scroll container está
// marcado con `data-lenis-prevent`. Además el scrollbar nativo (aunque
// estilizado globalmente en globals.css) en Windows trae las flechas arriba/
// abajo que se ven pesadas y no fade-in al idle — el palette resolvió esto
// con Base UI ScrollArea. Mismo treatment aquí para listas internas del
// admin dashboard (action items, activity timeline, futuras tablas).
//
// API mínima: max-h (Tailwind class string), gap/flex internos vía
// contentClassName. El consumer mantiene control del layout sin tener que
// importar el primitive directamente.

import { ScrollArea } from '@base-ui/react/scroll-area';
import { usePathname } from 'next/navigation';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from 'react';

// useLayoutEffect produce warning durante SSR. Para el reset de scroll al
// cambiar de ruta queremos correr antes del paint (sin flash de scroll
// antiguo). Pattern oficial React: usar useLayoutEffect en client,
// useEffect como fallback en server (donde no hay paint que adelantar).
const useIsoLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

interface Props {
  children: ReactNode;
  /** Clase Tailwind de height/max-height. Aplicada a Root y Viewport
   *  (necesario: Root con overflow-hidden necesita la altura; Viewport
   *  con scroll necesita saber cuándo overflow). Ej: "max-h-[460px]",
   *  "max-h-[60vh]", o "h-full" para llenar el padre. */
  maxHeight: string;
  /** Clases aplicadas al Content interno — típicamente flex+gap. */
  contentClassName?: string;
  /** Clases extra para el Root (ej. negative margin para alinear con el
   *  resto de la columna cuando el scrollbar añade su `m-1` gutter). */
  className?: string;
  /** Si true, resetea scrollTop a 0 al cambiar pathname. Necesario cuando
   *  el ScrollArea vive en un layout shared (e.g. AdminLayout) y persiste
   *  entre navegaciones — sin esto la nueva página aparece scrolleada a
   *  la posición de la anterior. */
  resetOnPathChange?: boolean;
}

export function AdminScrollArea({
  children,
  maxHeight,
  contentClassName = '',
  className = '',
  resetOnPathChange = false,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useIsoLayoutEffect(() => {
    if (!resetOnPathChange) return;
    const vp = viewportRef.current;
    if (vp) vp.scrollTop = 0;
  }, [pathname, resetOnPathChange]);

  return (
    <ScrollArea.Root
      className={`relative ${maxHeight} overflow-hidden ${className}`}
    >
      {/* data-lenis-prevent: Lenis (smooth-scroll global) intercepta wheel/
          touch a nivel window. Sin este attr, hacer scroll aquí movería la
          página de fondo en vez del contenedor. overscroll-contain evita
          además que llegando al tope/fondo el wheel propague al document
          padre. */}
      <ScrollArea.Viewport
        ref={viewportRef}
        data-lenis-prevent
        className={`${maxHeight} w-full overscroll-contain outline-none`}
      >
        <ScrollArea.Content className={contentClassName}>
          {children}
        </ScrollArea.Content>
      </ScrollArea.Viewport>

      {/* Scrollbar overlay — w-1.5 (6px) thumb pill, m-1 gutter (4px) desde
          los edges del Root. Espejo exacto del command palette: opacity 0
          idle → 100 en hover o scrolling, duration-0 en scrolling para que
          aparezca instantáneo cuando el usuario empieza a hacer rueda. */}
      <ScrollArea.Scrollbar
        orientation="vertical"
        className="pointer-events-none m-1 flex w-1.5 justify-center rounded-full opacity-0 transition-opacity duration-300 ease-out data-[hovering]:pointer-events-auto data-[hovering]:opacity-100 data-[scrolling]:pointer-events-auto data-[scrolling]:opacity-100 data-[scrolling]:duration-0"
      >
        <ScrollArea.Thumb className="w-full rounded-full bg-ink/25 transition-colors duration-150 hover:bg-ink/45" />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  );
}
