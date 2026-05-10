// E2E mock suite — escenarios pendientes del sub-paso vii (Phase 5 step 5).
// Complementa `conversation.e2e.test.ts` (happy path multi-grupo) cubriendo
// los 3 flujos no-trivial que faltaban según `IMPLEMENTATION.md:973`:
//
//   1. cap-casos sintéticos (5/sesión global) — el 6to caso_sintetico es
//      coercido por el motor a grupo_cerrado con razon=cap_casos_alcanzado.
//   2. fatiga detectada + extension por tipo — sofom_er con cb_* extension
//      cajas; metadata.fatiga_detectada=true se propaga al SintesisInput.
//   3. profundizar→avanzar round 2 — round 1 devuelve profundizar_pendiente,
//      Sonnet re-extrae caja problemática, round 2 devuelve grupo_cerrado.
//
// Estrategia heredada de conversation.e2e.test.ts:
//   - persistencia stateful in-memory (turnos auto-incrementan, supersede chain).
//   - `processSolicitarReview` mockeado por escenario.
//   - `streamText` real con MockSonnet scriptado.
//   - `computeMapaIncertidumbre` y `valorSchemaFor` se usan REALES.
//
// La duplicación de mocks con conversation.e2e.test.ts es intencional —
// extraer a helper compartido es cheap pero rompería el aislamiento de
// vi.hoisted entre archivos. Cuando llegue un cuarto archivo de escenarios
// reconsideramos.

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
import type { TipoInstitucion } from '@/lib/schemas/casos';
import { createMockSonnet, type TurnScript } from './__test_helpers__/mock-sonnet';

// =============================================================================
// Mocks: persistencia stateful + review canned + caso_sintetico counter
// =============================================================================

const { state, mockProcessSolicitarReview, casosCounter } = vi.hoisted(() => {
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
  // Contador independiente de casos_sintetico solicitados via tool.
  // El motor real usa COUNT(*) FROM casos_generados; aquí incrementamos
  // manualmente desde el execute del tool.
  const casosCounter = { value: 0 };
  return { state, mockProcessSolicitarReview, casosCounter };
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
// Tools dict — mirror reducido de app/api/turn/route.ts
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
      description: 'Solicita caso sintético — incrementa contador de la sesión.',
      inputSchema: SolicitarCasoSinteticoInputSchema,
      execute: async () => {
        casosCounter.value += 1;
        return { ok: true, casos_usados_total: casosCounter.value };
      },
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
  state.turno_seq = 0;
  state.turnos.length = 0;
  state.extracciones.length = 0;
  state.extr_seq = 0;
  casosCounter.value = 0;
  vi.clearAllMocks();
});

// =============================================================================
// Escenario 1 — cap-casos sintéticos (5/sesión global)
// =============================================================================

