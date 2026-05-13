'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Dialog } from '@base-ui/react/dialog';
import { ArrowLeft, ArrowUpRight, Building2, Mail, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { VertexMark } from '@/components/landing/VertexMark';
import { CookiesCard } from '@/components/landing/CookiesCard';
import { BrandSuccessGlyph } from '@/components/landing/BrandSuccessGlyph';
import { useLockLenisScroll } from '@/components/providers/smooth-scroll';
import { FooterLink } from '@/components/landing/FooterLink';
import { HeaderCTA } from '@/components/landing/HeaderCTA';
import { HeroLine } from '@/components/landing/HeroLine';
import { SectionIndicator } from '@/components/landing/SectionIndicator';
import { cn } from '@/lib/utils';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

// =============================================================================
// Hooks
// =============================================================================
function useMagnetic<T extends HTMLElement>(strength = 0.16) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      el.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
    };
    const onLeave = () => {
      el.style.transform = '';
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [strength]);
  return ref;
}

// 3D tilt sobre cursor — el elemento se inclina hacia el puntero. Setea
// también CSS vars --mx/--my (0..100%) para gradients que sigan al cursor.
function useTilt<T extends HTMLElement>(maxDeg = 10) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    let nextRX = 0;
    let nextRY = 0;
    const apply = () => {
      el.style.transform = `perspective(900px) rotateX(${nextRX}deg) rotateY(${nextRY}deg)`;
    };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      el.style.setProperty('--mx', `${x * 100}%`);
      el.style.setProperty('--my', `${y * 100}%`);
      nextRX = (0.5 - y) * maxDeg;
      nextRY = (x - 0.5) * maxDeg;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      cancelAnimationFrame(raf);
      el.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg)';
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      cancelAnimationFrame(raf);
    };
  }, [maxDeg]);
  return ref;
}

function useScrollProgress() {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      const v = total > 0 ? (window.scrollY / total) * 100 : 0;
      setPct(Math.max(0, Math.min(100, Math.round(v))));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return pct;
}

// =============================================================================
// Reveal primitives
// =============================================================================
function RevealLine({
  text,
  baseDelay = 0,
  stagger = 90,
  className,
}: {
  text: string;
  baseDelay?: number;
  stagger?: number;
  className?: string;
}) {
  const words = text.split(' ');
  return (
    <span className={className}>
      {words.map((w, i) => (
        <span
          key={`${w}-${i}`}
          className="ln-word-mask"
          style={{ marginRight: i === words.length - 1 ? 0 : '0.28em' }}
        >
          <span style={{ animationDelay: `${baseDelay + i * stagger}ms` }}>{w}</span>
        </span>
      ))}
    </span>
  );
}

function RevealChars({
  text,
  baseDelay = 0,
  stagger = 38,
  className,
}: {
  text: string;
  baseDelay?: number;
  stagger?: number;
  className?: string;
}) {
  const chars = Array.from(text);
  return (
    <span className={className} aria-label={text}>
      {chars.map((c, i) => (
        <span
          key={i}
          aria-hidden
          className="ln-char"
          style={{ animationDelay: `${baseDelay + i * stagger}ms` }}
        >
          {c === ' ' ? ' ' : c}
        </span>
      ))}
    </span>
  );
}

// =============================================================================
// Mini V mark — usa el VertexMark real para que el icono sea consistente con
// la marca grande del hero. El path morph existe en globals.css (.vx-mark).
// =============================================================================
function CollapsedMorphMark() {
  return <VertexMark variant="inline" className="size-7" />;
}

// Inline Google G
// =============================================================================
function GoogleG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden className={className}>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

// Validación email — RFC-lite: local@dominio.tld, sin espacios, con punto en
// el dominio. Suficiente para frenar typos obvios sin ahogar correos legítimos.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isValidEmail = (v: string) => EMAIL_RE.test(v.trim());

// =============================================================================
// Constants
// =============================================================================
const TIPOS_INSTITUCION = [
  { value: 'banco', label: 'Banco' },
  { value: 'sofom_er', label: 'SOFOM E.R.' },
  { value: 'sofom_enr', label: 'SOFOM E.N.R.' },
  { value: 'sofipo', label: 'SOFIPO' },
  { value: 'socap', label: 'SOCAP' },
  { value: 'arrendadora', label: 'Arrendadora' },
  { value: 'factoraje', label: 'Factoraje' },
  { value: 'ifc', label: 'IFC' },
  { value: 'otro', label: 'Otro' },
] as const;

type DialogMode = 'menu' | 'access' | 'request';

