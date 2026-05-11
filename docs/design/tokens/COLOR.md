# Color tokens

Source of truth: `app/design-system/tokens.css`.

## Brand primitives

| Token | Hex | Uso |
|---|---|---|
| `--ink` | `#0A0F1C` | Landing dark surface, entrevista survey-card-1 |
| `--ink-raised` | `#1A2236` | Hover sobre ink, manifest card bg |
| `--cream-pure` | `#F4F1EA` | Texto sobre ink, landing surface clara |
| `--gold` | `#C8A864` | Acento principal, pills, hairlines |
| `--gold-deep` | `#866D38` | Acento sobre white (AA contrast) |
| `--gold-bright` | `#F2D89C` | Highlight, focus, glow |
| `--gold-light` | `#E0BE7C` | Gradient base de la V mark |
| `--burgundy` | `#8B3A3A` | Error states |

## Reglas por surface

### Landing (surface ink)
- Background: `bg-ink` (`#0A0F1C`)
- Texto primary: `text-cream-pure`
- Texto muted: `text-cream-pure/72`
- Texto faint (eyebrows): `text-cream-pure/45`
- Acento: `text-gold` o `bg-gold` (champagne sobre dark = legible)
- Hairlines: `bg-cream-pure/8` (default) o `bg-cream-pure/20` (strong)

### Entrevista (surface cream)
- Background: `bg-[var(--survey-bg)]` (`#FAF8F4`)
- Surface card: `bg-[var(--survey-surface)]` (`#FFFFFF` workspace) o `bg-[var(--survey-card-1)]` (`#0A0F1C` dark pocket brand)
- Texto primary: `text-ink` (sobre cream) o `text-cream-pure` (sobre survey-card-1)
- Texto muted: `text-[var(--survey-text-72)]`
- Acento: `text-gold-deep` (NOT `text-gold` — gold sobre white falla AA contrast)
- Hairlines: `bg-[var(--survey-hairline)]` (ink/6) o `bg-[var(--survey-hairline-strong)]` (ink/12)

## Legacy (NO usar en código nuevo)
- `--forest`, `--lime`, `--canvas`, `--cream` — solo viven en admin (Fase 9). Wave 3 los limpia de entrevista.
