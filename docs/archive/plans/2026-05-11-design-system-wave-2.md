# Design System Wave 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish del design system — agregar radius semantic, shadow scale, atmosphere variants, e Icon wrapper + tokens. Cementar ADR-004 (Lucide-only). NO refactoring de componentes existentes (per ADR-006). Solo additive token+primitive work.

**Architecture:** Continuación natural de Wave 1. Mismas capas (CSS tokens en `app/design-system/`, TS en `lib/design-system/`, primitives en `components/{landing,entrevista}/`). Sin cambios estructurales.

**Tech Stack:** Next.js 15.5 + React 19.2 + Tailwind v4 + TypeScript strict + Vitest 4.1 + motion@12 + lucide-react. **No new dependencies.**

**Spec ref:** `docs/superpowers/specs/2026-05-10-design-system-tokenization-design.md` section VI Wave 2.

**Branch:** `feat/design-system-wave-2` (off master `a7a13e5`).

**Decisiones del founder (sesión 2026-05-11):**
- Icon library: Lucide-only + size/stroke tokens + `<Icon>` wrapper component (ADR-004 final).
- Atmosphere variants: 3 nuevas (warm, cool, dense).

---

## Pre-flight

- [ ] **Step 0.1: Smoke baseline**

```bash
git status
npm run typecheck
npm run test 2>&1 | tail -5
```

Expected: clean tree on `feat/design-system-wave-2`, typecheck verde, tests 312/312.

---

## Day 1 · Polish tokens + Icon (7 tasks)

### Task 1: Radius semantic tokens

**Files:**
- Modify: `app/design-system/tokens.css` (add semantic radius block at bottom of `:root`)

- [ ] **Step 1.1: Edit `app/design-system/tokens.css` — add at the end of the `:root { ... }` block, just before the closing `}`:**

```css
  /* === Radius semantic ===========================================
   * Naming intent: --radius-sm (inputs, tags pequeños), --radius-md
   * (small cards, buttons cuadrados), --radius-card (card default),
   * --radius-section (manifest section, hero cards), --radius-pill
   * (CTAs, ghost buttons, eyebrow chips). Los literales rounded-[18px],
   * rounded-[28px], rounded-full en primitives se migran a estos
   * tokens en pasos posteriores. */
  --radius-sm:      8px;
  --radius-md:      12px;
  --radius-card:    18px;
  --radius-section: 28px;
  --radius-pill:    9999px;
```

- [ ] **Step 1.2: Verify imports still work**

```bash
npm run typecheck
```

Expected: PASS (CSS-only change, no TS impact).

- [ ] **Step 1.3: Commit**

```bash
git add app/design-system/tokens.css
git commit -m "feat(design-system): radius semantic tokens

5 tokens (--radius-sm 8px, --radius-md 12px, --radius-card 18px,
--radius-section 28px, --radius-pill 9999px). Reemplazan los literales
rounded-[18px], rounded-[28px] y rounded-full en primitives. Migración
de Card primitives en Tasks 7-8."
```

---

### Task 2: Shadow scale tokens

**Files:**
- Modify: `app/design-system/tokens.css` (add semantic shadow block)

- [ ] **Step 2.1: Edit `app/design-system/tokens.css` — add at the end of the `:root { ... }` block, after the radius tokens:**

```css
  /* === Shadow scale ==============================================
   * Inset hairlines + outer glows para CTAs y dialogs. Centralizados
   * para que cuando cambien valores brand (ej. el gold blur radius),
   * se actualizan ambos surfaces a la vez. */
  --shadow-hairline-ink:   inset 0 0 0 1px rgb(244 241 234 / 0.06);
  --shadow-hairline-cream: inset 0 0 0 1px rgb(10 15 28 / 0.06);
  --shadow-gold-seam:      inset 0 1px 0 rgb(200 168 100 / 0.18);
  --shadow-card-ink:       inset 0 0 0 1px rgb(244 241 234 / 0.055), inset 0 1px 0 rgb(200 168 100 / 0.18);
  --shadow-cta-glow:       0 0 0 1px rgb(244 241 234 / 0.04), 0 30px 70px -20px rgb(200 168 100 / 0.45);
  --shadow-cta-glow-cream: 0 0 0 1px rgb(10 15 28 / 0.04), 0 20px 50px -20px rgb(10 15 28 / 0.35);
  --shadow-dialog:         0 30px 90px -20px rgb(0 0 0 / 0.5);
```

- [ ] **Step 2.2: Typecheck + commit**

```bash
npm run typecheck
git add app/design-system/tokens.css
git commit -m "feat(design-system): shadow scale tokens (hairlines + CTA glow + dialog)

7 tokens: --shadow-hairline-ink/cream (1px inset), --shadow-gold-seam
(gold top edge), --shadow-card-ink (composed manifest card), --shadow-
cta-glow (landing CTA primary), --shadow-cta-glow-cream (entrevista
CTA primary inverso), --shadow-dialog. Reemplazan literales inline en
Card y Button primitives en Tasks 7-8."
```

---

### Task 3: Icon size/stroke tokens

**Files:**
- Modify: `app/design-system/tokens.css` (add icon tokens)

- [ ] **Step 3.1: Edit `app/design-system/tokens.css` — add at the end of `:root` block:**

```css
  /* === Icon system ===============================================
   * Lucide-only (ADR-004 final). Tokens de size + stroke para
   * consistency. Wrapper component <Icon> en components/{landing,
   * entrevista}/Icon.tsx enforces estos tokens. */
  --icon-sm:           14px;
  --icon-md:           18px;
  --icon-lg:           24px;
  --icon-xl:           32px;
  --icon-stroke:       2;     /* default strokeWidth */
  --icon-stroke-thin:  1.5;   /* delicate cases */
  --icon-stroke-bold:  2.5;   /* arrows, ChevronRight nav */
```

- [ ] **Step 3.2: Commit**

