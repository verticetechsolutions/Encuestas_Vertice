# Admin Dashboard Redesign — Research & Design Direction

> **Fecha:** 2026-05-11
> **Scope:** Rediseño desde cero de `app/admin/page.tsx` (Vista general) y su lenguaje visual replicable al resto del panel admin.
> **Método:** 6 agentes de investigación en paralelo (5 web research + 1 repo audit) + síntesis aplicada al stack y constraints actuales.

---

## TL;DR — 5 movimientos clave

1. **Typography-led metrics, no card-led.** Mercury, Pilot, Stripe, Linear convergen: jerarquía por escala tipográfica + numerales tabulares + sparklines, NO por cards bordeadas/sombreadas. Un número dominante (display 72-96px) ancla cada zona.
2. **Asymmetric grid con 2-3 ejes de alineación** (Klarna + Datadog bento). El admin Vértice rompe el "Vercel genérico" usando offset-axes intencionales en lugar de un grid uniforme.
3. **Goo filter SOLO en clusters cromáticos** (status dots, notification badges) — NUNCA en data cards con texto. El header se queda como única silueta orgánica grande; el resto adopta **`corner-shape: squircle`** (CSS nuevo, Chrome 139+ marzo 2026) para coherencia sin sacrificar legibilidad.
4. **"Action items" en lugar de "Recent activity"** (Pilot pattern). Con ~10s de sesiones, una checklist priorizada ("3 perfiles sin generar · 2 sesiones >24h · 1 magic link vencido") rinde más que una tabla genérica de últimas.
5. **Stage-based funnel visual** (Capchase/Resolve Kanban). Cohorte por status como columnas horizontales en lugar de un line chart vacío. Las decisiones de Vértice viven en stages: `iniciada → cajas-en-progreso → sintetizando → completa`.

---

## Contexto

**Producto:** Vértice — SaaS B2B para instituciones financieras MX (bancos, sofomes, financieras non-banking) que estructura criterios crediticios vía entrevista de 12 min.

**Stack:** Next.js 15 App Router · React 19 · Tailwind v4 · `motion` ^12.38 · `@base-ui/react` ^1.4 · Drizzle ORM · Neon Postgres.

**Estado actual del dashboard (`app/admin/page.tsx`):**
- 4 StatCards (instituciones, sesiones totales, perfiles JSON, abiertas) en grid 2x2 / 4x1
- Panel export CSV/JSON × 4 entidades
- Tabla de 10 sesiones recientes con StatusPill (cinco status: abierta, pausada, sintetizando, completa, abandonada)
- Force-dynamic, queries Drizzle paralelas en RSC

**Lenguaje visual recién establecido (admin-header.tsx):**
- Floating organic blob ink con SVG goo filter (`stdDeviation=7`, colorMatrix `0 0 0 18 -7`)
- Nav extrusión bottom-left fusionada, active pill gold con `motion.span layoutId="admin-nav-active"`
- Page title animado con motion + `springs.elegant`
- Sticky `top-4`, max-w-6xl, alineación vertical con `<main>`

---

## Agente 1 · Referencias visuales distintivas

### Robinhood (Porto Rocha rebrand, 2024)
- **Por qué:** Fintech que abandonó el palette arcoíris por **negro + lime-chartreuse + serif Martina Plantijn** sobre sans Robinhood Phonic.
- **Para Vértice:** Dual-type system. **Serif display gold para títulos de panel** ("Resumen", "Sesiones recientes") + sans actual para UI rompe Vercel genérico sin tocar arquitectura.

### Pattern Breaking (Driftime®, Awwwards HM)
- **Por qué:** Brutalist-editorial. **Stacking asimétrico modular** de stats e infografías con tipografía display 120-200px.
- **Para Vértice:** Una métrica clave (e.g., "Perfiles generados este mes") tratada como portada editorial — número a 120-180px en gold, data secundaria como sidebar tipo "ficha técnica".

### Bevel Health (nooon, Awwwards)
- **Por qué:** Dashboard de salud que **suaviza densidad de datos con formas orgánicas** en lugar de cards rectangulares. Gráficas envueltas en SVG paths orgánicos.
- **Para Vértice:** Más alineado con nuestro goo. Sparkline / donut envuelto por blob ink con cream interior — alta cohesión con header pero CUIDADO con readibility de números (ver Agente 3, principio del goo).

### Cleo AI (OddCommon, Awwwards HM marzo 2026)
- **Por qué:** **Jerarquía de voz tipográfica** — frases enteras como statement display ("Tu cartera creció 12% este mes"), no como label diminuto sobre un número.
- **Para Vértice:** Humaniza el admin B2B mexicano sin caer en infantilismo. Ejemplo: en lugar de "Sesiones · 23 · +3", escribir "23 sesiones esta semana, 3 más que la pasada" como bloque editorial.

### Mercury (mercury.com)
- **Por qué:** Luxury monochrome — confianza institucional sin dark mode obligatorio. Fotografía editorial cropeada extrema del dashboard en marketing.
- **Para Vértice:** Modelo más cercano por restraint cromático.

