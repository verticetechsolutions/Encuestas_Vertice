# Design System · Tokenización formal y primitivos compartidos

**Status**: Draft → Pending review
**Date**: 2026-05-10
**Author**: Opsyo + Claude (creative director session)
**Spec type**: Architecture + execution plan
**Supersedes**: `docs/design/DESIGN_SYSTEM.md` (lo conserva como referencia histórica del sistema vivo; este spec define el sistema formalizado)

---

## Goal

Pasar de un design system **documentado pero ad-hoc** (utilities sueltas, clamp inline en cada componente, springs hardcoded en cada `motion.button`) a un sistema **tokenizado y consumible** que permita construir páginas nuevas en landing (surface ink/dark) y entrevista (surface cream/light) sin reinventar tokens ni driftear de la marca.

**Out of scope**: admin/dashboard interno (sigue con legacy `--lime` / `--forest`). Auth/onboarding (no priorizado por founder).

**In scope**:
- Marketing/landing: pages adicionales (about, pricing, features, casos, legal). Surface dark (`--ink`).
- Entrevista: nuevas pantallas dentro del flow (tipos de pregunta, intermissions, errors, success, pause/resume). Surface light (`--cream-pure`).

---

## Decisión arquitectónica principal

**Dos sets de componentes paralelos** (`components/landing/*` ink+gold vs `components/entrevista/*` cream+gold-deep) que consumen una **capa atómica compartida** de tokens (color, type, motion, spacing, springs, radii).

Esto NO es approach C (híbrido surface-aware). Es approach B con tokens atómicos unificados. Justificación:

1. Match con la arquitectura ya existente (`components/landing/` y `components/entrevista/` ya separadas).
2. Cero indirección en la lectura del componente: `bg-ink text-cream-pure` se lee directo, sin `bg-[var(--surface-card)]`.
3. Alineado con preferencia documentada del usuario en CLAUDE.md ("three similar lines is better than premature abstraction").
4. Anti-drift cubierto por la capa atómica: cuando `--gold` cambia, ambos sets se actualizan automáticamente.
5. Componentes brand específicos (HeroLine, BrandSuccessGlyph, StepperVertical) tienen sentido solo en su surface — no hay nada que abstraer.

Trade-off aceptado: si un día se necesita un componente que sirva en ambas surfaces, se construye dos veces. El cap esperado de este caso es <20% del catálogo.

---

## I. Arquitectura de capas

```
Layer 0 · Brand primitives             ← single source of truth
  └── colors, font families, base scales (atomic CSS vars)

Layer 1 · Scale tokens                 ← derived from primitives
  ├── type scale (--type-hero, --type-h2, --type-body, ...)
  ├── space scale (--space-1..36 + semantic compositions)
  ├── motion (--dur-*, --ease-*)
  ├── radii (--radius-* semantic)
  └── shadow/hairline (--shadow-*)

Layer 2 · Motion presets TS            ← reusable framer-motion values
  ├── springs.ts (5 presets: snap, elegant, soft, bounce, indicator)
  ├── easings.ts (out-expo, ios-sheet, back, in-out)
  └── durations.ts (matched a CSS vars)

Layer 3a · Landing primitives          ← surface ink, consume Layer 0-2
  ├── Section, Stack, Eyebrow, Button, Card, Hairline, Atmosphere
  └── + existentes: VertexMark, HeroLine, HeaderCTA, BrandSuccessGlyph, etc.

Layer 3b · Entrevista primitives       ← surface cream, consume Layer 0-2
  ├── Section, Stack, Eyebrow, Button, Card, Hairline
  └── + existentes: Stepper, HeroPregunta, BatchNav
```

Reglas:
- **Layer 3a/3b NUNCA se referencian entre sí.** Si un patrón se necesita en ambos lados, se duplica.
- **Layer 3a/3b SIEMPRE consumen tokens, nunca brand colors hardcoded.** Excepción: componentes brand-locked donde el color ES la identidad (ej. el spark gold de BrandSuccessGlyph).

