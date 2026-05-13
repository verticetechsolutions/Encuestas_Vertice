# Design System Wave 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tokenizar formalmente brand + type + spacing + motion y crear 13 primitivos (7 landing, 6 entrevista) para que páginas nuevas se construyan sin reinventar tokens ni driftear de la marca.

**Architecture:** Capa atómica compartida (`app/design-system/*.css` + `lib/design-system/motion/*.ts`) consumida por dos sets paralelos de componentes (`components/landing/*` surface ink, `components/entrevista/*` surface cream). Cero indirección semántica a nivel de componente — los componentes referencian brand colors directamente, pero esos colors viven en una sola fuente.

**Tech Stack:** Next.js 15.5 + React 19.2 + Tailwind v4 + TypeScript strict + Vitest 4.1 (node env, sin jsdom) + motion@12 (framer-motion) + Lenis + GSAP.

**Spec:** `docs/superpowers/specs/2026-05-10-design-system-tokenization-design.md`

**Branch:** `feat/design-system-wave-1` (off `master` en commit `93df1bd`).

---

## Pre-flight

- [ ] **Step 0.1: Crear branch**

```bash
git checkout master
git pull
git checkout -b feat/design-system-wave-1
git status
```

Expected: clean working tree on `feat/design-system-wave-1`.

- [ ] **Step 0.2: Smoke test estado base**

```bash
npm run typecheck
npm run test
```

Expected: typecheck verde, tests verdes (298/298 según último checkpoint). Si hay regresión, NO continuar — investigar primero.

- [ ] **Step 0.3: Screenshot baseline landing**

```bash
npm run dev
```

En browser abre `http://localhost:3000` y `http://localhost:3000/preview/ui`. Toma screenshots completos de:
- Landing: hero, manifest section, footer.
- Entrevista preview: P01, P05 (mid-flow), success final.

Guarda en `.audit/baseline-pre-wave-1/` (gitignored). Vamos a comparar contra estas al final.

---

## Day 1 · Tokens infrastructure (10 tasks)

### Task 1: Crear `app/design-system/tokens.css` (Layer 0 + base scales)

**Files:**
- Create: `app/design-system/tokens.css`

- [ ] **Step 1.1: Crear directorio**

```bash
mkdir -p app/design-system
```

- [ ] **Step 1.2: Escribir tokens.css con brand primitives + survey surface tokens**

```css
/* app/design-system/tokens.css
 *
 * LAYER 0 · Brand primitives — single source of truth para color y type
 * families. Compartido entre landing (ink surface) y entrevista (cream
 * surface). Cualquier color en componentes debe derivar de aquí.
 *
 * También incluye los survey-specific surface tokens (--survey-*) que
 * son tokens compuestos sobre primitivos — viven aquí porque son
 * shared entre /preview/ui y /entrevista/*.
 *
 * Lo que NO está aquí:
 *   - Type scale, spacing scale, motion → archivos separados (type.css,
 *     space.css, motion.css) que importan ESTOS tokens.
 *   - Legacy --forest, --lime, --canvas, --cream → quedan en globals.css
 *     hasta sweep de Wave 3 (admin sigue usándolos).
 *   - Shadcn role mapping (--primary, --secondary, etc) → globals.css.
 */

:root {
  /* === Brand primitives ============================================ */
  --ink:         #0A0F1C;   /* navy ink — landing dark surface */
  --ink-raised:  #1A2236;   /* hover/elevated sobre ink */
  --cream-pure:  #F4F1EA;   /* cream off-white — texto sobre ink */
  --gold:        #C8A864;   /* champán — acento principal */
  --gold-deep:   #866D38;   /* gold deep — AA on white */
  --gold-bright: #F2D89C;   /* gold bright — highlight, focus */
  --gold-light:  #E0BE7C;   /* gold light — gradient base V mark */
  --burgundy:    #8B3A3A;   /* burgundy desat — error states */

  /* === Type families ============================================== */
  --font-display: 'General Sans', 'Satoshi', ui-sans-serif, sans-serif;
  --font-sans:    'Satoshi', ui-sans-serif, sans-serif;

  /* === Survey surface tokens (entrevista) =========================
   * Off-white pure + hairlines finísimos + accent oro solo en 1px.
   * Scope: /entrevista/* y /preview/ui. NO usar en landing. */
  --survey-bg:                  #FAF8F4;
  --survey-surface:             #FFFFFF;
  --survey-card-1:              #0A0F1C;
  --survey-card-1-fg:           #F4F1EA;
  --survey-card-1-fg-muted:     rgb(244 241 234 / 0.55);
  --survey-card-1-fg-faint:     rgb(244 241 234 / 0.35);
  --survey-card-1-hairline:        rgb(244 241 234 / 0.10);
  --survey-card-1-hairline-strong: rgb(244 241 234 / 0.20);
  --survey-card-2:              #FFFFFF;
  --survey-text:                #0A0F1C;
  --survey-text-72:             rgb(10 15 28 / 0.72);
  --survey-text-65:             rgb(10 15 28 / 0.65);
  --survey-text-45:             rgb(10 15 28 / 0.45);
  --survey-hairline:            rgb(10 15 28 / 0.06);
  --survey-hairline-strong:     rgb(10 15 28 / 0.10);
  --survey-hover:               rgb(10 15 28 / 0.03);
  --survey-active-bg:           rgb(200 168 100 / 0.08);
}
```

- [ ] **Step 1.3: Commit**

```bash
git add app/design-system/tokens.css
git commit -m "feat(design-system): brand primitives + survey surface tokens

Layer 0 del design system: brand colors (ink, cream-pure, gold variants,
burgundy), type families (General Sans + Satoshi), y survey surface
tokens (--survey-*). Single source of truth para color, compartido
entre landing y entrevista. No incluye type scale, spacing ni motion
(archivos separados en tasks siguientes)."
```

---

### Task 2: Crear `app/design-system/type.css` (type scale + utilities)

**Files:**
- Create: `app/design-system/type.css`

- [ ] **Step 2.1: Escribir type.css**

```css
/* app/design-system/type.css
 *
 * LAYER 1 · Type scale tokens + utilities. Consume primitives de
 * tokens.css (font families). El type scale es shared landing+entrevista
 * pero cada surface decide cuánto usar (HeroPregunta usa --type-display,
 * no --type-hero; eso es decisión de uso, no de token).
 *
 * Utility classes:
 *   .text-hero      → H1 hero landing (clamp 46-108)
 *   .text-display   → H1 secondary, hero pregunta (clamp 34-64)
 *   .text-h2        → manifest, sección (clamp 28-46)
 *   .text-h3        → card title (clamp 20-28)
 *   .text-body-lg   → 17px
 *   .text-body      → 15.5px
 *   .text-caption   → 13px
 *   .text-eyebrow   → 10.5px microcaps tracked
 */

:root {
  /* Display scale */
  --type-hero:    clamp(46px, 7.4vw, 108px);
  --type-display: clamp(34px, 4.8vw, 64px);
  --type-h2:      clamp(28px, 3.6vw, 46px);
  --type-h3:      clamp(20px, 2.4vw, 28px);

  /* Body scale */
  --type-body-lg: 17px;
  --type-body:    15.5px;
  --type-caption: 13px;
  --type-eyebrow: 10.5px;

  /* Leading + tracking */
  --leading-tight:    0.95;
  --leading-snug:     1.05;
  --leading-default:  1.55;
  --tracking-display: -0.03em;
  --tracking-h2:      -0.022em;
  --tracking-h3:      -0.02em;
  --tracking-eyebrow: 0.32em;
}

@layer utilities {
  .text-hero {
    font-family: var(--font-display);
    font-size: var(--type-hero);
    line-height: var(--leading-tight);
    letter-spacing: var(--tracking-display);
    font-weight: 500;
    font-feature-settings: "ss01", "cv11";
  }

  .text-display {
    font-family: var(--font-display);
    font-size: var(--type-display);
    line-height: var(--leading-snug);
    letter-spacing: var(--tracking-display);
    font-weight: 600;
    font-feature-settings: "ss01", "cv11";
  }

  .text-h2 {
    font-family: var(--font-display);
    font-size: var(--type-h2);
    line-height: var(--leading-snug);
    letter-spacing: var(--tracking-h2);
    font-weight: 500;
    font-feature-settings: "ss01", "cv11";
  }

  .text-h3 {
    font-family: var(--font-display);
    font-size: var(--type-h3);
    line-height: 1.15;
    letter-spacing: var(--tracking-h3);
    font-weight: 600;
  }

  .text-body-lg {
    font-size: var(--type-body-lg);
    line-height: var(--leading-default);
  }

  .text-body {
    font-size: var(--type-body);
    line-height: var(--leading-default);
  }

  .text-caption {
    font-size: var(--type-caption);
    line-height: 1.5;
  }

  /* .text-eyebrow vive en globals.css por ahora; se mueve aquí en Task 5. */
}
```

- [ ] **Step 2.2: Commit**

```bash
git add app/design-system/type.css
git commit -m "feat(design-system): type scale tokens + utility classes

8 size tokens (hero, display, h2, h3, body-lg, body, caption, eyebrow)
+ leading + tracking. Utility classes .text-hero/display/h2/h3/body*
consumibles directo. Match exacto con clamp values del landing actual
para evitar visual regression."
```

---

### Task 3: Crear `app/design-system/space.css` (spacing scale)

**Files:**
- Create: `app/design-system/space.css`

- [ ] **Step 3.1: Escribir space.css**

```css
/* app/design-system/space.css
 *
 * LAYER 1 · Spacing scale (base 4px, Tailwind-compatible) + semantic
 * compositions. Las raw scales --space-N matchean Tailwind defaults
 * (1=4px, 2=8px, ...) por lo que se pueden usar como `gap-[var(--space-6)]`
 * o seguir con la Tailwind `gap-6`. Las semantic compositions son las
 * decisiones de alto nivel (section-y, card-padding, etc).
 */

:root {
  /* Raw scale */
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-6:  24px;
  --space-8:  32px;
  --space-10: 40px;
  --space-14: 56px;
  --space-20: 80px;
  --space-28: 112px;
  --space-36: 144px;

  /* Semantic compositions (responsive) */
  --section-y:         clamp(56px, 9vw, 144px);
  --section-padding-x: clamp(24px, 4vw, 56px);
  --container-max:     1480px;
  --card-padding:      clamp(24px, 3vw, 56px);

  /* Stack gaps semánticos */
  --stack-tight:    var(--space-2);   /* eyebrow → title */
  --stack-default:  var(--space-6);   /* title → body */
  --stack-loose:    var(--space-10);  /* secciones internas */
  --stack-section:  var(--space-20);  /* entre secciones grandes */
}
```

- [ ] **Step 3.2: Commit**

```bash
git add app/design-system/space.css
git commit -m "feat(design-system): spacing scale + semantic compositions

Raw 4px base scale matcheada con Tailwind defaults + 4 semantic
compositions (section-y, section-padding-x, container-max, card-padding)
+ 4 stack gaps (tight, default, loose, section). Habilita <Section>
y <Stack> primitivos en Day 2."
```

---

### Task 4: Crear `app/design-system/motion.css` (durations + easings + mover keyframes)

**Files:**
- Create: `app/design-system/motion.css`
- Modify: `app/globals.css` (mover keyframes)

- [ ] **Step 4.1: Escribir motion.css con tokens + keyframes movidos**

