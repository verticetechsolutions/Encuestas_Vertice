'use client';

// InstitucionAdminActions — barra de acciones administrativas para una
// institución: editar (modal con form pre-poblado) + eliminar (con
// confirmación + protección FK).
//
// Vive en el detail page (`/admin/instituciones/[id]`) — más seguro que
// surfacing desde el listado, donde un click accidental podría borrar.
//
// Lenguaje visual:
//  - Pill "Editar" en cream-pure ring foreground (action secundaria)
//  - Pill "Eliminar" en cream-pure con tinte amber + ring amber (destructiva,
//    pero sin gritar — match con la paleta editorial. Solo se intensifica al
//    confirmar)
//  - Mismos motion specs que magic-link-actions: spring 380/22, y -1 hover,
//    scale 0.97 tap
//
// Edit modal: replica el dual-pane del modal de Nueva institución pero más
// liviano — sólo el form (sin el panel derecho "Cómo funciona"). Submit
// vuelve a la página con datos refrescados (revalidatePath).
//
// Delete dialog: si hay sesiones/magic_tokens asociados, el server devuelve
// conteos y un mensaje accionable. UI los expone para que el admin sepa
// qué limpiar primero.

import {
  useActionState,
  useState,
  useTransition,
} from 'react';
import { motion, AnimatePresence, type Variants } from 'motion/react';
import { useRouter } from 'next/navigation';
import {
  Pencil,
  Trash2,
  X,
  Check,
  AlertCircle,
  Loader2,
  Building2,
  Mail,
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
  editarInstitucion,
  eliminarInstitucion,
  type EditarInstitucionState,
} from '@/app/actions/adminInstituciones';
import { formatPhoneMX, formatPhoneInput } from '@/lib/utils/format-phone';

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

export interface InstitucionForActions {
  id: string;
  razon_social: string;
  nombre_comercial: string | null;
  tipo: string;
  email_contacto: string;
  telefono_contacto: string | null;
}

interface Props {
  institucion: InstitucionForActions;
}

export function InstitucionAdminActions({ institucion }: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <motion.button
        type="button"
        onClick={() => setEditOpen(true)}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 380, damping: 22 }}
        className="squircle group/edit inline-flex cursor-pointer items-center gap-2 rounded-full bg-cream-pure px-4 py-2 text-[13px] font-semibold tracking-tight text-foreground ring-1 ring-foreground/[0.10] shadow-card-subtle transition-shadow hover:ring-foreground/[0.18]"
      >
        <Pencil className="size-4" strokeWidth={1.75} />
        Editar
      </motion.button>

      <motion.button
        type="button"
        onClick={() => setDeleteOpen(true)}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 380, damping: 22 }}
        className="squircle group/del inline-flex cursor-pointer items-center gap-2 rounded-full bg-cream-pure px-4 py-2 text-[13px] font-semibold tracking-tight text-foreground/72 ring-1 ring-foreground/[0.10] shadow-card-subtle transition-colors hover:bg-amber-50 hover:text-amber-900 hover:ring-amber-200/70"
      >
        <Trash2 className="size-4" strokeWidth={1.75} />
        Eliminar
      </motion.button>

      <EditarInstitucionModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        institucion={institucion}
      />
      <EliminarInstitucionDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        institucion={institucion}
      />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// EditarInstitucionModal
// ════════════════════════════════════════════════════════════════════════════

function EditarInstitucionModal({
  open,
  onClose,
  institucion,
}: {
  open: boolean;
  onClose: () => void;
  institucion: InstitucionForActions;
}) {
  return (
    <AnimatePresence>
      {open && (
        <EditarInstitucionModalContent
          key={`editar-${institucion.id}`}
          institucion={institucion}
          onClose={onClose}
        />
      )}
    </AnimatePresence>
  );
}

const INITIAL_EDIT_STATE: EditarInstitucionState = { ok: null };

