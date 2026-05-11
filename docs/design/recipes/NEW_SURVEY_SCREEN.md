# Recipe: New survey screen

Paso a paso para crear una pantalla nueva dentro del flow de entrevista.

## Setup

```tsx
import { Section } from '@/components/entrevista/Section';
import { Stack } from '@/components/entrevista/Stack';
import { Eyebrow } from '@/components/entrevista/Eyebrow';
import { Hairline } from '@/components/entrevista/Hairline';
import { Button } from '@/components/entrevista/Button';
import { Card } from '@/components/entrevista/Card';
import { Icon } from '@/components/entrevista/Icon';

export default function NewScreen() {
  return (
    <Section surface="bg" paddingY="default">
      <Stack gap="loose">
        <Eyebrow tone="muted">P07 · Pricing y criterio</Eyebrow>
        <h2 className="text-display">
          ¿Cuál es tu tasa promedio<br />en créditos personales?
        </h2>
        <p className="text-body text-[var(--survey-text-72)] max-w-[52ch]">
          Contexto u orientación para responder.
        </p>

        <Card variant="surface-2">
          <textarea className="w-full bg-transparent text-body text-[var(--survey-text)] focus:outline-none" />
        </Card>

        <Hairline tone="ink" />

        <div className="flex justify-between items-center">
          <Button variant="ghost">Atrás</Button>
          <Button variant="primary">Siguiente</Button>
        </div>
      </Stack>
    </Section>
  );
}
```

## Checklist

- [ ] Wrapper `<Section surface="bg">` (off-white) o `<Section surface="surface">` (white pure) según contexto.
- [ ] Hero pregunta usa `.text-display` (NO `.text-hero` — entrevista es más conservadora).
- [ ] Eyebrow para meta info ("P07 · GRUPO"): `<Eyebrow tone="muted">` o `tone="gold"` para acento.
- [ ] Body con `text-[var(--survey-text-72)]`, NUNCA `text-ink/70` (no es el mismo valor).
- [ ] Card workspace (textarea container) → `<Card variant="surface-2">`.
- [ ] Card brand moment (dark pocket) → `<Card variant="surface-1">`.
- [ ] CTAs usan `<Button variant="primary|ghost">`.
- [ ] Dividers usan `<Hairline tone="ink">` (NO `border-ink/8`).
- [ ] Si quieres `gold` acento sobre cream surface, USA `text-gold-deep` (`gold` falla AA contrast on white).
- [ ] Iconos usan `<Icon icon={X} size="md|sm|lg|xl" stroke="default|thin|bold" />`. Nunca strokeWidth/size literal.

## Heads-up para componentes complejos (per ADR-006)

Componentes con framer-motion choreography custom (como `HeroPregunta.MarcarButton`, `BatchNav` text-link nav) NO usan el Button primitive. Tienen sus propios spring rigs y design intent. NO los refactorices para usar primitives — son su propia variant.

Los primitives son para pantallas NUEVAS y patrones repetitivos. Si te ves duplicando un primitive ≥3 veces en pantallas distintas con styling idéntico, ese es el patrón para promoter al primitive.

## View transitions y animations

Si la pantalla está dentro del flow de entrevista que usa view transitions:
- El elemento que cross-fade debe tener `style={{ viewTransitionName: 'question-card' }}`.
- Las anims locales (Framer Motion `<motion.div>`) son OK pero NO duplicar reduced-motion guards (ya global).
- Si necesitas animar la entrada del card, usa `transition={springs.elegant}` o `transition={{ duration: dur.layout, ease: easings.outExpo }}`.

## Anti-patterns comunes

- `<h2 className="text-[34px] sm:text-[64px] font-semibold">` → `<h2 className="text-display">`.
- `<button className="rounded-full bg-ink text-cream h-12 ...">` → `<Button variant="primary">`.
- `text-gold` sobre fondo cream → `text-gold-deep`.
- `bg-white` literal → `<Card variant="surface-2">` o `bg-[var(--survey-surface)]`.