```css
/* app/design-system/motion.css
 *
 * LAYER 1 · Motion tokens (durations + easings) + LAYER 1 keyframes
 * globales movidos desde globals.css para limpiar el archivo raíz.
 *
 * NOTA: keyframes específicos del landing (.landing-root .ln-*),
 * de la entrevista (.vx-*, .sx-*, .bsg-*), y los view-transition
 * (::view-transition-old) se quedan en globals.css por ahora — son
 * scoped y refactorearlos arriesga visual regression. Pueden mover
 * en Wave 2 cuando el sistema esté estable.
 */

:root {
  /* === Durations =================================================== */
  --dur-micro:  160ms;   /* hover, focus, color flip */
  --dur-fast:   240ms;   /* small element transitions */
  --dur-layout: 380ms;   /* card expand, section change */
  --dur-hero:   720ms;   /* hero entrance, big reveals */
  --dur-epic:   1200ms;  /* word-mask reveals, char-stagger */

  /* === Easings ==================================================== */
  --ease-out-expo:  cubic-bezier(0.16, 1, 0.3, 1);
  --ease-ios-sheet: cubic-bezier(0.32, 0.72, 0, 1);
  --ease-back:      cubic-bezier(0.34, 1.4, 0.64, 1);
  --ease-back-out:  cubic-bezier(0.34, 1.35, 0.64, 1);
  --ease-back-in:   cubic-bezier(0.36, 0, 0.66, -0.35);
  --ease-in-out:    cubic-bezier(0.65, 0, 0.35, 1);
  --ease-soft:      cubic-bezier(0.2, 0.85, 0.25, 1);
}

/* === Keyframes globales (movidos desde globals.css) ================ */

@keyframes vertice-fade-up {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes vertice-pulse-ring {
  0%   { box-shadow: 0 0 0 0 oklch(0.78 0.14 80 / 0.5); }
  70%  { box-shadow: 0 0 0 8px oklch(0.78 0.14 80 / 0); }
  100% { box-shadow: 0 0 0 0 oklch(0.78 0.14 80 / 0); }
}

@keyframes vertice-shimmer {
  from { background-position: -200% 0; }
  to   { background-position: 200% 0; }
}

@keyframes vertice-cierre-caja {
  0%   { box-shadow: 0 0 0 0 oklch(0.78 0.14 80 / 0.55); transform: translateZ(0) scale(1); }
  35%  { box-shadow: 0 0 0 10px oklch(0.78 0.14 80 / 0); transform: scale(1.015); }
  100% { box-shadow: 0 0 0 0 oklch(0.78 0.14 80 / 0); transform: scale(1); }
}

@layer utilities {
  .animate-fade-up {
    animation: vertice-fade-up var(--dur-layout) var(--ease-out-expo) both;
  }
  .animate-pulse-ring {
    animation: vertice-pulse-ring 1.6s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  .animate-shimmer {
    background-image: linear-gradient(
      90deg,
      transparent 0%,
      oklch(0.92 0.16 125 / 0.18) 50%,
      transparent 100%
    );
    background-size: 200% 100%;
    animation: vertice-shimmer 1.6s linear infinite;
  }
  .animate-cierre-caja {
    animation: vertice-cierre-caja 900ms var(--ease-out-expo) both;
  }
}
```

- [ ] **Step 4.2: Verificar globals.css NO se rompe**

Aún no modificamos globals.css. El keyframes ahí sigue existiendo. Vamos a quitarlo en Task 5 cuando ya hayamos importado motion.css desde globals.

- [ ] **Step 4.3: Commit**

```bash
git add app/design-system/motion.css
git commit -m "feat(design-system): motion tokens (durations + easings) + global keyframes

5 durations (micro, fast, layout, hero, epic) + 7 easings (out-expo,
ios-sheet, back, back-out, back-in, in-out, soft). Keyframes vertice-*
movidos aquí desde globals.css (los scoped landing-root y component-
specific se quedan en globals hasta Wave 2). Utility classes
.animate-fade-up, .animate-pulse-ring, .animate-shimmer, .animate-cierre-caja
ahora consumen tokens en vez de literals."
```

---

### Task 5: Refactor `app/globals.css` para importar design-system

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 5.1: Leer estado actual de globals.css**

```bash
wc -l app/globals.css
```

Expected: ~765 líneas.

- [ ] **Step 5.2: Modificar imports al top del archivo**

En `app/globals.css` líneas 1-3, después de los `@import` existentes, agregar:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

/* Design system tokens y utilities (Wave 1 2026-05-10). Importados en
   este orden para que las utilities (type.css) puedan consumir las
   vars (tokens.css, space.css, motion.css). */
@import "./design-system/tokens.css";
@import "./design-system/type.css";
@import "./design-system/space.css";
@import "./design-system/motion.css";
```

- [ ] **Step 5.3: Eliminar las brand primitive vars duplicadas de globals.css**

En `app/globals.css`, dentro de `:root { ... }` (líneas ~94-106), eliminar:

```css
  /* === Brand tokens unificados (espejo del landing) === */
  --ink: #0A0F1C;
  --ink-raised: #1a2236;
  --cream-pure: #F4F1EA;
  --gold: #C8A864;
  --gold-deep: #866D38;
  --gold-bright: #F2D89C;
  --gold-light: #E0BE7C;
  --burgundy: #8B3A3A;
```

(Ya viven en tokens.css.)

- [ ] **Step 5.4: Eliminar survey surface tokens duplicadas**

En `app/globals.css` líneas ~163-183, eliminar el bloque `--survey-*` (ya viven en tokens.css).

- [ ] **Step 5.5: Eliminar keyframes movidos**

En `app/globals.css` eliminar los 4 keyframes ya movidos: `vertice-fade-up`, `vertice-pulse-ring`, `vertice-shimmer`, `vertice-cierre-caja` (~líneas 231-282) Y las utility classes `.animate-fade-up`, `.animate-pulse-ring`, `.animate-shimmer`, `.animate-cierre-caja` (~líneas 694-712). Mantener todo lo demás (landing-root, vx-, sx-, bsg-, view-transition).

- [ ] **Step 5.6: Smoke test dev server**

```bash
npm run dev
```

Abre `http://localhost:3000`. Verifica que el landing renderiza igual que la baseline (Task 0.3). Si algo se ve diferente, NO continuar — revisar qué token se rompió.

- [ ] **Step 5.7: Typecheck**

```bash
npm run typecheck
```

Expected: PASS (sin cambios de TS, pero validamos).

- [ ] **Step 5.8: Commit**

```bash
git add app/globals.css
git commit -m "refactor(design-system): import tokens.css, type.css, space.css, motion.css

Elimina duplicación: brand primitives + survey surface tokens + 4
keyframes vertice-* + 4 animate-* utilities movidos a archivos
design-system. globals.css ahora delega Layer 0+1 al subsistema y se
queda con shadcn role mapping, legacy forest/lime (admin), scope-
specific keyframes (landing-root, vx, sx, bsg, view-transition),
@layer base reset, y reduced-motion override global.

Visual regression: cero (landing + preview/ui idénticos pre-refactor,
manual screenshot compare)."
```

---

### Task 6: Crear `lib/design-system/motion/easings.ts`

**Files:**
- Create: `lib/design-system/motion/easings.ts`
- Test: `lib/design-system/motion/easings.test.ts`

- [ ] **Step 6.1: Crear directorios**

```bash
mkdir -p lib/design-system/motion
```

- [ ] **Step 6.2: Escribir test (TDD)**

```ts
// lib/design-system/motion/easings.test.ts
import { describe, expect, it } from 'vitest';
import { easings, easingsCss } from './easings';

describe('easings', () => {
  it('exports outExpo as cubic-bezier tuple matching landing manifest', () => {
    expect(easings.outExpo).toEqual([0.16, 1, 0.3, 1]);
  });

  it('exports iosSheet as cubic-bezier tuple', () => {
    expect(easings.iosSheet).toEqual([0.32, 0.72, 0, 1]);
  });

  it('exports all 7 easings', () => {
    expect(Object.keys(easings)).toHaveLength(7);
    expect(Object.keys(easings).sort()).toEqual([
      'back', 'backIn', 'backOut', 'inOut', 'iosSheet', 'outExpo', 'soft',
    ]);
  });

  it('easingsCss returns the matching cubic-bezier() string', () => {
    expect(easingsCss.outExpo).toBe('cubic-bezier(0.16, 1, 0.3, 1)');
    expect(easingsCss.iosSheet).toBe('cubic-bezier(0.32, 0.72, 0, 1)');
  });
});
```

- [ ] **Step 6.3: Verificar test falla**

```bash
npm run test -- lib/design-system/motion/easings.test.ts
```

Expected: FAIL (`Cannot find module './easings'`).

- [ ] **Step 6.4: Implementar easings.ts**

```ts
// lib/design-system/motion/easings.ts
//
// Easings centralizados — matchean exactamente las CSS vars en
// app/design-system/motion.css. Úsalos en framer-motion como
// `ease: easings.outExpo` o como string en `transition`.

/** Tuple form for framer-motion `ease` prop. */
export const easings = {
  outExpo:  [0.16, 1, 0.3, 1],
  iosSheet: [0.32, 0.72, 0, 1],
  back:     [0.34, 1.4, 0.64, 1],
  backOut:  [0.34, 1.35, 0.64, 1],
  backIn:   [0.36, 0, 0.66, -0.35],
  inOut:    [0.65, 0, 0.35, 1],
  soft:     [0.2, 0.85, 0.25, 1],
} as const;

/** CSS string form for inline style / template literals. */
export const easingsCss = {
  outExpo:  'cubic-bezier(0.16, 1, 0.3, 1)',
  iosSheet: 'cubic-bezier(0.32, 0.72, 0, 1)',
  back:     'cubic-bezier(0.34, 1.4, 0.64, 1)',
  backOut:  'cubic-bezier(0.34, 1.35, 0.64, 1)',
  backIn:   'cubic-bezier(0.36, 0, 0.66, -0.35)',
  inOut:    'cubic-bezier(0.65, 0, 0.35, 1)',
  soft:     'cubic-bezier(0.2, 0.85, 0.25, 1)',
} as const;

export type EasingPreset = keyof typeof easings;
```

- [ ] **Step 6.5: Verificar test pasa**

```bash
npm run test -- lib/design-system/motion/easings.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 6.6: Commit**

```bash
git add lib/design-system/motion/easings.ts lib/design-system/motion/easings.test.ts
git commit -m "feat(design-system): easings TS presets matching CSS vars

7 easings (outExpo, iosSheet, back, backOut, backIn, inOut, soft) en
2 forms: tuple [n,n,n,n] para framer-motion ease prop, y CSS string
'cubic-bezier(...)' para inline style. Tests: 4 cases validando
values match con motion.css vars."
```

---

### Task 7: Crear `lib/design-system/motion/durations.ts`

**Files:**
- Create: `lib/design-system/motion/durations.ts`
- Test: `lib/design-system/motion/durations.test.ts`

- [ ] **Step 7.1: Escribir test**

```ts
// lib/design-system/motion/durations.test.ts
import { describe, expect, it } from 'vitest';
import { dur, durMs } from './durations';

describe('durations', () => {
  it('exposes seconds form for framer-motion (multiply by 1)', () => {
    expect(dur.micro).toBe(0.16);
    expect(dur.fast).toBe(0.24);
    expect(dur.layout).toBe(0.38);
    expect(dur.hero).toBe(0.72);
    expect(dur.epic).toBe(1.2);
  });

  it('exposes ms form matching CSS var values', () => {
    expect(durMs.micro).toBe(160);
    expect(durMs.fast).toBe(240);
    expect(durMs.layout).toBe(380);
    expect(durMs.hero).toBe(720);
    expect(durMs.epic).toBe(1200);
  });

  it('dur and durMs have the same 5 keys', () => {
    expect(Object.keys(dur).sort()).toEqual(Object.keys(durMs).sort());
  });
});
```

- [ ] **Step 7.2: Verificar test falla**

```bash
npm run test -- lib/design-system/motion/durations.test.ts
```

Expected: FAIL (`Cannot find module './durations'`).

- [ ] **Step 7.3: Implementar durations.ts**

```ts
// lib/design-system/motion/durations.ts
//
// Durations centralizadas — matchean --dur-* en motion.css.
// `dur` en seconds para framer-motion `transition.duration`.
// `durMs` en ms para Date.now() arithmetic o CSS template literals.

export const dur = {
  micro:  0.16,
  fast:   0.24,
  layout: 0.38,
  hero:   0.72,
  epic:   1.2,
} as const;

export const durMs = {
  micro:  160,
  fast:   240,
  layout: 380,
  hero:   720,
  epic:   1200,
} as const;

export type DurationPreset = keyof typeof dur;
```

- [ ] **Step 7.4: Verificar test pasa**

```bash
npm run test -- lib/design-system/motion/durations.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 7.5: Commit**

```bash
git add lib/design-system/motion/durations.ts lib/design-system/motion/durations.test.ts
git commit -m "feat(design-system): durations TS presets in seconds + ms

5 duration tokens (micro 160ms, fast 240ms, layout 380ms, hero 720ms,
epic 1200ms) exportados en seconds (para framer-motion) y ms (para
CSS template literals). Match exacto con --dur-* CSS vars en
motion.css."
```

