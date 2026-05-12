# Design Review: Admin panel vs Design System

**Review ID:** admin_panel_20260511
**Reviewed:** 2026-05-11
**Target:** `app/admin/**` + `components/admin/**`
**Comparado contra:** `docs/design/DESIGN_SYSTEM.md` (Waves 1-5 cementadas)
**Focus:** Visual, brand alignment, layout, hierarchy

---

## Resumen ejecutivo

El admin panel **migró nombres de tokens** (forest/lime → ink/gold, ADR-010, ADR-011) pero **no migró la arquitectura visual**. Sigue siendo un panel "Phase 9" — funcional, plano, sobre un fondo taupe legacy (`--canvas`) que no existe en ningún otro surface del producto. El landing es ink editorial. La entrevista es cream-pure paper. El admin es taupe corporate — la única superficie del producto que no respira brand.

Renderiza correctamente los tokens nuevos (gold-deep en links, ink en CTAs, sparkles status pills usando gold-bright). Pero **no consume el sistema** que se cerró: cero `.text-display`, cero `.text-eyebrow`, cero `.gold-hairline`/`.gold-seam`, cero `.atmosphere-*`, cero motion. Es el caparazón de la versión anterior con paint nuevo.

**Issues encontrados:** 23
- Critical: 5 (color/surface foundation)
- Major: 10 (tipografía, layout, jerarquía, motion)
- Minor: 8 (hover states, mobile, micro-polish)

---

## Capturas analizadas

Todas en `.ui-design/reviews/screenshots/`:

| # | Vista | Estado |
|---|---|---|
| 01 | `/admin/login` | Card cream flotando en mar taupe |
| 02 | `/admin` (dashboard) | 4 stat-cards iguales + export + sesiones table |
| 03 | `/admin/sesiones` | Filter chips + tabla 14 rows |
| 04 | `/admin/instituciones` | Tabla 14 instituciones |
| 05 | `/admin/magic-links` | Tabla 13 magic links + filter chips |
| 06 | `/admin/instituciones/nueva` | Form 4 inputs + sidebar resultado |
| 07 | `/admin/sesiones/[id]` | 7 cards rounded-3xl apiladas verticales |
| 08 | `/admin/instituciones/[id]` | 4 cards apiladas (institución + sesiones + magic + perfiles) |
| 09 | `/admin` mobile (390×844) | 2-col stat grid + horizontal scroll en tabla |

---

## Critical Issues (foundation off-brand)

### C1. Background del body = `--canvas` legacy taupe

**Severidad:** Critical
**Ubicación:** `app/admin/layout.tsx:30` → `<div className="min-h-screen bg-canvas">`
**Categoría:** Visual / Brand

**Problema.** El layout root del admin usa `bg-canvas` que apunta a `--canvas: oklch(0.62 0.025 75)` — un taupe (`lab(55.95, 2.38, 9.41)` ≈ `#8E8273`). Es un tono que **no existe** en el design system. No es ink, no es cream-pure. Es legacy de Phase 9.

**Evidencia visual.** En `02-admin-dashboard.png` se ve el taupe ocupando ~70% del frame entre header ink y cards cream. Es la sensación dominante de la página.

