# Vértice · Design System (Mayo 2026)

> **Update 2026-05-10** — Wave 1 formalizado y mergeado (ver `feat/design-system-wave-1`).
>
> Tokens vivos en:
> - `app/design-system/{tokens,type,space,motion}.css` (Layer 0 brand + Layer 1 scales)
> - `lib/design-system/{motion/*,tokens}.ts` (TS exports: springs, easings, durations, brand)
>
> Primitives:
> - `components/landing/{Section,Stack,Eyebrow,Button,Card,Hairline,Atmosphere}.tsx` (surface ink)
> - `components/entrevista/{Section,Stack,Eyebrow,Button,Card,Hairline}.tsx` (surface cream)
>
> Reusables existentes migrados:
> - `HeaderCTA` usa `springs.elegant` (fillSpring)
> - `SectionIndicator` usa `springs.indicator`
>
> Componentes existentes NO retrofiteados (per ADR-006):
> - `app/page.tsx` manifest section (estructura no-cleanly-mappable)
> - `HeroPregunta`, `BatchNav` (design intent bespoke)
>
> Recipes para pages nuevas: `docs/design/recipes/{NEW_LANDING_PAGE,NEW_SURVEY_SCREEN}.md`.
> ADRs de decisiones: `docs/design/tokens/DECISIONS.md`.
>
> Wave 2 (próxima): radius semantic, shadow scale, atmosphere variants, icon library decision.
> Wave 3 (cleanup): sweep legacy `--lime`/`--forest` de entrevista.

---

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

---

> **Update 2026-05-11 (later)** — Wave 3 cerrado (ver `chore/design-system-legacy-sweep`).
>
> Wave 3 era "sweep legacy `--lime`/`--forest` fuera de entrevista". Audit reveló que la migración ya había ocurrido en PR #11 (refactor entrevista 2026-05-10): cero references en `app/entrevista`, `app/preview`, `components/entrevista`.
>
> Los legacy tokens se mantienen permanentemente en `globals.css` porque (a) admin scope los usa, (b) Shadcn role mapping (`--primary: var(--forest)`, `--accent: var(--lime)`, `--ring`, `--chart-*`, `--sidebar*`) los referencia y eso es app-wide vía shadcn/ui.
>
> Ver ADR-010 para detalle. **El design system queda cerrado** con Waves 1-3. No habrá Wave 4 salvo necesidad concreta nueva.

---

> **Update 2026-05-11 (admin sweep)** — Admin panel migrado a ink/gold.
>
> Tras Wave 3 cerrarse "como no-op", founder pidió migrar admin panel también para consistencia visual. ~45 occurrences de forest/lime en `app/admin/*` + `components/admin/*` migradas a ink/gold (cero shadcn primitives importados en admin, solo classNames directos, así que la migración fue clean).
>
> Mapping completo en ADR-010 actualizado. Tokens legacy `--forest`/`--lime` se mantienen en globals.css por shadcn role mapping (que sigue usado por shadcn/ui primitives en `components/ui/`).
>
> **Design system completo app-wide**: landing + entrevista + admin todos consumen los tokens del design system. Shadcn primitives quedan en su universo paralelo con role mapping legacy.

---

Documenta el design system **actual** vivo en producción landing (`app/page.tsx` + `app/globals.css`). Esta es la base que reusaremos para construir la nueva UI de encuestas.

> **Estado**: tokens cementados en `globals.css` el 2026-05-08 ("paleta unificada landing+entrevista"). Landing los aplica de manera consistente. Entrevista (`/preview/ui`) los aplica parcialmente — mezcla con legacy `--lime` / `--forest` que deben migrar a `--gold`.

---

## I. Brand Tokens

Definidos en `app/globals.css` líneas 78-87 como CSS vars + expuestos a Tailwind v4 vía `@theme inline`:

