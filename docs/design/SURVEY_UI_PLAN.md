# Plan de refactor · Nueva UI de encuestas (`/preview/ui` y derivados)

> Estado: **plan documentado, NO implementado**. Para ejecutar después.
> Fecha de redacción: 2026-05-08. Branch al momento: `feat/admin-paquete-1-visibilidad-core`.
> Inputs: research mayo 2026 en `docs/design/research/` + design system en `docs/design/DESIGN_SYSTEM.md` + crítica visual original (sesión 2026-05-08).

## Tesis de fondo

La encuesta hereda **el design system del landing**, no inventa uno nuevo. La paleta cementada (`ink #0A0F1C` + `cream-pure #F4F1EA` + `gold #C8A864` + variantes) ya está en `globals.css`. Las utilities (`.text-display`, `.text-eyebrow`, `.gold-hairline`, `.gold-seam`, `.atmosphere-*`) ya existen. Lo que falta es:

1. **Eliminar legacy** (`--lime` / `--forest` migrados a `gold` en surfaces de entrevista).
2. **Aplicar patterns 2026** sobre esa base (hairlines > shadows, asymmetric 7/5, View Transitions API, tabular-nums, eliminar cards en favor de typographic blocks).
3. **Reusar componentes landing** donde aplique (`LenisProvider`, `BrandSuccessGlyph`, patrón `HeaderCTA`).

---

## Decisión de surface

| | Landing | Encuesta |
|---|---|---|
| Background | `bg-ink` (`#0A0F1C`) | `bg-cream-pure` (`#F4F1EA`) |
| Body text | `text-cream-pure` | `text-ink` |
| Eyebrow | `text-cream-pure/45` | `text-ink/55` |
| Body secondary | `text-cream-pure/72` | `text-ink/72` |
| Hairlines | `border-cream-pure/8` | `border-ink/8` |
| Acento principal | `text-gold` / `bg-gold` | igual (gold + gold-deep + gold-bright) |
| Atmosphere | radial gold + noise sobre ink | radial gold + grid sutil sobre cream |
| CTA primary | `bg-cream-pure text-ink` (cream sobre ink) | **`bg-ink text-cream-pure`** (ink sobre cream — inverso) |

**Razón**: la entrevista dura 12 min con lectura larga. Light surface preserva legibilidad y reduce eye strain. La paleta es la misma, solo invertida.

---

## Archivos en scope

| Archivo | Estado | Acción |
|---|---|---|
| `app/preview/ui/page.tsx` | exploratory preview | refactor completo |
| `app/entrevista/[sesion_id]/page.tsx` | producción | refactor completo (espejar /preview/ui) |
| `app/entrevista/[sesion_id]/entrevista-shell.tsx` | shell wrapper | actualizar tokens + hairlines |
| `app/entrevista/[sesion_id]/bienvenida/page.tsx` | onboarding | revisar coherencia con landing |
| `components/entrevista/PreguntaCard.tsx` | core | reemplazar card por typographic block |
| `components/entrevista/PanelProgreso.tsx` | rail | refactor a hairline-divided list |
| `components/entrevista/Stepper.tsx` | nav | mantener pero migrar tokens (no `--lime`) |
| `components/entrevista/BatchNav.tsx` | paginador | limpiar "1 P01" redundancia |
| `components/ui/button.tsx` (shadcn) | base | añadir variantes alineadas a landing |
| `components/ui/card.tsx` (shadcn) | base | revisar si sigue justificándose o se deprecia |
| `components/ui/textarea.tsx` (shadcn) | base | restyle con frame editorial |
| `components/ui/progress.tsx` (shadcn) | base | migrar de lime a gold |
| `app/globals.css` | tokens | añadir utilities de surface entrevista; deprecar uso de `--lime` en encuesta |

---

## Sprint 1 · Tokens y tipografía (1-2 días)

**Objetivo**: matar el verde lima, asegurar Satoshi+General Sans en encuesta, tabular-nums en todo número.

### Tareas
1. **Audit `--lime` / `--forest` en encuesta**:
   ```bash
   rg -t tsx -t css "lime|forest" components/entrevista app/entrevista app/preview/ui
   ```
   Hacer lista de cada uso y reemplazar:
   - `bg-lime-soft` → `bg-gold-bright/15`
   - `text-lime-foreground` → `text-gold-deep`
   - `--accent: var(--lime)` → en surface de encuesta, override a `var(--gold-bright)` localmente
   - Animation `vertice-cierre-caja` (lime ring): mantener pero swap color a `oklch(0.75 0.13 80)` (gold equivalente) o usar `--gold-bright` directo.

