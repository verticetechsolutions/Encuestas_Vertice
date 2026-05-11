# Icon tokens

Source: `app/design-system/tokens.css` (Wave 2). Wrapper en `components/{landing,entrevista}/Icon.tsx`.

## Library: Lucide-only (ADR-004 final, Wave 2)

Wave 2 cementó la decisión: **Lucide-only** para iconografía. Razones:
- Tree-shakeable + ya está en bundle.
- Strokes consistentes.
- Cubre 99% de los casos.
- Casos brand-y (V mark, success glyph) tienen sus propios SVG inline en `components/landing/`.

Si surge necesidad de icono que Lucide no tenga: (a) elegir el más cercano disponible, (b) si realmente no encaja, discutir antes de agregar otra library.

## Size tokens

| Token | Value |
|---|---|
| `--icon-sm` | `14px` |
| `--icon-md` | `18px` |
| `--icon-lg` | `24px` |
| `--icon-xl` | `32px` |

## Stroke tokens

| Token | Value | Uso |
|---|---|---|
| `--icon-stroke` | `2` | Default — todos los casos normales |
| `--icon-stroke-thin` | `1.5` | Iconos decorativos/delicados |
| `--icon-stroke-bold` | `2.5` | Arrows nav, ChevronRight prominentes |

## API: `<Icon>` wrapper

```tsx
import { Icon } from '@/components/landing/Icon';  // or @/components/entrevista/Icon
import { ArrowRight } from 'lucide-react';

<Icon icon={ArrowRight} size="md" stroke="default" />
<Icon icon={ArrowRight} size="lg" stroke="bold" className="text-gold" />
```

Props:
- `icon`: LucideIcon (required)
- `size`: 'sm' | 'md' | 'lg' | 'xl' (default 'md')
- `stroke`: 'thin' | 'default' | 'bold' (default 'default')
- `className`: para colors o overrides ad-hoc
- `aria-hidden`: default true (cambiar solo si el icono es semánticamente significativo)

## Reglas

- **NUNCA `<ArrowRight strokeWidth={2} className="size-4" />` directo en componentes consumidores**. Usar `<Icon icon={ArrowRight} />`.
- **Excepción**: dentro de los primitivos del design system (Button.tsx ya tiene `<Icon />` inline porque es parte del API del Button). Pero en código que CONSUME Button, usa `<Icon>`.
- Para iconos brand-y custom (VertexMark, BrandSuccessGlyph): NO usar `<Icon>` — esos viven en `components/landing/` como componentes propios con sus SVGs.