// =============================================================================
// Landing
// =============================================================================
export default function Landing() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<DialogMode>('menu');
  const [fromMenu, setFromMenu] = useState(false);
  // Cuando RequestFlow registra la solicitud, sube el folio al parent. Lo
  // usamos para mutar el kicker del shell ("Alianza · K9SCMA") y darle al
  // diálogo una sensación de "constancia" — el chrome cambia con el estado.
  const [requestFolio, setRequestFolio] = useState<string | null>(null);

  useEffect(() => {
    const prevBody = document.body.style.backgroundColor;
    const prevHtml = document.documentElement.style.backgroundColor;
    document.body.style.backgroundColor = '#0A0F1C';
    document.documentElement.style.backgroundColor = '#0A0F1C';
    return () => {
      document.body.style.backgroundColor = prevBody;
      document.documentElement.style.backgroundColor = prevHtml;
    };
  }, []);

  // GSAP scroll triggers
  // ---------------------
  // (A) Word-color scrub en el headline mientras el hero está pinned.
  // (B) Pin del hero por 1 viewport extra → siguiente sección se "destapa".
  // (F) Footer wordmark scaleX + opacity outro al entrar al viewport.
  // + manifiesto stagger reveal + vertex departure rotation durante pin.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      // ===== (B) Hero pin + (A) word-color scrub ============================
      const heroTL = gsap.timeline({
        scrollTrigger: {
          trigger: '[data-anim="hero"]',
          start: 'top top',
          end: '+=110%',
          pin: true,
          pinSpacing: true,
          scrub: 0.8,
          anticipatePin: 1,
        },
      });

      // Spotlight simple: cambio de color + scale en la línea activa. Sin
      // gradient, sin glow. Limpio inline styles residuales (textShadow/filter)
      // por si quedaron de iteraciones anteriores.
      const CLEAN = { textShadow: 'none', filter: 'none' };
      const CREAM = 'rgba(244,241,234,0.95)';
      const GOLD_MUTED = '#9C824A';
      const GOLD_BRIGHT = '#F2D89C';

      gsap.set('[data-line-wrap]', { transformOrigin: 'left center', scale: 1, ...CLEAN });
      gsap.set('[data-line-wrap="1"]', { color: CREAM });
      gsap.set('[data-line-wrap="2"]', { color: CREAM });
      gsap.set('[data-line-wrap="3"]', { color: GOLD_MUTED });

      heroTL
        // ---- Beat 1: línea 1 ACTIVE -----------------------------------------
        .to('[data-line-wrap="1"]', { color: GOLD_BRIGHT, scale: 1.05, duration: 1, ease: 'power2.out' }, 0)
        // ---- Beat 2: línea 1 vuelve a REST, línea 2 ACTIVE ------------------
        .to('[data-line-wrap="1"]', { color: CREAM, scale: 1, duration: 1, ease: 'power2.out' }, 1)
        .to('[data-line-wrap="2"]', { color: GOLD_BRIGHT, scale: 1.05, duration: 1, ease: 'power2.out' }, 1)
        // ---- Beat 3: línea 2 vuelve a REST, línea 3 ACTIVE_GOLD --------------
        .to('[data-line-wrap="2"]', { color: CREAM, scale: 1, duration: 1, ease: 'power2.out' }, 2)
        .to('[data-line-wrap="3"]', { color: GOLD_BRIGHT, scale: 1.07, duration: 1, ease: 'power2.out' }, 2)
        // Vertex sigil — drift + scale sutil durante el pin
        .to(
          '[data-anim="vertex-sigil"]',
          { rotation: -5, scale: 0.95, ease: 'none', duration: 3 },
          0
        )
        // Sub-deck y CTAs se atenúan ligeramente (no demasiado)
        .to(
          '[data-anim="hero-deck"]',
          { opacity: 0.55, y: -18, ease: 'none', duration: 3 },
          0
        );

      // ===== (D) Manifest: cada fila tiene scrub propio + composición ========
      gsap.from('[data-anim="manifest-title"]', {
        opacity: 0,
        x: -40,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '[data-anim="manifest"]',
          start: 'top 80%',
          toggleActions: 'play none none reverse',
        },
      });

      gsap.utils.toArray<HTMLElement>('[data-anim="manifest-row"]').forEach((row) => {
        const num = row.querySelector('[data-row="num"]');
        const label = row.querySelector('[data-row="label"]');
        const value = row.querySelector('[data-row="value"]');

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: row,
            start: 'top 88%',
            end: 'top 50%',
            scrub: 0.6,
          },
        });
        tl.from(num, {
          opacity: 0,
          scale: 0.5,
          rotation: -25,
          ease: 'power3.out',
          duration: 1,
        })
          .from(
            label,
            { opacity: 0, x: -18, ease: 'power2.out', duration: 1 },
            0.25
          )
          .from(
            value,
            {
              opacity: 0,
              clipPath: 'inset(0 100% 0 0)',
              ease: 'power3.out',
              duration: 1.2,
            },
            0.5
          );
      });

      // ===== (F) Footer wordmark — opacity-only ramp ========================
      // scaleX se quitó: forzaba repaint de un SVG de 7095px en cada frame de
      // scroll y trababa Lenis cerca del fondo. Opacity es cheap (compositor).
      gsap.fromTo(
        '[data-anim="footer-wordmark"]',
        { opacity: 0.06 },
        {
          opacity: 0.32,
          ease: 'none',
          scrollTrigger: {
            trigger: '[data-anim="footer-wordmark"]',
            start: 'top bottom',
            end: 'bottom bottom-=60',
            scrub: 0.8,
          },
        }
      );
    });
    return () => ctx.revert();
  }, []);

  const openMode = (m: DialogMode) => {
    setMode(m);
    setFromMenu(false);
    setOpen(true);
  };
  const pickFromMenu = (m: 'access' | 'request') => {
    setMode(m);
    setFromMenu(true);
  };

  const cta1 = useMagnetic<HTMLButtonElement>(0.12);
  const cta2 = useMagnetic<HTMLButtonElement>(0.14);
  const vertexTiltRef = useTilt<HTMLDivElement>(11);
  const [cookiesOpen, setCookiesOpen] = useState(false);

  // Mientras el Dialog (acceso/solicitud) o la CookiesCard estén
  // abiertos, congelar Lenis. Los popups ya tienen data-lenis-prevent,
  // pero sin esto la inercia residual de un scroll en curso seguiría
  // moviendo la página de fondo bajo el modal.
  useLockLenisScroll(open || cookiesOpen);

  return (
    <>
      <div
        className="landing-root relative flex min-h-screen w-full flex-1 flex-col overflow-x-clip bg-ink text-cream-pure"
        style={{ fontFamily: "'Satoshi', ui-sans-serif, system-ui, sans-serif" }}
      >
        {/* Atmosphere */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(1100px 700px at 88% -8%, rgba(200,168,100,0.06), transparent 60%)',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.018] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.7'/%3E%3C/svg%3E\")",
          }}
        />

        <Dialog.Root
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) {
              // Limpia el folio tras la animación de salida del Dialog (~300ms).
              window.setTimeout(() => setRequestFolio(null), 360);
            }
          }}
        >
          {/* ====================================================== HEADER STATIC
            Una sola fila, todos los elementos centrados verticalmente. */}
          <header className="pointer-events-none fixed inset-x-0 top-0 z-30">
            <div className="mx-auto w-full max-w-[1480px] px-6 pt-6 sm:px-10 lg:px-14">
              <div className="relative flex h-14 items-center justify-end gap-4 sm:h-16">
                <div style={{ animation: 'ln-fade-in 0.9s 0.32s both' }}>
                  <HeaderCTA onClick={() => openMode('menu')} />
                </div>
              </div>
            </div>
          </header>

          <main className="relative z-10 mx-auto w-full max-w-[1480px] flex-1 px-6 sm:px-10 lg:px-14">
            {/* ============================================================== HERO */}
            <section
              id="hero"
              data-anim="hero"
              className="relative grid grid-cols-12 items-end gap-x-6 gap-y-10 pb-16 pt-24 sm:gap-y-14 sm:pt-28 lg:gap-x-10 lg:pb-20 lg:pt-36"
            >
              <div className="col-span-12 lg:col-span-8">
                <div
                  className="font-mono text-[10.5px] uppercase tracking-[0.32em] text-cream-pure/45"
                  style={{ animation: 'ln-fade-in 0.9s 0.05s both' }}
                >
                  Red de financieras aliadas · MX 2026
                </div>

                <h1
                  className="mt-7 font-display leading-[0.95] tracking-[-0.03em] text-cream-pure"
                  style={{
                    fontWeight: 500,
                    fontSize: 'clamp(46px, 7.4vw, 108px)',
                  }}
                >
                  <HeroLine n={1} text="Solicitantes" baseDelay={120} />
                  <HeroLine n={2} text="pre-calificados" baseDelay={300} />
                  <HeroLine
                    n={3}
                    text="con IA."
                    baseDelay={620}
                    charStagger
                    charStep={42}
                    baseColor="#9C824A"
                  />
                </h1>

                <div data-anim="hero-deck">
                  <p
                    className="mt-9 max-w-[52ch] text-[15.5px] leading-relaxed text-cream-pure/72 sm:text-[17px]"
                    style={{ animation: 'ln-fade-in 0.9s 1.05s both' }}
                  >
                    En una entrevista breve, nuestra IA aprende la política de crédito de tu
                    institución. A partir de ahí, tu mesa solo recibe solicitantes que ya cumplen
                    tus criterios.
                  </p>

                  {/* CTAs above the fold */}
                  <div
                    className="mt-10 flex flex-wrap items-center gap-3"
                    style={{ animation: 'ln-fade-in 0.9s 1.25s both' }}
                  >
                    <button
                      ref={cta1}
                      type="button"
                      onClick={() => openMode('request')}
                      className={cn(
                        'group/cta relative inline-flex h-12 items-center gap-3 rounded-full bg-cream-pure pl-6 pr-2 text-[13.5px] font-medium text-ink',
                        'transition-colors duration-200 will-change-transform',
                        'shadow-[0_0_0_1px_rgba(244,241,234,0.04),0_30px_70px_-20px_rgba(200,168,100,0.45)]',
                        'hover:bg-white'
                      )}
                    >
                      Solicitar alianza
                      <span className="inline-flex size-9 items-center justify-center rounded-full bg-ink text-gold transition-transform group-hover/cta:rotate-45">
                        <ArrowUpRight className="size-4" strokeWidth={2.5} />
                      </span>
                    </button>
                    <button
                      ref={cta2}
                      type="button"
                      onClick={() => openMode('access')}
                      className={cn(
                        'group/ghost inline-flex h-12 items-center gap-2.5 rounded-full border border-cream-pure/20 px-5 text-[13.5px] font-medium text-cream-pure',
                        'transition-[color,border-color] duration-200 will-change-transform',
                        'hover:border-cream-pure/45'
                      )}
                    >
                      <GoogleG className="size-4" />
                      Ya tengo acceso
                    </button>
                  </div>
                </div>
              </div>

              {/* Vertex sigil + scroll cue — protagónico, con glow gold */}
              <div
                className="col-span-12 lg:col-span-4 lg:flex lg:flex-col lg:items-end"
                data-anim="vertex-sigil"
              >
                <div
                  ref={vertexTiltRef}
                  className="relative ml-auto aspect-[1380/1093] w-full max-w-[300px] lg:max-w-[380px] transition-transform duration-300 ease-out will-change-transform"
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  <VertexMark
                    variant="inline"
                    className="vx-glow absolute inset-0 h-full w-full"
                  />
                </div>
                <div className="hidden lg:mt-14 lg:flex lg:items-center lg:gap-2 lg:font-mono lg:text-[10.5px] lg:uppercase lg:tracking-[0.32em] lg:text-cream-pure/45">
                  <span className="ln-scroll-cue">↓</span>
                  <span>
                    Cómo <span className="text-gold">funciona</span>
                  </span>
                </div>
              </div>
            </section>

            {/* ========================================================= MANIFEST */}
            <section
              id="brief"
              data-anim="manifest"
              className={cn(
                'relative my-10 overflow-hidden rounded-[28px] px-6 py-14 sm:my-14 sm:px-10 sm:py-20 lg:px-14',
                // subtle card: cream wash + cream hairline + barely-visible gold seam at top
                'bg-gradient-to-b from-cream-pure/[0.028] via-cream-pure/[0.014] to-cream-pure/[0.005]',
                'shadow-[inset_0_0_0_1px_rgba(244,241,234,0.055),inset_0_1px_0_rgba(200,168,100,0.18)]'
              )}
            >
              <div className="relative grid grid-cols-12 items-start gap-x-6 gap-y-10 lg:gap-x-10">
                <div className="col-span-12 lg:col-span-3" data-anim="manifest-title">
                  <div className="font-mono text-[10.5px] uppercase tracking-[0.32em] text-cream-pure/45">
                    Cómo funciona
                  </div>
                  <h2
                    className="mt-5 font-display tracking-[-0.022em] leading-[1.02] text-cream-pure"
                    style={{ fontWeight: 500, fontSize: 'clamp(28px, 3.6vw, 46px)' }}
                  >
                    Dos momentos.
                    <br />
                    <span className="font-light text-cream-pure/55">Una alianza.</span>
                  </h2>
                </div>
                <dl className="col-span-12 grid grid-cols-1 gap-y-6 lg:col-span-9">
                  <ManifestRow
                    num="01"
                    label="Tu entrevista"
                    value="Doce minutos. Tu institución le explica a nuestra IA cómo evalúa el crédito. Voz o texto."
                  />
                  <ManifestRow
                    num="02"
                    label="Tus casos"
                    value="Distribuimos solicitantes pre-calificados según tu política. Llegan listos para que tu mesa decida."
                  />
                </dl>
              </div>
            </section>
          </main>

          {/* ============================================================== FOOTER */}
          <footer id="cierre" className="relative z-10 mt-10">
            {/* Wordmark gigante — signature flourish (firma editorial) */}
            <div
              aria-hidden
              className="relative mx-auto w-full max-w-[1480px] overflow-hidden px-4 pt-12 sm:px-6 lg:px-8"
            >
              <Image
                src="/Logo_white.svg"
                alt=""
                width={7095}
                height={2369}
                data-anim="footer-wordmark"
                className="h-auto w-full select-none opacity-[0.10]"
                style={{
                  // mask-image: el color es indiferente (sólo importa el alpha).
                  // Evitamos #000 puro por convención del proyecto (CLAUDE.md).
                  maskImage:
                    'linear-gradient(to bottom, #0A0A0A 30%, rgba(10,10,10,0.6) 70%, transparent 100%)',
                }}
              />
            </div>

            <div className="mx-auto flex w-full max-w-[1480px] flex-col items-start justify-between gap-6 px-6 py-8 sm:flex-row sm:items-center sm:px-10 lg:px-14">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.3em] text-cream-pure/45">
                Vértice © 2026 · Red de financieras aliadas
              </div>
              <nav className="flex flex-wrap items-center gap-6">
                <FooterLink href="/terminos">Términos</FooterLink>
                <FooterLink href="/terminos#privacidad">Privacidad</FooterLink>
                <FooterLink onClick={() => setCookiesOpen(true)}>Cookies</FooterLink>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.3em] text-cream-pure/25">/</span>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.3em] text-cream-pure/35">
                  Acceso por invitación
                </span>
              </nav>
            </div>
          </footer>

          {/* ============================================================== DIALOG */}
          <Dialog.Portal>
            <Dialog.Backdrop
              data-lenis-prevent
              className={cn(
                'fixed inset-0 z-50 bg-ink/82 backdrop-blur-sm',
                'data-[starting-style]:opacity-0 data-[ending-style]:opacity-0',
                'transition-opacity duration-300'
              )}
            />
            <Dialog.Popup
              data-lenis-prevent
              className={cn(
                'fixed left-1/2 top-1/2 z-50 w-[min(94vw,540px)] -translate-x-1/2 -translate-y-1/2',
                'overflow-hidden rounded-[28px] bg-cream-pure text-ink',
                'shadow-[0_30px_90px_-20px_rgba(0,0,0,0.5)] ring-1 ring-ink/[0.04]',
                'data-[starting-style]:scale-[0.96] data-[starting-style]:opacity-0',
                'data-[ending-style]:scale-[0.96] data-[ending-style]:opacity-0',
                'transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]'
              )}
            >
              <DialogShell
                onClose={() => setOpen(false)}
                onBack={
                  fromMenu && mode !== 'menu' && !requestFolio
                    ? () => setMode('menu')
                    : undefined
                }
              >
                {mode === 'menu' ? (
                  <MenuFlow onPick={pickFromMenu} />
                ) : mode === 'access' ? (
                  <AccessFlow />
                ) : (
                  <RequestFlow onSent={setRequestFolio} />
                )}
              </DialogShell>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>

        <SectionIndicator />
        <CookiesCard open={cookiesOpen} onClose={() => setCookiesOpen(false)} />
      </div>
    </>
  );
}