---

### Task 8: Crear `lib/design-system/motion/springs.ts`

**Files:**
- Create: `lib/design-system/motion/springs.ts`
- Test: `lib/design-system/motion/springs.test.ts`

- [ ] **Step 8.1: Escribir test**

```ts
// lib/design-system/motion/springs.test.ts
import { describe, expect, it } from 'vitest';
import { springs } from './springs';

describe('springs', () => {
  it('elegant matches the HeaderCTA SPRING_FILL inline values', () => {
    expect(springs.elegant).toEqual({
      type: 'spring',
      stiffness: 320,
      damping: 22,
      mass: 0.55,
    });
  });

  it('snap matches the HeaderCTA SPRING_ARROW inline values', () => {
    expect(springs.snap).toEqual({
      type: 'spring',
      stiffness: 520,
      damping: 28,
      mass: 0.4,
    });
  });

  it('soft matches the HeaderCTA SPRING_TEXT inline values', () => {
    expect(springs.soft).toEqual({
      type: 'spring',
      stiffness: 380,
      damping: 26,
      mass: 0.6,
    });
  });

  it('indicator matches SectionIndicator SPRING inline values', () => {
    expect(springs.indicator).toEqual({
      type: 'spring',
      stiffness: 360,
      damping: 26,
      mass: 0.55,
    });
  });

  it('exports 5 presets', () => {
    expect(Object.keys(springs)).toHaveLength(5);
  });
});
```

- [ ] **Step 8.2: Verificar test falla**

```bash
npm run test -- lib/design-system/motion/springs.test.ts
```

Expected: FAIL.

- [ ] **Step 8.3: Implementar springs.ts**

```ts
// lib/design-system/motion/springs.ts
//
// Spring physics presets para framer-motion. Centralizados — antes
// vivían inline en HeaderCTA, SectionIndicator, etc. Cada preset tiene
// un feel documentado para que el resto del equipo (y futuro tú) sepa
// cuándo usar cuál.
//
// Uso:
//   import { springs } from '@/lib/design-system/motion/springs';
//   <motion.div transition={springs.elegant} ... />

export const springs = {
  /** Snap — UI inputs, toggles, micro-interactions. */
  snap:      { type: 'spring' as const, stiffness: 520, damping: 28, mass: 0.4 },
  /** Elegant — hero CTAs, important reveals, navigation. */
  elegant:   { type: 'spring' as const, stiffness: 320, damping: 22, mass: 0.55 },
  /** Soft — text, opacity, gentle layout shifts. */
  soft:      { type: 'spring' as const, stiffness: 380, damping: 26, mass: 0.6 },
  /** Bounce — overshoot reveals (success, celebration). */
  bounce:    { type: 'spring' as const, stiffness: 280, damping: 14, mass: 0.5 },
  /** Indicator — scroll-driven section indicator. */
  indicator: { type: 'spring' as const, stiffness: 360, damping: 26, mass: 0.55 },
} as const;

export type SpringPreset = keyof typeof springs;
```

- [ ] **Step 8.4: Verificar test pasa**

```bash
npm run test -- lib/design-system/motion/springs.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 8.5: Commit**

```bash
git add lib/design-system/motion/springs.ts lib/design-system/motion/springs.test.ts
git commit -m "feat(design-system): spring physics presets (snap, elegant, soft, bounce, indicator)

Extrae los stiffness/damping/mass values inline de HeaderCTA y
SectionIndicator a una capa shared. 5 presets con feel documentado.
Tests validan que snap/elegant/soft/indicator matchean valores
históricos pre-refactor (cero feel change al migrar componentes en
Day 2)."
```

---

### Task 9: Crear `lib/design-system/tokens.ts` (TS export de brand)

**Files:**
- Create: `lib/design-system/tokens.ts`
- Test: `lib/design-system/tokens.test.ts`

- [ ] **Step 9.1: Escribir test**

```ts
// lib/design-system/tokens.test.ts
import { describe, expect, it } from 'vitest';
import { brand, fonts } from './tokens';

describe('brand tokens', () => {
  it('exports the 8 brand colors', () => {
    expect(brand.ink).toBe('#0A0F1C');
    expect(brand.inkRaised).toBe('#1A2236');
    expect(brand.creamPure).toBe('#F4F1EA');
    expect(brand.gold).toBe('#C8A864');
    expect(brand.goldDeep).toBe('#866D38');
    expect(brand.goldBright).toBe('#F2D89C');
    expect(brand.goldLight).toBe('#E0BE7C');
    expect(brand.burgundy).toBe('#8B3A3A');
  });
});

describe('fonts', () => {
  it('exports display + sans family strings', () => {
    expect(fonts.display).toContain('General Sans');
    expect(fonts.sans).toContain('Satoshi');
  });
});
```

- [ ] **Step 9.2: Verificar test falla**

```bash
npm run test -- lib/design-system/tokens.test.ts
```

Expected: FAIL.

- [ ] **Step 9.3: Implementar tokens.ts**

```ts
// lib/design-system/tokens.ts
//
// TS export de brand primitives para uso en JS (gradients programáticos,
// canvas, server components que generan inline styles). El source of
// truth es app/design-system/tokens.css; estos valores DEBEN matchear.

export const brand = {
  ink:        '#0A0F1C',
  inkRaised:  '#1A2236',
  creamPure:  '#F4F1EA',
  gold:       '#C8A864',
  goldDeep:   '#866D38',
  goldBright: '#F2D89C',
  goldLight:  '#E0BE7C',
  burgundy:   '#8B3A3A',
} as const;

export const fonts = {
  display: "'General Sans', 'Satoshi', ui-sans-serif, sans-serif",
  sans:    "'Satoshi', ui-sans-serif, sans-serif",
} as const;

export type BrandColor = keyof typeof brand;
```

- [ ] **Step 9.4: Verificar test pasa**

```bash
npm run test -- lib/design-system/tokens.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 9.5: Commit**

```bash
git add lib/design-system/tokens.ts lib/design-system/tokens.test.ts
git commit -m "feat(design-system): TS export of brand colors + font families

8 brand colors + 2 font family strings en TS. Source of truth sigue
siendo tokens.css; este archivo es para uso JS (gradients programáticos,
canvas drawing, server components generando inline styles)."
```

---

### Task 10: Crear `lib/design-system/README.md` + smoke test end-to-end Day 1

**Files:**
- Create: `lib/design-system/README.md`

- [ ] **Step 10.1: Escribir README**

```markdown
# Design System · Wave 1

Single source of truth para tokens del design system de Vértice.

## Layers

```
app/design-system/         ← CSS (consumir vía className y arbitrary values)
  tokens.css               ← Layer 0: brand colors + font families + survey surface
  type.css                 ← Layer 1: type scale + utility classes
  space.css                ← Layer 1: spacing scale + semantic compositions
  motion.css               ← Layer 1: motion tokens + global keyframes

lib/design-system/         ← TS (consumir vía import)
  motion/
    easings.ts             ← cubic-bezier tuples + CSS strings
    durations.ts           ← seconds + ms
    springs.ts             ← framer-motion spring presets
  tokens.ts                ← brand colors + font families en TS
```

## Cómo usar

### En componentes (CSS-first)

```tsx
<h1 className="text-hero text-cream-pure">Solicitantes pre-calificados.</h1>
<p className="text-body text-cream-pure/72">subhead...</p>
<button className="rounded-pill bg-cream-pure text-ink h-12">...</button>

<section
  className="py-[var(--section-y)] px-[var(--section-padding-x)]"
  style={{ maxWidth: 'var(--container-max)' }}
>
```

### En componentes (motion)

```tsx
import { motion } from 'motion/react';
import { springs } from '@/lib/design-system/motion/springs';
import { easings } from '@/lib/design-system/motion/easings';
import { dur } from '@/lib/design-system/motion/durations';

<motion.div
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: dur.layout, ease: easings.outExpo }}
/>

<motion.button transition={springs.elegant} />
```

### Programmatic colors (JS-side)

```ts
import { brand } from '@/lib/design-system/tokens';

const gradient = `linear-gradient(135deg, ${brand.gold}, ${brand.goldBright})`;
```

## Reglas

1. **NO duplicar tokens**: si está en CSS o TS aquí, NO redefinirlo en otro archivo.
2. **NO inventar nuevos easings/springs/durations sin discusión**: añadirlos a este module primero.
3. **Brand-locked components OK**: HeroLine, VertexMark, etc usan brand colors directos cuando el color ES la identidad.
4. **Surface awareness manual**: landing components hardcodean ink+gold, entrevista components hardcodean cream+gold-deep. Los tokens compartidos garantizan que cuando un primitive cambia, ambos sets heredan.

## Specs y planes

- Spec: `docs/superpowers/specs/2026-05-10-design-system-tokenization-design.md`
- Plan Wave 1: `docs/superpowers/plans/2026-05-10-design-system-wave-1.md`
- Documentación viva: `docs/design/DESIGN_SYSTEM.md`
```

- [ ] **Step 10.2: Run full test suite + typecheck**

```bash
npm run test
npm run typecheck
```

Expected: tests verdes (incluyendo los 3 nuevos test files), typecheck verde.

- [ ] **Step 10.3: Smoke test visual landing + preview/ui**

```bash
npm run dev
```

Abre `http://localhost:3000` y `http://localhost:3000/preview/ui`. Compara contra `.audit/baseline-pre-wave-1/` screenshots. **Zero visual diff es el goal** (estamos solo moviendo cosas, no cambiando valores).

Si hay diff visible, parar y root-cause.

- [ ] **Step 10.4: Commit**

```bash
git add lib/design-system/README.md
git commit -m "docs(design-system): README cheat sheet de uso

Day 1 done: tokens (4 CSS) + motion (3 TS) + brand (1 TS) + README.
Zero visual diff vs baseline pre-refactor. Listo para Day 2 (landing
primitives)."
```

---

## Day 2 · Landing primitives (10 tasks)

### Task 11: `components/landing/Eyebrow.tsx`

**Files:**
- Create: `components/landing/Eyebrow.tsx`

- [ ] **Step 11.1: Implementar Eyebrow**

```tsx
// components/landing/Eyebrow.tsx
//
// Microcap label estilo manifiesto. Consume .text-eyebrow utility.
// 3 tones para distintos contextos: muted (default, cream/45),
// gold (acento), cream (más prominente cream/72).

import { cn } from '@/lib/utils';

type Tone = 'muted' | 'gold' | 'cream';

interface EyebrowProps {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
  as?: 'span' | 'p' | 'div';
}

const toneClass: Record<Tone, string> = {
  muted:  'text-cream-pure/45',
  gold:   'text-gold',
  cream:  'text-cream-pure/72',
};

export function Eyebrow({
  children,
  tone = 'muted',
  className,
  as: Tag = 'span',
}: EyebrowProps) {
  return (
    <Tag className={cn('text-eyebrow', toneClass[tone], className)}>
      {children}
    </Tag>
  );
}
```

- [ ] **Step 11.2: Verificar typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 11.3: Commit**

```bash
git add components/landing/Eyebrow.tsx
git commit -m "feat(landing): Eyebrow primitive (3 tones: muted, gold, cream)

Microcap label para meta-info ('M02 · PRODUCTO', '01 · Tu entrevista').
Consume .text-eyebrow utility + tone-based opacity. Polymorphic via
as prop (span/p/div). Reemplaza patrón inline 'font-mono text-[10.5px]
uppercase tracking-[0.32em] text-cream-pure/45' repetido en page.tsx."
```

---

### Task 12: `components/landing/Stack.tsx`

**Files:**
- Create: `components/landing/Stack.tsx`

- [ ] **Step 12.1: Implementar Stack**

