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

---

## ADR-005: HeaderCTA y SectionIndicator springs migración conservadora

**Date**: 2026-05-10
**Status**: Active

**Context**: HeaderCTA tiene 3 springs inline (FILL, ARROW, TEXT). De estos, solo FILL matchea exactamente el preset `elegant`. ARROW tiene damping=18 (no =28 como `snap`), TEXT no especifica mass (default 1 vs preset 0.6).

**Decision**: Wave 1 solo migra los springs que matchean exactamente. Los que no matchean se quedan inline con comentario explicativo. Wave 2 evalúa si agregar presets adicionales (`arrowSnap`, `softNoMass`).

**Reasoning**: el feel exacto del HeaderCTA es identidad de marca. Cambiar damping de 18 a 28 (54% diferencia) altera la perception del component aunque la diferencia es ms-level. Cero riesgo es mejor que harmonization a costa del feel.

---

## ADR-006: Primitives para páginas nuevas, NO retrofit obligatorio de componentes existentes

**Date**: 2026-05-10
**Status**: Active

**Context**: Wave 1 intentó refactorizar 3 lugares para usar primitives nuevos: `app/page.tsx` manifest section (Task 20), `HeroPregunta.tsx` (Task 27), `BatchNav.tsx` (Task 28). Los 3 escalaron DONE_WITH_CONCERNS:
- Manifest: usa `bg-gradient cream/[0.028]` translúcido, Card.manifest variant es `bg-ink-raised` solid. Distinto.
- Manifest layout: grid-cols-12 + `<main>` que ya tiene container. Section primitive doble-padding.
- HeroPregunta eyebrow patterns: 10px tracking-0.16em `.numeric` (tabular) — distinto del `.text-eyebrow` 10.5px tracking-0.32em.
- HeroPregunta MarcarButton: framer-motion spring choreography custom — no fits Button primitive.
- BatchNav: design intent es text-link inline (sin pill, sin border, sin bg). Button primitive es pill.

**Decision**: Los primitives están diseñados para construir páginas NUEVAS. Componentes existentes con styling bespoke deliberado NO se retrofittean para "usar primitives" — eso destruye intent específico de cada uno.

**Reasoning**:
- Los primitives capturan patrones genéricos/repetibles. Los componentes bespoke (HeroPregunta, BatchNav, ManifestRow) tienen intent específico que no es genérico.
- Forzar retrofit produce visual regression (Eyebrow font-weight change, Button shape change) sin ganancia real.
- HeaderCTA + SectionIndicator springs migración SÍ funcionó porque eran patrones genéricos disfrazados de inline values.

**Test para retrofit**: cuando aparezca un pattern repetido en 3+ páginas nuevas usando el primitive, se vuelve obvio si el componente existente puede colapsarse en él. Hasta entonces, los componentes existentes son su propia variante.

---

## ADR-007: Wave 1 utility class `.text-display` override

**Date**: 2026-05-10
**Status**: Active

**Context**: La utility `.text-display` existía en `globals.css` (sin font-size, tracking -0.02em). El nuevo `app/design-system/type.css` la redefine (con clamp 34-64px, tracking -0.03em). Después de Task 5, la nueva versión wins.

**Decision**: Aceptar el override. El único consumer (`app/entrevista/[sesion_id]/entrevista-shell.tsx:280`) usa `text-display text-[28px]` lo que override la clamp font-size; el net visual change es minimo (tracking hairline-tighter).

**Reasoning**: el nombre `.text-display` ya estaba en uso — definirlo con valores diferentes en design system requería override O rename. Override es la decisión menos disruptiva.

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

---

## ADR-010: Legacy --lime/--forest se quedan (Wave 3 cleanup outcome)

**Date**: 2026-05-11 (Wave 3 original) / 2026-05-11 later (admin sweep)
**Status**: Active (admin migrated)

**Context**: La spec original prometía un Wave 3 sweep de `--lime`/`--forest` fuera de entrevista. Wave 3 audit reveló que entrevista/preview ya estaban limpios desde PR #11 — pero admin todavía usaba lime/forest directamente (~45 occurrencias en 12 archivos). El founder pidió migrar admin también para consistencia visual app-wide.

