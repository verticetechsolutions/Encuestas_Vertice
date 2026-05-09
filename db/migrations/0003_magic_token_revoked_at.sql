ALTER TABLE "magic_tokens" ADD COLUMN "revoked_at" timestamp with time zone;

-- Índice parcial para acelerar la consulta "vigentes por institución" que
-- ejecuta emitirMagicLink antes de revocar previos en cada reemisión.
CREATE INDEX "magic_tokens_active_by_institucion_idx"
  ON "magic_tokens" ("institucion_id")
  WHERE "consumed_at" IS NULL AND "revoked_at" IS NULL;