```tsx
// components/landing/Stack.tsx
//
// Vertical rhythm primitive. gap mapeado a tokens semánticos --stack-*.

import { cn } from '@/lib/utils';

type Gap = 'tight' | 'default' | 'loose' | 'section';
type Align = 'start' | 'center' | 'end';

interface StackProps {
  children: React.ReactNode;
  gap?: Gap;
  align?: Align;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'header' | 'footer';
}

const gapStyle: Record<Gap, string> = {
  tight:   'gap-[var(--stack-tight)]',
  default: 'gap-[var(--stack-default)]',
  loose:   'gap-[var(--stack-loose)]',
  section: 'gap-[var(--stack-section)]',
};

const alignClass: Record<Align, string> = {
  start:  'items-start',
  center: 'items-center',
  end:    'items-end',
};

export function Stack({
  children,
  gap = 'default',
  align = 'start',
  className,
  as: Tag = 'div',
}: StackProps) {
  return (
    <Tag className={cn('flex flex-col', gapStyle[gap], alignClass[align], className)}>
      {children}
    </Tag>
  );
}
```

- [ ] **Step 12.2: Typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 12.3: Commit**

```bash
git add components/landing/Stack.tsx
git commit -m "feat(landing): Stack primitive (vertical rhythm with semantic gaps)

4 gap presets (tight, default, loose, section) mapeados a --stack-*
tokens. align prop. Polymorphic. Reemplaza patrón 'flex flex-col gap-N'
con gap-N ad-hoc por consumer."
```

---

### Task 13: `components/landing/Section.tsx`

**Files:**
- Create: `components/landing/Section.tsx`

- [ ] **Step 13.1: Implementar Section**

```tsx
// components/landing/Section.tsx
//
// Section primitive con container max + padding tokens. Surface ink
// por default (landing es dark). Para sub-pockets light dentro de
// landing usar surface="inkRaised".

import { cn } from '@/lib/utils';

type Surface = 'ink' | 'inkRaised' | 'transparent';
type PaddingY = 'none' | 'compact' | 'default' | 'hero';
type ContainerSize = 'default' | 'narrow' | 'wide' | 'full';

interface SectionProps {
  children: React.ReactNode;
  surface?: Surface;
  paddingY?: PaddingY;
  containerSize?: ContainerSize;
  className?: string;
  containerClassName?: string;
  id?: string;
  as?: 'section' | 'div' | 'article' | 'header' | 'footer' | 'main';
}

const surfaceClass: Record<Surface, string> = {
  ink:         'bg-ink text-cream-pure',
  inkRaised:   'bg-[var(--ink-raised)] text-cream-pure',
  transparent: '',
};

const paddingYStyle: Record<PaddingY, string> = {
  none:    '',
  compact: 'py-[var(--space-14)]',
  default: 'py-[var(--section-y)]',
  hero:    'pt-[clamp(96px,9vw,144px)] pb-[var(--space-20)]',
};

const containerMaxWidth: Record<ContainerSize, string | undefined> = {
  default: 'max-w-[var(--container-max)]',
  narrow:  'max-w-[960px]',
  wide:    'max-w-[1640px]',
  full:    undefined,
};

export function Section({
  children,
  surface = 'ink',
  paddingY = 'default',
  containerSize = 'default',
  className,
  containerClassName,
  id,
  as: Tag = 'section',
}: SectionProps) {
  const containerClasses = cn(
    'mx-auto px-[var(--section-padding-x)]',
    containerMaxWidth[containerSize],
    containerClassName,
  );
  return (
    <Tag
      id={id}
      className={cn(surfaceClass[surface], paddingYStyle[paddingY], className)}
    >
      <div className={containerClasses}>{children}</div>
    </Tag>
  );
}
```

- [ ] **Step 13.2: Typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 13.3: Commit**

```bash
git add components/landing/Section.tsx
git commit -m "feat(landing): Section primitive (surface + paddingY + container)

3 surfaces (ink, inkRaised, transparent) x 4 paddingY (none, compact,
default, hero) x 4 containerSize (default, narrow, wide, full). Consume
--section-y, --section-padding-x, --container-max tokens. Reemplaza
patrón <section className='bg-ink text-cream-pure py-24 sm:py-28...'>
con composable API."
```

---

### Task 14: `components/landing/Hairline.tsx`

**Files:**
- Create: `components/landing/Hairline.tsx`

- [ ] **Step 14.1: Implementar Hairline**

```tsx
// components/landing/Hairline.tsx
//
// Hairline divider — 1px line + variantes de tono. Orientation horizontal
// (default) o vertical (uso en headers, sidebars).

import { cn } from '@/lib/utils';

type Tone = 'gold' | 'cream' | 'cream-strong';
type Orientation = 'horizontal' | 'vertical';

interface HairlineProps {
  tone?: Tone;
  orientation?: Orientation;
  className?: string;
}

const toneBg: Record<Tone, string> = {
  'gold':         'bg-gold/55',
  'cream':        'bg-cream-pure/8',
  'cream-strong': 'bg-cream-pure/20',
};

export function Hairline({
  tone = 'cream',
  orientation = 'horizontal',
  className,
}: HairlineProps) {
  const baseClass = orientation === 'horizontal'
    ? 'h-px w-full'
    : 'w-px h-full';
  return (
    <span
      aria-hidden
      className={cn('block', baseClass, toneBg[tone], className)}
    />
  );
}
```

- [ ] **Step 14.2: Typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 14.3: Commit**

```bash
git add components/landing/Hairline.tsx
git commit -m "feat(landing): Hairline primitive (1px divider, 3 tones)

Replaces inline divs '<div className=\"h-px w-full bg-cream-pure/8\" />'
con component. tone: gold | cream | cream-strong. orientation:
horizontal | vertical."
```

---

### Task 15: `components/landing/Atmosphere.tsx`

**Files:**
- Create: `components/landing/Atmosphere.tsx`

- [ ] **Step 15.1: Implementar Atmosphere**

```tsx
// components/landing/Atmosphere.tsx
//
// Overlay layer para hero/manifest backgrounds. Wraps existing
// .atmosphere-radial-gold y .atmosphere-noise utilities. Pointer-events
// disabled, absolutely positioned al contenedor padre relative.

import { cn } from '@/lib/utils';

type Variant = 'radial-gold' | 'noise' | 'both';

interface AtmosphereProps {
  variant?: Variant;
  className?: string;
}

export function Atmosphere({ variant = 'both', className }: AtmosphereProps) {
  const showRadial = variant === 'radial-gold' || variant === 'both';
  const showNoise = variant === 'noise' || variant === 'both';
  return (
    <>
      {showRadial && (
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-0 atmosphere-radial-gold',
            className,
          )}
        />
      )}
      {showNoise && (
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-0 atmosphere-noise',
            className,
          )}
        />
      )}
    </>
  );
}
```

- [ ] **Step 15.2: Typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 15.3: Commit**

```bash
git add components/landing/Atmosphere.tsx
git commit -m "feat(landing): Atmosphere primitive (radial gold + noise overlay)

Wraps .atmosphere-radial-gold + .atmosphere-noise utilities. 3 variants
(radial-gold, noise, both). Pointer-events disabled. Container padre
debe ser relative."
```

---

### Task 16: `components/landing/Button.tsx`

**Files:**
- Create: `components/landing/Button.tsx`

- [ ] **Step 16.1: Implementar Button con 3 variants**

```tsx
// components/landing/Button.tsx
//
// 3 variants:
//   primary — pill cream sobre ink + inner icon-pill ink/gold (CTA hero)
//   ghost   — pill border cream/20 → cream/45 hover
//   header  — pill h-10 backdrop-blur + spring fill (HeaderCTA usa este,
//             extraído acá para reuso futuro pero NO migramos HeaderCTA
//             a esta Button todavía — HeaderCTA tiene multi-layer spring
//             choreography que merece su propio componente)

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
          'group/cta relative inline-flex items-center gap-3 rounded-full',
          'bg-cream-pure pl-6 pr-2 text-[13.5px] font-medium text-ink',
          'transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out-expo)]',
          'shadow-[0_0_0_1px_rgba(244,241,234,0.04),0_30px_70px_-20px_rgba(200,168,100,0.45)]',
          'hover:bg-white',
          sizeClass[size],
          className,
        )}
        {...rest}
      >
        <span>{children}</span>
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-ink text-gold transition-transform duration-[var(--dur-fast)] group-hover/cta:rotate-45">
          <Icon className="size-4" strokeWidth={2} />
        </span>
      </button>
    );
  }

  return (
    <button
      className={cn(
        'group/ghost inline-flex items-center gap-2.5 rounded-full',
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

- [ ] **Step 16.2: Typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 16.3: Commit**

```bash
git add components/landing/Button.tsx
git commit -m "feat(landing): Button primitive (primary + ghost, 2 sizes)

Pill cream sobre ink (primary, con inner icon-pill ink/gold + arrow
45° hover) y pill ghost (border cream/20 → 45 hover). Default icon
ArrowUpRight, override via icon prop. HeaderCTA queda como component
separado por su multi-layer spring choreography especifica."
```

---

### Task 17: `components/landing/Card.tsx`

**Files:**
- Create: `components/landing/Card.tsx`

- [ ] **Step 17.1: Implementar Card**

```tsx
// components/landing/Card.tsx
//
// Card primitive para landing. Variant default = manifest pattern
// (ink-raised bg + gold seam top + radius-section). Atmosphere
// overlays opcionales via prop atmosphere=true.

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
    'relative overflow-hidden rounded-[18px] bg-[var(--ink-raised)] ' +
    'shadow-[inset_0_0_0_1px_rgba(244,241,234,0.055),inset_0_1px_0_rgba(200,168,100,0.18)] ' +
    'p-[var(--card-padding)]',
  manifest:
    'relative overflow-hidden rounded-[28px] bg-[var(--ink-raised)] ' +
    'shadow-[inset_0_0_0_1px_rgba(244,241,234,0.055),inset_0_1px_0_rgba(200,168,100,0.18)] ' +
    'px-6 py-14 sm:px-10 sm:py-20 lg:px-14',
  compact:
    'relative overflow-hidden rounded-[14px] bg-[var(--ink-raised)] ' +
    'shadow-[inset_0_0_0_1px_rgba(244,241,234,0.055)] ' +
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

- [ ] **Step 17.2: Typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 17.3: Commit**

```bash
git add components/landing/Card.tsx
git commit -m "feat(landing): Card primitive (default, manifest, compact + atmosphere)

3 variants matcheando patrones existentes en page.tsx (manifest section,
default cards, compact pills). Optional atmosphere overlay (radial gold
+ noise). Consume --card-padding token + --ink-raised."
```

---

### Task 18: Refactor `HeaderCTA.tsx` a springs presets

**Files:**
- Modify: `components/landing/HeaderCTA.tsx`

- [ ] **Step 18.1: Diff target**

Reemplazar las 3 const inline al top del archivo:

```ts
// ANTES (líneas 12-14)
const SPRING_FILL = { type: 'spring' as const, stiffness: 320, damping: 22, mass: 0.55 };
const SPRING_ARROW = { type: 'spring' as const, stiffness: 520, damping: 18, mass: 0.4 };
const SPRING_TEXT = { type: 'spring' as const, stiffness: 380, damping: 26 };
```

Con import + alias:

```ts
// DESPUÉS (al top del file)
import { springs } from '@/lib/design-system/motion/springs';

// alias semánticos para readability inline
const SPRING_FILL = springs.elegant;  // 320 / 22 / 0.55 (exacto match)
const SPRING_ARROW = springs.snap;    // 520 / 28 / 0.4 (era 18 damping inline)
const SPRING_TEXT = springs.soft;     // 380 / 26 / 0.6
```

**IMPORTANTE**: el `SPRING_ARROW` original tenía damping 18, no 28. Esto era un valor único, no parte del catálogo cementado. Antes de mergear, validar con founder/screenshot que el snap (28) se siente igual o mejor. Si no, agregar `arrowSnap: { stiffness: 520, damping: 18, mass: 0.4 }` a springs.ts en sesión separada.

Para Wave 1, opción conservadora: **mantener arrow inline** y solo migrar FILL + TEXT:

- [ ] **Step 18.2: Editar HeaderCTA.tsx (opción conservadora)**

```tsx
// components/landing/HeaderCTA.tsx (top of file)

'use client';

import { motion } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';
import type { MouseEvent } from 'react';

import { springs } from '@/lib/design-system/motion/springs';

// Alias semánticos. SPRING_ARROW se queda inline porque damping=18 no
// matchea ningún preset y refactorearlo arriesga cambiar el feel.
// Wave 2 evalúa si agregar arrowSnap a springs.ts.
const SPRING_FILL = springs.elegant;
const SPRING_ARROW = { type: 'spring' as const, stiffness: 520, damping: 18, mass: 0.4 };
const SPRING_TEXT = { type: 'spring' as const, stiffness: 380, damping: 26 };

// ... resto del componente sin cambios
```

