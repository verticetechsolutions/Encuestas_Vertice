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
import { LenisProvider } from '@/components/landing/LenisProvider';
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

  return (
    <LenisProvider>
      <div
        className="landing-root relative flex min-h-screen w-full flex-1 flex-col overflow-x-clip bg-[#0A0F1C] text-[#F4F1EA]"
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
                  className="font-mono text-[10.5px] uppercase tracking-[0.32em] text-[#F4F1EA]/45"
                  style={{ animation: 'ln-fade-in 0.9s 0.05s both' }}
                >
                  Red de financieras aliadas · MX 2026
                </div>

                <h1
                  className="mt-7 font-display leading-[0.95] tracking-[-0.03em] text-[#F4F1EA]"
                  style={{
                    fontWeight: 500,
                    fontSize: 'clamp(46px, 7.4vw, 108px)',
                  }}
                >
                  <HeroLine n={1} text="Solicitantes" baseDelay={120} />
                  <HeroLine n={2} text="que cumplen" baseDelay={300} />
                  <HeroLine
                    n={3}
                    text="tu política."
                    baseDelay={620}
                    charStagger
                    charStep={42}
                    baseColor="#9C824A"
                  />
                </h1>

                <div data-anim="hero-deck">
                  <p
                    className="mt-9 max-w-[52ch] text-[15.5px] leading-relaxed text-[#F4F1EA]/72 sm:text-[17px]"
                    style={{ animation: 'ln-fade-in 0.9s 1.05s both' }}
                  >
                    Vértice estructura los criterios crediticios de tu institución en una entrevista
                    de doce minutos. A partir de ahí, tu mesa recibe solicitudes preprocesadas que
                    ya cumplen tu política. Reduces tiempo de screening y aumentas conversión.
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
                        'group/cta relative inline-flex h-12 items-center gap-3 rounded-full bg-[#F4F1EA] pl-6 pr-2 text-[13.5px] font-medium text-[#0A0F1C]',
                        'transition-colors duration-200 will-change-transform',
                        'shadow-[0_0_0_1px_rgba(244,241,234,0.04),0_30px_70px_-20px_rgba(200,168,100,0.45)]',
                        'hover:bg-white'
                      )}
                    >
                      Solicitar alianza
                      <span className="inline-flex size-9 items-center justify-center rounded-full bg-[#0A0F1C] text-[#C8A864] transition-transform group-hover/cta:rotate-45">
                        <ArrowUpRight className="size-4" strokeWidth={2.5} />
                      </span>
                    </button>
                    <button
                      ref={cta2}
                      type="button"
                      onClick={() => openMode('access')}
                      className={cn(
                        'group/ghost inline-flex h-12 items-center gap-2.5 rounded-full border border-[#F4F1EA]/20 px-5 text-[13.5px] font-medium text-[#F4F1EA]',
                        'transition-[color,border-color] duration-200 will-change-transform',
                        'hover:border-[#F4F1EA]/45'
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
                <div className="hidden lg:mt-14 lg:flex lg:items-center lg:gap-2 lg:font-mono lg:text-[10.5px] lg:uppercase lg:tracking-[0.32em] lg:text-[#F4F1EA]/45">
                  <span className="ln-scroll-cue">↓</span>
                  <span>
                    Cómo <span className="text-[#C8A864]">funciona</span>
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
                'bg-gradient-to-b from-[#F4F1EA]/[0.028] via-[#F4F1EA]/[0.014] to-[#F4F1EA]/[0.005]',
                'shadow-[inset_0_0_0_1px_rgba(244,241,234,0.055),inset_0_1px_0_rgba(200,168,100,0.18)]'
              )}
            >
              <div className="relative grid grid-cols-12 items-start gap-x-6 gap-y-10 lg:gap-x-10">
                <div className="col-span-12 lg:col-span-3" data-anim="manifest-title">
                  <div className="font-mono text-[10.5px] uppercase tracking-[0.32em] text-[#F4F1EA]/45">
                    M01 · Cómo funciona
                  </div>
                  <h2
                    className="mt-5 font-display tracking-[-0.022em] leading-[1.02] text-[#F4F1EA]"
                    style={{ fontWeight: 500, fontSize: 'clamp(28px, 3.6vw, 46px)' }}
                  >
                    Tres pasos.
                    <br />
                    <span className="font-light text-[#F4F1EA]/55">Una alianza.</span>
                  </h2>
                </div>
                <dl className="col-span-12 grid grid-cols-1 gap-y-6 lg:col-span-9">
                  <ManifestRow
                    num="01"
                    label="Entrevista"
                    value="Doce minutos. Texto o voz. Adaptiva al perfil de tu institución."
                  />
                  <ManifestRow
                    num="02"
                    label="Estructura"
                    value="Cuarenta y cuatro cajas canónicas. Schema v1.0 firmable y versionado."
                  />
                  <ManifestRow
                    num="03"
                    label="Distribución"
                    value="Solicitudes preprocesadas llegan a tu mesa. Cero coordinación operativa."
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
                  maskImage:
                    'linear-gradient(to bottom, #000 30%, rgba(0,0,0,0.6) 70%, transparent 100%)',
                }}
              />
            </div>

            <div className="mx-auto flex w-full max-w-[1480px] flex-col items-start justify-between gap-6 px-6 py-8 sm:flex-row sm:items-center sm:px-10 lg:px-14">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.3em] text-[#F4F1EA]/45">
                Vértice © 2026 · Red de financieras aliadas
              </div>
              <nav className="flex flex-wrap items-center gap-6">
                <FooterLink href="/terminos">Términos</FooterLink>
                <FooterLink href="/terminos#privacidad">Privacidad</FooterLink>
                <FooterLink onClick={() => setCookiesOpen(true)}>Cookies</FooterLink>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.3em] text-[#F4F1EA]/25">/</span>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.3em] text-[#F4F1EA]/35">
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
                'fixed inset-0 z-50 bg-[#0A0F1C]/82 backdrop-blur-sm',
                'data-[starting-style]:opacity-0 data-[ending-style]:opacity-0',
                'transition-opacity duration-300'
              )}
            />
            <Dialog.Popup
              data-lenis-prevent
              className={cn(
                'fixed left-1/2 top-1/2 z-50 w-[min(94vw,480px)] -translate-x-1/2 -translate-y-1/2',
                'overflow-hidden rounded-[24px] border border-[#F4F1EA]/8 bg-[#F4F1EA] text-[#0A0F1C] shadow-2xl shadow-black/50',
                'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
                'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
                'transition-all duration-300'
              )}
              initialFocus={false}
            >
              <DialogShell
                kicker={
                  mode === 'menu'
                    ? 'Bienvenido'
                    : mode === 'access'
                      ? 'Acceso · panel'
                      : requestFolio
                        ? `Alianza · ${requestFolio}`
                        : 'Solicitar acceso'
                }
                kickerVariant={requestFolio && mode === 'request' ? 'sealed' : 'default'}
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
    </LenisProvider>
  );
}

