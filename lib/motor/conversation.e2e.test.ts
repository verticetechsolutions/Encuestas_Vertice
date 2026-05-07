// E2E mock suite — happy path multi-grupo (Phase 5 non-negotiable per memoria
// `feedback_phase5_e2e_tests`). Drive ~12 model steps a través de los 6 grupos
// UI usando `streamText` con el mock provider de Sonnet, simulando 6 user
// turnos consecutivos.
//
// Cobertura:
//   - Loop streamText × tools × persistencia stateful
//   - Mapa de incertidumbre se actualiza turn-a-turn (REAL function)
//   - solicitar_review_seccion al final de cada grupo → avanza al siguiente
//   - Supersede chain en extracciones cuando se reextrae la misma caja
//   - cajasAplicables (CANON solo, sin EXTENSION para 'banco') se respeta
//
// Estrategia de mocks:
//   - `@/lib/motor/persistence` → stateful in-memory (turnos auto-incrementan,
//     extracciones con supersede chain). Los tests de SQL real viven en
//     `persistence.test.ts` y `review.integration.test.ts`.
//   - `@/lib/motor/review` → `processSolicitarReview` canned por (grupo→avanzar
//     al siguiente, último grupo→sesion_lista_para_sintesis). La cobertura del
//     state machine de review vive en `review.e2e.test.ts`.
//   - `@/lib/observability/axiom` → silenciado.
//   - `computeMapaIncertidumbre` se usa REAL (pure function).
//
// Tools dict: definido inline aquí, mirroring `app/api/turn/route.ts`. La
// drift entre los dos se vigila por revisión humana en PR — ambos son cortos
// y los Zod schemas son la fuente de verdad compartida.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { streamText, tool, stepCountIs } from 'ai';

import {
  RegistrarExtraccionInputSchema,
  GenerarBatchPreguntasInputSchema,
  SolicitarCasoSinteticoInputSchema,
} from './tools';
import { SolicitarReviewSeccionInputSchema } from '@/lib/schemas/review_seccion';
import { valorSchemaFor, type Extraccion } from '@/lib/schemas/extracciones';
import { computeMapaIncertidumbre } from './mapa';
import {
  GrupoUISchema,
  getCajaAny,
  getCajasAplicables,
  type GrupoUI,
} from '@/lib/schemas/cajas';
import { createMockSonnet, type TurnScript } from './__test_helpers__/mock-sonnet';

// =============================================================================
// Mocks: persistencia stateful + review canned
// =============================================================================

const { state, mockProcessSolicitarReview } = vi.hoisted(() => {
  // El state vive en el closure de vi.hoisted para que los factories de
  // `vi.mock` lo accedan desde su contexto hoisted.
  const state = {
    turno_seq: 0,
    turnos: [] as Array<{
      id: string;
      sesion_id: string;
      numero_turno: number;
      rol: 'usuario' | 'agente';
      contenido_texto: string;
    }>,
    extracciones: [] as Array<{
      id: string;
      sesion_id: string;
      turno_id: string;
      caja_codigo: string;
      valor: unknown;
      confianza: number;
      fuente: 'llm' | 'manual';
      evidencia_textual: string | null;
      superseded_by: string | null;
      created_at: Date;
    }>,
    extr_seq: 0,
  };
  const mockProcessSolicitarReview = vi.fn();
  return { state, mockProcessSolicitarReview };
});