2. **Confirmar font loading en encuesta**:
   - `app/layout.tsx` ya carga Satoshi + General Sans globalmente. Validar que `<html className="font-sans">` aplica en `/entrevista/*` (debe — es root layout).
   - Aplicar `.text-display` a la pregunta-héroe, `.text-eyebrow` a labels.

3. **Tabular-nums sweep**:
   - Crear utility `.numeric` en globals.css:
     ```css
     .numeric {
       font-variant-numeric: tabular-nums lining-nums;
       font-feature-settings: "tnum" 1, "lnum" 1;
     }
     ```
   - Aplicar a: `0/54 CAJAS`, `Pregunta 1/3`, `12 de 54`, `0/5`, `0/7`, `0/15`, `0/6`, `0/14`, `0/7`, percentages.

4. **Variables de surface entrevista** (nuevas, no breaking):
   ```css
   /* Surface tokens entrevista (light) */
   --survey-bg: var(--cream-pure);
   --survey-text: var(--ink);
   --survey-text-65: rgb(10 15 28 / 0.65);
   --survey-text-45: rgb(10 15 28 / 0.45);
   --survey-hairline: rgb(10 15 28 / 0.08);
   --survey-hairline-strong: rgb(10 15 28 / 0.12);
   --survey-hover: rgb(10 15 28 / 0.04);
   --survey-active-bg: rgb(200 168 100 / 0.10);  /* gold tint para active states */
   ```

### Validación Sprint 1
- Visualmente: matar el chip verde de "Productos y mercado" en `/preview/ui`. Debe ser gold tint.
- DevTools Performance: 60fps en hover/scroll.
- Visual regression: screenshots before/after en `.tmp_design_audit/sprint1-*.png`.

---

## Sprint 2 · Layout y componentes (2-3 días)

**Objetivo**: refactor estructural. Asymmetric grid, eliminar card de pregunta-héroe, fundir right rail, limpiar leaks.

### Tareas

1. **Refactor `/preview/ui` layout a 7fr/5fr asymmetric**:
   - Grid: `grid-cols-12 gap-x-10` → form `col-span-7`, rail `col-span-5`.
   - Container: `max-w-[1480px] px-6 sm:px-10 lg:px-14` (heredar del landing exacto).
   - Section padding-y: `pt-24 sm:pt-28 lg:pt-36 pb-16 lg:pb-20`.

2. **Pregunta-héroe SIN card**:
   - Eliminar `<Card>` wrapper alrededor de la pregunta.
   - Estructura propuesta:
     ```tsx
     <article className="max-w-[620px] py-12">
       <p className="text-eyebrow text-ink/45">
         Pregunta 01 · Productos y mercado
       </p>
       <h1 className="mt-7 text-display text-ink">
         ¿Qué productos de crédito ofrece su institución actualmente?
       </h1>
       <p className="mt-4 max-w-[52ch] text-[17px] leading-relaxed text-ink/65 italic">
         Por ejemplo: capital de trabajo, crédito simple, factoraje, arrendamiento.
       </p>
       <textarea className="mt-10 w-full ..." />
       <div className="mt-6 flex items-center gap-3">
         <button className="btn-tertiary">
           <MicIcon /> Dictar respuesta
         </button>
         <button className="btn-primary-survey">
           Marcar respondida
         </button>
       </div>
     </article>
     ```

3. **Separar pregunta de microcopy "Por ejemplo:"** (resuelve crítica original 4):
   - La pregunta canónica termina en "?".
   - El "Por ejemplo: capital de trabajo..." va abajo en serif/italic más pequeño.

4. **Mapear `nm_productos_ofrecidos` a label humano** (resuelve crítica 2):
   - Crear `lib/cajas-labels.ts`:
     ```typescript
     export const FIELD_LABELS: Record<string, string> = {
       nm_productos_ofrecidos: 'Productos ofrecidos',
       // ... resto del catálogo de 54 cajas
     };
     ```
   - El JSON canónico de cajas ya existe en `lib/schemas/cajas.ts` — leer y derivar labels desde ahí (DRY).

