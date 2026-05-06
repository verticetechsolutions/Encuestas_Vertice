'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpLeft } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

// =============================================================================
// Sections — single source of truth (orden + anchor + título + cuerpo).
// El TOC sticky se genera de aquí; no duplicar.
// =============================================================================
type Section = {
  id: string;
  num: string;
  title: string;
  body: ReactNode;
};

const SECTIONS: Section[] = [
  {
    id: 'aceptacion',
    num: '01',
    title: 'Aceptación.',
    body: (
      <>
        <p>
          Al acceder a Vértice — sea por enlace de invitación, formulario público o vía panel
          autenticado — quien lo hace declara contar con facultades suficientes para representar a
          la institución financiera que registra y aceptar estos términos en su nombre.
        </p>
        <p>
          La aceptación se entiende otorgada al continuar la entrevista o enviar el formulario de
          solicitud. No requiere firma autógrafa; vale como manifestación de voluntad bajo el
          artículo 1803 del Código Civil Federal y los lineamientos de la NOM-151-SCFI-2016.
        </p>
      </>
    ),
  },
  {
    id: 'servicio',
    num: '02',
    title: 'Qué es Vértice.',
    body: (
      <>
        <p>
          Vértice es una plataforma de entrevistas adaptivas que extrae, en tiempo real,
          criterios de política crediticia y los devuelve como un perfil estructurado —{' '}
          <em>cuarenta y cuatro cajas canónicas</em> versionadas bajo schema v1.0.
        </p>
        <p>
          La entrevista no constituye asesoría financiera, regulatoria, fiscal ni legal. El perfil
          generado es insumo interno de la institución y no sustituye la diligencia que cada una
          debe ejercer al colocar crédito.
        </p>
      </>
    ),
  },
  {
    id: 'datos',
    num: '03',
    title: 'Datos que recopilamos.',
    body: (
      <>
        <p>
          Recolectamos sólo lo necesario para construir el perfil: razón social, tipo de
          institución, correo de contacto del representante, las respuestas literales del usuario
          (texto y audio si optó por voz), y los metadatos de cada turno —{' '}
          <em>timestamp, duración, modelo LLM utilizado, tokens consumidos</em>.
        </p>
        <p>
          No recolectamos información de clientes finales de la institución, datos de usuarios de
          crédito, ni cualquier dato personal sensible en términos de la LFPDPPP.
        </p>
      </>
    ),
  },
  {
    id: 'privacidad',
    num: '04',
    title: 'Privacidad.',
    body: (
      <>
        <p>
          Tratamos los datos con estricto apego a la <em>Ley Federal de Protección de Datos
          Personales en Posesión de los Particulares</em>. Aplican los derechos ARCO — acceso,
          rectificación, cancelación, oposición — ejercibles vía{' '}
          <a
            href="mailto:contacto@verticemexico.com"
            className="border-b border-current/40 hover:border-current"
          >
            contacto@verticemexico.com
          </a>
          .
        </p>
        <p>
          Las grabaciones de voz se transcriben y se descartan a las setenta y dos horas. Las
          transcripciones y los perfiles permanecen cifrados en reposo (AES-256) y en tránsito
          (TLS 1.3) por el tiempo que la institución lo solicite o hasta que retire su consentimiento.
        </p>
      </>
    ),
  },
  {
    id: 'cookies',
    num: '05',
    title: 'Cookies y similares.',
    body: (
      <>
        <p>
          Usamos cookies estrictamente necesarias para mantener la sesión autenticada y un
          identificador de sesión opaco (UUID) sin información personal. No usamos cookies
          publicitarias ni analítica de terceros con fines de perfilamiento.
        </p>
        <p>
          La medición agregada de uso del producto se hace con eventos anónimos vía Axiom — sin
          IPs, sin device fingerprint.
        </p>
      </>
    ),
  },
  {
    id: 'propiedad',
    num: '06',
    title: 'Propiedad intelectual.',
    body: (
      <>
        <p>
          La plataforma, sus modelos, prompts, schemas y código son propiedad intelectual de
          Vértice. La institución conserva la propiedad sobre el contenido de sus respuestas y
          sobre el perfil de criterios resultante; recibe licencia perpetua, no exclusiva e
          irrevocable para usarlo internamente.
        </p>
        <p>
          Queda prohibido revender, reempaquetar o exponer la plataforma como servicio a terceros
          sin autorización expresa.
        </p>
      </>
    ),
  },
  {
    id: 'limites',
    num: '07',
    title: 'Límites de responsabilidad.',
    body: (
      <>
        <p>
          Vértice se proporciona <em>tal cual</em>, en su versión vigente. No garantizamos que las
          extracciones de criterios sean infalibles; corresponde a la institución revisar el perfil
          antes de adoptarlo como política.
        </p>
        <p>
          La responsabilidad agregada de Vértice por cualquier reclamación, en cualquier
          jurisdicción, queda limitada al importe efectivamente pagado por la institución durante
          los doce meses anteriores al evento que la origine.
        </p>
      </>
    ),
  },
  {
    id: 'jurisdiccion',
    num: '08',
    title: 'Jurisdicción.',
    body: (
      <>
        <p>
          Estos términos se rigen por la legislación federal mexicana. Cualquier controversia se
          someterá a los tribunales competentes de la Ciudad de México, renunciando expresamente a
          cualquier otro fuero que pudiera corresponder.
        </p>
        <p>
          Las versiones anteriores se conservan archivadas y disponibles a solicitud por correo.
        </p>
      </>
    ),
  },
];