```bash
git add app/design-system/tokens.css
git commit -m "feat(design-system): icon size + stroke tokens (Lucide-only)

4 sizes (sm 14, md 18, lg 24, xl 32 px) + 3 strokes (default 2,
thin 1.5, bold 2.5). Habilita <Icon> wrapper en Task 4. Cementa
ADR-004: Lucide-only + size discipline."
```

---

### Task 4: Icon wrapper component (landing + entrevista)

**Files:**
- Create: `components/landing/Icon.tsx`
- Create: `components/entrevista/Icon.tsx`

- [ ] **Step 4.1: Create `components/landing/Icon.tsx`**

```tsx
// components/landing/Icon.tsx
//
// Lucide icon wrapper. Enforces size + stroke tokens for consistency.
// Surface ink. Default size=md, stroke=default. For navigation arrows
// que necesitan más weight, pasar stroke='bold'.

import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

type Size = 'sm' | 'md' | 'lg' | 'xl';
type Stroke = 'thin' | 'default' | 'bold';

interface IconProps {
  icon: LucideIcon;
  size?: Size;
  stroke?: Stroke;
  className?: string;
  'aria-hidden'?: boolean;
}

const sizeClass: Record<Size, string> = {
  sm: 'size-[var(--icon-sm)]',
  md: 'size-[var(--icon-md)]',
  lg: 'size-[var(--icon-lg)]',
  xl: 'size-[var(--icon-xl)]',
};

const strokeValue: Record<Stroke, number> = {
  thin:    1.5,
  default: 2,
  bold:    2.5,
};

export function Icon({
  icon: LucideIconComponent,
  size = 'md',
  stroke = 'default',
  className,
  'aria-hidden': ariaHidden = true,
}: IconProps) {
  return (
    <LucideIconComponent
      className={cn(sizeClass[size], className)}
      strokeWidth={strokeValue[stroke]}
      aria-hidden={ariaHidden}
    />
  );
}
```

