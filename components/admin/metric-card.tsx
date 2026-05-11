'use client';

// MetricCard — primitive del dashboard admin. 3 variants:
// - hero: número display 96-180px (clamp). Para una métrica dominante por
//   zona. Tipografía editorial.
// - default: 40-64px. Para stats secundarios en grid.
// - compact: 24px. Para badges/chips de funnel.
//
// Composición:
//   [eyebrow microcaps mono]
//   [value number, escala según variant]
//   [label texto descriptivo]
//   [delta + sparkline opcional, footer compacto]
//
// Lenguaje visual:
// - Sin drop-shadows externas (consistente con admin-header)
// - Squircle global vía class .squircle
// - Atmosphere radial gold sutil OPCIONAL (`atmosphere` prop)
// - Hover micro-interaction: lift y=-2 + radial-glow pointermove
// - Number ticker animado al mount (useTicker, ease-out-expo 1.4s)
//
// El value puede ser:
// - number → se renderiza con ticker animado
// - string/ReactNode → se renderiza estático (sin animation)

import { motion } from 'motion/react';
import type { ReactNode, MouseEvent } from 'react';

import { useTicker } from './use-ticker';
import { Sparkline } from './sparkline';

type Variant = 'hero' | 'default' | 'compact';
type DeltaDirection = 'up' | 'down' | 'flat';
type ExtrusionPosition =
  | 'bottom-left'
  | 'bottom-right'
  | 'top-left'
  | 'top-right';

interface DeltaProps {
  /** Delta numérico (ej. +3, -1.2). */
  value: number;
  /** Label de contexto (ej. "vs sem. pasada"). */
  label?: string;
  /** Dirección — afecta color e icono. Si se omite, se infiere del signo. */
  direction?: DeltaDirection;
  /** Formatter del valor. Default Math.abs + sign char. */
  format?: (n: number) => string;
}

interface Props {
  /** Eyebrow microcaps arriba del valor. */
  eyebrow?: string;
  /** Valor principal. Number → ticker animado. String/ReactNode → estático. */
  value: number | string | ReactNode;
  /** Label descriptiva debajo del valor (ej. "perfiles generados"). */
  label?: string;
  /** Hint opcional al lado derecho o debajo según variant. */
  hint?: ReactNode;
  /** Variant controla la escala tipográfica. */
  variant?: Variant;
  /** Sparkline opcional debajo del valor. */
  sparkline?: readonly number[];
  /** Delta indicator opcional. */
  delta?: DeltaProps;
  /** Aplica atmosphere radial gold sutil al card. */
  atmosphere?: boolean;
  /** Si onClick está presente, el card es interactivo (hover + tap states). */
  onClick?: (e: MouseEvent<HTMLDivElement>) => void;
  /** Formatter custom para el ticker (si value es number). Default integer. */
  formatValue?: (n: number) => string;
  /**
   * Modo orgánico — aplica solo a variants 'hero' y 'compact'. Renderiza la
   * card con silueta de main rectangle + single rounded-full extrusión,
   * fusionados vía SVG goo filter (#admin-hero-organic). Mismo patrón que
   * navbar admin-header.
   *
   * - `true` → default position 'bottom-left' (mirror del navbar)
   * - `ExtrusionPosition` → posición específica (bottom-left, bottom-right,
   *   top-left, top-right). Útil para variedad visual en grids de cards.
   * - `false`/undefined → modo rectangular normal.
   */
  organic?: boolean | ExtrusionPosition;
  className?: string;
}

// Organic layout config — wrapper padding, main shape offset, extrusion
// position per variant + position combo. Classes are static (Tailwind
// content scanner safe — no interpolation).
function getOrganicConfig(
  variant: 'hero' | 'compact',
  position: ExtrusionPosition
) {
  const isTop = position.startsWith('top');
  const isLeft = position.endsWith('left');

  const extrusionVertical = isTop ? 'top-0' : 'bottom-0';
  const extrusionHorizontal = isLeft ? 'left-0' : 'right-0';

  if (variant === 'hero') {
    return {
      wrapperPadding: isTop
        ? 'pt-20 pb-8 px-8 md:pt-24 md:pb-12 md:px-12'
        : 'pt-8 pb-20 px-8 md:pt-12 md:pb-24 md:px-12',
      mainShapeOffset: isTop ? 'top-12 bottom-0' : 'top-0 bottom-12',
      extrusionVertical,
      extrusionHorizontal,
      extrusionSize: 'h-20 w-1/3',
    };
  }

  // compact: main shape clearance 24px, extrusion h-12 (48px), w-1/2 (50%)
  return {
    wrapperPadding: isTop
      ? 'pt-12 pb-4 px-5 md:pt-14 md:pb-5 md:px-6'
      : 'pt-4 pb-12 px-5 md:pt-5 md:pb-14 md:px-6',
    mainShapeOffset: isTop ? 'top-6 bottom-0' : 'top-0 bottom-6',
    extrusionVertical,
    extrusionHorizontal,
    extrusionSize: 'h-12 w-1/2',
  };
}

