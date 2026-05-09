# Agent 03 — Editorial / serif-led modern (May 2026)

## Sites analizados
- Stripe Press
- Pitchfork (Condé refresh por Grilli Type)
- Stratechery
- Lenny's Newsletter / Substack
- It's Nice That
- AIGA Eye on Design
- Are.na
- Neue.no
- NYT Cooking
- Tiempos system (Klim)

## Top 10 patterns para Vértice

1. **Optical-size pairing**: serif display (Tiempos Headline / Recoleta / GT Sectra) para hero, serif text para helper. UNA familia, dos cuts > dos familias.
2. **`font-variant-numeric: tabular-nums`** en TODO número (12/54, montos, %, fechas). Highest-leverage credibility.
3. **Smallcaps + fractions OpenType** para units (MXN, MENSUAL, ANUAL, TIIE). `font-feature-settings: "smcp", "frac"`.
4. **Hairline dividers reemplazan cards** para TOC de 6 secciones. `1px solid oklch(from ink l c h / 0.10)` sobre crema, NUNCA shadow-lg.
5. **Glyph section break** (`§`, `✦`, o asteriscos centrados) entre grupos en lugar de `<hr>`. Stratechery rhythm.
6. **Asymmetric review grid** al final: col-span-7 / col-span-5, no halves iguales (It's Nice That).
7. **Cream + ink + un acento**: cream `oklch(0.97 0.01 85)` ≈ `#F5F3EE`, ink `oklch(0.18 0.01 60)` ≈ `#1B1A18`, gold solo en active state. No purple→blue. Opcional: salmon de Eye on Design.
8. **Editorial pagination**: prev/next con título de la siguiente pregunta, no solo flecha. Wikipedia/Wirecutter.
9. **Number-as-display-typography**: "Pregunta 12 / 54" en serif display ~28px tabular-nums como pacing element. Pitchfork score energy.
10. **Microanimaciones disciplinadas**: scroll-fade-in stagger 60-80ms (pregunta→helper→input), cubic-bezier(0.16,1,0.3,1), 600-900ms hero / 180-240ms hover. Link hover = `text-decoration-thickness: 1px` + `text-underline-offset: 4px` + color shift, no opacity tricks.

## Tipografías serif premium identificadas
- Tiempos Headline / Tiempos Text / Tiempos Fine (Klim)
- FK Display
- GT Sectra
- Recoleta
- Bradford
- Söhne (sans pairing)
- Walfork (custom Pitchfork variant)
- NYT Cheltenham / Imperial / Georgia / Franklin

## URLs cited
- press.stripe.com
- pitchfork.com (typewolf.com/walfork, grillitype.com/commissions/pitchfork)
- stratechery.com
- lennysnewsletter.com
- itsnicethat.com
- eyeondesign.aiga.org
- are.na
- neue.no
- cooking.nytimes.com (fontsinuse NYT Cheltenham)
- klim.co.nz/blog/tiempos-design-information

## Insights especialmente fuertes para Vértice
- **NYT Cooking → Vértice**: traduce el sistema de fractions/tabular-nums/smallcaps de recetas a tasas/plazos/montos en fintech. Esto es la diferencia entre "fintech con serif" y "fintech que respeta tipografía".
- **Are.na pattern**: el TOC de secciones con hairlines en vez de cards resuelve mi crítica original al right rail (3 cards apiladas).
- **Pitchfork score**: el "0/54 CAJAS" actual mal integrado puede convertirse en el ancla visual del header si lo tratamos como número-tipografía.
