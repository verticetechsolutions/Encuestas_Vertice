'use client';

// Smooth scroll global con Lenis. Único provider del proyecto — cubre
// landing, /terminos, /entrevista y resto. Admin pausa Lenis (ver más
// abajo) porque su shell es `fixed inset-0` + AdminScrollArea.
//
// Tree invariance (SSR === CSR):
//   ReactLenis SIEMPRE está en el árbol, independiente de reduced-motion
//   o pathname. Antes hacíamos mount condicional, pero ReactLenis renderea
//   un <LenisContext.Provider> y alternarlo cambia la estructura del
//   árbol entre server/client — los useId() paths (Base UI Tooltip,
//   Select, etc.) se desplazan y dispara hydration mismatches masivos.
//   Solución: provider siempre montado, comportamiento toggled vía
//   start()/stop().
//
// GSAP integration:
//   Patrón canonical de Lenis docs. lenis.raf via gsap.ticker, ScrollTrigger
//   .update on cada scroll, lagSmoothing(0) para que el scrub no salte
//   cuando el frame se demora. ScrollTrigger.refresh() después de wirear
//   para que los triggers (pin, scrub) recalculen offsets ahora que el
//   document height ya está estable. Antes vivía en
//   components/landing/LenisProvider — duplicaba Lenis y rompía scroll
//   cerca del footer.
//
// Reduced motion:
//   Detectado en client (useEffect + matchMedia). matches ⇒ lenis.stop()
//   congela el RAF loop y deja scroll nativo del browser. Listener captura
//   cambio runtime (system settings).
//
// Admin pathnames:
//   /admin/* usa un wrapper `fixed inset-0` con AdminScrollArea (Base UI)
//   adentro. El document body queda con altura 0, así que Lenis no tiene
//   nada que animar — pero el RAF loop seguiría corriendo y el wheel
//   listener seguiría capturando eventos que NUNCA llegan al scroll
//   real (que vive dentro del AdminScrollArea via data-lenis-prevent).
//   Detenemos Lenis explícitamente en admin para liberar el CPU y evitar
//   side-effects.
//
// SPA navigation:
//   En cambio de pathname, reset scroll a 0 inmediato. Sin esto Lenis
//   conserva la posición de scroll anterior por inercia residual.
//
// Dialogs / ScrollArea internos:
//   Lenis intercepta wheel/touch a nivel window. Para que un scroll
//   contenedor interno (ScrollArea del command palette, Textarea con
//   overflow, JSON <pre>, Select viewport, Dialog popup) reciba sus
//   propios eventos, marcarlo con `data-lenis-prevent` en su raíz o en
//   el viewport. Para detener inercia residual mientras un modal está
//   abierto, usar el hook `useLockLenisScroll(open)`.