```css
:root {
  /* === Brand cementados (espejo landing+entrevista) ============= */
  --ink:        #0A0F1C;  /* navy ink — fondo dark editorial landing */
  --ink-raised: #1a2236;  /* navy raised — hover/elevated sobre ink */
  --cream-pure: #F4F1EA;  /* cream off-white — texto sobre ink + surfaces */
  --gold:       #C8A864;  /* champán — acento principal, pills, hairlines */
  --gold-deep:  #9C824A;  /* gold deep — brand "tu política", labels */
  --gold-bright:#F2D89C;  /* gold bright — highlight, focus, glow */
  --gold-light: #E0BE7C;  /* gold light — gradient base de la V mark */
  --burgundy:   #8B3A3A;  /* burgundy desat — error states */
}
```

**Tailwind classes disponibles**:
- `bg-ink` / `text-ink` / `border-ink`
- `bg-ink-raised` (hover sobre ink)
- `bg-cream-pure` / `text-cream-pure` / `border-cream-pure`
- `text-gold` / `bg-gold` / `border-gold`
- `text-gold-deep` / `text-gold-bright` / `text-gold-light`
- `text-burgundy` / `bg-burgundy` (errors)

**Opacity modifiers** (Tailwind v4 syntax):
- `text-cream-pure/45` (45% opacity) — eyebrows
- `text-cream-pure/72` (72% opacity) — body subhead
- `text-cream-pure/8` (8%) — borders muy sutiles
- `border-cream-pure/20` (20%) — buttons ghost border
- `border-cream-pure/6` (6%) — manifest row dividers

### Legacy tokens (NO usar en entrevista nueva)

```css
/* admin sigue usándolos (Fase 9) hasta sweep posterior */
--canvas:  oklch(0.62 0.025 75);   /* taupe */
--cream:   oklch(0.965 0.012 90);  /* cream OKLCH (no es cream-pure) */
--forest:  oklch(0.36 0.075 145);  /* verde dark — primary admin */
--lime:    oklch(0.92 0.16 125);   /* lime — accent admin (ESTE ES EL VERDE QUE CRITIQUÉ) */
```

**Migration rule**: en entrevista, todo uso de `--lime`, `--forest`, `bg-lime-*`, `text-forest-*` debe migrar a `gold` / `gold-deep` / `gold-bright`.

---

## II. Tipografía

Loaded vía Fontshare en `app/layout.tsx`:

```html
<link rel="preconnect" href="https://api.fontshare.com" crossOrigin="anonymous" />
<link rel="stylesheet" href="https://api.fontshare.com/v2/css?
  f[]=satoshi@300,400,500,700,900&
  f[]=general-sans@300,400,500,600,700&display=swap" />
```

**Familias**:
- **Satoshi** (Indian Type Foundry) → `--font-sans` y `--font-mono` (decisión: feel mono via uppercase + tracking 0.32em, NO con familia mono separada)
- **General Sans** (Indian Type Foundry) → `--font-heading` (display)

**Pesos disponibles**:
- Satoshi: 300 / 400 / 500 / 700 / 900
- General Sans: 300 / 400 / 500 / 600 / 700

**Utility classes definidas en globals.css**:

```css
.text-display {
  font-family: var(--font-heading);  /* General Sans */
  font-feature-settings: "ss01", "cv11";
  letter-spacing: -0.02em;
  font-weight: 600;
  line-height: 1.05;
}

.text-eyebrow {
  font-family: var(--font-mono);  /* Satoshi */
  font-size: 10.5px;
  line-height: 1;
  text-transform: uppercase;
  letter-spacing: 0.32em;  /* tracking generoso "manifiesto" */
  font-weight: 500;
}
```

**OpenType activado en body** (`app/globals.css` línea 180):
```css
body {
  font-feature-settings: "ss01", "cv11";  /* alternates Satoshi */
}
```

---

## III. Type scale (extraído de page.tsx)

