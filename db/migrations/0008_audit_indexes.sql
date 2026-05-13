-- 0008_audit_indexes.sql
-- Indexes para `audit_admin_actions` (deuda #7 cerrada 2026-05-13):
--   1. (admin_user_id, created_at) — queries del panel admin "qué hizo X".
--   2. (action, created_at) — cron de retention que filtra por action prefix
--      + queries "todos los DELETE de instituciones".
--
-- Sin estos indexes, a 1 mes con 10 admins activos (~30k filas) las queries
-- empiezan a degradarse; a 1 año (~400k filas) se vuelven inviables.
--
-- Indexes non-unique: el mismo admin emite múltiples acciones; el mismo action
-- se ejecuta repetidamente. La unicidad la da `id` (PK).

CREATE INDEX IF NOT EXISTS "audit_admin_actions_admin_created_idx"
  ON "audit_admin_actions" ("admin_user_id", "created_at" DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "audit_admin_actions_action_created_idx"
  ON "audit_admin_actions" ("action", "created_at" DESC);