vi.mock('@/lib/motor/persistence', () => {
  return {
    ExtraccionInvalidaError: class extends Error {
      readonly caja_codigo: string;
      readonly indice: number;
      constructor(args: { caja_codigo: string; indice: number; causa: unknown }) {
        super(`Extracción inválida en índice ${args.indice}`);
        this.name = 'ExtraccionInvalidaError';
        this.caja_codigo = args.caja_codigo;
        this.indice = args.indice;
      }
    },

    persistirTurnoUsuario: vi.fn(async (input: { sesion_id: string; contenido_texto: string }) => {
      state.turno_seq += 1;
      const id = `t-user-${state.turno_seq}`;
      state.turnos.push({
        id,
        sesion_id: input.sesion_id,
        numero_turno: state.turno_seq,
        rol: 'usuario',
        contenido_texto: input.contenido_texto,
      });
      return { turno_id: id, numero_turno: state.turno_seq };
    }),

    persistirTurnoAgente: vi.fn(async (input: { sesion_id: string; contenido_texto: string }) => {
      state.turno_seq += 1;
      const id = `t-agent-${state.turno_seq}`;
      state.turnos.push({
        id,
        sesion_id: input.sesion_id,
        numero_turno: state.turno_seq,
        rol: 'agente',
        contenido_texto: input.contenido_texto,
      });
      return { turno_id: id, numero_turno: state.turno_seq };
    }),

    actualizarContenidoTurnoAgente: vi.fn(async (input: {
      turno_id: string;
      contenido_texto: string;
    }) => {
      const t = state.turnos.find((x) => x.id === input.turno_id);
      if (t) t.contenido_texto = input.contenido_texto;
    }),

    // Supersede chain: la última extracción para cada caja_codigo de la sesión
    // queda activa (superseded_by=null), las previas se settean a la nueva.
    persistirExtraccionesBatch: vi.fn(
      async (input: {
        sesion_id: string;
        turno_id: string;
        extracciones: Array<{
          caja_codigo: string;
          valor: unknown;
          confianza: number;
          evidencia_textual: string;
        }>;
      }) => {
        const out: Array<{ id: string; supersedido_id?: string }> = [];
        for (const e of input.extracciones) {
          state.extr_seq += 1;
          const id = `e-${state.extr_seq}`;
          // Buscar previa activa para esta caja en esta sesión.
          const prev = state.extracciones.find(
            (x) =>
              x.sesion_id === input.sesion_id &&
              x.caja_codigo === e.caja_codigo &&
              x.superseded_by === null
          );
          if (prev) prev.superseded_by = id;
          state.extracciones.push({
            id,
            sesion_id: input.sesion_id,
            turno_id: input.turno_id,
            caja_codigo: e.caja_codigo,
            valor: e.valor,
            confianza: e.confianza,
            fuente: 'llm',
            evidencia_textual: e.evidencia_textual,
            superseded_by: null,
            created_at: new Date(),
          });
          out.push({ id, supersedido_id: prev?.id });
        }
        return out;
      }
    ),

    listarExtraccionesActivas: vi.fn(async (sesion_id: string): Promise<Extraccion[]> => {
      return state.extracciones
        .filter((x) => x.sesion_id === sesion_id && x.superseded_by === null)
        .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
        .map((x) => ({
          id: x.id,
          sesion_id: x.sesion_id,
          turno_id: x.turno_id,
          caja_codigo: x.caja_codigo,
          valor: x.valor,
          confianza: x.confianza,
          fuente: x.fuente,
          evidencia_textual: x.evidencia_textual,
          version: 1,
          superseded_by: x.superseded_by,
          created_at: x.created_at,
        }));
    }),

    siguienteNumeroTurno: vi.fn(async () => state.turno_seq + 1),
  };
});

vi.mock('@/lib/motor/review', () => {
  class OpusReviewPromptNotReady extends Error {
    constructor() {
      super('OpusReviewPromptNotReady');
      this.name = 'OpusReviewPromptNotReady';
    }
  }
  return {
    processSolicitarReview: mockProcessSolicitarReview,
    OpusReviewPromptNotReady,
  };
});

vi.mock('@/lib/observability/axiom', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    review: { disparado: vi.fn(), opusCallFallido: vi.fn(), opusResponseInvalida: vi.fn() },
    decline: { caja: vi.fn() },
    caso: { generadoPorGrupo: vi.fn(), consumidoPorGrupo: vi.fn() },
    sesion: { listaParaSintesis: vi.fn() },
    extraccion: { persistida: vi.fn() },
  },
}));

// Imports DESPUÉS de los mocks.
import {
  persistirTurnoUsuario,
  persistirTurnoAgente,
  actualizarContenidoTurnoAgente,
  persistirExtraccionesBatch,
  listarExtraccionesActivas,
  ExtraccionInvalidaError,
  type ExtraccionInput,
} from './persistence';
import { processSolicitarReview, OpusReviewPromptNotReady } from './review';