// =============================================================================
// Subcomponents
// =============================================================================
function ManifestRow({ num, label, value }: { num: string; label: string; value: string }) {
  return (
    <div
      data-anim="manifest-row"
      className="grid grid-cols-12 items-baseline gap-x-4 border-t border-[#F4F1EA]/6 pt-6 first:border-t-0 first:pt-0"
    >
      <span
        data-row="num"
        className="col-span-2 font-mono text-[10.5px] uppercase tracking-[0.3em] text-[#C8A864] sm:col-span-1"
      >
        {num}
      </span>
      <dt
        data-row="label"
        className="col-span-10 font-mono text-[10.5px] uppercase tracking-[0.32em] text-[#F4F1EA]/45 sm:col-span-3"
      >
        {label}
      </dt>
      <dd
        data-row="value"
        className="col-span-12 mt-3 text-[16.5px] leading-relaxed text-[#F4F1EA]/85 sm:col-span-8 sm:mt-0 sm:text-[18px]"
      >
        {value}
      </dd>
    </div>
  );
}

function DialogShell({
  kicker,
  kickerVariant = 'default',
  onClose,
  onBack,
  children,
}: {
  kicker: string;
  kickerVariant?: 'default' | 'sealed';
  onClose: () => void;
  onBack?: () => void;
  children: ReactNode;
}) {
  const sealed = kickerVariant === 'sealed';
  return (
    <>
      <div
        className={cn(
          'flex items-center justify-between border-b px-6 py-3.5 transition-colors',
          sealed ? 'border-[#C8A864]/35 bg-[#C8A864]/[0.06]' : 'border-[#0A0F1C]/8'
        )}
      >
        <div
          key={kicker}
          className={cn(
            'sx-kicker flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.3em]',
            sealed ? 'text-[#9C824A]' : 'text-[#0A0F1C]/55'
          )}
        >
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="-ml-1 inline-flex size-6 items-center justify-center rounded-full text-[#0A0F1C]/50 transition-colors hover:bg-[#0A0F1C]/5 hover:text-[#0A0F1C]"
              aria-label="Volver"
            >
              <ArrowLeft className="size-3.5" strokeWidth={2.25} />
            </button>
          )}
          <span
            className={cn(
              'size-1.5 rounded-full bg-[#C8A864]',
              sealed && 'sx-status-dot'
            )}
          />
          {kicker}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex size-7 items-center justify-center rounded-full text-[#0A0F1C]/50 transition-colors hover:bg-[#0A0F1C]/5 hover:text-[#0A0F1C]"
          aria-label="Cerrar"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="px-7 py-7 sm:px-9 sm:py-8">{children}</div>
    </>
  );
}

