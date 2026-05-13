import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';

interface Props {
  searchParams: Promise<{ razon?: string }>;
}

const FALLBACK = 'Algo salió mal con tu acceso. Pide un enlace nuevo a tu asesor.';

const RAZONES: Record<string, string> = {
  token_invalido: 'No reconocemos este enlace.',
  expirado: 'Tu enlace expiró. Vigencia: 7 días.',
  consumido: 'Este enlace ya fue usado.',
  revocado: 'Este enlace fue revocado.',
  institucion_no_encontrada: 'No encontramos esta institución.',
  sin_sesion: 'Tu sesión no está activa.',
  rate_limited: 'Demasiados intentos. Espera un minuto.',
  sin_email: 'Google no nos compartió tu correo.',
  email_no_verificado: 'Tu correo de Google no está verificado.',
  dominio_no_permitido: 'Tu correo no está autorizado para acceder.',
  error_interno: 'Algo falló de nuestro lado. Reintenta en un minuto.',
};

const CONTACTO = 'contacto@verticemexico.com';

function buildMailtoHref(razon: string | undefined, mensaje: string): string {
  const subject = `Necesito un enlace nuevo de Vértice (${razon ?? 'acceso'})`;
  const body = [
    'Hola equipo Vértice,',
    '',
    `Intenté abrir mi enlace de acceso y obtuve: ${mensaje}`,
    '',
    '¿Pueden emitirme uno nuevo? Mi institución es: ____',
    '',
    'Gracias.',
  ].join('\n');
  return `mailto:${CONTACTO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default async function AccesoExpiradoPage({ searchParams }: Props) {
  const { razon } = await searchParams;
  const mensaje = (razon ? RAZONES[razon] : undefined) ?? FALLBACK;
  const mailtoHref = buildMailtoHref(razon, mensaje);

  return (
    <main className="min-h-screen bg-survey-bg">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16 md:py-20">
        <section className="squircle shadow-card-elevated relative isolate overflow-hidden rounded-[28px] bg-cream-pure p-10 ring-1 ring-foreground/[0.04] md:p-14">
          <div
            aria-hidden
            className="atmosphere-radial-gold-warm pointer-events-none absolute inset-0 -z-10"
          />

          <Image
            src="/Logo_blue.svg"
            alt="Vértice"
            width={160}
            height={52}
            priority
            className="h-10 w-auto md:h-12"
          />

          <h1 className="mt-16 font-heading text-[clamp(44px,7vw,72px)] font-semibold leading-[0.98] tracking-[-0.03em] text-foreground">
            No podemos
            <br />
            <span className="text-gold-deep">darte acceso.</span>
          </h1>

          <p className="mt-7 max-w-[34ch] text-[16px] leading-[1.55] text-foreground/72">
            {mensaje}
          </p>

          <a
            href={mailtoHref}
            className="group/cta mt-10 flex cursor-pointer items-center justify-between gap-6 rounded-[22px] bg-survey-surface p-5 ring-1 ring-foreground/[0.04] transition-shadow duration-200 hover:ring-foreground/[0.08] md:p-6"
          >
            <span className="flex min-w-0 flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-foreground/45">
                Escríbele a
              </span>
              <span className="truncate text-[15px] text-foreground transition-colors duration-200 group-hover/cta:text-gold-deep">
                {CONTACTO}
              </span>
            </span>
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-cream-pure shadow-[0_0_0_1px_rgba(10,15,28,0.04),0_20px_50px_-20px_rgba(10,15,28,0.35)] transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/cta:rotate-45">
              <ArrowUpRight className="size-[18px]" strokeWidth={1.75} />
            </span>
          </a>
        </section>
      </div>
    </main>
  );
}
