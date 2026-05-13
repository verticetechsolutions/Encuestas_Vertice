## Checkpoint UI 2026-05-10 — Refactor entrevista (sesión completa de iteraciones)

**Sesión:** Sesión larga e intensa de refactor visual + UX de la entrevista en `/preview/ui`. Iteraciones secuenciales sobre Stepper (spine vertical + iconos), Card 2 workspace (resize animado, anti-shift), buttons (motion+spring alineados con landing), HeroPregunta rewrite from scratch, sidebar englobado en card secundaria. Anti layout-shift llegó a CLS ~0.0066 con ZERO horizontal shift al cambiar de pregunta. Validación empírica continua con Playwright + PerformanceObserver.

> Coexiste con `.claude/CHECKPOINT.md` (sesión backend paralela). Esta es la sesión UI sobre la misma branch `feat/entrevista-cards-unificadas`.

**Repo:** Vertice_Encuesta · **Branch:** `feat/entrevista-cards-unificadas` · **HEAD:** `509b5fd`
**Cambios sin commit:** 5 archivos modificados (+753/-421 líneas) + 1 archivo nuevo + 10 screenshots PNG en root.

### Lo que se hizo (UI refactor en orden cronológico)

1. **Stepper rewrite v2 → v5** (`components/entrevista/Stepper.tsx`, +266 líneas):
   - v2: Spine vertical narrative (eliminó dots horizontales genéricos)
   - v3: Outcome-based labels PLG-style (Linear/Stripe Atlas)
   - v4: Iconos semánticos por sección (Landmark, CreditCard, BarChart3, ShieldCheck, Tag, Send) + container morph + check badge corner + halo pulsante
   - v5: Spine continuo (1 línea hairline + fill gold animado por height %)
   - Progress widget global (counter + barra hairline) arriba del spine

2. **Card 1 navy header** (`entrevista-shell.tsx`):
   - Logo VÉRTICE h-14 (era h-9), Banco Demo 19px semibold (era 15px medium)
   - "ENTREVISTA DE CRITERIOS" demoted a micro-eyebrow

3. **Layout grid 2col global**: card 1 header full-width arriba + grid `260px / 1fr` debajo (sidebar card secundaria + workspace)

4. **HeroPregunta rewrite from scratch** (`components/entrevista/HeroPregunta.tsx`, 290 líneas, 24% menos):
   - Estructura 4 secciones con `flex flex-col gap-6`
   - Eyebrow simplificado "PREGUNTA NN DE NN" (sin sección)
   - Word stagger ELIMINADO (era over-engineered, generaba subpixel shifts)
   - Banner Lock + chip RESPONDIDA como ghost slots con `min-h` reservado
   - Textarea readOnly+visual locked cuando marcada (bg gold/5, border gold/30)
   - 3 subcomponentes inline: AutosaveIndicator, DictarButtonDisabled, MarcarButton
   - max-h:360px + overflow:auto en textarea (scroll interno, no crece la card)

5. **Buttons design system landing** (`lib/motion-presets.ts` NUEVO + HeroPregunta + BatchNav):
   - SPRING_BUTTON / SPRING_TAP / SPRING_ICON + 5 variants reusables
   - Pill h-12 + pl-5 pr-2 (asym) + internal icon container (gold↔ink contrast)
   - Hover: scale 1.02 + y:-1 + icon rotate/scale spring
   - cursor-pointer en enabled, cursor-not-allowed en disabled
   - min-w-[200px] en CTA (no shift al alternar "Marcar respondida" ↔ "Desmarcar")
   - shadow gold de 50px en CTA primary (estilo "Solicitar alianza" landing)

6. **Anti layout-shift definitivo**:
   - `scrollbar-gutter: stable` en `<html>` (`app/globals.css`) — fix raíz del horizontal shift al aparecer scrollbar en P02
   - motion.div `layout` simple en body card 2 (sin FluidHeightBody que era over-engineered)
   - AnimatePresence `mode="wait"` con `initial/animate/exit: opacity` puro (sin x ni y)
   - Ghost slots en chip + banner + counter con `visibility + opacity` toggle
   - Sidebar englobado en card cream pale 40% + hairline (secundaria, no compite con white pure de card 2)

### Métricas finales empíricas (Playwright + PerformanceObserver)

