-- 0007_add_pdf_url.sql
-- Agrega pdf_url a `perfil_decision_final` para Fase 8 storage Blob.
-- Opcional (nullable): el perfil se persiste antes de generar el PDF (step
-- `procesar-sintesis-final` vs `generar-pdf` viven en pasos Inngest aislados).
-- Si `generar-pdf` falla, el perfil queda válido sin PDF; un re-run posterior
-- puede llenar la URL sin reinsertar la fila.
--
-- Manual migration (espejo del patrón 0003/0005). NO ejecutar `drizzle-kit
-- generate` después de aplicar — el schema TS ya refleja la columna.
ALTER TABLE "perfil_decision_final"
  ADD COLUMN "pdf_url" text;
