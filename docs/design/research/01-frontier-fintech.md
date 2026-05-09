# Agent 01 — Frontier fintech & B2B SaaS (May 2026)

## Sites analizados
- Stripe (stripe.com, stripe.press, /atlas, /payments)
- Mercury (mercury.com)
- Ramp (ramp.com)
- Brex (brex.com)
- Linear (linear.app, /method, /now)
- Vercel (vercel.com / Geist)
- Railway (railway.com)
- Arc (arc.net) + The Browser Company
- Raycast (raycast.com)
- Amie (amie.so)

## Top 10 patterns para Vértice

1. **Mercury body line-height 1.625** + labels 12px `letter-spacing: 0.5px` uppercase. Editorial breathing room. Mapear a `text-ink/85` body sobre crema.
2. **Linear px-based letter-spacing scale** (-0.22 a -0.10px) en hero serif. Stops "AI-stiff" rendering en sizes grandes.
3. **Vercel aggressive 96-128px section padding** + 8px grid (4/8/12/16/24/32/48/64/96/128). Cada pregunta = una página.
4. **Arc concentric radius formula**: outer = inner + padding. Question card 16px → input 8px → padding 8px. Cohesion sin rounded-2xl en todo.
5. **Hairline borders > shadows** (Linear, Stripe, Mercury): 1px `rgba(ink, 0.06-0.08)`. Adiós shadow-lg.
6. **jakub.kr composite shadow** (solo en active question card): 3-layer stack 6%/6%/4%, hover 8%/8%/6%. Premium sin peso.
7. **Mercury button transition**: 0.2s ease, swap CTA shadow `0 0 24px rgba(gold, 0.25)` → `0 0 32px rgba(gold, 0.40)` en hover. Reemplaza opacity-80.
8. **Stagger entrance** 80ms entre fields, 600-800ms total, cubic-bezier(0.16,1,0.3,1) (out-expo) o cubic-bezier(0.25,0.46,0.45,0.94). Lenis ya lo maneja, tie GSAP ScrollTrigger para reveal.
9. **`font-variant-numeric: tabular-nums` everywhere**: count "12 de 54", currency, todos los números answer.
10. **Section eyebrow as kicker**: 11-12px, `letter-spacing: 0.08em`, uppercase, gold accent. "IDENTIDAD · 1 de 6". Reemplaza section header decorativo.

## Datos críticos
- **Negative-space target**: 55-65% pixel ratio empty (Stripe/Linear benchmark). Vértice actual probablemente <45%. Acción: widening gutter a 80-120px, cap form max-width a ~620px.
- **Mercury Arcadia**: H1 45px / weight 480 / line-height 50px. Body 1.625. Balance display 28px / weight 500 / -0.5px tracking.
- **Linear scale completo**: 10/11/12/13/14/15/16/17/20/24/32/48/64/72px, weights 300/400/510/590.
- **Stripe Press usa Tiempos Headline**. Confirmación de que serif editorial funciona en fintech serio.
- **Ramp accent neon `#E1FF60`-ish**: defies navy-fintech default. Argumento para mantener gold, no irse a azul.
- **Anthropic + Mercury usan tabular numerals**: signature de fintech credibility.

## Tipografías premium identificadas
- Söhne / Söhne Mono / Söhne Breit (Stripe)
- Tiempos Headline (Stripe Press) — confirma serif editorial fintech
- Arcadia / ArcadiaDisplay (Mercury, custom)
- Ramp Grotesk (Ramp, ABC Diatype-derived)
- Geist Sans / Geist Mono (Vercel)
- Inter Variable (Linear)

## Patterns concretos copy-pasteable
```css
/* Active question card shadow (jakub.kr stack) */
box-shadow:
  0 0 0 1px rgba(15, 14, 14, 0.06),
  0 1px 2px -1px rgba(15, 14, 14, 0.06),
  0 2px 4px 0 rgba(15, 14, 14, 0.04);

/* Hover state */
box-shadow:
  0 0 0 1px rgba(15, 14, 14, 0.08),
  0 2px 4px -1px rgba(15, 14, 14, 0.08),
  0 4px 8px 0 rgba(15, 14, 14, 0.06);

/* Tabular nums */
font-variant-numeric: tabular-nums;

/* Letter-spacing scale (Linear) */
--tracking-display: -0.22px;
--tracking-h1: -0.18px;
--tracking-h2: -0.15px;
--tracking-h3: -0.13px;
--tracking-body: -0.11px;
--tracking-caption: -0.10px;

/* Easing tokens */
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
--ease-jakub: cubic-bezier(0.25, 0.46, 0.45, 0.94);
```
