'use client';

// Magic link actions — UI unificada para reenvío / generación / revocación.
//
// Componentes:
//  - MagicLinkActionsPanel: panel combinado (reenviar + generar URL) con
//    feedback animado abajo. Layout: dos buttons en row, panel reactivo con
//    AnimatePresence + spring height/opacity.
//  - RevocarButton: inline action para magic_tokens vigentes.
//
// Microanimaciones:
//  - Button hover: y-bump -1px + ring intensifica
//  - Button press: scale 0.97 (whileTap)
//  - Mail icon hover: wobble suave [-6°, 6°, -3°, 0°] 0.45s
//  - Link icon hover: rotación +25° spring back to 0°
//  - Spinner pending: dot trio con stagger
//  - Copy/Check crossfade: scale + opacity transition con spring
//  - Feedback panel: enter desde abajo (y:8 → 0) con spring, exit fade

import { useState, useTransition } from 'react';
import {
  motion,
  AnimatePresence,
  type Variants,
} from 'motion/react';
import { Mail, Link2, Ban, Copy, Check, AlertCircle, X } from 'lucide-react';
import {
  reenviarMagicLink,
  revocarMagicLink,
} from '@/app/actions/adminMagicLinks';

// ════════════════════════════════════════════════════════════════════════════
// MagicLinkActionsPanel — panel unificado para reenviar + generar URL
// ════════════════════════════════════════════════════════════════════════════