// =============================================================================
// Tools dict — mirror de app/api/turn/route.ts (motor-level, sin HTTP wrap)
// =============================================================================

function computeLlenasPorGrupo(
  cajasState: ReturnType<typeof computeMapaIncertidumbre>['cajas']
): Record<GrupoUI, number> {
  const out = {} as Record<GrupoUI, number>;
  for (const g of GrupoUISchema.options) out[g] = 0;
  for (const codigo of Object.keys(cajasState)) {
    const s = cajasState[codigo];
    if (s.status !== 'llena' && s.status !== 'no_aplica' && s.status !== 'declinada') continue;
    const canon = getCajaAny(codigo);
    if (!canon) continue;
    out[canon.grupo_ui] = (out[canon.grupo_ui] ?? 0) + 1;
  }
  return out;
}

function buildTools(ctx: {
  sesion_id: string;
  turno_agente_id: string;
  cajas_aplicables: ReturnType<typeof getCajasAplicables>;
}) {
  return {
    registrar_extraccion: tool({
      description: 'Registra extracciones de cajas con supersede chain.',
      inputSchema: RegistrarExtraccionInputSchema,
      execute: async (input) => {
        const validas: ExtraccionInput[] = [];
        const errores: Array<{ indice: number; caja_codigo: string; error: string }> = [];
        for (let i = 0; i < input.extracciones.length; i++) {
          const e = input.extracciones[i];
          const sub = valorSchemaFor(e.caja_codigo).safeParse(e.valor);
          if (!sub.success) {
            errores.push({ indice: i, caja_codigo: e.caja_codigo, error: sub.error.message });
            continue;
          }
          validas.push({
            caja_codigo: e.caja_codigo,
            valor: e.valor,
            confianza: e.confianza,
            evidencia_textual: e.evidencia_textual,
          });
        }
        if (validas.length === 0) {
          return { ok: false, persisted: 0, supersedidos: 0, errores };
        }
        try {
          const persistidas = await persistirExtraccionesBatch({
            sesion_id: ctx.sesion_id,
            turno_id: ctx.turno_agente_id,
            extracciones: validas,
          });
          const supersedidos = persistidas.filter((p) => p.supersedido_id !== undefined).length;
          const activas = await listarExtraccionesActivas(ctx.sesion_id);
          const mapa = computeMapaIncertidumbre(activas, ctx.cajas_aplicables);
          return {
            ok: true,
            persisted: persistidas.length,
            supersedidos,
            errores,
            mapa_summary: {
              llenas_por_grupo: computeLlenasPorGrupo(mapa.cajas),
              criticas_pct: mapa.cajas_criticas_pct,
              blandas_pct: mapa.cajas_blandas_pct,
              top_a_atacar: mapa.top_cajas_a_atacar,
            },
          };
        } catch (err) {
          if (err instanceof ExtraccionInvalidaError) {
            return {
              ok: false,
              persisted: 0,
              supersedidos: 0,
              errores: [{ indice: err.indice, caja_codigo: err.caja_codigo, error: err.message }],
            };
          }
          throw err;
        }
      },
    }),

    generar_batch_preguntas: tool({
      description: 'Genera el siguiente batch de 2-4 preguntas.',
      inputSchema: GenerarBatchPreguntasInputSchema,
      execute: async (input) => ({
        ok: true,
        batch_id: `batch-${ctx.turno_agente_id}`,
        preguntas: input.preguntas,
        longitud_batch: input.longitud_batch,
      }),
    }),

    solicitar_caso_sintetico: tool({
      description: 'Solicita caso sintético (stub).',
      inputSchema: SolicitarCasoSinteticoInputSchema,
      execute: async () => ({ ok: true, todo_step_posterior: true }),
    }),

    solicitar_review_seccion: tool({
      description: 'Solicita review del director Opus.',
      inputSchema: SolicitarReviewSeccionInputSchema,
      execute: async (input) => {
        try {
          return await processSolicitarReview(input, { sesion_id: ctx.sesion_id });
        } catch (err) {
          if (err instanceof OpusReviewPromptNotReady) {
            return { error: 'opus_director_prompt_not_ready', message: 'stub' };
          }
          throw err;
        }
      },
    }),
  };
}