### Klarna
- **Por qué:** **Three-alignment offset grid** — los elementos no se alinean a un solo eje; crean tensión playful sin caos. Brutalist controlado.
- **Para Vértice:** El truco más subestimado de la lista. Sidebar flush left + KPI hero centrado + secondary stats flush right. **Combinado con paleta ink/gold/cream rompe el "Vercel genérico" sin sacrificar escaneabilidad.**

### Datadog
- **Por qué:** **Asymmetric bento** maduro — 12-col grid con tiles de tamaño intencional (8-col hero + 2-col stats).
- **Para Vértice:** El header orgánico puede VIVIR como tile non-rectangular del bento (col-span variable) en vez de componente aislado.

### Plaid (plaid.com)
- **Por qué:** **Heritage banknote aesthetic** — patrones guilloché, retratos grabados, Heimat Mono para captions. Tradición + tecnología.
- **Para Vértice:** **Patrón guilloché en gold opacity 8-15%** como background de cards "Operaciones" o divider entre secciones evoca billete/título-valor sin caricaturizar. Captions en **mono** para timestamps, IDs, currency.

### Cofactr (View Source, Awwwards HM abril 2026)
- **Por qué:** Industrial/technical — density alta + UN solo color acento. Personalidad por type mono + disciplina cromática.
- **Para Vértice:** Para vistas con muchas filas (sesiones detalle), tabla densa estilo terminal con gold como único acento (filas activas, edges) consigue "Bloomberg pero cálido".

### Patrón meta
Las 9 referencias convergen en **comprometerse con (a) sistema tipográfico custom + (b) acento de color defendible + (c) UNA convención visual rara y consistente**. Vértice ya tiene las tres patas (ink/gold/cream + blob orgánico) — falta empujar jerarquía display (Robinhood/Pattern Breaking) y meter al menos un eje asimétrico (Klarna).

---

## Agente 2 · Patrones UX production-grade

### Convergentes (≥3 productos = "givens" 2026)

1. **Side-drawer > modal** para record detail (Stripe, Mercury, Anthropic Console, Notion). 480-560px, slide-in derecha, ESC-dismiss. Preserva context, permite keyboard nav del parent list.

2. **Status como pill low-saturation o dot coloreado** — nunca neón, nunca traffic-light red (Linear, Stripe, Vercel, Notion, Anthropic). Saturación 40-60%, texto en tono matched darker, no white-on-fluorescent.

3. **Typography-led metrics, no card-led** (Linear, Mercury, Stripe, Vercel). Numerales tabulares + sparklines monocromos + spacing. No bordered/shadowed "KPI boxes."

4. **Command palette (⌘K) como nav primaria** (Linear, Raycast, Warp, Vercel, Stripe `/`). Sidebar + palette juntos: la palette absorbe power-user, la sidebar se queda calma. **Vértice ya tiene esto.**

5. **No gradients ni drop-shadows en data surfaces** (Linear explícito, Stripe, Vercel, Mercury, Anthropic). Elevation via surface tone + hairlines 1px, no blur. Gradientes reservados a marketing o accent moments. **Vértice ya respeta esto en el header.**

### Divergentes que vale stealing

1. **Vercel's screenshot-as-hero** — thumbnail del último production deployment como hero visual del project overview. Para Vértice: **embed-preview del último perfil_decision_final generado** como hero visual del dashboard.

2. **Mercury's oversized typographic balance** — un número dominante a 72-96px sin card, sin icon, sin border. Pure type weight. **Pareja natural con el blob orgánico del header** (silueta orgánica contrastada con tipografía sobria masiva).

3. **Warp's "block" model** para record rows — thin left accent rail on hover, metadata belt mono dimmed, per-block actions top-right. Para Vértice: cada sesión como block con rail gold cuando active, belt mono (id, duración, cajas).

### Detalles por producto (extractos)

- **Linear:** Inverted L-chrome, sparklines monocromo, deltas neutral text (no red/green default), activity rows ~32px, status dot + label, LCH hover tints.
- **Vercel:** 2-col asym grid, **deployment screenshot como anchor visual**, Geist Mono para números, tab favicon mirror state.
- **Mercury:** **Balance como single large number** display-weight oversized, cashflow chart full-width, vendor logo 32px + merchant + category tag, sign-aware color (green in / neutral out, NUNCA red brillante).
- **Stripe:** 3-zone (sidebar + main + slide-in drawer), 6 type sizes enforced, status pills low-sat con texto matched-hue, persistent global search (`/`).
- **Raycast:** Hover/focus = single rounded pill highlight, footer action bar updates per row (always-visible affordance), separators absent inside groups (group headers tiny uppercase).
- **Anthropic Console:** Filter row → stacked area chart → request log table. Color reserved para differentiate model tiers (Opus/Sonnet/Haiku).
- **Warp:** Block model — cada cmd+output es discrete visual unit con own selection ring + per-block actions menu. Metadata belt mono (duration, exit code, host).

---

## Agente 3 · Lenguaje orgánico aplicado a UI seria