| Rol | Spec |
|---|---|
| **Hero H1** | `clamp(46px, 7.4vw, 108px)` · weight 500 · `leading-[0.95]` · `tracking-[-0.03em]` · `font-display` |
| **Hero subhead** | `text-[15.5px] sm:text-[17px]` · `leading-relaxed` · `text-cream-pure/72` · max-w `52ch` |
| **Section H2 (manifest)** | `clamp(28px, 3.6vw, 46px)` · weight 500 · `leading-[1.02]` · `tracking-[-0.022em]` · `font-display` |
| **Body** | `text-[15.5px]` o `text-[17px]` · `leading-relaxed` |
| **Eyebrow** | `font-mono text-[10.5px] uppercase tracking-[0.32em]` · `text-cream-pure/45` |
| **Footer/meta** | `font-mono text-[10.5px] uppercase tracking-[0.3em]` · `text-cream-pure/45` |
| **Section nav (label)** | `font-mono text-[10px] uppercase tracking-[0.26em]` |

**Patrón de animación texto**:
- Eyebrow → `ln-fade-in` 0.9s @ 0.05s delay
- H1 line 1 → `HeroLine` word-mask reveal @ 120ms baseDelay
- H1 line 2 → @ 300ms
- H1 line 3 → `charStagger` con `charStep: 42ms` @ 620ms baseDelay
- Subhead → `ln-fade-in` 0.9s @ 1.05s
- CTAs → `ln-fade-in` 0.9s @ 1.25s

---

## IV. Spacing

**Container**:
```css
.container {
  max-width: 1480px;
  padding-inline: 1.5rem;     /* 24px mobile */
  padding-inline: 2.5rem;     /* 40px sm */
  padding-inline: 3.5rem;     /* 56px lg */
}
```

**Grid**:
- 12 columnas (`grid-cols-12`)
- Gap-x: `gap-x-6` (24px) / `lg:gap-x-10` (40px)
- Gap-y: `gap-y-10` (40px) / `sm:gap-y-14` (56px)

**Section padding-y**:
- Hero: `pt-24 sm:pt-28 lg:pt-36 pb-16 lg:pb-20` (96/112/144px top, 64/80px bottom)
- Manifest: `py-14 sm:py-20` (56/80px) — interior del card
- Manifest margin: `my-10 sm:my-14` (40/56px)
- Footer: `py-8` (32px)

**Card paddings (manifest)**:
- `px-6 sm:px-10 lg:px-14` (24/40/56px)
- `py-14 sm:py-20` (56/80px)

---

## V. Border radii

| Token | Valor | Uso |
|---|---|---|
| `--radius` | `0.875rem` (14px) | base |
| `rounded-md` | `calc(0.875rem * 0.8)` ≈ 11px | inputs |
| `rounded-lg` | `0.875rem` (14px) | small cards |
| `rounded-xl` | `1.225rem` (≈20px) | medium cards |
| `rounded-2xl` | `1.575rem` (≈25px) | dialog (uses `rounded-[24px]` literal) |
| `rounded-[28px]` | 28px | manifest section |
| `rounded-full` | 9999px | pills, CTAs, ghost buttons |

**Decisión observada**: el landing **no abusa de `rounded-2xl` por default** (banlist Opsyo). Manifest usa `rounded-[28px]` literal. Pills CTA usan `rounded-full`. Dialog usa `rounded-[24px]`.

---

## VI. Shadows & borders (hairline-first)

El landing prefiere **inset shadows + hairlines** sobre `box-shadow: 0 4px ...` tradicional.

```css
/* Manifest card — cream hairline + gold seam top */
shadow-[inset_0_0_0_1px_rgba(244,241,234,0.055),inset_0_1px_0_rgba(200,168,100,0.18)]

/* Primary CTA hero — micro shadow + gold glow */
shadow-[0_0_0_1px_rgba(244,241,234,0.04),0_30px_70px_-20px_rgba(200,168,100,0.45)]

/* Dialog — solo shadow oscura */
shadow-2xl shadow-black/50

/* Atmosphere overlays */
radial-gradient(1100px 700px at 88% -8%, rgba(200,168,100,0.06), transparent 60%)  /* radial gold */
noise SVG opacity-[0.018] mix-blend-overlay  /* grain texture */
```

**Utilities en globals.css**:
- `.gold-hairline` — 1px gold rgba(200, 168, 100, 0.55)
- `.gold-seam` — inset 1px cream + 1px gold superior
- `.atmosphere-radial-gold` — radial gold 4% (más sutil que el del page.tsx)
- `.atmosphere-noise` — noise SVG 1.2% opacity

