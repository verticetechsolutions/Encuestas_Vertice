'use client';

// NuevaInstitucionModal v2 — dual-pane orgánico.
//
// Layout (desktop ≥md):
//   ┌─────────────────────────────┬───────────────────┐
//   │ LEFT — form                 │ RIGHT — flujo     │
//   │   Eyebrow + título + intro  │   "Cómo funciona" │
//   │   Fields stagger            │   4 steps         │
//   │   Submit                    │   Tip footer      │
//   └─────────────────────────────┴───────────────────┘
//   El modal usa goo filter (SVG #admin-hero-organic) para producir una
//   silueta orgánica con extrusión bottom-right (mirror del hero del catálogo).
//
// Mobile: las dos columnas se apilan; el panel derecho queda oculto bajo md
// para no saturar viewports compactos.
//
// Microanimaciones (recap):
//   - Backdrop fade + blur
//   - Modal spring entrance (scale 0.94→1)
//   - Fields stagger y:6→0 con delay index
//   - Steps stagger fade + y
//   - Submit y-bump hover + spinner trio
//   - X dismiss rotate 90° on hover
//   - Stage transition form ↔ success con AnimatePresence
//   - Success: check path draw + Copy↔Check crossfade

import {
  useActionState,
  useEffect,
  useState,
} from 'react';
import { motion, AnimatePresence, type Variants } from 'motion/react';
import Link from 'next/link';
import {
  X,
  Mail,
  Building2,
  ArrowRight,
  Check,
  Copy,
  AlertCircle,
  Link as LinkIcon,
  Send,
  KeyRound,
  MessagesSquare,
  Sparkles,
  Phone,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  crearInstitucionConLink,
  type CrearInstitucionConLinkState,
} from '@/app/actions/adminInstituciones';
import { formatPhoneInput } from '@/lib/utils/format-phone';

const TIPOS = [
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

const INITIAL_STATE: CrearInstitucionConLinkState = { ok: null };

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Wrapper que monta `ModalContent` solo cuando `open` es true. El hook
 * `useActionState` vive en el child — cerrar el modal lo desmonta y resetea
 * el state. Volver a abrir = component fresh con `INITIAL_STATE`.
 *
 * Antipatrón que evitamos: tener el hook en el padre + ocultar el contenido
 * con un boolean. El state de useActionState NO se puede resetear desde fuera
 * (no expone setter), así que el último resultado (success o error) quedaba
 * "pegado" entre aperturas.
 */
export function NuevaInstitucionModal({ open, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && <ModalContent key="nueva-institucion-modal" onClose={onClose} />}
    </AnimatePresence>
  );
}

