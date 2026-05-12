// Preview-only de la pantalla de consentimiento (`/entrevista/[id]/bienvenida`).
// V2: rediseñada al Design System del admin (cream-pure cards, ink/gold,
// squircle, eyebrow mono, hairlines). Sin DB, sin cookies, sin middleware.
// 404 en producción. El botón "Iniciar entrevista" no avanza (la acción real
// requiere sesión válida en DB) — el objetivo aquí es visual.
//
// Cuando se cierre la iteración, este JSX se promueve a
// `app/entrevista/[sesion_id]/bienvenida/page.tsx` y se DRY-fica con un
// componente compartido <BienvenidaView>.

import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Clock, Mic, PauseCircle, RotateCcw } from 'lucide-react';
import { ConsentFormV2 } from './consent-form-v2';

export default function PreviewConsentPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const nombreMostrado = 'Banco Demo';
  const sesion_id = '00000000-0000-0000-0000-000000000000';

  return (
    <main className="min-h-screen bg-survey-bg">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16 md:py-20">
        <div className="flex flex-col gap-5">
          {/* ═══════════════════════════════════════════════════════════════
              HERO CARD — brand mark + bienvenida + cómo responder + meta
              ═══════════════════════════════════════════════════════════════ */}
          <section className="squircle shadow-card-elevated relative isolate overflow-hidden rounded-[28px] bg-cream-pure p-8 ring-1 ring-foreground/[0.04] md:p-10">
            {/* Atmosphere radial gold sutil top-right — mismo patrón que
                MetricCard hero atmosphere. */}
            <div
              aria-hidden
              className="atmosphere-radial-gold-warm pointer-events-none absolute inset-0 -z-10"
            />

            {/* Logo brand mark — reemplaza el eyebrow textual "Vértice".
                Height 32px en mobile, 36px en desktop; width auto preserva
                aspect ratio. Logo_blue.svg fill matches --ink (#0F172A). */}
            <Image
              src="/Logo_blue.svg"
              alt="Vértice"
              width={108}
              height={36}
              priority
              className="h-7 w-auto md:h-9"
            />

            <p className="mt-7 text-eyebrow text-gold-deep">Bienvenida</p>

            <h1 className="mt-3 text-[clamp(28px,4.4vw,40px)] font-semibold tracking-[-0.025em] leading-[1.05] text-foreground">
              Hola,
              <br />
              <span className="text-gold-deep">{nombreMostrado}</span>
            </h1>

            <p className="mt-6 max-w-prose text-[15px] leading-[1.65] text-foreground/72">
              Vamos a construir el perfil de criterios crediticios de tu
              institución a través de una entrevista guiada por IA. El
              propósito: enviarte después solicitudes y casos que se
              adecúen a tus necesidades y preferencias.
            </p>

            {/* ─── Cómo responder ────────────────────────────────────────
                Jerarquía: eyebrow → statement display (highlight gold) →
                supporting body → tip mic. La palabra "conversacional" se
                trata como hero element (font-display, italic, gold-deep,
                tamaño 1.3x del statement) para que el lector entienda en
                un escaneo que la entrevista NO es un formulario.  */}
            <div className="mt-10">
              <p className="text-eyebrow text-foreground/55">Cómo responder</p>
              <p className="mt-3 text-[clamp(20px,2.6vw,26px)] font-medium leading-[1.25] tracking-[-0.01em] text-foreground">
                Respóndenos a manera{' '}
                <em
                  className="font-display font-semibold tracking-tight text-gold-deep"
                  style={{ fontStyle: 'italic' }}
                >
                  conversacional
                </em>{' '}
                y detallada.
              </p>
              <p className="mt-4 max-w-prose text-[15px] leading-[1.65] text-foreground/72">
                Háblale a nuestra IA como le hablarías a un socio que
                quiere entender tu mesa a fondo. Anécdotas, matices, casos
                reales: todo suma. Mientras más nos cuentes, mejor podremos
                enviarte solicitudes que encajen con tu política.
              </p>

              {/* Tip mic — destacado en row con icono gold, no card aislado.
                  Mantiene flujo de lectura y enfatiza la affordance del mic
                  como herramienta principal de input. */}
              <div className="mt-6 flex items-start gap-3 rounded-2xl bg-foreground/[0.03] px-4 py-3.5 ring-1 ring-foreground/[0.04]">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--gold)_22%,transparent)] text-gold-deep">
                  <Mic className="size-[15px]" strokeWidth={1.75} />
                </span>
                <p className="text-[13.5px] leading-relaxed text-foreground/72">
                  <span className="font-semibold text-foreground">
                    Usa el micrófono
                  </span>{' '}
                  para dictar tus respuestas. Captura tu lenguaje natural y
                  va más rápido que escribir.
                </p>
              </div>
            </div>

            {/* Meta chips — 3 microcaps con icono mono. Cierre del hero. */}
            <div className="mt-9 flex flex-col gap-2.5 border-t border-foreground/[0.06] pt-6 md:flex-row md:items-center md:gap-7">
              <MetaChip
                icon={<Clock className="size-[14px]" strokeWidth={1.75} />}
                label="30 a 45 minutos"
              />
              <MetaChip
                icon={<PauseCircle className="size-[14px]" strokeWidth={1.75} />}
                label="Pausa cuando quieras"
              />
              <MetaChip
                icon={<RotateCcw className="size-[14px]" strokeWidth={1.75} />}
                label="Retoma con el mismo enlace"
              />
            </div>
          </section>

          {/* ═══════════════════════════════════════════════════════════════
              PRIVACY + CONSENT CARD — aviso LFPDPPP, sub-anchors,
              checkbox y CTA. Reescrito en primera persona plural para
              evitar "Vértice" textual sin perder la claridad legal. Sin
              em-dashes en todo el bloque.
              ═══════════════════════════════════════════════════════════════ */}
          <section className="squircle shadow-card-elevated relative overflow-hidden rounded-[28px] bg-cream-pure p-8 ring-1 ring-foreground/[0.04] md:p-10">
            <p className="text-eyebrow text-foreground/55">
              Aviso de privacidad · LFPDPPP
            </p>
            <h2 className="mt-4 text-[22px] font-semibold tracking-tight text-foreground md:text-[24px]">
              Cómo tratamos tus datos
            </h2>

            {/* Tres sub-anchors con micro-label arriba de cada paragraph.
                Genera jerarquía sin recurrir a bullets/cards. */}
            <div className="mt-7 flex flex-col gap-6">
              <PrivacyBlock
                label="Qué recolectamos"
                body="Recolectamos los datos que compartes durante la entrevista (nombre comercial, criterios de crédito, contactos operativos) exclusivamente para construir el perfil de decisión crediticia de tu institución y operar el matching con solicitantes en plataformas aliadas."
              />
              <PrivacyBlock
                label="Cómo lo compartimos"
                body="No compartiremos los datos identificables con terceros sin tu autorización previa. Puedes ejercer tus derechos ARCO escribiendo a contacto@verticemexico.com."
              />
              <PrivacyBlock
                label="Dónde se almacena"
                body="La transcripción y los datos extraídos se almacenan en una base de datos cifrada en Neon (Frankfurt y N. Virginia). Las llamadas al modelo conversacional (Anthropic Claude) y al transcriptor (Deepgram) operan bajo acuerdo de no retención de datos."
              />
            </div>

            {/* Gold hairline seam — separa el legal del consent action.
                Ancho generoso, no full-width: insinúa transición sin cortar. */}
            <div className="mt-8 flex items-center gap-3">
              <span className="gold-hairline flex-1" />
            </div>

            <p className="mt-7 text-[14px] leading-relaxed text-foreground/72">
              Al continuar, manifiestas que tienes facultades para
              representar a tu institución y otorgas el consentimiento para
              este tratamiento.
            </p>

            <div className="mt-6">
              <ConsentFormV2 sesion_id={sesion_id} />
            </div>
          </section>

          {/* Footnote — discreto, fuera del card stack. Anchor a contacto. */}
          <p className="mt-2 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-foreground/40">
            ¿Dudas? contacto@verticemexico.com
          </p>
        </div>
      </div>
    </main>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Local atoms — viven aquí mientras iteramos. Cuando se promueva la
// pantalla al path real, estos se extraen a `components/entrevista/`.
// ────────────────────────────────────────────────────────────────────────────

function MetaChip({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 text-[12.5px] font-medium tracking-tight text-foreground/72">
      <span className="text-gold-deep">{icon}</span>
      <span>{label}</span>
    </span>
  );
}

function PrivacyBlock({ label, body }: { label: string; body: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-eyebrow text-gold-deep">{label}</span>
      <p className="text-[14px] leading-[1.65] text-foreground/72">{body}</p>
    </div>
  );
}
