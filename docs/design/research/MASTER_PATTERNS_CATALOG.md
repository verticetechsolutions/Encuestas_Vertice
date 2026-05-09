# Master Patterns Catalog — Vértice /preview/ui (Mayo 2026)

Síntesis de 5 agentes de investigación + browse manual en awwwards.com (Studio Namma SOTD + Marvell Tile & Stone). Todos los patterns aquí están **confirmados por 3+ fuentes independientes**.

---

## I. Color (decisión cerrada)

```css
/* Tokens Vértice 2026 */
--paper:        #F2EAD6;             /* cream actual, mantener */
--paper-soft:   #F5EFD9;             /* hover state cream */
--ink:          #0F0E0E;             /* near-black actual, mantener */
--ink-65:       rgb(15 14 14 / 0.65); /* secondary text */
--ink-42:       rgb(15 14 14 / 0.42); /* tertiary text */
--ink-08:       rgb(15 14 14 / 0.08); /* hairlines */
--ink-04:       rgb(15 14 14 / 0.04); /* hover bg */
--gold:         #B8965A;             /* propuesto: dorado oscuro/cálido */
--gold-deep:    #8E7340;             /* drop cap, accents serios */
--gold-glow:    rgb(184 150 90 / 0.25); /* CTA shadow */
```

**Reglas**:
- Dorado solo en 3 roles: (a) primary CTA fill, (b) active section indicator, (c) drop cap / number-as-display.
- **Verde lima eliminado** (crítica original). Reemplazar por `--gold` tint.
- Cero gradientes purple/blue.
- Background siempre warm cream, nunca #FFFFFF.

---

## II. Typography (decisión cerrada — pareja editorial)

**Stack recomendado**:
```css
--font-display: 'Tiempos Headline', 'Recoleta', Georgia, serif;
--font-body:    'Söhne', 'Inter Tight', -apple-system, sans-serif;
--font-mono:    'Söhne Mono', 'JetBrains Mono', 'Geist Mono', monospace;
```

Si presupuesto Klim no entra: **GT Sectra + Neue Haas Grotesk** (Grilli Type, alquiler más accesible) o open-source path **Recoleta + Inter Tight + Geist Mono**.

**Scale (Linear-style px-based letter-spacing)**:
```css
--tracking-display: -0.025em;  /* hero pregunta */
--tracking-h1:      -0.02em;
--tracking-h2:      -0.015em;
--tracking-body:    -0.01em;
--tracking-eyebrow:  0.08em;   /* uppercase tracked */

--leading-display: 1.0;
--leading-h1:      1.1;
--leading-body:    1.55;
--leading-prose:   1.625;

/* Sizes (8px grid) */
--text-display: 72px;  /* mobile 44px */
--text-h1:      48px;
--text-h2:      32px;
--text-h3:      24px;
--text-body:    17px;
--text-small:   14px;
--text-eyebrow: 12px;
```

**OpenType obligatorio**:
```css
.numeric { font-variant-numeric: tabular-nums lining-nums; }
.prose   { font-variant-numeric: oldstyle-nums proportional-nums; }
.smallcaps-meta { font-variant-caps: all-small-caps; letter-spacing: 0.06em; }
```

---

## III. Spacing (decisión cerrada — 8px grid agresivo)

```css
--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-6:  24px;
--space-8:  32px;
--space-12: 48px;
--space-16: 64px;
--space-24: 96px;
--space-32: 128px;
```

**Reglas**:
- Section padding-y: **96-128px desktop / 48-64px mobile** (Vercel/Linear standard).
- Card interior: **24-32px**.
- Gap form ↔ rail: **64-96px**.
- Container max-width: **1120-1200px**.
- Form max-width: **620-680px** (legibility).
- **Whitespace target**: 50-60% pixel ratio empty.

---

## IV. Layout (cambio de raíz)

**Layout actual**: 2 columnas ~60/40, casi simétricas, ambas full-height cards.