function ModalContent({ onClose }: { onClose: () => void }) {
  const [state, formAction, pending] = useActionState(
    crearInstitucionConLink,
    INITIAL_STATE
  );

  // ModalContent solo monta cuando open=true (wrapper lo gatea). No
  // condicionamos por `open` aquí — siempre activo durante la vida del
  // mount, cleanup al desmontar.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  const isSuccess = state.ok === true;

  return (
    <div className="fixed inset-0 z-[100]">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onClick={onClose}
            className="absolute inset-0 bg-ink/45 backdrop-blur-[6px]"
          />

          {/* Centering wrapper */}
          <div className="relative flex h-full items-center justify-center overflow-y-auto p-4 md:p-6">
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Nueva institución"
              initial={{ scale: 0.94, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 6 }}
              transition={{
                type: 'spring',
                stiffness: 380,
                damping: 30,
                mass: 0.6,
              }}
              // isolate: crea su propio stacking context para que el `-z-10`
              // de las shapes de fondo (goo filter) quede dentro del modal y
              // no escape detrás del backdrop. Sin isolate, las shapes -z-10
              // se buscan el siguiente stacking ancestor (el fixed z-[100])
              // y caen detrás del backdrop, dejando el modal sin fondo.
              className="relative isolate w-full max-w-3xl"
            >
              {/* ═══ ORGANIC SHAPE LAYER ════════════════════════════════════
                  Form stage (dual-pane): dos rects fusionados via goo filter
                    1. Left rect (cream-pure)  — cubre el panel izquierdo
                    2. Right rect (cream lift) — cubre el panel derecho
                    3. Extrusion lobe (cream lift) — bottom-right
                  El split 57.4/42.6 replica el grid 1.35fr/1fr.
                  Success stage (single-pane): un solo rect uniforme cream-pure
                  + lobe del mismo tono. Sin esto la seam dual-tone queda
                  visible bajo el panel success que colapsó a 1 columna.
                  ═══════════════════════════════════════════════════════════ */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10"
                style={{
                  filter:
                    'drop-shadow(0 1px 0 rgb(10 15 28 / 0.08)) drop-shadow(0 20px 50px -10px rgb(10 15 28 / 0.20))',
                }}
              >
                <div
                  className="absolute inset-0"
                  style={{ filter: 'url(#admin-hero-organic)' }}
                >
                  {isSuccess ? (
                    <>
                      {/* Single uniform rect — cream-pure full-width.
                          inset-x-0 sin split, full rounded corners. */}
                      <div className="squircle absolute top-0 bottom-10 inset-x-0 rounded-[28px] bg-cream-pure" />
                      {/* Extrusion lobe del mismo tono — silueta orgánica
                          consistente sin seam visible. */}
                      <div className="absolute bottom-0 right-0 h-20 w-1/3 rounded-full bg-cream-pure" />
                    </>
                  ) : (
                    <>
                      {/* Left half — cream-pure. Sólo TL+BL redondeados; el
                          lado derecho debe ser sharp para que encuentre el rect
                          derecho sin notch interior. Se extiende un 0.6% extra
                          (right-[42%]) para overlap con right rect, evitando
                          hairline gap por sub-pixel rendering en el seam. */}
                      <div className="squircle absolute top-0 bottom-10 left-0 right-[42%] rounded-l-[28px] bg-cream-pure" />
                      {/* Right half — cream lift. Sólo TR+BR redondeados; lado
                          izquierdo sharp. Arranca en 57.4% (matchea boundary
                          del grid de contenido 1.35fr/1fr ≈ 57.4%). El overlap
                          con left rect en 57.4-58% queda pintado por right
                          (renderiza después) → transición de color limpia
                          exactamente en el seam visual. */}
                      <div className="squircle absolute top-0 bottom-10 left-[57.4%] right-0 rounded-r-[28px] bg-[#FAF8F2]" />
                      {/* Extrusion lobe — bottom-right, matchea right half */}
                      <div className="absolute bottom-0 right-0 h-20 w-1/3 rounded-full bg-[#FAF8F2]" />
                    </>
                  )}
                </div>
              </div>

              {/* X dismiss — flotante en esquina superior derecha */}
              <motion.button
                type="button"
                onClick={onClose}
                whileHover={{ scale: 1.06, rotate: 90 }}
                whileTap={{ scale: 0.92 }}
                transition={{
                  type: 'spring',
                  stiffness: 380,
                  damping: 22,
                }}
                aria-label="Cerrar"
                className="squircle absolute top-5 right-5 z-10 flex size-9 cursor-pointer items-center justify-center rounded-full bg-foreground/[0.05] text-foreground/65 ring-1 ring-foreground/[0.08] transition-colors hover:bg-foreground/[0.10] hover:text-foreground/85 md:top-6 md:right-6"
              >
                <X className="size-4" strokeWidth={2} />
              </motion.button>

              {/* Atmosphere gold sutil — clipeada al rect principal */}
              <div
                aria-hidden
                className="atmosphere-radial-gold-warm pointer-events-none absolute inset-x-0 top-0 h-40 rounded-t-[28px]"
              />

              {/* ═══ CONTENIDO ═══════════════════════════════════════════════ */}
              <div
                className={`relative grid grid-cols-1 ${
                  isSuccess ? '' : 'md:grid-cols-[1.35fr_1fr]'
                }`}
              >
                {/* LEFT — form / success stage. Padding bottom generoso para
                    que el CTA respire ante el lobe orgánico inferior. */}
                <div className="px-7 pt-9 pb-14 md:px-10 md:pt-12 md:pb-16">
                  <AnimatePresence mode="wait" initial={false}>
                    {isSuccess ? (
                      <SuccessStage
                        key="success"
                        state={state}
                        onClose={onClose}
                      />
                    ) : (
                      <FormStage
                        key="form"
                        formAction={formAction}
                        pending={pending}
                        error={state.ok === false ? state.error : null}
                      />
                    )}
                  </AnimatePresence>
                </div>

                {/* RIGHT — panel "Cómo funciona". El bg lighter viene de la
                    composición orgánica de fondo (capa goo) para que respete
                    la silueta y el lobe inferior. Aquí solo añadimos el seam
                    vertical sutil entre paneles. */}
                {!isSuccess && (
                  <aside className="relative hidden px-8 pt-12 pb-14 md:flex md:flex-col md:pb-16">
                    {/* Seam vertical entre paneles — hairline foreground tint */}
                    <span
                      aria-hidden
                      className="absolute inset-y-6 left-0 w-px bg-gradient-to-b from-transparent via-foreground/[0.08] to-transparent"
                    />
                    <FlowPanel />
                  </aside>
                )}
              </div>
            </motion.div>
          </div>
        </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// FormStage
// ════════════════════════════════════════════════════════════════════════════

const fieldVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 380,
      damping: 28,
      delay: 0.08 + i * 0.05,
    },
  }),
};