---

## II. File tree concreto

```
app/
├── globals.css                         (refactor: importa design-system, mantiene shadcn + dark mode)
├── design-system/                      (nuevo)
│   ├── tokens.css                      (Layer 0 + 1: brand + scales)
│   ├── type.css                        (utilities .text-hero, .text-h2, .text-body, .text-eyebrow…)
│   ├── space.css                       (semantic composition utilities)
│   └── motion.css                      (keyframes globales + duration/easing CSS vars)

lib/
├── design-system/                      (nuevo)
│   ├── motion/
│   │   ├── springs.ts                  (Layer 2: framer-motion presets)
│   │   ├── easings.ts                  (TS strings que matchean motion.css vars)
│   │   └── durations.ts                (TS numbers en ms que matchean CSS)
│   ├── tokens.ts                       (TS export de brand colors + families para uso JS)
│   └── README.md                       (cheat sheet: cómo importar y usar)

components/
├── landing/                            (existente, agregamos primitivos)
│   ├── [existentes: VertexMark, HeaderCTA, HeroLine, BrandSuccessGlyph, …]
│   ├── Section.tsx                     (nuevo)
│   ├── Stack.tsx                       (nuevo)
│   ├── Eyebrow.tsx                     (nuevo)
│   ├── Button.tsx                      (nuevo: 3 variants pill primary, ghost, header)
│   ├── Card.tsx                        (nuevo: manifest card pattern)
│   ├── Hairline.tsx                    (nuevo: gold seam + variants)
│   └── Atmosphere.tsx                  (nuevo: radial gold + noise wrapper)
│
└── entrevista/                         (existente, agregamos primitivos)
    ├── [existentes: Stepper, HeroPregunta, BatchNav]
    ├── Section.tsx                     (nuevo)
    ├── Stack.tsx                       (nuevo)
    ├── Eyebrow.tsx                     (nuevo)
    ├── Button.tsx                      (nuevo: pill ink solid + ghost ink/8)
    ├── Card.tsx                        (nuevo: survey-card-1 ink + survey-card-2 white)
    └── Hairline.tsx                    (nuevo: ink/8 + gold/22)

docs/design/
├── DESIGN_SYSTEM.md                    (refactor → vivo, refleja sistema formalizado)
├── tokens/                             (nuevo)
│   ├── COLOR.md                        (paleta + reglas de uso por surface)
│   ├── TYPE.md                         (scale + utilities + reglas tipográficas)
│   ├── SPACE.md                        (ritmo + container + semantic compositions)
│   ├── MOTION.md                       (durations + easings + springs + reduced-motion policy)
│   └── DECISIONS.md                    (ADRs cortos: por qué dos sets paralelos, por qué tokens atómicos, etc.)
└── recipes/                            (nuevo)
    ├── NEW_LANDING_PAGE.md             (receta paso a paso para crear página landing nueva)
    └── NEW_SURVEY_SCREEN.md            (receta paso a paso para pantalla entrevista nueva)
```

---

## III. Token specifications

### III.1 Brand primitives (Layer 0)

Sin cambios respecto al estado actual. Solo se mueven de `globals.css` a `app/design-system/tokens.css` para limpiar globals.

```css
:root {
  /* Color */
  --ink:         #0A0F1C;
  --ink-raised:  #1A2236;
  --cream-pure:  #F4F1EA;
  --gold:        #C8A864;
  --gold-deep:   #866D38;   /* AA on white */
  --gold-bright: #F2D89C;
  --gold-light:  #E0BE7C;
  --burgundy:    #8B3A3A;

  /* Type families */
  --font-display: 'General Sans', 'Satoshi', ui-sans-serif, sans-serif;
  --font-sans:    'Satoshi', ui-sans-serif, sans-serif;

  /* Survey-specific surface tokens (heredados — quedan vivos) */
  --survey-bg:        #FAF8F4;
  --survey-surface:   #FFFFFF;
  --survey-card-1:    #0A0F1C;  /* navy ink dark pocket dentro de entrevista */
  --survey-card-2:    #FFFFFF;
}
```

