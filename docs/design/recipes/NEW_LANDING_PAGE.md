# Recipe: New landing page

Paso a paso para crear una página landing nueva siguiendo el design system Wave 1.

## Setup

Estructura mínima de un page nuevo (ej. `app/about/page.tsx`):

```tsx
import { Section } from '@/components/landing/Section';
import { Stack } from '@/components/landing/Stack';
import { Eyebrow } from '@/components/landing/Eyebrow';
import { Hairline } from '@/components/landing/Hairline';
import { Button } from '@/components/landing/Button';
import { Card } from '@/components/landing/Card';
import { Atmosphere } from '@/components/landing/Atmosphere';

export default function AboutPage() {
  return (
    <main className="bg-ink text-cream-pure">
      {/* Hero */}
      <Section paddingY="hero" surface="ink" id="hero" className="relative">
        <Atmosphere variant="both" />
        <Stack gap="default" className="relative">
          <Eyebrow tone="muted">Acerca de</Eyebrow>
          <h1 className="text-hero">
            Una alianza<br />
            <span className="text-gold-deep">con propósito.</span>
          </h1>
          <p className="text-body-lg text-cream-pure/72 max-w-[52ch]">
            Subhead que describe la propuesta.
          </p>
          <div className="flex gap-3 mt-4">
            <Button variant="primary">CTA principal</Button>
            <Button variant="ghost">Acción secundaria</Button>
          </div>
        </Stack>
      </Section>

      {/* Sección de contenido */}
      <Section paddingY="default">
        <Card variant="manifest" atmosphere>
          <Stack gap="loose">
            <Eyebrow>Sección · 01</Eyebrow>
            <h2 className="text-h2">Tu título de sección aquí.</h2>
            <Hairline tone="cream" />
            <p className="text-body text-cream-pure/72">Contenido...</p>
          </Stack>
        </Card>
      </Section>
    </main>
  );
}
```

## Checklist

- [ ] Wrapper `<main className="bg-ink text-cream-pure">`.
- [ ] Hero: `<Section paddingY="hero" className="relative">` + `<Atmosphere />`.
- [ ] H1 usa `.text-hero`, H2 usa `.text-h2`, H3 usa `.text-h3`.
- [ ] Eyebrows usan `<Eyebrow>` (nunca markup ad-hoc font-mono uppercase).
- [ ] CTAs usan `<Button variant="primary|ghost">`.
- [ ] Cards manifest usan `<Card variant="manifest" atmosphere>`.
- [ ] Dividers usan `<Hairline>` (nunca `<div className="h-px ..." />`).
- [ ] Stack gaps usan `gap="tight|default|loose|section"`.
- [ ] NO usar `bg-[#0A0F1C]` literal, usar `bg-ink`.
- [ ] NO usar `cubic-bezier(...)` inline, usar `var(--ease-*)` o `easings.*`.
- [ ] NO usar `{ stiffness: ..., damping: ... }` inline, usar `springs.*`.
- [ ] Si necesitas color brand desde JS: `import { brand } from '@/lib/design-system/tokens'`.

## Important note: `<main>` con container

Si tu `<main>` ya tiene `mx-auto max-w-[1480px]` (como `app/page.tsx`), entonces dentro de `<main>` NO uses `<Section containerSize="default">` (doble container). Usa `<Section containerSize="full">` o construye sin Section.

Alternativa: si tu page nueva no tiene container en `<main>`, deja que cada `<Section>` aplique su `containerSize` standard.

## Anti-patterns comunes

- `<section className="bg-[#0A0F1C] py-24">` → `<Section paddingY="default">`.
- `<h1 className="text-[46px] sm:text-[64px] lg:text-[108px] font-medium">` → `<h1 className="text-hero">`.
- `<button className="rounded-full bg-cream-pure h-12 ...">` → `<Button variant="primary">`.
- Iconos: usa siempre Lucide (Wave 1). Para iconos especiales tipo VertexMark, no inventar — discutir antes.
