# Spec · Refactor UI de encuestas (`/preview/ui` y `/entrevista/[sesion_id]`)

> Fecha: 2026-05-09 · Branch: `feat/admin-paquete-2-magic-links` · Stream A (design)
> Origen: brainstorming sobre `docs/design/SURVEY_UI_PLAN.md` con 6 preguntas validadas y estrategia de ejecución acordada.
> Estado: aprobado por founder, listo para `superpowers:writing-plans`.

## Goal

Migrar la UI de la encuesta (`/preview/ui` exploratory y `/entrevista/[sesion_id]` producción) al design system del landing ya cementado (paleta ink + cream-pure + gold, tipografía Satoshi + General Sans, utilities `.text-display`, `.text-eyebrow`, `.gold-hairline`, `.atmosphere-*`), aplicando patterns 2026 (hairlines en lugar de shadows pesadas, asymmetric grid 7/5, View Transitions API, tabular-nums, typographic block en lugar de cards) y resolviendo las 14 críticas visuales documentadas en la sesión 2026-05-08.

## Non-goals

- No rediseñar el design system del landing. Está validado y cementado en `app/globals.css` (commit `414a587`).
- No eliminar `--lime` ni `--forest` del CSS global. Solo se dejan de usar en surfaces de encuesta. Admin Fase 9 los sigue requiriendo.
- No introducir nuevas dependencias de tipografía. Klim Tiempos / Söhne descartado por costo y porque Satoshi + General Sans cumple el rol editorial necesario.
- No cambiar lógica de negocio de la entrevista (state machine, API de turnos, validaciones, schemas Drizzle). Solo capa visual, layout, y motion.
- No romper producción durante el refactor. Trabajamos sobre `/preview/ui`. El espejo a `/entrevista/[sesion_id]` se ejecuta como última task del Sprint 4.
- No introducir routing de pregunta (no hay `/p1`, `/p2`). La paginación es state interno.
- No construir el sticky pill nav top-center hasta Sprint 4, después de validar el layout principal.

## Decisiones validadas en brainstorming (2026-05-09)

| # | Decisión | Justificación corta |
|---|---|---|
| 1 | Surface light: `bg-cream-pure` + `text-ink` | 12 min de lectura larga, menor eye strain. Paleta inversa al landing. |
| 2 | Single-page con state (sin URL por pregunta) | View Transitions API nativa, simpler routing, sin necesidad de deep-link a pregunta. |
| 3 | Sticky pill nav en Sprint 4 | Construir layout primero, evaluar encaje después. |
| 4 | Sin drop cap | Las preguntas en español empiezan con `¿`, drop cap no encaja tipográficamente. |
| 5 | BrandSuccessGlyph al cierre de cada turno | ~18 turnos por sesión es manejable, refuerza progreso con micro-recompensa. |
| 6 | Tipografía Satoshi + General Sans (Fontshare, free) | Sin scope adicional, capable para fintech editorial. |
| 7 | Estrategia: sprints en orden, espejo al final | Bajo riesgo en producción, ciclo completo de design antes de tocar el flujo real. |

## Arquitectura

### Surface model (light)

- Fondo: `bg-cream-pure` (`#F4F1EA`).
- Texto primario: `text-ink` (`#0A0F1C`).
- Texto secundario: `text-ink/72`. Eyebrow: `text-ink/45`.
- Hairlines: `border-ink/8` divisores finos (1px), `border-ink/12` para énfasis.
- Acento: `text-gold` / `bg-gold` (`#C8A864`). Estados active/focus: `gold-bright`. Hover: `gold-deep`.
- CTA primary inverso al landing: `bg-ink text-cream-pure` (en landing es `bg-cream-pure text-ink`).
- Atmosphere: `.atmosphere-radial-gold` sobre cream. No noise (es para dark surfaces).

Nuevos tokens no-breaking en `globals.css` bajo prefix `--survey-*`:

```css
--survey-bg:                var(--cream-pure);
--survey-text:              var(--ink);
--survey-text-65:           rgb(10 15 28 / 0.65);
--survey-text-45:           rgb(10 15 28 / 0.45);
--survey-hairline:          rgb(10 15 28 / 0.08);
--survey-hairline-strong:   rgb(10 15 28 / 0.12);
--survey-hover:             rgb(10 15 28 / 0.04);
--survey-active-bg:         rgb(200 168 100 / 0.10);
```

Razón del prefix: futuros ajustes globales se hacen en un punto sin tocar 30 componentes. Los componentes usan los tokens `--survey-*`, no los base directos.

### Routing model (single-page con state)

- URL única: `/entrevista/[sesion_id]`.
- Pregunta actual es state interno (Zustand store en `lib/state/entrevista.ts`).
- Cambio de pregunta wrapeado en `document.startViewTransition()` con `view-transition-name: question-card`.
- Animación nativa: fade-out-translate-x(-12px) → fade-in-translate-x(12px), 320ms `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Fallback obligatorio** con Framer Motion `<AnimatePresence>` para Firefox y Safari ≤17. Misma curva.
- Back/forward del browser navega entre sesiones (`/entrevista/[id-prev]`), no entre preguntas. Coherente con flujo lineal de entrevista.

### Component-level decisions

| Componente | Decisión |
|---|---|
| Pregunta-héroe | Sin `<Card>` wrapper. Estructura: `<article>` con eyebrow + h1 display + microcopy italic + textarea + actions. |
| Right rail | 2 secciones separadas por hairline (Turno actual + Progreso). Elimina las 3 cards apiladas actuales. |
| Mic input | `btn-tertiary` inline con texto, no más outlined circle. |
| Paginador | Chips `font-mono uppercase tracking-[0.18em]` con format `P01 / P02 / P03`. Sin la redundancia "1 P01". |
| BrandSuccessGlyph | Reusado del landing (no reimplementado), disparado al confirmar cada "Enviar turno" exitoso. ~2s sequence. |
| Stepper | Mantener componente, migrar tokens (matar `--lime`, pasar a `gold`). |
| Sticky pill nav | Diferido a Sprint 4. Componente nuevo `<SurveyNavPill>` si todavía encaja. |
| Floating "N" badge | Investigar origen en Sprint 2. Si es debug overlay, wrap en `process.env.NODE_ENV === 'development'`. Si es browser extension del founder, ignorar. |

### State y data flow

- Store de entrevista (`lib/state/entrevista.ts`) sin cambios estructurales.
- Wrapper `setQuestion(idx)` instrumentado con `document.startViewTransition()` cuando está disponible.
- Nuevo módulo `lib/cajas-labels.ts`: deriva `FIELD_LABELS: Record<string, string>` desde `lib/schemas/cajas.ts` (DRY, no duplicar el catálogo de 54 cajas). Resuelve la crítica del debug leak `nm_productos_ofrecidos`.
- Nuevo módulo `lib/motion-tokens.ts`: exporta `ease`, `duration`, `stagger` constantes. Centralización de motion para swap global posterior.
- Right rail consume el contrato actual de `app/api/turn/route.ts` y `lib/state/entrevista.ts`. **Verificar antes de Sprint 2** que entrega: `currentField`, `turnPending` count, `currentSection`, lista de `SECTIONS` con `done/total`. Si falta algo, ajustar API en Sprint 2.

## Estructura de sprints

Detalle completo en `docs/design/SURVEY_UI_PLAN.md`. Resumen ejecutivo:

| Sprint | Objetivo | Duración | Focus |
|---|---|---|---|
| 1 | Tokens y tipografía | 1-2 días | Matar `--lime` en encuesta, Satoshi + General Sans confirmados, tabular-nums sweep, tokens `--survey-*` en globals. |
| 2 | Layout y componentes | 2-3 días | Asymmetric 7/5, eliminar card en pregunta-héroe, refactor right rail, paginador limpio, mic + button unificados, FIELD_LABELS, eyebrow letterspacing. |
| 3 | Motion | 1-2 días | `lib/motion-tokens.ts`, View Transitions API entre preguntas, scroll-triggered reveals, focus states gold, `prefers-reduced-motion` validado. |
| 4 | Detalles editoriales | 1-2 días | Número-display Pitchfork-style "0/54", glyph dividers entre secciones, sticky pill nav top-center, atmosphere overlay sutil, BrandSuccessGlyph wired. Espejo final a `/entrevista/[sesion_id]`. |

**Total estimado**: 6-9 días de trabajo.

## Acceptance criteria

### Sprint 1
- `rg "lime|forest" components/entrevista app/entrevista app/preview/ui` retorna 0 matches activos en JSX (puede quedar en CSS legacy si admin lo necesita).
- Inspección visual `/preview/ui`: ningún surface o text es verde lima.
- Todos los números (counters, percentages, paginación) renderizan con `font-variant-numeric: tabular-nums`.
- `globals.css` contiene los 8 tokens `--survey-*` documentados arriba.
- Screenshots before/after en `.tmp_design_audit/sprint1-*.png`.

### Sprint 2
- Layout 7fr/5fr aplicado en `/preview/ui` con `max-w-[1480px]` y padding heredado del landing.
- Pregunta-héroe NO usa `<Card>`. Estructura `<article>` con jerarquía tipográfica clara (eyebrow + h1 + italic + textarea + actions).
- Right rail tiene exactamente 2 secciones (Turno actual + Progreso), separadas por `border-t border-ink/8 pt-6`.
- Paginador renderiza solo `P01 / P02 / P03` (formato chosen). Sin "1 P01".
- `lib/cajas-labels.ts` existe y mapea las 54 cajas a labels humanos. Right rail muestra "Productos ofrecidos" no `nm_productos_ofrecidos`.
- Mic accionable, ya no es circle outlined sino inline button.
- Lighthouse a11y ≥ 95 en `/preview/ui`.
- Floating "N" badge: documentado origen y resuelto (eliminado, condicionado a dev, o tooltip añadido).
- Screenshots before/after en `.tmp_design_audit/sprint2-*.png`.

### Sprint 3
- `lib/motion-tokens.ts` exporta `ease`, `duration`, `stagger`. Todos los componentes nuevos importan de ahí.
- View Transitions API funciona entre preguntas en Chrome ≥111, Edge, Safari 18+.
- Fallback Framer Motion `<AnimatePresence>` activo en Firefox y Safari ≤17 con misma curva.
- DevTools Performance: 60fps sostenidos en transitions, sin layout thrash.
- `prefers-reduced-motion: reduce` (DevTools → Rendering → Emulate) desactiva todas las animaciones, transitions instant.
- CTA hover: `translateY(-1px) brightness(1.04)` 160ms.
- Input focus: `box-shadow: 0 0 0 3px rgba(200,168,100,0.18)` + `border: var(--gold-deep)`, 180ms `outExpo`.

### Sprint 4
- "0/54" renderiza como número-display tipo Pitchfork (font-display 28px, tabular-nums, eyebrow "CAJAS RESUELTAS" abajo).
- Glyph divider `✦` aparece entre transición de secciones (Identidad → Productos → Números, etc.).
- Sticky pill nav top-center construido y evaluado. Si encaja, queda. Si no, se elimina y se documenta la decisión.
- `.atmosphere-radial-gold` aplicado al body de la encuesta sin competir con legibilidad de pregunta.
- BrandSuccessGlyph wired a confirmación exitosa de turno. Sequence ~2s.
- Espejo a `/entrevista/[sesion_id]` completado. Producción visualmente equivalente a `/preview/ui`.
- GIF recording before/after del founder con Chrome DevTools MCP en `.tmp_design_audit/sprint4-final.gif`.

## Estrategia de validación

- **Visual regression manual** al cierre de cada sprint: screenshots before/after con Chrome DevTools MCP, archivados en `.tmp_design_audit/sprintN-*.png`.
- **Performance** en Sprint 3: DevTools Performance trace, target 60fps sostenido, identificar y resolver cualquier layout thrash.
- **Accesibilidad** en Sprint 2: Lighthouse a11y ≥ 95.
- **Reduced motion** en Sprint 3: DevTools Rendering panel emulando `prefers-reduced-motion: reduce`, confirmar transitions instant.
- **Cross-browser** en Sprint 3: Chrome (View Transitions), Firefox (fallback Framer), Safari 18+ (View Transitions), Safari ≤17 (fallback).
- **End-to-end producción** en Sprint 4: navegar `/entrevista/[sesion_id]` real con un sesion_id de prueba, completar 1 turno, validar BrandSuccessGlyph dispara y los counters actualizan.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Romper producción durante refactor. | Trabajar exclusivamente sobre `/preview/ui` hasta Sprint 4. Espejo a producción en la última task. |
| `--lime` y `--forest` siguen activos en admin Fase 9. | NO eliminarlos del CSS. Solo no usarlos en surfaces de encuesta. Sweep posterior si se decide deprecar admin Fase 9. |
| View Transitions API tiene browser support limitado. | Fallback obligatorio con Framer Motion `<AnimatePresence>` desde Sprint 3. No es opcional. |
| Tipografía Satoshi/General Sans dependen de Fontshare CDN. | Fallback `system-ui` en `font-family`. Considerar self-host si CDN se vuelve inestable. |
| El layout asume datos del API actual. | Verificar contrato de `app/api/turn/route.ts` antes de Sprint 2. Si falta algo, ajustar API en Sprint 2 (no en Sprint 3 o 4). |
| "Feel" de pregunta-héroe sin card puede sentirse sin contención. | Validar visualmente con founder al cierre de Sprint 2 antes de comprometer Sprint 3-4. |
| Stream paralelo (paquete 2 magic links) toca la misma branch. | NO tocar `lib/admin/`, `app/admin/`, `app/actions/adminMagicLinks.ts`, ni nada en `docs/superpowers/specs/2026-05-08-admin-panel-paquete-2-*`. Trabajo aislado al UI de encuesta. |

## Archivos en scope

| Archivo | Estado actual | Acción |
|---|---|---|
| `app/preview/ui/page.tsx` | exploratory preview | Refactor completo (target principal del trabajo). |
| `app/entrevista/[sesion_id]/page.tsx` | producción | Espejo del refactor en Sprint 4. |
| `app/entrevista/[sesion_id]/entrevista-shell.tsx` | shell wrapper | Actualizar tokens y hairlines. |
| `app/entrevista/[sesion_id]/bienvenida/page.tsx` | onboarding | Revisar coherencia con landing (Sprint 4). |
| `components/entrevista/PreguntaCard.tsx` | core | Reemplazar Card por typographic block. |
| `components/entrevista/PanelProgreso.tsx` | rail | Refactor a hairline-divided list. |
| `components/entrevista/Stepper.tsx` | nav | Migrar tokens (matar `--lime`). |
| `components/entrevista/BatchNav.tsx` | paginador | Limpiar redundancia, format `P01`. |
| `components/ui/button.tsx` (shadcn) | base | Añadir variantes alineadas a landing. |
| `components/ui/card.tsx` (shadcn) | base | Evaluar si sigue justificándose o se deprecia. |
| `components/ui/textarea.tsx` (shadcn) | base | Restyle con frame editorial. |
| `components/ui/progress.tsx` (shadcn) | base | Migrar de lime a gold. |
| `app/globals.css` | tokens base | Añadir 8 utilities `--survey-*` y utility `.numeric`. |
| `lib/cajas-labels.ts` | NO EXISTE | Crear. Deriva de `lib/schemas/cajas.ts`. |
| `lib/motion-tokens.ts` | NO EXISTE | Crear. Exporta `ease`, `duration`, `stagger`. |

## Mapeo crítica original → soluciones

| # | Crítica original | Sprint | Solución |
|---|---|---|---|
| 1 | Verde lima fuera de paleta | 1 | Migrar `--lime` → `gold-bright` tint en surfaces de encuesta. |
| 2 | `nm_productos_ofrecidos` debug leak | 2 | `FIELD_LABELS` derivado de `lib/schemas/cajas.ts`. |
| 3 | Floating "N" sin label | 2 | Investigar origen, eliminar o tooltip. |
| 4 | "Por ejemplo:" mismo peso que pregunta | 2 | Separar en `<p>` italic más pequeño debajo del `<h1>`. |
| 5 | "1 P01" redundante | 2 | Solo `P01 / P02 / P03`. |
| 6 | Mic vs button shape mismatch | 2 | Mic como `btn-tertiary` inline. |
| 7 | "Enviar turno" disabled con flecha decorativa | 2 | Counter contextual en label "(0/3)". |
| 8 | Eyebrow "P 0 1" letterspacing roto | 1 | Aplicar `.text-eyebrow` cementado. |
| 9 | "3 sin marcar" framing negativo | 2 | Cambiar a "3 pendientes". |
| 10 | "0/54 CAJAS" descontextualizado | 4 | Convertir en número-display Pitchfork-style. |
| 11 | Textarea plano sin frame | 2 | Frame editorial con `border-ink/12` + focus state gold. |
| 12 | "PREVIEW UI" pill compite con marca | 2 | Mover a tag izquierda preview-only. |
| 13 | 3 cards apiladas en right rail | 2 | Fundir Turno + Cubre, hairline divider. |
| 14 | Underlines de progreso confusas | 2 | Reemplazar con divisores hairline + counters tabular-nums. |

## Componentes landing reutilizables (inventario)

| Componente | Reusar en encuesta | Nota |
|---|---|---|
| `LenisProvider` | Sí | Smooth scroll global. |
| `BrandSuccessGlyph` | Sí | Cierre exitoso de turno. |
| `HeaderCTA` (patrón) | Sí (adaptado) | Spring fill en CTAs de encuesta. |
| `HeroLine` (patrón reveal) | Posible | Word-mask reveal en pregunta-héroe. Validar visualmente. |
| `SectionIndicator` (patrón) | Posible | Indicador vertical de las 6 secciones. |
| `VertexMark` | No | Marca grande del landing, no encaja. |
| `CookiesCard` | Sí | Si aplica banner cookies. |
| `FooterLink` | Sí | Si la encuesta tiene footer minimal. |
| `SuccessMark` | Sí | Variante minor del BrandSuccessGlyph. |

## Referencias

- `docs/design/DESIGN_SYSTEM.md`: design system del landing actual (tokens, utilities, tipografía).
- `docs/design/SURVEY_UI_PLAN.md`: plan operativo en 4 sprints con código copy-pasteable.
- `docs/design/research/MASTER_PATTERNS_CATALOG.md`: catálogo prescriptivo de patterns 2026.
- `docs/design/research/05-awwwards-may-2026.md`: top 12 sites mayo 2026 con tokens y paletas.
- `docs/design/research/04-motion-2026.md`: GSAP, Framer Motion, Lenis, View Transitions API.
- `docs/design/research/06-manual-browse-observations.md`: Studio Namma, Marvell Tile & Stone observados en vivo.
- Commit `414a587`: tokenización del landing (paleta cementada en producción).

## Cómo retomar

1. `git pull --ff-only` (sync con origin si hace falta).
2. `npm run dev`, abrir `http://localhost:3000/preview/ui`.
3. Leer este spec + `docs/design/SURVEY_UI_PLAN.md` + `docs/design/DESIGN_SYSTEM.md`.
4. Invocar `superpowers:writing-plans` para generar el plan TDD detallado por sprint.
5. Ejecutar Sprint 1. Validación visual con DevTools MCP al cierre.