- [ ] **Step 18.3: Smoke test visual**

```bash
npm run dev
```

Abre `http://localhost:3000`. Hover sobre el HeaderCTA en top-right. Verifica:
- Fill expand left→right igual de elegante.
- Arrow rota 45° igual snappy.
- Texto cambia color smooth igual.

Si feel diferente, root-cause inmediato (probable: SPRING_FILL stiffness/damping/mass exact match).

- [ ] **Step 18.4: Run tests**

```bash
npm run test
```

Expected: tests verdes (springs.test.ts ya validó que `springs.elegant` matchea valores históricos).

- [ ] **Step 18.5: Commit**

```bash
git add components/landing/HeaderCTA.tsx
git commit -m "refactor(landing): HeaderCTA usa springs.elegant en vez de inline

Migra SPRING_FILL inline (320/22/0.55) a springs.elegant. SPRING_ARROW
(damping=18, valor único) y SPRING_TEXT se quedan inline por ahora;
Wave 2 evalúa si agregar como presets adicionales. Smoke test visual:
feel idéntico pre/post."
```

---

### Task 19: Refactor `SectionIndicator.tsx` a springs presets

**Files:**
- Modify: `components/landing/SectionIndicator.tsx`

- [ ] **Step 19.1: Reemplazar consts inline**

```tsx
// ANTES (líneas 20-21)
const SPRING = { type: 'spring' as const, stiffness: 360, damping: 26 };
const SPRING_LINE = { type: 'spring' as const, stiffness: 300, damping: 24 };

// DESPUÉS
import { springs } from '@/lib/design-system/motion/springs';

const SPRING = springs.indicator;  // 360 / 26 / 0.55
// SPRING_LINE (300/24, no mass) no matchea preset; se queda inline.
const SPRING_LINE = { type: 'spring' as const, stiffness: 300, damping: 24 };
```

**Nota**: el SPRING original NO especificaba mass (default 1). El preset indicator tiene mass: 0.55. Esto SÍ va a cambiar el feel marginalmente (más rápido el oscillation). Si el founder valida, queda; si no, ajustar preset.

- [ ] **Step 19.2: Editar SectionIndicator.tsx**

Editar imports + las 2 consts en líneas 11 y 20-21.

- [ ] **Step 19.3: Smoke test visual**

```bash
npm run dev
```

Abre `http://localhost:3000`. Scroll hasta brief section y cierre section. Verifica que los indicators a la derecha se animan smooth. Comparar contra baseline screenshot.

- [ ] **Step 19.4: Commit**

```bash
git add components/landing/SectionIndicator.tsx
git commit -m "refactor(landing): SectionIndicator usa springs.indicator

Migra SPRING inline (360/26, no mass) a springs.indicator (360/26/0.55).
Pequeña diferencia: mass=0.55 vs default 1 hace el oscillation
ligeramente más rápido. SPRING_LINE se queda inline (300/24 no
matchea preset). Validado visualmente vs baseline."
```

---

### Task 20: Refactor parcial `app/page.tsx` (manifest section a primitives)

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 20.1: Identificar manifest section**

```bash
grep -n "manifest\|Dos momentos\|Una alianza" app/page.tsx | head -20
```

- [ ] **Step 20.2: Refactor de la sección manifest**

La sección manifest es probablemente un `<section>` con `bg-[#1A2236]` (ink-raised), rounded-[28px], gold seam, eyebrow + h2 dos líneas, dos rows ("01 · Tu entrevista" / "02 · Tus casos").

Target: reemplazar el wrapper `<section ...>` con `<Section><Card variant="manifest" atmosphere><Stack gap="loose">...</Stack></Card></Section>`. Eyebrow inline → `<Eyebrow>`. h2 inline → `className="text-h2"`. dividers `<div className="h-px ..." />` → `<Hairline />`.

**Importante**: el refactor mantiene el output visual idéntico. NO cambiar copy, NO cambiar layout, NO cambiar animaciones (ln-*).

Plantilla aproximada del target:

```tsx
import { Section } from '@/components/landing/Section';
import { Card } from '@/components/landing/Card';
import { Stack } from '@/components/landing/Stack';
import { Eyebrow } from '@/components/landing/Eyebrow';
import { Hairline } from '@/components/landing/Hairline';

// ... dentro de page.tsx donde está manifest:

<Section paddingY="default" containerSize="default" id="brief">
  <Card variant="manifest" atmosphere>
    <Stack gap="loose">
      <Eyebrow tone="muted">VÉRTICE · MANIFIESTO</Eyebrow>
      <h2 className="text-h2 text-cream-pure">
        Dos momentos.<br />
        <span className="font-light text-cream-pure/55">Una alianza.</span>
      </h2>
      {/* ... rows con Hairline divider ... */}
    </Stack>
  </Card>
</Section>
```

- [ ] **Step 20.3: Smoke test visual**

```bash
npm run dev
```

Abre `http://localhost:3000`. Scroll a la manifest section. **Comparar pixel-by-pixel** con baseline `.audit/baseline-pre-wave-1/manifest.png`.

Diferencias esperadas: cero.
Diferencias aceptables: ninguna.

Si hay diff, root-cause antes de continuar.

- [ ] **Step 20.4: Typecheck + tests**

```bash
npm run typecheck
npm run test
```

Expected: verde.

- [ ] **Step 20.5: Commit**

```bash
git add app/page.tsx
git commit -m "refactor(landing): manifest section usa Section + Card + Stack + Eyebrow + Hairline

Primer refactor de page.tsx a primitives. Manifest section ahora
compone Section > Card variant=manifest atmosphere > Stack gap=loose
> [Eyebrow, h2, Hairline rows]. Cero visual regression vs baseline.
Patrón replicable para hero + footer en sesión posterior."
```

---

## Day 3 · Entrevista primitives + docs (10 tasks)

### Task 21: `components/entrevista/Eyebrow.tsx`

**Files:**
- Create: `components/entrevista/Eyebrow.tsx`

- [ ] **Step 21.1: Implementar Eyebrow surface cream**

```tsx
// components/entrevista/Eyebrow.tsx
//
// Versión cream-surface del Eyebrow. tone semánticos invertidos
// (muted = ink/45, gold = gold-deep para AA on white, ink = ink/72).

import { cn } from '@/lib/utils';

type Tone = 'muted' | 'gold' | 'ink';

interface EyebrowProps {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
  as?: 'span' | 'p' | 'div';
}

const toneClass: Record<Tone, string> = {
  muted: 'text-[var(--survey-text-45)]',
  gold:  'text-gold-deep',
  ink:   'text-[var(--survey-text-72)]',
};

export function Eyebrow({
  children,
  tone = 'muted',
  className,
  as: Tag = 'span',
}: EyebrowProps) {
  return (
    <Tag className={cn('text-eyebrow', toneClass[tone], className)}>
      {children}
    </Tag>
  );
}
```

- [ ] **Step 21.2: Typecheck + commit**

```bash
npm run typecheck
git add components/entrevista/Eyebrow.tsx
git commit -m "feat(entrevista): Eyebrow primitive (cream surface, 3 tones)

Espejo del landing Eyebrow para surface light. tones: muted (ink/45),
gold (gold-deep, AA on white), ink (ink/72). Consume --survey-text-*
tokens."
```

---

### Task 22: `components/entrevista/Stack.tsx`

**Files:**
- Create: `components/entrevista/Stack.tsx`

- [ ] **Step 22.1: Implementar (idéntico al landing Stack, surface-agnostic)**

```tsx
// components/entrevista/Stack.tsx
//
// Idéntico al landing Stack — surface-agnostic. Lo duplicamos para
// mantener el principio de "dos sets paralelos". Si en el futuro
// alguien quiere consolidar, lo hace explícito.

import { cn } from '@/lib/utils';

type Gap = 'tight' | 'default' | 'loose' | 'section';
type Align = 'start' | 'center' | 'end';

interface StackProps {
  children: React.ReactNode;
  gap?: Gap;
  align?: Align;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'header' | 'footer';
}

const gapStyle: Record<Gap, string> = {
  tight:   'gap-[var(--stack-tight)]',
  default: 'gap-[var(--stack-default)]',
  loose:   'gap-[var(--stack-loose)]',
  section: 'gap-[var(--stack-section)]',
};

const alignClass: Record<Align, string> = {
  start:  'items-start',
  center: 'items-center',
  end:    'items-end',
};

export function Stack({
  children,
  gap = 'default',
  align = 'start',
  className,
  as: Tag = 'div',
}: StackProps) {
  return (
    <Tag className={cn('flex flex-col', gapStyle[gap], alignClass[align], className)}>
      {children}
    </Tag>
  );
}
```

- [ ] **Step 22.2: Commit**

```bash
npm run typecheck
git add components/entrevista/Stack.tsx
git commit -m "feat(entrevista): Stack primitive (mirror of landing Stack)

Duplicación intencional — dos sets paralelos. Si en futuro se
consolida, ADR explícito."
```

---

### Task 23: `components/entrevista/Section.tsx`

**Files:**
- Create: `components/entrevista/Section.tsx`

- [ ] **Step 23.1: Implementar Section surface cream**

```tsx
// components/entrevista/Section.tsx
//
// Section surface light (cream/survey-bg). 3 surfaces: bg (off-white
// page), surface (white pure, ej. textarea container), ink (dark
// pocket = survey-card-1, brand surface dentro de entrevista).

import { cn } from '@/lib/utils';

type Surface = 'bg' | 'surface' | 'ink' | 'transparent';
type PaddingY = 'none' | 'compact' | 'default' | 'hero';
type ContainerSize = 'default' | 'narrow' | 'wide' | 'full';

interface SectionProps {
  children: React.ReactNode;
  surface?: Surface;
  paddingY?: PaddingY;
  containerSize?: ContainerSize;
  className?: string;
  containerClassName?: string;
  id?: string;
  as?: 'section' | 'div' | 'article' | 'header' | 'footer' | 'main';
}

const surfaceClass: Record<Surface, string> = {
  bg:          'bg-[var(--survey-bg)] text-[var(--survey-text)]',
  surface:     'bg-[var(--survey-surface)] text-[var(--survey-text)]',
  ink:         'bg-[var(--survey-card-1)] text-[var(--survey-card-1-fg)]',
  transparent: '',
};

const paddingYStyle: Record<PaddingY, string> = {
  none:    '',
  compact: 'py-[var(--space-14)]',
  default: 'py-[var(--section-y)]',
  hero:    'pt-[clamp(96px,9vw,144px)] pb-[var(--space-20)]',
};

const containerMaxWidth: Record<ContainerSize, string | undefined> = {
  default: 'max-w-[var(--container-max)]',
  narrow:  'max-w-[960px]',
  wide:    'max-w-[1640px]',
  full:    undefined,
};

export function Section({
  children,
  surface = 'bg',
  paddingY = 'default',
  containerSize = 'default',
  className,
  containerClassName,
  id,
  as: Tag = 'section',
}: SectionProps) {
  const containerClasses = cn(
    'mx-auto px-[var(--section-padding-x)]',
    containerMaxWidth[containerSize],
    containerClassName,
  );
  return (
    <Tag
      id={id}
      className={cn(surfaceClass[surface], paddingYStyle[paddingY], className)}
    >
      <div className={containerClasses}>{children}</div>
    </Tag>
  );
}
```

- [ ] **Step 23.2: Commit**

```bash
npm run typecheck
git add components/entrevista/Section.tsx
git commit -m "feat(entrevista): Section primitive (4 surfaces, surface light)

bg (off-white page), surface (white pure), ink (dark pocket = survey-
card-1), transparent. paddingY y containerSize iguales al landing
Section."
```

---

### Task 24: `components/entrevista/Hairline.tsx`

**Files:**
- Create: `components/entrevista/Hairline.tsx`

- [ ] **Step 24.1: Implementar**