function FormStage({
  formAction,
  pending,
  error,
}: {
  formAction: (formData: FormData) => void;
  pending: boolean;
  error: string | null;
}) {
  const [tipo, setTipo] = useState<string>('banco');

  // React 19 + useActionState: el form action prop nativo envuelve la
  // invocación en una transition automáticamente. Llamar formAction(formData)
  // manualmente desde un onSubmit/click handler dispara
  // "An async function with useActionState was called outside of a transition".
  // Por eso pasamos formAction directo al <form action={...}> y exfiltramos
  // el valor del Select (que no es un <input>) vía un hidden input.

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.22 }}
    >
      {/* Header — eyebrow + título + intro */}
      <motion.header
        custom={0}
        variants={fieldVariants}
        initial="hidden"
        animate="visible"
        className="mb-7"
      >
        <span className="text-eyebrow text-gold-deep">Onboarding</span>
        <h2 className="mt-2 text-[clamp(24px,3vw,32px)] font-semibold leading-[1.05] tracking-[-0.025em] text-foreground">
          Nueva institución
        </h2>
        <p className="mt-3 max-w-md text-[13px] leading-relaxed tracking-tight text-foreground/55">
          Registra los datos básicos. Generaremos un magic link que envías al
          contacto.
        </p>
      </motion.header>

      <form action={formAction} className="flex flex-col gap-5">
        {/* Hidden input que viaja el valor del Select shadcn dentro del FormData.
            El Select no es un <input> nativo así que React no lo serializa al
            submit; el hidden input se sincroniza desde `tipo` state. */}
        <input type="hidden" name="tipo" value={tipo} />
        <motion.div
          custom={1}
          variants={fieldVariants}
          initial="hidden"
          animate="visible"
        >
          <Field
            name="razon_social"
            label="Razón social"
            placeholder="Banco Multiva, S.A., Institución de Banca Múltiple"
            icon={<Building2 className="size-4" strokeWidth={1.75} />}
            required
          />
        </motion.div>

        <motion.div
          custom={2}
          variants={fieldVariants}
          initial="hidden"
          animate="visible"
        >
          <Field
            name="nombre_comercial"
            label="Nombre comercial"
            hint="opcional"
            placeholder="Multiva"
          />
        </motion.div>

        <motion.div
          custom={3}
          variants={fieldVariants}
          initial="hidden"
          animate="visible"
        >
          <div className="flex flex-col gap-2">
            <label
              htmlFor="tipo-trigger"
              className="text-eyebrow text-foreground/55"
            >
              Tipo
            </label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger
                id="tipo-trigger"
                className="h-11 rounded-2xl bg-cream-pure/55 px-3.5 text-[14px] shadow-[inset_0_0_0_1px_rgba(10,15,28,0.08)] hover:bg-cream-pure/80 hover:shadow-[inset_0_0_0_1px_rgba(10,15,28,0.14)]"
              >
                <SelectValue placeholder="Selecciona un tipo" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </motion.div>

        <motion.div
          custom={4}
          variants={fieldVariants}
          initial="hidden"
          animate="visible"
        >
          <Field
            name="email_contacto"
            label="Email de contacto"
            type="email"
            placeholder="ceo@institucion.mx"
            icon={<Mail className="size-4" strokeWidth={1.75} />}
            required
          />
        </motion.div>

        <motion.div
          custom={5}
          variants={fieldVariants}
          initial="hidden"
          animate="visible"
        >
          <Field
            name="telefono_contacto"
            label="Teléfono de contacto"
            type="tel"
            placeholder="52 33 2654 0178"
            icon={<Phone className="size-4" strokeWidth={1.75} />}
            hint="opcional"
            onInput={formatPhoneInput}
            inputMode="tel"
            autoComplete="tel"
          />
        </motion.div>

        <AnimatePresence>
          {error && (
            <motion.div
              key={`err-${error}`}
              initial={{ height: 0, opacity: 0, y: 4 }}
              animate={{ height: 'auto', opacity: 1, y: 0 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{
                height: {
                  type: 'spring',
                  stiffness: 320,
                  damping: 30,
                  mass: 0.7,
                },
                opacity: { duration: 0.18 },
              }}
              style={{ overflow: 'hidden' }}
            >
              <div className="squircle flex items-start gap-3 rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200/70">
                <AlertCircle
                  className="mt-0.5 size-4 shrink-0 text-amber-700"
                  strokeWidth={2}
                />
                <p className="text-[13px] leading-relaxed tracking-tight text-amber-900">
                  {error}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          custom={5}
          variants={fieldVariants}
          initial="hidden"
          animate="visible"
          className="mt-3"
        >
          <SubmitButton pending={pending} />
        </motion.div>
      </form>
    </motion.div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// FlowPanel — right column con steps del flujo onboarding
// ════════════════════════════════════════════════════════════════════════════

const FLOW_STEPS = [
  {
    icon: Send,
    title: 'Compartes el enlace',
    desc: 'Por email, WhatsApp o el canal que prefieras.',
  },
  {
    icon: KeyRound,
    title: 'El cliente entra en un click',
    desc: 'Sin contraseñas. El enlace expira en pocas horas.',
  },
  {
    icon: MessagesSquare,
    title: 'Responde una entrevista',
    desc: 'Conversación guiada de unos 30 minutos sobre su negocio.',
  },
  {
    icon: Sparkles,
    title: 'Recibes su perfil',
    desc: 'Al terminar, el resumen aparece listo para revisión.',
  },
];

const stepVariants: Variants = {
  hidden: { opacity: 0, x: 8 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      type: 'spring',
      stiffness: 380,
      damping: 28,
      delay: 0.14 + i * 0.06,
    },
  }),
};

function FlowPanel() {
  return (
    <div className="flex h-full flex-col gap-6">
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <span className="text-eyebrow text-foreground/45">Flujo</span>
        <h3 className="mt-1.5 text-[16px] font-semibold tracking-tight text-foreground">
          Cómo funciona
        </h3>
      </motion.div>

      <ol className="flex flex-col gap-5">
        {FLOW_STEPS.map((step, i) => (
          <motion.li
            key={step.title}
            custom={i}
            variants={stepVariants}
            initial="hidden"
            animate="visible"
            className="flex gap-3"
          >
            <span
              className="flex size-7 shrink-0 items-center justify-center rounded-full"
              style={{
                backgroundColor:
                  'color-mix(in srgb, var(--gold-bright) 18%, transparent)',
                color: 'var(--gold-deep)',
              }}
            >
              <step.icon className="size-3.5" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold tracking-tight text-foreground">
                {step.title}
              </p>
              <p className="mt-0.5 text-[12px] leading-relaxed tracking-tight text-foreground/55">
                {step.desc}
              </p>
            </div>
          </motion.li>
        ))}
      </ol>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.5 }}
        className="mt-auto pt-4"
      >
        <p className="text-[11.5px] leading-relaxed tracking-tight text-foreground/45">
          Generaremos el enlace inmediatamente. Tú decides cuándo y por dónde
          enviarlo.
        </p>
      </motion.div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Field — input squircle minimalista (menos ring noise que v1)
// ════════════════════════════════════════════════════════════════════════════

function Field({
  name,
  label,
  hint,
  type = 'text',
  placeholder,
  icon,
  required = false,
  onInput,
  inputMode,
  autoComplete,
}: {
  name: string;
  label: string;
  hint?: string;
  type?: string;
  placeholder?: string;
  icon?: React.ReactNode;
  required?: boolean;
  onInput?: React.FormEventHandler<HTMLInputElement>;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  autoComplete?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <label
          htmlFor={`field-${name}`}
          className="text-eyebrow text-foreground/55"
        >
          {label}
        </label>
        {hint && (
          <span className="font-mono text-[10.5px] tracking-tight text-foreground/40">
            {hint}
          </span>
        )}
      </div>
      <div className="squircle group relative flex h-11 items-center gap-2.5 rounded-2xl bg-cream-pure/55 px-3.5 shadow-[inset_0_0_0_1px_rgba(10,15,28,0.08)] transition-shadow focus-within:shadow-[inset_0_0_0_1.5px_rgba(200,168,100,0.55),0_0_0_4px_rgba(200,168,100,0.10)] hover:bg-cream-pure/80 hover:shadow-[inset_0_0_0_1px_rgba(10,15,28,0.14)]">
        {icon && (
          <span className="text-foreground/40 transition-colors group-focus-within:text-gold-deep">
            {icon}
          </span>
        )}
        <input
          id={`field-${name}`}
          name={name}
          type={type}
          placeholder={placeholder}
          required={required}
          onInput={onInput}
          inputMode={inputMode}
          autoComplete={autoComplete}
          className="flex-1 bg-transparent text-[14px] tracking-tight text-foreground placeholder:text-foreground/35 focus:outline-none"
        />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SubmitButton
// ════════════════════════════════════════════════════════════════════════════

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <motion.button
      type="submit"
      disabled={pending}
      whileHover={pending ? undefined : { y: -1 }}
      whileTap={pending ? undefined : { scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 380, damping: 22 }}
      className="squircle group/cta inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2.5 rounded-full bg-ink px-5 text-[14px] font-semibold tracking-tight text-cream-pure shadow-card-subtle ring-1 ring-ink transition-shadow hover:bg-[var(--ink-raised)] hover:shadow-card-elevated disabled:cursor-not-allowed disabled:opacity-70"
    >
      <span className="relative flex size-4 items-center justify-center">
        <AnimatePresence mode="wait" initial={false}>
          {pending ? (
            <motion.span
              key="spinner"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <SpinnerDots />
            </motion.span>
          ) : (
            <motion.span
              key="icon"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 flex items-center justify-center"
              whileHover={{ rotate: -8 }}
            >
              <LinkIcon className="size-4" strokeWidth={1.75} />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <span>{pending ? 'Creando…' : 'Crear y generar magic link'}</span>
    </motion.button>
  );
}

function SpinnerDots() {
  const dot: Variants = {
    initial: { y: 0, opacity: 0.4 },
    animate: { y: -2, opacity: 1 },
  };
  return (
    <span className="flex items-end gap-[2px]">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block size-1 rounded-full bg-current"
          variants={dot}
          initial="initial"
          animate="animate"
          transition={{
            duration: 0.5,
            repeat: Infinity,
            repeatType: 'reverse',
            ease: 'easeInOut',
            delay: i * 0.12,
          }}
        />
      ))}
    </span>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SuccessStage — single column (modal colapsa a 1 col)
// ════════════════════════════════════════════════════════════════════════════

function SuccessStage({
  state,
  onClose,
}: {
  state: Extract<CrearInstitucionConLinkState, { ok: true }>;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const expira = new Date(state.expires_at).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(state.magic_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // ignore
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28, mass: 0.7 }}
      className="flex flex-col gap-5"
    >
      <div className="flex items-center gap-3">
        <span
          className="flex size-9 items-center justify-center rounded-full"
          style={{
            backgroundColor:
              'color-mix(in srgb, var(--gold-bright) 24%, transparent)',
            color: 'var(--gold-deep)',
          }}
        >
          <CheckDrawIcon />
        </span>
        <div>
          <span className="text-eyebrow text-gold-deep">Magic link listo</span>
          <h2 className="mt-1 text-[24px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
            Institución creada
          </h2>
        </div>
      </div>

      <p className="text-[13.5px] leading-relaxed tracking-tight text-foreground/72">
        Se registró con{' '}
        <span className="font-mono font-semibold tabular-nums text-foreground">
          {state.cajas_aplicables}
        </span>{' '}
        cajas aplicables. Copia el link y envíalo manualmente — expira el{' '}
        <span className="font-medium text-foreground">{expira}</span>.
      </p>

      <div className="squircle flex items-center gap-3 rounded-2xl bg-foreground/[0.04] px-3 py-2.5 ring-1 ring-foreground/[0.06]">
        <LinkIcon
          className="size-3.5 shrink-0 text-foreground/55"
          strokeWidth={1.75}
        />
        <code className="flex-1 truncate font-mono text-[11.5px] tracking-tight text-foreground/85">
          {state.magic_url}
        </code>
      </div>

      <div className="flex flex-col gap-2">
        <motion.button
          type="button"
          onClick={handleCopy}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 380, damping: 22 }}
          className="squircle inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2.5 rounded-full px-5 text-[14px] font-semibold tracking-tight shadow-card-subtle transition-colors"
          style={
            copied
              ? {
                  backgroundColor:
                    'color-mix(in srgb, var(--gold-bright) 22%, transparent)',
                  color: 'var(--gold-deep)',
                }
              : {
                  backgroundColor: 'var(--ink)',
                  color: 'var(--cream-pure, #f4f1ea)',
                }
          }
        >
          <span className="relative flex size-4 items-center justify-center">
            <AnimatePresence mode="wait" initial={false}>
              {copied ? (
                <motion.span
                  key="check"
                  initial={{ scale: 0, rotate: -45, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  exit={{ scale: 0, rotate: 45, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 480, damping: 22 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <Check className="size-4" strokeWidth={2.5} />
                </motion.span>
              ) : (
                <motion.span
                  key="copy"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 480, damping: 22 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <Copy className="size-4" strokeWidth={2} />
                </motion.span>
              )}
            </AnimatePresence>
          </span>
          {copied ? 'Copiado al portapapeles' : 'Copiar al portapapeles'}
        </motion.button>

        <div className="flex flex-col gap-2 md:flex-row">
          <Link
            href={`/admin/instituciones/${state.institucion_id}`}
            onClick={onClose}
            className="squircle group/btn inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-cream-pure px-4 text-[13px] font-medium tracking-tight text-foreground ring-1 ring-foreground/[0.10] transition-shadow hover:ring-foreground/[0.18] hover:shadow-card-subtle"
          >
            Ver detalle
            <ArrowRight
              className="size-3.5 transition-transform group-hover/btn:translate-x-0.5"
              strokeWidth={1.75}
            />
          </Link>
          <motion.button
            type="button"
            onClick={onClose}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
            className="squircle inline-flex h-10 cursor-pointer items-center justify-center rounded-full bg-foreground/[0.05] px-4 text-[13px] font-medium tracking-tight text-foreground/72 ring-1 ring-foreground/[0.08] transition-colors hover:bg-foreground/[0.10] hover:text-foreground"
          >
            Cerrar
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

function CheckDrawIcon() {
  return (
    <motion.svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <motion.path
        d="M5 12 L10 17 L19 7"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{
          duration: 0.5,
          ease: [0.65, 0, 0.35, 1],
          delay: 0.15,
        }}
      />
    </motion.svg>
  );
}