- [ ] **Step 4.2: Create `components/entrevista/Icon.tsx` (identical structure, surface-agnostic since it's just sizing)**

```tsx
// components/entrevista/Icon.tsx
//
// Mirror del landing Icon — surface-agnostic (solo tamaño + stroke).
// Lo duplicamos por consistencia con ADR-001 "dos sets paralelos".

import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

type Size = 'sm' | 'md' | 'lg' | 'xl';
type Stroke = 'thin' | 'default' | 'bold';

interface IconProps {
  icon: LucideIcon;
  size?: Size;
  stroke?: Stroke;
  className?: string;
  'aria-hidden'?: boolean;
}

const sizeClass: Record<Size, string> = {
  sm: 'size-[var(--icon-sm)]',
  md: 'size-[var(--icon-md)]',
  lg: 'size-[var(--icon-lg)]',
  xl: 'size-[var(--icon-xl)]',
};

const strokeValue: Record<Stroke, number> = {
  thin:    1.5,
  default: 2,
  bold:    2.5,
};

export function Icon({
  icon: LucideIconComponent,
  size = 'md',
  stroke = 'default',
  className,
  'aria-hidden': ariaHidden = true,
}: IconProps) {
  return (
    <LucideIconComponent
      className={cn(sizeClass[size], className)}
      strokeWidth={strokeValue[stroke]}
      aria-hidden={ariaHidden}
    />
  );
}
```

- [ ] **Step 4.3: Typecheck + commit**

```bash
npm run typecheck
git add components/landing/Icon.tsx components/entrevista/Icon.tsx
git commit -m "feat(landing+entrevista): Icon wrapper primitive (Lucide + size/stroke tokens)

2 sets paralelos del Icon wrapper (per ADR-001). API: <Icon
icon={ArrowRight} size='md' stroke='default' />. 4 sizes (sm/md/lg/xl)
+ 3 strokes (thin/default/bold). Enforce tokens del Task 3 — no más
strokeWidth literal en componentes consumidores.

Resuelve ADR-004 (Wave 2): Lucide-only confirmed."
```

---

### Task 5: Atmosphere variants CSS

**Files:**
- Modify: `app/globals.css` (add new atmosphere utility classes)

- [ ] **Step 5.1: Locate existing atmosphere utilities**

```bash
grep -n "atmosphere-radial-gold\|atmosphere-noise" app/globals.css
```

Expected: `.atmosphere-radial-gold` and `.atmosphere-noise` exist (lines ~657-680 approx).

- [ ] **Step 5.2: Add new variants — read the existing utilities first to maintain style**

Read `app/globals.css` around the existing `.atmosphere-*` utilities. Then add NEW utilities IN THE SAME `@layer utilities` block (or just after the existing atmosphere ones):

```css
  /* === Atmosphere variants (Wave 2 2026-05-11) ====================
   * 3 variants de radial gold para diferenciar secciones:
   *   warm: radial más amplio (1100px x 800px), centro hacia derecha
   *         alto. Sensación cálida amber. Hero, manifest panels.
   *   cool: radial más pequeño (700px x 500px) + frosted blue tint
   *         sutil. Sensación "morning brief" frío. Trust/security copy.
   *   dense: noise opacity 2.5% (vs default 1.2%). Texture más
   *          presente. Cards de detalle dentro de paginas largas. */

  .atmosphere-radial-gold-warm {
    background-image: radial-gradient(
      1100px 800px at 78% 12%,
      rgb(200 168 100 / 0.06),
      transparent 65%
    );
  }

  .atmosphere-radial-gold-cool {
    background-image:
      radial-gradient(700px 500px at 90% -8%, rgb(200 168 100 / 0.035), transparent 60%),
      radial-gradient(900px 600px at 0% 110%, rgb(120 140 180 / 0.025), transparent 65%);
  }

  .atmosphere-noise-dense {
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.7'/%3E%3C/svg%3E");
    opacity: 0.025;
    mix-blend-mode: multiply;
  }
```

- [ ] **Step 5.3: Commit**

```bash
git add app/globals.css
git commit -m "feat(design-system): atmosphere variants (warm, cool, dense)

3 nuevas utility classes complementando .atmosphere-radial-gold y
.atmosphere-noise:
- .atmosphere-radial-gold-warm: radial amplio 1100x800 cálido para hero
- .atmosphere-radial-gold-cool: radial 700x500 + blue tint frosted para
  morning brief / trust sections
- .atmosphere-noise-dense: noise 2.5% (vs default 1.2%) para texture
  más presente en cards de detalle

Wrapper component <Atmosphere variant=...> se actualiza en Task 6."
```

---

### Task 6: Update Atmosphere component to expose new variants

**Files:**
- Modify: `components/landing/Atmosphere.tsx`

- [ ] **Step 6.1: Read current `components/landing/Atmosphere.tsx`**

Current variant prop accepts `'radial-gold' | 'noise' | 'both'`.

- [ ] **Step 6.2: Extend the Variant type + render logic**

Replace the file content with:

```tsx
// components/landing/Atmosphere.tsx
//
// Overlay layer para hero/manifest backgrounds. Wraps las utility
// classes .atmosphere-*. Pointer-events disabled, absolutely positioned
// al contenedor padre relative.
//
// Wave 2 (2026-05-11): añade 3 variants nuevas:
//   - radial-gold-warm: radial amplio para hero impacto cálido
//   - radial-gold-cool: radial chico + frosted blue para morning brief
//   - noise-dense: noise 2.5% (vs default 1.2%) para cards detalle

import { cn } from '@/lib/utils';

type Variant =
  | 'radial-gold'
  | 'radial-gold-warm'
  | 'radial-gold-cool'
  | 'noise'
  | 'noise-dense'
  | 'both'
  | 'warm'   // alias: radial-gold-warm + noise
  | 'cool';  // alias: radial-gold-cool + noise

interface AtmosphereProps {
  variant?: Variant;
  className?: string;
}

function radialClassFor(variant: Variant): string | null {
  if (variant === 'radial-gold' || variant === 'both') return 'atmosphere-radial-gold';
  if (variant === 'radial-gold-warm' || variant === 'warm') return 'atmosphere-radial-gold-warm';
  if (variant === 'radial-gold-cool' || variant === 'cool') return 'atmosphere-radial-gold-cool';
  return null;
}

function noiseClassFor(variant: Variant): string | null {
  if (variant === 'noise' || variant === 'both' || variant === 'warm' || variant === 'cool') {
    return 'atmosphere-noise';
  }
  if (variant === 'noise-dense') return 'atmosphere-noise-dense';
  return null;
}

export function Atmosphere({ variant = 'both', className }: AtmosphereProps) {
  const radialClass = radialClassFor(variant);
  const noiseClass = noiseClassFor(variant);
  return (
    <>
      {radialClass && (
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-0',
            radialClass,
            className,
          )}
        />
      )}
      {noiseClass && (
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-0',
            noiseClass,
            className,
          )}
        />
      )}
    </>
  );
}
```

- [ ] **Step 6.3: Typecheck + commit**

```bash
npm run typecheck
git add components/landing/Atmosphere.tsx
git commit -m "feat(landing): Atmosphere variants warm + cool + dense

Extiende variant prop: ahora acepta radial-gold (default Wave 1),
radial-gold-warm, radial-gold-cool, noise, noise-dense, both, warm
(alias warm+noise), cool (alias cool+noise). Backwards compatible —
'both' sigue siendo el default y se renderiza idéntico que antes."
```

---

### Task 7: Refactor Card primitives (landing) a usar shadow + radius tokens

**Files:**
- Modify: `components/landing/Card.tsx`

- [ ] **Step 7.1: Read current `components/landing/Card.tsx`**

Current variantClass has literales:
- `rounded-[18px]` → `rounded-[var(--radius-card)]`
- `rounded-[28px]` → `rounded-[var(--radius-section)]`
- `rounded-[14px]` → `rounded-[var(--radius-md)]` (14px → 12px is the change; 14 not in semantic scale, 12 closest)
- Shadow `inset_0_0_0_1px_rgba(244,241,234,0.055),inset_0_1px_0_rgba(200,168,100,0.18)` → `var(--shadow-card-ink)`
- Shadow `inset_0_0_0_1px_rgba(244,241,234,0.055)` solo → `var(--shadow-hairline-ink)`

**Note**: el `rounded-[14px]` actual del variant `compact` no matchea ningún radius token semántico. La opciones son:
- (a) Cambiar a `rounded-[var(--radius-md)]` = 12px. Visual change: -2px (imperceptible).
- (b) Agregar `--radius-card-compact: 14px` al tokens.css. Más fiel al original.

**Decisión para este task**: opción (a) — alinear con el token. El visual diff de 2px es invisible y la disciplina es buena.

- [ ] **Step 7.2: Rewrite the file**

```tsx
// components/landing/Card.tsx
//
// Card primitive para landing. Variant default = manifest pattern
// (ink-raised bg + gold seam top + radius-section). Atmosphere
// overlays opcionales via prop atmosphere=true.
//
// Wave 2 (2026-05-11): consume --radius-card/section + --shadow-card-ink
// tokens (era literales inline en Wave 1).

import { cn } from '@/lib/utils';
import { Atmosphere } from './Atmosphere';

type Variant = 'default' | 'manifest' | 'compact';

interface CardProps {
  children: React.ReactNode;
  variant?: Variant;
  atmosphere?: boolean;
  className?: string;
  as?: 'div' | 'section' | 'article';
}

const variantClass: Record<Variant, string> = {
  default:
    'relative overflow-hidden rounded-[var(--radius-card)] bg-[var(--ink-raised)] ' +
    'shadow-[var(--shadow-card-ink)] ' +
    'p-[var(--card-padding)]',
  manifest:
    'relative overflow-hidden rounded-[var(--radius-section)] bg-[var(--ink-raised)] ' +
    'shadow-[var(--shadow-card-ink)] ' +
    'px-6 py-14 sm:px-10 sm:py-20 lg:px-14',
  compact:
    'relative overflow-hidden rounded-[var(--radius-md)] bg-[var(--ink-raised)] ' +
    'shadow-[var(--shadow-hairline-ink)] ' +
    'p-6',
};

export function Card({
  children,
  variant = 'default',
  atmosphere = false,
  className,
  as: Tag = 'div',
}: CardProps) {
  return (
    <Tag className={cn(variantClass[variant], className)}>
      {atmosphere && <Atmosphere variant="both" />}
      <div className="relative">{children}</div>
    </Tag>
  );
}
```

- [ ] **Step 7.3: Typecheck + commit**

```bash
npm run typecheck
git add components/landing/Card.tsx
git commit -m "refactor(landing): Card primitive consume radius + shadow tokens

Reemplaza literales rounded-[18px]/[28px]/[14px] con --radius-card/
section/md y los shadows inline con --shadow-card-ink/--shadow-
hairline-ink. Visual change: rounded-[14px] → rounded-[var(--radius-md)]
12px en compact variant (-2px, imperceptible)."
```

---

### Task 8: Refactor Card entrevista a usar tokens

**Files:**
- Modify: `components/entrevista/Card.tsx`

- [ ] **Step 8.1: Read + rewrite `components/entrevista/Card.tsx`**

```tsx
// components/entrevista/Card.tsx
//
// 2 variants principales matcheando los survey surface tokens:
//   surface-1 (default) - navy ink dark pocket. Branding moment dentro
//                         de la encuesta. Espejo del landing dark.
//   surface-2          - white pure. Workspace card (textarea container).
//
// + variant compact para chips/pills internos.
//
// Wave 2 (2026-05-11): consume --radius-card/md tokens.

import { cn } from '@/lib/utils';

type Variant = 'surface-1' | 'surface-2' | 'compact';

interface CardProps {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
  as?: 'div' | 'section' | 'article';
}

const variantClass: Record<Variant, string> = {
  'surface-1':
    'relative overflow-hidden rounded-[var(--radius-card)] bg-[var(--survey-card-1)] text-[var(--survey-card-1-fg)] ' +
    'shadow-[inset_0_0_0_1px_var(--survey-card-1-hairline)] ' +
    'p-[var(--card-padding)]',
  'surface-2':
    'relative overflow-hidden rounded-[var(--radius-card)] bg-[var(--survey-card-2)] text-[var(--survey-text)] ' +
    'shadow-[inset_0_0_0_1px_var(--survey-hairline)] ' +
    'p-[var(--card-padding)]',
  'compact':
    'relative overflow-hidden rounded-[var(--radius-md)] bg-[var(--survey-card-2)] text-[var(--survey-text)] ' +
    'shadow-[inset_0_0_0_1px_var(--survey-hairline)] ' +
    'p-4',
};

export function Card({
  children,
  variant = 'surface-1',
  className,
  as: Tag = 'div',
}: CardProps) {
  return (
    <Tag className={cn(variantClass[variant], className)}>
      <div className="relative">{children}</div>
    </Tag>
  );
}
```

Note: el shadow inset usa survey-specific tokens (`--survey-card-1-hairline`, `--survey-hairline`), no los `--shadow-hairline-*` de Wave 2 porque esos están en ink/cream luminance, no en survey-card luminance. La diferencia es real (`--survey-card-1-hairline: rgb(244 241 234 / 0.10)` ≠ `--shadow-hairline-ink: inset 0 0 0 1px rgb(244 241 234 / 0.06)` por opacity 0.10 vs 0.06).

- [ ] **Step 8.2: Commit**

```bash
npm run typecheck
git add components/entrevista/Card.tsx
git commit -m "refactor(entrevista): Card primitive consume radius tokens

Reemplaza rounded-[18px] y rounded-[12px] literales con --radius-card
y --radius-md. Shadows mantienen --survey-*-hairline tokens (no los
--shadow-hairline-* Wave 2) porque survey-card-1 dark tiene luminance
distinto del ink puro y necesita más opacity (0.10 vs 0.06)."
```

---

## Day 2 · Button + docs + audit (6 tasks)

### Task 9: Refactor Button landing a usar shadow + radius tokens

**Files:**
- Modify: `components/landing/Button.tsx`

- [ ] **Step 9.1: Read + rewrite**

Replace literal `rounded-full` with `rounded-[var(--radius-pill)]` (semantic). Replace the long inline `shadow-[0_0_0_1px_rgba(244,241,234,0.04),0_30px_70px_-20px_rgba(200,168,100,0.45)]` with `shadow-[var(--shadow-cta-glow)]`.

Final file:

```tsx
// components/landing/Button.tsx
//
// 3 variants:
//   primary - pill cream sobre ink + inner icon-pill ink/gold (CTA hero)
//   ghost   - pill border cream/20 → cream/45 hover
//
// Wave 2 (2026-05-11): consume --radius-pill + --shadow-cta-glow tokens.
// Inner icon-pill usa --radius-pill también (era rounded-full literal).

'use client';

import { cn } from '@/lib/utils';
import { ArrowUpRight, type LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost';
type Size = 'default' | 'large';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
}

const sizeClass: Record<Size, string> = {
  default: 'h-12',
  large:   'h-14',
};

export function Button({
  variant = 'primary',
  size = 'default',
  icon: Icon = ArrowUpRight,
  className,
  children,
  ...rest
}: ButtonProps) {
  if (variant === 'primary') {
    return (
      <button
        className={cn(
          'group/cta relative inline-flex items-center gap-3 rounded-[var(--radius-pill)]',
          'bg-cream-pure pl-6 pr-2 text-[13.5px] font-medium text-ink',
          'transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out-expo)]',
          'shadow-[var(--shadow-cta-glow)]',
          'hover:bg-white',
          sizeClass[size],
          className,
        )}
        {...rest}
      >
        <span>{children}</span>
        <span className="inline-flex size-9 items-center justify-center rounded-[var(--radius-pill)] bg-ink text-gold transition-transform duration-[var(--dur-fast)] group-hover/cta:rotate-45">
          <Icon className="size-4" strokeWidth={2} />
        </span>
      </button>
    );
  }

  return (
    <button
      className={cn(
        'group/ghost inline-flex items-center gap-2.5 rounded-[var(--radius-pill)]',
        'border border-cream-pure/20 px-5 text-[13.5px] font-medium text-cream-pure',
        'transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out-expo)]',
        'hover:border-cream-pure/45',
        sizeClass[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 9.2: Commit**

```bash
npm run typecheck
git add components/landing/Button.tsx
git commit -m "refactor(landing): Button consume --radius-pill + --shadow-cta-glow

3 literales reemplazados: rounded-full (3 instances) → rounded-[var(
--radius-pill)] y shadow inline largo → shadow-[var(--shadow-cta-
glow)]. Cero visual change (tokens son byte-equivalent)."
```

---

### Task 10: Refactor Button entrevista

**Files:**
- Modify: `components/entrevista/Button.tsx`

- [ ] **Step 10.1: Read + rewrite con tokens**

```tsx
// components/entrevista/Button.tsx
//
// Inverse de landing Button. primary = pill ink solid sobre cream bg.
// ghost = pill border ink/12 → ink/30 hover.
//
// Wave 2 (2026-05-11): consume --radius-pill + --shadow-cta-glow-cream tokens.

'use client';

import { cn } from '@/lib/utils';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost';
type Size = 'default' | 'large';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
}

