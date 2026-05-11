# Radius tokens

Source: `app/design-system/tokens.css` (Wave 2).

## Scale

| Token | Value | Uso |
|---|---|---|
| `--radius-sm` | `8px` | Inputs, tags pequeños, chips internos |
| `--radius-md` | `12px` | Small cards, buttons cuadrados, compact variants |
| `--radius-card` | `18px` | Card default, surface-1/surface-2 entrevista |
| `--radius-section` | `28px` | Manifest section, hero cards prominentes |
| `--radius-pill` | `9999px` | CTAs (primary, ghost), header CTA, chips redondos |

## Reglas

- **NUNCA literales `rounded-[18px]` en componentes nuevos**. Usar `rounded-[var(--radius-card)]`.
- **`rounded-full` es OK pero menos explícito que `rounded-[var(--radius-pill)]`**. Para componentes design-system preferí el token.
- Si un componente necesita un radius custom (ej. `rounded-[42px]` para un asset hero), no inventar token — mantenlo inline con comentario `// hero-specific, no se reusa`.

## API

- `<Card variant="default">` → `--radius-card`
- `<Card variant="manifest">` → `--radius-section`
- `<Card variant="compact">` → `--radius-md`
- `<Button>` → `--radius-pill`