### El principio (sintetizado)

> **Lo orgánico añade valor cuando es semántico: comunica agregación, jerarquía, dirección o estado. Es decoración cuando solo "suaviza" sin codificar información.**

Para Vértice B2B fintech, la respuesta NO es blobificar todas las cards. Es:

1. **`corner-shape: squircle` global** (Chrome 139+, marzo 2026) — cohesión con header goo sin tocar layout. Línea CSS de una sola.
2. **Goo SVG solo en clusters de status dots / notification badges** — no en cards de números.
3. **Squiggle SVG divider entre regiones jerárquicas** (KPIs vs histórico).
4. **Asimetría sutil solo donde "apunta"** (activity items conectados a timeline rail).
5. **Dejar la curva orgánica al sparkline interno** (Stripe principle).

### CSS técnicas — tabla resumen

| Técnica CSS | Costo impl. | Costo mant. | Impacto visual | Recomendación |
|---|---|---|---|---|
| `corner-shape: squircle` | Bajo (1 línea + @supports) | Cero | Alto, sutil | **Hazlo ya — global** |
| `border-radius` 8-value asimétrico | Bajo | Bajo | Medio-alto | Solo en 1 card jerárquica |
| `clip-path: path()` SVG custom | Medio | Medio (hit-target gotcha) | Alto | Solo cards no-clickeables |
| `mask-image` SVG (divider) | Medio | Bajo | Medio | Sí, entre secciones |
| `filter: url(#goo)` extendido | Alto (legibilidad frágil) | Alto | Muy alto | Solo dot clusters / badges |
| Sparkline orgánico interno | Bajo (Recharts curve) | Bajo | Medio | **Hazlo en metric cards** |
| Squiggle divider | Bajo | Bajo | Medio | Sí, separadores semánticos |
| Morph border-radius keyframes | Bajo | Medio (CPU) | Alto pero distrae | Solo loading states |

### Snippets clave

**Squircle global (Chrome 139+):**
```css
.card {
  border-radius: 24px;
  corner-shape: squircle;
}
@supports not (corner-shape: squircle) {
  .card { border-radius: 18px; } /* fallback más conservador */
}
```

**Goo aplicado a status dot cluster (NOT a cards de texto):**
```html
<svg style="position:absolute;width:0;height:0">
  <filter id="goo-dots">
    <feGaussianBlur stdDeviation="4"/>
    <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"/>
    <feComposite in="SourceGraphic"/>
  </filter>
</svg>
<div class="status-cluster" style="filter:url(#goo-dots)">
  <span class="dot dot--ok"></span>
  <span class="dot dot--warn"></span>
  <span class="dot dot--ok"></span>
</div>
```

**Squiggle divider entre secciones:**
```css
.section-divider {
  height: 24px;
  mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 24' preserveAspectRatio='none'><path d='M0,12 Q300,0 600,12 T1200,12 L1200,24 L0,24 Z' fill='black'/></svg>");
  background: var(--gold);
}
```

### Insights del paneo

- **Stripe** no usa orgánico en data display — sparklines como vector orgánico INTERNO, contenedor sobrio.
- **Anthropic** canaliza calidez por tipografía (Tiempos serif + Styrene squircle), NO por silueta.
- **Apple HIG** — squircle dejó de ser refinamiento opcional, es baseline 2026.
- **Rauno / Vercel design** rara vez añaden forma orgánica a cards de datos. Cuando lo hacen es (a) elemento único jerárquicamente superior, (b) puramente identitario (logo, empty state), o (c) transición entre regiones.

---

## Agente 4 · Patrones fintech específicos

### Tres patrones que funcionan para low-volume data (~10s de sesiones)

1. **Number-first, chart-second** (Mercury, Pilot). Números grandes 48-64px, sparklines sutiles o eliminadas. Con 10s de sesiones un line chart se ve vacío; un número grande se ve confiado.

2. **Action items > Recent activity** (Pilot.com). Tabla de "recent" → checklist de "needs attention" (sesiones abandonadas, perfiles sin generar). Más útil cuando volumen es bajo — cada fila merece atención individual.

3. **Stepped funnel con conteos absolutos** (Capchase/Resolve). En lugar de % de conversión (con N=15 es ruido estadístico), números crudos: "23 iniciadas → 18 progreso → 14 completas". Stages tipo columnas Kanban.

### Tres antipatterns a evitar

1. **Dashboards "Bloomberg terminal"** — densidad extrema, grid 6x4 con charts, ticker scroll. Vértice no es trading, es estructuración de criterios crediticios.
2. **Sparklines en KPIs sin tendencia real** — si "Sesiones abiertas" varía entre 2-5, sparkline es engañosa. Mostrar número + delta texto ("+3 vs sem. pasada").
3. **Empty states genéricos con ilustración stock** — preferir copy con próxima acción concreta ("Sin sesiones esta semana. Las nuevas aparecerán aquí cuando un cliente termine la entrevista de 12 min.").

### Notas por producto

