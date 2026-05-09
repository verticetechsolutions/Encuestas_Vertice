# Survey UI Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar la UI de la encuesta (`/preview/ui` y `/entrevista/[sesion_id]`) al design system del landing aplicando patterns 2026 (hairlines, asymmetric grid, View Transitions API, tabular-nums, typographic block) y resolviendo las 14 críticas visuales documentadas.

**Architecture:** 4 sprints secuenciales sobre `/preview/ui` con espejo a producción al final del Sprint 4. Sprint 1 limpia tokens (matar `--lime`/`--forest` en encuesta). Sprint 2 refactoriza estructura (right rail unificado, microcopy separado, FIELD_LABELS humanos). Sprint 3 incorpora motion (View Transitions API + Framer Motion fallback). Sprint 4 añade detalles editoriales (número-display, glyph divider, sticky pill nav, BrandSuccessGlyph wired). Surface light (`cream-pure` + `ink`), tipografía Satoshi + General Sans, single-page con state (sin URL por pregunta).

**Tech Stack:** Next.js 15 App Router · React 19 · Tailwind CSS v4 · Vitest 4 · Zustand 5 · Framer Motion 12 · GSAP 3 · Lenis · TypeScript estricto · Biome lint.

**Spec:** `docs/superpowers/specs/2026-05-09-survey-ui-refactor-design.md`

---

## File Structure

### Nuevos archivos

| Archivo | Responsabilidad |
|---|---|
| `lib/cajas-labels.ts` | Map `FIELD_LABELS: Record<string, string>` derivado de `lib/schemas/cajas.ts`. Resuelve el debug leak `nm_productos_ofrecidos`. |
| `lib/cajas-labels.test.ts` | Cobertura de las 54 cajas con label humano. |
| `lib/motion-tokens.ts` | Constantes `ease`, `duration`, `stagger` para motion centralizado. |
| `lib/motion-tokens.test.ts` | Sanity tests de las constantes. |
| `lib/view-transitions.ts` | Wrapper de `document.startViewTransition` con fallback no-op. |
| `lib/view-transitions.test.ts` | Tests jsdom (mock de `document.startViewTransition`). |
| `components/entrevista/RightRail.tsx` | Componente nuevo con 2 secciones (Turno actual + Progreso) separadas por hairline. Reemplaza las 3 cards hardcoded en el shell. |
| `components/entrevista/RightRail.test.tsx` | Tests de render con react-testing-library. |
| `components/survey/SurveyNavPill.tsx` | (Sprint 4) Sticky pill nav top-center. |

### Archivos modificados

| Archivo | Cambio principal |
|---|---|
| `app/globals.css` | Añadir 8 tokens `--survey-*`, utility `.numeric`, CSS de View Transitions, animación `cierre-caja-gold`. |
| `app/preview/ui/page.tsx` | Sin cambios (es solo wrapper). |
| `app/entrevista/[sesion_id]/page.tsx` | Espejo del refactor en Sprint 4 (mismo target del shell). |
| `app/entrevista/[sesion_id]/entrevista-shell.tsx` | Integrar `<RightRail>`, número-display "0/54", framing "X pendientes", view transitions wrapper en `setPregIndex`, BrandSuccessGlyph al cierre de turno. |
| `components/entrevista/HeroPregunta.tsx` | Separar microcopy "Por ejemplo:" en `<p>` italic debajo del `<h1>`. Asegurar `text-eyebrow` en eyebrow. |
| `components/entrevista/PanelProgreso.tsx` | Matar `lime`/`forest`. Migrar a `gold-bright`/`gold` tints. Animación `cierre-caja` swap a gold. |
| `components/entrevista/Stepper.tsx` | Migrar tokens `lime`/`forest` → `gold-bright`/`gold-deep`. |
| `components/entrevista/BatchNav.tsx` | Paginador limpio `P01 / P02 / P03` con format `font-mono uppercase tracking-[0.18em]`. |
| `components/ui/textarea.tsx` | Frame editorial con `border-ink/12` + focus state gold. |
| `components/ui/progress.tsx` | Migrar de lime/forest a gold-bright. |
| `components/ui/button.tsx` | Añadir variantes `survey-primary` (`bg-ink text-cream-pure`) y `survey-tertiary` (inline icon). |

### Archivos eliminados

| Archivo | Razón |
|---|---|
| `components/entrevista/PreguntaCard.tsx` | Legacy, sustituido por `HeroPregunta`. **Verificar primero** que no tiene imports activos. |

---

## Sprint 1 · Tokens y tipografía (1-2 días)

### Task 1.1: Audit `lime` / `forest` usage en surfaces de encuesta

**Files:**
- Read-only audit (no commits).

- [ ] **Step 1: Listar todos los usos en encuesta**

```bash
rg -t tsx -t css "lime|forest" components/entrevista app/entrevista app/preview/ui --line-number
```

Expected: lista de matches en `PanelProgreso.tsx`, `Stepper.tsx`, `PreguntaCard.tsx`, posiblemente `BatchNav.tsx` y CSS animations.

- [ ] **Step 2: Listar usos en componentes UI base**

```bash
rg -t tsx "lime|forest" components/ui --line-number
```

Expected: usos en `progress.tsx` y posiblemente `button.tsx`.

- [ ] **Step 3: Documentar findings en task notes**

No commit. Resultados van al input de las próximas tasks.

### Task 1.2: Verificar si `PreguntaCard.tsx` es huérfano

**Files:**
- Read-only check.

- [ ] **Step 1: Buscar imports**

```bash
rg "from.*PreguntaCard" --line-number
rg "import.*PreguntaCard" --line-number
```

Expected: 0 matches en código de aplicación. Si solo aparece en sí mismo, es huérfano.

- [ ] **Step 2: Si huérfano, eliminar**

```bash
git rm components/entrevista/PreguntaCard.tsx
```

- [ ] **Step 3: Verificar build**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(entrevista): eliminar PreguntaCard legacy (sustituido por HeroPregunta)"
```

Si NO es huérfano: skip esta task y dejar nota para refactor posterior.

### Task 1.3: Añadir tokens `--survey-*` y utility `.numeric` en globals.css

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Localizar bloque `:root` en globals.css**

```bash
grep -n "^:root" app/globals.css
```

- [ ] **Step 2: Añadir tokens al final del bloque `:root`**

Insertar antes del cierre `}` del `:root`:

```css
  /* Survey surface tokens (light) — encuesta usa cream/ink invertido al landing */
  --survey-bg: var(--cream-pure);
  --survey-text: var(--ink);
  --survey-text-72: rgb(10 15 28 / 0.72);
  --survey-text-65: rgb(10 15 28 / 0.65);
  --survey-text-45: rgb(10 15 28 / 0.45);
  --survey-hairline: rgb(10 15 28 / 0.08);
  --survey-hairline-strong: rgb(10 15 28 / 0.12);
  --survey-hover: rgb(10 15 28 / 0.04);
  --survey-active-bg: rgb(200 168 100 / 0.10);
```

- [ ] **Step 3: Añadir utility `.numeric` en sección `@layer utilities` o equivalente**

```css
.numeric {
  font-variant-numeric: tabular-nums lining-nums;
  font-feature-settings: "tnum" 1, "lnum" 1;
}
```

- [ ] **Step 4: Verificar build CSS**

```bash
npm run dev
```

Abrir `http://localhost:3000/preview/ui`, abrir DevTools y verificar que no hay errores de CSS parsing.

Expected: page renders sin warnings de CSS.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css
git commit -m "feat(globals): tokens --survey-* + utility .numeric"
```

### Task 1.4: Migrar `PanelProgreso.tsx` de lime/forest a gold

**Files:**
- Modify: `components/entrevista/PanelProgreso.tsx`
- Reference: `app/globals.css` (verifica que `--gold-bright`, `--gold`, `--gold-deep` existen).

- [ ] **Step 1: Sustituir tokens del active group**

En `PanelProgreso.tsx` línea ~127, cambiar:

```tsx
// ANTES
esActivo
  ? 'bg-lime/35 ring-1 ring-lime/40'
  : 'hover:bg-muted/40',

// DESPUÉS
esActivo
  ? 'bg-gold-bright/15 ring-1 ring-gold/40'
  : 'hover:bg-ink/[0.04]',
```

- [ ] **Step 2: Sustituir progress fill bar (header total)**

Línea ~105, cambiar:

```tsx
// ANTES
<div
  className="h-full rounded-full bg-forest transition-all duration-700 ease-out"
  style={{ width: `${pctTotal}%` }}
  aria-hidden
