# Vértice

Sistema de entrevista conversacional adaptativa para extraer el credit box de instituciones financieras mexicanas.

> **Contrato del proyecto:** [`IMPLEMENTATION.md`](./IMPLEMENTATION.md). Si hay duda, ese documento gana.

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript estricto
- Tailwind v4 + shadcn/ui (canary)
- Base UI Dialog · Motion · GSAP ScrollTrigger · Lenis smooth scroll (landing)
- Vercel AI SDK + `@anthropic-ai/sdk` (Sonnet 4.6 + Opus 4.7)
- Deepgram Nova-3 Multilingual `es-419` (streaming)
- Drizzle ORM + Neon Postgres + pgvector
- Inngest (síntesis final asíncrona)
- Resend (magic links)
- Sentry + Axiom (observabilidad)

## Quickstart

```bash
# 1. Instalar dependencias (ya hecho en bootstrap)
npm install

# 2. Configurar variables de entorno
cp .env.example .env.local
# editar .env.local con keys reales

# 3. Correr dev server
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Build de producción |
| `npm run start` | Servir el build |
| `npm run lint` | ESLint |

## Estructura

```
app/
├── page.tsx                      Landing pública (default sin link de encuesta)
├── terminos/                     Términos · Privacidad · Cookies
├── (auth)/magic-link/[token]/    Validación magic link
├── entrevista/[sesion_id]/       Entrevista en vivo
├── admin/                         Vista interna Vértice
└── api/                           turn, deepgram proxy, magic-link, inngest

db/
├── schema.ts                     Drizzle schema (Fase 2)
├── seeds/                        matrices, enums, safe rails
└── migrations/                   Generadas por drizzle-kit

lib/
├── prompts/                      System prompts (Sonnet, Opus)
├── schemas/                      Zod schemas (cajas, casos, perfil)
├── motor/                        Mapa de incertidumbre, fatiga, loop
├── llm/                          Wrappers Anthropic
└── observability/                Sentry, Axiom helpers

inngest/functions/                Síntesis final, PDF
components/
├── landing/                      Hero, CTAs, modales, smooth scroll
└── ui/                           shadcn primitives
```

## Landing pública (`/`)

Página default para visitantes sin magic link. Hero editorial con:

- **Selector dual** desde el navbar: modal con dos rutas — *Acceder a mi encuesta* (Google + reenviar magic link) o *Solicitar acceso* (formulario).
- **Manifest** de tres datos clave (formato, duración, entrega) en card minimalista.
- **Marca Vértice** con tilt 3D sobre cursor + scroll triggers GSAP pinning del hero.
- **Smooth scroll** vía Lenis integrado con ScrollTrigger.

Términos / Privacidad / Cookies en `/terminos`. La cookie banner (`CookiesCard`) se monta condicionalmente desde el footer.

## Idioma

- UI visible al usuario: español MX
- Comentarios y nombres de funciones en código: inglés
- Mensajes de error visibles al usuario: español MX
