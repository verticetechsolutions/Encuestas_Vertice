# CLAUDE.md — Vértice Encuesta

Este archivo lo lee Claude Code automáticamente al abrir el repo. Reglas y referencias específicas del proyecto. Reglas globales del usuario están en `~/.claude/CLAUDE.md` (no las repito acá).

---

## ⛳ Primera regla, no negociable

**Antes de hacer cualquier cosa en este repo, lee `STATUS.md`.** Es la source of truth del proyecto: en qué fase estamos, qué falta para producción, qué bugs están abiertos, qué deuda técnica existe. Después de leer STATUS, lee la última entrada de `CHECKPOINTS.md` para saber qué se hizo en la sesión anterior.

Sin haber leído STATUS, no contestes ni siquiera preguntas tipo "¿cómo va el proyecto?". Cualquier respuesta sin STATUS está mal-informada por construcción.

---

## Documentos canónicos (orden de autoridad)

1. **`STATUS.md`** — estado del proyecto, % completado, qué falta para producción, deuda técnica resumen, bugs documentados, convención.
2. **`CHECKPOINTS.md`** — log de sesiones, entrada más reciente arriba.
3. **`IMPLEMENTATION.md`** — contrato técnico de las 10 fases del MVP. Si hay duda técnica sobre una fase, este doc gana.
4. **`docs/DEUDA_TECNICA.md`** — registro vivo de deuda técnica con archivo:línea, impacto, criterio de cierre y esfuerzo. 14 items priorizados.
5. **`docs/design/DESIGN_SYSTEM.md` + `docs/design/tokens/*`** — Design System vivo (tokens, recipes, research). Cualquier UI nueva debe espejar estos tokens.

Todo lo demás en `docs/archive/` es histórico no canónico.

---

## Loop obligatorio de toda sesión

1. **Al empezar:**
   - Leer `STATUS.md` entero.
   - Leer última entrada de `CHECKPOINTS.md`.
   - Si la tarea toca código de una fase, leer la sección correspondiente en `IMPLEMENTATION.md`.
   - Si la tarea es cerrar deuda, leer el item en `docs/DEUDA_TECNICA.md`.
2. **Durante:**
   - Si descubres bloqueante nuevo, item de deuda, o cambio de estado: **actualiza `STATUS.md` inmediatamente**. No esperes al final.
   - Si tocas UI, sigue los tokens del DS (`docs/design/tokens/*`). Ni colores hardcoded ni `style={{...}}` inline.
3. **Al cerrar:**
   - Agregar entrada nueva en `CHECKPOINTS.md` (formato en el header de ese doc, entrada más reciente arriba).
   - Mover de CHECKPOINTS a STATUS los items que dejaron de ser snapshot de sesión y pasaron a ser estado canónico.
   - Si cerraste deuda técnica: marcar `[x]` en `docs/DEUDA_TECNICA.md` con commit hash + bajar el item en `STATUS.md` §4.

**Nunca crees un doc paralelo de progreso** (alpha-readiness-X, smoke-Y, handoff-Z, etc.). Si la info es perenne, va en STATUS o DEUDA. Si es snapshot, va en CHECKPOINTS. Si es contrato técnico, va en IMPLEMENTATION. No hay un cuarto lugar.

---

## Stack rápido (resumen, detalle en `README.md`)

- Next.js 15 App Router + React 19 + TypeScript estricto
- Tailwind v4 + shadcn/ui (canary) + componentes custom
- Vercel AI SDK + `@anthropic-ai/sdk` (Sonnet 4.6 director + Opus 4.7 reviewer/synthesis)
- Deepgram Nova-3 Multilingual `es-419` streaming
- Drizzle ORM + Neon Postgres + pgvector
- Auth.js v6 (Google SSO admin) + magic links Resend (entrevistados)
- Inngest (síntesis final asíncrona)
- Upstash Redis (rate-limit distribuido, code-complete con fallback in-memory)
- Sentry + Axiom (observabilidad)
- Vitest + Playwright (testing)
- Biome (lint/format)

---

## Convenciones del proyecto

- **Idioma:** UI visible al usuario y mensajes de error en español MX. Comentarios y nombres de función en inglés.
- **Em-dashes:** prohibidos en prompts del modelo (regla cementada en system prompts de Sonnet/Opus). En código y docs, mismo criterio del usuario global.
- **Secrets:** `.env.local` y `.env.example` están **trackeados** intencionalmente. Si ves `.env*` comentado en `.gitignore`, es a propósito. No descomentarlo, no rotar, no alertar.
- **Tests:** suite vive en `vitest`. Integration tests usan `DATABASE_URL_TEST` (separada de la principal — los tests truncan). Nunca apuntar tests a la DB principal.
- **Magic links entrevistados:** flujo real vive en tabla `magic_tokens` (Fase 4, migración 0001). Columnas `instituciones.magic_link_token*` están muertas (migración 0004 las dropeó).
- **STT keyterms:** lista cementada en `lib/stt/client.ts:STT_KEYTERMS`. Cualquier acrónimo regulatorio MX que veas mal-transcribido se agrega ahí + test regression guard.
- **Rate limit:** unificado en `lib/security/rate-limit.ts`. Async. Cae a in-memory si Upstash no está provisionado (no romper).
- **Admin SSO:** `VERTICE_ADMIN_DOMAINS` env controla qué dominios Google pueden loguear. Audit log en tabla `usuarios_admin_audit`.

---

## Cómo verificar antes de cerrar tarea

```powershell
# Tests
npx vitest run

# Typecheck
npx tsc --noEmit

# Build prod
npx next build
```

Si tocaste UI: validar visualmente en `localhost:3000` usando **Claude Chrome** (`mcp__claude-in-chrome__*`), no solo inspección de JSX. Reglas globales del usuario lo exigen.

---

## Setup rápido en compu nueva

```bash
git clone git@github.com:verticetechsolutions/vertice.git Vertice_Encuesta
cd Vertice_Encuesta
git pull origin master
npm install
# .env.local YA viene trackeado (decisión multi-machine dev)
npm run dev  # :3000 (Turbopack)
```

Si `:3000` está ocupado, Next arranca en `:3001` automáticamente.

Institución demo:
- ID: `930b78e0-8323-45a9-85de-2d4fc76594cb` (Banco Demo Vertice SA)
- Generar magic link: `/admin/instituciones/930b78e0-...` → "Generar URL".

---

## Cuándo NO actualizar STATUS / CHECKPOINTS

- Tareas exploratorias de lectura pura (entender código, debuggear sin cambiar nada).
- Preguntas conversacionales del founder.
- Cambios triviales de formato/typo que no afectan estado ni fase.

Para todo lo demás: actualiza.