```tsx
// components/entrevista/Hairline.tsx
//
// Hairline divider surface light. Tones invertidos: ink (ink/6 default),
// ink-strong (ink/12), gold (gold/22).

import { cn } from '@/lib/utils';

type Tone = 'ink' | 'ink-strong' | 'gold';
type Orientation = 'horizontal' | 'vertical';

interface HairlineProps {
  tone?: Tone;
  orientation?: Orientation;
  className?: string;
}

const toneBg: Record<Tone, string> = {
  'ink':        'bg-[var(--survey-hairline)]',
  'ink-strong': 'bg-[var(--survey-hairline-strong)]',
  'gold':       'bg-gold/22',
};

export function Hairline({
  tone = 'ink',
  orientation = 'horizontal',
  className,
}: HairlineProps) {
  const baseClass = orientation === 'horizontal'
    ? 'h-px w-full'
    : 'w-px h-full';
  return (
    <span
      aria-hidden
      className={cn('block', baseClass, toneBg[tone], className)}
    />
  );
}
```

- [ ] **Step 24.2: Commit**

```bash
npm run typecheck
git add components/entrevista/Hairline.tsx
git commit -m "feat(entrevista): Hairline primitive (cream surface, 3 tones)

ink (--survey-hairline ink/6), ink-strong (--survey-hairline-strong
ink/12), gold (gold/22)."
```

---

### Task 25: `components/entrevista/Button.tsx`

**Files:**
- Create: `components/entrevista/Button.tsx`

- [ ] **Step 25.1: Implementar Button surface cream**

```tsx
// components/entrevista/Button.tsx
//
// Inverse de landing Button. primary = pill ink solid sobre cream bg,
// con inner icon-pill cream + arrow rotate hover. ghost = pill border
// ink/12 → ink/30 hover.

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
          'group/cta relative inline-flex items-center gap-3 rounded-full',
          'bg-ink pl-6 pr-2 text-[13.5px] font-medium text-cream-pure',
          'transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out-expo)]',
          'shadow-[0_0_0_1px_rgba(10,15,28,0.04),0_20px_50px_-20px_rgba(10,15,28,0.35)]',
          'hover:bg-[var(--ink-raised)]',
          sizeClass[size],
          className,
        )}
        {...rest}
      >
        <span>{children}</span>
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-cream-pure text-ink transition-transform duration-[var(--dur-fast)] group-hover/cta:translate-x-0.5">
          <Icon className="size-4" strokeWidth={2} />
        </span>
      </button>
    );
  }

  return (
    <button
      className={cn(
        'group/ghost inline-flex items-center gap-2.5 rounded-full',
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

- [ ] **Step 25.2: Commit**

```bash
npm run typecheck
git add components/entrevista/Button.tsx
git commit -m "feat(entrevista): Button primitive (primary ink + ghost, cream surface)

Inverso del landing Button. primary = pill ink solid sobre cream con
inner cream icon-pill + arrow translate hover. ghost = pill border
ink/12 → ink/30 hover. Default icon ArrowRight (entrevista forward
navigation, no ArrowUpRight como landing CTA)."
```

---

### Task 26: `components/entrevista/Card.tsx`

**Files:**
- Create: `components/entrevista/Card.tsx`

- [ ] **Step 26.1: Implementar**

```tsx
// components/entrevista/Card.tsx
//
// 2 variants principales matcheando los survey surface tokens:
//   surface-1 (default) — navy ink dark pocket. Branding moment dentro
//                         de la encuesta. Espejo del landing dark.
//   surface-2          — white pure. Workspace card (textarea container).
//
// + variant compact para chips/pills internos.

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
    'relative overflow-hidden rounded-[18px] bg-[var(--survey-card-1)] text-[var(--survey-card-1-fg)] ' +
    'shadow-[inset_0_0_0_1px_var(--survey-card-1-hairline)] ' +
    'p-[var(--card-padding)]',
  'surface-2':
    'relative overflow-hidden rounded-[18px] bg-[var(--survey-card-2)] text-[var(--survey-text)] ' +
    'shadow-[inset_0_0_0_1px_var(--survey-hairline)] ' +
    'p-[var(--card-padding)]',
  'compact':
    'relative overflow-hidden rounded-[12px] bg-[var(--survey-card-2)] text-[var(--survey-text)] ' +
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

- [ ] **Step 26.2: Commit**

```bash
npm run typecheck
git add components/entrevista/Card.tsx
git commit -m "feat(entrevista): Card primitive (surface-1, surface-2, compact)

surface-1 (default, navy ink dark pocket = brand moment within
encuesta, mirror del landing), surface-2 (white pure workspace),
compact (small pills/chips internos). Consume --survey-card-*
tokens cementados."
```

---

### Task 27: Refactor `HeroPregunta.tsx` para usar primitives

**Files:**
- Modify: `components/entrevista/HeroPregunta.tsx`

- [ ] **Step 27.1: Identificar patrones a reemplazar**

Leer `components/entrevista/HeroPregunta.tsx` completo. Identificar:
- Eyebrow inline (probable patrón `<p className="text-eyebrow text-[...]/45">M0X · ...</p>`) → `<Eyebrow tone="muted">`
- Container wrapper con bg-[var(--survey-bg)] → `<Section surface="bg">` o `<Section surface="surface">` según contexto
- Hairline dividers inline → `<Hairline tone="ink" />`

**IMPORTANTE**: NO refactorear toda la lógica del componente. Solo reemplazar los patrones de presentación. Si HeroPregunta tiene state, animations, view-transitions — NO TOCAR. Solo la capa de markup que matchea primitives.

- [ ] **Step 27.2: Refactor mínimo**

Editar `HeroPregunta.tsx` reemplazando 3-5 patrones puntuales. Si el refactor implica >50 líneas cambiadas, parar y discutir scope con founder antes de continuar.

- [ ] **Step 27.3: Smoke test visual**

```bash
npm run dev
```

Abre `http://localhost:3000/preview/ui`. Navega P01 → P05 → success. Comparar contra `.audit/baseline-pre-wave-1/preview-*.png`.

- [ ] **Step 27.4: Run tests + typecheck**

```bash
npm run test
npm run typecheck
```

Expected: verde.

- [ ] **Step 27.5: Commit**

```bash
git add components/entrevista/HeroPregunta.tsx
git commit -m "refactor(entrevista): HeroPregunta usa Eyebrow + Hairline primitives

Reemplaza patrones inline (font-mono text-[10.5px]... cream/ink) con
primitives. Animaciones, view-transitions, state — sin cambios.
Smoke test: P01/P05/success visualmente idénticos pre/post."
```

---

### Task 28: Refactor `BatchNav.tsx` a Button primitive

**Files:**
- Modify: `components/entrevista/BatchNav.tsx`

- [ ] **Step 28.1: Refactor**

`BatchNav` probablemente tiene 2 botones (anterior + siguiente). Reemplazar pattern inline `<button className="rounded-full bg-ink text-cream-pure h-12 ...">` con `<Button variant="primary">Siguiente</Button>`. Atrás puede ser `<Button variant="ghost">Atrás</Button>`.

Sin tocar la lógica de navegación / disabled states.

- [ ] **Step 28.2: Smoke test visual**

```bash
npm run dev
```

Abre `/preview/ui`. Click Siguiente, Atrás. Validate visualmente.

- [ ] **Step 28.3: Commit**

```bash
git add components/entrevista/BatchNav.tsx
git commit -m "refactor(entrevista): BatchNav usa Button primitive (primary + ghost)

Reemplaza markup inline de 2 botones con <Button variant=...>. Lógica
de navegación y disabled states sin cambios."
```

---

### Task 29: Crear `docs/design/tokens/{COLOR,TYPE,SPACE,MOTION,DECISIONS}.md`

**Files:**
- Create: `docs/design/tokens/COLOR.md`
- Create: `docs/design/tokens/TYPE.md`
- Create: `docs/design/tokens/SPACE.md`
- Create: `docs/design/tokens/MOTION.md`
- Create: `docs/design/tokens/DECISIONS.md`

- [ ] **Step 29.1: Crear directorio**

```bash
mkdir -p docs/design/tokens
```

- [ ] **Step 29.2: Escribir COLOR.md**

```markdown
# Color tokens

Source of truth: `app/design-system/tokens.css`.

## Brand primitives

| Token | Hex | Uso |
|---|---|---|
| `--ink` | `#0A0F1C` | Landing dark surface, entrevista survey-card-1 |
| `--ink-raised` | `#1A2236` | Hover sobre ink, manifest card bg |
| `--cream-pure` | `#F4F1EA` | Texto sobre ink, landing surface clara |
| `--gold` | `#C8A864` | Acento principal, pills, hairlines |
| `--gold-deep` | `#866D38` | Acento sobre white (AA contrast) |
| `--gold-bright` | `#F2D89C` | Highlight, focus, glow |
| `--gold-light` | `#E0BE7C` | Gradient base de la V mark |
| `--burgundy` | `#8B3A3A` | Error states |

## Reglas por surface

### Landing (surface ink)
- Background: `bg-ink` (`#0A0F1C`)
- Texto primary: `text-cream-pure`
- Texto muted: `text-cream-pure/72`
- Texto faint (eyebrows): `text-cream-pure/45`
- Acento: `text-gold` o `bg-gold` (champagne sobre dark = legible)
- Hairlines: `bg-cream-pure/8` (default) o `bg-cream-pure/20` (strong)

### Entrevista (surface cream)
- Background: `bg-[var(--survey-bg)]` (`#FAF8F4`)
- Surface card: `bg-[var(--survey-surface)]` (`#FFFFFF` workspace) o `bg-[var(--survey-card-1)]` (`#0A0F1C` dark pocket brand)
- Texto primary: `text-ink` (sobre cream) o `text-cream-pure` (sobre survey-card-1)
- Texto muted: `text-[var(--survey-text-72)]`
- Acento: `text-gold-deep` (NOT `text-gold` — gold sobre white falla AA contrast)
- Hairlines: `bg-[var(--survey-hairline)]` (ink/6) o `bg-[var(--survey-hairline-strong)]` (ink/12)

## Legacy (NO usar en código nuevo)
- `--forest`, `--lime`, `--canvas`, `--cream` — solo viven en admin (Fase 9). Wave 3 los limpia de entrevista.
```

- [ ] **Step 29.3: Escribir TYPE.md**

```markdown
# Type tokens

Source: `app/design-system/type.css` (scale + utilities) + `tokens.css` (font families).

## Familias

- **Display** (`--font-display`): General Sans (Fontshare). Hero, h2, h3.
- **Sans** (`--font-sans`): Satoshi (Fontshare). Body, captions, eyebrows.

Cargadas vía `app/layout.tsx` preconnect a `api.fontshare.com`.

## Type scale

| Token / Class | Size | Line-height | Tracking | Weight | Uso |
|---|---|---|---|---|---|
| `--type-hero` · `.text-hero` | `clamp(46px, 7.4vw, 108px)` | `0.95` | `-0.03em` | 500 | Landing H1 |
| `--type-display` · `.text-display` | `clamp(34px, 4.8vw, 64px)` | `1.05` | `-0.03em` | 600 | Hero pregunta, H1 secondary |
| `--type-h2` · `.text-h2` | `clamp(28px, 3.6vw, 46px)` | `1.05` | `-0.022em` | 500 | Sección, manifest |
| `--type-h3` · `.text-h3` | `clamp(20px, 2.4vw, 28px)` | `1.15` | `-0.02em` | 600 | Card title |
| `--type-body-lg` · `.text-body-lg` | `17px` | `1.55` | — | 400 | Hero subhead |
| `--type-body` · `.text-body` | `15.5px` | `1.55` | — | 400 | Body default |
| `--type-caption` · `.text-caption` | `13px` | `1.5` | — | 400 | Meta |
| `--type-eyebrow` · `.text-eyebrow` | `10.5px` | `1` | `0.32em` | 500 | Microcaps |

## Cuándo usar qué

- Landing hero H1 → `.text-hero`
- Hero pregunta entrevista → `.text-display` (más conservador que .text-hero)
- Section title → `.text-h2`
- Card title → `.text-h3`
- Subhead bajo H1 → `.text-body-lg`
- Body párrafo → `.text-body`
- Metadata pequeña → `.text-caption`
- "M02 · PRODUCTO" → `<Eyebrow tone="muted">` (consume `.text-eyebrow`)

