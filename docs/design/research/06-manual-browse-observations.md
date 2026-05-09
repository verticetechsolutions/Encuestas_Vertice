# Manual Browse Observations (live, mayo 8 2026)

## Studio Namma (SOTD hoy, score 7.29) — studionamma.com

**Header**:
- "STUDIO NAMMA" | "DARK MODE" toggle texto | "MENU" | "LET'S TALK!" — todo IBM Plex Mono (o similar) uppercase, ~12px, letter-spacing ~0.06em
- DARK MODE como TEXTO no como switch icon (editorial decision, evita iconos genéricos)
- Padding header ~16-20px

**Hero**:
- Tipografía display sans bold (Helvetica Neue Black o Akzidenz) ~110-120px desktop, line-height 1.0-1.05
- Texto inicial en mid-gray (~#A1A1A1), implica reveal-on-scroll
- "WE THINK CRAFT AND DESIGN" — luego en scroll aparece NEGRO con underline animada en "DETAIL MATTERS"
- Eyebrow centered: "CREATIVE STUDIO BUILDING PREMIUM BRANDS" mono uppercase small
- Hero ratio whitespace ~60-65%

**Detalles Editorial**:
- Real-time clock bottom-right "BARCELONA, SPAIN · 07:17:57" mono uppercase tracked
- "Awwwards Nominee" como ribbon vertical pinned right edge
- Cookie banner pill dark con texto + "ACCEPT COOKIES →" arrow
- Background pure neutral gray #E2E2E2 aprox (no warm cream)

**Lección para Vértice**: el truco "texto gris→negro on scroll" funciona si tienes un manifiesto con varias frases. Para entrevista guiada NO, porque es flow lineal de respuestas. Pero el clock/location en mono y el header ultra-minimal SÍ se traducen.

---

## Marvell Tile & Stone (SOTD May 7, Humaan) — marvellco.com.au

**Esto es 1:1 con Vértice paleta crema/ink/dorado**.

**Background**:
- Cream/sand `#EEE7DC` aprox (muy cerca de #F2EAD6 Vértice)
- **Grid sutil overlay** ~64x64px cells, opacity ink ~3%. Lectura: "tile & stone" pero el principio es brillante: textura sutil que sugiere identidad sin ruido.
- **Para Vértice**: traducir a grid que hint "structured form" o "ledger lines" sutiles.

**Hero**:
- "Marvell" + "Tile & Stone" en sans light/thin **white** sobre cream (alto contraste inverso, hace flotar la marca)
- Display ~140-160px, line-height 1.0
- Letter-spacing negative ~-0.02em
- Posicionamiento: hero text **superpuesto** con imágenes floating

**Floating images**:
- 6-7 fotos de proyectos flotando en posiciones irregulares
- NO grid uniforme, asimetría intencional
- Ratios mixtos (4:3, 16:9, square, vertical)
- Algunas overlap con el texto creando layering depth
- Bordes sin frame, sin shadow, sin radius (rectangles puros)

**Sticky pill nav**:
- Pinned top center
- Dark container pill con logo "M" + "PROJECTS / PROFILE / CONTACT"
- Pill-shaped, dark navy/ink, floats over content
- No tradicional sticky-bar full-width — es **floating chip nav**

**Whitespace**: 70%+ empty. Solo cream + grid + elementos puntuales.

**Awwwards "w."** badge ribbon edge derecha (igual que Studio Namma — Awwwards integration estándar para los winners).

**Lecciones para Vértice**:
1. Grid sutil overlay con textura ink ~3% como background del cream — añade identidad sin ruido.
2. **Pill nav floating top center** es superior al header full-width tradicional. Para Vértice puede ser el shortcut a las 6 secciones de la entrevista.
3. **Floating elements asimétricos** (no en grid) crean dynamism. Para Vértice: el rail derecho (TURNO, CUBRE, PROGRESO) puede romper la grid 50/50 con offset asymétrico tipo Marvell.
4. **High contrast inverso** en hero (white-on-cream) es opción si subimos el componente "número de pregunta" a tamaño display blanco floating sobre la pregunta serif negra.

---

## Patterns convergentes (lo que TODOS confirman)

### Color
- Warm cream + near-black ink + 1 acento sparingly (Vértice ya lo tiene, mantener)
- NUNCA #000, usar #0F0E0E
- NUNCA #FFFFFF para body backgrounds — siempre warm off-white #FAF9F5 / #F2EAD6 / #F0EEE9 (Cloud Dancer 2026)
- NUNCA gradientes purple→blue (consenso unánime)
- Hairlines en `rgba(15,14,14,0.06-0.10)` sobre crema

### Typography
- Pareja serif display + sans humanist (TODOS lo recomiendan)
- Recomendación más fuerte: **Tiempos Headline + Söhne** (Klim) o GT Sectra + Neue Haas Grotesk
- Mono para datos numéricos: Söhne Mono / IBM Plex Mono / JetBrains Mono
- `font-variant-numeric: tabular-nums` en TODO número (consenso unánime)
- Ratios hero/body 3.5x-5x
- Letter-spacing negative en display (-0.02 a -0.035em)

### Spacing
- 8px grid base (4/8/12/16/24/32/48/64/96/128)
- Section padding-y **96-128px desktop / 48-64px mobile**
- Whitespace target 50-65%
- Card padding interior 24-32px
- Container max-width 1120-1200px

### Motion
- Easings dominantes: `cubic-bezier(0.16, 1, 0.3, 1)` (out-expo) + `cubic-bezier(0.32, 0.72, 0, 1)` (iOS drawer)
- Micro 120-180ms / Componente 200-320ms / Macro 400-700ms / Hero 800-1200ms
- Stagger 40-60ms typical
- View Transitions API es la dirección 2026 para page-to-page

### Components
- Border-radius: 8px chips, 12px cards, 16px panels, 999px CTA pills
- NUNCA rounded-2xl en todo
- Hairline borders > shadow-lg
- Cards son la EXCEPCIÓN, no el default — typographic blocks dominan