const sizeClass: Record<Size, string> = {
  default: 'h-12',
  large:   'h-14',
};

export function Button({
  variant = 'primary',
  size = 'default',
  icon: Icon = ArrowRight,
  className,
  children,
  ...rest
}: ButtonProps) {
  if (variant === 'primary') {
    return (
      <button
        className={cn(
          'group/cta relative inline-flex items-center gap-3 rounded-[var(--radius-pill)]',
          'bg-ink pl-6 pr-2 text-[13.5px] font-medium text-cream-pure',
          'transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out-expo)]',
          'shadow-[var(--shadow-cta-glow-cream)]',
          'hover:bg-[var(--ink-raised)]',
          sizeClass[size],
          className,
        )}
        {...rest}
      >
        <span>{children}</span>
        <span className="inline-flex size-9 items-center justify-center rounded-[var(--radius-pill)] bg-cream-pure text-ink transition-transform duration-[var(--dur-fast)] group-hover/cta:translate-x-0.5">
          <Icon className="size-4" strokeWidth={2} />
        </span>
      </button>
    );
  }

  return (
    <button
      className={cn(
        'group/ghost inline-flex items-center gap-2.5 rounded-[var(--radius-pill)]',
        'border border-[var(--survey-hairline-strong)] px-5 text-[13.5px] font-medium text-[var(--survey-text)]',
        'transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out-expo)]',
        'hover:border-[rgb(10_15_28_/_0.30)]',
        sizeClass[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 10.2: Commit**

```bash
npm run typecheck
git add components/entrevista/Button.tsx
git commit -m "refactor(entrevista): Button consume --radius-pill + --shadow-cta-glow-cream

3 literales reemplazados con tokens. Cero visual change."
```

---

### Task 11: Update docs/design/tokens/* (COLOR, SPACE quedan; agregar RADIUS, SHADOW, ICON)

**Files:**
- Create: `docs/design/tokens/RADIUS.md`
- Create: `docs/design/tokens/SHADOW.md`
- Create: `docs/design/tokens/ICON.md`

- [ ] **Step 11.1: Create `docs/design/tokens/RADIUS.md`**

```markdown
# Radius tokens

Source: `app/design-system/tokens.css` (Wave 2).

## Scale

| Token | Value | Uso |
|---|---|---|
| `--radius-sm` | `8px` | Inputs, tags pequeños, chips internos |
| `--radius-md` | `12px` | Small cards, buttons cuadrados, compact variants |
| `--radius-card` | `18px` | Card default, surface-1/surface-2 entrevista |
| `--radius-section` | `28px` | Manifest section, hero cards prominentes |
| `--radius-pill` | `9999px` | CTAs (primary, ghost), header CTA, chips redondos |

## Reglas

- **NUNCA literales `rounded-[18px]` en componentes nuevos**. Usar `rounded-[var(--radius-card)]`.
- **`rounded-full` es OK pero menos explícito que `rounded-[var(--radius-pill)]`**. Para componentes design-system preferí el token.
- Si un componente necesita un radius custom (ej. `rounded-[42px]` para un asset hero), no inventar token — mantenlo inline con comentario `// hero-specific, no se reusa`.

## API

- `<Card variant="default">` → `--radius-card`
- `<Card variant="manifest">` → `--radius-section`
- `<Card variant="compact">` → `--radius-md`
- `<Button>` → `--radius-pill`
```

- [ ] **Step 11.2: Create `docs/design/tokens/SHADOW.md`**

```markdown
# Shadow tokens

Source: `app/design-system/tokens.css` (Wave 2).

## Hairlines

| Token | Value | Uso |
|---|---|---|
| `--shadow-hairline-ink` | `inset 0 0 0 1px rgb(244 241 234 / 0.06)` | 1px cream hairline sobre ink (landing) |
| `--shadow-hairline-cream` | `inset 0 0 0 1px rgb(10 15 28 / 0.06)` | 1px ink hairline sobre cream (entrevista) |
| `--shadow-gold-seam` | `inset 0 1px 0 rgb(200 168 100 / 0.18)` | Gold seam top edge (manifest cards) |

## Compositions

| Token | Value | Uso |
|---|---|---|
| `--shadow-card-ink` | `inset 0 0 0 1px rgb(244 241 234 / 0.055), inset 0 1px 0 rgb(200 168 100 / 0.18)` | Manifest card (hairline + gold seam) |
| `--shadow-cta-glow` | `0 0 0 1px rgb(244 241 234 / 0.04), 0 30px 70px -20px rgb(200 168 100 / 0.45)` | Landing primary CTA (cream pill on ink, gold glow drop) |
| `--shadow-cta-glow-cream` | `0 0 0 1px rgb(10 15 28 / 0.04), 0 20px 50px -20px rgb(10 15 28 / 0.35)` | Entrevista primary CTA (ink pill on cream, neutral glow) |
| `--shadow-dialog` | `0 30px 90px -20px rgb(0 0 0 / 0.5)` | Modal/dialog elevation |

## Reglas

- **NUNCA literales `shadow-[0_30px_70px...]` en componentes nuevos.**
- Si un shadow no matchea un token, antes de agregarlo discute. Probablemente es over-design.
- Para shadows admin (legacy lime/forest), seguir usando lo que ya está hasta Wave 3 sweep.
```

- [ ] **Step 11.3: Create `docs/design/tokens/ICON.md`**

```markdown
# Icon tokens

Source: `app/design-system/tokens.css` (Wave 2). Wrapper en `components/{landing,entrevista}/Icon.tsx`.

## Library: Lucide-only (ADR-004 final, Wave 2)

Wave 2 cementó la decisión: **Lucide-only** para iconografía. Razones:
- Tree-shakeable + ya está en bundle.
- Strokes consistentes.
- Cubre 99% de los casos.
- Casos brand-y (V mark, success glyph) tienen sus propios SVG inline en `components/landing/`.

Si surge necesidad de icono que Lucide no tenga: (a) elegir el más cercano disponible, (b) si realmente no encaja, discutir antes de agregar otra library.

## Size tokens

| Token | Value |
|---|---|
| `--icon-sm` | `14px` |
| `--icon-md` | `18px` |
| `--icon-lg` | `24px` |
| `--icon-xl` | `32px` |

## Stroke tokens

| Token | Value | Uso |
|---|---|---|
| `--icon-stroke` | `2` | Default — todos los casos normales |
| `--icon-stroke-thin` | `1.5` | Iconos decorativos/delicados |
| `--icon-stroke-bold` | `2.5` | Arrows nav, ChevronRight prominentes |

## API: `<Icon>` wrapper

```tsx
import { Icon } from '@/components/landing/Icon';  // or @/components/entrevista/Icon
import { ArrowRight } from 'lucide-react';

<Icon icon={ArrowRight} size="md" stroke="default" />
<Icon icon={ArrowRight} size="lg" stroke="bold" className="text-gold" />
```

Props:
- `icon`: LucideIcon (required)
- `size`: 'sm' | 'md' | 'lg' | 'xl' (default 'md')
- `stroke`: 'thin' | 'default' | 'bold' (default 'default')
- `className`: para colors o overrides ad-hoc
- `aria-hidden`: default true (cambiar solo si el icono es semánticamente significativo)

## Reglas

- **NUNCA `<ArrowRight strokeWidth={2} className="size-4" />` directo en componentes consumidores**. Usar `<Icon icon={ArrowRight} />`.
- **Excepción**: dentro de los primitivos del design system (Button.tsx ya tiene `<Icon />` inline porque es parte del API del Button). Pero en código que CONSUME Button, usa `<Icon>`.
- Para iconos brand-y custom (VertexMark, BrandSuccessGlyph): NO usar `<Icon>` — esos viven en `components/landing/` como componentes propios con sus SVGs.
```

- [ ] **Step 11.4: Commit**

```bash
git add docs/design/tokens/RADIUS.md docs/design/tokens/SHADOW.md docs/design/tokens/ICON.md
git commit -m "docs(design): radius + shadow + icon token references (Wave 2)

3 docs nuevas (RADIUS, SHADOW, ICON). Cada una con scale, uso, reglas
y API. ICON.md cementa ADR-004 (Lucide-only) y documenta el <Icon>
wrapper."
```

---

### Task 12: Update DECISIONS.md (mark ADR-004 resolved + add ADR-008 radius/shadow philosophy)

**Files:**
- Modify: `docs/design/tokens/DECISIONS.md`

- [ ] **Step 12.1: Edit DECISIONS.md**

Find ADR-004 section and update:

```markdown
## ADR-004: Lucide-only para iconos

**Date**: 2026-05-10 (original) / 2026-05-11 (resolved Wave 2)
**Status**: Active

**Context**: CLAUDE.md sugiere mezclar Lucide + Phosphor + Tabler + Hero + Iconoir según contexto. Wave 1 mantuvo Lucide-only pending revisión.

**Decision (Wave 2 final)**: **Lucide-only confirmado.**
- Tree-shakeable, ya en bundle.
- Strokes consistentes.
- Cubre 99% de los casos.
- Casos brand-y (V mark, success glyph, vertex sigil) tienen sus propios SVG inline.

Wave 2 agrega `<Icon>` wrapper en `components/{landing,entrevista}/Icon.tsx` + tokens `--icon-{sm,md,lg,xl}` y `--icon-stroke{-thin|-bold}` para enforced consistency.

Si surge necesidad de un icono que Lucide no tenga: (a) elegir el más cercano disponible, (b) si realmente no encaja, agregarlo a `components/{landing,entrevista}/*SVG.tsx` inline antes que introducir secondary library.
```

Then add at the end (after ADR-007):

```markdown

---

## ADR-008: Radius + shadow tokens layered, NOT exhaustive

**Date**: 2026-05-11
**Status**: Active

**Context**: Wave 2 introduce 5 radius tokens (--radius-{sm,md,card,section,pill}) y 7 shadow tokens (hairlines + compositions). El instinct natural sería crear todas las permutaciones (--radius-card-compact, --shadow-card-cream-strong, etc).

**Decision**: tokens cubren los **casos canónicos**, no permutaciones especulativas.

**Reasoning**: 
- Token explosion mata el sistema. Mejor 5 radius bien-nombrados que 12 con drift.
- Para casos especiales (ej. hero asset con `rounded-[42px]`), inline + comentario es OK.
- Promote-to-token solo cuando el caso aparece en ≥2 lugares con el mismo valor.

**Aplica también a shadows**. Tenemos `--shadow-cta-glow` y `--shadow-cta-glow-cream` (las 2 surfaces canónicas). NO tenemos `--shadow-cta-glow-warm` ni variantes en cool — eso sería over-engineering.

---

## ADR-009: Atmosphere variants — paleta limitada por intención

**Date**: 2026-05-11
**Status**: Active

**Context**: Wave 2 expande Atmosphere de 1 variant (default `both`) a 5+aliases:
- `radial-gold-warm`: radial amplio 1100x800 amber, sensación cálida
- `radial-gold-cool`: radial 700x500 + frosted blue tint, sensación morning brief frío
- `noise-dense`: noise 2.5% (vs default 1.2%)

**Decision**: 3 variants funcionales nuevas. Aliases (`warm`, `cool`) combinan radial + noise para single-prop simplicity.

**Reasoning**: 
- Diferenciar secciones por mood es valor real (hero vs trust section vs detail card).
- Más de 3 atmospheres confunde — la atmósfera debe ser sutil, no temática.
- Cool variant introduce blue tint sutilmente; si choca con gold se removerá.
```

- [ ] **Step 12.2: Commit**

```bash
git add docs/design/tokens/DECISIONS.md
git commit -m "docs(design): ADR-004 resolved + ADR-008 + ADR-009 (Wave 2 decisions)

ADR-004 marked resolved: Lucide-only confirmed con <Icon> wrapper +
tokens. ADR-008 nuevo: radius/shadow tokens layered no exhaustivos
(canonical cases only, no speculative permutations). ADR-009 nuevo:
atmosphere variants limitados (warm/cool/dense + aliases) por intención
sutil, no temática."
```

---

### Task 13: Update recipes con nuevos primitives + Icon usage

**Files:**
- Modify: `docs/design/recipes/NEW_LANDING_PAGE.md`
- Modify: `docs/design/recipes/NEW_SURVEY_SCREEN.md`

- [ ] **Step 13.1: Update `NEW_LANDING_PAGE.md`**

Add to imports section:
```tsx
import { Icon } from '@/components/landing/Icon';
import { ArrowRight, ShieldCheck } from 'lucide-react';
```

Add to checklist a bullet:
```markdown
- [ ] Iconos usan `<Icon icon={X} size="md|sm|lg|xl" stroke="default|thin|bold" />`. Nunca `<X strokeWidth={...} className="size-4" />` directo.
```

Add a section about Atmosphere variants:
```markdown
## Atmosphere variants (Wave 2)

Atmosphere ahora soporta 3 moods nuevos:
- `<Atmosphere variant="warm" />` — radial gold amplio + noise. Hero impactante, manifest panels.
- `<Atmosphere variant="cool" />` — radial gold compacto + blue tint frosted + noise. Trust sections, morning brief, security copy.
- `<Atmosphere variant="noise-dense" />` — solo noise 2.5%. Cards de detalle dentro de páginas largas.

Wave 1 originales siguen funcionando: `<Atmosphere />` (default = `both` = radial-gold + noise), `<Atmosphere variant="radial-gold" />`, `<Atmosphere variant="noise" />`.
```

- [ ] **Step 13.2: Update `NEW_SURVEY_SCREEN.md`**

Add to imports:
```tsx
import { Icon } from '@/components/entrevista/Icon';
```

Add to checklist:
```markdown
- [ ] Iconos usan `<Icon icon={X} size="md|sm|lg|xl" stroke="default|thin|bold" />`. Nunca strokeWidth/size literal.
```

- [ ] **Step 13.3: Commit**

```bash
git add docs/design/recipes/
git commit -m "docs(design): recipes Wave 2 sync (Icon wrapper + atmosphere variants)

NEW_LANDING_PAGE: añade imports y checklist para <Icon>, sección de
atmosphere variants (warm/cool/dense).
NEW_SURVEY_SCREEN: añade imports y checklist para <Icon> entrevista."
```

---

### Task 14: Update DESIGN_SYSTEM.md con Wave 2 manifesto

**Files:**
- Modify: `docs/design/DESIGN_SYSTEM.md`

- [ ] **Step 14.1: Read existing DESIGN_SYSTEM.md**

Find the "Update 2026-05-10" block at top (added in Wave 1). Update OR add a sibling "Update 2026-05-11 — Wave 2":

```markdown
> **Update 2026-05-11** — Wave 2 mergeado (ver `feat/design-system-wave-2`).
>
> Polish adicional:
> - **Radius tokens**: `--radius-{sm,md,card,section,pill}` (`app/design-system/tokens.css`)
> - **Shadow tokens**: `--shadow-hairline-{ink,cream}`, `--shadow-gold-seam`, `--shadow-card-ink`, `--shadow-cta-glow{-cream}`, `--shadow-dialog`
> - **Icon system**: `--icon-{sm,md,lg,xl}` + `--icon-stroke{-thin|-bold}` + `<Icon>` wrapper en `components/{landing,entrevista}/Icon.tsx`. ADR-004 cementado: Lucide-only.
> - **Atmosphere variants**: warm, cool, dense + aliases `warm`/`cool` combinados.
> - **Primitivos refactorizados** para consumir tokens: `Card` (radius + shadow), `Button` (radius pill + cta-glow), `Atmosphere` (variant prop expanded).
>
> Refs:
> - Token docs: `docs/design/tokens/{RADIUS,SHADOW,ICON}.md` (nuevos)
> - ADRs: ADR-008 (radius/shadow layered no exhaustive), ADR-009 (atmosphere intentional).
>
> Wave 3 (próxima): sweep legacy `--lime`/`--forest` de entrevista (admin sigue intocado).
```

- [ ] **Step 14.2: Commit**

```bash
git add docs/design/DESIGN_SYSTEM.md
git commit -m "docs(design): DESIGN_SYSTEM.md update con Wave 2 manifesto

Bloque update 2026-05-11 documentando: radius tokens, shadow tokens,
icon system + <Icon> wrapper, atmosphere variants. Refs a docs nuevos
y ADRs."
```

---

## Final smoke + PR

### Task 15: Smoke + push + PR

- [ ] **Step 15.1: Smoke test**

```bash
npm run typecheck
npm run test 2>&1 | tail -5
```

Expected: typecheck verde, tests 312/312 (no nuevos tests en Wave 2, son tokens CSS + primitives sin lógica testable en node env).

- [ ] **Step 15.2: Final visual smoke**

```bash
npm run dev
```

Verify in browser:
- `http://localhost:3000` — landing should look identical (only tokens replaced).
- HeaderCTA hover spring feel — preserved.
- `http://localhost:3000/preview/ui` — entrevista same.

If anything visually diff, root-cause before pushing.

- [ ] **Step 15.3: Push + PR**

```bash
git push -u origin feat/design-system-wave-2
gh pr create --title "feat: design system Wave 2 (radius + shadow + icon + atmosphere variants)" --body "$(cat <<'EOF'
## Summary

Wave 2 del design system: polish layer. Tokens semánticos para radius + shadow, sistema de iconos con wrapper, 3 variants nuevas de Atmosphere. Cero refactor de componentes existentes (per ADR-006) — solo tokens additive + primitives consumiendo tokens.

### Tokens añadidos
- **Radius**: `--radius-{sm,md,card,section,pill}` en `app/design-system/tokens.css`
- **Shadow**: `--shadow-hairline-{ink,cream}`, `--shadow-gold-seam`, `--shadow-card-ink`, `--shadow-cta-glow{-cream}`, `--shadow-dialog`
- **Icon**: `--icon-{sm,md,lg,xl}` + `--icon-stroke{-thin|-bold}`

### Primitives nuevos
- `<Icon>` wrapper en `components/landing/Icon.tsx` y `components/entrevista/Icon.tsx`. Enforces size + stroke tokens. ADR-004 cementado: Lucide-only.

### Primitives actualizados
- `Card` (landing + entrevista): consume `--radius-*` y `--shadow-*` tokens.
- `Button` (landing + entrevista): consume `--radius-pill` y `--shadow-cta-glow{-cream}`.
- `Atmosphere`: variant prop expandido — añade `radial-gold-warm`, `radial-gold-cool`, `noise-dense`, y aliases `warm`/`cool`.

### Docs
- 3 docs nuevas: `docs/design/tokens/{RADIUS,SHADOW,ICON}.md`
- 2 ADRs nuevos: ADR-008 (tokens layered no exhaustivos), ADR-009 (atmosphere intentional)
- ADR-004 marcado resolved (Lucide-only confirmed)
- Recipes actualizadas con `<Icon>` y atmosphere variants
- `DESIGN_SYSTEM.md` con Wave 2 manifesto

## Test plan

- [x] `npm run typecheck` verde
- [x] `npm run test` 312/312 pass
- [x] Smoke visual manual: landing + preview/ui idénticos pre/post
- [x] HeaderCTA hover spring preserved
- [x] Tokens reemplazan literales sin visual change (Card compact rounded-[14px] → rounded-[var(--radius-md)] 12px es -2px imperceptible)

## Próximos pasos

- Wave 3: sweep legacy `--lime`/`--forest` de entrevista
- Migración natural: cuando construyas páginas nuevas con `<Icon>`, irás encontrando consumers ad-hoc de Lucide directos — promote según ADR-006

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review (post-plan)

### Spec coverage
- ✅ Radius semantic — Task 1
- ✅ Shadow scale — Task 2
- ✅ Atmosphere variants — Tasks 5, 6
- ✅ Icon library + tokens + wrapper — Tasks 3, 4
- ✅ Visual drift audit — Task 15 (Step 15.2)
- ✅ ADR-004 resolved + ADR-008/009 — Task 12

### Placeholder scan
- Cero "TBD" / "implement later".
- Cada paso con código exacto + comando + commit.

### Type consistency
- `--radius-card` / `--radius-md` / `--radius-pill` usados consistentemente entre tokens.css, Card, Button, RADIUS.md.
- `--shadow-cta-glow` / `--shadow-cta-glow-cream` separados (landing/entrevista) y usados consistently.

### Risks
- Task 7 cambia `rounded-[14px]` → `rounded-[var(--radius-md)]` = 12px. -2px imperceptible pero documentado.
- Task 5 nuevas atmosphere variants introducen blue tint (0.025 opacity) en cool variant — primer uso de color fuera del gold/ink/cream system. Si choca, removible en revisión.
- Task 9-10 cambios a Button: el inner icon-pill cambia de `rounded-full` a `rounded-[var(--radius-pill)]` que es 9999px = mismo resultado. Cero risk.

### Definition of done
- [ ] Branch mergeado a master.
- [ ] Test suite verde (no regression, 312/312).
- [ ] 5 token groups documentados.
- [ ] 2 nuevos primitives (Icon × 2 sets).
- [ ] 6 commits de refactor (Card landing/entrevista, Button landing/entrevista, Atmosphere expand, docs sync).
- [ ] 2 ADRs nuevos + 1 resolved.