- **Stripe:** Gran número arriba-izquierda + delta + sparkline. Filtros chip. Empty states con ilustración línea fina + CTA + link a docs. Söhne tipografía. **Modelo de tabla densa con status pills sutiles.**
- **Mercury:** Balance total como número masivo (48-64px) sin card, sparkline 30d sutil. Feed estilo email inbox (logo + descripción + monto right). Sin status pills agresivos. **Modelo para tipografía héroe.**
- **Brex:** Card grid 4-up con número + delta + sparkline. Filter chips guardables ("Save view") — útil para Vértice "Sesiones por institución".
- **Ramp:** Big number animado al cargar. AI confidence scores. Sidebar 240px, content 1200px.
- **Pilot.com:** **Action items como checklist arriba de tablas** — patrón excelente cuando hay pocas filas. Cada item: descripción + due date + CTA. **Patrón crítico para Vértice.**
- **Modern Treasury:** Display "as explicitly and granularly as possible" — no redondear, valores precisos. Color-coded badges. ⌘K Quickswitch.
- **Plaid:** Issue Center destacado — patrón replicable para Vértice (sesiones abandonadas, perfiles incompletos).
- **Resolve/Capchase:** **Kanban-style stages** para órdenes B2B — patrón directo para funnel de sesiones (iniciada → cajas progreso → sintetizando → completa).

### Patrones específicos Vértice

- **Funnel:** Stepped bar con conteos absolutos + % drop-off entre pasos. Mejor que line chart vacío.
- **Cohort views (tipo institución):** Tabs segmentados (Stripe Connect pattern). Cada tab mismo layout filtrado. O small multiples (3 cards idénticas lado a lado).
- **Time-series baja frecuencia:** Bar charts por semana/mes (Pilot pattern) o dot plots con cada sesión como punto. NO line charts continuos.
- **Utility vs Executive balance:** Modern Treasury — misma página, distintas zonas. Top half para founder (stat cards grandes), bottom half para operador (tabla densa con filtros). **No dos dashboards.**

**Modelo más cercano a copiar:** **Mercury + Pilot.com**. Mercury por restraint cromático + números héroe; Pilot por "action items" pattern.

---

## Agente 5 · Animación motion.dev (2026)

### Top 5 recomendaciones para el rediseño

1. **View Transitions API para rutas, motion.dev para in-surface** — separación limpia, no double-animation. Configurar `next.config.ts experimental.viewTransition: true`. View Transitions son GPU-accelerated y se integran con Suspense.

2. **Stagger-on-mount blur-fade-rise** para KPI grids usando `springs.soft` — 50ms stagger, 4px blur, 8px Y. Subtle, professional, fast.

3. **`layoutId` tab pill** con `springs.elegant` — biggest perceived-quality win bajo 20 LOC. Ya lo usamos en admin-header (`admin-nav-active`).

4. **`useMotionValue` tickers** con ease-out-expo (NO spring para money/percentages), reduced-motion-gated — para cada stat card.

5. **Direction-aware sticky header** via `useMotionValueEvent`, no parallax — fintech necesita density, no theatre. (Ya tenemos sticky, falta el direction-aware hide-on-scroll-down).

### Patrones por categoría (resumen)

**Entry on mount:** Blur+fade+Y translate beats slide-only. Stagger 40-60ms entre siblings. **Animate el container, no 30 rows.** Gate en `useEffect` mount (no animar back-from-cache).

**Layout animations:** `layout` + `LayoutGroup` + `AnimatePresence` para filter/sort/expand. `motion` usa transform (no paint width/height) → cheap incluso con 200 rows. Para tab indicators `layoutId="active-tab"`.

**Scroll-driven:** `useScroll` + `useTransform`. Sticky headers: direction-aware hide/show via `useMotionValueEvent` (NO continuous parallax — compite con la data). Solo animar `opacity`, `transform`, `filter`, `clipPath`.

**Microinteractions:** Card hover = `whileHover={{ y: -2 }}` + radial-glow CSS var via `--mx/--my` pointermove (zero React re-render). Tap: `whileTap={{ scale: 0.985 }}` con `snap` spring. **NUNCA tilt/3D en B2B fintech** — reads as toy.

**Skeleton:** Suspense + skeleton matching DOM shape, 120-180ms min-display anti-flicker. Content-shape skeletons > genéricos. Anti-flicker wrap en `ViewTransition exit="slide-down"`.

**Page transitions:** React `<ViewTransition>` + Next.js 15 config. `share="morph"` para shared elements (KPI dashboard → detail page hero). Anchor sidebar/header con `viewTransitionName` + `animation: none`.

**Number tickers:**
```tsx
function Ticker({ to, format }: { to: number; format: (n: number) => string }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => format(v));
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return void mv.set(to);
    const c = animate(mv, to, { duration: 1.4, ease: [0.16, 1, 0.3, 1] });
    return () => c.stop();
  }, [to, reduce]);
  return <motion.span>{text}</motion.span>;
}
```

**Status pill changes:** `layout` para width changes + `AnimatePresence mode="wait"` para icon swap. `springs.elegant` para shape, 160ms tween para color (springs en color feel mushy). Pulse `scale: [1, 1.04, 1]` solo en transitions meaningful (approved/failed).