---

## VII. Botones (3 variantes)

### Primary (hero "Solicitar alianza")
```tsx
className="group/cta relative inline-flex h-12 items-center gap-3 rounded-full
           bg-cream-pure pl-6 pr-2 text-[13.5px] font-medium text-ink
           transition-colors duration-200
           shadow-[0_0_0_1px_rgba(244,241,234,0.04),0_30px_70px_-20px_rgba(200,168,100,0.45)]
           hover:bg-white"
```
- Pill cream sobre ink background
- Inner icon-pill: `bg-ink text-gold rounded-full size-9`
- Arrow rotates 45° on hover
- Hover: cream → pure white

### Secondary ghost (hero "Ya tengo acceso")
```tsx
className="group/ghost inline-flex h-12 items-center gap-2.5 rounded-full
           border border-cream-pure/20 px-5 text-[13.5px] font-medium text-cream-pure
           hover:border-cream-pure/45"
```
- Border ghost sobre ink
- Includes Google G icon
- Hover: border opacity 20% → 45%

### Header CTA (HeaderCTA component, "Acceder")
```tsx
className="group/cta relative isolate inline-flex h-10 items-center
           overflow-hidden rounded-full
           border border-[#F4F1EA]/15 bg-[#0A0F1C]/55 backdrop-blur-xl"
```
- Smaller h-10
- Backdrop blur (glass-effect sutil sobre dark hero)
- Inner gold fill expands on hover via spring physics (stiffness 320, damping 22, mass 0.55)
- Inner arrow circle inverts: gold → ink, with 45° rotation
- Spring physics distintos por capa (multi-layered feel)

---

## VIII. Motion tokens (cementados en globals.css)

**Easings principales**:
- `cubic-bezier(0.16, 1, 0.3, 1)` — out-expo, easing dominante
- `cubic-bezier(0.2, 0.85, 0.25, 1)` — variant más suave
- `cubic-bezier(0.34, 1.4, 0.64, 1)` — out-back con overshoot (success disk)
- `cubic-bezier(0.34, 1.35, 0.64, 1)` — cookie pop-in (overshoot al 60%)
- `cubic-bezier(0.36, 0, 0.66, -0.35)` — cookie pop-out (espejo del enter)
- `cubic-bezier(0.65, 0, 0.35, 1)` — strict in-out (check stroke draw)

**Spring physics (motion/react)**:
- HeaderCTA fill: `{ stiffness: 320, damping: 22, mass: 0.55 }`
- HeaderCTA arrow: `{ stiffness: 520, damping: 18, mass: 0.4 }`
- HeaderCTA text: `{ stiffness: 380, damping: 26 }`
- SectionIndicator: `{ stiffness: 360, damping: 26 }`
- SectionIndicator line: `{ stiffness: 300, damping: 24 }`

**Animation classes globales**:
- `.animate-fade-up` — 0.4s out-expo, opacity + translateY 8px
- `.animate-pulse-ring` — 1.6s lime (legacy)
- `.animate-shimmer` — 1.6s linear lime gradient (legacy)
- `.animate-cierre-caja` — 900ms out-expo lime ring + scale 1.015 (entrevista feedback)

**Landing-only animations** (scope `.landing-root`):
- `ln-line-in` — clip-path inset reveal + translateY, 0.9s
- `ln-fade-in` — opacity + translateY 10px, 0.7s
- `ln-word-rise` — translateY 110% + skew, 0.95s out-expo
- `ln-char-fall` — translateY -0.55em + rotate-7deg + blur-up, 0.85s
- `ln-pill-morph` — border-radius morph orgánico 14s ease-in-out infinite
- `ln-marquee` — translateX 50% 40s linear infinite
- `ln-caret` — opacity blink 1.05s steps(2)
- `ln-scroll-cue` — translateY 6px 1.8s ease-in-out

**Reduced motion**:
- Global override en `@media (prefers-reduced-motion: reduce)` (línea 242-251)
- Anima a 0.01ms todas las globales
- Componentes con animaciones específicas tienen overrides locales

---

## IX. Componentes landing reutilizables