// =============================================================================
// Helper: simular un user turno completo (HTTP-equivalent)
// =============================================================================

async function simulateUserTurn(args: {
  sesion_id: string;
  user_message: string;
  cajas_aplicables: ReturnType<typeof getCajasAplicables>;
  scripts: TurnScript[];
}) {
  await persistirTurnoUsuario({
    sesion_id: args.sesion_id,
    contenido_texto: args.user_message,
    fuente: 'usuario_tipea',
  });
  const turnoAgente = await persistirTurnoAgente({
    sesion_id: args.sesion_id,
    contenido_texto: '',
    fuente: 'sonnet_genera',
    modelo_llm: 'mock-sonnet',
  });
  const tools = buildTools({
    sesion_id: args.sesion_id,
    turno_agente_id: turnoAgente.turno_id,
    cajas_aplicables: args.cajas_aplicables,
  });
  const model = createMockSonnet(args.scripts);
  const result = streamText({
    model,
    tools,
    messages: [{ role: 'user', content: args.user_message }],
    // Permitir hasta scripts.length + 1 steps (margin de seguridad).
    stopWhen: stepCountIs(args.scripts.length + 2),
  });
  await result.consumeStream();
  await actualizarContenidoTurnoAgente({
    turno_id: turnoAgente.turno_id,
    contenido_texto: (await result.text) || '',
  });
  return { turnoAgente, finishReason: await result.finishReason };
}

// =============================================================================
// Setup
// =============================================================================

beforeEach(() => {
  // Reset state entre tests para aislamiento.
  state.turno_seq = 0;
  state.turnos.length = 0;
  state.extracciones.length = 0;
  state.extr_seq = 0;
  vi.clearAllMocks();
});

// =============================================================================
// Test
// =============================================================================