5. **Refactor right rail unificado**:
   - Eliminar 3 cards apiladas. Reemplazar con 2 secciones separadas por hairline:
     ```tsx
     <aside className="sticky top-24 space-y-8">
       {/* Bloque 1: contexto inmediato (Turno + Cubre fundidos) */}
       <section className="border-t border-ink/8 pt-6">
         <p className="text-eyebrow text-ink/45">Turno actual</p>
         <p className="mt-3 font-display text-[36px] leading-[1.0] text-ink numeric">
           3 pendientes
         </p>
         <p className="mt-2 text-[14px] text-ink/65 italic">
           Marca cada respuesta para habilitar el envío.
         </p>
         <p className="mt-8 text-eyebrow text-ink/45">Esta pregunta cubre</p>
         <ul className="mt-2 space-y-1 text-[15px]">
           <li>{FIELD_LABELS[currentField] ?? currentField}</li>
         </ul>
         <button className="btn-primary-survey w-full mt-6 numeric">
           Enviar turno (0/3)
         </button>
       </section>

       {/* Bloque 2: progreso */}
       <section className="border-t border-ink/8 pt-6">
         <p className="text-eyebrow text-ink/45">Progreso</p>
         <p className="mt-3 font-display text-[36px] leading-[1.0] text-ink numeric">
           0<span className="text-ink/42">/54</span>
         </p>
         <ul className="mt-6 divide-y divide-ink/8">
           {SECTIONS.map(s => (
             <li className={cn(
               "py-3 flex justify-between text-[15px]",
               s.id === currentSection && "font-medium"
             )}>
               <span>{s.label}</span>
               <span className="numeric text-ink/65">{s.done}/{s.total}</span>
             </li>
           ))}
         </ul>
       </section>
     </aside>
     ```

6. **Paginador limpio** (resuelve crítica 5):
   - Eliminar redundancia "1 P01". Solo `P01 / P02 / P03` o solo `1 / 2 / 3`. Decidir uno y consistente.
   - Estilo: chips font-mono uppercase tracking-[0.18em], active filled ink, inactive border-ink/8.

7. **Mic + Marcar respondida unificados** (resuelve crítica 6):
   - Mic ya no es circle outlined. Pasa a `btn-tertiary` con icono inline.
   - "Marcar respondida" sigue como pill-CTA pero alineado al landing primary (cream→ink en landing, ink→cream en encuesta = inverso).

8. **Eliminar floating "N" badge**:
   - Investigar qué es. Aparece en landing también (vi en mi browse). Si es:
     - Browser extension del usuario → ignorar, no es del proyecto.
     - Debug overlay → wrap en `process.env.NODE_ENV === 'development'`.
     - Componente legítimo → añadir tooltip/label visible.

9. **Eyebrow letterspacing**:
   - Reemplazar todos los eyebrows por `.text-eyebrow` ya cementado (`tracking-[0.32em]`).

10. **Sticky pill nav top-center** (opcional, estilo Marvell):
    - Floating pill con shortcuts a las 6 secciones. Se evalúa después del Sprint 2.

### Validación Sprint 2
- Visual: layout asymmetric correcto, sin card en pregunta, right rail unificado.
- Funcional: navegación entre preguntas funciona, mic accionable.
- Lighthouse: accesibilidad ≥95.
- Screenshots before/after en `.tmp_design_audit/sprint2-*.png`.

---

## Sprint 3 · Motion (1-2 días)

**Objetivo**: aplicar tokens de motion + View Transitions API entre preguntas.

### Tareas

1. **Crear `lib/motion-tokens.ts`**:
   ```typescript
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
   ```

2. **View Transitions API entre preguntas**:
   - Wrap setQuestion con `document.startViewTransition`.
   - CSS:
     ```css
     ::view-transition-old(question-card) {
       animation: fade-out 200ms cubic-bezier(0.32, 0.72, 0, 1);
     }
     ::view-transition-new(question-card) {
       animation: fade-in-slide 320ms cubic-bezier(0.16, 1, 0.3, 1);
     }
     @keyframes fade-out { to { opacity: 0; transform: translateX(-12px); } }
     @keyframes fade-in-slide { from { opacity: 0; transform: translateX(12px); } }
     ```
   - Apply `view-transition-name: question-card` al `<article>` de la pregunta.
   - Fallback: si no soporta API, usar Framer Motion `<AnimatePresence>` con misma curva.

3. **Section reveal scroll-triggered**:
   - Wrap secciones con motion:
     ```tsx
     <motion.section
       initial={{ opacity: 0, y: 16 }}
       whileInView={{ opacity: 1, y: 0 }}
       viewport={{ once: true, amount: 0.3 }}
       transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], staggerChildren: 0.04 }}
     />
     ```