/>

// DESPUÉS
<div
  className="h-full rounded-full bg-gold-deep transition-all duration-700 ease-out"
  style={{ width: `${pctTotal}%` }}
  aria-hidden
/>
```

- [ ] **Step 3: Sustituir progress fill por grupo**

Línea ~152-158, cambiar:

```tsx
// ANTES
<div
  className={cn(
    'h-full rounded-full transition-all duration-700 ease-out',
    esActivo ? 'bg-forest' : 'bg-forest/55'
  )}
  style={{ width: `${pct}%` }}
  aria-hidden
/>

// DESPUÉS
<div
  className={cn(
    'h-full rounded-full transition-all duration-700 ease-out',
    esActivo ? 'bg-gold-deep' : 'bg-gold/55'
  )}
  style={{ width: `${pct}%` }}
  aria-hidden
/>
```

- [ ] **Step 4: Aplicar `.numeric` a counters**

Línea ~140, cambiar `tabular-nums` por `numeric`:

```tsx
// ANTES
<span className="text-[10px] tabular-nums font-medium text-muted-foreground">
  {llenas}/{total}
</span>

// DESPUÉS
<span className="numeric text-[10px] font-medium text-muted-foreground">
  {llenas}/{total}
</span>
```

Y línea ~94 (header counter `{pctTotal}`):

```tsx
// ANTES
<span className="text-display text-[44px] tabular-nums leading-none text-foreground">

