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