### III.2 Type scale (Layer 1)

```css
:root {
  /* Display */
  --type-hero:    clamp(46px, 7.4vw, 108px);   /* H1 landing hero */
  --type-display: clamp(34px, 4.8vw, 64px);    /* H1 secondary, hero pregunta */
  --type-h2:      clamp(28px, 3.6vw, 46px);    /* manifest, sección */
  --type-h3:      clamp(20px, 2.4vw, 28px);    /* card title */

  /* Body */
  --type-body-lg: 17px;
  --type-body:    15.5px;
  --type-caption: 13px;
  --type-eyebrow: 10.5px;

  /* Leading + tracking */
  --leading-tight:   0.95;
  --leading-snug:    1.05;
  --leading-default: 1.55;
  --tracking-display: -0.03em;
  --tracking-h2:      -0.022em;
  --tracking-h3:      -0.02em;
  --tracking-eyebrow: 0.32em;
}
```

Utilities en `app/design-system/type.css`:

```css
.text-hero {
  font-family: var(--font-display);
  font-size: var(--type-hero);
  line-height: var(--leading-tight);
  letter-spacing: var(--tracking-display);
  font-weight: 500;
  font-feature-settings: "ss01", "cv11";
}

.text-display { /* renamed: ya existía como .text-display */
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

.text-body-lg { font-size: var(--type-body-lg); line-height: var(--leading-default); }
.text-body    { font-size: var(--type-body);    line-height: var(--leading-default); }
.text-caption { font-size: var(--type-caption); line-height: 1.5; opacity: 0.72; }

/* .text-eyebrow ya existe en globals.css — se mueve a type.css sin cambios. */
```

### III.3 Spacing scale (Layer 1)

Base 4px (Tailwind-compatible, no se rompe nada existente). Tokens semánticos compuestos para uso de alto nivel.

```css
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

  /* Semantic compositions */
  --section-y:         clamp(56px, 9vw, 144px);   /* py de cada section */
  --section-padding-x: clamp(24px, 4vw, 56px);    /* px interno de cards/manifest */
  --container-max:     1480px;                    /* match con landing actual */
  --card-padding:      clamp(24px, 3vw, 56px);    /* card interior */
  --stack-tight:       var(--space-2);            /* gap entre eyebrow + title */
  --stack-default:     var(--space-6);            /* gap entre title + body */
  --stack-loose:       var(--space-10);           /* gap entre secciones internas */
}
```

### III.4 Motion (Layer 1 + 2)

CSS vars en `app/design-system/motion.css`:

```css
:root {
  /* Durations */
  --dur-micro:  160ms;
  --dur-fast:   240ms;
  --dur-layout: 380ms;
  --dur-hero:   720ms;
  --dur-epic:   1200ms;  /* word-mask reveals, char-stagger landing */

  /* Easings */
  --ease-out-expo:  cubic-bezier(0.16, 1, 0.3, 1);
  --ease-ios-sheet: cubic-bezier(0.32, 0.72, 0, 1);
  --ease-back:      cubic-bezier(0.34, 1.4, 0.64, 1);
  --ease-back-out:  cubic-bezier(0.34, 1.35, 0.64, 1);
  --ease-back-in:   cubic-bezier(0.36, 0, 0.66, -0.35);
  --ease-in-out:    cubic-bezier(0.65, 0, 0.35, 1);
  --ease-soft:      cubic-bezier(0.2, 0.85, 0.25, 1);
}
```

TS mirrors en `lib/design-system/motion/easings.ts`:

