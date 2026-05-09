# Agent 02b — Apple-editorial minimalism v2 (más detalle)

## Anthropic = playbook 1:1 para Vértice
Anthropic usa **Styrene (display) + Tiempos (body serif) + cream #FAF9F5 + coral CTA + dark navy product**.

Equivalencia para Vértice:
- Cream #F2EAD6 (Vértice) ≈ #FAF9F5 (Anthropic)
- Dorado (Vértice) reemplaza coral (Anthropic) como acento único
- Display serif Vértice puede subir a Tiempos Headline
- Body sans → Söhne / ABC Diatype / Geist

## 5 patrones top con valores exactos

### 1. Pairing serif display + sans humanist
- Display: weight 600-700, letter-spacing **-0.02em a -0.03em**, line-height 1.05
- Body sans: weight 400, line-height 1.5, tracking 0
- Ratio escala: **3.5x-4x** (ej. 56px/16px o 64px/18px)

### 2. Section padding generoso + hairline warm
- Section padding entrevista: **96-128px desktop / 64-80px mobile** (≈12vh)
- Entre pregunta-héroe y opciones de respuesta: **48-64px**
- Hairline crema-friendly: `rgba(15,14,14,0.08)`
- Hairline emphasis: `rgba(15,14,14,0.12)`
- Whitespace target: **45-55%** del viewport

### 3. Botones double grammar
```css
/* Primary CTA: pill dorado */
.btn-primary {
  border-radius: 999px;
  background: var(--gold);
  color: var(--ink);
  padding: 14px 28px;
  transition: 220ms cubic-bezier(0.16, 1, 0.3, 1);
}
.btn-primary:hover {
  transform: translateY(-1px);
  background: color-mix(in oklch, var(--gold), white 8%);
}

/* Secondary: rectangle sutil */
.btn-secondary {
  border-radius: 12px;
  border: 1px solid rgba(15, 14, 14, 0.12);
  color: var(--ink);
}
.btn-secondary:hover {
  background: rgba(15, 14, 14, 0.04);
}

/* Tertiary: text-link */
.btn-tertiary {
  text-decoration-line: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 4px;
  transition: text-decoration-thickness 180ms;
}
.btn-tertiary:hover { text-decoration-thickness: 2px; }
```

Botones de respuesta (entrevista, no CTA): rectangle 12-16px radius, NO pill. Linear-style.

### 4. Microanimaciones Apple-restraint
- Hover/UI feedback: `cubic-bezier(0.16, 1, 0.3, 1)` **180-220ms**
- Layout/section reveal: mismo easing **400-600ms**
- Pregunta-héroe entrada: **640-800ms** out-expo, stagger 40-60ms
- Scroll-triggered: IntersectionObserver threshold 0.2, `once: true`
- Sin scroll-jacking, sin pinning, sin parallax

### 5. Imagery + dividers warm
- Producto/imagen: float sin frame ni shadow
- Iconografía: **Phosphor regular 1.5px** + **Tabler** para fintech specifics. NO solo Lucide.
- Tamaños iconos: 20-24px UI, 32-40px hero accents
- Dividers: whitespace puro entre secciones por default; hairline 1px `rgba(15,14,14,0.08)` cuando necesitas marca visual; NUNCA sombra
- Hero pregunta: dorado underline 2px width 48px debajo del display heading (Anthropic-Linear hybrid)
- Captions/metadata: sans humanist 12-13px, weight 500, color `rgba(15,14,14,0.6)`, uppercase tracking 0.08em

## Anti-banlist guardrails
- Border radius: **8px (chips), 12px (cards), 16px (panels), 999px (pills CTA)**. NUNCA `rounded-2xl` por default.
- Shadow stack válido (cuando hay elevación real): `0 1px 2px rgba(15,14,14,0.04), 0 8px 24px rgba(15,14,14,0.04)` (suma <5% opacity).
- NO `#000`. Usar `#0F0E0E`. Text-secondary `rgba(15,14,14,0.64)`.
- Asimetría 2 columnas: **58/42 o 62/38**, NUNCA 50/50.

## Donde NO copiar
- Gradients pastel (Amie)
- Glass frosted heavy (Raycast)
- Bento monolítico (Notion variants nuevas)
- Inter como única font (Vértice ya NO está aquí, ojo de no caer)
