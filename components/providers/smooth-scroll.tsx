'use client';

// Smooth scroll global con Lenis. Cubre landing, encuesta y admin desde el
// root layout. Monta <ReactLenis root> sobre <html> — el wrapper hace el
// requestAnimationFrame loop (autoRaf=true por default) y agrega la clase
// `lenis` al <html> para hooks de CSS opcionales.
//
// Tree invariance (SSR === CSR):
//   ReactLenis SIEMPRE está en el árbol, independiente de reduced-motion.
//   Antes hacíamos mount condicional (mounted=false en SSR, mounted=true en
//   CSR), pero ReactLenis renderiza un <LenisContext.Provider> wrapper — el
//   conditional cambiaba la estructura del tree entre server/client y
//   desplazaba todos los useId() paths (Base UI Tooltip, etc.), causando
//   hydration mismatches masivos en cada componente con useId.
//
// Reduced motion:
//   Detectado en client (useEffect + matchMedia) y aplicado via lenis.stop().
//   stop() congela el RAF loop pero mantiene el provider en el tree, así que
//   la estructura React no cambia — solo el comportamiento. Cambio runtime
//   de la preferencia (e.g. system settings) se aplica vía listener.
//
// SPA navigation:
//   En cambio de pathname, resetear scroll a 0 inmediato. Sin esto Lenis
//   conserva la posición de scroll de la página previa por inercia residual
//   (issue conocido en discussions de Lenis).
//
// Dialogs / ScrollArea internos:
//   Lenis intercepta wheel/touch a nivel window. Para que un scroll
//   contenedor interno (e.g. ScrollArea del command palette) reciba sus
//   propios eventos, marcarlo con `data-lenis-prevent` en su raíz o en el
//   viewport. Para detener inercia residual mientras un modal está abierto,
//   usar el hook `useLockLenisScroll(open)`.

import { ReactLenis, useLenis } from 'lenis/react';
import { usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

// Easing expo-out — default que recomienda el docs de Lenis. Curve suave
// que decelera fuerte al final, sintiendo "natural inercia" sin overshoot.
function expoOut(t: number): number {
  return Math.min(1, 1.001 - Math.pow(2, -10 * t));
}

const LENIS_OPTIONS = {
  duration: 1.2,
  easing: expoOut,
  smoothWheel: true,
  syncTouch: false,
} as const;

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

  // Reduced motion → detener el RAF loop. No unmonta el provider, así que
  // el tree React no cambia (vs nuestro intento previo con mounted flag,
  // que rompió hydration al alternar la presencia del LenisContext.Provider).
  useEffect(() => {
    if (!lenis) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      if (mq.matches) lenis.stop();
      else lenis.start();
    };
    apply();
    mq.addEventListener('change', apply);
    return () => {
      mq.removeEventListener('change', apply);
      // Restaurar al desmontar — defensive contra estado inconsistente si
      // el provider se reinstancia.
      lenis.start();
    };
  }, [lenis]);

  // Reset scroll-to-top en cada cambio de pathname. immediate+force evita
  // la animación de Lenis (sería visualmente ruidosa en page transitions)
  // y fuerza el cambio aun si hay un scroll en curso.
  useEffect(() => {
    if (!lenis) return;
    lenis.scrollTo(0, { immediate: true, force: true });
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