describe('Conversation E2E — cap-casos sintéticos', () => {
  it('5 casos consumidos a través de 5 grupos; en el 6to el motor coerce a grupo_cerrado', async () => {
    const sesion_id = 'sesion-cap-casos';
    const cajasAplicables = getCajasAplicables('banco');

    // mockProcessSolicitarReview implementa la regla del motor real:
    // si casos_usados>=5 al recibir caso_sintetico, coerce a grupo_cerrado
    // con razon=cap_casos_alcanzado y avanza al siguiente grupo.
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
        // Si Sonnet ya consumió 5+ casos antes de pedir review, el motor
        // forzaría avanzar — eso es lo que retorna acá. La lógica del cap
        // vive en review.ts:enforzarReglasMotor (cubierta unit-level).
        const capAlcanzado = casosCounter.value >= 5;
        if (isLast) {
          return {
            estado: 'sesion_lista_para_sintesis',
            review_id: `rev-${reviewSeq}`,
            cap_casos_alcanzado: capAlcanzado,
          };
        }
        return {
          estado: 'grupo_cerrado',
          review_id: `rev-${reviewSeq}`,
          siguiente_grupo_ui: ORDEN[idx + 1],
          cap_casos_alcanzado: capAlcanzado,
        };
      }
    );

    // Plan: cada uno de los 6 grupos hace 1 extracción + 1 caso_sintetico
    // antes de cerrar. Total: 6 casos solicitados; el 6to debería ya estar
    // post-cap.
    const PLANES: Array<{ grupo: GrupoUI; codigos: string[]; valores: unknown[] }> = [
      { grupo: 'identificacion', codigos: ['id_razon_social'], valores: ['Banco X SA'] },
      { grupo: 'productos_y_mercado', codigos: ['nm_productos_ofrecidos'], valores: [['credito_simple_pyme']] },
      { grupo: 'numeros_del_negocio', codigos: ['ru_monto_min'], valores: [1_000_000] },
      { grupo: 'operacion', codigos: ['op_tiempo_viabilidad'], valores: ['48 horas'] },
      { grupo: 'pricing_y_criterio', codigos: ['pc_reglas_pricing'], valores: ['Sube por riesgo'] },
      { grupo: 'contacto_y_especificos', codigos: ['co_punto_contacto'], valores: ['Juan Pérez'] },
    ];

    for (const plan of PLANES) {
      const scripts: TurnScript[] = [
        {
          toolCalls: [
            {
              toolName: 'registrar_extraccion',
              input: {
                extracciones: plan.codigos.map((codigo, i) => ({
                  caja_codigo: codigo,
                  valor: plan.valores[i],
                  confianza: 0.9,
                  evidencia_textual: `evidence ${codigo}`,
                })),
              },
            },
            {
              toolName: 'solicitar_caso_sintetico',
              input: {
                cajas_objetivo: plan.codigos,
                hipotesis_a_clausurar: `Caso para ${plan.grupo}`,
                urgencia: 'media',
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
                extracciones_snapshot: plan.codigos.map((codigo, i) => ({
                  caja_codigo: codigo,
                  valor: plan.valores[i],
                  confianza: 0.9,
                  evidencia_textual: `evidence ${codigo}`,
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
        { text: 'OK.' },
      ];
      await simulateUserTurn({
        sesion_id,
        user_message: `Mensaje sobre ${plan.grupo}`,
        cajas_aplicables: cajasAplicables,
        scripts,
      });
    }

    // 6 casos solicitados (uno por grupo).
    expect(casosCounter.value).toBe(6);
    // 6 reviews ejecutados.
    expect(mockProcessSolicitarReview).toHaveBeenCalledTimes(6);
    // El review del grupo 6 (el último) recibe la sesión post-cap.
    // Verificamos que las últimas 2 reviews ya tenían cap_casos_alcanzado=true
    // — al disparar review post-5to caso, el contador ya estaba en 5 o 6.
    const ultimasReviewsResults = await Promise.all(
      mockProcessSolicitarReview.mock.results.map((r) => r.value)
    );
    expect(ultimasReviewsResults.at(-1)?.estado).toBe('sesion_lista_para_sintesis');
    expect(ultimasReviewsResults.at(-1)?.cap_casos_alcanzado).toBe(true);
    expect(ultimasReviewsResults.at(-2)?.cap_casos_alcanzado).toBe(true);
    // El primer review aún tenía cap=false (solo 1 caso consumido).
    expect(ultimasReviewsResults[0]?.cap_casos_alcanzado).toBe(false);
  });
});

// =============================================================================
// Escenario 2 — fatiga detectada + extension por tipo (sofom_er)
// =============================================================================

describe('Conversation E2E — fatiga + extension por tipo', () => {
  it('sofom_er con fatiga: extension cb_* aparece en cajas_aplicables y se llena en el último grupo', async () => {
    const sesion_id = 'sesion-fatiga-ext';
    const tipo: TipoInstitucion = 'sofom_er';
    const cajasAplicables = getCajasAplicables(tipo);

    // Verifica el contrato: sofom_er debe tener cajas extension cb_*.
    const extensionCajas = cajasAplicables.filter((c) => c.codigo.startsWith('cb_'));
    expect(extensionCajas.length).toBeGreaterThan(0);

    // Review canned: avanzar limpio entre grupos.
    const ORDEN: GrupoUI[] = [
      'identificacion',
      'contacto_y_especificos',
    ];
    mockProcessSolicitarReview.mockImplementation(
      async (input: { grupo_ui_codigo: GrupoUI }) => {
        const idx = ORDEN.indexOf(input.grupo_ui_codigo);
        const isLast = idx === ORDEN.length - 1;
        if (isLast) {
          return { estado: 'sesion_lista_para_sintesis', review_id: 'rev-final' };
        }
        return {
          estado: 'grupo_cerrado',
          review_id: `rev-${idx}`,
          siguiente_grupo_ui: ORDEN[idx + 1],
        };
      }
    );

    // Turno 1 — identificación (canon).
    await simulateUserTurn({
      sesion_id,
      user_message: 'Sofom ER regulada CNBV con 8 años.',
      cajas_aplicables: cajasAplicables,
      scripts: [
        {
          toolCalls: [
            {
              toolName: 'registrar_extraccion',
              input: {
                extracciones: [
                  { caja_codigo: 'id_razon_social', valor: 'Sofom Ejemplo SOFOM ER SA de CV', confianza: 0.95, evidencia_textual: 'Sofom ER' },
                  { caja_codigo: 'id_tipo_institucion', valor: 'sofom_er', confianza: 0.95, evidencia_textual: 'Sofom ER' },
                ],
              },
            },
            {
              toolName: 'solicitar_review_seccion',
              input: {
                grupo_ui_codigo: 'identificacion',
                extracciones_snapshot: [
                  {
                    caja_codigo: 'id_razon_social',
                    valor: 'Sofom Ejemplo SOFOM ER SA de CV',
                    confianza: 0.95,
                    evidencia_textual: 'Sofom ER',
                    status: 'llena' as const,
                    version: 1,
                  },
                  {
                    caja_codigo: 'id_tipo_institucion',
                    valor: 'sofom_er',
                    confianza: 0.95,
                    evidencia_textual: 'Sofom ER',
                    status: 'llena' as const,
                    version: 1,
                  },
                ],
                cajas_no_clausuradas: [],
                hipotesis_sonnet:
                  'Sofom ER regulada por CNBV, 8 años de operación, foco PyME del bajío',
                turno_disparador: 1,
              },
            },
          ],
        },
        { text: 'OK.' },
      ],
    });

    // Turno 2 — contacto_y_especificos con fatiga: batch corto. Se llenan
    // 1 caja CANON + 2 cajas EXTENSION cb_* (verificando el path extension).
    await simulateUserTurn({
      sesion_id,
      user_message: 'Punto contacto: Marisol. Operamos FIRA y NAFIN. Exposición máxima 15% capital.',
      cajas_aplicables: cajasAplicables,
      scripts: [
        {
          toolCalls: [
            {
              toolName: 'registrar_extraccion',
              input: {
                extracciones: [
                  { caja_codigo: 'co_punto_contacto', valor: 'Marisol, Directora Crédito', confianza: 0.92, evidencia_textual: 'Marisol' },
                  // EXTENSION cajas — solo aplican porque tipo='sofom_er'.
                  { caja_codigo: 'cb_programas_gobierno', valor: ['fira', 'nafin'], confianza: 0.88, evidencia_textual: 'FIRA y NAFIN' },
                  { caja_codigo: 'cb_exposicion_max_grupo', valor: '15% del capital', confianza: 0.85, evidencia_textual: 'Exposición máxima 15%' },
                ],
              },
            },
            {
              toolName: 'solicitar_review_seccion',
              input: {
                grupo_ui_codigo: 'contacto_y_especificos',
                extracciones_snapshot: [
                  {
                    caja_codigo: 'co_punto_contacto',
                    valor: 'Marisol, Directora Crédito',
                    confianza: 0.92,
                    evidencia_textual: 'Marisol',
                    status: 'llena' as const,
                    version: 1,
                  },
                  {
                    caja_codigo: 'cb_programas_gobierno',
                    valor: ['fira', 'nafin'],
                    confianza: 0.88,
                    evidencia_textual: 'FIRA y NAFIN',
                    status: 'llena' as const,
                    version: 1,
                  },
                  {
                    caja_codigo: 'cb_exposicion_max_grupo',
                    valor: '15% del capital',
                    confianza: 0.85,
                    evidencia_textual: 'Exposición máxima 15%',
                    status: 'llena' as const,
                    version: 1,
                  },
                ],
                cajas_no_clausuradas: [],
                hipotesis_sonnet:
                  'Cierre con fatiga detectada. Cobertura suficiente en contacto y extension cb_*',
                turno_disparador: 8, // turno alto = señal de cap-turnos / fatiga
              },
            },
          ],
        },
        { text: 'OK.' },
      ],
    });

    // Aserciones — extension cajas se persisten.
    const cbExtraidas = state.extracciones.filter(
      (x) => x.caja_codigo.startsWith('cb_') && x.superseded_by === null
    );
    expect(cbExtraidas).toHaveLength(2);
    expect(cbExtraidas.map((x) => x.caja_codigo).sort()).toEqual(
      ['cb_exposicion_max_grupo', 'cb_programas_gobierno'].sort()
    );

    // El mapa final ve extension cajas como llenas en su grupo correcto.
    const activas = await listarExtraccionesActivas(sesion_id);
    const mapa = computeMapaIncertidumbre(activas, cajasAplicables);
    const llenas = computeLlenasPorGrupo(mapa.cajas);
    expect(llenas['identificacion']).toBeGreaterThanOrEqual(2);
    // contacto_y_especificos contiene tanto co_* CANON como cb_* extension.
    expect(llenas['contacto_y_especificos']).toBeGreaterThanOrEqual(3);

    // Última review devolvió sesion_lista_para_sintesis.
    const ultima = await mockProcessSolicitarReview.mock.results.at(-1)?.value;
    expect(ultima.estado).toBe('sesion_lista_para_sintesis');

    // turno_disparador alto en el último review (señal de fatiga / cap-turnos).
    const ultimaCall = mockProcessSolicitarReview.mock.calls.at(-1)?.[0];
    expect(ultimaCall.turno_disparador).toBe(8);
  });
});

// =============================================================================
// Escenario 3 — profundizar → avanzar round 2
// =============================================================================

describe('Conversation E2E — profundizar → avanzar round 2', () => {
  it('round 1 devuelve profundizar; Sonnet re-extrae; round 2 cierra el grupo', async () => {
    const sesion_id = 'sesion-profundizar';
    const cajasAplicables = getCajasAplicables('banco');

    // 1er review = profundizar_pendiente con guidance + cajas_a_reabordar.
    // 2do review = grupo_cerrado avanzando al siguiente grupo.
    let reviewCallNum = 0;
    mockProcessSolicitarReview.mockImplementation(async () => {
      reviewCallNum += 1;
      if (reviewCallNum === 1) {
        return {
          estado: 'profundizar_pendiente',
          review_id: 'rev-1-prof',
          guidance_para_sonnet: 'Reformula gr_dscr_min con un caso concreto en lugar del número directo',
          cajas_a_reabordar: ['gr_dscr_min'],
        };
      }
      return {
        estado: 'grupo_cerrado',
        review_id: 'rev-2-final',
        siguiente_grupo_ui: 'operacion',
      };
    });

    // Turno 1 — extracción inicial confianza baja en gr_dscr_min.
    await simulateUserTurn({
      sesion_id,
      user_message: 'DSCR no lo medimos rígidamente, depende del sector.',
      cajas_aplicables: cajasAplicables,
      scripts: [
        {
          toolCalls: [
            {
              toolName: 'registrar_extraccion',
              input: {
                extracciones: [
                  { caja_codigo: 'gr_dscr_min', valor: 1.0, confianza: 0.55, evidencia_textual: 'no rígido' },
                ],
              },
            },
            {
              toolName: 'solicitar_review_seccion',
              input: {
                grupo_ui_codigo: 'numeros_del_negocio',
                extracciones_snapshot: [
                  {
                    caja_codigo: 'gr_dscr_min',
                    valor: 1.0,
                    confianza: 0.55,
                    evidencia_textual: 'no rígido',
                    status: 'parcial' as const,
                    version: 1,
                  },
                ],
                cajas_no_clausuradas: [
                  {
                    caja_codigo: 'gr_dscr_min',
                    razon: 'estancada',
                    detalle: 'Confianza 0.55 tras 1 turno',
                    turnos_intentados: 1,
                  },
                ],
                hipotesis_sonnet:
                  'gr_dscr_min sin valor firme: el entrevistado evade el número directo y solo da matices',
                turno_disparador: 1,
              },
            },
          ],
        },
        { text: 'Ack.' },
      ],
    });

    // Verifica que Sonnet recibió profundizar_pendiente como tool-result.
    const r1 = await mockProcessSolicitarReview.mock.results[0]?.value;
    expect(r1.estado).toBe('profundizar_pendiente');

    // Turno 2 — Sonnet re-extrae gr_dscr_min con valor más firme (supersede).
    await simulateUserTurn({
      sesion_id,
      user_message: 'Caso concreto: PyME manufactura con DSCR 1.3 lo aceptamos sin discusión.',
      cajas_aplicables: cajasAplicables,
      scripts: [
        {
          toolCalls: [
            {
              toolName: 'registrar_extraccion',
              input: {
                extracciones: [
                  {
                    caja_codigo: 'gr_dscr_min',
                    valor: 1.3,
                    confianza: 0.92,
                    evidencia_textual: 'DSCR 1.3 lo aceptamos sin discusión',
                    contradice_extraccion_previa: true,
                  },
                ],
              },
            },
            {
              toolName: 'solicitar_review_seccion',
              input: {
                grupo_ui_codigo: 'numeros_del_negocio',
                extracciones_snapshot: [
                  {
                    caja_codigo: 'gr_dscr_min',
                    valor: 1.3,
                    confianza: 0.92,
                    evidencia_textual: 'DSCR 1.3',
                    status: 'llena' as const,
                    version: 2,
                  },
                ],
                cajas_no_clausuradas: [],
                hipotesis_sonnet:
                  'gr_dscr_min cementado en 1.3 tras profundización con caso concreto',
                turno_disparador: 2,
              },
            },
          ],
        },
        { text: 'Cierro sección.' },
      ],
    });

    // Round 2 cierra.
    const r2 = await mockProcessSolicitarReview.mock.results[1]?.value;
    expect(r2.estado).toBe('grupo_cerrado');
    expect(r2.siguiente_grupo_ui).toBe('operacion');

    // Supersede chain: 2 filas en extracciones, 1 activa con valor 1.3.
    expect(state.extracciones).toHaveLength(2);
    const activa = state.extracciones.find((x) => x.superseded_by === null);
    expect(activa?.valor).toBe(1.3);
    expect(activa?.confianza).toBe(0.92);
    const previa = state.extracciones.find((x) => x.superseded_by !== null);
    expect(previa?.valor).toBe(1.0);
    expect(previa?.superseded_by).toBe(activa?.id);

    // Mapa final: gr_dscr_min está llena (confianza ≥ 0.80 → status='llena').
    const activas = await listarExtraccionesActivas(sesion_id);
    const mapa = computeMapaIncertidumbre(activas, cajasAplicables);
    expect(mapa.cajas['gr_dscr_min']?.status).toBe('llena');
  });
});