4. **CTA hover/press alineado a landing**:
   - Hover: `translateY(-1px)` + brightness 1.04, 160ms.
   - Active: `scale(0.97)`, 100ms iosSheet.
   - Glow opcional: `box-shadow: 0 0 32px rgba(200,168,100,0.40)` en hover (Mercury-style).

5. **Input focus state**:
   - `box-shadow: 0 0 0 3px rgba(200,168,100,0.18)` + border `var(--gold-deep)`, 180ms outExpo.
   - Sin glow azul genérico.

6. **`prefers-reduced-motion: reduce` validation**:
   - Test manual con DevTools → Rendering → Emulate CSS prefers-reduced-motion.
   - Confirmar que view transitions, framer motion, y CSS animations todas respetan.

### Validación Sprint 3
- DevTools Performance: 60fps en transitions, no jank.
- View Transitions: feel orgánico, no abrupto.
- Reduced motion: todo accesible sin animation, opacity instant.

---

## Sprint 4 · Detalles editoriales (1-2 días)

**Objetivo**: pulido editorial y diferenciación de marca.

### Tareas

1. **"0/54 CAJAS" como número-display tipo Pitchfork**:
   - Mover el chip top-right al header como número-display:
     ```tsx
     <div className="font-display text-[28px] leading-none numeric tracking-[-0.02em]">
       <span>0</span>
       <span className="text-ink/42">/54</span>
     </div>
     ```
   - Etiqueta abajo: `text-eyebrow text-ink/45` "CAJAS RESUELTAS".

2. **Glyph divider entre grupos** (Stratechery `* * *`):
   - En transición entre secciones (Identidad → Productos → Números), añadir:
     ```tsx
     <div className="my-16 flex justify-center">
       <span className="font-display text-gold text-[24px] tracking-[1em]">✦</span>
     </div>
     ```

3. **Drop cap opcional en pregunta-héroe**:
   - CSS:
     ```css
     .pregunta-hero::first-letter {
       initial-letter: 3 2;
       -webkit-initial-letter: 3 2;
       color: var(--gold-deep);
       font-family: var(--font-heading);
       margin-right: 0.05em;
     }
     ```
   - Validar visualmente — puede no encajar con preguntas que empiezan con "¿".

4. **Sticky pill nav top-center** (estilo Marvell):
   - Component nuevo `<SurveyNavPill>`:
     ```tsx
     <nav className="fixed left-1/2 top-6 -translate-x-1/2 z-30 inline-flex items-center gap-1 rounded-full bg-ink/85 backdrop-blur-xl px-2 py-1.5 text-cream-pure">
       <button className="rounded-full px-3 py-1 text-eyebrow opacity-100">Identidad</button>
       <button className="rounded-full px-3 py-1 text-eyebrow opacity-50 hover:opacity-100">Productos</button>
       {/* ... */}
     </nav>
     ```

5. **Atmosphere overlay sutil**:
   - Aplicar `.atmosphere-radial-gold` + `.atmosphere-noise` (ya en globals) al body de la encuesta.
   - Validar que no compita con la legibilidad de la pregunta.

6. **BrandSuccessGlyph al cerrar turno**:
   - Reusar el componente del landing en el momento de "Enviar turno" exitoso.
   - Sequence: spark → arc → ring → check (~2s total). Editorial fintech feel.

### Validación Sprint 4
- Comparar lado a lado screenshots `/preview/ui` antes/después.
- Pedir feedback al founder con Chrome DevTools MCP recording (GIF).
- Validar que el feel es coherente con la landing (mismo idioma visual, surface inverso).

---

## Mapeo crítica original → soluciones

