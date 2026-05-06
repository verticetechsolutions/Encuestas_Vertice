'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Dialog } from '@base-ui/react/dialog';
import { ArrowUpRight, Building2, Mail, X } from 'lucide-react';
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
import { SuccessMark } from '@/components/landing/SuccessMark';
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

type DialogMode = 'access' | 'request';

// =============================================================================
// Landing
// =============================================================================
export default function Landing() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<DialogMode>('access');

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

  // GSAP scroll triggers — manifiesto stagger reveal + footer wordmark parallax.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      gsap.from('[data-anim="manifest-row"]', {
        opacity: 0,
        y: 36,
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.14,
        scrollTrigger: {
          trigger: '[data-anim="manifest"]',
          start: 'top 78%',
          toggleActions: 'play none none reverse',
        },
      });

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

      gsap.to('[data-anim="footer-wordmark"]', {
        yPercent: -25,
        ease: 'none',
        scrollTrigger: {
          trigger: '[data-anim="footer-wordmark"]',
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.6,
        },
      });

      // Vertex sigil — drift hacia arriba conforme se baja, paralax sutil
      gsap.to('[data-anim="vertex-sigil"]', {
        yPercent: -40,
        ease: 'none',
        scrollTrigger: {
          trigger: '[data-anim="vertex-sigil"]',
          start: 'top top+=80',
          end: 'bottom top',
          scrub: 0.8,
        },
      });
    });
    return () => ctx.revert();
  }, []);

  const openMode = (m: DialogMode) => {
    setMode(m);
    setOpen(true);
  };

  const cta1 = useMagnetic<HTMLButtonElement>(0.12);
  const cta2 = useMagnetic<HTMLButtonElement>(0.14);
  const [cookiesOpen, setCookiesOpen] = useState(false);

  return (
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

      <Dialog.Root open={open} onOpenChange={setOpen}>
        {/* ====================================================== HEADER STATIC
            Una sola fila, todos los elementos centrados verticalmente. */}
        <header className="pointer-events-none fixed inset-x-0 top-0 z-30">
          <div className="mx-auto w-full max-w-[1480px] px-6 pt-6 sm:px-10 lg:px-14">
            <div className="relative flex h-12 items-center justify-between gap-4">
              <Link
                href="/"
                aria-label="Vértice — inicio"
                className="pointer-events-auto inline-flex items-center"
                style={{ animation: 'ln-fade-in 0.9s 0.05s both' }}
              >
                <Image
                  src="/Logo_white.svg"
                  alt="Vértice"
                  width={7095}
                  height={2369}
                  priority
                  className="h-11 w-auto"
                />
              </Link>

              <div
                className="pointer-events-auto absolute left-1/2 hidden -translate-x-1/2 md:flex md:items-center md:gap-3 md:rounded-full md:border md:border-[#F4F1EA]/10 md:bg-[#0A0F1C]/55 md:px-3.5 md:py-2 md:backdrop-blur-xl"
                style={{ animation: 'ln-fade-in 0.9s 0.18s both' }}
              >
                <span className="size-1.5 rounded-full bg-[#C8A864] shadow-[0_0_10px_rgba(200,168,100,0.5)]" />
                <span className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-[#F4F1EA]/65">
                  MX · 2026
                </span>
                <span className="size-1 rounded-full bg-[#F4F1EA]/15" />
                <span className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-[#F4F1EA]/65">
                  Edición Vol.01
                </span>
              </div>

              <button
                type="button"
                onClick={() => openMode('access')}
                className="pointer-events-auto group/cta inline-flex h-10 items-center gap-2 rounded-full border border-[#F4F1EA]/15 bg-[#0A0F1C]/55 pl-3.5 pr-1.5 text-[12px] font-medium text-[#F4F1EA]/85 backdrop-blur-xl transition-colors hover:border-[#F4F1EA]/35 hover:text-[#F4F1EA]"
                style={{ animation: 'ln-fade-in 0.9s 0.32s both' }}
              >
                <span className="hidden sm:inline">Acceder</span>
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-[#C8A864] text-[#0A0F1C] transition-transform group-hover/cta:rotate-45">
                  <ArrowUpRight className="size-3.5" strokeWidth={2.5} />
                </span>
              </button>
            </div>
          </div>
        </header>

        <main className="relative z-10 mx-auto w-full max-w-[1480px] flex-1 px-6 sm:px-10 lg:px-14">
          {/* ============================================================== HERO */}
          <section className="relative grid grid-cols-12 items-end gap-x-6 gap-y-10 pb-16 pt-24 sm:gap-y-14 sm:pt-28 lg:gap-x-10 lg:pb-20 lg:pt-36">
            <div className="col-span-12 lg:col-span-9">
              <div
                className="font-mono text-[10.5px] uppercase tracking-[0.32em] text-[#F4F1EA]/45"
                style={{ animation: 'ln-fade-in 0.9s 0.05s both' }}
              >
                Para instituciones financieras
              </div>

              <h1
                className="mt-7 font-display leading-[0.95] tracking-[-0.03em] text-[#F4F1EA]"
                style={{
                  fontWeight: 500,
                  fontSize: 'clamp(46px, 7.4vw, 108px)',
                }}
              >
                <RevealLine text="Tu política" baseDelay={120} className="block" />
                <RevealLine text="de crédito," baseDelay={300} className="block" />
                <span
                  className="block italic"
                  style={{ fontWeight: 400, color: '#C8A864' }}
                >
                  <RevealChars text="conversada." baseDelay={620} stagger={42} />
                </span>
              </h1>

              <p
                className="mt-9 max-w-[52ch] text-[15.5px] leading-relaxed text-[#F4F1EA]/72 sm:text-[17px]"
                style={{ animation: 'ln-fade-in 0.9s 1.05s both' }}
              >
                Una entrevista adaptiva. Doce minutos de conversación que devuelven el perfil de
                criterios de tu institución, listo para revisar y firmar.
              </p>

              {/* CTAs above the fold */}
              <div
                className="mt-10 flex flex-wrap items-center gap-3"
                style={{ animation: 'ln-fade-in 0.9s 1.25s both' }}
              >
                <button
                  ref={cta1}
                  type="button"
                  onClick={() => openMode('access')}
                  className={cn(
                    'group/cta relative inline-flex h-12 items-center gap-3 rounded-full bg-[#F4F1EA] pl-2 pr-6 text-[13.5px] font-medium text-[#0A0F1C]',
                    'transition-colors duration-200 will-change-transform',
                    'shadow-[0_0_0_1px_rgba(244,241,234,0.04),0_30px_70px_-20px_rgba(200,168,100,0.45)]',
                    'hover:bg-white'
                  )}
                >
                  <span className="inline-flex size-9 items-center justify-center rounded-full bg-white">
                    <GoogleG className="size-4" />
                  </span>
                  Acceder con Google
                </button>
                <button
                  ref={cta2}
                  type="button"
                  onClick={() => openMode('request')}
                  className={cn(
                    'group/ghost inline-flex h-12 items-center gap-2.5 rounded-full border border-[#F4F1EA]/20 px-5 text-[13.5px] font-medium text-[#F4F1EA]',
                    'transition-[color,border-color] duration-200 will-change-transform',
                    'hover:border-[#F4F1EA]/45'
                  )}
                >
                  Solicitar acceso
                  <ArrowUpRight
                    className="size-4 text-[#C8A864] transition-transform group-hover/ghost:rotate-45"
                    strokeWidth={2.25}
                  />
                </button>
              </div>
            </div>

            {/* Vertex sigil + scroll cue */}
            <div className="col-span-12 lg:col-span-3 lg:flex lg:flex-col lg:items-end" data-anim="vertex-sigil">
              <div className="relative ml-auto aspect-[1380/1093] w-full max-w-[180px] lg:max-w-[200px]">
                <VertexMark variant="inline" className="absolute inset-0 h-full w-full" />
              </div>
              <div className="ml-auto mt-3 flex max-w-[200px] items-center justify-end gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-[#F4F1EA]/35">
                <span>fig.01</span>
                <span className="text-[#F4F1EA]/15">/</span>
                <span>signo</span>
              </div>

              <div className="hidden lg:mt-12 lg:flex lg:items-center lg:gap-2 lg:font-mono lg:text-[10.5px] lg:uppercase lg:tracking-[0.32em] lg:text-[#F4F1EA]/45">
                <span className="ln-scroll-cue">↓</span>
                <span>Scroll <span className="text-[#C8A864]">brief</span></span>
              </div>
            </div>
          </section>

          {/* ========================================================= MANIFEST */}
          <section data-anim="manifest" className="border-t border-[#F4F1EA]/8 py-16 sm:py-24">
            <div className="grid grid-cols-12 items-start gap-x-6 gap-y-10 lg:gap-x-10">
              <div className="col-span-12 lg:col-span-3" data-anim="manifest-title">
                <div className="font-mono text-[10.5px] uppercase tracking-[0.32em] text-[#F4F1EA]/45">
                  M01 · Brief
                </div>
                <h2
                  className="mt-5 font-display tracking-[-0.022em] leading-[1.02] text-[#F4F1EA]"
                  style={{ fontWeight: 500, fontSize: 'clamp(28px, 3.6vw, 46px)' }}
                >
                  Tres datos.
                  <br />
                  <span className="italic font-light text-[#F4F1EA]/55">Sin más.</span>
                </h2>
              </div>
              <dl className="col-span-12 grid grid-cols-1 gap-y-6 lg:col-span-9">
                <ManifestRow num="01" label="Formato" value="Conversación adaptiva — texto o voz." />
                <ManifestRow num="02" label="Duración" value="Doce minutos en promedio." />
                <ManifestRow
                  num="03"
                  label="Entrega"
                  value="Perfil firmable. Cuarenta y cuatro cajas canónicas. Schema v1.0."
                />
              </dl>
            </div>
          </section>
        </main>

        {/* ============================================================== FOOTER */}
        <footer className="relative z-10 mt-10 border-t border-[#F4F1EA]/8">
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
              className="h-auto w-full select-none opacity-[0.10] will-change-transform"
              style={{
                maskImage:
                  'linear-gradient(to bottom, #000 30%, rgba(0,0,0,0.6) 70%, transparent 100%)',
              }}
            />
          </div>

          <div className="mx-auto flex w-full max-w-[1480px] flex-col items-start justify-between gap-6 px-6 py-8 sm:flex-row sm:items-center sm:px-10 lg:px-14">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.3em] text-[#F4F1EA]/45">
              Vértice © 2026 — Criterios crediticios
            </div>
            <nav className="flex flex-wrap items-center gap-6 font-mono text-[10.5px] uppercase tracking-[0.3em] text-[#F4F1EA]/55">
              <Link href="/terminos" className="transition-colors hover:text-[#F4F1EA]">
                Términos
              </Link>
              <Link href="/terminos#privacidad" className="transition-colors hover:text-[#F4F1EA]">
                Privacidad
              </Link>
              <button
                type="button"
                onClick={() => setCookiesOpen(true)}
                className="cursor-pointer uppercase tracking-[0.3em] text-[#F4F1EA]/55 transition-colors hover:text-[#F4F1EA]"
              >
                Cookies
              </button>
              <span className="text-[#F4F1EA]/25">/</span>
              <span className="text-[#F4F1EA]/35">Confidencial · uso interno</span>
            </nav>
          </div>
        </footer>

        {/* ============================================================== DIALOG */}
        <Dialog.Portal>
          <Dialog.Backdrop
            className={cn(
              'fixed inset-0 z-50 bg-[#0A0F1C]/82 backdrop-blur-sm',
              'data-[starting-style]:opacity-0 data-[ending-style]:opacity-0',
              'transition-opacity duration-300'
            )}
          />
          <Dialog.Popup
            className={cn(
              'fixed left-1/2 top-1/2 z-50 w-[min(94vw,480px)] -translate-x-1/2 -translate-y-1/2',
              'overflow-hidden rounded-[24px] border border-[#F4F1EA]/8 bg-[#F4F1EA] text-[#0A0F1C] shadow-2xl shadow-black/50',
              'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
              'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
              'transition-all duration-300'
            )}
            initialFocus={null}
          >
            <DialogShell
              kicker={mode === 'access' ? 'Acceso · panel' : 'Solicitar acceso'}
              onClose={() => setOpen(false)}
            >
              {mode === 'access' ? <AccessFlow /> : <RequestFlow />}
            </DialogShell>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      <CookiesCard open={cookiesOpen} onClose={() => setCookiesOpen(false)} />
    </div>
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
      <span className="col-span-2 font-mono text-[10.5px] uppercase tracking-[0.3em] text-[#C8A864] sm:col-span-1">
        {num}
      </span>
      <dt className="col-span-10 font-mono text-[10.5px] uppercase tracking-[0.32em] text-[#F4F1EA]/45 sm:col-span-3">
        {label}
      </dt>
      <dd className="col-span-12 mt-3 text-[16.5px] leading-relaxed text-[#F4F1EA]/85 sm:col-span-8 sm:mt-0 sm:text-[18px]">
        {value}
      </dd>
    </div>
  );
}

function DialogShell({
  kicker,
  onClose,
  children,
}: {
  kicker: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <div className="flex items-center justify-between border-b border-[#0A0F1C]/8 px-6 py-3.5">
        <div className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.3em] text-[#0A0F1C]/55">
          <span className="size-1.5 rounded-full bg-[#C8A864]" />
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

// ---------- Access flow -----------------------------------------------------
function AccessFlow() {
  const [stage, setStage] = useState<'choose' | 'email' | 'sent_email' | 'google'>('choose');
  const [email, setEmail] = useState('');

  if (stage === 'choose') {
    return (
      <>
        <Dialog.Title
          className="font-display text-2xl tracking-[-0.02em]"
          style={{ fontWeight: 500 }}
        >
          Acceder a mi encuesta.
        </Dialog.Title>
        <Dialog.Description className="mt-2 text-[13.5px] leading-relaxed text-[#0A0F1C]/60">
          Continúa con la dirección de Google con la que recibiste el correo de invitación.
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
    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const trimmed = email.trim();
      if (!trimmed) return;
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
            placeholder="contacto@institucion.com"
            icon={<Mail className="size-4" />}
          />
        </div>

        <SubmitButton disabled={email.trim().length === 0}>Enviar enlace</SubmitButton>
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
function RequestFlow() {
  type RequestState = { kind: 'idle' } | { kind: 'sent'; razon: string; folio: string };
  const [estado, setEstado] = useState<RequestState>({ kind: 'idle' });
  const [razon, setRazon] = useState('');
  const [tipo, setTipo] = useState<string>('');
  const [emailContacto, setEmailContacto] = useState('');

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!razon.trim() || !tipo || !emailContacto.trim()) return;
    const folio = Math.random().toString(36).slice(2, 8).toUpperCase();
    setEstado({ kind: 'sent', razon: razon.trim(), folio });
  };

  if (estado.kind === 'sent') {
    return (
      <div className="flex flex-col items-center px-2 py-3 text-center">
        <SuccessMark className="size-20" />
        <Dialog.Title
          className="sx-text mt-6 font-display text-[26px] leading-[1.1] tracking-[-0.02em]"
          style={{ fontWeight: 500, animationDelay: '1.05s' }}
        >
          Solicitud recibida.
        </Dialog.Title>
        <Dialog.Description
          className="sx-text mt-2 max-w-[36ch] text-[13.5px] leading-relaxed text-[#0A0F1C]/60"
          style={{ animationDelay: '1.18s' }}
        >
          Recibimos tu solicitud para{' '}
          <span className="font-medium text-[#0A0F1C]">{estado.razon}</span>. Te contactamos en las
          próximas 24 horas hábiles.
        </Dialog.Description>
        <div
          className="sx-text mt-6 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.32em] text-[#0A0F1C]/45"
          style={{ animationDelay: '1.32s' }}
        >
          <span className="size-1 rounded-full bg-[#C8A864]" />
          <span>folio · {estado.folio}</span>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Dialog.Title
        className="font-display text-2xl tracking-[-0.02em]"
        style={{ fontWeight: 500 }}
      >
        Solicita una entrevista.
      </Dialog.Title>
      <Dialog.Description className="mt-2 text-[13.5px] leading-relaxed text-[#0A0F1C]/60">
        Tres campos. Te contactamos para programar la sesión.
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
          value={emailContacto}
          onChange={setEmailContacto}
          placeholder="contacto@institucion.com"
          icon={<Mail className="size-4" />}
        />
      </div>

      <SubmitButton disabled={!razon.trim() || !tipo || !emailContacto.trim()}>
        Enviar solicitud
      </SubmitButton>
    </form>
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
  placeholder,
  type = 'text',
  inputMode,
  autoComplete,
  icon,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: 'text' | 'email' | 'numeric' | 'tel' | 'url';
  autoComplete?: string;
  icon?: ReactNode;
}) {
  return (
    <label htmlFor={id} className="group/field block">
      <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-[#0A0F1C]/45 transition-colors group-focus-within/field:text-[#C8A864]">
        {label}
      </span>
      <div className="relative mt-2.5">
        {icon && (
          <span
            aria-hidden
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#0A0F1C]/35 transition-colors group-focus-within/field:text-[#C8A864]"
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
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            'h-14 w-full rounded-2xl border-0 bg-[#0A0F1C]/[0.04] pr-4 text-[16px] text-[#0A0F1C] placeholder:text-[#0A0F1C]/30 outline-none transition-all',
            'shadow-[inset_0_0_0_1px_rgba(10,15,28,0.06)]',
            'hover:bg-[#0A0F1C]/[0.055] hover:shadow-[inset_0_0_0_1px_rgba(10,15,28,0.10)]',
            'focus:bg-[#0A0F1C]/[0.06] focus:shadow-[inset_0_0_0_1.5px_rgba(200,168,100,0.55),0_0_0_4px_rgba(200,168,100,0.10)]',
            icon ? 'pl-11' : 'pl-4'
          )}
        />
      </div>
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