// ---------- Menu flow -------------------------------------------------------
function MenuFlow({ onPick }: { onPick: (m: 'access' | 'request') => void }) {
  return (
    <>
      <Dialog.Title
        className="font-display text-2xl tracking-[-0.02em]"
        style={{ fontWeight: 500 }}
      >
        Acceso a la plataforma.
      </Dialog.Title>
      <Dialog.Description className="mt-2 text-[13.5px] leading-relaxed text-[#0A0F1C]/60">
        Selecciona la opción que aplica a tu institución.
      </Dialog.Description>

      <div className="mt-7 space-y-3">
        <button
          type="button"
          onClick={() => onPick('access')}
          className="group/menu flex w-full items-center justify-between gap-4 rounded-xl border border-[#0A0F1C]/12 bg-white px-5 py-4 text-left transition-colors hover:border-[#0A0F1C]/30"
        >
          <div>
            <div className="text-[14px] font-medium text-[#0A0F1C]">Reanudar entrevista</div>
            <div className="mt-0.5 text-[12.5px] text-[#0A0F1C]/55">Mi institución ya está registrada</div>
          </div>
          <ArrowUpRight
            className="size-4 text-[#0A0F1C]/40 transition-all group-hover/menu:translate-x-0.5 group-hover/menu:text-[#C8A864]"
            strokeWidth={2.25}
          />
        </button>

        <button
          type="button"
          onClick={() => onPick('request')}
          className="group/menu flex w-full items-center justify-between gap-4 rounded-xl bg-[#0A0F1C] px-5 py-4 text-left transition-colors hover:bg-[#1a2236]"
        >
          <div>
            <div className="text-[14px] font-medium text-[#F4F1EA]">Solicitar alianza</div>
            <div className="mt-0.5 text-[12.5px] text-[#F4F1EA]/55">Registrar mi institución en la red</div>
          </div>
          <span className="inline-flex size-9 items-center justify-center rounded-lg bg-[#C8A864] text-[#0A0F1C] transition-transform group-hover/menu:rotate-45">
            <ArrowUpRight className="size-4" strokeWidth={2.25} />
          </span>
        </button>
      </div>
    </>
  );
}

