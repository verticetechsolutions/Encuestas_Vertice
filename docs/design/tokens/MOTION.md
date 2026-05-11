# Motion tokens

Source: `app/design-system/motion.css` (CSS) + `lib/design-system/motion/*.ts` (TS).

## Durations

| Token | CSS var | TS (seconds) | TS (ms) | Uso |
|---|---|---|---|---|
| micro | `--dur-micro` | `dur.micro` (0.16) | `durMs.micro` (160) | Hover, focus, color flip |
| fast | `--dur-fast` | `dur.fast` (0.24) | `durMs.fast` (240) | Small element transitions |
| layout | `--dur-layout` | `dur.layout` (0.38) | `durMs.layout` (380) | Card expand, section change |
| hero | `--dur-hero` | `dur.hero` (0.72) | `durMs.hero` (720) | Hero entrance, big reveals |
| epic | `--dur-epic` | `dur.epic` (1.2) | `durMs.epic` (1200) | Word-mask reveals, char-stagger |

## Easings

| Name | CSS var | TS tuple |
|---|---|---|
| outExpo | `--ease-out-expo` | `easings.outExpo` `[0.16, 1, 0.3, 1]` |
| iosSheet | `--ease-ios-sheet` | `easings.iosSheet` `[0.32, 0.72, 0, 1]` |
| back | `--ease-back` | `easings.back` `[0.34, 1.4, 0.64, 1]` |
| backOut | `--ease-back-out` | `easings.backOut` `[0.34, 1.35, 0.64, 1]` |
| backIn | `--ease-back-in` | `easings.backIn` `[0.36, 0, 0.66, -0.35]` |
| inOut | `--ease-in-out` | `easings.inOut` `[0.65, 0, 0.35, 1]` |
| soft | `--ease-soft` | `easings.soft` `[0.2, 0.85, 0.25, 1]` |

**Default**: `outExpo` para casi todo. `iosSheet` para vertical slide. `back-out` para overshoot reveals. `inOut` para strict draw (SVG stroke). `soft` para text/opacity.

## Spring presets

| Preset | Stiffness | Damping | Mass | Feel |
|---|---|---|---|---|
| `snap` | 520 | 28 | 0.4 | UI inputs, toggles |
| `elegant` | 320 | 22 | 0.55 | Hero CTAs, important reveals |
| `soft` | 380 | 26 | 0.6 | Text, opacity, gentle layout |
| `bounce` | 280 | 14 | 0.5 | Overshoot reveals (success) |
| `indicator` | 360 | 26 | 0.55 | Scroll-driven section indicator |

Import: `import { springs } from '@/lib/design-system/motion/springs';`

## Reglas

- **NUNCA values inline en motion.button**. Si necesitas un spring nuevo, lo agregás a `springs.ts`.
- **NUNCA `cubic-bezier(...)` literal**. Usa `--ease-*` o `easings.*`.
- **prefers-reduced-motion**: cubierto globally en `globals.css` (animations → 0.01ms). NO duplicar locally a menos que el componente tenga estado interno que también querer cancelar (ej. timeouts en HeroPregunta).
