-- Manual migration (no drizzle-kit snapshot). Keeps history minimal — column +
-- index only. NO ejecutar `drizzle-kit generate` después de aplicar esta
-- migración: lo regeneraría como un 0003 nuevo y duplicaría el cambio.
ALTER TABLE "magic_tokens" ADD COLUMN "revoked_at" timestamp with time zone;
--> statement-breakpoint

-- Índice parcial para acelerar la consulta "vigentes por institución" que
-- ejecuta emitirMagicLink antes de revocar previos en cada reemisión.
CREATE INDEX "magic_tokens_active_by_institucion_idx"
  ON "magic_tokens" ("institucion_id")
  WHERE "consumed_at" IS NULL AND "revoked_at" IS NULL;
