-- Manual migration (no drizzle-kit snapshot). Mantiene history minimal —
-- DROP de 2 columnas dead-but-present + su unique index. NO ejecutar
-- `drizzle-kit generate` después de aplicar: regeneraría como una 0005
-- duplicada (o re-añadiría las columnas si schema.ts no estuviera ya
-- limpio). Patrón espejo de 0003_magic_token_revoked_at.sql.
--
-- Contexto: `instituciones.magic_link_token` y `magic_link_expires_at` se
-- crearon en 0000 antes de cementar el flujo magic-link real (Fase 4,
-- migración 0001 trajo `magic_tokens` separada). Las dos columnas en
-- instituciones nunca llegaron a usarse — `IMPLEMENTATION.md` §13 Fase 4
-- y la deuda §19 las marcaron como cleanup pendiente. Verificación
-- pre-merge: cero referencias en código (db/schema.ts ya limpiado;
-- ningún server action, route handler, ni helper las consulta).
--
-- Idempotente vía IF EXISTS: aplicable también si el branch de Neon ya
-- tuvo un cleanup parcial.

ALTER TABLE "instituciones" DROP CONSTRAINT IF EXISTS "instituciones_magic_link_token_unique";
--> statement-breakpoint

ALTER TABLE "instituciones" DROP COLUMN IF EXISTS "magic_link_token";
--> statement-breakpoint

ALTER TABLE "instituciones" DROP COLUMN IF EXISTS "magic_link_expires_at";