// =============================================================================
// Page
// =============================================================================
export default function Terminos() {
  const [active, setActive] = useState<string>(SECTIONS[0].id);

  // Pin body bg
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

  // Scroll spy for TOC
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visibles = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visibles[0]) setActive(visibles[0].target.id);
      },
      { rootMargin: '-30% 0px -55% 0px', threshold: 0 }
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  // GSAP scroll triggers — fade-in suave por cláusula al entrar viewport.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('[data-anim="clause"]').forEach((el) => {
        gsap.from(el, {
          opacity: 0,
          y: 32,
          duration: 0.85,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 82%',
            toggleActions: 'play none none reverse',
          },
        });
      });
    });
    return () => ctx.revert();
  }, []);

  return (
    <div
      className="landing-root relative flex min-h-screen w-full flex-1 flex-col overflow-x-clip bg-[#0A0F1C] text-[#F4F1EA]"
      style={{ fontFamily: "'Satoshi', ui-sans-serif, system-ui, sans-serif" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.018] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.7'/%3E%3C/svg%3E\")",
        }}
      />

      {/* HEADER STATIC — todos los elementos alineados verticalmente */}
      <header className="pointer-events-none fixed inset-x-0 top-0 z-30">
        <div className="mx-auto w-full max-w-[1480px] px-6 pt-6 sm:px-10 lg:px-14">
          <div className="relative flex h-12 items-center justify-between gap-4">
            <Link
              href="/"
              aria-label="Vértice — inicio"
              className="pointer-events-auto inline-flex items-center"
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

            <div className="pointer-events-auto absolute left-1/2 hidden -translate-x-1/2 md:flex md:items-center md:gap-3 md:rounded-full md:border md:border-[#F4F1EA]/10 md:bg-[#0A0F1C]/55 md:px-3.5 md:py-2 md:backdrop-blur-xl">
              <span className="size-1.5 rounded-full bg-[#C8A864] shadow-[0_0_10px_rgba(200,168,100,0.5)]" />
              <span className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-[#F4F1EA]/65">
                Documento legal
              </span>
            </div>

            <Link
              href="/"
              className="pointer-events-auto group inline-flex h-10 items-center gap-2 rounded-full border border-[#F4F1EA]/15 bg-[#0A0F1C]/55 px-3.5 text-[12px] font-medium text-[#F4F1EA]/85 backdrop-blur-xl transition-colors hover:border-[#F4F1EA]/35 hover:text-[#F4F1EA]"
            >
              <ArrowUpLeft className="size-3.5 text-[#C8A864] transition-transform group-hover:-translate-x-0.5" strokeWidth={2.5} />
              <span className="hidden sm:inline">Volver</span>
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative mx-auto w-full max-w-[1480px] px-6 pt-24 pb-20 sm:px-10 sm:pt-32 sm:pb-28 lg:px-14 lg:pt-40">
        <div className="grid grid-cols-12 items-end gap-x-6 gap-y-10 lg:gap-x-10">
          <div className="col-span-12 lg:col-span-9">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.32em] text-[#F4F1EA]/45">
              Documento legal · Vol. 01
            </div>
            <h1
              className="mt-7 font-display leading-[0.95] tracking-[-0.03em] text-[#F4F1EA]"
              style={{ fontWeight: 500, fontSize: 'clamp(46px, 7.4vw, 108px)' }}
            >
              <span className="ln-line block" style={{ animationDelay: '0.05s' }}>
                Términos de
              </span>
              <span
                className="ln-line block italic"
                style={{ animationDelay: '0.18s', fontWeight: 400, color: '#C8A864' }}
              >
                uso & privacidad.
              </span>
            </h1>
          </div>
          <div className="col-span-12 lg:col-span-3 lg:flex lg:flex-col lg:items-end">
            <div className="grid w-full max-w-[280px] grid-cols-2 gap-4 ml-auto font-mono text-[10.5px] uppercase tracking-[0.28em] lg:text-right">
              <div>
                <div className="text-[#F4F1EA]/45">Vigente</div>
                <div className="mt-1.5 tabular-nums text-[#F4F1EA]/85">2026.05.06</div>
              </div>
              <div>
                <div className="text-[#F4F1EA]/45">Versión</div>
                <div className="mt-1.5 tabular-nums text-[#F4F1EA]/85">v1.0</div>
              </div>
            </div>
            <p className="ml-auto mt-6 max-w-[280px] text-[12.5px] leading-relaxed text-[#F4F1EA]/55 lg:text-right">
              Las versiones anteriores se conservan archivadas y disponibles a solicitud.
            </p>
          </div>
        </div>
      </section>

      {/* BODY: TOC sticky + sections */}
      <main className="relative mx-auto w-full max-w-[1480px] px-6 pb-32 sm:px-10 lg:px-14">
        <div className="grid grid-cols-12 gap-x-6 gap-y-10 lg:gap-x-10">
          {/* TOC sidebar — sticky on lg+ */}
          <aside className="col-span-12 lg:col-span-3">
            <div className="lg:sticky lg:top-32">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.32em] text-[#F4F1EA]/45">
                Índice
              </div>
              <nav className="mt-5 flex flex-col gap-1">
                {SECTIONS.map((s) => {
                  const isActive = active === s.id;
                  return (
                    <a
                      key={s.id}
                      href={`#${s.id}`}
                      data-anim="toc-item"
                      className={`group flex items-baseline gap-3 border-l-2 py-1.5 pl-3 text-[12.5px] transition-all ${
                        isActive
                          ? 'border-l-[#C8A864] text-[#F4F1EA]'
                          : 'border-l-transparent text-[#F4F1EA]/50 hover:text-[#F4F1EA]/85'
                      }`}
                    >
                      <span
                        className={`font-mono text-[10px] tabular-nums tracking-[0.18em] ${
                          isActive ? 'text-[#C8A864]' : 'text-[#F4F1EA]/30 group-hover:text-[#F4F1EA]/55'
                        }`}
                      >
                        {s.num}
                      </span>
                      <span>{s.title.replace(/\.$/, '')}</span>
                    </a>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Article */}
          <article className="col-span-12 lg:col-span-9">
            {SECTIONS.map((s, idx) => (
              <section
                key={s.id}
                id={s.id}
                data-anim="clause"
                className={idx === 0 ? '' : 'border-t border-[#F4F1EA]/8 pt-16 mt-16 sm:pt-20 sm:mt-20'}
              >
                <div className="flex items-baseline gap-4 font-mono text-[10.5px] uppercase tracking-[0.32em]">
                  <span className="tabular-nums text-[#C8A864]">§{s.num}</span>
                  <span className="text-[#F4F1EA]/45">Cláusula</span>
                </div>
                <h2
                  className="mt-5 font-display tracking-[-0.022em] leading-[1.04] text-[#F4F1EA]"
                  style={{ fontWeight: 500, fontSize: 'clamp(30px, 4vw, 52px)' }}
                >
                  {s.title}
                </h2>
                <div className="mt-7 max-w-[68ch] space-y-5 text-[16px] leading-[1.7] text-[#F4F1EA]/80 sm:text-[17px] [&_em]:text-[#C8A864] [&_em]:not-italic [&_em]:font-medium [&_a]:text-[#F4F1EA] [&_a]:font-medium">
                  {s.body}
                </div>
              </section>
            ))}

            {/* Cierre */}
            <section className="border-t border-[#F4F1EA]/8 pt-16 mt-16 sm:pt-20 sm:mt-20">
              <div className="flex items-baseline gap-4 font-mono text-[10.5px] uppercase tracking-[0.32em]">
                <span className="text-[#C8A864]">∎ Cierre</span>
              </div>
              <p className="mt-5 max-w-[60ch] text-[16px] leading-[1.7] text-[#F4F1EA]/65 sm:text-[17px]">
                Si tienes preguntas, dudas o quieres ejercer tus derechos ARCO, escribe a{' '}
                <a
                  href="mailto:contacto@verticemexico.com"
                  className="border-b border-[#F4F1EA]/40 text-[#F4F1EA] hover:border-[#F4F1EA]"
                >
                  contacto@verticemexico.com
                </a>
                . Respondemos en menos de cuarenta y ocho horas hábiles.
              </p>
            </section>
          </article>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="relative z-10 mt-12 border-t border-[#F4F1EA]/8">
        <div className="mx-auto flex w-full max-w-[1480px] flex-col items-start justify-between gap-4 px-6 py-8 sm:flex-row sm:items-center sm:px-10 lg:px-14">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.3em] text-[#F4F1EA]/45">
            Vértice © 2026 — Criterios crediticios
          </div>
          <Link
            href="/"
            className="font-mono text-[10.5px] uppercase tracking-[0.3em] text-[#F4F1EA]/55 transition-colors hover:text-[#F4F1EA]"
          >
            ← Volver al inicio
          </Link>
        </div>
      </footer>
    </div>
  );
}
