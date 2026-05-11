# Type tokens

Source: `app/design-system/type.css` (scale + utilities) + `tokens.css` (font families).

## Familias

- **Display** (`--font-display`): General Sans (Fontshare). Hero, h2, h3.
- **Sans** (`--font-sans`): Satoshi (Fontshare). Body, captions, eyebrows.

Cargadas vía `app/layout.tsx` preconnect a `api.fontshare.com`.

## Type scale

| Token / Class | Size | Line-height | Tracking | Weight | Uso |
|---|---|---|---|---|---|
| `--type-hero` · `.text-hero` | `clamp(46px, 7.4vw, 108px)` | `0.95` | `-0.03em` | 500 | Landing H1 |
| `--type-display` · `.text-display` | `clamp(34px, 4.8vw, 64px)` | `1.05` | `-0.03em` | 600 | Hero pregunta, H1 secondary |
| `--type-h2` · `.text-h2` | `clamp(28px, 3.6vw, 46px)` | `1.05` | `-0.022em` | 500 | Sección, manifest |
| `--type-h3` · `.text-h3` | `clamp(20px, 2.4vw, 28px)` | `1.15` | `-0.02em` | 600 | Card title |
| `--type-body-lg` · `.text-body-lg` | `17px` | `1.55` | — | 400 | Hero subhead |
| `--type-body` · `.text-body` | `15.5px` | `1.55` | — | 400 | Body default |
| `--type-caption` · `.text-caption` | `13px` | `1.5` | — | 400 | Meta |
| `--type-eyebrow` · `.text-eyebrow` | `10.5px` | `1` | `0.32em` | 500 | Microcaps |

## Cuándo usar qué

- Landing hero H1 → `.text-hero`
- Hero pregunta entrevista → `.text-display` (más conservador que .text-hero)
- Section title → `.text-h2`
- Card title → `.text-h3`
- Subhead bajo H1 → `.text-body-lg`
- Body párrafo → `.text-body`
- Metadata pequeña → `.text-caption`
- "M02 · PRODUCTO" → `<Eyebrow tone="muted">` (consume `.text-eyebrow`)

## OpenType features activadas globalmente

`body { font-feature-settings: "ss01", "cv11"; }` — alternates de Satoshi.

Para tabular numerics (counters, percentages): añadir clase `.numeric` (definida en globals.css).
