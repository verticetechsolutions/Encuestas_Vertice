-- 0005_add_telefono_contacto.sql
-- Agrega telefono_contacto a `instituciones`. Opcional (nullable) — algunos
-- aliados podrían registrar sólo email durante onboarding y completar luego.
-- Sin validación de formato a nivel DB para tolerar variantes (+52, lada,
-- ext); la validación liviana vive en Zod (lib/auth/contracts.ts).
ALTER TABLE "instituciones"
  ADD COLUMN "telefono_contacto" text;
