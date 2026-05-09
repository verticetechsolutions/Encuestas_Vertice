// withViewTransition — wrapper sobre la View Transitions API nativa.
// Cuando el browser la soporta (Chrome ≥111, Edge, Safari 18+, Firefox 2026+),
// envuelve el callback para animar la transición. Cuando no existe (Safari ≤17,
// Firefox legacy), llama al callback directo. Caller no necesita ramificar.
//
// Para que la animación funcione, el caller debe haber aplicado
// `view-transition-name: <id>` a los elementos que cambian (ej: el <article>
// del HeroPregunta). El CSS de animación vive en globals.css.

type StartViewTransition = (cb: () => void) => { finished: Promise<void> };

interface DocumentWithVT {
  startViewTransition?: StartViewTransition;
}

export function withViewTransition(callback: () => void): void {
  if (typeof document === 'undefined') {
    callback();
    return;
  }
  const doc = document as unknown as DocumentWithVT;
  if (typeof doc.startViewTransition !== 'function') {
    callback();
    return;
  }
  doc.startViewTransition(callback);
}
