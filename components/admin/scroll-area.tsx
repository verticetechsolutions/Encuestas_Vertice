'use client';

// AdminScrollArea — wrapper de Base UI ScrollArea con el styling del command
// palette (thumb pill bg-ink/25, fade-in en hover/scrolling), `data-lenis-
// prevent` ya conectado al viewport, y una instancia anidada de Lenis para
// inercia suave consistente con landing/encuesta.
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
// Lenis anidado:
//   El admin shell vive en `fixed inset-0`; el document body queda con
//   altura 0 y la Lenis global no tiene nada que animar. El scroll real
//   pasa adentro de este Viewport. Para que el admin sienta la misma
//   inercia suave que landing/encuesta, montamos una segunda instancia
//   de Lenis (vanilla, no React wrapper) scoped al viewport — wrapper =
//   el div con overflow:scroll que renderea Base UI, content = el div
//   interno con los children. RAF loop propio (no usamos el gsap.ticker
//   global porque admin no tiene ScrollTrigger). Reduced-motion: bail
//   temprano y dejar scroll nativo.
//
// API mínima: max-h (Tailwind class string), gap/flex internos vía
// contentClassName. El consumer mantiene control del layout sin tener que
// importar el primitive directamente.

import { ScrollArea } from '@base-ui/react/scroll-area';
import { usePathname } from 'next/navigation';
import Lenis from 'lenis';
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
  /** Activa Lenis anidado (inercia suave). Default true. Permitir opt-out
   *  para listas muy cortas donde la inercia se siente excesiva. */
  smooth?: boolean;
}

export function AdminScrollArea({
  children,
  maxHeight,
  contentClassName = '',
  className = '',
  resetOnPathChange = false,
  smooth = true,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const pathname = usePathname();

  // Instancia Lenis anidada sobre el viewport. Vanilla Lenis (no
  // ReactLenis) porque Base UI ya provee la estructura wrapper/content
  // — no queremos que un wrapper extra rompa el styling del scrollbar.
  // RAF loop propio. Reduced-motion bail.
  useEffect(() => {
    if (!smooth) return;
    const wrapper = viewportRef.current;
    const content = contentRef.current;
    if (!wrapper || !content) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const lenis = new Lenis({
      wrapper,
      content,
      // eventsTarget DEBE ser el wrapper (no default=window). Sin esto,
      // Lenis escucha wheel en window y descarta los eventos cuyo target
      // tiene `data-lenis-prevent` (que es nuestro propio viewport) — el
      // resultado: Lenis nunca recibe wheel, el scroll vuelve a ser
      // nativo y no hay inercia. Apuntar eventsTarget al wrapper hace
      // que Lenis intercepte directamente sobre el viewport.
      eventsTarget: wrapper,
      // El default `prevent` checa si algún ancestor del target tiene
      // `data-lenis-prevent` y descarta el evento. Pero el wrapper SOMOS
      // nosotros, y tenemos ese attr (para bloquear a la global Lenis).
      // Override a () => false: dado que eventsTarget ya está scoped al
      // wrapper, todo lo que llegue acá es legítimamente para nosotros.
      prevent: () => false,
      duration: 1.05,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
      // syncTouch:false ⇒ touch nativo. Igual que el provider global.
      syncTouch: false,
      touchMultiplier: 1.5,
    });
    lenisRef.current = lenis;
    // Debug hook (dev-only): adjunta el instance al wrapper element para
    // que tests manuales puedan accederlo via DOM query.
    if (process.env.NODE_ENV !== 'production') {
      (wrapper as unknown as { __lenis?: Lenis }).__lenis = lenis;
    }

    let rafId = 0;
    const tick = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    // Lenis tiene autoResize internamente (ResizeObserver sobre wrapper
    // + content), pero a veces toma medidas estale al init cuando el
    // shell admin tiene componentes que crecen async (motion variants,
    // svg defs, AdminHeader). Forzamos resize en frames diferidos +
    // RO propio sobre el content para garantizar limit correcto.
    const forceResize = () => lenis.resize();
    const raf1 = requestAnimationFrame(() =>
      requestAnimationFrame(forceResize)
    );
    const t1 = window.setTimeout(forceResize, 200);
    const ro = new ResizeObserver(forceResize);
    ro.observe(content);

    return () => {
      cancelAnimationFrame(rafId);
      cancelAnimationFrame(raf1);
      window.clearTimeout(t1);
      ro.disconnect();
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [smooth]);

  // Reset de scroll al cambiar pathname. Si Lenis está activo, usar
  // scrollTo({immediate,force}) para que el state interno de Lenis se
  // sincronice — sin esto, Lenis mantiene su anim residual contra un
  // scrollTop=0 forzado a mano y el primer wheel "snapea" hacia atrás.
  useIsoLayoutEffect(() => {
    if (!resetOnPathChange) return;
    const lenis = lenisRef.current;
    if (lenis) {
      lenis.scrollTo(0, { immediate: true, force: true });
      return;
    }
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
          padre.

          La instancia anidada de Lenis (arriba) sí escucha eventos sobre
          este wrapper directamente — atacha sus listeners al elemento via
          options.wrapper, no via window. data-lenis-prevent solo afecta
          a la instancia global. */}
      <ScrollArea.Viewport
        ref={viewportRef}
        data-lenis-prevent
        className={`${maxHeight} w-full overscroll-contain outline-none`}
      >
        <ScrollArea.Content>
          {/* Inner div ref'd para que Lenis pueda medir el alto del
              contenido vía ResizeObserver. Aplica contentClassName aquí
              (no en ScrollArea.Content) porque Lenis necesita una caja
              real para observar — display:contents no genera box y
              rompe el sizing. El ScrollArea.Content padre queda como
              passthrough; los hijos flex/grid del consumer viven en
              este div. */}
          <div ref={contentRef} className={contentClassName}>
            {children}
          </div>
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