// =============================================================================
// Subcomponents
// =============================================================================
function ManifestRow({ num, label, value }: { num: string; label: string; value: string }) {
  return (
    <div
      data-anim="manifest-row"
      className="grid grid-cols-12 items-baseline gap-x-4 border-t border-cream-pure/6 pt-6 first:border-t-0 first:pt-0"
    >
      <span
        data-row="num"
        className="col-span-2 font-mono text-[10.5px] uppercase tracking-[0.3em] text-gold sm:col-span-1"
      >
        {num}
      </span>
      <dt
        data-row="label"
        className="col-span-10 font-mono text-[10.5px] uppercase tracking-[0.32em] text-cream-pure/45 sm:col-span-3"
      >
        {label}
      </dt>
      <dd
        data-row="value"
        className="col-span-12 mt-3 text-[16.5px] leading-relaxed text-cream-pure/85 sm:col-span-8 sm:mt-0 sm:text-[18px]"
      >
        {value}
      </dd>
    </div>
  );
}

function DialogShell({
  onClose,
  onBack,
  children,
}: {
  onClose: () => void;
  onBack?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="relative isolate">
      <span
        aria-hidden
        className="atmosphere-radial-gold-warm pointer-events-none absolute inset-0 -z-10"
      />

      {/* Top bar — solo logo + nav (sin borde, sin kicker). */}
      <div className="flex items-center justify-between px-8 pb-3 pt-7 sm:px-10 sm:pt-8">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="-ml-1 inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-ink/45 transition-all duration-200 hover:-translate-x-0.5 hover:bg-ink/5 hover:text-ink"
              aria-label="Volver"
            >
              <ArrowLeft className="size-4" strokeWidth={2} />
            </button>
          )}
          <Image
            src="/Logo_blue.svg"
            alt="Vértice"
            width={108}
            height={36}
            priority
            className="h-7 w-auto"
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-ink/45 transition-all duration-200 hover:bg-ink/5 hover:text-ink hover:rotate-90"
          aria-label="Cerrar"
        >
          <X className="size-4" strokeWidth={2} />
        </button>
      </div>

      <div className="px-8 pb-9 pt-4 sm:px-10 sm:pb-10 sm:pt-5">{children}</div>
    </div>
  );
}