**Layout propuesto** (Anthropic + Marvell + Linear /method):
- **Asymmetric 7fr/5fr** (no 50/50, no 60/40). Form a la izquierda 7 cols, rail-info derecha 5 cols.
- **Pregunta-héroe SIN card**: typographic block sobre crema, hairline `1px solid var(--ink-08)` solo en bottom como divider editorial.
- **Sticky pill nav** flotante top-center (estilo Marvell) con shortcut a las 6 secciones, NO header full-width.
- **Right rail unificado**: fundir TURNO + CUBRE en un solo bloque (es contexto inmediato), Progreso aparte como segundo bloque.
- **Floating elements asimétricos**: el "0/54 CAJAS" flota top-right en lugar de estar pegado al stepper.

---

## V. Components (10 cambios prescritos)

### 1. Eliminar verde lima → reemplazar con gold tint

```css
.section-active {
  background: linear-gradient(0deg, rgb(184 150 90 / 0.10), rgb(184 150 90 / 0.10));
  /* o simplemente: */
  background: rgb(184 150 90 / 0.08);
}
```

### 2. Pregunta-héroe SIN card

```tsx
<article className="max-w-[620px] py-24">
  <p className="font-mono text-eyebrow tracking-[0.08em] text-ink-65 uppercase mb-6">
    Pregunta 01 · Productos
  </p>
  <h1 className="font-display text-display leading-[1.0] tracking-[-0.025em] text-ink">
    ¿Qué productos de crédito ofrece su institución actualmente?
  </h1>
  <p className="font-body text-body leading-[1.55] text-ink-65 mt-4 italic">
    Por ejemplo: capital de trabajo, crédito simple, factoraje, arrendamiento.
  </p>
</article>
```

**Crítica original 1+4 resueltas**: pregunta y microcopy separados; card eliminado, hairline-only.

### 3. Botones double grammar

```css
/* Primary CTA: pill dorado */
.btn-primary {
  border-radius: 999px;
  background: var(--gold);
  color: var(--paper);
  padding: 14px 28px;
  font-weight: 500;
  transition: 220ms cubic-bezier(0.16, 1, 0.3, 1);
}
.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 0 32px var(--gold-glow);
}

/* Secondary: rectangle 8px */
.btn-secondary {
  border-radius: 8px;
  border: 1px solid var(--ink-12);
  background: transparent;
  padding: 14px 24px;
}
.btn-secondary:hover {
  background: var(--ink-04);
}

/* Tertiary: text-link with arrow */
.btn-tertiary {
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 4px;
  transition: text-decoration-thickness 180ms;
}
.btn-tertiary:hover {
  text-decoration-thickness: 2px;
}
```

**Resuelve crítica 6** (mic vs button shape mismatch): mic se vuelve text-tertiary con icono inline.

### 4. Mic + Marcar respondida unificados

```tsx
<div className="flex items-center gap-3">
  <button className="btn-tertiary inline-flex items-center gap-2">
    <MicIcon className="size-4" />
    Dictar respuesta
  </button>
  <button className="btn-primary">
    Marcar respondida
  </button>
</div>
```

### 5. Eliminar debug leak `nm_productos_ofrecidos`

Mapear backend field name a label humano:
```tsx
const FIELD_LABELS: Record<string, string> = {
  nm_productos_ofrecidos: 'Productos ofrecidos',
  // ...
};
```

### 6. Paginador limpio (eliminar "1 P01" redundante)

```tsx
<nav className="flex items-center gap-2 font-mono text-sm tracking-[0.04em]">
  <button>‹</button>
  <button className="active">P01</button>
  <button>P02</button>
  <button>P03</button>
  <button>›</button>
</nav>
```

### 7. Eyebrow letterspacing sano

`tracking-[0.08em]` en lugar de la separación visual actual donde "P 0 1" parece 3 caracteres separados. Aplica a TODOS los eyebrows.

