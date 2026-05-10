import { Axiom } from '@axiomhq/js';

// Singleton Axiom client. No-ops gracefully when AXIOM_TOKEN is unset
// (typical in local dev) so logging calls never throw.

const token = process.env.AXIOM_TOKEN;
const dataset = process.env.AXIOM_DATASET ?? 'vertice-dev';

const client = token ? new Axiom({ token }) : null;

type LogLevel = 'info' | 'warn' | 'error';

type LlmPurpose =
  | 'generar_batch'
  | 'extraer_cajas'
  | 'validar_caso'
  | 'generar_caso_sintetico'
  | 'revisar_seccion'
  | 'sintesis_final';

export interface LlmCallLog {
  sesion_id: string;
  modelo: 'claude-sonnet-4-6' | 'claude-opus-4-7';
  proposito: LlmPurpose;
  tokens_input: number;
  tokens_output: number;
  latencia_ms: number;
  cajas_extraidas_count?: number;
  confianza_promedio?: number;
  error?: string;
}

// =============================================================================
// Phase 5 step 5 — Sonnet→Opus review handoff event payloads (spec v2 §5.1)
// =============================================================================
// Las 9 piezas alimentan las 6 métricas derivadas (a-f) del §5.2. Ver
// docs/axiom_dashboard.md para queries APL.

export interface ReviewDisparadoPayload {
  sesion_id: string;
  grupo_ui: string;
  round: number;
  turno_disparador: number;
  num_cajas_no_clausuradas: number;
}

export interface ReviewOpusDecidioPayload {
  sesion_id: string;
  grupo_ui: string;
  round: number;
  decision: 'avanzar' | 'profundizar' | 'caso_sintetico';
  latencia_ms: number;
}

export interface ReviewRejectionPayload {
  sesion_id: string;
  grupo_ui: string;
}

export interface ReviewSiguienteGrupoCorregidoPayload {
  sesion_id: string;
  grupo_ui: string;
  opus_dijo: string | null;
  canonico: string | null;
}

export interface ReviewOpusCallFallidoPayload {
  sesion_id: string;
  grupo_ui: string;
  round: number;
  error: string;
}

export interface ReviewProfundizacionCajaCollateralPayload {
  // Spec §1.4: Sonnet re-extrajo una caja fuera de cajas_a_reabordar durante un
  // round de profundización. Útil para auditar si Opus debería incluir más cajas.
  sesion_id: string;
  grupo_ui: string;
  caja_codigo: string;
}

export interface ExtraccionContradiceSinPreviaPayload {
  // Spec §1.4: Sonnet marcó contradice_extraccion_previa=true pero no hay
  // extracción previa para esa caja. Hint inválido — bug de Sonnet.
  sesion_id: string;
  caja_codigo: string;
}

export interface DeclineRegistradoPayload {
  sesion_id: string;
  caja_codigo: string;
  razon:
    | 'aceptada_round_1'
    | 'estancada_post_profundizar'
    | 'cap_casos_alcanzado'
    | 'cap_turnos_alcanzado';
  review_id_origen: string;
}

export interface CasoConsumidoPorGrupoPayload {
  // Spec gap F: detectar si algún grupo agota >3 casos solos → quotas v2.
  sesion_id: string;
  grupo_ui: string;
  casos_acumulados_grupo: number;
  casos_acumulados_sesion: number;
}

export interface SesionListaParaSintesisPayload {
  sesion_id: string;
  ultimo_review_id: string;
  total_reviews: number;
  total_profundizaciones: number;
  total_casos: number;
  completitud_estimada: number | null;
  // Event ID retornado por inngest.send() — correlaciona Axiom ↔ Inngest run
  // para auditar fallas (commit 9 wiring real).
  inngest_event_id?: string;
}

export interface SesionSintesisFailedPayload {
  sesion_id: string;
  error: string;
}

// =============================================================================
// Admin audit log payloads (security-hardening 2026-05-10)
// =============================================================================
// Eventos de auditoría para acciones administrativas. NUNCA incluir el token
// admin ni el plaintext del magic link en el payload — solo metadata.

export interface AdminLoginPayload {
  ip: string;
  // user_agent truncado a 200 chars para evitar logs gigantes con strings UA
  // patológicos.
  user_agent: string | null;
}

export interface AdminLoginFallidoPayload {
  ip: string;
  user_agent: string | null;
  // 'admin_disabled' | 'admin_invalid_token' | 'rate_limited'
  razon: string;
}

export interface AdminInstitucionCreadaPayload {
  institucion_id: string;
  razon_social: string;
  tipo: string;
  emitio_magic_link: boolean;
}

