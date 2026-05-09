# Agent 03b — Editorial / serif-led modern v2 (más detalle)

## 8 fonts serif premium dominantes 2026
1. **Tiempos Headline / Tiempos Text** (Klim) — default editorial 2026
2. **GT Sectra / Sectra Display** (Grilli Type) — caligrafía pluma + precisión quirúrgica
3. **PP Editorial New** (Pangram Pangram) — Didone alto contraste, italics curvy
4. **Lyon Text** (Commercial Type, Bernau) — elegancia renacentista, NYT Magazine
5. **GT Super** (Grilli Type) — sofisticación contemporánea
6. **Ogg** (Sharp Type) — Top 1 Typewolf 2026, basado en Oscar Ogg calligraphy
7. **Self Modern** (Mass-Driver) — high-contrast didone con guiño contemporáneo
8. **Greta Text** (Typotheque) — 3 tamaños ópticos para newspaper rigor

Honorable: Freight Text, Adobe Caslon Pro, Charter (free, dominante en Substack/Stratechery).

## Pairings concretos en uso

| Display serif | Sans secundaria | Mono | Donde se ve |
|---|---|---|---|
| Tiempos Headline | Söhne / Söhne Breit | Söhne Mono | Stripe Press, fintech editorial |
| GT Sectra | GT America / Neue Haas Grotesk | GT America Mono | Eye on Design, agencies |
| PP Editorial New | PP Neue Montreal | PP Fraktion Mono | Awwwards picks, Locomotive |
| Lyon Text | ABC Diatype | JetBrains Mono | NYT-adjacent |
| Tiempos Text | Walfork (custom GT) | — | Pitchfork |
| Charter | system-ui / SF Pro | SF Mono | Stratechery, Substack |
| Ogg | ABC Diatype Mono / Söhne | — | Magazines moda, agencias |

**Para Vértice (cream + ink + dorado)**: pair recomendado = **Tiempos Headline (hero) + Söhne (UI/body) + Söhne Mono (números/IDs)**. Alternativa: GT Sectra Display + Neue Haas Grotesk Display Pro.

## Hero typography prescripción
- **Display hero serif**: 64-96px desktop / 40-56px mobile. Line-height 0.95-1.05. Letter-spacing -0.02em a -0.035em.
- **Sub-hero / lead**: 20-24px serif italic o sans 16-18px, line-height 1.4-1.5.
- **Body**: 17-19px (Stratechery), line-height 1.55-1.65, max-width 62-68ch.
- **Caption / meta**: 12-13px sans uppercase con `letter-spacing: 0.08em` y smallcaps reales.
- **Ratios hero/body**: 3.5x-5x.

## OpenType + drop caps
```css
--hairline: 1px solid rgb(15 14 14 / 0.10);  /* ink 10% */
--hairline-soft: 1px solid rgb(15 14 14 / 0.06);
--hairline-strong: 1px solid rgb(15 14 14 / 0.16);

.numeric {
  font-variant-numeric: tabular-nums lining-nums;
  font-feature-settings: "tnum" 1, "lnum" 1, "ss01" 1;
}
.body-prose {
  font-variant-numeric: oldstyle-nums proportional-nums;
  font-feature-settings: "onum" 1, "pnum" 1, "kern" 1, "liga" 1;
}
.smallcaps-meta {
  font-variant-caps: all-small-caps;
  letter-spacing: 0.06em;
}

/* Drop cap nativo */
.drop-cap::first-letter {
  initial-letter: 3 2;
  -webkit-initial-letter: 3 2;
  color: var(--gold-deep);
  font-family: 'Tiempos Headline', serif;
}

/* Pull quote editorial */
.pull-quote {
  font-style: italic;
  font-size: 36px;
  line-height: 1.15;
  margin-left: -100px;  /* sangra al margen */
  font-family: 'Tiempos Headline', serif;
}
```

## 5 patterns para Vértice (síntesis)

1. **Pareja Tiempos Headline + Söhne** sobre crema #F2EAD6
   - Hero: Tiempos Headline Bold 80px desktop / 44px mobile, line-height 1.0, letter-spacing -0.025em
   - Body/UI: Söhne 16-18px, line-height 1.55, max-width 64ch
   - Dorado solo en first-key visual y active state

2. **Hairlines crema-friendly al 8% ink**
   - `1px solid rgb(15 14 14 / 0.08)` separadores
   - Sustituye sombras
   - Cards sin border default, hairline al hover

3. **Números fintech: tabular + ss01**
   - Toda métrica/monto/% en `.numeric`
   - Body en `oldstyle-nums` para no romper ritmo lector
   - Söhne ss01 activado para `a` alternativa

4. **Drop cap en hero + pull-quote editorial**
   - Primera pregunta de cada bloque: `initial-letter: 3 2` color dorado oscuro
   - Citas regulatorias CNBV como pull quote serif italic 32px

5. **Page transitions nativas + grid 7-5**
   - `@view-transition { navigation: auto; }` con crossfade 240ms cubic-bezier(0.16,1,0.3,1)
   - Grid `7fr 5fr` (pregunta-héroe izquierda, ayuda contextual derecha en serif italic 16px)
   - Mobile colapsa a stack pero conserva max-width 28rem
