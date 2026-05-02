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

function emit(level: LogLevel, event: string, payload: Record<string, unknown>) {
  const record = {
    _time: new Date().toISOString(),
    level,
    event,
    ...payload,
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
  flush: async () => {
    if (client) await client.flush();
  },
};