### 8. Right rail fundido (Turno + Cubre = un bloque)

```tsx
<aside className="space-y-8 sticky top-24">
  {/* Bloque 1: contexto inmediato */}
  <section className="border-t border-ink-08 pt-6">
    <p className="font-mono text-eyebrow uppercase tracking-[0.08em] text-ink-65">
      Turno actual
    </p>
    <p className="font-display text-h1 mt-3 tabular-nums">3 pendientes</p>
    <p className="font-body text-small text-ink-65 mt-2 italic">
      Marca cada respuesta para habilitar el envío.
    </p>
    <p className="font-mono text-eyebrow uppercase tracking-[0.08em] text-ink-65 mt-8">
      Esta pregunta cubre
    </p>
    <ul className="mt-2 space-y-1">
      <li className="text-body">Productos ofrecidos</li>
    </ul>
    <button className="btn-primary w-full mt-6">
      Enviar turno (0/3)
    </button>
  </section>

  {/* Bloque 2: progreso */}
  <section className="border-t border-ink-08 pt-6">
    <p className="font-mono text-eyebrow uppercase tracking-[0.08em] text-ink-65">
      Progreso
    </p>
    <p className="font-display text-h1 mt-3 tabular-nums">
      0<span className="text-ink-42">/54</span>
    </p>
    {/* Lista de secciones con hairline dividers en lugar de cards */}
    <ul className="mt-6 divide-y divide-ink-08">
      <li className="py-3 flex justify-between"><span>Identificación</span><span className="tabular-nums text-ink-65">0/5</span></li>
      <li className="py-3 flex justify-between font-medium" data-active>
        <span>Productos y mercado</span>
        <span className="tabular-nums">0/7</span>
      </li>
      {/* ... */}
    </ul>
  </section>
</aside>
```

**Resuelve críticas 10, 13, 14** (right rail dividido, progress underlines confusas, lime out).

### 9. "0/54 CAJAS" como número-display

Convertir el chip "0/54 CAJAS" en pacing element editorial estilo Pitchfork score:

```tsx
<div className="font-display text-h2 tabular-nums">
  <span>0</span>
  <span className="text-ink-42">/54</span>
</div>
```

Float top-right de la página, no chip.

### 10. Eliminar floating "N" sin contexto

Identificar qué es ese badge bottom-left. Si es agent/notification, debe tener tooltip + label. Si es debug, fuera de `/preview/ui`.

---

## VI. Motion tokens

```typescript
// motion-tokens.ts
export const ease = {
  outExpo: [0.16, 1, 0.3, 1],
  iosSheet: [0.32, 0.72, 0, 1],
  outBack: [0.34, 1.56, 0.64, 1],
} as const;

export const duration = {
  micro: 0.18,    // hover, focus
  component: 0.28, // card lift, accordion
  macro: 0.48,    // modal, panel
  hero: 0.72,     // landing
} as const;

export const stagger = {
  tight: 0.04,
  default: 0.06,
  loose: 0.08,
} as const;
```

**Aplicar**:
```tsx
// Question card transition entre preguntas (View Transitions API)
useEffect(() => {
  if (!document.startViewTransition) return;
  document.startViewTransition(() => {
    setQuestion(next);
  });
}, [next]);

// Section reveal
<motion.div
  initial={{ opacity: 0, y: 16 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, amount: 0.3 }}
  transition={{ duration: duration.component * 2, ease: ease.outExpo }}
/>

// CTA hover
<motion.button
  whileHover={{ y: -1, transition: { duration: duration.micro, ease: ease.outExpo } }}
  whileTap={{ scale: 0.97, transition: { duration: 0.1, ease: ease.iosSheet } }}
/>
```

---

## VII. Action Plan priorizado