| Métrica | Original | Final |
|---|---|---|
| CLS sumado | 0.0662 | **0.0066** (10× mejor) |
| Shift horizontal heading entre preguntas | 36px (animation) | **0px** |
| Shift al toggle marcada | varios elementos | **0px** |
| Card2 width estable | sí | sí |
| Doc width al aparecer scrollbar | -15px shift | **0px** (gutter stable) |

### Files modificados

- `app/entrevista/[sesion_id]/entrevista-shell.tsx` — masivo: layout 2col + AnimatePresence + sidebar card + state cleanup
- `app/globals.css` — `scrollbar-gutter: stable` global
- `components/entrevista/BatchNav.tsx` — motion+spring + cursor + min-w[180px] counter ghost slot
- `components/entrevista/HeroPregunta.tsx` — rewrite completo
- `components/entrevista/Stepper.tsx` — rewrite a spine vertical + iconos + progress widget

### Files nuevos

- `lib/motion-presets.ts` — SPRING constants + button variants compartidos

### Files que quedan sin trackear (pendientes de cleanup)

- 10 screenshots PNG de validación visual en root del repo (`landing-buttons.png`, `preview-ui-*.png`)

### Pendientes / blockers

- [USER] **Decidir si commitear** los 5 cambios + `lib/motion-presets.ts` (rama está pusheada a `origin/feat/entrevista-cards-unificadas`).
- [USER] **Limpiar screenshots** PNG en root: mover a `.claude/screens/` o borrar (no deberían quedar en commits).
- [USER] **Decidir abrir PR** de `feat/entrevista-cards-unificadas` → master (rama tiene 7 commits ahead de master + estos cambios sin commit).
- [USER] **PR #4 paralelo** (`feat/wire-opus-director`, commit `a1cb845`) sigue OPEN. Si mergea antes que esta rama, hacer rebase + agregar `cargarPrimerBatch` al shell.
- [USER] **Backend session paralela** (PRs #5/#6/#7/#8/#9/#10 mergeados a master) ya completa pre-keys — leer `.claude/CHECKPOINT.md` para context completo backend.
- [USER] **Aplicar migración** `0004_drop_dead_magic_link_cols.sql` contra Neon `vertice-mvp/main` (idempotente).
- [USER] Rotar `ADMIN_PANEL_TOKEN`.
- [BLOCKED] STT cableado al store (`use-deepgram-stream` → `MicButton`) — Fase 6 finalize.
- [BLOCKED] `<formato_valores_por_caja>` 49 entradas (founder en branch paralela) — sin él `SONNET_FASE1_PROMPT_READY=false`.

### Próximos pasos sugeridos

1. **Cleanup repo**: borrar o mover los 10 PNG sin trackear, después `git add` los 5 archivos modificados + `lib/motion-presets.ts`.
2. **Decidir commitear y abrir PR**: si listo, `gh pr create` contra master con descripción del refactor visual completo.
3. **Smoke real con sesión productiva** post-merge backend (cargarPrimerBatch real con ANTHROPIC_API_KEY).
4. Verificar visualmente en mobile (<768px) — el sidebar fallback colapsa a "Sección X de N" + barra lineal en mobile, no validado en este turno.
5. Si quedan iteraciones de UI, basar sobre el estado actual ya estable (CLS 0.0066, ZERO horizontal shift).

### Cómo retomar

```bash
git checkout feat/entrevista-cards-unificadas
git status                  # ver los 5 modificados + 10 PNG screenshots untracked
git log --oneline -10       # esperar 509b5fd al tope
npm run dev                 # dev server :3000
# http://localhost:3000/preview/ui — estado UI vigente
```

Documentos clave de la sesión UI:
- `lib/motion-presets.ts` (sistema motion compartido SPRING_BUTTON/TAP/ICON + variants)
- `components/entrevista/HeroPregunta.tsx` (workspace pregunta limpio, 4 secciones flex)
- `components/entrevista/Stepper.tsx` (spine vertical continuo + iconos por sección)
- `app/entrevista/[sesion_id]/entrevista-shell.tsx` (orchestrator: grid 2col + AnimatePresence + sidebar card + motion.div layout body)
- `app/globals.css` línea ~218 (`scrollbar-gutter: stable`)

**Riesgo de olvido:** los 5 archivos modificados + `lib/motion-presets.ts` NO están commiteados — si la máquina muere, se pierden ~1100 líneas de refactor de UI iterativo. Backup en `~/.claude/projects/.../memory/last_checkpoint.md` (este mismo doc).