// ---------- Menu flow -------------------------------------------------------
function MenuFlow({ onPick }: { onPick: (m: 'access' | 'request') => void }) {
  return (
    <>
      <Dialog.Title className="font-heading text-[clamp(30px,4.8vw,40px)] font-semibold leading-[0.98] tracking-[-0.025em] text-ink">
        Acceso a
        <br />
        <span className="text-gold-deep">la plataforma.</span>
      </Dialog.Title>
      <Dialog.Description className="mt-5 max-w-[34ch] text-[14px] leading-[1.55] text-ink/65">
        Selecciona la opción que aplica a tu institución.
      </Dialog.Description>

      <div className="mt-8 flex flex-col gap-3">
        <MenuOption
          title="Reanudar entrevista"
          description="Mi institución ya está registrada en Vértice"
          variant="light"
          onClick={() => onPick('access')}
        />
        <MenuOption
          title="Solicitar alianza"
          description="Registrar mi institución en la red"
          variant="dark"
          onClick={() => onPick('request')}
        />
      </div>
    </>
  );
}

function MenuOption({
  title,
  description,
  variant,
  onClick,
}: {
  title: string;
  description: string;
  variant: 'light' | 'dark';
  onClick: () => void;
}) {
  const isDark = variant === 'dark';
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group/opt flex w-full cursor-pointer items-center justify-between gap-5 rounded-[22px] p-5 text-left transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] md:p-6',
        isDark
          ? 'bg-ink text-cream-pure ring-1 ring-ink/[0.04] shadow-[0_0_0_1px_rgba(10,15,28,0.04),0_20px_50px_-20px_rgba(10,15,28,0.35)] hover:bg-ink-raised'
          : 'bg-survey-surface ring-1 ring-ink/[0.05] hover:ring-ink/[0.15] hover:bg-white'
      )}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <span
          className={cn(
            'text-[17px] font-semibold leading-snug tracking-[-0.01em]',
            isDark ? 'text-cream-pure' : 'text-ink'
          )}
        >
          {title}
        </span>
        <span
          className={cn(
            'text-[13.5px] leading-snug',
            isDark ? 'text-cream-pure/55' : 'text-ink/55'
          )}
        >
          {description}
        </span>
      </div>
      <span
        className={cn(
          'inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/opt:rotate-45',
          isDark
            ? 'bg-gold text-ink'
            : 'bg-ink text-cream-pure shadow-[0_0_0_1px_rgba(10,15,28,0.04),0_20px_50px_-20px_rgba(10,15,28,0.35)]'
        )}
      >
        <ArrowUpRight className="size-[18px]" strokeWidth={1.75} />
      </span>
    </button>
  );
}