`components/landing/`:

| Componente | Uso | Notas |
|---|---|---|
| **VertexMark** | SVG sigil de marca (V dorada con slashes cream) | Variantes `inline` (gradient) + `backdrop` (sólido). Animaciones vx-* (draw + breathe + pulse). |
| **HeaderCTA** | CTA top-right con spring fill | Multi-layered springs. Click abre dialog. |
| **HeroLine** | Reveal por palabra o por carácter | Acepta `charStagger` para domino-fall. |
| **SectionIndicator** | Nav vertical fixed right | Detecta sección por scroll %. Mono uppercase. |
| **CookiesCard** | Card pop-in/out | Animation simétrica espejo (in: out-back / out: in-back). |
| **BrandSuccessGlyph** | Spark → arc → ring → check | "Transaction complete" feeling fintech. ~2.0s total. |
| **SuccessMark** | Sello editorial | One-shot pulse + disk + line + check. |
| **FooterLink** | Link footer con hover gold | — |
| **LenisProvider** | Smooth scroll wrapper | Lenis + ScrollTrigger integration. |

---

## X. Microcopy y voice

**Tone**: premium pero claro (no comercial directo, no aspiracional). Validado vía AskUserQuestion en sesión 2026-05-08.

**Frases canónicas**:
- Hero eyebrow: "Red de financieras aliadas · MX 2026"
- Hero H1: "Solicitantes / pre-calificados / con IA." (línea 3 en gold-deep `#9C824A`)
- Subhead: "En una entrevista breve, nuestra IA aprende la política de crédito de tu institución..."
- CTAs: "Solicitar alianza" / "Ya tengo acceso"
- Manifest title: "Dos momentos. / Una alianza." (segunda línea en `font-light text-cream-pure/55`)
- Manifest rows: "01 · Tu entrevista" / "02 · Tus casos"
- Footer: "Vértice © 2026 · Red de financieras aliadas"
- Footer right: "Acceso por invitación"

**Vocabulario aprobado**: alianza · entrevista · institución · tu política · solicitantes · pre-calificados · mesa.

**NO usar**: criterios crediticios, screening, preprocesadas, conversión, cumplimiento. (Demasiado jerga / muy comercial.)

---

## XI. Cómo aplicar a la nueva UI de encuestas

La encuesta (`/preview/ui`) hoy mezcla cream + ink + dorado **con tokens legacy** (`--lime`, `--forest`). El plan:

1. **Eliminar legacy en entrevista**: reemplazar todo `bg-lime-*`, `text-forest-*`, `--accent: var(--lime)` por gold / gold-deep / gold-bright.
2. **Migrar a utilities ya cementadas**: `.text-display`, `.text-eyebrow`, `.gold-hairline`, `.gold-seam`, `.atmosphere-*`.
3. **Heredar componentes landing reusables**: `LenisProvider` (smooth scroll), animaciones `ln-*` (scope landing → exponer también para entrevista), `BrandSuccessGlyph` (cierre de sesión exitoso).
4. **Aplicar mismo type scale**: hero pregunta = `text-display` con clamp similar al landing H2 (28-46px). Eyebrow = `text-eyebrow`. Mono uppercase tracked en metadata.
5. **Surface decision**: la entrevista es **light** (cream-pure background) por decisión UX (sesión 12 min, lectura larga). El landing es **dark** (ink). Ambos comparten la pareja gold + cream + ink, pero invertidos. La encuesta puede usar:
   - `bg-cream-pure` global (paper feel)
   - `text-ink` body
   - `text-gold-deep` para acentos editoriales
   - `text-ink/65` para body secondary
   - `border-ink/8` para hairlines
   - `bg-ink` para CTAs primary (inverso del hero CTA del landing que es bg-cream-pure sobre ink)

---

## XII. Próximos documentos

- `docs/design/SURVEY_UI_PLAN.md` — plan concreto de refactor de `/preview/ui` aplicando este sistema (después de validación con founder)
- `docs/design/COMPONENT_INVENTORY.md` — inventario de qué componentes landing reusar / qué construir nuevo / qué deprecar de entrevista actual