const VALUE_CLASS: Record<Variant, string> = {
  hero: 'text-[clamp(72px,10vw,156px)] font-semibold tracking-[-0.045em] leading-none tabular-nums',
  default:
    'text-[clamp(36px,4.5vw,56px)] font-semibold tracking-[-0.03em] leading-none tabular-nums',
  compact:
    'text-2xl font-semibold tracking-tight leading-none tabular-nums',
};

const VALUE_COLOR_CLASS: Record<Variant, string> = {
  hero: 'text-gold-deep',
  default: 'text-foreground',
  compact: 'text-foreground',
};

const PADDING_CLASS: Record<Variant, string> = {
  hero: 'p-8 md:p-12',
  default: 'p-6 md:p-7',
  compact: 'p-4 md:p-5',
};

function TickerValue({
  value,
  format,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  className: string;
}) {
  const text = useTicker(value, { format });
  return <motion.span className={className}>{text}</motion.span>;
}

function Delta({ delta }: { delta: DeltaProps }) {
  const direction =
    delta.direction ??
    (delta.value > 0 ? 'up' : delta.value < 0 ? 'down' : 'flat');
  const format =
    delta.format ??
    ((n: number) => {
      const abs = Math.abs(n);
      const sign = n > 0 ? '+' : n < 0 ? '−' : '';
      return `${sign}${abs}`;
    });
  const arrow =
    direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→';
  const color =
    direction === 'up'
      ? 'text-foreground/72'
      : direction === 'down'
        ? 'text-foreground/72'
        : 'text-foreground/55';
  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-[11.5px] tracking-tight ${color}`}
    >
      <span aria-hidden>{arrow}</span>
      <span>{format(delta.value)}</span>
      {delta.label && (
        <span className="text-foreground/45">· {delta.label}</span>
      )}
    </span>
  );
}

export function MetricCard({
  eyebrow,
  value,
  label,
  hint,
  variant = 'default',
  sparkline,
  delta,
  atmosphere = false,
  onClick,
  formatValue,
  organic = false,
  className = '',
}: Props) {
  const interactive = typeof onClick === 'function';
  const isHero = variant === 'hero';

  // Parse organic prop: true → default 'bottom-left', string → use it, else null.
  const organicPosition: ExtrusionPosition | null =
    organic === true
      ? 'bottom-left'
      : typeof organic === 'string'
        ? organic
        : null;
  // Solo aplica organic mode si hay position válida Y variant es hero/compact.
  const supportsOrganic = variant === 'hero' || variant === 'compact';
  const isOrganic = supportsOrganic && organicPosition !== null;
  const organicConfig =
    isOrganic && organicPosition !== null
      ? getOrganicConfig(variant as 'hero' | 'compact', organicPosition)
      : null;

  // Pointer-tracking radial glow on hover (zero React re-render, via CSS vars).
  const handlePointerMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`);
  };

  const valueClassName = `${VALUE_CLASS[variant]} ${VALUE_COLOR_CLASS[variant]}`;

  const renderedValue =
    typeof value === 'number' ? (
      <TickerValue
        value={value}
        format={formatValue}
        className={valueClassName}
      />
    ) : (
      <span className={valueClassName}>{value}</span>
    );

  // Organic mode: mismo patrón que el navbar admin-header — main rectangle
  // + single extrusión rounded-full fusionados vía SVG goo filter. Padding
  // dinámico según position de la extrusión (top vs bottom afecta pt/pb).
  // Rectangular: wrapper directo con rounded/bg/ring.
  const wrapperClass = organicConfig
    ? `relative isolate ${organicConfig.wrapperPadding} ${
        interactive ? 'cursor-pointer' : ''
      } ${className}`
    : `squircle relative isolate overflow-hidden rounded-[28px] bg-cream-pure ring-1 ring-foreground/[0.04] ${
        PADDING_CLASS[variant]
      } ${
        interactive
          ? 'cursor-pointer transition-shadow hover:ring-foreground/[0.08]'
          : ''
      } ${className}`;

  return (
    <motion.div
      onClick={onClick}
      onPointerMove={handlePointerMove}
      whileHover={interactive ? { y: -2 } : undefined}
      whileTap={interactive ? { scale: 0.99 } : undefined}
      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      className={wrapperClass}
      style={
        {
          // Pointer-tracked glow via CSS var
          '--mx': '50%',
          '--my': '50%',
        } as React.CSSProperties
      }
    >
      {/* ═══ ORGANIC SHAPE LAYER — mismo patrón que admin-header ═══════════
          Main rectangle + single rounded-full extrusión flush-aligned con
          un edge, fusionados vía SVG goo filter (stdDeviation=8). Position
          de la extrusión configurable: bottom-left, bottom-right, top-left
          o top-right. Hero usa h-20/w-1/3; compact h-12/w-1/2.
          ═══════════════════════════════════════════════════════════════════ */}
      {organicConfig && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            // Stack de 2 capas con bias fuerte al bottom — drop-shadow es
            // omnidireccional alrededor de la silueta goo, pero offsets
            // y-positive grandes vs blur pequeños empujan la presencia
            // hacia abajo del card.
            // · Layer 1 (0 1px 0 @ 6%): hairline sin blur. Renderiza como
            //   una línea fina exactamente 1px bajo la silueta goo,
            //   visualmente equivalente a un border-bottom hairline que
            //   sigue la curva orgánica. Esto es el "border like the
            //   bottom" — ancla el card al survey-bg.
            // · Layer 2 (0 4px 10px @ 2.5%): faint ambient. Apenas
            //   perceptible — apenas suficiente para insinuar profundidad
            //   sin halo.
            filter:
              'drop-shadow(0 1px 0 rgb(10 15 28 / 0.06)) drop-shadow(0 4px 10px rgb(10 15 28 / 0.025))',
          }}
        >
          {/* Inner wrapper con goo filter — fusiona main + extrusión */}
          <div
            className="absolute inset-0"
            style={{ filter: 'url(#admin-hero-organic)' }}
          >
            {/* Main rectangle — main shape offset según position de la
                extrusión (top-X o bottom-X clearance). */}
            <div
              className={`squircle absolute inset-x-0 ${organicConfig.mainShapeOffset} rounded-[28px] bg-cream-pure`}
            />
            {/* Single extrusión — flush con un edge del main rect según
                position. Compartir edge garantiza fusión sin gap. */}
            <div
              className={`absolute ${organicConfig.extrusionVertical} ${organicConfig.extrusionHorizontal} ${organicConfig.extrusionSize} rounded-full bg-cream-pure`}
            />
          </div>
          {/* Atmosphere clipped al main rect (no leak fuera de la silueta) */}
          {atmosphere && (
            <div
              className={`absolute inset-x-0 ${organicConfig.mainShapeOffset} overflow-hidden rounded-[28px]`}
            >
              <div
                aria-hidden
                className="atmosphere-radial-gold-warm absolute inset-0"
              />
            </div>
          )}
        </div>
      )}

      {/* Atmosphere para modo rectangular — radial gold sutil top-right.
          En modo organic vive dentro del main blob shape para clipear bien. */}
      {!isOrganic && atmosphere && (
        <div
          aria-hidden
          className="atmosphere-radial-gold-warm pointer-events-none absolute inset-0 -z-10"
        />
      )}

      {/* Pointer glow — only on interactive cards. Pseudo-radial-gradient
          tracked by --mx/--my CSS vars. Invisible until hover. */}
      {interactive && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 hover:opacity-100"
          style={{
            background:
              'radial-gradient(280px circle at var(--mx) var(--my), rgb(200 168 100 / 0.08), transparent 60%)',
          }}
        />
      )}

      {/* Layout: hero usa 2-col asymmetric (value izq, hint der); default y
          compact stack vertical. */}
      {isHero ? (
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between md:gap-12">
          <div className="flex flex-col gap-3">
            {eyebrow && (
              <span className="text-eyebrow text-gold-deep">{eyebrow}</span>
            )}
            <div className="flex flex-col gap-2">
              {renderedValue}
              {label && (
                <span className="text-[clamp(15px,1.5vw,18px)] font-medium tracking-tight text-foreground/72">
                  {label}
                </span>
              )}
            </div>
            {(delta || sparkline) && (
              <div className="mt-1 flex items-center gap-4">
                {delta && <Delta delta={delta} />}
                {sparkline && (
                  <Sparkline
                    data={sparkline}
                    width={120}
                    height={28}
                    color="var(--gold-deep)"
                  />
                )}
              </div>
            )}
          </div>
          {hint && <div className="shrink-0">{hint}</div>}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {eyebrow && (
            <span className="text-eyebrow text-foreground/55">{eyebrow}</span>
          )}
          <div className="flex flex-col gap-1.5">
            {renderedValue}
            {label && (
              <span className="text-sm font-medium tracking-tight text-foreground/72">
                {label}
              </span>
            )}
          </div>
          {(delta || sparkline || hint) && (
            <div className="mt-2 flex items-center justify-between gap-3">
              {delta && <Delta delta={delta} />}
              {sparkline && (
                <Sparkline
                  data={sparkline}
                  width={80}
                  height={24}
                  color="var(--gold-deep)"
                />
              )}
              {hint && !delta && !sparkline && (
                <span className="font-mono text-[11.5px] text-foreground/55">
                  {hint}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