// ---------- Access flow -----------------------------------------------------
function AccessFlow() {
  const [stage, setStage] = useState<'choose' | 'email' | 'sent_email'>('choose');
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  // signIn dispara el flow OAuth completo: redirect a Google → callback →
  // resolverUsuarioPorEmail. callbackUrl='/admin' por default; el server
  // redirige según role (admin → /admin, entrevistado → /entrevista/...).
  const handleGoogleSignIn = () => {
    // next-auth/react expone signIn. Lo importamos inline para que el bundle
    // del landing no lo cargue por default — solo cuando el usuario clickea.
    void import('next-auth/react').then(({ signIn }) => {
      signIn('google', { callbackUrl: '/admin' });
    });
  };

  if (stage === 'choose') {
    return (
      <>
        <Dialog.Title className="font-heading text-[clamp(30px,4.8vw,40px)] font-semibold leading-[0.98] tracking-[-0.025em] text-ink">
          Reanudar
          <br />
          <span className="text-gold-deep">entrevista.</span>
        </Dialog.Title>
        <Dialog.Description className="mt-5 max-w-[38ch] text-[14px] leading-[1.55] text-ink/65">
          Continúa con la cuenta de Google registrada por tu institución. La misma del correo de invitación.
        </Dialog.Description>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="group/g mt-8 flex w-full cursor-pointer items-center justify-between gap-5 rounded-[22px] bg-survey-surface p-5 text-left ring-1 ring-ink/[0.05] transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-white hover:ring-ink/[0.15] md:p-6"
        >
          <span className="flex min-w-0 items-center gap-4">
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-ink/[0.06]">
              <GoogleG className="size-4" />
            </span>
            <span className="flex flex-col gap-1.5">
              <span className="text-[17px] font-semibold leading-snug tracking-[-0.01em] text-ink">
                Continuar con Google
              </span>
              <span className="text-[13.5px] leading-snug text-ink/55">
                Cuenta institucional registrada
              </span>
            </span>
          </span>
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-cream-pure shadow-[0_0_0_1px_rgba(10,15,28,0.04),0_20px_50px_-20px_rgba(10,15,28,0.35)] transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/g:rotate-45">
            <ArrowUpRight className="size-[18px]" strokeWidth={1.75} />
          </span>
        </button>

        <div className="mt-6 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-ink/35">
          <span className="h-px flex-1 bg-ink/[0.08]" />
          <span>o</span>
          <span className="h-px flex-1 bg-ink/[0.08]" />
        </div>

        <button
          type="button"
          onClick={() => setStage('email')}
          className="group/e mt-6 flex w-full cursor-pointer items-center justify-between gap-5 rounded-[22px] bg-ink p-5 text-left text-cream-pure ring-1 ring-ink/[0.04] shadow-[0_0_0_1px_rgba(10,15,28,0.04),0_20px_50px_-20px_rgba(10,15,28,0.35)] transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-ink-raised md:p-6"
        >
          <span className="flex flex-col gap-1.5">
            <span className="text-[17px] font-semibold leading-snug tracking-[-0.01em] text-cream-pure">
              Reenviar mi enlace por correo
            </span>
            <span className="text-[13.5px] leading-snug text-cream-pure/55">
              Te llega un enlace nuevo en minutos
            </span>
          </span>
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-gold text-ink transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/e:rotate-45">
            <ArrowUpRight className="size-[18px]" strokeWidth={1.75} />
          </span>
        </button>
      </>
    );
  }

  if (stage === 'email') {
    const emailValid = isValidEmail(email);
    // Mostrar error solo cuando el usuario ya interactuó con el campo
    // (blur o intento de submit) y el valor presente es inválido.
    const showEmailError =
      emailTouched && email.trim().length > 0 && !emailValid;

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setEmailTouched(true);
      if (!emailValid) return;
      setStage('sent_email');
    };
    return (
      <form onSubmit={handleSubmit} noValidate>
        <Dialog.Title className="font-heading text-[clamp(30px,4.8vw,40px)] font-semibold leading-[0.98] tracking-[-0.025em] text-ink">
          Reenviar
          <br />
          <span className="text-gold-deep">enlace.</span>
        </Dialog.Title>
        <Dialog.Description className="mt-5 max-w-[38ch] text-[14px] leading-[1.55] text-ink/65">
          Ingresa el correo donde recibiste la invitación y te volvemos a enviar el enlace.
        </Dialog.Description>

        <div className="mt-8">
          <FormField
            id="access-email"
            label="Correo de la institución"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={setEmail}
            onBlur={() => setEmailTouched(true)}
            placeholder="contacto@institucion.com"
            icon={<Mail className="size-4" />}
            error={showEmailError ? 'Correo inválido' : undefined}
          />
        </div>

        <SubmitButton disabled={!emailValid}>Enviar enlace</SubmitButton>
      </form>
    );
  }

  return (
    <div className="flex flex-col items-center text-center">
      <span className="relative inline-flex size-14 items-center justify-center rounded-full bg-ink text-gold ring-4 ring-gold/[0.08]">
        <Mail className="size-5" strokeWidth={2} />
      </span>
      <Dialog.Title className="mt-7 font-heading text-[clamp(30px,4.8vw,40px)] font-semibold leading-[0.98] tracking-[-0.025em] text-ink">
        Revisa
        <br />
        <span className="text-gold-deep">tu correo.</span>
      </Dialog.Title>
      <Dialog.Description className="mt-5 max-w-[34ch] text-[14px] leading-[1.55] text-ink/65">
        Si <span className="font-medium text-ink">{email}</span> está autorizado, recibirás un enlace en los próximos minutos.
      </Dialog.Description>
    </div>
  );
}

