## Checkpoint 2026-05-09 23:00 — UI refactor entrevista (Paleta A + 2 cards + jerarquía)

**Sesión:** Refactor visual masivo de la entrevista. Diagnóstico crítico del estado original (taupe + 4 cards apiladas + right rail con info duplicada) → ejecución por fases F0-F4: Paleta A off-white, single column Typeform-style, stepper minimalista, 2 cards diferenciadas tonalmente, BatchNav inline minimal, jerarquía pregunta secundaria, atmosphere radial sutil. Múltiples rondas de feedback visual con captura/análisis vía chrome-devtools MCP.
**Repo:** Vertice_Encuesta · **Branch actual:** `feat/entrevista-cards-unificadas` · **Working tree:** limpio · **5 commits ahead de master** (sin pushear).

### Lo que se hizo (5 commits encadenados)

1. `1fb9525` style(hero): rm gold hairline orphan + helper más sutil (foreground/55 → /40, 14.5px)
2. `4ee4442` feat(tokens): `--survey-card-1` cream warm `#FBF6EE` + `--survey-card-2` white pure `#FFFFFF`
3. `4be070b` refactor(entrevista): 2 cards unificadas + BatchNav minimal "← Anterior · X/N · Siguiente →"
4. `f0a285a` feat(entrevista): atmosphere radial dual-source para play visual sutil (5% top-right + 3% bottom-left)
5. `efbdc03` feat(entrevista): jerarquía pregunta secundaria + icon Desmarcar moderno + card-1 unificada

### Decisiones de diseño tomadas
- **Paleta A:** Canvas off-white `#FAF8F4`, card 1 cream warm `#FBF6EE` (brand+stepper), card 2 white pure (workspace). Hairline `rgba(10,15,28,0.06)` muy fino. Gold solo en 1px lines + dot del current step.
- **Layout:** Single column max-w-720px centrado. Header NO standalone — vive integrado dentro de card 1 (eliminada la sensación de "header distanciado").
- **Asimetría suave:** Logo huge h-10 izquierda + meta column derecha (Banco Demo + status). Generous padding (px-9 md:py-8).
- **Stepper:** Dots + labels + hairline conector (sin pill wrapper). 3 estados claros: completed (filled gold + check), active (filled ink + halo gold), pending (outline hairline).
- **Card 1 sin hairline divider interno:** brand row + stepper viven como una sola pieza unificada (decisión del founder en F4).
- **Card 2 con hairline divider:** entre body (pregunta + textarea + acciones) y footer (BatchNav minimal). Separación intencional.
- **BatchNav inline:** "← Anterior · X / N · Siguiente →" sin pills/rings/bg. Chip "X marcadas" sutil cuando aplica.
- **Pregunta jerárquica:** `splitPreguntaYAuxiliar` con 2 patterns — "Por ejemplo:" microcopy + pregunta compuesta `"...?"` + `" Y/Si/¿..."`. Auxiliar baja a 14.5px regular foreground/40. Principal mantiene peso hero.
- **Icon Desmarcar:** `CircleDashed` → `RotateCcw` (semánticamente undo, visualmente moderno).
- **Microanims consistency:** stagger card 1 (t=0) → card 2 (t=80ms). View transitions entre preguntas vivas.

### Files modificados (clave)
- `app/globals.css` — tokens Paleta A + cards + atmosphere radial removida del shell
- `app/entrevista/[sesion_id]/entrevista-shell.tsx` — estructura 2 cards, single col, BrandSuccessGlyph overlay, atmosphere dual-radial inline
- `components/entrevista/HeroPregunta.tsx` — sin card wrapper, splitPreguntaYAuxiliar, RotateCcw, Tema inline, helper sutil
- `components/entrevista/Stepper.tsx` — minimalist dots + hairlines (full rewrite)
- `components/entrevista/BatchNav.tsx` — inline minimal text-link (full rewrite)
- `components/entrevista/RightRail.tsx` — DELETED (subsumido en card 1 stepper + Tema inline en HeroPregunta)

### Pendientes / blockers

