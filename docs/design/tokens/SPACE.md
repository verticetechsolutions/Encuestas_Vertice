# Spacing tokens

Source: `app/design-system/space.css`.

## Raw scale (4px base)

| Token | Value | Tailwind equiv |
|---|---|---|
| `--space-1` | `4px` | `1` |
| `--space-2` | `8px` | `2` |
| `--space-3` | `12px` | `3` |
| `--space-4` | `16px` | `4` |
| `--space-6` | `24px` | `6` |
| `--space-8` | `32px` | `8` |
| `--space-10` | `40px` | `10` |
| `--space-14` | `56px` | `14` |
| `--space-20` | `80px` | `20` |
| `--space-28` | `112px` | `28` |
| `--space-36` | `144px` | `36` |

Para uso ad-hoc puedes seguir usando Tailwind (`p-6`, `gap-8`). Los tokens son para semantic compositions y arbitrary values.

## Semantic compositions (responsive)

| Token | Value |
|---|---|
| `--section-y` | `clamp(56px, 9vw, 144px)` |
| `--section-padding-x` | `clamp(24px, 4vw, 56px)` |
| `--container-max` | `1480px` |
| `--card-padding` | `clamp(24px, 3vw, 56px)` |

## Stack gaps

| Token | Maps to | Uso |
|---|---|---|
| `--stack-tight` | `--space-2` (8px) | Eyebrow → title |
| `--stack-default` | `--space-6` (24px) | Title → body |
| `--stack-loose` | `--space-10` (40px) | Secciones internas |
| `--stack-section` | `--space-20` (80px) | Entre secciones grandes |

## API

- `<Section paddingY="default">` aplica `py-[var(--section-y)]`.
- `<Section paddingY="hero">` aplica `pt-[clamp(96px,9vw,144px)] pb-[var(--space-20)]`.
- `<Stack gap="loose">` aplica `gap-[var(--stack-loose)]`.