// ---------- Request flow ----------------------------------------------------
function RequestFlow({ onSent }: { onSent: (folio: string | null) => void }) {
  type RequestState = { kind: 'idle' } | { kind: 'sent'; razon: string; folio: string };
  const [estado, setEstado] = useState<RequestState>({ kind: 'idle' });
  const [razon, setRazon] = useState('');
  const [tipo, setTipo] = useState<string>('');
  const [emailContacto, setEmailContacto] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);

  const emailValid = isValidEmail(emailContacto);
  const showEmailError =
    emailTouched && emailContacto.trim().length > 0 && !emailValid;
  const formValid = razon.trim().length > 0 && tipo.length > 0 && emailValid;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEmailTouched(true);
    if (!formValid) return;
    const folio = Math.random().toString(36).slice(2, 8).toUpperCase();
    setEstado({ kind: 'sent', razon: razon.trim(), folio });
    onSent(folio);
  };

  if (estado.kind === 'sent') {
    const tipoLabel =
      TIPOS_INSTITUCION.find((t) => t.value === tipo)?.label ?? '—';
    return (
      <ReceiptView razon={estado.razon} tipoLabel={tipoLabel} folio={estado.folio} />
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Dialog.Title className="font-heading text-[clamp(30px,4.8vw,40px)] font-semibold leading-[0.98] tracking-[-0.025em] text-ink">
        Solicitar
        <br />
        <span className="text-gold-deep">alianza.</span>
      </Dialog.Title>
      <Dialog.Description className="mt-5 max-w-[38ch] text-[14px] leading-[1.55] text-ink/65">
        Tres datos básicos de tu institución. Te contactamos en menos de 24 horas hábiles para agendar la entrevista.
      </Dialog.Description>

      <div className="mt-8 space-y-5">
        <FormField
          id="req-razon"
          label="Razón social"
          value={razon}
          onChange={setRazon}
          placeholder="Banco Ejemplo, S.A."
          icon={<Building2 className="size-4" />}
        />

        <FormSelect
          label="Tipo de institución"
          value={tipo}
          onValueChange={setTipo}
          placeholder="Selecciona…"
          options={TIPOS_INSTITUCION}
        />

        <FormField
          id="req-email"
          label="Correo de contacto"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={emailContacto}
          onChange={setEmailContacto}
          onBlur={() => setEmailTouched(true)}
          placeholder="contacto@institucion.com"
          icon={<Mail className="size-4" />}
          error={showEmailError ? 'Correo inválido' : undefined}
        />
      </div>

      <SubmitButton disabled={!formValid}>Enviar solicitud</SubmitButton>
    </form>
  );
}