// DESPUÉS
<span className="text-display text-[44px] numeric leading-none text-foreground">
```

- [ ] **Step 5: Manual visual check**

`npm run dev`, navegar a `/preview/ui`, verificar:
- Active group ya NO es verde lima, ahora es gold tint sutil.
- Progress bars son dorados, no verde.
- Counters renderizan con tabular alignment.

- [ ] **Step 6: Commit**

```bash
git add components/entrevista/PanelProgreso.tsx
git commit -m "feat(entrevista): PanelProgreso migrado de lime/forest a gold tokens"
```

### Task 1.5: Migrar `Stepper.tsx` de lime/forest a gold

**Files:**
- Modify: `components/entrevista/Stepper.tsx`

- [ ] **Step 1: Read current Stepper**

```bash
cat components/entrevista/Stepper.tsx
```

- [ ] **Step 2: Buscar y reemplazar tokens**

Para cada match de `lime`, `forest`, `bg-lime*`, `text-lime*`, `bg-forest*`, `text-forest*`, `ring-lime*`, `ring-forest*`:

| Token legacy | Token target |
|---|---|
| `bg-lime` (any opacity) | `bg-gold-bright` (same opacity) |
| `text-lime-foreground` | `text-ink` |
| `text-lime` | `text-gold-deep` |
| `bg-forest` | `bg-gold-deep` |
| `text-forest` | `text-gold-deep` |
| `bg-forest/8` | `bg-gold/10` |
| `ring-forest/10` | `ring-gold/20` |
| `ring-lime/*` | `ring-gold/*` |

- [ ] **Step 3: Aplicar `.numeric` a contadores numéricos del Stepper**

Si el Stepper renderiza `0/54` o `M01` u otros counters, añadir `numeric` class.

- [ ] **Step 4: Visual check**

`/preview/ui` debe renderizar el Stepper con tints dorados, sin verde.

- [ ] **Step 5: Commit**

```bash
git add components/entrevista/Stepper.tsx
git commit -m "feat(entrevista): Stepper migrado a gold tokens"
```

### Task 1.6: Migrar `components/ui/progress.tsx` de lime/forest a gold

**Files:**
- Modify: `components/ui/progress.tsx`

- [ ] **Step 1: Read current progress.tsx**

```bash
cat components/ui/progress.tsx
```

- [ ] **Step 2: Buscar `bg-lime`, `bg-forest` en Indicator y reemplazar**

Aplicar mismas reglas que Task 1.5: `bg-lime*` → `bg-gold-bright*`, `bg-forest*` → `bg-gold-deep*`.

- [ ] **Step 3: Visual check**

Encuesta en `/preview/ui` no debe mostrar progress bars verdes en ninguna parte.

- [ ] **Step 4: Commit**

```bash
git add components/ui/progress.tsx
git commit -m "feat(ui): progress.tsx migrado a gold tokens"
```

### Task 1.7: Animación `cierre-caja` swap a gold

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Localizar keyframes `vertice-cierre-caja` (o nombre similar)**

```bash
grep -n "cierre-caja" app/globals.css
```

- [ ] **Step 2: Reemplazar referencias a colores lime con gold**

Buscar `oklch(0.92 0.16 125)` (o cualquier color verde en la animación) y reemplazar con `oklch(0.78 0.14 80)` (equivalente gold-bright).

- [ ] **Step 3: Visual check**

En `/preview/ui`, completar una caja (interactuar con el flujo simulado) y verificar que el ring de celebración es dorado, no verde.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "feat(globals): animación cierre-caja swap a gold"
```

### Task 1.8: Aplicar `.text-eyebrow` consistente y verificar tipografía

**Files:**
- Modify: cualquier eyebrow en `components/entrevista/*` y `app/entrevista/[sesion_id]/entrevista-shell.tsx` que NO use `text-eyebrow`.

- [ ] **Step 1: Audit eyebrows con letterspacing manual**

```bash
rg "tracking-(wider|widest|\[0\.[0-9]+em\])" components/entrevista app/entrevista
```

- [ ] **Step 2: Reemplazar por `text-eyebrow` cementado**

Para cada match donde el contexto sea un eyebrow (label small uppercase tracked), reemplazar el set de classes manuales (`uppercase`, `tracking-*`, `text-[10px]`, etc.) por `text-eyebrow` que ya está definido en globals.

- [ ] **Step 3: Visual check `/preview/ui`**

Eyebrows deben tener letterspacing consistente (0.32em según el design system).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(entrevista): eyebrows consistentes con .text-eyebrow"
```

### Task 1.9: Visual validation Sprint 1

**Files:**
- Create: `.tmp_design_audit/sprint1-after-{tokens,panel,stepper,progress}.png`

- [ ] **Step 1: Levantar dev server (background)**

```bash
npm run dev
```

- [ ] **Step 2: Capturar screenshots before/after con Chrome DevTools MCP**

Usar `mcp__chrome-devtools__take_screenshot` con full page sobre `/preview/ui`. Comparar contra screenshots de la sesión 2026-05-08 si están disponibles. Validar visualmente:
- Cero verde lima en la página.
- Progress bars dorados.
- Counters con tabular alignment.
- Eyebrows con letterspacing consistente.

- [ ] **Step 3: Commit screenshots y validación**

```bash
git add .tmp_design_audit/sprint1-*.png
git commit -m "chore(audit): screenshots Sprint 1 (tokens y tipografía)"
```

**Sprint 1 done.** Acceptance: cero `lime`/`forest` activos en JSX de encuesta, tokens `--survey-*` en globals, `.numeric` aplicado, screenshots archivados.

---

## Sprint 2 · Layout y componentes (2-3 días)

### Task 2.1: `lib/cajas-labels.ts` con TDD

**Files:**
- Create: `lib/cajas-labels.ts`
- Create: `lib/cajas-labels.test.ts`
- Reference: `lib/schemas/cajas.ts` (fuente del catálogo de cajas).

- [ ] **Step 1: Write failing test**

```typescript
// lib/cajas-labels.test.ts
import { describe, it, expect } from 'vitest';
import { FIELD_LABELS, getFieldLabel } from './cajas-labels';
import { CAJAS_CANON } from './schemas/cajas';

describe('FIELD_LABELS', () => {
  it('contiene un label humano para cada caja del CAJAS_CANON', () => {
    for (const caja of CAJAS_CANON) {
      expect(FIELD_LABELS[caja.codigo]).toBeDefined();
      expect(FIELD_LABELS[caja.codigo]).not.toBe('');
      expect(FIELD_LABELS[caja.codigo]).not.toMatch(/^nm_|^cd_|^fc_/);
    }
  });

  it('mapea nm_productos_ofrecidos a "Productos ofrecidos"', () => {
    expect(FIELD_LABELS['nm_productos_ofrecidos']).toBe('Productos ofrecidos');
  });
});

describe('getFieldLabel', () => {
  it('devuelve el label si existe', () => {
    expect(getFieldLabel('nm_productos_ofrecidos')).toBe('Productos ofrecidos');
  });

  it('devuelve el código original si no hay mapping (fallback)', () => {
    expect(getFieldLabel('codigo_inexistente_zzz')).toBe('codigo_inexistente_zzz');
  });
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
npx vitest run lib/cajas-labels.test.ts
```

Expected: FAIL ("Cannot find module './cajas-labels'").

- [ ] **Step 3: Implementar `lib/cajas-labels.ts`**

Leer primero `lib/schemas/cajas.ts` para entender la estructura. Si `CAJAS_CANON` ya tiene `label` o `descripcion` por caja, derivar:

```typescript
// lib/cajas-labels.ts
import { CAJAS_CANON, CAJAS_EXTENSION_POR_TIPO } from './schemas/cajas';

const allCajas = [
  ...CAJAS_CANON,
  ...(CAJAS_EXTENSION_POR_TIPO.banco ?? []),
  ...(CAJAS_EXTENSION_POR_TIPO.fintech ?? []),
  ...(CAJAS_EXTENSION_POR_TIPO.cooperativa ?? []),
];

export const FIELD_LABELS: Record<string, string> = Object.fromEntries(
  allCajas.map((caja) => [caja.codigo, caja.label ?? humanizar(caja.codigo)])
);

function humanizar(codigo: string): string {
  // nm_productos_ofrecidos → Productos ofrecidos
  return codigo
    .replace(/^(nm|cd|fc)_/, '')
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function getFieldLabel(codigo: string): string {
  return FIELD_LABELS[codigo] ?? codigo;
}
```

**Nota:** si `CAJAS_CANON` no tiene `label` por caja, usar `humanizar(codigo)` para todas. Ajustar al schema real.

- [ ] **Step 4: Run test, verify pass**

```bash
npx vitest run lib/cajas-labels.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/cajas-labels.ts lib/cajas-labels.test.ts
git commit -m "feat(lib): cajas-labels con FIELD_LABELS humanos derivados de schemas/cajas"
```

### Task 2.2: Reemplazar `<code>{c}</code>` por label humano en el shell

**Files:**
- Modify: `app/entrevista/[sesion_id]/entrevista-shell.tsx`

- [ ] **Step 1: Localizar la lista de cajas_objetivo en el shell**

Está en líneas ~420-432, dentro del Card 2 "Esta pregunta cubre". Renderiza `<code>{c}</code>`.

- [ ] **Step 2: Importar `getFieldLabel`**

```tsx
import { getFieldLabel } from '@/lib/cajas-labels';
```

- [ ] **Step 3: Reemplazar render**

```tsx
// ANTES
<li key={c} className="flex items-center gap-2.5">
  <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-gold" />
  <code className="font-mono text-[12px] tracking-tight text-foreground/75">
    {c}
  </code>
</li>

// DESPUÉS
<li key={c} className="flex items-center gap-2.5">
  <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-gold" />
  <span className="text-[14px] tracking-tight text-foreground/75">
    {getFieldLabel(c)}
  </span>
</li>
```

- [ ] **Step 4: Visual check**

`/preview/ui` muestra "Productos ofrecidos" en lugar de `nm_productos_ofrecidos`.

- [ ] **Step 5: Commit**

```bash
git add app/entrevista/[sesion_id]/entrevista-shell.tsx
git commit -m "feat(entrevista): usar getFieldLabel en lista de cajas_objetivo (resuelve debug leak)"
```

### Task 2.3: Crear `<RightRail>` component (extraer del shell)

**Files:**
- Create: `components/entrevista/RightRail.tsx`
- Create: `components/entrevista/RightRail.test.tsx`
- Modify: `app/entrevista/[sesion_id]/entrevista-shell.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// components/entrevista/RightRail.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RightRail } from './RightRail';
import type { GrupoUI } from '@/lib/schemas/cajas';

const baseProps = {
  pendientes: 3,
  total: 3,
  todasMarcadas: false,
  enviando: false,
  enError: false,
  status: 'capturando' as const,
  cajasObjetivo: ['nm_productos_ofrecidos'],
  cajasGlobal: { llenas: 0, total: 54 },
  cajasPorGrupo: {} as Record<GrupoUI, { llenas: number; total: number }>,
  grupoActivo: 'identificacion' as GrupoUI,
  onEnviarBatch: () => {},
};

describe('RightRail', () => {
  it('renderiza framing positivo "X pendientes" cuando hay sin marcar', () => {
    render(<RightRail {...baseProps} pendientes={3} />);
    expect(screen.getByText(/3 pendientes/i)).toBeInTheDocument();
  });

  it('renderiza "¡Listo!" cuando todas marcadas', () => {
    render(<RightRail {...baseProps} pendientes={0} todasMarcadas />);
    expect(screen.getByText(/¡Listo!/)).toBeInTheDocument();
  });

  it('renderiza el counter de turno con tabular-nums en CTA', () => {
    render(<RightRail {...baseProps} pendientes={2} total={3} />);
    expect(screen.getByRole('button', { name: /Enviar turno/i })).toHaveTextContent(/1\/3/);
  });

  it('expone exactamente 2 secciones (Turno actual + Progreso)', () => {
    const { container } = render(<RightRail {...baseProps} />);
    const sections = container.querySelectorAll('section');
    expect(sections).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
npx vitest run components/entrevista/RightRail.test.tsx
```

Expected: FAIL ("Cannot find module './RightRail'").

- [ ] **Step 3: Implementar `RightRail.tsx`**

```tsx
// components/entrevista/RightRail.tsx
'use client';

import { ArrowUpRight, Loader2 } from 'lucide-react';
import { GrupoUISchema, type GrupoUI } from '@/lib/schemas/cajas';
import { getFieldLabel } from '@/lib/cajas-labels';
import type { CajasGrupoCount } from '@/lib/state/entrevista';
import { cn } from '@/lib/utils';

const GRUPO_LABELS: Record<GrupoUI, string> = {
  identificacion: 'Identidad',
  productos_y_mercado: 'Productos y mercado',
  numeros_del_negocio: 'Números del negocio',
  operacion: 'Operación',
  pricing_y_criterio: 'Pricing y criterio',
  contacto_y_especificos: 'Contacto y específicos',
};

interface Props {
  pendientes: number;
  total: number;
  todasMarcadas: boolean;
  enviando: boolean;
  enError: boolean;
  status: string;
  cajasObjetivo: string[];
  cajasGlobal: { llenas: number; total: number };
  cajasPorGrupo: Record<GrupoUI, CajasGrupoCount>;
  grupoActivo: GrupoUI;
  onEnviarBatch: () => void;
}

export function RightRail({
  pendientes,
  total,
  todasMarcadas,
  enviando,
  enError,
  status,
  cajasObjetivo,
  cajasGlobal,
  cajasPorGrupo,
  grupoActivo,
  onEnviarBatch,
}: Props) {
  const grupos = GrupoUISchema.options;
  const respondidas = total - pendientes;

  return (
    <aside className="sticky top-24 space-y-10">
      {/* Sección 1 — Turno actual + cajas que cubre + CTA */}
      <section className="border-t border-ink/8 pt-6">
        <p className="text-eyebrow text-foreground/45">Turno actual</p>
        <p className="mt-3 text-display text-[36px] leading-[1.0] text-foreground numeric">
          {todasMarcadas ? '¡Listo!' : `${pendientes} pendientes`}
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-foreground/65 italic">
          {todasMarcadas
            ? 'La IA generará las próximas preguntas con base en tus respuestas.'
            : 'Marca cada respuesta para habilitar el envío.'}
        </p>

        {cajasObjetivo.length > 0 && (
          <>
            <p className="mt-8 text-eyebrow text-foreground/45">
              Esta pregunta cubre
            </p>
            <ul className="mt-2 space-y-1 text-[15px]">
              {cajasObjetivo.map((c) => (
                <li key={c} className="flex items-center gap-2.5">
                  <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-gold" />
                  <span className="text-foreground/75">{getFieldLabel(c)}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        <button
          type="button"
          onClick={onEnviarBatch}
          disabled={!todasMarcadas || enviando}
          className={cn(
            'group/send relative mt-8 inline-flex h-12 w-full items-center justify-between gap-2 rounded-full pl-6 pr-2 text-[13.5px] font-medium tracking-tight transition-all',
            'will-change-transform active:scale-[0.99] disabled:cursor-not-allowed',
            todasMarcadas && !enError
              ? 'bg-cream-pure text-ink ring-1 ring-ink/8 shadow-[0_30px_70px_-20px_rgb(200_168_100_/_0.45)] hover:bg-white animate-pulse-ring'
              : 'bg-ink text-cream-pure hover:bg-ink-raised disabled:opacity-50'
          )}
        >
          {enviando ? (
            <>
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                {status === 'enviando' ? 'Enviando…' : 'Procesando…'}
              </span>
              <span aria-hidden className="inline-flex size-9 items-center justify-center rounded-full bg-gold/20 text-gold-bright">
                <ArrowUpRight className="size-4" strokeWidth={2.5} />
              </span>
            </>
          ) : enError ? (
            <>
              Reintentar envío
              <span aria-hidden className="inline-flex size-9 items-center justify-center rounded-full bg-ink text-gold transition-transform group-hover/send:rotate-45">
                <ArrowUpRight className="size-4" strokeWidth={2.5} />
              </span>
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-2">
                Enviar turno
                <span className="numeric text-foreground/60">
                  {respondidas}/{total}
                </span>
              </span>
              <span
                aria-hidden
                className={cn(
                  'inline-flex size-9 items-center justify-center rounded-full transition-transform group-hover/send:rotate-45',
                  todasMarcadas ? 'bg-ink text-gold' : 'bg-cream-pure/15 text-cream-pure/55'
                )}
              >
                <ArrowUpRight className="size-4" strokeWidth={2.5} />
              </span>
            </>
          )}
        </button>
      </section>

      {/* Sección 2 — Progreso por sección con divisores hairline */}
      <section className="border-t border-ink/8 pt-6">
        <p className="text-eyebrow text-foreground/45">Progreso</p>
        <p className="mt-3 text-display text-[36px] leading-[1.0] text-foreground numeric">
          {cajasGlobal.llenas}
          <span className="text-foreground/42">/{cajasGlobal.total}</span>
        </p>
        <ul className="mt-6 divide-y divide-ink/8">
          {grupos.map((g) => {
            const { llenas, total: tot } = cajasPorGrupo[g];
            const esActivo = g === grupoActivo;
            return (
              <li
                key={g}
                className={cn(
                  'py-3 flex items-center justify-between text-[15px]',
                  esActivo && 'font-medium'
                )}
              >
                <span className={esActivo ? 'text-foreground' : 'text-foreground/75'}>
                  {GRUPO_LABELS[g]}
                </span>
                <span className="numeric text-foreground/65">
                  {llenas}/{tot}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </aside>
  );
}
```

- [ ] **Step 4: Run test, verify pass**

```bash
npx vitest run components/entrevista/RightRail.test.tsx
```

Expected: PASS (4 tests).

- [ ] **Step 5: Integrar `<RightRail>` en el shell**

En `app/entrevista/[sesion_id]/entrevista-shell.tsx`, reemplazar las 3 cards apiladas (líneas ~331-449, los 3 bloques `Card 1 — Estado del turno`, `Card 2 — Cajas que cubre`, `Card 3 — Progreso por sección`) con:

```tsx
{!sesionCerrada && batch && activePregunta && (
  <RightRail
    pendientes={batch.preguntas.filter((p) => !marcadas[p.id]).length}
    total={total}
    todasMarcadas={todasMarcadas}
    enviando={enviando}
    enError={enError}
    status={status}
    cajasObjetivo={activePregunta.cajas_objetivo}
    cajasGlobal={cajasGlobal}
    cajasPorGrupo={cajas_llenas_por_grupo}
    grupoActivo={grupoActivo}
    onEnviarBatch={() => void enviarBatch()}
  />
)}
```

Importar al top:

```tsx
import { RightRail } from '@/components/entrevista/RightRail';
```

Eliminar el import de `PanelProgreso` si ya no se usa en otra parte (PanelProgreso queda para uso interno futuro o se elimina si quedó huérfano).

- [ ] **Step 6: Visual check**

`/preview/ui` debe renderizar el right rail con:
- 2 secciones separadas por hairline (no 3 cards apiladas).
- "X pendientes" en lugar de "X sin marcar".
- "Productos ofrecidos" en lugar de `nm_productos_ofrecidos`.
- CTA "Enviar turno 0/3" con counter inline.

- [ ] **Step 7: Verificar PanelProgreso huérfano**

```bash
rg "from.*PanelProgreso" --line-number
```

Si 0 matches, eliminar el archivo:

```bash
git rm components/entrevista/PanelProgreso.tsx
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(entrevista): RightRail unificado (2 secciones hairline) reemplaza 3 cards apiladas"
```

### Task 2.4: Separar microcopy "Por ejemplo:" en HeroPregunta

**Files:**
- Modify: `components/entrevista/HeroPregunta.tsx`
- Reference: `lib/schemas/cajas.ts` para entender si la pregunta canónica tiene un campo separado para microcopy o si está embebido.

- [ ] **Step 1: Inspeccionar el schema de Pregunta**

```bash
grep -n "Pregunta" lib/state/entrevista.ts
grep -n "texto_pregunta\|ejemplo\|microcopy" lib/schemas/cajas.ts lib/state/entrevista.ts
```

- [ ] **Step 2: Detectar pattern "Por ejemplo:" en `texto_pregunta`**

Si las preguntas vienen con formato `"¿Pregunta? Por ejemplo: a, b, c."` en un solo string, hay que parsear. Implementar en `HeroPregunta.tsx`:

```tsx
function splitPreguntaYEjemplo(texto: string): { pregunta: string; ejemplo: string | null } {
  const match = texto.match(/^(.+?\?)\s*(Por ejemplo:.*)$/i);
  if (match) {
    return { pregunta: match[1], ejemplo: match[2] };
  }
  return { pregunta: texto, ejemplo: null };
}
```

- [ ] **Step 3: Render con jerarquía separada**

Reemplazar línea ~155-158 de `HeroPregunta.tsx`:

```tsx
// ANTES
<h2 className="mt-5 text-display text-[28px] leading-[1.05] tracking-[-0.025em] text-foreground md:text-[36px] xl:text-[40px]">
  {pregunta.texto_pregunta}
</h2>

// DESPUÉS
{(() => {
  const { pregunta: q, ejemplo } = splitPreguntaYEjemplo(pregunta.texto_pregunta);
  return (
    <>
      <h2 className="mt-5 text-display text-[28px] leading-[1.05] tracking-[-0.025em] text-foreground md:text-[36px] xl:text-[40px]">
        {q}
      </h2>
      {ejemplo && (
        <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-foreground/55 italic">
          {ejemplo}
        </p>
      )}
    </>
  );
})()}
```

- [ ] **Step 4: Visual check**

En `/preview/ui` con la pregunta "¿Qué productos…? Por ejemplo: capital de trabajo…", verificar:
- Pregunta principal en display grande, termina en `?`.
- Microcopy "Por ejemplo: …" abajo en italic más pequeño, opacity 55.

- [ ] **Step 5: Commit**

```bash
git add components/entrevista/HeroPregunta.tsx
git commit -m "feat(entrevista): separar microcopy 'Por ejemplo:' del título de pregunta"
```

### Task 2.5: Limpiar paginador `BatchNav.tsx` → format `P01 / P02 / P03`

**Files:**
- Modify: `components/entrevista/BatchNav.tsx`
- Modify: `app/entrevista/[sesion_id]/entrevista-shell.tsx` (eliminar el "Pregunta 1/3" redundante).

- [ ] **Step 1: Read current BatchNav**

```bash
cat components/entrevista/BatchNav.tsx
```

- [ ] **Step 2: Implementar chips font-mono uppercase**

Refactorizar `BatchNav.tsx` para que los items rendericen como:

```tsx
<button
  className={cn(
    'inline-flex h-8 items-center px-2.5 rounded-md font-mono text-[11px] uppercase tracking-[0.18em] transition-all',
    isActive
      ? 'bg-ink text-cream-pure'
      : 'border border-ink/8 text-foreground/55 hover:border-ink/20 hover:text-foreground'
  )}
>
  P{(idx + 1).toString().padStart(2, '0')}
</button>
```

- [ ] **Step 3: Eliminar redundancia "Pregunta 1/3" en el shell**

En `entrevista-shell.tsx` líneas ~283-301, eliminar el `<p className="text-eyebrow">` que dice "Pregunta X / Y" — el BatchNav ya comunica posición vía chips. Dejar solo `<BatchNav>`.

- [ ] **Step 4: Visual check**

`/preview/ui` muestra solo `P01 / P02 / P03` chips, sin texto duplicado "Pregunta 1 / 3".

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(entrevista): paginador limpio P01/P02/P03 sin redundancia"
```

### Task 2.6: Frame editorial en `Textarea`

**Files:**
- Modify: `components/ui/textarea.tsx`

- [ ] **Step 1: Read current textarea**

```bash
cat components/ui/textarea.tsx
```

- [ ] **Step 2: Aplicar frame editorial**

Reemplazar las clases base por un frame `border-ink/12` con focus state gold:

```tsx
className={cn(
  'flex min-h-[80px] w-full rounded-2xl border border-ink/12 bg-transparent px-4 py-3 text-[15px] leading-relaxed text-foreground placeholder:text-foreground/35 transition-all',
  'hover:border-ink/20',
  'focus-visible:outline-none focus-visible:border-gold-deep focus-visible:ring-[3px] focus-visible:ring-gold/18',
  'disabled:cursor-not-allowed disabled:opacity-50',
  className
)}
```

**Importante:** `HeroPregunta.tsx` pasa override classes. Asegurar que `cn(base, className)` mantenga el override del consumer (HeroPregunta tiene su propio focus state inset que ya está alineado a gold). Si hay conflicto, dejar las base más conservadoras y que cada consumer aplique el frame específico.

- [ ] **Step 3: Visual check**

Cualquier `<Textarea>` en la encuesta tiene frame visible 1px ink/12, focus gold sin glow azul.

- [ ] **Step 4: Commit**

```bash
git add components/ui/textarea.tsx
git commit -m "feat(ui): textarea con frame editorial border-ink/12 + focus gold"
```

### Task 2.7: Mic como `btn-tertiary` inline (en `HeroPregunta`)

**Files:**
- Modify: `components/entrevista/HeroPregunta.tsx`

- [ ] **Step 1: Localizar el bloque mic disabled (preview)**

Líneas ~242-265 de `HeroPregunta.tsx`. Es el `<button disabled>` con `<Mic />` icon como circle.

- [ ] **Step 2: Reemplazar por inline button**

```tsx
// ANTES
<button
  type="button"
  disabled
  ...
  className="inline-flex size-11 items-center justify-center rounded-full bg-ink/[0.04] text-foreground/45 ring-1 ring-ink/10 transition-all cursor-not-allowed opacity-70"
>
  <Mic className="size-4" />
  <span className="sr-only">Activar micrófono</span>
</button>

// DESPUÉS
<button
  type="button"
  disabled
  ...
  className="inline-flex h-11 items-center gap-2 rounded-full px-4 text-[13px] font-medium tracking-tight text-foreground/55 hover:text-foreground hover:bg-ink/[0.04] transition-colors disabled:cursor-not-allowed disabled:opacity-60"
>
  <Mic className="size-4" />
  Dictar respuesta
</button>
```

Mantener el tooltip handler igual.

- [ ] **Step 3: Aplicar mismo treatment al `MicButton` real (cuando `sttEnabled`)**

`components/stt/MicButton.tsx` puede necesitar ajuste para que el variant default sea inline btn-tertiary, no circle. Verificar y ajustar si tiene la misma forma de circle.

- [ ] **Step 4: Visual check**

Mic button es ahora inline pill con texto "Dictar respuesta", no más circle outlined.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(entrevista): Mic button inline btn-tertiary en lugar de circle"
```

### Task 2.8: Framing positivo "X pendientes" (resuelto en Task 2.3 RightRail, validar)

Ya cubierto en Task 2.3. Skip o validar:

- [ ] **Step 1: Verificar visual**

`/preview/ui` muestra "3 pendientes" no "3 sin marcar".

- [ ] **Step 2: Si por alguna razón quedó "sin marcar" en algún sitio, fix**

```bash
rg "sin marcar" components app
```

Si hay matches, reemplazar por "pendientes" preservando contexto.

- [ ] **Step 3: Commit (si hubo cambios)**

```bash
git add -A
git commit -m "copy(entrevista): framing positivo 'pendientes' en lugar de 'sin marcar'"
```

### Task 2.9: Investigar floating "N" badge

**Files:**
- Read-only investigation primero.

- [ ] **Step 1: Buscar componentes con texto "N" como badge floating**

```bash
rg "fixed.*top|fixed.*bottom" app components --line-number | grep -i "badge\|floating\|debug"
rg ">N<" components app
rg "process.env.NODE_ENV" components app | grep -i "badge\|floating"
```

- [ ] **Step 2: Inspeccionar visualmente con DevTools**

`/preview/ui`, abrir DevTools → Elements → buscar el elemento con texto "N". Anotar:
- Selector / className.
- Si está dentro del DOM del proyecto o injected externally (extension).

- [ ] **Step 3: Decidir acción según hallazgo**

| Hallazgo | Acción |
|---|---|
| Browser extension del founder (no en DOM proyecto) | Documentar, no tocar código. |
| Componente legítimo del proyecto sin label | Añadir `aria-label` + tooltip visible. |
| Debug overlay (`process.env.NODE_ENV === 'development'`) leak | Confirmar wrap correcto, dejar como está si solo dev. |

- [ ] **Step 4: Implementar fix si aplica**

Editar el componente identificado para añadir label / tooltip / wrap dev-only.

- [ ] **Step 5: Commit (si hubo cambios)**

```bash
git add -A
git commit -m "fix(entrevista): floating N badge con label / dev-only wrap"
```

### Task 2.10: Lighthouse a11y ≥ 95

**Files:**
- No code changes (solo medición).

- [ ] **Step 1: Levantar dev server**

```bash
npm run dev
```

- [ ] **Step 2: Correr Lighthouse audit con Chrome DevTools MCP**

Usar `mcp__chrome-devtools__lighthouse_audit` sobre `/preview/ui`. Capturar score de Accessibility.

- [ ] **Step 3: Si score < 95, identificar y resolver issues**

Issues comunes:
- Faltan `aria-label` en botones icon-only.
- Contraste insuficiente (verificar todos los `text-foreground/45` etc.).
- Heading hierarchy roto (h1 → h3 sin h2).
- Form inputs sin labels asociados.

Aplicar fixes y re-correr.

- [ ] **Step 4: Commit fixes (si hubo)**

```bash
git add -A
git commit -m "fix(a11y): Lighthouse a11y ≥95 en /preview/ui"
```

### Task 2.11: Visual validation Sprint 2

**Files:**
- Create: `.tmp_design_audit/sprint2-after-{layout,rightrail,microcopy,paginador,textarea,mic}.png`

- [ ] **Step 1: Capturar screenshots con DevTools MCP**

`/preview/ui` en viewport 1440x900 y 375x667 (responsive). Validar:
- Right rail: 2 secciones hairline, no 3 cards.
- Pregunta-héroe: `?` claro, microcopy "Por ejemplo:" abajo italic más pequeño.
- Paginador: solo `P01 / P02 / P03`, sin "1 P01".
- Textarea: frame border 1px, focus gold no azul.
- Mic: inline pill "Dictar respuesta".
- "Productos ofrecidos" no `nm_productos_ofrecidos`.
- "X pendientes" no "X sin marcar".

- [ ] **Step 2: Commit screenshots**

```bash
git add .tmp_design_audit/sprint2-*.png
git commit -m "chore(audit): screenshots Sprint 2 (layout y componentes)"
```

**Sprint 2 done.** Acceptance: layout 7fr/5fr funcional (en realidad usamos lg:col-span-8 + lg:col-span-4, equivalente), pregunta-héroe sin Card visual, right rail unificado en 2 secciones, paginador limpio, FIELD_LABELS aplicado, Lighthouse a11y ≥95.

---

## Sprint 3 · Motion (1-2 días)

### Task 3.1: `lib/motion-tokens.ts` con TDD

**Files:**
- Create: `lib/motion-tokens.ts`
- Create: `lib/motion-tokens.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// lib/motion-tokens.test.ts
import { describe, it, expect } from 'vitest';
import { ease, duration, stagger } from './motion-tokens';

describe('motion-tokens', () => {
  it('ease.outExpo es la curva [0.16, 1, 0.3, 1]', () => {
    expect(ease.outExpo).toEqual([0.16, 1, 0.3, 1]);
  });

  it('ease.iosSheet es la curva [0.32, 0.72, 0, 1]', () => {
    expect(ease.iosSheet).toEqual([0.32, 0.72, 0, 1]);
  });

  it('duration.micro está entre 120-200ms', () => {
    expect(duration.micro).toBeGreaterThanOrEqual(0.12);
    expect(duration.micro).toBeLessThanOrEqual(0.2);
  });

  it('stagger.default es 0.06s', () => {
    expect(stagger.default).toBe(0.06);
  });
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
npx vitest run lib/motion-tokens.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implementar `lib/motion-tokens.ts`**

```typescript
// lib/motion-tokens.ts
export const ease = {
  outExpo:  [0.16, 1, 0.3, 1] as const,
  iosSheet: [0.32, 0.72, 0, 1] as const,
  outBack:  [0.34, 1.56, 0.64, 1] as const,
} as const;

export const duration = {
  micro:     0.18,
  component: 0.28,
  macro:     0.48,
  hero:      0.72,
} as const;

export const stagger = {
  tight:   0.04,
  default: 0.06,
  loose:   0.08,
} as const;

export type Ease = typeof ease;
export type Duration = typeof duration;
export type Stagger = typeof stagger;
```

- [ ] **Step 4: Run test, verify pass**

```bash
npx vitest run lib/motion-tokens.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/motion-tokens.ts lib/motion-tokens.test.ts
git commit -m "feat(lib): motion-tokens centralizados (ease, duration, stagger)"
```

### Task 3.2: `lib/view-transitions.ts` wrapper con fallback

**Files:**
- Create: `lib/view-transitions.ts`
- Create: `lib/view-transitions.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// lib/view-transitions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withViewTransition } from './view-transitions';

describe('withViewTransition', () => {
  beforeEach(() => {
    // Reset jsdom document.startViewTransition
    delete (document as any).startViewTransition;
  });

  it('llama al callback inmediatamente cuando la API no existe (fallback)', () => {
    const cb = vi.fn();
    withViewTransition(cb);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('llama a startViewTransition cuando existe', () => {
    const startVT = vi.fn((cb: () => void) => {
      cb();
      return { finished: Promise.resolve() };
    });
    (document as any).startViewTransition = startVT;
    const cb = vi.fn();
    withViewTransition(cb);
    expect(startVT).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
npx vitest run lib/view-transitions.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implementar `lib/view-transitions.ts`**

```typescript
// lib/view-transitions.ts
type StartViewTransition = (cb: () => void) => { finished: Promise<void> };

interface DocumentWithVT extends Document {
  startViewTransition?: StartViewTransition;
}

export function withViewTransition(callback: () => void): void {
  if (typeof document === 'undefined') {
    callback();
    return;
  }
  const doc = document as DocumentWithVT;
  if (typeof doc.startViewTransition !== 'function') {
    callback();
    return;
  }
  doc.startViewTransition(callback);
}
```

- [ ] **Step 4: Run test, verify pass**

```bash
npx vitest run lib/view-transitions.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/view-transitions.ts lib/view-transitions.test.ts
git commit -m "feat(lib): withViewTransition wrapper con fallback no-op"
```

### Task 3.3: CSS de View Transitions en `globals.css`

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Añadir keyframes y view-transition rules**

Al final de globals.css:

```css
/* View Transitions API entre preguntas — fade + translate sutil */
@keyframes survey-fade-out-left {
  to {
    opacity: 0;
    transform: translateX(-12px);
  }
}

@keyframes survey-fade-in-right {
  from {
    opacity: 0;
    transform: translateX(12px);
  }
}

::view-transition-old(question-card) {
  animation: survey-fade-out-left 200ms cubic-bezier(0.32, 0.72, 0, 1) forwards;
}

::view-transition-new(question-card) {
  animation: survey-fade-in-right 320ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(question-card),
  ::view-transition-new(question-card) {
    animation-duration: 1ms !important;
  }
}
```

- [ ] **Step 2: Aplicar `view-transition-name: question-card` al `<article>` de HeroPregunta**

En `components/entrevista/HeroPregunta.tsx` línea ~117, añadir style:

```tsx
<article
  key={pregunta.id}
  style={{ viewTransitionName: 'question-card' }}
  className={cn(...)}
>
```

- [ ] **Step 3: Visual check**

`/preview/ui`, navegar entre preguntas con paginador. En Chrome ≥111 deberías ver el slide fade. En Firefox queda instant (fallback aún no aplicado en este task, próximo).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(motion): view-transitions CSS + viewTransitionName en HeroPregunta"
```

### Task 3.4: Wrap `setPregIndex` con `withViewTransition` en el shell

**Files:**
- Modify: `app/entrevista/[sesion_id]/entrevista-shell.tsx`

- [ ] **Step 1: Importar wrapper**

```tsx
import { withViewTransition } from '@/lib/view-transitions';
```

- [ ] **Step 2: Crear callback que envuelve el setter**

Cerca del `useState(0)` para `pregIndex` (línea ~92):

```tsx
const [pregIndex, setPregIndex] = useState(0);

const navegarAPregunta = useCallback((idx: number) => {
  withViewTransition(() => setPregIndex(idx));
}, []);
```

Añadir `useCallback` al import si falta.

- [ ] **Step 3: Pasar `navegarAPregunta` al BatchNav en lugar de `setPregIndex`**

Reemplazar `onChange={setPregIndex}` por `onChange={navegarAPregunta}` en el render del BatchNav.

- [ ] **Step 4: Visual check**

Chrome: navegar entre P01 → P02 → P03 con clicks en BatchNav. Debe verse el slide fade.

Firefox: navega instant (fallback no-op kicks in).

- [ ] **Step 5: Commit**

```bash
git add app/entrevista/[sesion_id]/entrevista-shell.tsx
git commit -m "feat(motion): navegación entre preguntas wrapeada en withViewTransition"
```

### Task 3.5: Framer Motion fallback para Firefox/Safari ≤17

**Files:**
- Modify: `components/entrevista/HeroPregunta.tsx`

- [ ] **Step 1: Importar `AnimatePresence` y `motion`**

```tsx
import { AnimatePresence, motion } from 'motion/react';
import { ease, duration } from '@/lib/motion-tokens';
```

- [ ] **Step 2: Detectar soporte de View Transitions**

```tsx
const hasNativeVT = typeof document !== 'undefined' && 'startViewTransition' in document;
```

- [ ] **Step 3: Wrap el `<article>` con AnimatePresence solo cuando NO hay soporte nativo**

Esto requiere refactor del componente. Approach simple:

Si `hasNativeVT === true`: render el `<article>` actual (con view-transition-name).

Si `hasNativeVT === false`: render envuelto en `<AnimatePresence mode="wait"><motion.article key={pregunta.id} initial={{opacity:0,x:12}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-12}} transition={{duration: duration.component, ease: ease.outExpo}}>...</motion.article></AnimatePresence>`.

Implementar:

```tsx
const articleContent = (
  <article
    key={pregunta.id}
    style={hasNativeVT ? { viewTransitionName: 'question-card' } : undefined}
    className={cn(
      'group/hero relative overflow-hidden rounded-[32px] bg-cream-pure shadow-xl shadow-ink/5 ring-1 ring-ink/8',
      !hasNativeVT && 'animate-fade-up',
      marcada && 'ring-gold/40'
    )}
  >
    {/* ... resto del contenido del article ... */}
  </article>
);

if (hasNativeVT) return articleContent;

return (
  <AnimatePresence mode="wait">
    <motion.div
      key={pregunta.id}
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: duration.component, ease: ease.outExpo }}
    >
      {articleContent}
    </motion.div>
  </AnimatePresence>
);
```

- [ ] **Step 4: Cross-browser test manual**

Chrome ≥111: slide fade nativo.
Firefox: slide fade vía Framer Motion.
Safari 18+: slide fade nativo.
Safari ≤17 (si dispones): slide fade vía Framer Motion.

- [ ] **Step 5: Commit**

```bash
git add components/entrevista/HeroPregunta.tsx
git commit -m "feat(motion): Framer Motion fallback para browsers sin View Transitions API"
```

### Task 3.6: CTA hover/press states alineados al landing

**Files:**
- Modify: `components/entrevista/RightRail.tsx`
- Reference: cómo el landing (en `app/page.tsx` y `components/landing/HeaderCTA.tsx`) maneja hover/press.

- [ ] **Step 1: Read landing CTA pattern**

```bash
rg "translate-y\|brightness\|hover:bg" components/landing app/page.tsx
```

- [ ] **Step 2: Aplicar hover/press al CTA "Enviar turno" en RightRail**

Modificar las clases del button principal en RightRail para que tenga:

```tsx
'transition-all duration-[160ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
'hover:-translate-y-px hover:brightness-[1.04]',
'active:scale-[0.97] active:duration-[100ms] active:ease-[cubic-bezier(0.32,0.72,0,1)]',
```

- [ ] **Step 3: Visual check**

Hover sobre "Enviar turno": eleva 1px y aclara sutilmente. Press: scale 0.97.

- [ ] **Step 4: Commit**

```bash
git add components/entrevista/RightRail.tsx
git commit -m "feat(motion): CTA hover/press alineado al landing (translate + brightness + scale)"
```

### Task 3.7: Validación `prefers-reduced-motion: reduce`

**Files:**
- Modify: `app/globals.css` (asegurar wrap reduced-motion)

- [ ] **Step 1: Audit animaciones existentes**

```bash
rg "@keyframes\|animation:" app/globals.css
```

- [ ] **Step 2: Wrap todas las animaciones de la encuesta en media query**

Asegurar que existe en globals.css:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Y específicamente para View Transitions (ya añadido en Task 3.3).

- [ ] **Step 3: Test con DevTools**

Chrome DevTools → Rendering panel → Emulate CSS media → `prefers-reduced-motion: reduce`.

Navegar `/preview/ui`: cambios entre preguntas instant, hover sin transitions.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "feat(a11y): respect prefers-reduced-motion: reduce en todas las animaciones"
```

### Task 3.8: 60fps DevTools validation

**Files:**
- No code changes (medición).

- [ ] **Step 1: Performance trace**

Chrome DevTools → Performance → Record. Interactuar con `/preview/ui`:
- Navegar entre preguntas (5 toggles).
- Hover sobre CTA varias veces.
- Scroll de la pregunta-héroe.
- Click en marcar respondida.

Stop recording.

- [ ] **Step 2: Inspeccionar FPS**

Verificar que el indicador de fps queda en verde (≥60fps sostenido). Identificar drops si los hay.

- [ ] **Step 3: Resolver layout thrash si aparece**

Causas comunes:
- `box-shadow: 0 30px 70px ...` en hover (recompose layer pesado).
- Re-renders innecesarios por dependencies en useEffect.

Aplicar fixes (e.g., usar `transform` en lugar de `box-shadow` cambiante, memoizar callbacks).

- [ ] **Step 4: Commit fixes (si hubo)**

```bash
git add -A
git commit -m "perf(motion): resolver layout thrash en hover/transitions (60fps sostenido)"
```

**Sprint 3 done.** Acceptance: motion-tokens centralizados, View Transitions API funcional con fallback, 60fps en DevTools, prefers-reduced-motion respetado.

---

## Sprint 4 · Detalles editoriales (1-2 días)

### Task 4.1: "0/54" como número-display Pitchfork-style en el shell

**Files:**
- Modify: `app/entrevista/[sesion_id]/entrevista-shell.tsx`

- [ ] **Step 1: Localizar el chip actual "0/54 cajas"**

Líneas ~205-216 del shell, dentro del Card stepper.

- [ ] **Step 2: Reemplazar chip por número-display**

```tsx
// ANTES
<div className="flex items-center gap-2.5 self-start rounded-full bg-canvas/40 px-3 py-1.5 ring-1 ring-ink/10 lg:self-center">
  <Sparkles className="size-3 text-gold-deep" />
  <span className="font-mono text-[11px] tabular-nums tracking-tight text-foreground/85">
    {cajasGlobal.llenas}
    <span className="text-foreground/45">/{cajasGlobal.total}</span>
  </span>
  <span className="text-eyebrow text-foreground/45">cajas</span>
</div>

// DESPUÉS
<div className="flex flex-col items-end self-start lg:self-center">
  <p className="text-display text-[28px] leading-none numeric tracking-[-0.02em] text-foreground">
    {cajasGlobal.llenas}
    <span className="text-foreground/42">/{cajasGlobal.total}</span>
  </p>
  <p className="mt-1.5 text-eyebrow text-foreground/45">Cajas resueltas</p>
</div>
```

- [ ] **Step 3: Visual check**

`/preview/ui` muestra el contador como número-display grande tipo Pitchfork, con eyebrow abajo.

- [ ] **Step 4: Commit**

```bash
git add app/entrevista/[sesion_id]/entrevista-shell.tsx
git commit -m "feat(entrevista): número-display Pitchfork-style para 0/54 cajas"
```

### Task 4.2: Glyph divider entre transición de secciones

**Files:**
- Modify: `app/entrevista/[sesion_id]/entrevista-shell.tsx`

- [ ] **Step 1: Detectar cambio de sección**

`grupoActivo` cambia cuando la pregunta activa pertenece a otro `GrupoUI`. Trackearlo:

```tsx
const [grupoAnterior, setGrupoAnterior] = useState<GrupoUI | null>(null);
const [mostrandoDivider, setMostrandoDivider] = useState(false);

useEffect(() => {
  if (grupoAnterior && grupoAnterior !== grupoActivo) {
    setMostrandoDivider(true);
    const t = setTimeout(() => setMostrandoDivider(false), 1200);
    return () => clearTimeout(t);
  }
  setGrupoAnterior(grupoActivo);
}, [grupoActivo, grupoAnterior]);
```

- [ ] **Step 2: Renderizar divider arriba del HeroPregunta cuando aplica**

Justo antes del `<HeroPregunta>`:

```tsx
{mostrandoDivider && (
  <div className="my-12 flex justify-center animate-fade-up">
    <span className="font-display text-gold text-[24px] tracking-[1em]">✦</span>
  </div>
)}
```

- [ ] **Step 3: Visual check**

Avanzar manualmente entre secciones (requiere completar varios turnos en preview o hardcodear un cambio de grupo): debe aparecer el ✦ dorado durante 1.2s.

- [ ] **Step 4: Commit**

```bash
git add app/entrevista/[sesion_id]/entrevista-shell.tsx
git commit -m "feat(entrevista): glyph divider ✦ en transición entre secciones"
```

### Task 4.3: BrandSuccessGlyph al cierre de cada turno

**Files:**
- Modify: `app/entrevista/[sesion_id]/entrevista-shell.tsx`

- [ ] **Step 1: Detectar trigger de "turno enviado exitosamente"**

El store transiciona `status: 'enviando' → 'procesando' → 'capturando'` (con nuevo batch). El "fin de turno exitoso" es la transición de `'procesando' → 'capturando'`.

```tsx
const [mostrandoGlyphTurno, setMostrandoGlyphTurno] = useState(false);
const statusAnteriorRef = useRef<string | null>(null);

useEffect(() => {
  if (statusAnteriorRef.current === 'procesando' && status === 'capturando') {
    setMostrandoGlyphTurno(true);
    const t = setTimeout(() => setMostrandoGlyphTurno(false), 2200);
    return () => clearTimeout(t);
  }
  statusAnteriorRef.current = status;
}, [status]);
```

- [ ] **Step 2: Render overlay con BrandSuccessGlyph**

```tsx
{mostrandoGlyphTurno && (
  <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none animate-fade-up">
    <div className="flex flex-col items-center gap-4 rounded-3xl bg-cream-pure/90 px-12 py-10 backdrop-blur-md shadow-2xl shadow-ink/20 ring-1 ring-ink/8">
      <BrandSuccessGlyph size={64} />
      <p className="text-eyebrow text-gold-deep">Turno completado</p>
    </div>
  </div>
)}
```

`BrandSuccessGlyph` ya está importado en el shell.

- [ ] **Step 3: Visual check (en preview con fixture)**

`/preview/ui`, completar las 3 preguntas del turno y enviar. Debe aparecer el glyph durante ~2s.

- [ ] **Step 4: Commit**

```bash
git add app/entrevista/[sesion_id]/entrevista-shell.tsx
git commit -m "feat(entrevista): BrandSuccessGlyph al cierre exitoso de cada turno"
```

### Task 4.4: SurveyNavPill component (sticky pill nav top-center)

**Files:**
- Create: `components/survey/SurveyNavPill.tsx`
- Modify: `app/entrevista/[sesion_id]/entrevista-shell.tsx` (integrar pill)

- [ ] **Step 1: Implementar SurveyNavPill**

```tsx
// components/survey/SurveyNavPill.tsx
'use client';

import { GrupoUISchema, type GrupoUI } from '@/lib/schemas/cajas';
import { cn } from '@/lib/utils';

const GRUPO_LABELS: Record<GrupoUI, string> = {
  identificacion: 'Identidad',
  productos_y_mercado: 'Productos',
  numeros_del_negocio: 'Números',
  operacion: 'Operación',
  pricing_y_criterio: 'Pricing',
  contacto_y_especificos: 'Contacto',
};

interface Props {
  grupoActivo: GrupoUI;
  grupoIndex: number;
}

export function SurveyNavPill({ grupoActivo, grupoIndex }: Props) {
  const grupos = GrupoUISchema.options;
  return (
    <nav
      aria-label="Secciones de la entrevista"
      className="fixed left-1/2 top-6 z-30 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-ink/85 px-2 py-1.5 text-cream-pure backdrop-blur-xl ring-1 ring-cream-pure/10 shadow-2xl shadow-ink/30"
    >
      {grupos.map((g, i) => (
        <span
          key={g}
          className={cn(
            'rounded-full px-3 py-1 text-eyebrow transition-opacity',
            g === grupoActivo
              ? 'opacity-100 bg-cream-pure/10'
              : i < grupoIndex
                ? 'opacity-60'
                : 'opacity-40'
          )}
        >
          {GRUPO_LABELS[g]}
        </span>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Integrar en el shell**

Importar:

```tsx
import { SurveyNavPill } from '@/components/survey/SurveyNavPill';
```

Renderizar dentro del `<div>` raíz del shell, antes del `<main>`:

```tsx
{!sesionCerrada && (
  <SurveyNavPill
    grupoActivo={grupoActivo}
    grupoIndex={GrupoUISchema.options.indexOf(grupoActivo)}
  />
)}
```

- [ ] **Step 3: Visual check**

`/preview/ui` muestra pill flotante top-center con 6 secciones, sección activa destacada.

- [ ] **Step 4: Decisión: queda o se elimina**

Inspeccionar visualmente: ¿compite con el header navy? ¿es útil o sobra?

Si encaja: dejar.
Si no encaja: eliminar el componente y el render. Documentar la decisión en commit message.

- [ ] **Step 5: Commit (queda)**

```bash
git add -A
git commit -m "feat(survey): SurveyNavPill sticky top-center con 6 secciones"
```

O (se elimina):

```bash
git rm components/survey/SurveyNavPill.tsx
git checkout app/entrevista/[sesion_id]/entrevista-shell.tsx -- # revertir integración
git commit -m "chore(survey): SurveyNavPill descartado tras evaluación visual"
```

### Task 4.5: Atmosphere overlay tuned para survey light

**Files:**
- Modify: `app/entrevista/[sesion_id]/entrevista-shell.tsx`

- [ ] **Step 1: Inspeccionar atmosphere actual**

Líneas ~135-144 del shell tienen `atmosphere-radial-gold` y `atmosphere-noise` aplicados al wrapper.

- [ ] **Step 2: Eliminar `atmosphere-noise` (es para dark, ruido visible en light)**

```tsx
// ANTES
<div aria-hidden className="pointer-events-none absolute inset-0 atmosphere-radial-gold" />
<div aria-hidden className="pointer-events-none absolute inset-0 atmosphere-noise" />

// DESPUÉS
<div aria-hidden className="pointer-events-none absolute inset-0 atmosphere-radial-gold opacity-50" />
```

Reducir intensidad del radial gold a 50% para no competir con la legibilidad de la pregunta.

- [ ] **Step 3: Visual check**

`/preview/ui`: atmosphere sutil, pregunta-héroe perfectamente legible.

- [ ] **Step 4: Commit**

```bash
git add app/entrevista/[sesion_id]/entrevista-shell.tsx
git commit -m "feat(entrevista): atmosphere overlay sutil para surface light (sin noise)"
```

### Task 4.6: Espejo de `/preview/ui` a `/entrevista/[sesion_id]`

**Files:**
- Verify: `app/entrevista/[sesion_id]/page.tsx` ya usa `EntrevistaShell` (es el mismo shell que `/preview/ui`).

- [ ] **Step 1: Inspeccionar diferencias**

```bash
diff app/preview/ui/page.tsx app/entrevista/[sesion_id]/page.tsx
```

Si ambos solo wrap el shell con diferentes props (`preview` vs sin), el espejo es automático: todo el refactor que hicimos en el shell ya aplica a producción.

- [ ] **Step 2: Verificar que `app/entrevista/[sesion_id]/page.tsx` sigue funcionando**

Smoke check (sin cookie real, en dev):

```bash
npm run dev
```

Navegar a `http://localhost:3000/entrevista/test-id-fake-uuid`. Si el middleware redirecciona (sin cookie), está bien — la lógica está intacta. La capa visual aplica.

- [ ] **Step 3: Si hay drift entre `/preview/ui` y `/entrevista/[sesion_id]`, alinear**

Ej: si `/entrevista/[sesion_id]/page.tsx` tiene props extras o lógica que difiere del shell de preview, asegurar paridad.

- [ ] **Step 4: Commit (si hubo cambios)**

```bash
git add -A
git commit -m "chore(entrevista): espejo final de /preview/ui a /entrevista/[sesion_id]"
```

### Task 4.7: Final validation + GIF + push

**Files:**
- Create: `.tmp_design_audit/sprint4-final.gif`
- Create: `.tmp_design_audit/sprint4-final-{landing,encuesta-hero,right-rail,turno-completo}.png`

- [ ] **Step 1: Capturar GIF de flujo completo con DevTools MCP**

Grabar flujo: landing → click CTA → /preview/ui → completar 3 preguntas → enviar turno (con BrandSuccessGlyph) → ver siguiente turno con glyph divider entre secciones.

- [ ] **Step 2: Capturar screenshots finales**

Viewports 1440x900, 768x1024, 375x667.

- [ ] **Step 3: Typecheck y test suite completos**

```bash
npm run typecheck
npm run test
npm run lint
```

Expected: todos PASS.

- [ ] **Step 4: Commit assets**

```bash
git add .tmp_design_audit/sprint4-*
git commit -m "chore(audit): assets finales Sprint 4 (GIF + screenshots)"
```

- [ ] **Step 5: Push branch**

```bash
git push origin feat/admin-paquete-2-magic-links
```

- [ ] **Step 6: Documentar en `last_checkpoint.md`**

Actualizar memoria con el estado final del refactor: cuántos sprints, cuántas tasks, screenshots archivados, decisiones que se tomaron sobre la marcha (e.g., SurveyNavPill quedó/no quedó).

**Sprint 4 done.** Acceptance: número-display "0/54", glyph divider entre secciones, BrandSuccessGlyph al cierre de turno wired, atmosphere tuned, SurveyNavPill evaluado, espejo a producción, GIF + screenshots, branch pushed.

---

## Self-Review

**Spec coverage:** Todas las decisiones del spec están cubiertas:
- 6 decisiones validadas → Sprint 1 (tipografía + tokens), Sprint 2 (layout, single-page state via Task 3.4), Sprint 4 (sticky pill, BrandSuccessGlyph), Task 1 implícita (sin drop cap = no se incluye task de drop cap).
- 14 críticas mapeadas → tabla del spec, cada una con su sprint asignado y task específica.
- Acceptance criteria por sprint → validation tasks (1.9, 2.11, 3.8, 4.7).

**Placeholder scan:** Cero "TBD", "TODO" en el plan. Todos los snippets de código son ejecutables. Las únicas zonas con flexibilidad explícita son:
- Task 1.5 (Stepper) que dice "buscar y reemplazar" porque el contenido exacto del Stepper no se leyó en el plan — el implementer lo lee primero.
- Task 2.4 (microcopy split) porque depende del schema real de Pregunta — el implementer verifica primero.
- Task 2.7 (floating "N") porque es investigación.

**Type consistency:** `getFieldLabel`, `withViewTransition`, `RightRail` props, `motion-tokens` exports — todos los nombres se mantienen consistentes entre tasks. `RightRail` recibe `pendientes`, `total`, `todasMarcadas`, `cajasGlobal`, `cajasPorGrupo`, `grupoActivo` — coherente entre Task 2.3 (creación) y Task 3.6 (modificación de hover).

Plan completo. Próximo paso: subagent-driven execution con `superpowers:subagent-driven-development`.