```ts
export const easings = {
  outExpo:  [0.16, 1, 0.3, 1] as const,
  iosSheet: [0.32, 0.72, 0, 1] as const,
  back:     [0.34, 1.4, 0.64, 1] as const,
  backOut:  [0.34, 1.35, 0.64, 1] as const,
  backIn:   [0.36, 0, 0.66, -0.35] as const,
  inOut:    [0.65, 0, 0.35, 1] as const,
  soft:     [0.2, 0.85, 0.25, 1] as const,
};
```

`lib/design-system/motion/durations.ts`:

```ts
export const dur = {
  micro:  0.16,
  fast:   0.24,
  layout: 0.38,
  hero:   0.72,
  epic:   1.2,
} as const;
```

`lib/design-system/motion/springs.ts`:

```ts
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

### III.5 Radii (Layer 1, Wave 2)

```css
:root {
  --radius-sm:      8px;     /* inputs, tags pequeños */
  --radius-md:      12px;    /* small cards, buttons cuadrados */
  --radius-card:    18px;    /* card default */
  --radius-section: 28px;    /* manifest section, hero cards */
  --radius-pill:    9999px;  /* CTAs, ghost buttons, eyebrow chips */
}
```

### III.6 Shadow + hairline (Layer 1, Wave 2)

```css
:root {
  --shadow-hairline-ink:    inset 0 0 0 1px rgb(244 241 234 / 0.06);
  --shadow-hairline-cream:  inset 0 0 0 1px rgb(10 15 28 / 0.06);
  --shadow-gold-seam:       inset 0 1px 0 rgb(200 168 100 / 0.22);
  --shadow-card-ink:        var(--shadow-hairline-ink), var(--shadow-gold-seam);
  --shadow-cta-glow:        0 0 0 1px rgb(244 241 234 / 0.04),
                            0 30px 70px -20px rgb(200 168 100 / 0.45);
  --shadow-dialog:          0 30px 90px -20px rgb(0 0 0 / 0.5);
}
```

---

## IV. Component primitives — API contracts

### IV.1 Landing primitives (surface ink)

#### `<Section>`
```tsx
<Section
  surface="ink"                    // 'ink' | 'ink-raised' (default: 'ink')
  paddingY="default"               // 'default' | 'hero' | 'compact' | 'none'
  containerSize="default"          // 'default' | 'narrow' | 'wide' | 'full'
>
  {children}
</Section>
```
Emite el atributo `data-section` para selectors descendant si se necesita. Aplica `--section-y`, `--section-padding-x`, `max-width: var(--container-max)`.

#### `<Stack>`
```tsx
<Stack gap="default" align="start">
  {children}
</Stack>
```
gap: `'tight' | 'default' | 'loose' | 'section'` (mapeado a `--stack-*`).

#### `<Eyebrow>`
```tsx
<Eyebrow tone="muted">M02 · PRODUCTOS Y MERCADO</Eyebrow>
```
tone: `'muted' | 'gold' | 'cream'`. Aplica `.text-eyebrow` + color por tone.

#### `<Button>` (landing)
Variants:
- `primary` — pill cream sobre ink + inner ink/gold icon-pill + arrow 45° hover
- `ghost` — pill border cream/20 → cream/45 hover
- `header` — pill h-10 + spring fill backdrop-blur (extrae de `HeaderCTA.tsx`)

```tsx
<Button variant="primary" size="default" icon={ArrowUpRight}>
  Solicitar alianza