// ---------- Receipt view (post-submit) -------------------------------------
// Constancia editorial: el folio es el ancla visual (mono caps grande), las
// filas numeradas espejean el manifest "01/02/03" de la home, y el strip de
// timeline cierra como protocolo (Ahora → 24H → Entrevista → Dossier).
// =============================================================================
function ReceiptView({
  razon,
  tipoLabel,
  folio,
}: {
  razon: string;
  tipoLabel: string;
  folio: string;
}) {
  return (
    <div className="relative">
      {/* Check protagonista — sello que abre la constancia */}
      <BrandSuccessGlyph size={64} />

      <Dialog.Title
        className="sx-text mt-7 font-heading text-[clamp(30px,4.8vw,40px)] font-semibold leading-[0.98] tracking-[-0.025em] text-ink"
        style={{ animationDelay: '0.05s' }}
      >
        Solicitud
        <br />
        <span className="text-gold-deep">registrada.</span>
      </Dialog.Title>

      {/* Folio — card editorial blanca, anchor visual de la constancia */}
      <div
        className="sx-text mt-7 rounded-[22px] bg-survey-surface p-5 ring-1 ring-ink/[0.05] md:p-6"
        style={{ animationDelay: '0.32s' }}
      >
        <span className="block font-mono text-[10px] uppercase tracking-[0.22em] text-gold-deep">
          Folio
        </span>
        <span className="mt-2 block font-mono text-[34px] font-medium leading-none tracking-[0.16em] text-ink">
          {folio}
        </span>
        <div className="mt-5 h-px w-full bg-ink/[0.08]" />
        <p className="mt-4 text-[13px] leading-relaxed text-ink/60">
          <span className="text-ink">{razon}</span>
          <span className="mx-2 text-ink/25">·</span>
          <span>{tipoLabel}</span>
        </p>
      </div>

      <Dialog.Description
        className="sx-text mt-6 text-[14px] leading-[1.55] text-ink/65"
        style={{ animationDelay: '0.7s' }}
      >
        Te contactamos en menos de 24 horas hábiles para agendar la entrevista de doce minutos.
      </Dialog.Description>
    </div>
  );
}