**Audit completo:**
- `app/entrevista/*`, `app/preview/*`, `components/entrevista/*`: ZERO references. Migración pre-existente (PR #11).
- `app/admin/*` (8 files) + `components/admin/*` (3 files): **migrated en PR del admin sweep** (forest/lime → ink/gold). Ver mapping abajo.
- `app/globals.css`: define lime/forest + Shadcn role mapping (`--primary: var(--forest)`, `--accent: var(--lime)`, `--ring`, `--chart-*`, `--sidebar*`). **Estos siguen vivos** porque powers shadcn/ui primitives en `components/ui/` (Button, Card, Progress, Select, Textarea) que pueden ser usados en código futuro.

**Decision**: 
- Admin consumer code (classNames): migrated.
- Globals.css source of truth (--forest, --lime, --canvas, --cream): se quedan permanentemente por shadcn role mapping.

**Admin migration mapping** (ver commit del admin sweep para detalle):
- `bg-forest-deep` / `bg-forest` (dark surfaces, primary CTAs) → `bg-ink`
- `hover:bg-forest-soft` → `hover:bg-[var(--ink-raised)]`
- `bg-forest/X` on dark bg → `bg-cream-pure/X` (transparent pills on header)
- `bg-forest/X` on light bg → `bg-ink/8` (tinted hover states)
- `text-forest` (links) → `text-gold-deep` (AA on white)
- `bg-lime` (V badge, accent button) → `bg-gold text-ink`
- Status badges 3-state:
  - abierta/vigente (fresh): `bg-gold-bright/30 text-gold-deep ring-gold-bright/50`
  - sintetizando/in-progress: `bg-ink/8 text-ink/72 ring-ink/15`
  - completa/consumido (done): `bg-ink text-cream-pure ring-ink`
- `focus:ring-forest` → `focus:ring-ink/30`

**Resultado final del design system**: **1 universo** post-Wave 5 remap (ver ADR-011).

Antes de Wave 5: 2 universos coexistiendo (design system tokens + shadcn role mapping legacy). Post Wave 5: shadcn role mapping también consume brand tokens (ink/gold/cream-pure/burgundy). Los tokens legacy `--forest`/`--lime` siguen definidos en globals.css pero ya NO los referencia ningún consumer activo — quedan como dead definitions hasta sweep posterior si se decide hacerlo.

---

## ADR-011: Shadcn role mapping remapped a brand tokens (Wave 5)

**Date**: 2026-05-11
**Status**: Active

**Context**: ADR-010 dejó shadcn role mapping (`--primary: var(--forest)`, `--accent: var(--lime)`, `--ring: var(--forest)`, `--chart-*`, `--sidebar*`) apuntando a tokens legacy. Esto causaba que shadcn primitives (`<Select>` en landing, `<Textarea>` en HeroPregunta) renderizaran con colores forest/lime que no matchean el design system.

**Audit**:
- `bg-primary` / `text-primary` / `bg-accent` / `text-accent` / `ring-primary` directos: **cero usages** en `app/admin/*`, `app/entrevista/*`, ya migrados via admin sweep + entrevista refactor.
- `text-primary-foreground` (consumed por admin classes): cream-ish color. Post remap = `var(--cream-pure)` = mismo hue. Cero visual diff.
- Shadcn primitives importados: solo `<Select>` en `app/page.tsx` y `<Textarea>` en `HeroPregunta.tsx`. Post remap: focus rings y dropdowns rendering en ink/gold en vez de forest/lime. Brand-aligned.

**Decision**: remap completo de shadcn role mapping a brand tokens.

**Light theme (`:root`)**:
- `--primary: var(--ink)` (was forest)
- `--primary-foreground: var(--cream-pure)` (was cream-ish oklch)
- `--accent: var(--gold)` (was lime)
- `--accent-foreground: var(--ink)` (was lime-foreground)
- `--ring: var(--ink)` (was forest)
- `--destructive: var(--burgundy)` (was oklch red)
- `--border: rgb(10 15 28 / 0.12)` (ink/12)
- `--input: rgb(10 15 28 / 0.08)` (ink/8)
- `--card-foreground` / `--popover-foreground` / `--secondary-foreground: var(--ink)`
- `--chart-1..5`: ink, gold, gold-deep, gold-bright, burgundy
- `--sidebar*`: ink + cream-pure + gold (dark sidebar like landing dark surface)

**Dark theme (`.dark`)**:
- `--background: var(--ink)`, `--foreground: var(--cream-pure)` (inverse del light)
- `--primary: var(--cream-pure)` (espejo del landing CTA: cream pill sobre ink)
- `--primary-foreground: var(--ink)`
- `--accent: var(--gold-bright)` (gold-bright pops más sobre ink)
- `--ring: var(--gold)`

**Reasoning**:
- Cierra el último gap: TODO el app consume brand tokens via design system O shadcn role mapping remapped.
- Cero refactor de consumer code requerido.
- Los componentes shadcn primitives ahora renderizan brand-aligned automáticamente.
- Tokens legacy `--forest`/`--lime`/`--canvas`/`--cream` quedan como dead definitions sin consumer activo. Pueden eliminarse en sweep posterior si se decide hacerlo (low priority — no causan visual issue).

**Resultado**: design system **completamente cerrado**. 1 universo de brand tokens consumido por (a) `app/design-system/*` imports, (b) shadcn role mapping en globals.css, (c) classNames directos. No habrá Wave 6.
