# Sprint 2 Upstash · Checkpoint para retomar en otra sesión

**Fecha:** 2026-05-13
**Goal previo:** "Itera continuamente hasta que acabes el sprint 2 del upstash de rate limit."
**Estado:** **Code-complete con fallback. Pendiente provisioning de instancia Upstash real.**

---

## Lo que está hecho ✅

### 1. Rate limiter unificado (`lib/security/rate-limit.ts`)

Refactor completo: usa Upstash Redis cuando hay credenciales, fallback in-memory
token-bucket cuando no. **Funciona hoy mismo sin Upstash** porque el fallback
mantiene el comportamiento anterior.

Cambios clave:

- `checkRateLimit(key, config)` ahora es **async** (Upstash es REST). Los 4
  call sites ya están actualizados con `await`:
  - `app/api/turn/route.ts` (×2: IP + sesión)
  - `app/api/stt/token/route.ts`
  - `app/actions/adminAuth.ts`
  - `app/(auth)/acceso/[token]/route.ts`
- Detección Upstash via env: si `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
  están set → usa `Ratelimit.tokenBucket` de `@upstash/ratelimit`.
- Sin esos env vars → cae al `checkRateLimitInMemory` que es el código original.
- Si Upstash falla en runtime (red caída) → degrada a in-memory con `console.warn`
  (availability > strict limit).
- Cache de `Ratelimit` instances por `${capacity}:${refillRate}:${intervalSec}`
  para que call sites con la misma config compartan instance (recomendación
  oficial de Upstash).
- `_resetRateLimitState()` limpia ambos (buckets + ratelimitCache + upstashRedis).
- `RATE_LIMITS` configs y `getClientIp` sin cambios.

### 2. Deps instaladas

```
@upstash/ratelimit: ^2.0.8
@upstash/redis:     ^1.38.0
```

### 3. Tests

- `lib/security/rate-limit.test.ts` actualizado a async (todos los `checkRateLimit(...)` con `await`).
- 20/20 verde.
- Suite completa: **439/439 verde**, typecheck limpio.

### 4. Mejoras laterales no-Sprint-2 (committed earlier en esta sesión)

- `middleware.ts`: cookie gate del admin acepta `__Secure-vertice_auth`,
  `vertice_auth` (Auth.js) además del legacy `vertice_admin`. Sin esto, el
  flow Google SSO entra en loop de redirect.
- `app/(auth)/acceso/expirado/page.tsx`: añadidos mensajes UX en español
  para razones del callback Auth.js (`sin_email`, `email_no_verificado`,
  `dominio_no_permitido`, `error_interno`).
- `lib/env.ts`: campo `AUTH_URL` opcional (Auth.js v6 usa esto en prod para
  computar el redirect_uri; en dev se auto-detecta).
- `.env.example`: documentación de `AUTH_URL`.

---

## Lo que falta ❌ — para terminar en próxima sesión

### Paso A — Provisionar Upstash Redis (3 minutos, requiere tu mano)

**Por qué no lo hice yo:** crear cuenta Upstash en tu nombre cae bajo
"no crear cuentas en tu nombre" de mis safety rules.

1. Ir a https://console.upstash.com/
2. "Continue with Google" → usar `verticetechsolutions@gmail.com`.
3. Si te pide aceptar ToS Upstash, aceptar tú.
4. Crear database Redis:
   - **Name:** `vertice-ratelimit`
   - **Type:** Regional (o Global si quieres baja latencia multi-región)
   - **Region:** la más cercana a Vercel deployment (`us-east-1` si Neon
     está en Virginia, que es lo actual).
   - **TLS:** habilitado.
   - **Eviction:** allkeys-lru o ninguna (no importa para rate-limit; las
     keys expiran solas).
   - **Plan:** Free tier (10K commands/day suficiente para pre-alpha).
5. Database creada → tab **Details** o **REST API**:
   - Copiar `UPSTASH_REDIS_REST_URL` (formato: `https://<id>.upstash.io`).
   - Copiar `UPSTASH_REDIS_REST_TOKEN` (string largo base64-like).