### Spring tuning (concrete table)

| Preset existente | Stiffness/Damping/Mass | Use case |
|---|---|---|
| `snap` | 520/28/0.4 | Toggles, hover lift `y`, tap feedback — instant no overshoot |
| `elegant` | 320/22/0.55 | **Workhorse** — layoutId, card expand, modal enter, status pill width |
| `soft` | 380/26/0.6 | Card mount fade+blur, sidebar collapse — gentle, no bounce |
| `bounce` | 280/14/0.5 | Toast success ONLY. Sparingly en B2B fintech. |
| `indicator` | 360/26/0.55 | Scroll progress, breadcrumb indicators |

**Don't spring:** opacity-only, color, focus rings, count-up numbers, scroll-driven values.

### Reduced motion + Performance rules

- `MotionConfig reducedMotion="user"` root-level — disables transforms + layout, preserva opacity/color.
- **Animate:** transform, opacity, filter, clipPath, backdrop-filter (sparingly).
- **Avoid:** width, height, top/left/right/bottom, margin, box-shadow on large surfaces, border-radius during scroll.
- `useMotionValue` para high-frequency (count-up, drag, scroll) — bypasses React reconciler.
- Layout animations en lists >100: gate behind virtualization, `layout={false}` en rows out of viewport.

### When NOT to animate

- Pagination clicks (instant swap = faster).
- Routine refresh (5-min poll) — solo user-initiated.
- Tabular sorting >50 rows — flash background highlight, no FLIP.
- Form validation errors — instant.
- Inside modal already animating — no nested entry choreography.

---

## Agente 6 · Audit del repo actual

### A. Primitives reutilizables

**Landing (surface ink):** `Button`, `Card` (default/manifest/compact), `Section`, `Stack`, `Eyebrow`, `Hairline`, `Atmosphere` (warm/cool/dense), `Icon` (Lucide wrapper).

**Entrevista (surface cream):** Mismo set con survey surface tokens (`--survey-bg`, `--survey-surface`, `--survey-text-72`).

**Admin-specific:** `AdminHeader`, `CommandPaletteTrigger`, `AdminTooltip`, `MagicLinkActions`, inline `StatusPill`/`StatCard`/`EmptyState` en `app/admin/page.tsx`.

### B. Tokens disponibles