</Button>
```

#### `<Card>` (landing manifest)
```tsx
<Card variant="manifest">{children}</Card>
```
`manifest`: ink-raised background + gold seam superior + radius-section + atmosphere overlays.

#### `<Hairline>`
```tsx
<Hairline tone="gold" />              // 1px gold/55 horizontal
<Hairline tone="cream" weight="strong" /> // cream/20 vs cream/8
```

#### `<Atmosphere>`
```tsx
<Atmosphere variant="radial-gold" intensity="default" />
<Atmosphere variant="noise" />
```
Wrapper absolute con pointer-events-none. Combinable.

### IV.2 Entrevista primitives (surface cream)

Mismos componentes (mismo API mental) pero ink-on-cream:
- `<Section surface="cream">` — bg `--survey-bg`, text ink
- `<Button variant="primary">` — pill ink solid + cream text + gold-bright icon on hover
- `<Button variant="ghost">` — pill border ink/12 → ink/30 hover
- `<Card variant="surface-1">` — ink card (dark pocket dentro de entrevista, espejo del landing)
- `<Card variant="surface-2">` — white pure (workspace card, textarea container)
- `<Hairline tone="ink" />` — ink/6 default, ink/12 strong
- `<Eyebrow tone="muted">` — ink/45

**No hay Atmosphere en entrevista** — la encuesta es paper-clean, sin overlays.

### IV.3 Decision rule: ¿primitive landing o entrevista?

Test mental antes de crear/modificar:
1. ¿Es un componente reusable a nivel de **layout/composición** (Section, Stack, Card, Button, Eyebrow, Hairline)? → primitive de su surface set.
2. ¿Es un componente **brand-locked** (HeroLine word-mask animation, BrandSuccessGlyph spark→arc→check, Stepper spine vertical, VertexMark SVG)? → se queda en su carpeta sin abstraer.
3. ¿Es un componente de **negocio/dominio** (QuestionInput, AnswerOption, ProgressBar entrevista)? → en su carpeta sin pasarlo a primitives.

---

## V. Migration mapping (qué se refactoriza)

| Antes (ad-hoc) | Después (token/primitive) |
|---|---|
| `clamp(46px, 7.4vw, 108px)` inline | `var(--type-hero)` |
| `text-[15.5px] leading-relaxed` | `.text-body` utility |
| Spring inline `{ stiffness: 320, damping: 22, mass: 0.55 }` | `springs.elegant` import |
| `cubic-bezier(0.16, 1, 0.3, 1)` inline | `var(--ease-out-expo)` o `easings.outExpo` |
| `transition-all duration-200` | `transition-all duration-[var(--dur-fast)] ease-[var(--ease-out-expo)]` |
| `py-24 sm:py-28 lg:py-36` repetido | `<Section paddingY="hero">` |
| `max-w-[1480px] mx-auto px-6 sm:px-10 lg:px-14` | dentro de `<Section>` |
| `rounded-[28px]` literal | `rounded-[var(--radius-section)]` o utility |
| Manifest shadow inline | `<Card variant="manifest">` |
| Gold hairline inline div | `<Hairline tone="gold" />` |

**Componentes con springs inline a migrar a presets**: `HeaderCTA` (elegant + snap + soft), `SectionIndicator` (indicator), futuros.

---

## VI. Roadmap por waves

### Wave 1 · MVP (3 días, branch `feat/design-system-wave-1`)

**Día 1 — tokens + motion**
- [ ] Crear `app/design-system/tokens.css` con brand primitives + type scale + spacing scale (mover de globals.css).
- [ ] Crear `app/design-system/type.css` con utilities `.text-hero`, `.text-display`, `.text-h2`, `.text-h3`, `.text-body`, `.text-body-lg`, `.text-caption`, `.text-eyebrow`.
- [ ] Crear `app/design-system/space.css` con utilities semánticas para `--section-y`, `--container-max`, etc.
- [ ] Crear `app/design-system/motion.css` con `--dur-*`, `--ease-*` (mover keyframes globales `vertice-*`, `ln-*`, `vx-*`, `sx-*`, `bsg-*` aquí).
- [ ] Crear `lib/design-system/motion/{springs,easings,durations}.ts`.
- [ ] Crear `lib/design-system/tokens.ts` (TS export brand colors + families).
- [ ] Refactor `app/globals.css` para importar nuevos archivos design-system (eliminar duplicación).
- [ ] Smoke test: landing + entrevista renderizan idénticos visualmente.

**Día 2 — primitivos landing**
- [ ] `components/landing/Section.tsx`
- [ ] `components/landing/Stack.tsx`
- [ ] `components/landing/Eyebrow.tsx`
- [ ] `components/landing/Button.tsx` (3 variants)
- [ ] `components/landing/Card.tsx`
- [ ] `components/landing/Hairline.tsx`
- [ ] `components/landing/Atmosphere.tsx`
- [ ] Refactor `HeaderCTA` a `springs.elegant/snap/soft` (eliminar inline values).
- [ ] Refactor `SectionIndicator` a `springs.indicator`.
- [ ] Refactor 1-2 secciones de `app/page.tsx` (manifest + hero) a usar primitives.

**Día 3 — primitivos entrevista + docs**
- [ ] `components/entrevista/Section.tsx`
- [ ] `components/entrevista/Stack.tsx`
- [ ] `components/entrevista/Eyebrow.tsx`
- [ ] `components/entrevista/Button.tsx`
- [ ] `components/entrevista/Card.tsx`
- [ ] `components/entrevista/Hairline.tsx`
- [ ] Refactor `HeroPregunta` para usar primitives (Section, Card, Eyebrow).
- [ ] Refactor `BatchNav` para usar Button primitive.
- [ ] Crear `docs/design/tokens/{COLOR,TYPE,SPACE,MOTION,DECISIONS}.md`.
- [ ] Crear `docs/design/recipes/{NEW_LANDING_PAGE,NEW_SURVEY_SCREEN}.md` con receta paso a paso.
- [ ] Update `docs/design/DESIGN_SYSTEM.md` para reflejar sistema vivo formalizado.

**Wave 1 acceptance**:
- `app/page.tsx` y `app/preview/ui` se ven idénticos antes vs después (visual regression manual).
- Para crear una nueva landing page, alguien puede importar 6 primitives y obtener la consistencia gratis.
- Cero `clamp(...)`, `cubic-bezier(...)`, `{ stiffness: ... }` inline en componentes refactorizados.
- Recipes docs reproducibles por terceros.

### Wave 2 · Polish (2 días, branch `feat/design-system-wave-2`)

- [ ] Radius semantic (`--radius-sm/md/card/section/pill`) — actualizar Tailwind config si aplica.
- [ ] Shadow scale (`--shadow-hairline-*`, `--shadow-card-*`, `--shadow-cta-glow`).
- [ ] Atmosphere variants (`<Atmosphere variant="radial-gold-cool|warm|dense" />`).
- [ ] Icon library decision: validar Lucide actual o introducir Phosphor secundario. Tokens `--icon-sm/md/lg` para stroke-width consistency.
- [ ] Visual drift audit: screenshot landing + 3 pantallas entrevista, comparar vs baseline pre-refactor.

### Wave 3 · Cleanup (1 día, branch `chore/design-system-legacy-sweep`)

- [ ] Sweep `--lime`, `--forest`, `--lime-soft`, `--forest-deep`, `--forest-soft` fuera de `/entrevista/*` y `/preview/*`.
- [ ] Mantener vivos SOLO en `/admin/*` (out of scope).
- [ ] Final pass de `DESIGN_SYSTEM.md` reflejando estado terminal.
- [ ] Smoke test E2E visual completo.

---

## VII. Reglas de gobierno (post-wave-1)

1. **No CSS literals para valores de design system**: si un valor está en token, se usa el token. Lint rule recomendable: `no-restricted-syntax` para `cubic-bezier`, `clamp` (con allowlist en archivos design-system).
2. **No springs inline en `motion.button` / `motion.div`**: siempre import desde `springs`.
3. **Crear page nueva = importar primitives + componer**, no copy-paste de `app/page.tsx`.
4. **Componentes brand-locked NO se promueven a primitives** sin discusión explícita. Test: ¿este patrón aparece en ≥3 lugares? Solo entonces es primitive.
5. **Componentes específicos de dominio (entrevista business logic) NO van a primitives**.
6. **Cambios a tokens atómicos requieren screenshot diff** (manual ok inicialmente, Percy/Chromatic eventual).

---

## VIII. Riesgos + mitigación

| Riesgo | Mitigación |
|---|---|
| Refactor de `app/page.tsx` (1284 líneas) introduce regresiones visuales | Wave 1 día 2 hace 1-2 secciones, no toda la página. El resto migra incrementalmente en sesiones posteriores. |
| Dos sets paralelos divergen en 6 meses | Wave 1 día 3 deja recipes docs explícitos. Wave 2 día final audit cierra drift. Repetir audit cada 3 meses. |
| Tailwind v4 + custom CSS vars + arbitrary values entran en conflicto | Usar Tailwind v4 `@theme inline` para exponer tokens y mantener `bg-[var(--token)]` solo como fallback. |
| Springs migration rompe el feel del HeaderCTA actual | Documentar values exactos pre-refactor + screenshot recording GIF para QA. |
| Wave 1 toma >3 días | Aceptable. Wave 1 es la inversión. Wave 2-3 son días sueltos. |

---

## IX. Open questions (para revisión)

1. ¿Forzamos `dur-epic` (1200ms) o se queda dentro de los keyframes específicos del landing (ln-line-in, ln-word-rise)? **Decisión sugerida**: keyframes específicos mantienen sus duraciones; `--dur-epic` solo se usa cuando se transitiona algo similar fuera de keyframe.
2. ¿Iconos: Lucide-only o Lucide + Phosphor mix? CLAUDE.md sugiere mix. Wave 2 decide.
3. ¿`<Atmosphere>` se aplica auto dentro de `<Section surface="ink">` o se invoca explícito? **Sugerido**: explícito, para no forzar overlay en secciones que no lo quieren.
4. ¿Type scale del landing aplica idéntico a entrevista? Hero entrevista tiene actualmente sizes más conservadores. **Sugerido**: mismas vars pero `<HeroPregunta>` puede pisar con `text-display` en vez de `text-hero` (decisión de uso, no de token).

---

## X. Definition of done (Wave 1)

- [ ] Spec aprobado por founder.
- [ ] Branch `feat/design-system-wave-1` mergeado a master.
- [ ] `app/page.tsx` y `app/preview/ui` visualmente idénticos antes/después (manual screenshot compare).
- [ ] 13 primitives nuevos creados (7 landing + 6 entrevista).
- [ ] 4 archivos de tokens CSS + 4 archivos motion TS en `lib/design-system/`.
- [ ] 7 archivos de docs nuevos (5 tokens + 2 recipes).
- [ ] `DESIGN_SYSTEM.md` actualizado.
- [ ] Cero springs inline en `HeaderCTA` y `SectionIndicator`.
- [ ] Smoke test entrevista: P1 + P5 + success final renderizan idénticos.
- [ ] Lighthouse + Core Web Vitals no degradan (CLS ≤ 0.01).

---

## Appendix: existing context

Sistema actual documentado en `docs/design/DESIGN_SYSTEM.md` (mayo 2026). Brand tokens cementados 2026-05-08. Survey UI refactor mergeado 2026-05-10 (PRs #5-#11). Tracking de tokens vive en `app/globals.css` líneas 78-184.

Componentes landing actuales (9): VertexMark, HeaderCTA, HeroLine, BrandSuccessGlyph, SuccessMark, SectionIndicator, CookiesCard, FooterLink, LenisProvider.

Componentes entrevista actuales (3): Stepper, HeroPregunta, BatchNav.

Líneas a refactorizar: `app/page.tsx` (1284), `Stepper.tsx` (417), `HeroPregunta.tsx` (388). Wave 1 toca 1-2 secciones de cada uno; refactor completo en sesiones posteriores.