describe('Conversation E2E — happy path multi-grupo', () => {
  it('recorre los 6 grupos UI en 6 user turnos × 2 model steps cada uno', async () => {
    const sesion_id = 'sesion-e2e-happy';
    // Banco no tiene EXTENSION cajas en el canon (verifica ese path).
    const cajasAplicables = getCajasAplicables('banco');

    // -----------------------------------------------------------------
    // processSolicitarReview canned: avanzar grupo → siguiente, último →
    // sesion_lista_para_sintesis.
    // -----------------------------------------------------------------
    const ORDEN: GrupoUI[] = [
      'identificacion',
      'productos_y_mercado',
      'numeros_del_negocio',
      'operacion',
      'pricing_y_criterio',
      'contacto_y_especificos',
    ];
    let reviewSeq = 0;
    mockProcessSolicitarReview.mockImplementation(
      async (input: { grupo_ui_codigo: GrupoUI }) => {
        reviewSeq += 1;
        const idx = ORDEN.indexOf(input.grupo_ui_codigo);
        const isLast = idx === ORDEN.length - 1;
        if (isLast) {
          return {
            estado: 'sesion_lista_para_sintesis',
            review_id: `rev-${reviewSeq}`,
          };
        }
        return {
          estado: 'grupo_cerrado',
          review_id: `rev-${reviewSeq}`,
          siguiente_grupo_ui: ORDEN[idx + 1],
        };
      }
    );

    // -----------------------------------------------------------------
    // Cajas reales por grupo (1-2 críticas por grupo basta para test).
    // Valores siguen valorSchemaFor:
    //   - text → string
    //   - enum/enum_multi → string / string[]
    //   - int → number (nullable cuando permite_no_aplica)
    //   - objeto → record
    // -----------------------------------------------------------------
    type Plan = {
      grupo: GrupoUI;
      user_message: string;
      extracciones: Array<{ caja_codigo: string; valor: unknown; confianza: number }>;
      siguiente_grupo: GrupoUI | null;
    };
    const PLANES: Plan[] = [
      {
        grupo: 'identificacion',
        user_message: 'Somos Banco Demo SA, fundado en 2010, banco regulado por CNBV.',
        extracciones: [
          { caja_codigo: 'id_razon_social', valor: 'Banco Demo SA', confianza: 0.95 },
          { caja_codigo: 'id_tipo_institucion', valor: 'banco', confianza: 0.95 },
          { caja_codigo: 'id_regulacion', valor: ['cnbv'], confianza: 0.92 },
        ],
        siguiente_grupo: 'productos_y_mercado',
      },
      {
        grupo: 'productos_y_mercado',
        user_message: 'Damos crédito simple PyME a sectores manufactura y servicios, en todo MX.',
        extracciones: [
          {
            caja_codigo: 'nm_productos_ofrecidos',
            valor: ['credito_simple_pyme'],
            confianza: 0.92,
          },
          {
            caja_codigo: 'nm_sectores_aceptados',
            valor: ['manufactura', 'servicios'],
            confianza: 0.92,
          },
          {
            caja_codigo: 'nm_cobertura_geografica',
            valor: ['nacional'],
            confianza: 0.88,
          },
          {
            caja_codigo: 'nm_tipos_cliente',
            valor: ['pm'],
            confianza: 0.92,
          },
          {
            // Sectores excluidos: crítica del grupo.
            caja_codigo: 'nm_sectores_excluidos',
            valor: ['armas', 'cannabis'],
            confianza: 0.9,
          },
        ],
        siguiente_grupo: 'numeros_del_negocio',
      },
      {
        grupo: 'numeros_del_negocio',
        user_message: 'Tickets de 1M a 50M MXN, antigüedad mínima 2 años, score PM 700+.',
        extracciones: [
          { caja_codigo: 'ru_monto_min', valor: 1_000_000, confianza: 0.95 },
          { caja_codigo: 'ru_monto_max', valor: 50_000_000, confianza: 0.95 },
          { caja_codigo: 'ru_moneda', valor: 'mxn', confianza: 0.95 },
          { caja_codigo: 'ru_antiguedad_min', valor: 2, confianza: 0.92 },
          { caja_codigo: 'ru_facturacion_min', valor: 10_000_000, confianza: 0.85 },
          { caja_codigo: 'ru_score_pm_min', valor: 700, confianza: 0.92 },
          { caja_codigo: 'ru_score_pf_min', valor: 650, confianza: 0.85 },
          {
            caja_codigo: 'gr_tipos_garantia',
            valor: ['inmueble', 'aval'],
            confianza: 0.88,
          },
          { caja_codigo: 'gr_cobertura_min', valor: 1.2, confianza: 0.85 },
          { caja_codigo: 'gr_dscr_min', valor: 1.25, confianza: 0.92 },
          { caja_codigo: 'gr_deuda_ebitda_max', valor: 3.5, confianza: 0.9 },
          {
            caja_codigo: 'gr_ratios_definitorios',
            valor: 'DSCR, deuda/EBITDA, capital de trabajo',
            confianza: 0.85,
          },
        ],
        siguiente_grupo: 'operacion',
      },
      {
        grupo: 'operacion',
        user_message: 'Comité semanal, viabilidad 48h, fondeo 3 semanas.',
        extracciones: [
          { caja_codigo: 'op_tiempo_viabilidad', valor: '48 horas', confianza: 0.92 },
          { caja_codigo: 'op_tiempo_comite', valor: '1 semana', confianza: 0.92 },
          { caja_codigo: 'op_tiempo_fondeo', valor: '3 semanas', confianza: 0.9 },
          { caja_codigo: 'op_frecuencia_comite', valor: 'semanal', confianza: 0.95 },
          {
            caja_codigo: 'op_documentacion_estandar',
            valor: 'EEFF 3 años, RFC, acta constitutiva, comprobantes',
            confianza: 0.88,
          },
        ],
        siguiente_grupo: 'pricing_y_criterio',
      },
      {
        grupo: 'pricing_y_criterio',
        user_message:
          'Tasas TIIE+5 a TIIE+9. Pricing por sector y plazo. Tolerancia limitada en buró.',
        extracciones: [
          {
            caja_codigo: 'pc_tasas_por_producto',
            valor: {
              credito_simple_pyme: { min_pct: 13, max_pct: 17, cat_pct: 18.5 },
            },
            confianza: 0.85,
          },
          {
            caja_codigo: 'pc_plazos_por_producto',
            valor: {
              credito_simple_pyme: { min_meses: 12, max_meses: 60 },
            },
            confianza: 0.88,
          },
          {
            caja_codigo: 'pc_reglas_pricing',
            valor: 'Sube por riesgo de sector y plazo largo; baja por garantía hipotecaria',
            confianza: 0.82,
          },
          {
            caja_codigo: 'to_historial_credito',
            valor: 'Tolerancia limitada: máximo 2 retrasos de 30 días en últimos 24 meses',
            confianza: 0.88,
          },
          {
            caja_codigo: 'to_ratios_financieros',
            valor: 'DSCR ≥ 1.25, deuda/EBITDA ≤ 3.5x, capital de trabajo positivo',
            confianza: 0.9,
          },
          {
            caja_codigo: 'se_sin_historial',
            valor: { respuesta: 'no' },
            confianza: 0.9,
          },
          {
            caja_codigo: 'se_sat_32d_negativa',
            valor: { respuesta: 'no' },
            confianza: 0.92,
          },
          {
            caja_codigo: 'se_pep_estructura',
            valor: { respuesta: 'condicional', condiciones: 'Con due diligence reforzada' },
            confianza: 0.85,
          },
        ],
        siguiente_grupo: 'contacto_y_especificos',
      },
      {
        grupo: 'contacto_y_especificos',
        user_message: 'Punto de contacto: Juan Pérez, Director PyME, juan@bancodemo.com.',
        extracciones: [
          {
            caja_codigo: 'co_punto_contacto',
            valor: 'Juan Pérez, Director PyME',
            confianza: 0.95,
          },
          {
            caja_codigo: 'co_email_telefono',
            valor: { email: 'juan@bancodemo.com', telefono: '+525555551234' },
            confianza: 0.92,
          },
        ],
        siguiente_grupo: null,
      },
    ];

    // -----------------------------------------------------------------
    // Drive: 1 streamText call por grupo (= 1 user message), 2 model
    // steps cada uno (registrar_extraccion → solicitar_review_seccion).
    // -----------------------------------------------------------------
    for (const plan of PLANES) {
      const scripts: TurnScript[] = [
        {
          toolCalls: [
            {
              toolName: 'registrar_extraccion',
              input: {
                extracciones: plan.extracciones.map((e) => ({
                  ...e,
                  evidencia_textual: plan.user_message,
                })),
              },
            },
          ],
        },
        {
          toolCalls: [
            {
              toolName: 'solicitar_review_seccion',
              input: {
                grupo_ui_codigo: plan.grupo,
                extracciones_snapshot: plan.extracciones.map((e) => ({
                  caja_codigo: e.caja_codigo,
                  valor: e.valor,
                  confianza: e.confianza,
                  evidencia_textual: plan.user_message,
                  status: 'llena' as const,
                  version: 1,
                })),
                cajas_no_clausuradas: [],
                hipotesis_sonnet: `Hipótesis para ${plan.grupo}`,
                turno_disparador: 1,
              },
            },
          ],
        },
        // Tercer step: texto final, finishReason='stop'. Sin esto el SDK
        // pediría un 4to step y el helper arrojaría.
        { text: 'OK, cierro la sección.' },
      ];

      const out = await simulateUserTurn({
        sesion_id,
        user_message: plan.user_message,
        cajas_aplicables: cajasAplicables,
        scripts,
      });
      expect(out.finishReason).toBe('stop');
    }

    // -----------------------------------------------------------------
    // Aserciones globales post-conversación
    // -----------------------------------------------------------------

    // 6 user turnos + 6 agente turnos = 12 turnos persistidos.
    expect(state.turnos).toHaveLength(12);
    expect(state.turnos.filter((t) => t.rol === 'usuario')).toHaveLength(6);
    expect(state.turnos.filter((t) => t.rol === 'agente')).toHaveLength(6);

    // numero_turno consecutivo y monótono.
    const numeros = state.turnos.map((t) => t.numero_turno);
    expect(numeros).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

    // Total extracciones persistidas = sum de los 6 planes.
    const totalExtraccionesEsperadas = PLANES.reduce(
      (acc, p) => acc + p.extracciones.length,
      0
    );
    expect(state.extracciones).toHaveLength(totalExtraccionesEsperadas);

    // Ninguna extracción superseded en happy path (cada caja se extrajo una vez).
    const activas = state.extracciones.filter((x) => x.superseded_by === null);
    expect(activas).toHaveLength(totalExtraccionesEsperadas);

    // mapa final: las 6 grupos tienen al menos una caja llena.
    const activasParaMapa = await listarExtraccionesActivas(sesion_id);
    const mapaFinal = computeMapaIncertidumbre(activasParaMapa, cajasAplicables);
    const llenasPorGrupo = computeLlenasPorGrupo(mapaFinal.cajas);
    for (const grupo of GrupoUISchema.options) {
      expect(llenasPorGrupo[grupo]).toBeGreaterThan(0);
    }

    // processSolicitarReview se llamó exactamente 6 veces, en orden.
    expect(mockProcessSolicitarReview).toHaveBeenCalledTimes(6);
    const grupos = mockProcessSolicitarReview.mock.calls.map((c) => c[0].grupo_ui_codigo);
    expect(grupos).toEqual(ORDEN);

    // Última review devolvió sesion_lista_para_sintesis.
    const ultimaResp = await mockProcessSolicitarReview.mock.results[5].value;
    expect(ultimaResp.estado).toBe('sesion_lista_para_sintesis');

    // Cada turno_agente fue actualizado con texto post-stream (smoke).
    const agentes = state.turnos.filter((t) => t.rol === 'agente');
    for (const a of agentes) {
      expect(a.contenido_texto).toBe('OK, cierro la sección.');
    }
  });

  it('supersede chain: re-extraer la misma caja invalida la previa', async () => {
    const sesion_id = 'sesion-supersede';
    const cajasAplicables = getCajasAplicables('banco');
    mockProcessSolicitarReview.mockResolvedValue({
      estado: 'grupo_cerrado',
      review_id: 'rev-x',
      siguiente_grupo_ui: 'productos_y_mercado',
    });

    // Turno 1: extraer id_razon_social con valor "Banco X".
    await simulateUserTurn({
      sesion_id,
      user_message: 'Somos Banco X.',
      cajas_aplicables: cajasAplicables,
      scripts: [
        {
          toolCalls: [
            {
              toolName: 'registrar_extraccion',
              input: {
                extracciones: [
                  {
                    caja_codigo: 'id_razon_social',
                    valor: 'Banco X',
                    confianza: 0.85,
                    evidencia_textual: 'Somos Banco X',
                  },
                ],
              },
            },
          ],
        },
        { text: 'OK.' },
      ],
    });

    // Turno 2: re-extraer con valor corregido "Banco X SA de CV".
    await simulateUserTurn({
      sesion_id,
      user_message: 'Perdón, somos Banco X SA de CV.',
      cajas_aplicables: cajasAplicables,
      scripts: [
        {
          toolCalls: [
            {
              toolName: 'registrar_extraccion',
              input: {
                extracciones: [
                  {
                    caja_codigo: 'id_razon_social',
                    valor: 'Banco X SA de CV',
                    confianza: 0.95,
                    evidencia_textual: 'somos Banco X SA de CV',
                    contradice_extraccion_previa: true,
                  },
                ],
              },
            },
          ],
        },
        { text: 'Anotado.' },
      ],
    });

    // Hay 2 filas en extracciones, pero solo 1 activa (la última).
    expect(state.extracciones).toHaveLength(2);
    const activas = state.extracciones.filter((x) => x.superseded_by === null);
    expect(activas).toHaveLength(1);
    expect(activas[0].valor).toBe('Banco X SA de CV');
    // La previa ya tiene supersede.
    const previas = state.extracciones.filter((x) => x.superseded_by !== null);
    expect(previas).toHaveLength(1);
    expect(previas[0].superseded_by).toBe(activas[0].id);
  });
});
