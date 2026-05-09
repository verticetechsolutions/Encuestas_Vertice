# Agent 02 — Apple-school minimalism + editorial restraint (May 2026)

## Sites analizados
- apple.com (Vision Pro, Privacy, Environment, AirPods Pro, Newsroom)
- anthropic.com
- arc.net + thebrowser.company
- things.app (Cultured Code)
- notion.com/product
- amie.so
- supercell.com
- raycast.com
- nothing.tech

## Top 10 patterns para Vértice

1. **Tighten display tracking en hero**: `letter-spacing: -0.02em` para serif display 48-64px. Stops "AI-stiff" rendering en sizes grandes.
2. **Warm off-white, no paper-white**: Anthropic `#faf9f5`, Apple `#FBFBFD`. Body text `#1D1D1F` o `#141413`, NUNCA `#000`.
3. **Drop the card en la pregunta**: hero como typographic block sobre crema (Apple Environment six-step pattern). Cards solo para affordances de respuesta, y ahí hairline `1px solid rgba(20,20,19,0.08)` over shadow-lg.
4. **Section padding-y 80-120px** (≈10vh). 3-4× lo típico de B2B forms. Whitespace = trust signal para banca.
5. **Inline-text-with-arrow para secondaries** (Skip / Save / Back). Sin button chrome. Anthropic + Notion: `Continuar →` en oro, hover underline desde la izquierda 240ms cubic-bezier(0.16,1,0.3,1).
6. **Primary CTA: rectangular ~8px radius, fill gold, padding 16×12**. Pill = consumer-app, soft-rect = serious. Hover opacity 1→0.92 en 180ms, sin transform.
7. **Reveal easing**: cubic-bezier(0.16,1,0.3,1) 600ms hero / 240-320ms in-section. Stagger 40-60ms entre answer chips.
8. **Italic captions para meta**: section name, question number, time como italic micro-copy. "*Innovation is up. Emissions are down.*" Apple pattern.
9. **Asymmetric two-column con image-side breathing**: alternar lado de copy entre secciones para romper monotonía en flujo de 54 preguntas.
10. **Pull-quote-as-progress-metric**: en transiciones, "*42 of 54 — credit profile complete*" en serif display 40-48px en lugar de progress bar. Editorial > UI chrome.

## Insights especiales
- **Cards son la EXCEPCIÓN, no el default** en Apple/Anthropic/Things/Arc/Nothing. Typographic blocks dominan.
- **Apple SF Pro Display** está optimizado para ≥20pt con strokes finos y apertures más cerradas que SF Pro Text. Aplica el principio: si usamos Tiempos, usar Headline cut para hero, Text cut para body.
- **Anthropic palette directamente compatible con Vértice**: bg `#faf9f5`, ink `#141413`, accent orange `#d97757`. Cousin direct de cream/ink/gold.
- **Apple buttons = pill solid `#0071E3`**, pero **Notion = rounded-rect ~10px**. Para fintech serio Vértice, **rounded-rect 8px supera pill**.
