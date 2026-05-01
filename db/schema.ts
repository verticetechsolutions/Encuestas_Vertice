import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  real,
  timestamp,
  boolean,
  jsonb,
  vector,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

// =============================================================================
// Enums
// =============================================================================
// IFPE excluded (Ley Fintech art. 22 — no puede dar crédito).
export const tipoInstitucionEnum = pgEnum('tipo_institucion', [
  'banco',
  'sofom_er',
  'sofom_enr',
  'sofipo',
  'socap',
  'arrendadora',
  'factoraje',
  'ifc',
  'otro',
]);

export const sesionStatusEnum = pgEnum('sesion_status', [
  'abierta',
  'pausada',
  'sintetizando',
  'completa',
  'abandonada',
]);

export const rolTurnoEnum = pgEnum('rol_turno', ['agente', 'usuario']);

export const fuenteTurnoEnum = pgEnum('fuente_turno', [
  'sonnet_genera',
  'usuario_tipea',
  'usuario_voz',
  'opus_caso_sintetico',
]);

export const casoEstadoEnum = pgEnum('caso_estado', [
  'generado',
  'validacion_fallida',
  'mostrado',
  'respondido',
  'fallback_usado',
]);

// =============================================================================
// Tables
// =============================================================================

export const instituciones = pgTable('instituciones', {
  id: uuid('id').primaryKey().defaultRandom(),
  razon_social: text('razon_social').notNull(),
  nombre_comercial: text('nombre_comercial'),
  tipo: tipoInstitucionEnum('tipo').notNull(),
  email_contacto: text('email_contacto').notNull().unique(),
  magic_link_token: text('magic_link_token').unique(),
  magic_link_expires_at: timestamp('magic_link_expires_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const sesiones = pgTable('sesiones', {
  id: uuid('id').primaryKey().defaultRandom(),
  institucion_id: uuid('institucion_id')
    .references(() => instituciones.id)
    .notNull(),
  status: sesionStatusEnum('status').notNull().default('abierta'),
  started_at: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  closed_at: timestamp('closed_at', { withTimezone: true }),
  ultimo_turno_at: timestamp('ultimo_turno_at', { withTimezone: true }).defaultNow().notNull(),
  duracion_total_segundos: integer('duracion_total_segundos'),
  cajas_llenas_count: integer('cajas_llenas_count').notNull().default(0),
  // Snapshot at session creation: 5 identidad + 44 núcleo + N extensión[tipo].
  // Denominator for `completitud`. Pinned per session so v2 cajas don't change old denominators.
  cajas_aplicables: integer('cajas_aplicables').notNull(),
  fatiga_detectada: boolean('fatiga_detectada').notNull().default(false),
  // LFPDPPP consent timestamp — set when user checks the privacy checkbox on bienvenida.
  // Null until consented; the entrevista route is gated on this being non-null.
  consentimiento_at: timestamp('consentimiento_at', { withTimezone: true }),
  metadata: jsonb('metadata'),
});

// Magic-link tokens issued by `scripts/invitar.ts`. Token plain only ever exists in
// the email URL; DB stores SHA-256 hash. One-shot: `consumed_at` is set when verified
// and the row is never reused (cookie sustains the session afterward).
export const magic_tokens = pgTable('magic_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  token_hash: text('token_hash').notNull().unique(),
  institucion_id: uuid('institucion_id')
    .references(() => instituciones.id)
    .notNull(),
  expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumed_at: timestamp('consumed_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const turnos_conversacion = pgTable('turnos_conversacion', {
  id: uuid('id').primaryKey().defaultRandom(),
  sesion_id: uuid('sesion_id')
    .references(() => sesiones.id)
    .notNull(),
  numero_turno: integer('numero_turno').notNull(),
  rol: rolTurnoEnum('rol').notNull(),
  contenido_texto: text('contenido_texto').notNull(),
  fuente: fuenteTurnoEnum('fuente').notNull(),
  modelo_llm: text('modelo_llm'), // null si es del usuario
  tokens_input: integer('tokens_input'),
  tokens_output: integer('tokens_output'),
  latencia_ms: integer('latencia_ms'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const extracciones = pgTable('extracciones', {
  id: uuid('id').primaryKey().defaultRandom(),
  sesion_id: uuid('sesion_id')
    .references(() => sesiones.id)
    .notNull(),
  turno_id: uuid('turno_id')
    .references(() => turnos_conversacion.id)
    .notNull(),
  // Open string by design — new cajas can be added in v2 without migration.
  caja_codigo: text('caja_codigo').notNull(),
  valor: jsonb('valor').notNull(),
  confianza: real('confianza').notNull(), // 0.0 a 1.0
  fuente: text('fuente').notNull(), // 'llm' | 'manual'
  evidencia_textual: text('evidencia_textual'),
  superseded_by: uuid('superseded_by').references((): AnyPgColumn => extracciones.id),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const casos_generados = pgTable('casos_generados', {
  id: uuid('id').primaryKey().defaultRandom(),
  sesion_id: uuid('sesion_id')
    .references(() => sesiones.id)
    .notNull(),
  numero_caso: integer('numero_caso').notNull(), // 1..5 (cap global)
  estado: casoEstadoEnum('estado').notNull(),
  contenido: jsonb('contenido').notNull(), // CasoSintetico shape
  cajas_objetivo: text('cajas_objetivo').array().notNull(),
  validacion_resultado: jsonb('validacion_resultado'),
  intento_numero: integer('intento_numero').notNull().default(1), // max 2 retries
  generado_por: text('generado_por'), // 'opus-4-7' | 'fallback'
  fallback_origen: text('fallback_origen'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const eventos_correccion_manual = pgTable('eventos_correccion_manual', {
  id: uuid('id').primaryKey().defaultRandom(),
  sesion_id: uuid('sesion_id')
    .references(() => sesiones.id)
    .notNull(),
  caja_codigo: text('caja_codigo').notNull(),
  valor_anterior: jsonb('valor_anterior'),
  valor_nuevo: jsonb('valor_nuevo').notNull(),
  motivo: text('motivo'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const mapa_incertidumbre_snapshots = pgTable('mapa_incertidumbre_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  sesion_id: uuid('sesion_id')
    .references(() => sesiones.id)
    .notNull(),
  numero_turno: integer('numero_turno').notNull(),
  cajas_estado: jsonb('cajas_estado').notNull(),
  confianza_global: real('confianza_global'),
  cajas_criticas_pct: real('cajas_criticas_pct'),
  cajas_blandas_pct: real('cajas_blandas_pct'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const perfil_decision_final = pgTable('perfil_decision_final', {
  id: uuid('id').primaryKey().defaultRandom(),
  institucion_id: uuid('institucion_id')
    .references(() => instituciones.id)
    .notNull(),
  sesion_id: uuid('sesion_id')
    .references(() => sesiones.id)
    .notNull(),
  version: integer('version').notNull().default(1), // versionado por institución
  perfil_json: jsonb('perfil_json').notNull(),
  schema_version: text('schema_version').notNull(), // ej. "1.0"
  completitud: real('completitud').notNull(), // 0.0 a 1.0
  confianza_global: real('confianza_global').notNull(),
  // pgvector. Nullable — no embeddings in MVP, column ready for v2 RAG.
  embedding: vector('embedding', { dimensions: 1536 }),
  generado_at: timestamp('generado_at', { withTimezone: true }).defaultNow().notNull(),
});
