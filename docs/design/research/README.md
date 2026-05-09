# Vértice · Design Research (Mayo 2026)

Investigación de patrones de diseño para refinar la UI de `/preview/ui` (entrevista guiada bancos/financieras). Realizada el 2026-05-08 con 5 agentes en paralelo + browse manual en awwwards.com.

## Objetivo

Identificar patrones de diseño dominantes en mayo 2026 entre frontier tech / fintech / editorial / Apple-school para informar la nueva UI de la encuesta. La paleta cementada de Vértice (`ink #0A0F1C` + `cream-pure #F4F1EA` + `gold #C8A864`) ya está alineada con el cluster ganador del año.

## Fuentes

| # | Dominio | Fuentes principales |
|---|---|---|
| **01** | [Frontier fintech & B2B SaaS](./01-frontier-fintech.md) | Stripe, Mercury, Ramp, Linear, Vercel, Brex, Arc, Raycast, Railway, Modal |
| **01b** | [Frontier fintech extras](./01b-frontier-fintech-extras.md) | TWK Lausanne+Burgess (Ramp), Modal palette, Linear granularidad |
| **02** | [Apple-school minimalism](./02-apple-minimalism.md) | apple.com (Vision Pro, Privacy, Newsroom), Anthropic, Arc, Things, Notion, Amie, Raycast, Nothing |
| **02b** | [Apple-school v2](./02b-apple-minimalism-v2.md) | Anthropic playbook 1:1, double-grammar buttons, anti-banlist guardrails |
| **03** | [Editorial / serif-led](./03-editorial-serif.md) | Stripe Press, Pitchfork, Stratechery, Substack, It's Nice That, AIGA, Are.na, NYT Cooking |
| **03b** | [Editorial serif v2](./03b-editorial-serif-v2.md) | 8 fonts serif premium, OpenType, drop caps, hairlines |
| **04** | [Microanimaciones & motion](./04-motion-2026.md) | GSAP, Framer Motion, Lenis, Linear /changelog, Codrops 2026, View Transitions API |
| **05** | [Awwwards SOTD/SOTM](./05-awwwards-may-2026.md) | Top 12 SOTD mayo 2026, patterns ganadores, fonts dominantes, banlist confirmado |
| **06** | [Browse manual](./06-manual-browse-observations.md) | Studio Namma (SOTD May 8) + Marvell Tile & Stone (SOTD May 7) en vivo |

## Síntesis

→ **[MASTER_PATTERNS_CATALOG.md](./MASTER_PATTERNS_CATALOG.md)** — catálogo prescriptivo con tokens, código y action plan priorizado.

## Convergencias unánimes (las 5 fuentes coinciden)

1. **Paleta**: warm cream + near-black ink + 1 acento sparingly. Cero gradientes purple→blue. Cero `#000`. Cero `#FFFFFF` (siempre off-white warm).
2. **Tipografía**: pareja serif display + sans humanist. `font-variant-numeric: tabular-nums` obligatorio en fintech.
3. **Spacing**: 8px grid. Section padding-y 96-128px desktop / 48-64px mobile. Whitespace target 50-60%.
4. **Motion**: easings ganadores `cubic-bezier(0.16, 1, 0.3, 1)` + `cubic-bezier(0.32, 0.72, 0, 1)`. View Transitions API es la dirección 2026.
5. **Componentes**: cards son la EXCEPCIÓN, no default. Hairlines `rgba(ink, 0.06-0.10)` reemplazan `shadow-lg`.

## Banlist mayo 2026 (confirmado)

- Gradientes purple→blue genéricos
- Glassmorphism v1 (frosted UI panels)
- Cursor blobs / cursor-following gradients
- Custom cursor + magnetic buttons en B2B
- Full-bleed video heroes auto-play
- Inter como única familia
- Bento idéntico 4-6 cards uniformes
- Lucide-only icons
- Lazy minimalism (todo blanco + Inter + rounded-2xl)
- Y2K nostalgia
- AI-slop (gradient orbs auto-generados)
- "Trusted by" gray logo strips

## Tipografías premium identificadas

| Familia | Foundry | Aplicación |
|---|---|---|
| Söhne / Söhne Mono / Söhne Breit | Klim Type Foundry | Stripe, baseline UI fintech |
| Tiempos Headline / Tiempos Text | Klim | Display editorial |
| GT Sectra | Grilli Type | Editorial high-contrast |
| ABC Diatype | Dinamo | Neo-grotesque pantalla |
| PP Neue Montreal | Pangram Pangram | Ubicuo SOTD |
| PP Editorial New | Pangram Pangram | Display serif quirky |
| Aeonik Pro | CoType | Sans contemporáneo (Revolut) |
| Martina Plantijn | Commercial Type | Robinhood headlines |
| Geist Sans / Mono | Vercel | Custom para devs |
| Inter Variable | Rasmus Andersson | Linear (custom letter-spacing px-based) |
| Arcadia | Custom Mercury | B2B luxury banking |

## Sites reference 1:1 para Vértice

1. **Mercury** (mercury.com) — B2B fintech luxury editorial
2. **Marvell Tile & Stone** (marvellco.com.au) — paleta cream + ink + dorado natural 1:1
3. **Stripe Press** (press.stripe.com) — restraint editorial fintech con Söhne + serif
4. **Anthropic** (anthropic.com) — cream warm + coral CTA + dark navy
5. **Linear /method** (linear.app/method) — manifiesto numerado con prosa + hairlines
6. **Robinhood** (robinhood.com) — abandona fintech rainbow, mono + 1 acento electric
7. **GQ The Extraordinary Lab** — magazine-scroll editorial = entrevista guiada