export function MagicLinkActionsPanel({
  institucion_id,
}: {
  institucion_id: string;
}) {
  const [reenviarPending, startReenviar] = useTransition();
  const [reenviarMsg, setReenviarMsg] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const [generarPending, startGenerar] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [generarError, setGenerarError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleReenviar = () => {
    setReenviarMsg(null);
    startReenviar(async () => {
      const result = await reenviarMagicLink(institucion_id, 'email');
      if (result.ok) {
        setReenviarMsg({
          ok: true,
          text: `Enviado a ${result.sent_to ?? 'el contacto registrado'}.`,
        });
      } else {
        setReenviarMsg({ ok: false, text: result.error });
      }
    });
  };

  const handleGenerar = () => {
    setUrl(null);
    setGenerarError(null);
    startGenerar(async () => {
      const result = await reenviarMagicLink(institucion_id, 'dry_run');
      if (result.ok) setUrl(result.magic_url);
      else setGenerarError(result.error);
    });
  };

  const handleCopy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setGenerarError('No se pudo copiar al portapapeles.');
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Buttons row */}
      <div className="flex flex-wrap items-center gap-2">
        <ActionButton
          variant="primary"
          onClick={handleReenviar}
          disabled={reenviarPending}
          pending={reenviarPending}
          icon={<MailIconAnimated pending={reenviarPending} />}
          label={reenviarPending ? 'Enviando…' : 'Reenviar por correo'}
        />
        <ActionButton
          variant="secondary"
          onClick={handleGenerar}
          disabled={generarPending}
          pending={generarPending}
          icon={<LinkIconAnimated pending={generarPending} />}
          label={generarPending ? 'Generando…' : 'Generar URL'}
        />
      </div>

      {/* Feedback area — varios paneles pueden aparecer simultáneamente */}
      <AnimatePresence initial={false}>
        {reenviarMsg && (
          <FeedbackBanner
            key={`reenviar-${reenviarMsg.text}`}
            tone={reenviarMsg.ok ? 'success' : 'error'}
            message={reenviarMsg.text}
            onDismiss={() => setReenviarMsg(null)}
          />
        )}
        {url && (
          <UrlPanel
            key={`url-${url}`}
            url={url}
            copied={copied}
            onCopy={handleCopy}
            onDismiss={() => {
              setUrl(null);
              setCopied(false);
            }}
          />
        )}
        {generarError && (
          <FeedbackBanner
            key={`gen-err-${generarError}`}
            tone="error"
            message={generarError}
            onDismiss={() => setGenerarError(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ActionButton — base button con motion (y-bump + tap scale)
// ════════════════════════════════════════════════════════════════════════════

interface ActionButtonProps {
  variant: 'primary' | 'secondary';
  icon: React.ReactNode;
  label: string;
  pending?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function ActionButton({
  variant,
  icon,
  label,
  pending = false,
  disabled = false,
  onClick,
}: ActionButtonProps) {
  const baseCls =
    'squircle group/btn relative inline-flex cursor-pointer items-center gap-2 overflow-hidden rounded-full px-4 py-2 text-[13px] font-semibold tracking-tight ring-1 transition-shadow disabled:cursor-not-allowed disabled:opacity-65';

  const variantCls =
    variant === 'primary'
      ? 'bg-ink text-cream-pure ring-ink shadow-card-subtle hover:bg-[var(--ink-raised)] hover:shadow-card-elevated'
      : 'bg-cream-pure text-foreground ring-foreground/[0.10] shadow-card-subtle hover:ring-foreground/[0.18] hover:bg-cream-pure';

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? undefined : { y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 380, damping: 22, mass: 0.5 }}
      className={`${baseCls} ${variantCls}`}
    >
      <span className="relative flex size-4 items-center justify-center">
        <AnimatePresence mode="wait" initial={false}>
          {pending ? (
            <motion.span
              key="spinner"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <Spinner />
            </motion.span>
          ) : (
            <motion.span
              key="icon"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              {icon}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <span>{label}</span>
    </motion.button>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Animated icons
// ════════════════════════════════════════════════════════════════════════════

const wobbleVariants: Variants = {
  rest: { rotate: 0 },
  hover: {
    rotate: [0, -8, 6, -3, 0],
    transition: { duration: 0.55, ease: 'easeInOut' },
  },
};

function MailIconAnimated({ pending }: { pending: boolean }) {
  return (
    <motion.span
      initial="rest"
      animate="rest"
      whileHover={pending ? undefined : 'hover'}
      variants={wobbleVariants}
      className="flex"
    >
      <Mail className="size-4" strokeWidth={1.75} />
    </motion.span>
  );
}

const linkSpinVariants: Variants = {
  rest: { rotate: 0 },
  hover: {
    rotate: -25,
    transition: { type: 'spring', stiffness: 280, damping: 14 },
  },
};

function LinkIconAnimated({ pending }: { pending: boolean }) {
  return (
    <motion.span
      initial="rest"
      animate="rest"
      whileHover={pending ? undefined : 'hover'}
      variants={linkSpinVariants}
      className="flex"
    >
      <Link2 className="size-4" strokeWidth={1.75} />
    </motion.span>
  );
}

// Spinner — trio de dots con stagger. Más sofisticado que un rotate.
function Spinner() {
  const dotVariants: Variants = {
    initial: { y: 0, opacity: 0.4 },
    animate: { y: -2, opacity: 1 },
  };
  return (
    <span className="flex items-end gap-[2px]">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block size-1 rounded-full bg-current"
          variants={dotVariants}
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
// FeedbackBanner — panel animado para success/error
// ════════════════════════════════════════════════════════════════════════════

function FeedbackBanner({
  tone,
  message,
  onDismiss,
}: {
  tone: 'success' | 'error';
  message: string;
  onDismiss: () => void;
}) {
  const isSuccess = tone === 'success';
  return (
    <motion.div
      initial={{ height: 0, opacity: 0, y: 4 }}
      animate={{ height: 'auto', opacity: 1, y: 0 }}
      exit={{ height: 0, opacity: 0, y: -4 }}
      transition={{
        height: { type: 'spring', stiffness: 320, damping: 30, mass: 0.7 },
        opacity: { duration: 0.18 },
        y: { type: 'spring', stiffness: 380, damping: 26 },
      }}
      style={{ overflow: 'hidden' }}
    >
      <div
        className={`squircle flex items-start gap-3 rounded-2xl px-4 py-3 ring-1 ${
          isSuccess
            ? 'bg-[color-mix(in_srgb,var(--gold-bright)_14%,transparent)] text-gold-deep ring-[color-mix(in_srgb,var(--gold-bright)_30%,transparent)]'
            : 'bg-amber-50 text-amber-900 ring-amber-200/70'
        }`}
      >
        <span className="mt-0.5 flex shrink-0">
          {isSuccess ? <CheckDrawIcon /> : <AlertCircle className="size-4" strokeWidth={2} />}
        </span>
        <p className="flex-1 text-[13px] leading-relaxed tracking-tight">
          {message}
        </p>
        <motion.button
          type="button"
          onClick={onDismiss}
          aria-label="Cerrar"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="squircle flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full opacity-60 transition-opacity hover:opacity-100"
        >
          <X className="size-3" strokeWidth={2} />
        </motion.button>
      </div>
    </motion.div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// UrlPanel — display de URL generada con copy button
// ════════════════════════════════════════════════════════════════════════════

function UrlPanel({
  url,
  copied,
  onCopy,
  onDismiss,
}: {
  url: string;
  copied: boolean;
  onCopy: () => void;
  onDismiss: () => void;
}) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0, y: 4 }}
      animate={{ height: 'auto', opacity: 1, y: 0 }}
      exit={{ height: 0, opacity: 0, y: -4 }}
      transition={{
        height: { type: 'spring', stiffness: 320, damping: 30, mass: 0.7 },
        opacity: { duration: 0.18 },
        y: { type: 'spring', stiffness: 380, damping: 26 },
      }}
      style={{ overflow: 'hidden' }}
    >
      <div className="squircle flex items-center gap-3 rounded-2xl bg-foreground/[0.04] px-3 py-2.5 ring-1 ring-foreground/[0.06]">
        <Link2
          className="size-3.5 shrink-0 text-foreground/55"
          strokeWidth={1.75}
        />
        <code className="flex-1 truncate font-mono text-[11.5px] tracking-tight text-foreground/85">
          {url}
        </code>
        <motion.button
          type="button"
          onClick={onCopy}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 380, damping: 22 }}
          className={`squircle inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-tight transition-colors ${
            copied
              ? 'bg-[color-mix(in_srgb,var(--gold-bright)_22%,transparent)] text-gold-deep'
              : 'bg-ink text-cream-pure hover:bg-[var(--ink-raised)]'
          }`}
        >
          <span className="relative flex size-3 items-center justify-center">
            <AnimatePresence mode="wait" initial={false}>
              {copied ? (
                <motion.span
                  key="check"
                  initial={{ scale: 0, rotate: -45, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  exit={{ scale: 0, rotate: 45, opacity: 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 480,
                    damping: 22,
                  }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <Check className="size-3" strokeWidth={2.5} />
                </motion.span>
              ) : (
                <motion.span
                  key="copy"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 480,
                    damping: 22,
                  }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <Copy className="size-3" strokeWidth={2} />
                </motion.span>
              )}
            </AnimatePresence>
          </span>
          {copied ? 'Copiado' : 'Copiar'}
        </motion.button>
        <motion.button
          type="button"
          onClick={onDismiss}
          aria-label="Descartar URL"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="squircle flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-foreground/55 transition-colors hover:bg-foreground/[0.06] hover:text-foreground/85"
        >
          <X className="size-3" strokeWidth={2} />
        </motion.button>
      </div>
    </motion.div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// CheckDrawIcon — checkmark con animación de "draw" al montar
// ════════════════════════════════════════════════════════════════════════════

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
        transition={{ duration: 0.45, ease: [0.65, 0, 0.35, 1] }}
      />
    </motion.svg>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// RevocarButton — inline action para magic_tokens vigentes
// ════════════════════════════════════════════════════════════════════════════

export function RevocarButton({ token_id }: { token_id: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleRevocar = () => {
    if (
      !window.confirm('¿Revocar este token? Esta acción no se puede deshacer.')
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await revocarMagicLink(token_id);
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <motion.button
        type="button"
        onClick={handleRevocar}
        disabled={pending}
        whileHover={pending ? undefined : { y: -1 }}
        whileTap={pending ? undefined : { scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 380, damping: 22 }}
        className="squircle group/revoke inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-foreground/[0.04] px-3 py-1 text-[11px] font-semibold tracking-tight text-foreground/72 ring-1 ring-foreground/[0.10] transition-colors hover:bg-amber-50 hover:text-amber-900 hover:ring-amber-200/70 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="relative flex size-3 items-center justify-center">
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
                <Spinner />
              </motion.span>
            ) : (
              <motion.span
                key="ban"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.15 }}
                whileHover={{ rotate: -12 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <Ban className="size-3" strokeWidth={2} />
              </motion.span>
            )}
          </AnimatePresence>
        </span>
        {pending ? 'Revocando…' : 'Revocar'}
      </motion.button>
      <AnimatePresence>
        {error && (
          <motion.p
            key="err"
            initial={{ opacity: 0, y: -2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.18 }}
            className="text-[10.5px] tracking-tight text-amber-700"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Backwards-compat exports — el detail page anterior importaba estos nombres.
// El nuevo detail importa MagicLinkActionsPanel. Mantenemos los wrappers
// individuales por si algún consumidor externo los necesita.
// ════════════════════════════════════════════════════════════════════════════

export function ReenviarPorCorreoButton({
  institucion_id,
}: {
  institucion_id: string;
}) {
  return <MagicLinkActionsPanel institucion_id={institucion_id} />;
}

export function GenerarUrlButton(_: { institucion_id: string }) {
  // En el nuevo panel ya no se renderiza standalone. Devolvemos null para no
  // duplicar el panel cuando alguien renderiza ambos legacy buttons juntos.
  return null;
}