function EditarInstitucionModalContent({
  institucion,
  onClose,
}: {
  institucion: InstitucionForActions;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    editarInstitucion.bind(null, institucion.id),
    INITIAL_EDIT_STATE
  );

  const error = state.ok === false ? state.error : null;
  const success = state.ok === true;

  return (
    <div className="fixed inset-0 z-[100]">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="absolute inset-0 bg-ink/45 backdrop-blur-[6px]"
      />
      <div className="relative flex h-full items-center justify-center overflow-y-auto p-4 md:p-6">
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Editar institución"
          initial={{ scale: 0.94, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 6 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30, mass: 0.6 }}
          className="squircle relative w-full max-w-xl rounded-3xl bg-cream-pure p-8 shadow-card-elevated ring-1 ring-foreground/[0.05] md:p-10"
        >
          <motion.button
            type="button"
            onClick={onClose}
            whileHover={{ rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
            className="squircle absolute right-5 top-5 inline-flex size-9 cursor-pointer items-center justify-center rounded-full text-foreground/55 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
          >
            <X className="size-4" strokeWidth={2} />
          </motion.button>

          <span className="text-eyebrow text-gold-deep">Editar</span>
          <h2 className="mt-2 text-[22px] font-semibold tracking-tight text-foreground">
            {institucion.razon_social}
          </h2>
          <p className="mt-2 text-[13px] tracking-tight text-foreground/55">
            Modifica los campos que necesites. Solo se actualizan los que
            cambies.
          </p>

          <form action={formAction} className="mt-7 flex flex-col gap-5">
            <EditField
              name="razon_social"
              label="Razón social"
              defaultValue={institucion.razon_social}
              icon={<Building2 className="size-4" strokeWidth={1.75} />}
              required
            />
            <EditField
              name="nombre_comercial"
              label="Nombre comercial"
              hint="opcional"
              defaultValue={institucion.nombre_comercial ?? ''}
            />

            <div className="flex flex-col gap-2">
              <label className="text-eyebrow text-foreground/55">Tipo</label>
              <Select name="tipo" defaultValue={institucion.tipo}>
                <SelectTrigger className="squircle h-11 w-full rounded-full bg-cream-pure ring-1 ring-foreground/[0.10] hover:ring-foreground/[0.18]">
                  <SelectValue />
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

            <EditField
              name="email_contacto"
              label="Email de contacto"
              type="email"
              defaultValue={institucion.email_contacto}
              icon={<Mail className="size-4" strokeWidth={1.75} />}
              required
            />
            <EditField
              name="telefono_contacto"
              label="Teléfono de contacto"
              type="tel"
              hint="opcional"
              defaultValue={formatPhoneMX(institucion.telefono_contacto ?? '')}
              placeholder="52 33 2654 0178"
              icon={<Phone className="size-4" strokeWidth={1.75} />}
              onInput={formatPhoneInput}
              inputMode="tel"
              autoComplete="tel"
            />

            <AnimatePresence>
              {error && (
                <motion.div
                  key={`err-${error}`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div className="squircle flex items-start gap-2.5 rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200/70">
                    <AlertCircle
                      className="mt-0.5 size-4 shrink-0 text-amber-700"
                      strokeWidth={2}
                    />
                    <p className="text-[13px] tracking-tight text-amber-900">
                      {error}
                    </p>
                  </div>
                </motion.div>
              )}
              {success && (
                <motion.div
                  key="ok"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div className="squircle flex items-start gap-2.5 rounded-2xl bg-[color-mix(in_srgb,var(--gold-bright)_14%,transparent)] px-4 py-3 ring-1 ring-[color-mix(in_srgb,var(--gold-bright)_30%,transparent)]">
                    <Check
                      className="mt-0.5 size-4 shrink-0 text-gold-deep"
                      strokeWidth={2.5}
                    />
                    <p className="text-[13px] tracking-tight text-gold-deep">
                      Cambios guardados. Cierra para verlos.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              type="submit"
              disabled={pending}
              whileHover={pending ? undefined : { y: -1 }}
              whileTap={pending ? undefined : { scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
              className="squircle mt-2 inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-ink px-5 text-[13px] font-semibold tracking-tight text-cream-pure shadow-card-subtle ring-1 ring-ink transition-colors hover:bg-[var(--ink-raised)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                <>
                  <Check className="size-4" strokeWidth={2} />
                  Guardar cambios
                </>
              )}
            </motion.button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}

const fieldEnterVariants: Variants = {
  hidden: { opacity: 0, y: 4 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};

function EditField({
  name,
  label,
  hint,
  type = 'text',
  defaultValue = '',
  icon,
  required = false,
  onInput,
  inputMode,
  autoComplete,
  placeholder,
}: {
  name: string;
  label: string;
  hint?: string;
  type?: string;
  defaultValue?: string;
  icon?: React.ReactNode;
  required?: boolean;
  onInput?: React.FormEventHandler<HTMLInputElement>;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <motion.div
      variants={fieldEnterVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col gap-2"
    >
      <div className="flex items-baseline justify-between">
        <label
          htmlFor={`edit-${name}`}
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
      <div className="squircle flex items-center gap-2.5 rounded-full bg-cream-pure px-4 py-2.5 ring-1 ring-foreground/[0.10] focus-within:ring-foreground/30 hover:ring-foreground/[0.18]">
        {icon && <span className="shrink-0 text-foreground/45">{icon}</span>}
        <input
          id={`edit-${name}`}
          name={name}
          type={type}
          defaultValue={defaultValue}
          required={required}
          onInput={onInput}
          inputMode={inputMode}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-[14px] tracking-tight text-foreground placeholder:text-foreground/40 focus:outline-none"
        />
      </div>
    </motion.div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// EliminarInstitucionDialog
// ════════════════════════════════════════════════════════════════════════════

function EliminarInstitucionDialog({
  open,
  onClose,
  institucion,
}: {
  open: boolean;
  onClose: () => void;
  institucion: InstitucionForActions;
}) {
  return (
    <AnimatePresence>
      {open && (
        <EliminarInstitucionDialogContent
          key={`del-${institucion.id}`}
          institucion={institucion}
          onClose={onClose}
        />
      )}
    </AnimatePresence>
  );
}

function EliminarInstitucionDialogContent({
  institucion,
  onClose,
}: {
  institucion: InstitucionForActions;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [refsInfo, setRefsInfo] = useState<{
    sesiones: number;
    tokens: number;
  } | null>(null);

  const handleConfirm = () => {
    setError(null);
    setRefsInfo(null);
    startTransition(async () => {
      const result = await eliminarInstitucion(institucion.id);
      if (result.ok) {
        router.push('/admin/instituciones');
        return;
      }
      setError(result.error);
      if (result.sesiones_count !== undefined || result.magic_tokens_count !== undefined) {
        setRefsInfo({
          sesiones: result.sesiones_count ?? 0,
          tokens: result.magic_tokens_count ?? 0,
        });
      }
    });
  };

  return (
    <div className="fixed inset-0 z-[100]">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={pending ? undefined : onClose}
        className="absolute inset-0 bg-ink/45 backdrop-blur-[6px]"
      />
      <div className="relative flex h-full items-center justify-center overflow-y-auto p-4 md:p-6">
        <motion.div
          role="alertdialog"
          aria-modal="true"
          aria-label="Confirmar eliminación"
          initial={{ scale: 0.94, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 6 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30, mass: 0.6 }}
          className="squircle relative w-full max-w-md rounded-3xl bg-cream-pure p-7 shadow-card-elevated ring-1 ring-foreground/[0.05]"
        >
          <div className="flex items-start gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <AlertCircle className="size-5" strokeWidth={2} />
            </span>
            <div className="flex-1">
              <h2 className="text-[17px] font-semibold tracking-tight text-foreground">
                Eliminar institución
              </h2>
              <p className="mt-1 text-[13px] tracking-tight text-foreground/65">
                Esta acción no se puede deshacer. Se borrará{' '}
                <span className="font-semibold text-foreground">
                  {institucion.razon_social}
                </span>{' '}
                del catálogo.
              </p>
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                key="err"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22 }}
                style={{ overflow: 'hidden' }}
              >
                <div className="mt-5 squircle rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200/70">
                  <p className="text-[13px] tracking-tight text-amber-900">
                    {error}
                  </p>
                  {refsInfo && (refsInfo.sesiones > 0 || refsInfo.tokens > 0) && (
                    <ul className="mt-2 flex flex-col gap-1 text-[12px] tracking-tight text-amber-900/85">
                      {refsInfo.sesiones > 0 && (
                        <li>
                          • {refsInfo.sesiones}{' '}
                          {refsInfo.sesiones === 1 ? 'sesión' : 'sesiones'}{' '}
                          asociadas
                        </li>
                      )}
                      {refsInfo.tokens > 0 && (
                        <li>
                          • {refsInfo.tokens} magic{' '}
                          {refsInfo.tokens === 1 ? 'link' : 'links'} asociados
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-6 flex items-center justify-end gap-2">
            <motion.button
              type="button"
              onClick={onClose}
              disabled={pending}
              whileHover={pending ? undefined : { y: -1 }}
              whileTap={pending ? undefined : { scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
              className="squircle inline-flex h-10 cursor-pointer items-center justify-center rounded-full bg-cream-pure px-4 text-[13px] font-medium tracking-tight text-foreground/72 ring-1 ring-foreground/[0.10] transition-colors hover:bg-cream-pure hover:ring-foreground/[0.18] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancelar
            </motion.button>
            <motion.button
              type="button"
              onClick={handleConfirm}
              disabled={pending}
              whileHover={pending ? undefined : { y: -1 }}
              whileTap={pending ? undefined : { scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
              className="squircle inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-full bg-amber-700 px-4 text-[13px] font-semibold tracking-tight text-cream-pure ring-1 ring-amber-700 shadow-card-subtle transition-colors hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Eliminando…
                </>
              ) : (
                <>
                  <Trash2 className="size-4" strokeWidth={2} />
                  Eliminar definitivamente
                </>
              )}
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