- [USER] **Decidir cuándo abrir PR** de `feat/entrevista-cards-unificadas` → master. Branch NO pusheada todavía (5 commits locales, intencional para que decidas).
- [USER] **PR #4 paralelo** existe: `feat/wire-opus-director` con commit `a1cb845` wireando Opus director + síntesis. Si se mergea ANTES de mi PR, mi shell tendrá merge conflict cosmético en el `useEffect` de mount (cargarPrimerBatch wiring no está acá). Solucionable con rebase.
- [USER] **opencommit DESINSTALADO** en esta sesión para evitar interferencia con la sesión paralela Claude. Si lo reinstalás (`npm install -g opencommit`), volverá a auto-commit/push.
- [USER] **ADMIN_PANEL_TOKEN** sigue pendiente de rotar (visible en transcript de sesión E2E del paquete 2).
- [USER] **Stash local "user-ui-work-hero-pregunta"** existe (creado por sesión paralela Claude para preservar mi WIP en su branch). Safe to drop una vez verificado que mi cards-unificadas tiene todo.
- [BLOCKED] **Auto-advance + autosend on 3era pregunta** (F4 original del plan) NO implementado. Es cambio de comportamiento del CTA primary, no visual. Decidiste hacerlo después de pulir visual.

### Próximos pasos sugeridos para perfeccionamiento UI

1. **Continuar review visual iterativa** — `npm run dev` → http://localhost:3000/preview/ui. Navegar P01, P02, P03 (la 3era tiene la pregunta compuesta + RotateCcw en marcada). Casos límite que pueden surgir: respuesta muy larga en textarea (overflow), modo dark si se activa, transición entre secciones (glyph divider), cierre exitoso de turno (BrandSuccessGlyph overlay).
2. **F7 responsive mobile** — verificar viewport <768px. El Stepper tiene fallback a barra lineal. Las 2 cards deberían colapsar a single column con padding reducido. Logo h-9 en sm, h-10 en md+. Probar con DevTools device toolbar.
3. **Microinteracciones que falten** — el chip "✓ RESPONDIDA" arriba a la derecha entra con animate-fade-up cuando marcás. Considerar: hover states más explícitos en BatchNav (Anterior/Siguiente links), focus ring en Dictar respuesta (actualmente solo gold/30), feedback visual cuando Tema cambia (no hay).
4. **Eyebrow duplicación P0X · SECCIÓN** — el founder mencionó como nit que P03 dice "P03 · NÚMEROS DEL NEGOCIO" y el stepper top también dice "Números". Decidir si simplificar a solo "P03" en eyebrow.
5. **F4 lógica** (cuando llegue el momento) — auto-advance al confirmar respuesta + autosend en 3era pregunta del turno. Sin pause. Cambia comportamiento de `marcarRespondida` + `enviarBatch` en el store.
6. **Smoke real con sesión** (post-merge) — fuera del preview/ui, probar el flow productivo con `cargarPrimerBatch` (queda activo cuando PR #4 mergee).

### Cómo retomar

```bash
git checkout feat/entrevista-cards-unificadas
git log --oneline -6      # debería mostrar efbdc03 al tope
npm run dev               # dev server en :3000
# Abrir http://localhost:3000/preview/ui
```

Para entender el estado visual:
- Captura de referencia mental: 2 cards diferenciadas tonalmente, single column 720px, Typeform-style.
- P01 (corta) muestra base case sin auxiliar.
- P03 (compuesta) muestra split principal + secundaria con jerarquía bajada.
- Click "Marcar respondida" → estado marcada con chip "RESPONDIDA" + botón cambia a "Desmarcar" con icon RotateCcw + chip "1 MARCADA" en counter.

Archivos clave para tweaks rápidos:
- Tokens: `app/globals.css` líneas 145-160 (`--survey-*`)
- Layout: `app/entrevista/[sesion_id]/entrevista-shell.tsx` líneas 173+
- Pregunta: `components/entrevista/HeroPregunta.tsx`
- Stepper: `components/entrevista/Stepper.tsx`
- Nav: `components/entrevista/BatchNav.tsx`

**Riesgo de olvido:** branch `feat/entrevista-cards-unificadas` NO pusheada. 5 commits valiosos solo locales. Si la máquina muere, se pierden. Pushear cuando puedas.
