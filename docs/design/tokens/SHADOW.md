# Shadow tokens

Source: `app/design-system/tokens.css` (Wave 2).

## Hairlines

| Token | Value | Uso |
|---|---|---|
| `--shadow-hairline-ink` | `inset 0 0 0 1px rgb(244 241 234 / 0.06)` | 1px cream hairline sobre ink (landing) |
| `--shadow-hairline-cream` | `inset 0 0 0 1px rgb(10 15 28 / 0.06)` | 1px ink hairline sobre cream (entrevista) |
| `--shadow-gold-seam` | `inset 0 1px 0 rgb(200 168 100 / 0.18)` | Gold seam top edge (manifest cards) |

## Compositions

| Token | Value | Uso |
|---|---|---|
| `--shadow-card-ink` | `inset 0 0 0 1px rgb(244 241 234 / 0.055), inset 0 1px 0 rgb(200 168 100 / 0.18)` | Manifest card (hairline + gold seam) |
| `--shadow-cta-glow` | `0 0 0 1px rgb(244 241 234 / 0.04), 0 30px 70px -20px rgb(200 168 100 / 0.45)` | Landing primary CTA (cream pill on ink, gold glow drop) |
| `--shadow-cta-glow-cream` | `0 0 0 1px rgb(10 15 28 / 0.04), 0 20px 50px -20px rgb(10 15 28 / 0.35)` | Entrevista primary CTA (ink pill on cream, neutral glow) |
| `--shadow-dialog` | `0 30px 90px -20px rgb(0 0 0 / 0.5)` | Modal/dialog elevation |

## Reglas

- **NUNCA literales `shadow-[0_30px_70px...]` en componentes nuevos.**
- Si un shadow no matchea un token, antes de agregarlo discute. Probablemente es over-design.
- Para shadows admin (legacy lime/forest), seguir usando lo que ya está hasta Wave 3 sweep.