// =============================================================================
// Form primitives — filled inset, mono caps label, gold focus ring.
// =============================================================================
function FormField({
  id,
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  type = 'text',
  inputMode,
  autoComplete,
  icon,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  type?: string;
  inputMode?: 'text' | 'email' | 'numeric' | 'tel' | 'url';
  autoComplete?: string;
  icon?: ReactNode;
  /** Cuando hay string, el field se pinta en rojo desaturado y muestra el
   *  texto debajo. El parent decide cuándo (típicamente onBlur + post-submit). */
  error?: string;
}) {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <label htmlFor={id} className="group/field block">
      <span
        className={cn(
          'font-mono text-[10px] uppercase tracking-[0.32em] transition-colors',
          error
            ? 'text-burgundy'
            : 'text-ink/45 group-focus-within/field:text-gold'
        )}
      >
        {label}
      </span>
      <div className="relative mt-2.5">
        {icon && (
          <span
            aria-hidden
            className={cn(
              'pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 transition-colors',
              error
                ? 'text-burgundy/70'
                : 'text-ink/35 group-focus-within/field:text-gold'
            )}
          >
            {icon}
          </span>
        )}
        <input
          id={id}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          className={cn(
            'h-14 w-full rounded-2xl border-0 bg-ink/[0.04] pr-4 text-[16px] text-ink placeholder:text-ink/30 outline-none transition-all',
            error
              ? // Estado inválido: hairline + glow burgundy desaturado
                'shadow-[inset_0_0_0_1.5px_rgba(139,58,58,0.55),0_0_0_4px_rgba(139,58,58,0.08)] focus:shadow-[inset_0_0_0_1.5px_rgba(139,58,58,0.75),0_0_0_4px_rgba(139,58,58,0.14)]'
              : [
                  'shadow-[inset_0_0_0_1px_rgba(10,15,28,0.06)]',
                  'hover:bg-ink/[0.055] hover:shadow-[inset_0_0_0_1px_rgba(10,15,28,0.10)]',
                  'focus:bg-ink/[0.06] focus:shadow-[inset_0_0_0_1.5px_rgba(200,168,100,0.55),0_0_0_4px_rgba(200,168,100,0.10)]',
                ],
            icon ? 'pl-11' : 'pl-4'
          )}
        />
      </div>
      {error && (
        <span
          id={errorId}
          role="alert"
          className="mt-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.28em] text-burgundy"
        >
          <span aria-hidden className="size-1 rounded-full bg-burgundy" />
          {error}
        </span>
      )}
    </label>
  );
}

function FormSelect({
  label,
  value,
  onValueChange,
  placeholder,
  options,
}: {
  label: string;
  value: string;
  onValueChange: (v: string) => void;
  placeholder: string;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <div className="group/field block">
      <label className="block font-mono text-[10px] uppercase tracking-[0.32em] text-ink/45 transition-colors group-focus-within/field:text-gold">
        {label}
      </label>
      <div className="mt-2.5">
        <Select value={value} onValueChange={onValueChange}>
          <SelectTrigger>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function SubmitButton({
  children,
  disabled,
}: {
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className={cn(
        'group/submit mt-8 inline-flex h-14 w-full cursor-pointer items-center justify-between gap-3 rounded-full bg-ink pl-6 pr-2 text-[14px] font-medium text-cream-pure',
        'shadow-[0_0_0_1px_rgba(10,15,28,0.04),0_20px_50px_-20px_rgba(10,15,28,0.35)]',
        'transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
        'hover:bg-ink-raised active:scale-[0.99]',
        'disabled:cursor-not-allowed disabled:opacity-40'
      )}
    >
      {children}
      <span
        className={cn(
          'inline-flex size-11 items-center justify-center rounded-full bg-cream-pure text-ink',
          'transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
          'group-hover/submit:rotate-45 group-disabled/submit:rotate-0'
        )}
      >
        <ArrowUpRight className="size-[18px]" strokeWidth={1.75} />
      </span>
    </button>
  );
}
