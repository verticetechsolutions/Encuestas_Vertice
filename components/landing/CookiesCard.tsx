'use client';

// Mini floating card para cookies. Aparece sólo al click del link "Cookies"
// del footer. Forma orgánica (border-radius asimétrico), SVG con path morph
// continuo (galleta-blob) + crumbs que palpitan. No bloquea la página: es un
// toast persistente, no un modal.

import { useEffect, useRef, useState, type AnimationEvent } from 'react';
import { X } from 'lucide-react';
import Link from 'next/link';

function CookieMorph() {
  return (
    <svg viewBox="0 0 80 80" className="size-14 shrink-0" aria-hidden>
      <defs>
        <radialGradient id="cm-glow" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0%" stopColor="#F2D89C" />
          <stop offset="60%" stopColor="#C8A864" />
          <stop offset="100%" stopColor="#8C6A30" />
        </radialGradient>
      </defs>
      {/* Galleta-blob — morph entre 4 estados redondos asimétricos */}
      <path fill="url(#cm-glow)">
        <animate
          attributeName="d"
          dur="9s"
          repeatCount="indefinite"
          values="
            M40 6 C58 6 74 22 74 40 C74 58 58 74 40 74 C22 74 6 58 6 40 C6 22 22 6 40 6 Z;
            M44 8 C62 12 76 26 74 42 C72 60 56 76 38 74 C20 72 6 56 6 38 C8 22 26 4 44 8 Z;
            M38 4 C58 4 76 18 76 38 C78 58 58 74 40 76 C22 74 4 60 4 40 C4 22 22 4 38 4 Z;
            M42 6 C62 8 76 22 74 40 C76 60 58 76 40 74 C22 74 6 58 8 38 C8 22 22 4 42 6 Z;
            M40 6 C58 6 74 22 74 40 C74 58 58 74 40 74 C22 74 6 58 6 40 C6 22 22 6 40 6 Z
          "
        />
      </path>
      {/* Crumbs — palpitan en counter-phase */}
      <circle cx="28" cy="32" r="3" fill="#3A2410">
        <animate attributeName="r" values="3;3.6;3" dur="2.4s" repeatCount="indefinite" />
      </circle>
      <circle cx="50" cy="28" r="2.4" fill="#3A2410">
        <animate
          attributeName="r"
          values="2.4;3;2.4"
          dur="2.7s"
          begin="0.3s"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx="46" cy="50" r="2" fill="#3A2410">
        <animate
          attributeName="r"
          values="2;2.6;2"
          dur="2.2s"
          begin="0.6s"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx="32" cy="48" r="1.8" fill="#3A2410">
        <animate
          attributeName="r"
          values="1.8;2.3;1.8"
          dur="2.9s"
          begin="0.9s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
}

export function CookiesCard({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  // shouldRender retiene la card en el DOM mientras corre la animación de salida.
  // leaving dispara la animación reversa via data-leaving="true" en globals.css.
  // El unmount real lo hace onAnimationEnd cuando termina la salida — evita
  // races contra el setTimeout y reinicios de animación bajo StrictMode.
  const [shouldRender, setShouldRender] = useState(open);
  const [leaving, setLeaving] = useState(false);
  const prevOpen = useRef(open);

  useEffect(() => {
    if (open && !prevOpen.current) {
      // false → true: monta la card y limpia leaving por si reabrió en mid-exit
      setLeaving(false);
      setShouldRender(true);
    } else if (!open && prevOpen.current) {
      // true → false: arranca la animación de salida; el unmount lo hace animationend
      setLeaving(true);
    }
    prevOpen.current = open;
  }, [open]);

  const handleAnimationEnd = (e: AnimationEvent<HTMLDivElement>) => {
    // Sólo el evento del wrapper outer cuenta — y sólo cuando termina la
    // animación de salida (cookie-pop-out). Las del SVG (SMIL) no disparan
    // animationend, pero filtramos por nombre por seguridad.
    if (e.target !== e.currentTarget) return;
    if (e.animationName !== 'cookie-pop-out') return;
    setShouldRender(false);
    setLeaving(false);
  };

  if (!shouldRender) return null;
  return (
    <div
      role="dialog"
      aria-label="Aviso de cookies"
      data-leaving={leaving ? 'true' : undefined}
      onAnimationEnd={handleAnimationEnd}
      className="cookie-card fixed bottom-6 right-6 z-40 w-[min(92vw,380px)]"
    >
      <div
        className="relative bg-[#F4F1EA] text-[#0A0F1C] p-5 shadow-[0_30px_70px_-15px_rgba(0,0,0,0.45),0_0_0_1px_rgba(10,15,28,0.05)]"
        style={{
          borderRadius: '40px 56px 32px 64px',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex size-7 items-center justify-center rounded-full text-[#0A0F1C]/45 transition-colors hover:bg-[#0A0F1C]/5 hover:text-[#0A0F1C]"
          aria-label="Cerrar aviso de cookies"
        >
          <X className="size-4" />
        </button>
        <div className="flex items-start gap-4">
          <CookieMorph />
          <div className="min-w-0 flex-1 pr-6">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-[#0A0F1C]/45">
              Aviso · Cookies
            </div>
            <h3
              className="mt-1.5 text-[19px] leading-[1.2] tracking-[-0.018em] text-[#0A0F1C]"
              style={{
                fontFamily: "'General Sans', 'Satoshi', ui-sans-serif, sans-serif",
                fontWeight: 500,
              }}
            >
              Sólo las necesarias.
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[#0A0F1C]/65">
              Mantenemos tu sesión con un identificador opaco. Sin publicidad, sin tracking, sin
              perfilamiento.
            </p>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between gap-3 pl-[72px]">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center gap-2 rounded-full bg-[#0A0F1C] px-4 text-[12px] font-medium text-[#F4F1EA] transition-colors hover:bg-[#1a2236]"
          >
            Entendido
          </button>
          <Link
            href="/terminos#cookies"
            className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#0A0F1C]/55 underline-offset-[6px] hover:underline"
            onClick={onClose}
          >
            Política completa →
          </Link>
        </div>
      </div>
    </div>
  );
}