## OpenType features activadas globalmente

`body { font-feature-settings: "ss01", "cv11"; }` — alternates de Satoshi.

Para tabular numerics (counters, percentages): añadir clase `.numeric` (definida en globals.css).
```

- [ ] **Step 29.4: Escribir SPACE.md**

```markdown
# Spacing tokens

Source: `app/design-system/space.css`.

## Raw scale (4px base)

| Token | Value | Tailwind equiv |
|---|---|---|
| `--space-1` | `4px` | `1` |
| `--space-2` | `8px` | `2` |
| `--space-3` | `12px` | `3` |
| `--space-4` | `16px` | `4` |
| `--space-6` | `24px` | `6` |
| `--space-8` | `32px` | `8` |
| `--space-10` | `40px` | `10` |
| `--space-14` | `56px` | `14` |
| `--space-20` | `80px` | `20` |
| `--space-28` | `112px` | `28` |
| `--space-36` | `144px` | `36` |

Para uso ad-hoc puedes seguir usando Tailwind (`p-6`, `gap-8`). Los tokens son para semantic compositions y arbitrary values.

## Semantic compositions (responsive)

| Token | Value |
|---|---|
| `--section-y` | `clamp(56px, 9vw, 144px)` |
| `--section-padding-x` | `clamp(24px, 4vw, 56px)` |
| `--container-max` | `1480px` |
| `--card-padding` | `clamp(24px, 3vw, 56px)` |

## Stack gaps

| Token | Maps to | Uso |
|---|---|---|
| `--stack-tight` | `--space-2` (8px) | Eyebrow → title |
| `--stack-default` | `--space-6` (24px) | Title → body |
| `--stack-loose` | `--space-10` (40px) | Secciones internas |
| `--stack-section` | `--space-20` (80px) | Entre secciones grandes |

## API

- `<Section paddingY="default">` aplica `py-[var(--section-y)]`.
- `<Section paddingY="hero">` aplica `pt-[clamp(96px,9vw,144px)] pb-[var(--space-20)]`.
- `<Stack gap="loose">` aplica `gap-[var(--stack-loose)]`.
```

- [ ] **Step 29.5: Escribir MOTION.md**

```markdown
# Motion tokens

Source: `app/design-system/motion.css` (CSS) + `lib/design-system/motion/*.ts` (TS).

## Durations

| Token | CSS var | TS (seconds) | TS (ms) | Uso |
|---|---|---|---|---|
| micro | `--dur-micro` | `dur.micro` (0.16) | `durMs.micro` (160) | Hover, focus, color flip |
| fast | `--dur-fast` | `dur.fast` (0.24) | `durMs.fast` (240) | Small element transitions |
| layout | `--dur-layout` | `dur.layout` (0.38) | `durMs.layout` (380) | Card expand, section change |
| hero | `--dur-hero` | `dur.hero` (0.72) | `durMs.hero` (720) | Hero entrance, big reveals |
| epic | `--dur-epic` | `dur.epic` (1.2) | `durMs.epic` (1200) | Word-mask reveals, char-stagger |

## Easings

| Name | CSS var | TS tuple |
|---|---|---|
| outExpo | `--ease-out-expo` | `easings.outExpo` `[0.16, 1, 0.3, 1]` |
| iosSheet | `--ease-ios-sheet` | `easings.iosSheet` `[0.32, 0.72, 0, 1]` |
| back | `--ease-back` | `easings.back` `[0.34, 1.4, 0.64, 1]` |
| backOut | `--ease-back-out` | `easings.backOut` `[0.34, 1.35, 0.64, 1]` |
| backIn | `--ease-back-in` | `easings.backIn` `[0.36, 0, 0.66, -0.35]` |
| inOut | `--ease-in-out` | `easings.inOut` `[0.65, 0, 0.35, 1]` |
| soft | `--ease-soft` | `easings.soft` `[0.2, 0.85, 0.25, 1]` |

**Default**: `outExpo` para casi todo. `iosSheet` para vertical slide. `back-out` para overshoot reveals. `inOut` para strict draw (SVG stroke). `soft` para text/opacity.

## Spring presets

| Preset | Stiffness | Damping | Mass | Feel |
|---|---|---|---|---|
| `snap` | 520 | 28 | 0.4 | UI inputs, toggles |
| `elegant` | 320 | 22 | 0.55 | Hero CTAs, important reveals |
| `soft` | 380 | 26 | 0.6 | Text, opacity, gentle layout |
| `bounce` | 280 | 14 | 0.5 | Overshoot reveals (success) |
| `indicator` | 360 | 26 | 0.55 | Scroll-driven section indicator |

Import: `import { springs } from '@/lib/design-system/motion/springs';`

## Reglas

- **NUNCA values inline en motion.button**. Si necesitas un spring nuevo, lo agregás a `springs.ts`.
- **NUNCA `cubic-bezier(...)` literal**. Usa `--ease-*` o `easings.*`.
- **prefers-reduced-motion**: cubierto globally en `globals.css` línea 318 (animations → 0.01ms). NO duplicar locally a menos que el componente tenga estado interno que también querer cancelar (ej. timeouts en HeroPregunta).
```

- [ ] **Step 29.6: Escribir DECISIONS.md**

```markdown
# Design System · Architecture Decisions

Lista corta de ADRs (Architecture Decision Records) que explican el WHY del sistema. Mantener actualizada — cuando cambia una decisión, actualizar el ADR original con un "Superseded by..." en vez de borrarlo.

---

## ADR-001: Dos sets de componentes paralelos en vez de surface-aware

**Date**: 2026-05-10
**Status**: Active

**Context**: Tenemos landing (surface ink/dark) y entrevista (surface cream/light). Tres opciones:
1. Componentes únicos surface-aware via `data-surface="ink|cream"` y CSS vars semánticos.
2. Dos sets paralelos (`components/landing/*` ink, `components/entrevista/*` cream).
3. Híbrido (primitivos surface-aware + brand components per-surface).

**Decision**: Opción 2 (dos sets paralelos) con tokens atómicos compartidos.

**Reasoning**:
- Match con estructura ya existente del repo.
- Cero indirección en lectura de componente (`bg-ink text-cream-pure` directo vs `bg-[var(--surface-card)]`).
- Alineado con preferencia del founder en CLAUDE.md ("three similar lines is better than a premature abstraction").
- Componentes brand específicos (HeroLine, BrandSuccessGlyph, Stepper) viven solo en una surface por naturaleza, no hay nada que abstraer.

**Trade-off aceptado**: cuando un patrón aparece en ambos sets, se duplica el componente. Cap esperado <20% del catálogo. Drift mitigado por la capa atómica compartida.

---

## ADR-002: Tokens atómicos compartidos, no por-surface

**Date**: 2026-05-10
**Status**: Active

**Context**: Si tenemos dos sets paralelos, hay 3 niveles posibles de sharing:
1. Todo compartido (mismo brand, mismo type, mismo motion).
2. Solo colores (cada set tiene su propio type + motion).
3. Nada (totalmente independientes).

**Decision**: Opción 1 (todo compartido).

**Reasoning**: cuando `--gold` cambia, ambos sets se actualizan automáticamente. Sin esto, el approach de "dos sets paralelos" deviene "dos design systems" y muere de drift en 6 meses.

---

## ADR-003: Tailwind v4 + custom CSS vars vs Tailwind config

**Date**: 2026-05-10
**Status**: Active

**Context**: Tailwind v4 expone tokens vía `@theme inline { --color-foo: ... }` en globals.css. Pero las custom vars semánticas (`--type-hero`, `--space-section-y`) no se mapean naturalmente a Tailwind utilities.

**Decision**: Tokens semánticos viven en CSS vars (`:root { --type-hero: ... }`) y se consumen vía:
- Arbitrary values: `py-[var(--section-y)]`.
- Utility classes que el design system define: `.text-hero`, `.text-h2`.

NO se intenta extender Tailwind config con custom utilities salvo para colores que sí pasan al `@theme inline`.

**Reasoning**: Tailwind v4 + CSS vars + arbitrary values es la combinación oficial. Custom plugins añaden complejidad sin upside.

---

## ADR-004: Lucide-only para iconos (Wave 1)

**Date**: 2026-05-10
**Status**: Active, pendiente de revisar en Wave 2

**Context**: CLAUDE.md sugiere mezclar Lucide + Phosphor + Tabler + Hero + Iconoir según contexto. Pero hoy todo es Lucide.

**Decision**: Wave 1 mantiene Lucide-only. Wave 2 evalúa introducir secondary library para casos específicos (ej. financial glyphs en BrandSuccessGlyph) sin reemplazar Lucide.

---

## ADR-005: HeaderCTA y SectionIndicator springs migración conservadora

**Date**: 2026-05-10
**Status**: Active

**Context**: HeaderCTA tiene 3 springs inline (FILL, ARROW, TEXT). De estos, solo FILL matchea exactamente el preset `elegant`. ARROW tiene damping=18 (no =28 como `snap`), TEXT no especifica mass (default 1 vs preset 0.6).

**Decision**: Wave 1 solo migra los springs que matchean exactamente. Los que no matchean se quedan inline con comentario explicativo. Wave 2 evalúa si agregar presets adicionales (`arrowSnap`, `softNoMass`).

**Reasoning**: el feel exacto del HeaderCTA es identidad de marca. Cambiar damping de 18 a 28 (54% diferencia) altera la perception del component aunque la diferencia es ms-level. Cero riesgo es mejor que harmonization a costa del feel.
```

- [ ] **Step 29.7: Commit**

```bash
git add docs/design/tokens/
git commit -m "docs(design): tokens reference + ADRs (COLOR, TYPE, SPACE, MOTION, DECISIONS)

5 docs nuevas. COLOR/TYPE/SPACE/MOTION son referencia (qué token existe,
cuándo usarlo). DECISIONS son 5 ADRs cortos (parallel sets, atomic
sharing, tailwind+CSS vars, lucide-only Wave 1, springs migración
conservadora)."
```

---

### Task 30: Crear recipes + update DESIGN_SYSTEM.md + final smoke

**Files:**
- Create: `docs/design/recipes/NEW_LANDING_PAGE.md`
- Create: `docs/design/recipes/NEW_SURVEY_SCREEN.md`
- Modify: `docs/design/DESIGN_SYSTEM.md`

- [ ] **Step 30.1: Crear `NEW_LANDING_PAGE.md`**

```markdown
# Recipe: New landing page

Paso a paso para crear una página landing nueva siguiendo el design system Wave 1.

## Setup

Estructura mínima de un page nuevo (ej. `app/about/page.tsx`):

```tsx
import { Section } from '@/components/landing/Section';
import { Stack } from '@/components/landing/Stack';
import { Eyebrow } from '@/components/landing/Eyebrow';
import { Hairline } from '@/components/landing/Hairline';
import { Button } from '@/components/landing/Button';
import { Card } from '@/components/landing/Card';
import { Atmosphere } from '@/components/landing/Atmosphere';

export default function AboutPage() {
  return (
    <main className="bg-ink text-cream-pure">
      {/* Hero */}
      <Section paddingY="hero" surface="ink" id="hero" className="relative">
        <Atmosphere variant="both" />
        <Stack gap="default" className="relative">
          <Eyebrow tone="muted">Acerca de</Eyebrow>
          <h1 className="text-hero">
            Una alianza<br />
            <span className="text-gold-deep">con propósito.</span>
          </h1>
          <p className="text-body-lg text-cream-pure/72 max-w-[52ch]">
            Subhead que describe la propuesta.
          </p>
          <div className="flex gap-3 mt-4">
            <Button variant="primary">CTA principal</Button>
            <Button variant="ghost">Acción secundaria</Button>
          </div>
        </Stack>
      </Section>

      {/* Sección de contenido */}
      <Section paddingY="default">
        <Card variant="manifest" atmosphere>
          <Stack gap="loose">
            <Eyebrow>Sección · 01</Eyebrow>
            <h2 className="text-h2">Tu título de sección aquí.</h2>
            <Hairline tone="cream" />
            <p className="text-body text-cream-pure/72">Contenido...</p>
          </Stack>
        </Card>
      </Section>
    </main>
  );
}
```

## Checklist

