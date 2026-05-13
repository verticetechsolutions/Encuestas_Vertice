-- 0006_sso_usuarios_audit.sql
-- Sprint 1 del security audit 2026-05-12: per-user auth con Google SSO +
-- audit log de acciones admin.
--
-- Tablas nuevas:
--   - usuarios: identidad post-Google SSO, role-based, link a institución.
--   - institucion_dominios_permitidos: whitelist de dominios por institución
--     usada en el sign-in callback de Auth.js para auto-crear usuarios.
--   - audit_admin_actions: append-only audit trail de Server Actions admin.
--
-- Enum nuevo: usuario_role (entrevistado | admin).
--
-- Notas de diseño:
--   - Auth.js v6 con JWT strategy ⇒ NO necesitamos tablas accounts/sessions/
--     verification_tokens del Auth.js DB adapter. El JWT cookie es suficiente
--     para nuestro escala.
--   - Emails case-insensitive vía índice sobre LOWER(email). citext no se usa
--     porque no está habilitada en Neon plan free.
--   - usuario_role enum permite agregar 'super_admin' u otros en migración
--     futura sin romper FKs.

-- =============================================================================
-- Enum
-- =============================================================================
CREATE TYPE "usuario_role" AS ENUM ('entrevistado', 'admin');

-- =============================================================================
-- usuarios
-- =============================================================================
CREATE TABLE "usuarios" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "institucion_id"  uuid REFERENCES "instituciones"("id"),
  "email"           text NOT NULL,
  "google_sub"      text,
  "nombre"          text,
  "picture_url"     text,
  "role"            "usuario_role" NOT NULL DEFAULT 'entrevistado',
  "ultimo_login_at" timestamptz,
  "created_at"      timestamptz NOT NULL DEFAULT now()
);

-- Email case-insensitive unique. Cualquier match LOWER(a)=LOWER(b) viola la
-- constraint. Permite buscar usuario por email tipeado en cualquier caso sin
-- necesidad de normalizar antes de la query.
CREATE UNIQUE INDEX "usuarios_email_lower_unique" ON "usuarios" (LOWER("email"));

-- google_sub UNIQUE pero nullable: usuarios pre-Google (creados via magic-link)
-- tienen google_sub=NULL hasta su primer Google login. NULL permitido en UNIQUE
-- PostgreSQL (múltiples NULLs OK).
CREATE UNIQUE INDEX "usuarios_google_sub_unique" ON "usuarios" ("google_sub");

-- =============================================================================
-- institucion_dominios_permitidos
-- =============================================================================
-- Lookup en login: split(email, '@')[1] → buscar institución dueña del dominio.
-- ON DELETE CASCADE: si la institución se elimina, sus dominios se van con ella.
CREATE TABLE "institucion_dominios_permitidos" (
  "institucion_id" uuid NOT NULL REFERENCES "instituciones"("id") ON DELETE CASCADE,
  "dominio"        text NOT NULL,
  "agregado_por"   uuid REFERENCES "usuarios"("id"),
  "agregado_at"    timestamptz NOT NULL DEFAULT now()
);

-- Un dominio solo puede pertenecer a UNA institución. Caso edge: dos aliados
-- comparten dominio padre (raro en bancos serios) — la constraint los obliga a
-- registrar dominios distintos.
CREATE UNIQUE INDEX "institucion_dominios_dominio_unique"
  ON "institucion_dominios_permitidos" (LOWER("dominio"));

-- PK compuesta (lookup rápido por institución para listar sus dominios).
CREATE UNIQUE INDEX "institucion_dominios_pk_compuesta"
  ON "institucion_dominios_permitidos" ("institucion_id", LOWER("dominio"));

-- =============================================================================
-- audit_admin_actions
-- =============================================================================
-- Append-only. NUNCA emitir DELETE/UPDATE en esta tabla — la integridad del
-- trail depende de la inmutabilidad.
CREATE TABLE "audit_admin_actions" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "admin_user_id" uuid REFERENCES "usuarios"("id"),
  "action"        text NOT NULL,
  "target_type"   text,
  "target_id"     text,
  "payload"       jsonb,
  "ip"            text,
  "user_agent"    text,
  "created_at"    timestamptz NOT NULL DEFAULT now()
);

-- Index para queries "¿qué pasó con este admin?" o "¿qué pasó con este target?"
CREATE INDEX "audit_admin_actions_admin_user_id_idx"
  ON "audit_admin_actions" ("admin_user_id", "created_at" DESC);

CREATE INDEX "audit_admin_actions_target_idx"
  ON "audit_admin_actions" ("target_type", "target_id", "created_at" DESC);