**Impact.** Rompe la regla de unidad de brand del DS (Wave 5 cerró "1 universo de tokens"). El admin es la única página en el producto sobre taupe. Landing usa `--ink` (#0A0F1C). Entrevista usa `--cream-pure` (#F4F1EA). El operador siente que entró a otro producto.

**Recomendación.** Decidir admin = **ink** (recomendado, ver §Direction abajo) o **cream-pure**. Eliminar `bg-canvas` del layout.

```tsx
// Antes (app/admin/layout.tsx:30)
<div className="min-h-screen bg-canvas">

// Opción A (recomendada — operations console)
<div className="min-h-screen bg-ink text-cream-pure">

// Opción B (paper editorial — espejo entrevista)
<div className="min-h-screen bg-cream-pure text-ink">
```

---

### C2. Cards usan `bg-cream` (OKLCH cream), no `cream-pure`

**Severidad:** Critical
**Ubicación:** `app/admin/page.tsx:86,134,219`, `app/admin/sesiones/page.tsx:70`, `app/admin/instituciones/page.tsx:91`, `app/admin/magic-links/page.tsx:76`, `app/admin/login/page.tsx:33`
**Categoría:** Visual / Brand

**Problema.** `bg-cream` mapea a `--cream: oklch(0.965 0.012 90)` (legacy de Phase 9). El DS canónico es `cream-pure: #F4F1EA`. Visualmente similares pero **distintos**: cream OKLCH es ligeramente más amarillo y tiene más saturación. Cuando se renderiza adyacente al landing en otra pestaña, la diferencia es notable.

**Recomendación.** Replace global `bg-cream` → `bg-cream-pure` en todo `app/admin/*` + `components/admin/*`. Si admin va dark (Opción A), reemplazar por `bg-ink-raised` para surface elevation.

---

### C3. Cero hairlines / cero seam tokens

**Severidad:** Critical
**Ubicación:** todos los cards admin
**Categoría:** Visual / Brand

**Problema.** Cards admin usan `shadow-sm ring-1 ring-foreground/5`. El DS Wave 2 cementó:
- `--shadow-hairline-{ink|cream}` (1px inset hairline)
- `--shadow-gold-seam` (1px inset cream + 1px gold superior)
- `.gold-hairline` utility class
- `.gold-seam` utility class

Cero ocurrencias de estos en admin. Las cards son flotantes con `shadow-sm` genérico — exactamente el shadow-lg-default que está en el banlist global.

**Recomendación.**
```tsx
// Antes
className="rounded-3xl bg-cream p-5 shadow-sm ring-1 ring-foreground/5"

// Después (dark admin)
className="rounded-3xl bg-ink-raised p-5 [box-shadow:var(--shadow-hairline-ink)]"
// o para stat cards principales:
className="rounded-3xl bg-ink-raised p-5 gold-seam"
```

---

### C4. Cero `.text-display` — type scale del DS no se usa

**Severidad:** Critical
**Ubicación:** todos los `<h1>` admin
**Categoría:** Tipografía

**Problema.** El DS spec (§III) define Section H2 como:
- `clamp(28px, 3.6vw, 46px)`
- weight 500
- `leading-[1.02]`
- `tracking-[-0.022em]`
- `font-display` (General Sans)

Admin renderiza H1 como `text-2xl font-semibold tracking-tight text-foreground` (24px Satoshi 600 plain). No usa General Sans, no usa clamp, no aprovecha la ratio 3x del DS landing.

**Evidencia.** Comparar "Resumen" del dashboard (02) vs "Solicitantes / pre-calificados" del landing — diferencia de scale, peso visual y carácter. Admin se siente como un dashboard tutorial.

**Recomendación.**
```tsx
// Antes (app/admin/page.tsx:56)
<h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Resumen</h1>

// Después
<h1 className="text-display text-[clamp(28px,3.6vw,46px)] mt-2 text-cream-pure">
  Resumen
</h1>
```

---

### C5. Cero `.text-eyebrow` — eyebrows custom, off-spec

**Severidad:** Critical
**Ubicación:** dashboard, sesiones, instituciones, magic-links, sesion detail, login
**Categoría:** Tipografía

**Problema.** Admin define el eyebrow inline en cada página:
```
font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground
```

Pero el DS `.text-eyebrow` es:
```
font-mono text-[10.5px] uppercase tracking-[0.32em] text-cream-pure/45
```

Diferencias:
- 10px vs 10.5px (admin más chico)
- tracking 0.22em vs 0.32em (admin **45% más tight** — pierde el "manifiesto" feel)
- `text-muted-foreground` (gris genérico shadcn) vs `text-cream-pure/45` o `text-gold-deep`

**Recomendación.** Reemplazar todos los inline eyebrows por `.text-eyebrow` utility. Considerar variant gold-deep para acentos:
```tsx
// Antes
<p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
  Vista general
</p>

// Después
<p className="text-eyebrow text-gold-deep">Vista general</p>
```

---

## Major Issues (jerarquía, layout, motion)

### M1. 4 stat-cards idénticas (banlist hit)

**Severidad:** Major
**Ubicación:** `app/admin/page.tsx:69-84`
**Categoría:** Layout / Hierarchy

**Problema.** El dashboard arranca con 4 `StatCard` idénticas: Instituciones / Sesiones totales / Perfiles JSON / Abiertas. Mismo radius, mismo padding, mismo type scale. Es exactamente el patrón "Bento grid genérico de 4-6 cards iguales" de la banlist global (CLAUDE.md).

**Recomendación.** Establecer jerarquía. Una métrica primaria full-bleed + 3 secundarias, o un solo "operational pulse" con 3 sub-cifras.

```tsx
// Patrón sugerido (asimetría intencional)
<section className="grid grid-cols-12 gap-3">
  <HeroStat
    className="col-span-12 md:col-span-7"
    label="Sesiones abiertas"
    value="14"
    delta="+3 esta semana"
  />
  <SecondaryStat className="col-span-6 md:col-span-2" label="Instituciones" value="14" />
  <SecondaryStat className="col-span-6 md:col-span-3" label="Perfiles" value="0" hint="síntesis final" />
</section>
```

---

### M2. `rounded-3xl` pesado en todo, sin hierarchy de radii

**Severidad:** Major
**Ubicación:** stat cards (rounded-2xl), surfaces (rounded-3xl), inner subcards (rounded-2xl), filter chips (rounded-full), buttons (rounded-full)
**Categoría:** Visual

**Problema.** Admin mezcla rounded-2xl + rounded-3xl + rounded-xl + rounded-full sin lógica. El DS Wave 2 cementó tokens semánticos:
- `--radius-sm` (inputs, chips secundarios)
- `--radius-md` (cards pequeñas)
- `--radius-card` (cards principales)
- `--radius-section` (manifest hero section, `rounded-[28px]`)
- `--radius-pill` (CTAs y pills full-rounded)

No se usan. Mantenedor futuro no sabe por qué un stat card es `rounded-2xl` y la export section es `rounded-3xl`.

**Recomendación.** Mapear consistentemente:
- Section containers → `rounded-[var(--radius-section)]` o `rounded-[28px]`
- Stat cards → `rounded-[var(--radius-card)]`
- Pills/chips/CTAs → `rounded-full`
- Inputs / minor surfaces → `rounded-[var(--radius-md)]`

---

### M3. Sesión detalle = 7 cards apiladas verticales idénticas

**Severidad:** Major
**Ubicación:** `app/admin/sesiones/[id]/page.tsx`
**Categoría:** Layout

**Problema (`07-admin-sesion-detalle.png`).** La página de detalle de sesión es 7 cards `rounded-3xl bg-cream` apiladas: Status header / Turnos / Extracciones / Casos / Reviews / Cajas / Perfil / Metadata. Todas con el mismo collapsable trigger en la esquina superior derecha. Es ese exacto "Stack vertical de cards idénticas" de la banlist.

Más: la mayoría están **vacías** ("Sin turnos registrados todavía", "Sin extracciones", "Sin casos solicitados todavía", "Sin reviews emitidos", "Ninguna caja declinada"). El operador tiene que scroll 7 cards vacías antes de llegar a "Metadata bruto".

**Recomendación.**
1. Default-collapsed las secciones vacías, con badge `(0)`.
2. Header sticky con tabs horizontales (Turnos | Extracciones | Casos | Reviews | Cajas | Perfil | Meta).
3. Pintar solo la sección activa.

```tsx
<div className="sticky top-[60px] border-b border-cream-pure/8 bg-ink/95 backdrop-blur">
  <Tabs>
    <Tab badge="0">Turnos</Tab>
    <Tab badge="0" tone="muted">Extracciones</Tab>
    <Tab badge="0/5" tone="primary">Casos</Tab>
    ...
  </Tabs>
</div>
```

---

### M4. Cero atmosphere — fondo plano

**Severidad:** Major
**Ubicación:** todas las páginas admin
**Categoría:** Visual

**Problema.** El landing tiene `.atmosphere-radial-gold` (radial gold 4% from top-right) + `.atmosphere-noise` (SVG noise 1.2% opacity, mix-blend-overlay). Esto le da textura editorial. Admin tiene cero. El fondo taupe es plano matte.

**Recomendación.** Aplicar atmosphere variant `warm` al main del admin (ya existe en Wave 2):
```tsx
<main className="atmosphere-warm mx-auto max-w-7xl px-6 py-8">
```

---

### M5. Cero motion en navegación / row hover / load

**Severidad:** Major
**Ubicación:** tablas, cards, transiciones de ruta
**Categoría:** Interaction

**Problema.** Admin no usa `.animate-fade-up`, no usa `Lenis`, no usa stagger de filas, no usa transitions de chevron hover. Todo aparece y desaparece sin curve. Reglas de Opsyo (CLAUDE.md): "Animaciones intencionales (motion con propósito)" + spring physics.

**Recomendación.** Quick wins sin overengineering:
- Tablas: filas con `.animate-fade-up` y stagger 30ms (DS Wave 1 motion scale).
- Row hover chevron: spring rotate 0 → 6deg `cubic-bezier(0.16, 1, 0.3, 1)`.
- Card mount: opacity 0 → 1 + translateY 8 con stagger 60ms entre cards de un section.

---

### M6. Filter chips: 2 solid pills, no ghost

**Severidad:** Major
**Ubicación:** `app/admin/sesiones/page.tsx:165-185`, `app/admin/magic-links/page.tsx:157-177`
**Categoría:** Visual / Hierarchy

**Problema.** Active = `bg-ink text-cream-pure ring-ink`. Inactive = `bg-cream text-foreground ring-foreground/10`. Ambos son **pills sólidos**, solo difieren en color. No hay diferencia de peso visual entre "seleccionado" y "no seleccionado" — sólo de inversión de color.

El DS landing par button (Primary + Secondary ghost) usa solid pill + border ghost. Eso comunica jerarquía sin gritar.

**Recomendación.**
```tsx
// Active
'bg-gold text-ink ring-0'  // o bg-cream-pure si admin va dark

// Inactive
'bg-transparent text-cream-pure/60 ring-1 ring-cream-pure/15 hover:ring-cream-pure/35 hover:text-cream-pure'
```

---

### M7. Status pills con sparkles icon decorativo

**Severidad:** Major
**Ubicación:** `app/admin/page.tsx:261-271`, `app/admin/sesiones/page.tsx:243-254`
**Categoría:** Visual / Polish

**Problema.** Cada status pill (abierta/pausada/completa/etc.) lleva `<Sparkles className="size-2.5" />` al inicio. El icon no añade información — duplica el "este es un status" que ya comunican el pill shape + uppercase tracked text. Es decoración pura. CLAUDE.md banlist: implícitamente, decoración sin propósito.

**Recomendación.** Reemplazar sparkles por un 6×6 dot de color tonal:
```tsx
<span className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.22em] ring-1 ring-cream-pure/10 bg-ink-raised text-cream-pure/85">
  <span className="size-1.5 rounded-full bg-gold-bright" aria-hidden />
  abierta
</span>
```

---

### M8. Form "Nueva institución" — split layout torpe

**Severidad:** Major
**Ubicación:** `app/admin/instituciones/nueva/nueva-form.tsx` + screenshot 06
**Categoría:** Layout

**Problema (`06-admin-institucion-nueva.png`).** Form a la izquierda (cream card), "Resultado" stub a la derecha (cream card vacía). El sidebar vacío sólo dice "Cuando crees la institución, generaremos un magic link...". Tomá ~40% del horizontal y no aporta nada hasta submit. El form se siente squeezed.

**Recomendación.** Single-column max-w-md centrado o full-bleed con sidebar "Resultado" colapsado/ausente hasta tener output. Si quieres el split, hacerlo asimétrico: form 7/12 + sidebar 4/12 con visual peso mediante border accent.

---

### M9. CSV/JSON buttons — pill negro + pill gris pares

**Severidad:** Major
**Ubicación:** `app/admin/page.tsx:108-130`
**Categoría:** Visual

**Problema.** Cada tipo de export tiene 2 pills lado a lado: CSV (ink solid) + JSON (foreground/8 gris). 4 tipos × 2 pills = 8 pills mostrados al mismo tiempo. Es ruido visual y los gold-deep accents brillan más que las acciones.

**Recomendación.** Single split-button por export, con dropdown de formato:
```
[ INSTITUCIONES  CSV ▼ ]
       └ CSV
       └ JSON
```
O: 4 download buttons, formato como toggle compartido a nivel de section.

---

### M10. Hover row table casi invisible

**Severidad:** Major
**Ubicación:** todas las tablas admin (`hover:bg-foreground/[0.02]`)
**Categoría:** Interaction

**Problema.** El hover state de fila usa `bg-foreground/[0.02]` — 2% sobre el cream subyacente. En `04-admin-instituciones.png` y `05-admin-magic-links.png` se ve cómo algunas filas tienen un tinte ligeramente más oscuro pero no es perceptible que sea estado hover (más parece zebra striping accidental).

**Recomendación.**
```tsx
// Antes
'transition hover:bg-foreground/[0.02]'

// Después (dark admin)
'transition-colors duration-150 hover:bg-cream-pure/[0.04] hover:[box-shadow:inset_2px_0_0_var(--gold)]'
```
El inset 2px gold-bar a la izquierda da feedback claro sin agresividad.

---

## Minor Issues

### Mi1. Header NavLink hover no-spring

**Ubicación:** `app/admin/layout.tsx:75-89`. Hover usa `transition hover:bg-cream-pure/10` — simple color swap. El landing `HeaderCTA` usa multi-layer springs (stiffness 320 + 520 + 380). El admin no necesita ese nivel, pero sí algo más que `transition` plano.

### Mi2. Mobile: tabla con scroll horizontal

**Ubicación:** screenshot 09. La tabla de "Sesiones recientes" no responde a viewport <768px — desborda. No hay `overflow-auto`. El operador móvil pierde "Último turno" y "Ver →".

**Fix.** `<div className="overflow-x-auto">` + `min-w-[640px]` en la tabla, o stack a card-list en mobile.

### Mi3. Mobile: 4 stat cards → 2x2 grid sin priority

**Ubicación:** screenshot 09. `grid-cols-2 md:grid-cols-4` colapsa a 2x2 pero las 4 quedan equal-height. Si M1 se resuelve con hero-stat asimétrico, esto se autoresuelve.

### Mi4. `divide-foreground/5` muy faint entre rows

**Ubicación:** todas las tablas. Las hairlines entre rows son `foreground/5` (5% del ink color). Sobre cream pasa casi invisible. Sobre ink raised quedaría invisible también. Sugerencia: `divide-cream-pure/8` en dark, `divide-ink/8` en light.

### Mi5. Login card "dialog from 2018"

**Ubicación:** `01-admin-login.png`. Card cream rounded-3xl con shadow-xl sobre fondo taupe. Si admin va dark (recomendado), el login debería ser **full-bleed ink** con form centrado, hairline gold-seam de top, y atmosphere noise. Espejo del feel del landing.

### Mi6. Eyebrow color = muted-foreground gray genérico

**Ubicación:** todos los eyebrows. Usar `text-gold-deep` (#9C824A) en eyebrows de cards principales, `text-cream-pure/45` en eyebrows de columnas/tabla heads.

### Mi7. Botón "Volver al catálogo" — link plano

**Ubicación:** `app/admin/instituciones/[id]/page.tsx`, screenshot 08. El back link es texto+arrow `text-xs`, sin ghost-button. El DS tiene patrón ghost button con border. Levantarlo.

### Mi8. "Cerrar sesión" button — bg-cream-pure/10

**Ubicación:** layout header. Funciona, pero es la única acción destructiva visible y queda al mismo peso que NavLinks. Considerar bottom-right en command palette en lugar de top-right permanente.

---

## Positive Observations

Para no perder lo que está bien:

- Header ink con `<V>` glyph dorado es **excelente**. Probablemente la única pieza del admin que respira brand.
- Command palette trigger (Cmd-K) `bg-cream-pure/10` con backdrop blur — buen pattern, alineado con landing dark glass-effect.
- StatusPills con `bg-gold-bright/30 text-gold-deep` para abierta — paleta gold-bright bien aplicada (sólo falta quitar el sparkles).
- Filter chips lógica de toggle (acumulan o limpian) es UX correcta — sólo necesita el restyle de M6.
- Migración legacy forest/lime → ink/gold (ADR-010) **se completó** sin breakage. Tokens correctos, sólo falta arquitectura.
- Mono uppercase tabular-nums en stat values — feel "fintech operations" correcto, sólo le falta scale.
- Tablas con `overflow-hidden rounded-3xl bg-cream shadow-sm ring-1` — wrapper bien estructurado, sólo cambiar tokens.

---

## Direction (recomendación de rediseño)

### Decisión #1 — Surface: dark vs light

**Recomendado: dark (ink).** Razones:

- **Operations console feel.** Linear, Sentry, Resend, Vercel — todos los benchmarks que Opsyo cita para ops/admin son dark editorial. Cream-pure le calza a entrevista (lectura larga, 12 min). Admin es escaneo rápido de tablas + acción.
- **Diferenciación visual con entrevista.** Entrevista (cream) y admin (ink) viven en el mismo dominio pero son audiencias y modos distintos. Inversión cromática los separa sin perder brand.
- **Re-uso máximo de patrones landing.** `.gold-hairline`, `.gold-seam`, `.atmosphere-warm`, primary CTA cream-pill sobre ink, ghost-border cream-pure/20 — todo se aplica directo.
- **Stat values + tabular-nums + dark** = look "trading dashboard" que ya pediste con `font-mono` (Satoshi mono-feel).

### Decisión #2 — Layout: top-nav vs sidebar

**Recomendado: top-nav refinado (no sidebar).**

- Admin tiene 5 rutas top-level (Resumen, Sesiones, Magic links, Instituciones, Nueva). Sidebar es overkill para 5.
- Top-bar deja toda la vertical para tablas (que son lo importante).
- Refinamiento: ribbon `OPERATIVO · 2026-05-11` minúsculo bajo el title, con timestamp live.

### Decisión #3 — Inspiración concreta a citar

Refs a tener al codear (CLAUDE.md regla #3):
- **Linear** — sidebar table hover behavior + cmd-k pattern + density.
- **Resend** — dark + gold accents + monospace data + hairlines.
- **Vercel** — section spacing + ink tones (#0A0A0A vs #111).
- **Sentry** — issue list density + status pill dots (NO icons).

### Decisión #4 — Type scale concreta

```
H1 page title    → .text-display clamp(28, 3.6vw, 46)px, weight 500, text-cream-pure
Eyebrow          → .text-eyebrow text-gold-deep (cuando es brand stamp)
                 → .text-eyebrow text-cream-pure/45 (cuando es column head)
Stat hero value  → font-display 56-72px tabular-nums weight 500
Stat sec value   → font-mono text-2xl tabular-nums (sigue Satoshi mono-feel)
Body             → text-[14px] text-cream-pure/80
Meta footer      → .text-eyebrow text-cream-pure/35
```

### Decisión #5 — Atmosphere

- Main background: `bg-ink atmosphere-warm` (radial gold + noise).
- Header: ink solid + gold-seam-bottom (1px inset gold).
- Stat hero card: ink-raised + gold-seam (subtle gold top hairline).
- Tablas: ink-raised surface + cream-pure/8 dividers.

---

## Next Steps (priorización)

1. **Aprobar dark vs light** (Decisión #1) — la decisión bloquea todo lo demás.
2. **Crear `components/admin/` primitivos** (Section, StatCard, Table, FilterChip, StatusPill, PageHeader) que consuman el DS — igual que se hizo en `components/landing/` y `components/entrevista/`.
3. **Refactor por pantalla** orden de impacto:
   1. Layout root (background + atmosphere) → C1 + M4
   2. Page header pattern (eyebrow + display + sub) → C4 + C5
   3. Status pills + filter chips → M6 + M7
   4. Stat cards hierarchy → M1
   5. Sesión detalle tabs → M3
   6. Mobile responsive → Mi2 + Mi3
4. **ADR-012** documentando la decisión "admin surface" para cerrar el DS de verdad app-wide.

---

_Generated by UI Design Review · 2026-05-11_
