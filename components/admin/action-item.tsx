'use client';

// ActionItem — fila priorizada de "needs attention" en el dashboard admin.
// Pattern Pilot.com: en lugar de tabla genérica de actividad reciente, mostrar
// directamente los items que requieren acción del operador.
//
// Visual: count badge gold + título + descripción + chevron derecha. Hover
// trasladea el chevron + colorea a gold (affordance de "click → drill into").
// Stagger on mount via index.

import Link from 'next/link';
import { motion } from 'motion/react';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  /** Conteo grande (badge circular gold). */
  count: number;
  /** Título principal (ej. "Perfiles atascados"). */
  title: string;
  /** Descripción corta debajo del título. */
  description: string;
  /** Destino del link. */
  href: string;
  /** Icon Lucide opcional — reemplaza el count badge si se pasa. */
  icon?: LucideIcon;
  /** Index para stagger animation on mount. */
  index?: number;
  /** Custom children al lado derecho — override del chevron default. */
  rightSlot?: ReactNode;
}

export function ActionItem({
  count,
  title,
  description,
  href,
  icon: Icon,
  index = 0,
  rightSlot,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        type: 'spring',
        stiffness: 380,
        damping: 26,
        delay: index * 0.05,
      }}
    >
      <Link
        href={href}
        className="group/item squircle shadow-card-subtle flex items-center gap-4 rounded-2xl bg-cream-pure p-4 ring-1 ring-foreground/[0.08] transition hover:bg-cream-pure hover:ring-foreground/[0.14]"
      >
        {/* Badge gold con count grande O Icon si se proveyó */}
        {Icon ? (
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-gold-bright/40 text-gold-deep">
            <Icon className="size-4" strokeWidth={1.75} />
          </span>
        ) : (
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-gold-bright/40">
            <span className="font-mono text-[15px] font-semibold tabular-nums text-gold-deep">
              {count}
            </span>
          </span>
        )}

        {/* Cuerpo del item — título + descripción */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium tracking-tight text-foreground">
            {title}
          </p>
          <p className="mt-0.5 truncate text-[12px] tracking-tight text-foreground/55">
            {description}
          </p>
        </div>

        {/* Right slot — chevron default o custom */}
        <div className="shrink-0">
          {rightSlot ?? (
            <ArrowRight
              className="size-4 text-foreground/30 transition group-hover/item:translate-x-0.5 group-hover/item:text-gold-deep"
              strokeWidth={1.5}
            />
          )}
        </div>
      </Link>
    </motion.div>
  );
}