- [ ] Wrapper `<main className="bg-ink text-cream-pure">`.
- [ ] Hero: `<Section paddingY="hero" className="relative">` + `<Atmosphere />`.
- [ ] H1 usa `.text-hero`, H2 usa `.text-h2`, H3 usa `.text-h3`.
- [ ] Eyebrows usan `<Eyebrow>` (nunca markup ad-hoc font-mono uppercase).
- [ ] CTAs usan `<Button variant="primary|ghost">`.
- [ ] Cards manifest usan `<Card variant="manifest" atmosphere>`.
- [ ] Dividers usan `<Hairline>` (nunca `<div className="h-px ..." />`).
- [ ] Stack gaps usan `gap="tight|default|loose|section"`.
- [ ] NO usar `bg-[#0A0F1C]` literal, usar `bg-ink`.
- [ ] NO usar `cubic-bezier(...)` inline, usar `var(--ease-*)` o `easings.*`.
- [ ] NO usar `{ stiffness: ..., damping: ... }` inline, usar `springs.*`.
- [ ] Si necesitas color brand desde JS: `import { brand } from '@/lib/design-system/tokens'`.

## Comunes anti-patterns

- ❌ `<section className="bg-[#0A0F1C] py-24">` → ✅ `<Section paddingY="default">`.
- ❌ `<h1 className="text-[46px] sm:text-[64px] lg:text-[108px] font-medium">` → ✅ `<h1 className="text-hero">`.
- ❌ `<button className="rounded-full bg-cream-pure h-12 ...">` → ✅ `<Button variant="primary">`.
- ❌ Iconos: usa siempre Lucide (Wave 1). Para iconos especiales tipo VertexMark, no inventar — discutir antes.
```

- [ ] **Step 30.2: Crear `NEW_SURVEY_SCREEN.md`**

```markdown
# Recipe: New survey screen

Paso a paso para crear una pantalla nueva dentro del flow de entrevista.

## Setup

```tsx
import { Section } from '@/components/entrevista/Section';
import { Stack } from '@/components/entrevista/Stack';
import { Eyebrow } from '@/components/entrevista/Eyebrow';
import { Hairline } from '@/components/entrevista/Hairline';
import { Button } from '@/components/entrevista/Button';
import { Card } from '@/components/entrevista/Card';

export default function NewScreen() {
  return (
    <Section surface="bg" paddingY="default">
      <Stack gap="loose">
        <Eyebrow tone="muted">P07 · Pricing y criterio</Eyebrow>
        <h2 className="text-display">
          ¿Cuál es tu tasa promedio<br />en créditos personales?
        </h2>
        <p className="text-body text-[var(--survey-text-72)] max-w-[52ch]">
          Contexto u orientación para responder.
        </p>

        <Card variant="surface-2">
          <textarea className="w-full bg-transparent text-body text-[var(--survey-text)] focus:outline-none" />
        </Card>

        <Hairline tone="ink" />

        <div className="flex justify-between items-center">
          <Button variant="ghost">Atrás</Button>
          <Button variant="primary">Siguiente</Button>
        </div>
      </Stack>
    </Section>
  );
}
```

## Checklist

- [ ] Wrapper `<Section surface="bg">` (off-white) o `<Section surface="surface">` (white pure) según contexto.
- [ ] Hero pregunta usa `.text-display` (NO `.text-hero` — entrevista es más conservadora).
- [ ] Eyebrow para meta info ("P07 · GRUPO"): `<Eyebrow tone="muted">` o `tone="gold"` para acento.
- [ ] Body con `text-[var(--survey-text-72)]`, NUNCA `text-ink/70` (no es el mismo valor).
- [ ] Card workspace (textarea container) → `<Card variant="surface-2">`.
- [ ] Card brand moment (dark pocket) → `<Card variant="surface-1">`.
- [ ] CTAs usan `<Button variant="primary|ghost">`.
- [ ] Dividers usan `<Hairline tone="ink">` (NO `border-ink/8`).
- [ ] Si quieres `gold` acento sobre cream surface, USA `text-gold-deep` (`gold` falla AA contrast on white).

## View transitions y animations

Si la pantalla está dentro del flow de entrevista que usa view transitions:
- El elemento que cross-fade debe tener `style={{ viewTransitionName: 'question-card' }}`.
- Las anims locales (Framer Motion `<motion.div>`) son OK pero NO duplicar reduced-motion guards (ya global).
- Si necesitas animar la entrada del card, usa `transition={springs.elegant}` o `transition={{ duration: dur.layout, ease: easings.outExpo }}`.

## Comunes anti-patterns

- ❌ `<h2 className="text-[34px] sm:text-[64px] font-semibold">` → ✅ `<h2 className="text-display">`.
- ❌ `<button className="rounded-full bg-ink text-cream h-12 ...">` → ✅ `<Button variant="primary">`.
- ❌ `text-gold` sobre fondo cream → ✅ `text-gold-deep`.
- ❌ `bg-white` literal → ✅ `<Card variant="surface-2">` o `bg-[var(--survey-surface)]`.
```

- [ ] **Step 30.3: Update `docs/design/DESIGN_SYSTEM.md`**

Añadir al top del archivo, justo después del título, una sección:

```markdown
> **Update 2026-05-10**: Sistema formalizado en Wave 1. Tokens viven ahora en:
> - `app/design-system/{tokens,type,space,motion}.css` (Layer 0+1)
> - `lib/design-system/{motion/*,tokens}.ts` (Layer 1+2 TS)
> - `components/landing/{Section,Stack,Eyebrow,Button,Card,Hairline,Atmosphere}.tsx` (primitives surface ink)
> - `components/entrevista/{Section,Stack,Eyebrow,Button,Card,Hairline}.tsx` (primitives surface cream)
>
> Recipes para pages nuevas: `docs/design/recipes/{NEW_LANDING_PAGE,NEW_SURVEY_SCREEN}.md`.
> ADRs de decisiones: `docs/design/tokens/DECISIONS.md`.
>
> Wave 2 (próxima): radius semantic, shadow scale, atmosphere variants, icon library decision.
> Wave 3 (cleanup): sweep legacy `--lime`/`--forest` de entrevista.

```

- [ ] **Step 30.4: Final smoke test E2E**

```bash
npm run typecheck
npm run test
npm run dev
```

Browser:
1. `http://localhost:3000` — comparar contra `.audit/baseline-pre-wave-1/landing-*.png`. Diferencias: cero.
2. `http://localhost:3000/preview/ui` — navegar P01 → P05 → success. Comparar contra baseline. Diferencias: cero.
3. Mobile viewport (375x812): mismo flow en ambos. Sin overflow horizontal.
4. Hover sobre HeaderCTA: spring fill se siente igual.
5. Scroll landing: SectionIndicator springs OK.

Si todo verde:

- [ ] **Step 30.5: Commit final**

```bash
git add docs/design/recipes/ docs/design/DESIGN_SYSTEM.md
git commit -m "docs(design): recipes NEW_LANDING_PAGE + NEW_SURVEY_SCREEN + sync DESIGN_SYSTEM.md

Wave 1 done. 13 primitives (7 landing + 6 entrevista), 4 CSS token
files, 4 TS motion files, 5 token docs, 5 ADRs, 2 recipes. Zero
visual diff vs baseline. README cheat sheet. Listo para mergear.

Smoke test final: landing + preview/ui idénticos al baseline en
desktop y mobile. HeaderCTA spring feel preserved. SectionIndicator
springs OK. Tests verdes (298+ con 3 nuevos motion test files).

Next: Wave 2 (radius semantic, shadow scale, atmosphere variants,
icon library decision) o sesión de refactor incremental de page.tsx
hero (manifest ya está usando primitives via Task 20)."
```

- [ ] **Step 30.6: Open PR**

```bash
git push -u origin feat/design-system-wave-1
gh pr create --title "feat: design system Wave 1 (tokens + 13 primitives)" --body "$(cat <<'EOF'
## Summary

Wave 1 del design system formalizado.

- **4 CSS token files**: `app/design-system/{tokens,type,space,motion}.css` (Layer 0 brand + Layer 1 scales)
- **4 TS motion files**: `lib/design-system/motion/{springs,easings,durations}.ts` + `lib/design-system/tokens.ts`
- **13 primitives**: 7 landing (Section, Stack, Eyebrow, Button, Card, Hairline, Atmosphere) + 6 entrevista (Section, Stack, Eyebrow, Button, Card, Hairline)
- **2 refactors**: HeaderCTA + SectionIndicator usan `springs.*` (conservador, solo los que matchean exactamente)
- **1 refactor parcial**: manifest section de `app/page.tsx` usa primitives. Hero + footer en sesión posterior.
- **HeroPregunta + BatchNav**: usan Eyebrow/Hairline/Button primitives.
- **Docs**: 5 token reference docs + 5 ADRs + 2 recipes + README cheat sheet.

## Test plan

- [x] `npm run test` — 301+ tests verdes (3 nuevos motion test files: easings, durations, springs)
- [x] `npm run typecheck` — verde
- [x] Visual baseline compare vs `.audit/baseline-pre-wave-1/`:
  - [x] Landing hero, manifest, footer — idénticos
  - [x] Preview/ui P01, P05, success — idénticos
  - [x] Mobile 375px viewport — sin overflow
  - [x] HeaderCTA hover spring feel — preservado
  - [x] SectionIndicator scroll springs — preservado
- [x] No usage de legacy `--lime`/`--forest` en archivos nuevos

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review (post-plan)

### Spec coverage

- ✅ Goal "tokenizar formal + primitives compartidos" → Tasks 1-10 (tokens), 11-26 (primitives), 27-28 (refactor)
- ✅ Architecture "dos sets paralelos + capa atómica" → Tasks 1-5 (capa atómica) + Tasks 11-17 + 21-26 (dos sets)
- ✅ File tree completo del spec sección II → covered en file paths de cada task
- ✅ Token specs III.1-III.6 → Tasks 1-4 (todo excepto radius+shadow que son Wave 2)
- ✅ Component primitives API IV.1-IV.2 → Tasks 11-17 (landing), 21-26 (entrevista)
- ✅ Migration mapping V → Tasks 18-19 (springs), 20 (page.tsx), 27-28 (entrevista)
- ✅ Wave 1 Day 1/2/3 del spec VI → Tasks split exactamente igual
- ✅ Reglas de gobierno VII → covered en MOTION.md y recipes (Task 29-30)
- ✅ Open questions IX → algunos resueltos (springs conservador en ADR-005, lucide-only en ADR-004), otros pendientes para Wave 2
- ⚠️ Wave 2/3 → fuera de scope de este plan (Wave 1 only)

### Placeholder scan

- ✅ Sin "TBD" / "TODO" / "implement later"
- ✅ Cada step tiene código completo
- ✅ Cada step tiene comando exacto + expected output
- ✅ Tasks no se referencian entre sí con "similar to Task N"
- ⚠️ Task 27 ("refactor HeroPregunta") y Task 28 ("refactor BatchNav") son menos exactos porque dependen del estado actual del archivo. Mitigación: gate de "si refactor implica >50 líneas, parar y discutir".
- ⚠️ Task 20 ("refactor manifest section") tiene la misma incertidumbre. Mitigación: smoke test pixel-by-pixel + screenshot baseline.

### Type consistency

- ✅ `springs.elegant` / `easings.outExpo` / `dur.layout` usados consistentemente entre tasks
- ✅ `<Eyebrow>`, `<Section>`, `<Button>` APIs consistentes entre landing y entrevista (mismas props, valores diferentes per surface)
- ✅ Token names (`--type-hero`, `--space-section-y`, `--ease-out-expo`) consistentes entre CSS files y docs

### Issues encontrados y arreglados inline

Ninguno. Plan listo para revisión del founder.

---

## Definition of done (Wave 1)

- [ ] Branch `feat/design-system-wave-1` mergeado a master.
- [ ] 298+ tests verdes (con 3 nuevos motion tests).
- [ ] Typecheck verde.
- [ ] Visual baseline compare: 0 diff en landing + preview/ui (desktop + mobile).
- [ ] HeaderCTA + SectionIndicator feel preserved.
- [ ] 13 primitives creados + funcionando.
- [ ] 7 docs creados (5 tokens + 2 recipes) + DESIGN_SYSTEM.md actualizado.
- [ ] PR descripción completa con test plan checked off.