| # | Crítica original | Sprint | Solución |
|---|---|---|---|
| 1 | Verde lima fuera de paleta | 1 | Migrar `--lime` → `gold-bright` tint en surfaces de encuesta |
| 2 | `nm_productos_ofrecidos` debug leak | 2 | `FIELD_LABELS` derivado de `lib/schemas/cajas.ts` |
| 3 | Floating "N" sin label | 2 | Investigar origen + añadir tooltip o eliminar |
| 4 | "Por ejemplo:" mismo peso que pregunta | 2 | Separar en `<p>` italic más pequeño debajo del `<h1>` |
| 5 | "1 P01" redundante | 2 | Decidir uno (P01) o (1) y aplicar consistente |
| 6 | Mic vs button shape mismatch | 2 | Mic como `btn-tertiary` inline |
| 7 | "Enviar turno" disabled con flecha decorativa | 2 | Añadir counter contextual en label "(0/3)" |
| 8 | Eyebrow "P 0 1" letterspacing roto | 1 | Aplicar `.text-eyebrow` cementado |
| 9 | "3 sin marcar" framing negativo | 2 | Cambiar a "3 pendientes" |
| 10 | "0/54 CAJAS" descontextualizado | 4 | Convertir en número-display Pitchfork-style |
| 11 | Textarea plano sin frame | 2 | Frame editorial con border-ink/12 + focus state |
| 12 | "PREVIEW UI" pill compite con marca | 2 | Mover a tag izquierda preview-only |
| 13 | 3 cards apiladas en right rail | 2 | Fundir Turno + Cubre, hairline divider |
| 14 | Underlines de progreso confusas | 2 | Reemplazar con divisores hairline + counters tabular-nums |

---

## Brainstorm previo (recomendado)

Antes de iniciar Sprint 1, ejecutar `superpowers:brainstorming` con el founder para validar:

1. **Surface decisión confirmada**: ¿encuesta light cream o dark ink? (recomendado: light, validar).
2. **Sticky pill nav top-center**: ¿implementar en Sprint 2 o solo Sprint 4?
3. **View Transitions API**: ¿single-page con state o paginación con URL real `/encuesta/p1`, `/encuesta/p2`?
4. **Drop cap en pregunta-héroe**: ¿lo queremos o se siente over-design?
5. **BrandSuccessGlyph en cierre de turno**: ¿cada turno o solo al cierre final de la sesión?
6. **Tipografía**: confirmar Satoshi + General Sans (ya en stack) vs upgrade a Tiempos Headline + Söhne (presupuesto Klim ~$700-1500 USD).

---

## Componentes landing reutilizables (inventario)

| Componente | Reusar en encuesta | Nota |
|---|---|---|
| `LenisProvider` | Sí | Smooth scroll global. Wrap encuesta también. |
| `BrandSuccessGlyph` | Sí | Cierre exitoso de turno o sesión. |
| `HeaderCTA` (patrón) | Sí (adaptado) | El spring fill en CTAs de encuesta. |
| `HeroLine` (patrón reveal) | Posible | Revelar pregunta-héroe con word-mask reveal? Validar. |
| `SectionIndicator` (patrón) | Posible | Adaptar a indicador vertical de las 6 secciones. |
| `VertexMark` | No | Marca grande del landing, no encaja en encuesta. |
| `CookiesCard` | Sí | Reusar tal cual si aplica banner cookies. |
| `FooterLink` | Sí | Si la encuesta tiene footer minimal. |
| `SuccessMark` | Sí | Variante minor del BrandSuccessGlyph. |

---

## Riesgos y consideraciones

1. **Romper la entrevista en producción** durante el refactor. Mitigación: trabajar primero en `/preview/ui` (que es exploratory), después espejar a `/entrevista/[sesion_id]`.
2. **`--lime` y `--forest` siguen activos en admin**. NO eliminarlos del CSS — solo no usarlos en encuesta. Mantener legacy intacto hasta sweep posterior.
3. **View Transitions API tiene browser support limitado** (Chrome ≥111, Safari 18, Firefox detrás de flag). Fallback con Framer Motion obligatorio.
4. **Tipografía Satoshi/General Sans dependen de Fontshare CDN**. Si CDN cae, fallback `system-ui`. Considerar self-host después.
5. **El mockup propuesto para right rail asume datos reales**. Verificar que la API actual (`app/api/turn/route.ts`, `lib/state/entrevista.ts`) entrega lo que necesita el nuevo layout.
6. **El "feel" de pregunta sin card puede sentir "sin contención"** para usuarios financieros conservadores. Validar con founder con A/B visual antes de Sprint 2.

---

## Cómo retomar

1. Leer `docs/design/research/MASTER_PATTERNS_CATALOG.md` (el catálogo prescriptivo).
2. Leer `docs/design/DESIGN_SYSTEM.md` (lo que ya existe en producción landing).
3. Leer este plan completo.
4. Ejecutar `superpowers:brainstorming` con founder para validar las 6 preguntas del bloque "Brainstorm previo".
5. Iniciar Sprint 1 (tokens). Time box 1-2 días.
6. Validación visual obligatoria al final de cada sprint con DevTools MCP screenshots before/after en `.tmp_design_audit/sprintN-*.png`.