// ---------- Access flow -----------------------------------------------------
function AccessFlow() {
  const [stage, setStage] = useState<'choose' | 'email' | 'sent_email' | 'google'>('choose');
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);

  if (stage === 'choose') {
    return (
      <>
        <Dialog.Title
          className="font-display text-2xl tracking-[-0.02em]"
          style={{ fontWeight: 500 }}
        >
          Reanudar entrevista.
        </Dialog.Title>
        <Dialog.Description className="mt-2 text-[13.5px] leading-relaxed text-[#0A0F1C]/60">
          Continúa con la cuenta de Google registrada por tu institución. La misma del correo de
          invitación.
        </Dialog.Description>

        <button
          type="button"
          onClick={() => setStage('google')}
          className="mt-7 inline-flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-[#0A0F1C]/12 bg-white text-[14px] font-medium text-[#0A0F1C] transition-colors hover:border-[#0A0F1C]/30"
        >
          <GoogleG className="size-4" />
          Continuar con Google
        </button>

        <div className="mt-6 flex items-center gap-3 text-[10.5px] uppercase tracking-[0.28em] text-[#0A0F1C]/40">
          <span className="h-px flex-1 bg-[#0A0F1C]/10" />
          <span>o</span>
          <span className="h-px flex-1 bg-[#0A0F1C]/10" />
        </div>

        <button
          type="button"
          onClick={() => setStage('email')}
          className="group/submit mt-6 inline-flex h-12 w-full items-center justify-between gap-2 rounded-xl bg-[#0A0F1C] pl-5 pr-2 text-[13.5px] font-medium text-[#F4F1EA] transition-colors hover:bg-[#1a2236]"
        >
          Reenviar mi enlace por correo
          <span className="inline-flex size-9 items-center justify-center rounded-lg bg-[#C8A864] text-[#0A0F1C] transition-transform group-hover/submit:translate-x-0.5">
            <Mail className="size-4" strokeWidth={2.25} />
          </span>
        </button>
      </>
    );
  }

  if (stage === 'google') {
    return (
      <div className="flex flex-col items-center text-center">
        <span className="inline-flex size-12 items-center justify-center rounded-full border border-[#0A0F1C]/10 bg-white">
          <GoogleG className="size-5" />
        </span>
        <Dialog.Title
          className="mt-5 font-display text-2xl tracking-[-0.02em]"
          style={{ fontWeight: 500 }}
        >
          Próximamente.
        </Dialog.Title>
        <Dialog.Description className="mt-2 max-w-[36ch] text-[13.5px] leading-relaxed text-[#0A0F1C]/60">
          La autenticación con Google estará disponible al activar el panel. Mientras tanto,
          reenvíate el enlace que llegó a tu correo.
        </Dialog.Description>
        <button
          type="button"
          onClick={() => setStage('email')}
          className="mt-7 font-mono text-[10.5px] uppercase tracking-[0.28em] text-[#0A0F1C] underline-offset-[6px] hover:underline"
        >
          Usar mi correo →
        </button>
      </div>
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
        <Dialog.Title
          className="font-display text-2xl tracking-[-0.02em]"
          style={{ fontWeight: 500 }}
        >
          Reenviar enlace.
        </Dialog.Title>
        <Dialog.Description className="mt-2 text-[13.5px] leading-relaxed text-[#0A0F1C]/60">
          Ingresa el correo donde recibiste la invitación y te volvemos a enviar el enlace.
        </Dialog.Description>

        <div className="mt-7">
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
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-[#0A0F1C] text-[#C8A864]">
        <Mail className="size-5" strokeWidth={2.25} />
      </span>
      <Dialog.Title
        className="mt-5 font-display text-2xl tracking-[-0.02em]"
        style={{ fontWeight: 500 }}
      >
        Revisa tu correo.
      </Dialog.Title>
      <Dialog.Description className="mt-2 max-w-[34ch] text-[13.5px] leading-relaxed text-[#0A0F1C]/60">
        Si <span className="font-medium text-[#0A0F1C]">{email}</span> está autorizado, recibirás
        un enlace en los próximos minutos.
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
      <Dialog.Title
        className="font-display text-2xl tracking-[-0.02em]"
        style={{ fontWeight: 500 }}
      >
        Solicitar alianza.
      </Dialog.Title>
      <Dialog.Description className="mt-2 text-[13.5px] leading-relaxed text-[#0A0F1C]/60">
        Tres datos básicos de tu institución. Te contactamos en menos de 24 horas hábiles para
        agendar la entrevista.
      </Dialog.Description>

      <div className="mt-7 space-y-5">
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
    <div className="relative -mx-1">
      {/* Check protagonista — sello que abre la constancia */}
      <BrandSuccessGlyph size={68} />

      {/* Title — bilínea editorial, primer línea sólida, segunda en peso liviano */}
      <Dialog.Title
        className="sx-text mt-7 font-display text-[34px] leading-[0.96] tracking-[-0.025em] text-[#0A0F1C]"
        style={{ fontWeight: 500, animationDelay: '0.05s' }}
      >
        Solicitud
        <br />
        <span className="font-light text-[#0A0F1C]/55">registrada.</span>
      </Dialog.Title>

      {/* Hairline dorada que se traza */}
      <span
        aria-hidden
        className="sx-line mt-5 block h-px w-12 bg-[#C8A864]"
      />

      {/* Folio — anchor visual de la constancia */}
      <div
        className="sx-text mt-7"
        style={{ animationDelay: '0.32s' }}
      >
        <span className="block font-mono text-[10px] uppercase tracking-[0.32em] text-[#C8A864]">
          Folio
        </span>
        <span className="mt-2 block font-mono text-[34px] font-medium leading-none tracking-[0.16em] text-[#0A0F1C]">
          {folio}
        </span>
      </div>

      {/* Hairline divider editorial */}
      <div
        className="sx-text mt-8 h-px w-full bg-[#0A0F1C]/8"
        style={{ animationDelay: '0.55s' }}
      />

      {/* Single-line institution context — razón social · tipo */}
      <p
        className="sx-text mt-5 text-[13.5px] leading-relaxed text-[#0A0F1C]/55"
        style={{ animationDelay: '0.7s' }}
      >
        <span className="text-[#0A0F1C]">{razon}</span>
        <span className="mx-2 text-[#0A0F1C]/30">·</span>
        <span>{tipoLabel}</span>
      </p>

      {/* Próximo paso — copy condensado, sin label decorativo */}
      <Dialog.Description
        className="sx-text mt-3 text-[13.5px] leading-relaxed text-[#0A0F1C]/65"
        style={{ animationDelay: '0.85s' }}
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
            ? 'text-[#8B3A3A]'
            : 'text-[#0A0F1C]/45 group-focus-within/field:text-[#C8A864]'
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
                ? 'text-[#8B3A3A]/70'
                : 'text-[#0A0F1C]/35 group-focus-within/field:text-[#C8A864]'
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
            'h-14 w-full rounded-2xl border-0 bg-[#0A0F1C]/[0.04] pr-4 text-[16px] text-[#0A0F1C] placeholder:text-[#0A0F1C]/30 outline-none transition-all',
            error
              ? // Estado inválido: hairline + glow burgundy desaturado
                'shadow-[inset_0_0_0_1.5px_rgba(139,58,58,0.55),0_0_0_4px_rgba(139,58,58,0.08)] focus:shadow-[inset_0_0_0_1.5px_rgba(139,58,58,0.75),0_0_0_4px_rgba(139,58,58,0.14)]'
              : [
                  'shadow-[inset_0_0_0_1px_rgba(10,15,28,0.06)]',
                  'hover:bg-[#0A0F1C]/[0.055] hover:shadow-[inset_0_0_0_1px_rgba(10,15,28,0.10)]',
                  'focus:bg-[#0A0F1C]/[0.06] focus:shadow-[inset_0_0_0_1.5px_rgba(200,168,100,0.55),0_0_0_4px_rgba(200,168,100,0.10)]',
                ],
            icon ? 'pl-11' : 'pl-4'
          )}
        />
      </div>
      {error && (
        <span
          id={errorId}
          role="alert"
          className="mt-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.28em] text-[#8B3A3A]"
        >
          <span aria-hidden className="size-1 rounded-full bg-[#8B3A3A]" />
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
      <label className="block font-mono text-[10px] uppercase tracking-[0.32em] text-[#0A0F1C]/45 transition-colors group-focus-within/field:text-[#C8A864]">
        {label}
      </label>
      <div className="mt-2.5">
        <Select value={value || undefined} onValueChange={onValueChange}>
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
        'group/submit mt-7 inline-flex h-14 w-full items-center justify-between gap-2 rounded-2xl bg-[#0A0F1C] pl-6 pr-2 text-[14px] font-medium text-[#F4F1EA]',
        'transition-all hover:bg-[#1a2236] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed'
      )}
    >
      {children}
      <span
        className={cn(
          'inline-flex size-10 items-center justify-center rounded-xl bg-[#C8A864] text-[#0A0F1C]',
          'transition-transform duration-200 group-hover/submit:rotate-45'
        )}
      >
        <ArrowUpRight className="size-4" strokeWidth={2.25} />
      </span>
    </button>
  );
}