### Sprint 1 — Color y tipografía (1-2 días)
1. Definir tokens en `globals.css` (paper, ink, gold, hairlines).
2. Eliminar todo lime green del DOM. Audit exhaustivo de `@apply lime` o equivalente Tailwind.
3. Setup Tiempos Headline (o Recoleta fallback) + Söhne (o Inter Tight) + Söhne Mono (o JetBrains Mono).
4. Aplicar `font-variant-numeric: tabular-nums` a TODOS los números (chip 0/54, progreso, paginador).
5. Eyebrow letter-spacing sano en TODOS los eyebrows.

### Sprint 2 — Layout y componentes (2-3 días)
6. Refactor `/preview/ui` a 7fr/5fr asymmetric.
7. Eliminar card de la pregunta-héroe → typographic block.
8. Separar pregunta + microcopy "Por ejemplo:".
9. Mapear `nm_productos_ofrecidos` → label humano.
10. Fundir Turno + Cubre en un bloque del right rail. Hairline divider entre secciones.
11. Paginador limpio (solo P01/P02/P03, sin "1 P01").
12. Mic como text-tertiary inline, no circle outlined.
13. Eliminar/contextualizar floating "N" badge.

### Sprint 3 — Motion (1-2 días)
14. Tokens motion en `lib/motion-tokens.ts`.
15. Aplicar View Transitions API entre preguntas.
16. Section reveal scroll-triggered con stagger.
17. CTA hover/press con out-expo.
18. `prefers-reduced-motion` fallback obligatorio.

### Sprint 4 — Detalle editorial (1-2 días)
19. Drop cap o number-as-display en pregunta-héroe.
20. Glyph divider (✦ o §) entre grupos de preguntas.
21. Pull quote opcional para citas regulatorias CNBV.
22. Sticky pill nav flotante (estilo Marvell) con shortcuts a las 6 secciones.
23. Grid texture overlay sutil (3% ink) si encaja con tono fintech.

---

## VIII. Anti-banlist confirmado mayo 2026

**NO usar nunca**:
- Gradientes purple→blue / iridiscente cliché
- `#000` puro (usar `#0F0E0E`)
- `rounded-2xl` por default en todo
- `shadow-lg` por default
- Inter como única familia
- Lucide como única librería de iconos
- Bento grid 4-6 cards iguales
- Custom cursor blob / magnetic buttons (en B2B fintech)
- Scroll-jacking que rompa back-button / search-in-page
- Glassmorphism heavy (blur >40px) panels enteros
- "Trusted by" gray logo strips
- Centered hero con CTA "Get started for free"
- Y2K nostalgia / AI-slop gradient orbs auto-generados

**SÍ usar**:
- View Transitions API para paginación
- `font-variant-numeric: tabular-nums` en números fintech
- Hairline borders > shadows
- Asimetría intencional 7/5 o 58/42
- Pareja serif display + sans humanist
- Custom commissioned type cuando presupuesto lo permita
- Easing `cubic-bezier(0.16, 1, 0.3, 1)` y `cubic-bezier(0.32, 0.72, 0, 1)`
- Stagger 40-60ms
- `prefers-reduced-motion: reduce` fallback
- Foto editorial real (lifestyle-luxury) cuando aplique

---

## IX. Referencias 1:1 verificadas

- **Mercury** (mercury.com) — B2B fintech luxury editorial, paleta + typography pareja
- **Marvell Tile & Stone** (marvellco.com.au) — paleta cream + ink + dorado natural, asimetría floating, grid sutil overlay
- **Stripe Press** (press.stripe.com) — restraint editorial fintech con Söhne + serif headlines
- **Anthropic** (anthropic.com) — cream warm `#FAF9F5` + coral CTA + dark navy, playbook directo
- **Linear /method** (linear.app/method) — manifiesto numerado con prosa + hairlines, sin scroll-jacking
- **Robinhood** (robinhood.com) — abandona explícitamente fintech rainbow, usa mono + 1 acento electric
- **GQ The Extraordinary Lab** — magazine-scroll editorial, equivalente narrativo a entrevista guiada