**Colores brand:**
- `--ink` (#0A0F1C), `--cream-pure` (#F4F1EA), `--gold` (#C8A864), `--gold-deep` (#866D38, AA sobre white), `--gold-bright` (#F2D89C), `--burgundy` (#8B3A3A)

**Survey surface:** `--survey-bg` (#FAF8F4), `--survey-surface` (#FFFFFF), `--survey-card-1` (ink), `--survey-text-{72,45}`, `--survey-hairline{,-strong}`

**Type scale:**
- `--type-hero` (46-108px), `--type-display` (34-64px), `--type-h2` (28-46px), `--type-h3` (20-28px)
- `--type-body-lg` (17px), `--type-body` (15.5px), `--type-caption` (13px), `--type-eyebrow` (10.5px)

**Spacing:** `--space-{1,2,3,4,6,8,10,14,20,28,36}` (4px base). `--section-y` (clamp 56-144px), `--stack-{tight,default,loose}`.

**Radius:** `--radius-sm` (8), `--radius-md` (12), `--radius-card` (18), `--radius-section` (28), `--radius-pill` (9999).

**Shadows:** `--shadow-hairline-{ink,cream}`, `--shadow-gold-seam`, `--shadow-card-ink`, `--shadow-cta-glow{,-cream}`, `--shadow-dialog`.

**Motion durations:** `--dur-micro` (160), `--dur-fast` (240), `--dur-layout` (380), `--dur-hero` (720), `--dur-epic` (1200).
**Easings:** `--ease-out-expo` (0.16,1,0.3,1), `--ease-ios-sheet`, `--ease-back*`, `--ease-soft`.
**Springs TS:** `snap`, `elegant`, `soft`, `bounce`, `indicator`.

### C. Constraints no-negociables

- **ADR-001:** Dos sets paralelos (landing/entrevista), NO surface-aware primitivos.
- **ADR-003:** Tokens semánticos via CSS vars + arbitrary Tailwind. **NO custom Tailwind config.**
- **ADR-004:** **Lucide-only iconos.** Si no existe: el más cercano Lucide o SVG inline.
- **ADR-006:** Primitives para páginas NUEVAS. Componentes existentes con styling bespoke deliberado NO se retrofitean.
- **ADR-008:** Radius + shadow tokens cubren casos canónicos, NO permutaciones. Inline + comentario OK, promover a token si ≥2 usos.
- **ADR-011:** Wave 5 cierra el design system. Shadcn role mapping remapped a brand tokens.
- **Prohibido:** Uso de legacy `--forest`/`--lime`/`--canvas` en código nuevo.

### D. Data shape disponible

**Tablas principales:**
- `instituciones`: id, razon_social, nombre_comercial, tipo (banco/sofom_er/sofom_enr/sofipo/socap/arrendadora/factoraje/ifc/otro), email_contacto, created_at
- `sesiones`: id, institucion_id, status (abierta/pausada/sintetizando/completa/abandonada), started_at, closed_at, ultimo_turno_at, duracion_total_segundos, cajas_llenas_count, cajas_aplicables, fatiga_detectada, consentimiento_at
- `magic_tokens`: id, token_hash, institucion_id, expires_at, consumed_at, revoked_at
- `extracciones`: sesion_id, caja_codigo, valor (jsonb), confianza (float), fuente, superseded_by
- `perfil_decision_final`: institucion_id, sesion_id, perfil_json, schema_version, completitud, confianza_global, embedding (pgvector 1536)
- `reviews_seccion`: sesion_id, grupo_ui_codigo, turno_disparador, decision_opus, guidance_opus, round
- `cajas_declinadas`: sesion_id, caja_codigo, razon, review_id_origen

**Endpoints:** `/admin/api/export/{instituciones|sesiones|extracciones|perfiles}?format={csv|json}`, `/admin/api/search?q=`.

### E. Gaps (primitives faltantes)

- **`<DataTable>`** — sorting, filtering, pagination. Consume `--radius-card`, hairlines, motion tokens.
- **`<MetricCard>` con sub-slots** — label + value + delta + sparkline + trend arrow.
- **Sparkline/chart wrapper** sobre Recharts o Nivo con paleta gold para series principal.
- **`<EmptyState>` primitive** — variant con icon, message, CTA optional (actualmente inline).
- **`<Tabs>` / segmented control** — `--radius-pill` + `--shadow-gold-seam` para active.
- **`<Funnel>` o `<KanbanColumn>`** — para stages de sesiones.

### F. Lenguaje visual establecido por admin-header

**El header es el LANGUAGE BASE — el resto del dashboard debe respetar:**

- **Color:** `bg-ink` body, `text-primary-foreground` (cream), active = `bg-gold` + hairline gold subtle (`0 0 0 1px rgb(200 168 100 / 0.4)`).
- **Radius:** `rounded-full` pills, `--radius-pill` global para CTAs.
- **NO drop-shadows externas** — profundidad via atmosphere interna (radial gold + noise clipeados a `rounded-full`). **Rediseño dashboard sigue patrón: flat siluetas, atmosphere interna.**
- **Motion:** Active nav `springs` inline (360/28/0.5), page title fade `outExpo` 280ms, hover icon `scale-[1.05]` 300ms ease-out.
- **Goo filter:** Solo header (main pill + extrusion). **Si rediseño introduce nuevas shapes secundarias, considerar expandir blob layer.**
- **Layout:** Header `sticky top-4` `max-w-6xl`, main content matches `max-w-6xl`. Header `md:pb-12` para nav extrusión.

---

## Síntesis · Convergencias y divergencias

### Lo que TODOS dicen (givens 2026)

1. **Tipografía héroe + sparklines monocromos** sustituyen bordered KPI cards
2. **Status pills low-saturation**, nunca neón
3. **No drop-shadows en data surfaces** — hairlines + surface tone
4. **Side-drawer > modal** para record detail
5. **⌘K command palette** para power users
6. **Squircle / corner-shape como baseline** (post-Chrome 139)
7. **Stagger blur-fade-rise** para entry, `layoutId` para tabs/filters, `useMotionValue` tickers para números

### Lo distintivo a robar

1. **Klarna's offset-axis grid** (3 ejes de alineación) — diferenciación sin sacrificar escaneabilidad
2. **Pattern Breaking's display-scale stats** (120-180px) — un número hero por zona, tratado como portada editorial
3. **Mercury's oversized balance** + **Pilot's action items** = modelo más cercano para Vértice
4. **Plaid's guilloché** en gold 8-12% opacity como background de hero zone — evoca banknote sin caricatura
5. **Warp's "block" model** para activity rows — rail accent + metadata belt mono
6. **Resolve/Capchase Kanban funnel** — stages como columnas (ideal para low-volume + decision-stage Vértice)

### Lo que NO conviene

1. Bloomberg terminal aesthetic (no es trading)
2. Sparklines vacías con N<10 datapoints
3. Empty states con ilustración stock
4. Tilt/3D microinteractions (toy-like en B2B fintech)
5. Goo filter aplicado a cards con texto (legibilidad rota)
6. Dos dashboards (founder vs operador) — preferir mismo dashboard, distintas zonas

---

## Propuesta de dirección · Rediseño V1

### Layout · 4 zonas

```
┌──────────────────────────────────────────────────────────────────┐
│ AdminHeader (existente) — organic blob ink + nav extrusion       │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  ZONA 1 · HERO EDITORIAL                            guilloché bg │
│                                                                   │
│  Resumen de cartera · Octubre                                     │
│  ──── (hairline gold)                                             │
│                                                                   │
│   23                              ── perfil promedio              │
│   ─────                           Completitud  87%                │
│   instituciones                   Confianza   0.91                │
│   aliadas                         Tiempo prom. 11.4 min           │
│                                                                   │
│   (display 128px, gold)           (caption mono, ink/72)          │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘

           ╔══ squiggle divider en gold ══╗

┌──────────────────────────────────────────────────────────────────┐
│  ZONA 2 · FUNNEL POR STAGE (Kanban)                              │
│                                                                   │
│  ┌─ Iniciadas ─┐  ┌─ Progreso ─┐  ┌─ Sintetizando ┐  ┌─ Listas ─┐│
│  │   18        │  │   12       │  │   4            │  │   23     ││
│  │  (counts +  │  │ avg cajas  │  │ avg latencia   │  │ promedio ││
│  │   sparkline)│  │  6/12      │  │  2.3 min       │  │ confianza││
│  └─────────────┘  └────────────┘  └────────────────┘  └──────────┘│
└──────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────┬────────────────────────────────┐
│  ZONA 3a · ACTION ITEMS         │  ZONA 3b · ACTIVITY TIMELINE   │
│                                  │                                 │
│  ◉ 3 perfiles sin generar       │  hace 5 min                     │
│    Constructora X completó →    │  Banco Bajío · sesión cerrada   │
│                                  │  (block model: rail gold,      │
│  ◉ 2 sesiones >24h sin cerrar   │   metadata belt mono)          │
│    Banco Y · 18h sin turno  →   │                                 │
│                                  │  hace 23 min                    │
│  ◉ 1 magic link vencido         │  Sofom ABC · sesión iniciada    │
│    Sofom Z · re-enviar      →   │                                 │
│                                  │  hace 1h                        │
│  (Pilot pattern, priorizado)    │  Financiera Q · perfil generado │
│                                  │  (side-drawer al click)         │
└─────────────────────────────────┴────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  ZONA 4 · EXPORTS (compact pills row)                            │
│  Instituciones · Sesiones · Extracciones · Perfiles              │
│  (CSV · JSON cada uno)                                            │
└──────────────────────────────────────────────────────────────────┘
```

### Decisiones específicas

**Tipografía:**
- Hero number: `text-[clamp(96px,12vw,180px)] font-semibold text-gold tabular-nums tracking-[-0.04em]` (Pattern Breaking pattern, gold sobre cream)
- Hero label: `text-eyebrow text-foreground/55` (existing eyebrow scale, mono uppercase tracked)
- Section title: `text-[clamp(20px,2vw,28px)] font-semibold text-foreground` (sans, ink) — quizás migrar a serif display si introducimos un weight serif
- Body: existing `text-body` y `text-caption`
- IDs / timestamps / counts: `font-mono text-foreground/55 text-[11.5px]`

**Color:**
- Backgrounds: `--survey-bg` (taupe-warm) page, `--cream-pure` cards
- Acentos: `--gold-deep` para números AA-compliant sobre cream, `--gold` para hero displays y active states
- Hairlines: `--shadow-gold-seam` (inset gold 0.18) en cards de hero, `--shadow-hairline-ink` para regular

**Radii:**
- `--radius-section` (28px) en cards grandes (hero, funnel)
- `--radius-card` (18px) en cards medianos (action items, activity blocks)
- `--radius-pill` (9999px) en chips, buttons, status
- **Apply `corner-shape: squircle` globally** con `@supports` fallback

**Sombras:**
- NINGUNA drop-shadow externa (consistente con header)
- Profundidad via `Atmosphere` primitive interno (radial gold corner) + hairline gold/ink

**Motion:**
- Mount: stagger 50ms blur(4px) + y(8px) + opacity(0) → solid usando `springs.soft`
- Funnel columns: `layout` + `layoutId` para que counts animen al cambio
- Stat numbers: `useMotionValue` ticker con `ease-out-expo` 1.4s, reduced-motion gated
- Status pills: `layout` width + `AnimatePresence mode="wait"` para icon swap
- Card hover: `whileHover={{ y: -2 }}` + radial-glow CSS var via pointermove
- Page transitions: View Transitions con `share="morph"` para hero number

**Lenguaje orgánico (selectivo):**
- **Squircle global** via `corner-shape`
- **Squiggle divider gold** entre Zona 1 y Zona 2 (semántico: separa "estado" de "flujo")
- **Goo filter en status dot cluster** (ej. "23 abiertas · 4 sintetizando · 12 completas" como 3 dots fusionados)
- Sparkline interno en metric cards con curve `monotone`

**Patrones específicos:**
- **Action items priorizados** (Pilot) — query de "urgencias" del último turn
- **Funnel Kanban** (Capchase) — 4 columns para los stages canónicos
- **Block model** para activity rows (Warp) — rail gold accent + metadata mono belt
- **Side-drawer detail** (Stripe) — click en activity row abre drawer 480-560px con detalle de sesión

### Gaps a construir (nuevos primitives)

Antes del rediseño, crear:

1. **`<MetricCard>`** — `components/admin/MetricCard.tsx`. Slots: eyebrow, value, delta, sparkline, hint. Variants: hero (display 128px), default (body), compact (caption).
2. **`<Sparkline>`** — wrapper sobre Recharts (o SVG custom si <2KB) con paleta `--gold-deep` + `--gold` (fill 8% opacity).
3. **`<FunnelStage>`** — column with title + count + sparkline + delta. Layout animation on count change.
4. **`<ActionItem>`** — row con icon + label + meta + CTA. Hover state con rail gold.
5. **`<ActivityBlock>`** — Warp-style row con rail gold + metadata belt mono + click→drawer.
6. **`<DataDrawer>`** — Base UI Dialog en `side="right"` con motion slide-in.
7. **`<SquiggleDivider>`** — SVG path mask en gold 12% opacity, height 24px.
8. **`<DotCluster>`** — wrapper goo filter para status dots agregados.
9. **`<Atmosphere>` reuse** — el primitive landing ya existe, solo importarlo en admin.

### Atmosphere admin

Migrar `.atmosphere-radial-gold` y `.atmosphere-noise` de `globals.css` legacy a `components/admin/AdminAtmosphere.tsx` o reusar el `<Atmosphere>` primitive landing con prop `variant="admin"` (warm + gold-leaning).

---

## Próximos pasos

### Fase 0 · Validación dirección (esta sesión o próxima)

- [ ] Founder review: ¿la dirección "Mercury + Pilot + Klarna offset + Plaid guilloché" suena bien o necesitamos pivot?
- [ ] Decidir si introducir **serif display** (Robinhood/Plaid pattern) o quedarse mono-typeface
- [ ] Sign-off de la inversión en 9 primitives nuevos

### Fase 1 · Primitives básicos (~4-6h)

- [ ] `<MetricCard>` con sus 3 variants
- [ ] `<SquiggleDivider>` SVG mask
- [ ] `<DotCluster>` con goo filter
- [ ] Migrar `.atmosphere-radial-gold` a primitive componible
- [ ] Setup `corner-shape: squircle` global via `@layer base`

### Fase 2 · Layout zones (~3-4h)

- [ ] Refactor `app/admin/page.tsx` a las 4 zonas
- [ ] Zone 1: Hero editorial con display number + action data
- [ ] Zone 4: Compact exports row (mantener funcionalidad existente)

### Fase 3 · Funnel + Activity (~5-6h)

- [ ] `<FunnelStage>` × 4 con Drizzle queries por status
- [ ] `<ActionItem>` lista priorizada (sesiones >24h, perfiles pendientes, magic links vencidos)
- [ ] `<ActivityBlock>` reemplazo de tabla actual
- [ ] `<DataDrawer>` con detalle de sesión (reutilizar layout de `/admin/sesiones/[id]`)

### Fase 4 · Motion polish (~2-3h)

- [ ] Stagger mount con `springs.soft`
- [ ] Tickers en metric cards con `useMotionValue`
- [ ] `MotionConfig reducedMotion="user"` en root admin
- [ ] View Transitions API setup en `next.config.ts`

### Fase 5 · Cleanup (~1-2h)

- [ ] Remove old StatCard/EmptyState/StatusPill inline definitions de `app/admin/page.tsx`
- [ ] Update ADRs / DESIGN_SYSTEM.md con nuevos primitives admin
- [ ] Visual QA cross-browser (squircle fallback Chrome <139)

**Estimado total:** 15-21 horas de implementación una vez la dirección esté validada.

---

## Anexos

### Constraints técnicos cementados

- Next.js 15 App Router + RSC (server-first queries)
- Tailwind v4 — `@layer base` para `corner-shape` global
- `motion` 12.38 (formerly Framer Motion)
- `@base-ui/react` 1.4 (Dialog, Tooltip ya en uso)
- ADRs vigentes: 001-011 (ver `docs/design/tokens/DECISIONS.md`)

### Fuentes principales

- Awwwards Data Visualization, CSS Design Awards 2025-2026
- Linear, Vercel, Mercury, Stripe, Raycast, Notion, Anthropic Console, Warp design surfaces
- Modern Treasury journal · Pilot.com · Brex · Ramp · Plaid · Capchase
- Visual Cinnamon (gooey applied to data viz)
- motion.dev docs · Next.js View Transitions guide
- Rauno Freiberg · Emil Kowalski · Josh W. Comeau (motion craft)
- Apple HIG · Smashing Magazine corner-shape CSS

### Open questions para el founder

1. **Hero metric:** ¿"Instituciones aliadas" o "Perfiles generados" como número dominante? Probablemente el segundo (más action-able, refleja delivery del producto).
2. **Serif display:** ¿abrir la puerta a una segunda typeface (display) o quedarse mono-typeface por simplicidad y closure del design system?
3. **Guilloché pattern:** ¿lo introducimos o queda muy "vintage" / fuera del look fintech moderno?
4. **Côhorts por tipo de institución (banco vs sofom vs ifc):** ¿valor inmediato o feature de fase 2?
5. **Action items priorización:** ¿definimos las 4-5 reglas de "needs attention" ahora o iteramos post-V1?