export interface AdminMagicLinkEmitidoPayload {
  institucion_id: string;
  // Hash del token (SHA-256 hex), NUNCA el plaintext.
  token_hash_prefix: string; // primeros 8 chars del hash, para correlación con audit
  expires_at: string; // ISO
  dry_run: boolean;
}

export interface AdminMagicLinkRevocadoPayload {
  institucion_id: string;
  token_hash_prefix: string;
  // 'reemision' | 'manual_admin'
  razon: string;
}

function emit(level: LogLevel, event: string, payload: object = {}) {
  // `object` aceptamos tanto Record<string, unknown> como interfaces tipadas
  // sin index signature (los typed payloads de Phase 5 step 5). El spread funciona
  // y la coerción a Record<string, unknown> dentro del record final es segura
  // (Axiom recibe JSON arbitrario).
  const record = {
    _time: new Date().toISOString(),
    level,
    event,
    ...(payload as Record<string, unknown>),
  };

  if (client) {
    client.ingest(dataset, [record]);
  } else if (process.env.NODE_ENV !== 'production') {
    // Local dev fallback: surface structured logs to stdout.
    // eslint-disable-next-line no-console
    console.log(`[axiom:${level}]`, event, record);
  }
}

export const logger = {
  info: (event: string, payload: Record<string, unknown> = {}) =>
    emit('info', event, payload),
  warn: (event: string, payload: Record<string, unknown> = {}) =>
    emit('warn', event, payload),
  error: (event: string, payload: Record<string, unknown> = {}) =>
    emit('error', event, payload),
  llmCall: (payload: LlmCallLog) => emit('info', 'llm_call', { ...payload }),

  // Phase 5 step 5 — review handoff typed emitters (spec v2 §5.1).
  review: {
    disparado: (p: ReviewDisparadoPayload) => emit('info', 'review.disparado', p),
    opusDecidio: (p: ReviewOpusDecidioPayload) =>
      emit('info', 'review.opus_decidio', p),
    profundizacionRejected: (p: ReviewRejectionPayload) =>
      emit('warn', 'review.profundizacion_rejected', p),
    escalacionCasoRejectedPorCap: (p: ReviewRejectionPayload) =>
      emit('warn', 'review.escalacion_caso_rejected_por_cap', p),
    siguienteGrupoCorregido: (p: ReviewSiguienteGrupoCorregidoPayload) =>
      emit('warn', 'review.siguiente_grupo_corregido', p),
    opusCallFallido: (p: ReviewOpusCallFallidoPayload) =>
      emit('error', 'review.opus_call_fallido', p),
    opusResponseInvalida: (p: ReviewOpusCallFallidoPayload) =>
      emit('error', 'review.opus_response_invalida', p),
    profundizacionCajaCollateral: (p: ReviewProfundizacionCajaCollateralPayload) =>
      emit('info', 'review.profundizacion.caja_collateral', p),
  },

  extraccion: {
    contradiceSinPrevia: (p: ExtraccionContradiceSinPreviaPayload) =>
      emit('warn', 'extraccion.contradice_sin_previa', p),
  },

  decline: {
    registrado: (p: DeclineRegistradoPayload) =>
      emit('info', 'decline_to_answer.registrado', p),
  },

  caso: {
    consumidoPorGrupo: (p: CasoConsumidoPorGrupoPayload) =>
      emit('info', 'caso.consumido_por_grupo', p),
  },

  sesion: {
    listaParaSintesis: (p: SesionListaParaSintesisPayload) =>
      emit('info', 'sesion.lista_para_sintesis', p),
    sintesisFailed: (p: SesionSintesisFailedPayload) =>
      emit('error', 'sesion.sintesis_failed', p),
  },

  // Admin audit log — security-hardening 2026-05-10. Estos eventos son la
  // base del compliance trail de acciones administrativas. NUNCA loguear
  // tokens plaintext en los payloads.
  admin: {
    login: (p: AdminLoginPayload) => emit('info', 'admin.login', p),
    loginFallido: (p: AdminLoginFallidoPayload) =>
      emit('warn', 'admin.login_fallido', p),
    institucionCreada: (p: AdminInstitucionCreadaPayload) =>
      emit('info', 'admin.institucion_creada', p),
    magicLinkEmitido: (p: AdminMagicLinkEmitidoPayload) =>
      emit('info', 'admin.magic_link_emitido', p),
    magicLinkRevocado: (p: AdminMagicLinkRevocadoPayload) =>
      emit('info', 'admin.magic_link_revocado', p),
  },

  flush: async () => {
    if (client) await client.flush();
  },
};
