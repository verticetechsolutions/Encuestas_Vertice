# Agent 01b — Frontier fintech extras (additions to agent_01)

## Datos adicionales encontrados en segunda pasada

- **Ramp tipografía**: **TWK Lausanne** (Weltkern, sans) + **Burgess** (Colophon, transitional serif basada en Times). Pareja distinta a lo común.
- **Modal (modal.com)**: green tech minimal, paleta multi-stop verde:
  - `#62DE61` primary
  - `#09AF58` darker
  - `#80EE64` lighter
  - `#BFF9B4` pale
  - `#DDFFDC` text light
  - Multi-stop gradients 3-5 stops, sharp corners, shadows ~10-15%.
- **Linear precision**: 154 estilos tipográficos catalogados, 361 colores de marca catalogados. Ese nivel de granularidad es lo que separa "design system" de "tokens de Tailwind ad-hoc".
- **Vercel shadow tokens**:
  - default: `0 4px 4px rgba(0,0,0,0.02)`
  - medium: `0 8px 30px rgba(0,0,0,0.12)`
- **Mercury shadows fintech-credibility**:
  - CTA glow normal: `0 0 24px rgba(108,92,231,0.3)`
  - CTA glow hover: `0 0 32px rgba(108,92,231,0.45)`
- **Mercury data-display tokens**:
  - Balance: 28px / weight 500 / `letter-spacing: -0.5px` / line-height 1.0
  - H1 hero: 45px / weight 480 / line-height 50px (1.11)
  - Body line-height: 1.625
  - Labels: 12px / `letter-spacing: 0.5px`

## Iconografía: principio de mixing por dominio
- Lucide solo para utility (close, chevron, search) — nada de hero o domain.
- **Phosphor regular weight stroke 1.5px** para iconos de dominio (banco, tarjeta, plazo, montos).
- Custom SVG morphing para hero / data viz / states únicos.

## Asimetría intencional para layout 2-cols
- Form: 58-62%
- Rail: 32-38%
- Cero 50/50.

## OpenType features fintech-critical
```css
/* Para todos los inputs numéricos */
font-feature-settings: "tnum", "lnum"; /* tabular + lining */
font-variant-numeric: tabular-nums lining-nums;
```

## Banlist confirmado mayo 2026 (lo que YA NO usan los frontier sites)
- Cero gradientes purple→blue en UI (Vercel, Linear, Stripe, Mercury todos sin esto).
- Cero rounded-2xl en todo (Vercel arriesga 0px, Stripe 4-8px, Linear 8-12px).
- Cero shadow-lg default (Linear/Stripe/Mercury usan hairline borders + shadows micro).
- Cero `#000` puro (todos en `#0A0A0A`-`#1D1D1F` rango).
- Cero "Get started for free" CTAs (Apple usa "Buy" / Anthropic usa inline arrow).