### Paso B — Pegar credenciales en `.env.local`

Agregar al final del archivo:

```bash
# Upstash Redis para rate limit distribuido (Sprint 2 security audit 2026-05-12).
# Sin estas vars, el rate-limit cae al fallback in-memory que NO funciona
# correctamente en Vercel serverless multi-instance.
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Pegar los valores reales.

### Paso C — Verificar en runtime

```bash
npm run dev
# en otra terminal o tab Chrome:
# curl o request POST /api/turn con un body válido y cookie correcta.
# Repetir 31 veces consecutivas (cap turnPerSesion=30/min).
# La 31ª debe devolver 429 rate_limited.
# Esperar 2s → Redis está compartiendo state entre instancias.
```

O un smoke script más simple — crear `scripts/smoke_ratelimit.mjs`:

```js
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import { config } from 'dotenv';
config({ path: '.env.local' });

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});
const rl = new Ratelimit({
  redis,
  limiter: Ratelimit.tokenBucket(3, '60 s', 3),
});

for (let i = 0; i < 5; i++) {
  const r = await rl.limit('smoke-test');
  console.log(i, r.success, 'remaining:', r.remaining);
}
```

Esperado: `0 true 2 / 1 true 1 / 2 true 0 / 3 false 0 / 4 false 0`.

### Paso D — Documentar + commit final

Una vez verificado:

1. Agregar `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` a `.env.example`
   con doc (ya tienes la base en el bloque arriba).
2. Agregar las dos vars al schema `lib/env.ts` como **optional**:
   ```ts
   UPSTASH_REDIS_REST_URL: z.string().url().optional(),
   UPSTASH_REDIS_REST_TOKEN: z.string().min(10).optional(),
   ```
3. Marcar tareas `#15` y `#18` como completed en el task list de la sesión nueva.
4. Commit + push.

### Paso E (futuro, no-bloqueante) — Cobertura ampliada

Después de validar Upstash funciona, considerar:

- Aplicar rate-limit a `/admin/api/search` (no tiene hoy).
- Aplicar rate-limit a `/admin/api/export/*` (no tiene hoy).
- Aplicar rate-limit a server actions admin críticos (`crearInstitucionConLink`,
  `reenviarMagicLink`).

Esto es **Sprint 3** de lo que documenté en el reporte de seguridad.

---

## Commits relevantes (en orden cronológico)

| Hash | Cambio |
|---|---|
| `e942afe` | Sprint 0: IDOR fix + streamText timeout |
| `cc7de99` | Sprint 1: Auth.js v6 + tablas DB + admin login Google + audit wrapper |
| `de7721d` | VERTICE_ADMIN_DOMAINS env configurable |
| `7dadaaf` | env validation + PII redaction + audit en exports |
| `8ee2d63` | tests resolver |
| `28b96dd` | audit wrap instituciones |
| `ead8854` | audit wrap magic_links |
| `9304a2d` | SSO closeout + env preprocess + verify script |
| `6646f1c` | GOOGLE_CLIENT_ID + SECRET en .env.local |
| **(este checkpoint)** | **Upstash rate-limit code-complete con fallback** |

---

## Cómo retomar (TL;DR para Claude futuro)

1. Lee este archivo entero.
2. Lee `lib/security/rate-limit.ts` — está code-complete, no toques nada.
3. Ejecuta `npm run typecheck` y `npx vitest run lib/security` para confirmar
   estado verde (esperado: 20 tests passing).
4. Pide al usuario que complete **Paso A** (provisioning Upstash) si todavía
   no tiene `UPSTASH_REDIS_REST_URL` en `.env.local`.
5. Una vez tenga las credenciales, ejecuta **Paso C** (smoke verify).
6. Cierra con **Paso D** (commit final).