import { ReactLenis, useLenis } from 'lenis/react';
import { usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

// Easing expo-out — default que recomienda el docs de Lenis. Curve suave
// que decelera fuerte al final, sintiendo "natural inercia" sin overshoot.
function expoOut(t: number): number {
  return Math.min(1, 1.001 - Math.pow(2, -10 * t));
}

const LENIS_OPTIONS = {
  duration: 1.15,
  easing: expoOut,
  smoothWheel: true,
  wheelMultiplier: 1,
  // syncTouch:false ⇒ Lenis no intercepta touch; el browser hace el scroll
  // nativo. Recomendado por Lenis docs en mobile — syncTouch produce
  // inercia rara comparado al swipe nativo iOS/Android.
  syncTouch: false,
  touchMultiplier: 1.5,
  // autoRaf:false porque queremos pisar el RAF con gsap.ticker para que
  // el scrub de ScrollTrigger esté en sync con cada frame de Lenis.
  autoRaf: false,
} as const;

// Rutas donde Lenis debe estar pausado. Cualquier path que empiece con uno
// de estos prefijos es admin-territory: scroll vive en AdminScrollArea
// interno y Lenis sería ruido.
const LENIS_DISABLED_PREFIXES = ['/admin'] as const;

function shouldDisableLenis(pathname: string | null): boolean {
  if (!pathname) return false;
  return LENIS_DISABLED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function SmoothScroll({ children }: { children: ReactNode }) {
  return (
    <ReactLenis root options={LENIS_OPTIONS}>
      <SmoothScrollEffects />
      {children}
    </ReactLenis>
  );
}

// Side-effects que necesitan el lenis instance del context. Vive como
// hermano de children adentro del Provider para que useLenis() resuelva.
// Renderiza null — solo side-effects.
function SmoothScrollEffects() {
  const lenis = useLenis();
  const pathname = usePathname();

  // GSAP ScrollTrigger bridge. Wired una sola vez por instancia de
  // Lenis. Sin este bridge, ScrollTrigger lee window.scrollY (que sí
  // refleja Lenis) pero su update corre en su propio ticker —
  // desalinea el scrub y produce jank en pins cercanos al footer
  // (síntoma reportado: "al llegar al fondo no puedo scrollear").
  useEffect(() => {
    if (!lenis) return;

    const onScroll = () => ScrollTrigger.update();
    lenis.on('scroll', onScroll);

    const tick = (time: number) => {
      // gsap.ticker entrega time en segundos; lenis.raf espera ms.
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(tick);
    // lagSmoothing(0) deshabilita el catch-up de GSAP cuando hay frame
    // drops. Sin esto, GSAP "salta" para compensar lag y Lenis va a un
    // delta diferente — el scrub se desincroniza visualmente.
    gsap.ticker.lagSmoothing(0);

    // Refresh después de wirear: alinea las posiciones de los triggers
    // con el smooth scroll actual. Sin esto, triggers cercanos al fondo
    // (footer wordmark, pinSpacing del hero) pueden quedar desfasados.
    ScrollTrigger.refresh();

    return () => {
      lenis.off('scroll', onScroll);
      gsap.ticker.remove(tick);
      // Restaurar lagSmoothing al default de GSAP — si después se monta
      // otro provider, no queremos heredar nuestro override.
      gsap.ticker.lagSmoothing(500, 33);
    };
  }, [lenis]);

  // Reduced motion + admin pathnames → detener el RAF loop. No
  // desmonta el provider, así que el tree React no cambia. Cualquiera
  // de las dos condiciones activa el stop.
  useEffect(() => {
    if (!lenis) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      const disabled = mq.matches || shouldDisableLenis(pathname);
      if (disabled) lenis.stop();
      else lenis.start();
    };
    apply();
    mq.addEventListener('change', apply);
    return () => {
      mq.removeEventListener('change', apply);
      // Restaurar al desmontar — defensive contra estado inconsistente.
      lenis.start();
    };
  }, [lenis, pathname]);

  // Reset scroll-to-top en cada cambio de pathname. immediate+force
  // evita la animación de Lenis (sería visualmente ruidosa en page
  // transitions) y fuerza el cambio aun si hay un scroll en curso.
  // También dispara un ScrollTrigger.refresh tras el reset porque la
  // página nueva puede tener distinta altura (sin esto, triggers de la
  // primera página pueden persistir con offsets equivocados al volver).
  useEffect(() => {
    if (!lenis) return;
    lenis.scrollTo(0, { immediate: true, force: true });
    // Refresh diferido: deja que React commitee el árbol nuevo antes de
    // recalcular triggers. requestAnimationFrame asegura un paint entre
    // medio. Sin esto, ScrollTrigger lee dimensiones del DOM viejo.
    const raf = requestAnimationFrame(() => {
      ScrollTrigger.refresh();
    });
    return () => cancelAnimationFrame(raf);
  }, [pathname, lenis]);

  return null;
}

/**
 * Detiene el RAF loop de Lenis mientras `locked === true`. Complementa el
 * `data-lenis-prevent` en modales: el attr impide que wheel/touch sobre el
 * modal muevan la página, pero no detiene la inercia residual si el modal
 * se abre con un scroll en curso. `lenis.stop()` congela el offset en su
 * valor actual hasta `start()`.
 *
 * Safe-by-default: si Lenis no está montado (SSR, error), el hook es
 * no-op — el browser ya no tiene scroll animado que detener.
 *
 * Uso típico desde un Dialog client component:
 *   useLockLenisScroll(open);
 */
export function useLockLenisScroll(locked: boolean): void {
  const lenis = useLenis();

  useEffect(() => {
    if (!lenis) return;
    if (locked) lenis.stop();
    else lenis.start();
    // Cleanup defensivo: si el componente se desmonta con locked=true (e.g.
    // el modal se cierra navegando), restaurar el loop para que la próxima
    // página no quede congelada.
    return () => {
      lenis.start();
    };
  }, [locked, lenis]);
}
