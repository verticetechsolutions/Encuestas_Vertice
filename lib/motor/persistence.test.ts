import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// Mocks hoisted (mismo patrón que review.test.ts).
//
// `mockDb` expone insert/update/select/execute/transaction. Cada test las
// configura para devolver el shape mínimo que persistence.ts consume.
//
// Para `transaction`: el callback recibe un `tx` con la misma forma que `db`
// (subset usado: insert + update). La default impl invoca el callback con
// `mockDb` directamente para no duplicar fixtures — los tests sobreescriben
// cuando necesitan instrumentación específica.
// =============================================================================

const { mockDb } = vi.hoisted(() => {
  return {
    mockDb: {
      insert: vi.fn(),
      update: vi.fn(),
      select: vi.fn(),
      execute: vi.fn(),
      transaction: vi.fn(),
    },
  };
});

vi.mock('@/lib/db', () => ({ db: mockDb }));

import {
  persistirTurnoUsuario,
  persistirTurnoAgente,
  persistirExtraccionesBatch,
  siguienteNumeroTurno,
  ExtraccionInvalidaError,
  actualizarContenidoTurnoAgente,
} from './persistence';

// =============================================================================
// Helpers
// =============================================================================

/**
 * Drizzle expone builders chainables (insert().values().returning(),
 * update().set().where().returning(), etc.). En los mocks devolvemos un objeto
 * con todos los métodos relevantes que se auto-encadenan, y un `then` que
 * resuelve al value provisto. Permite `await query.returning()` y también
 * `await query` directo.
 */
function chainableResolves<T>(value: T) {
  const methods = [
    'values',
    'set',
    'where',
    'limit',
    'returning',
    'from',
    'orderBy',
    'groupBy',
    'leftJoin',
    'innerJoin',
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj: any = {};
  for (const m of methods) {
    obj[m] = vi.fn(() => obj);
  }
  obj.then = (
    onFulfilled?: (v: T) => unknown,
    onRejected?: (e: unknown) => unknown
  ) => Promise.resolve(value).then(onFulfilled, onRejected);
  return obj;
}

const SESION_ID = '11111111-1111-1111-1111-111111111111';
const TURNO_AGENTE_ID = '22222222-2222-2222-2222-222222222222';

// =============================================================================
// siguienteNumeroTurno
// =============================================================================

describe('siguienteNumeroTurno', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna 1 cuando no hay turnos previos (COALESCE)', async () => {
    mockDb.execute.mockResolvedValueOnce([{ siguiente: 1 }]);
    const n = await siguienteNumeroTurno(SESION_ID);
    expect(n).toBe(1);
    expect(mockDb.execute).toHaveBeenCalledOnce();
  });

  it('retorna N+1 cuando hay N turnos previos', async () => {
    mockDb.execute.mockResolvedValueOnce([{ siguiente: 8 }]);
    const n = await siguienteNumeroTurno(SESION_ID);
    expect(n).toBe(8);
  });
});

// =============================================================================
// persistirTurnoUsuario
// =============================================================================

describe('persistirTurnoUsuario', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserta con numero_turno=1 cuando no hay turnos previos', async () => {
    mockDb.execute.mockResolvedValueOnce([
      { id: 'turno-uuid-1', numero_turno: 1 },
    ]);

    const out = await persistirTurnoUsuario({
      sesion_id: SESION_ID,
      contenido_texto: 'Hola, soy de Demo SA',
      fuente: 'usuario_tipea',
    });

    expect(out).toEqual({ turno_id: 'turno-uuid-1', numero_turno: 1 });
    expect(mockDb.execute).toHaveBeenCalledOnce();
    // Verificamos que la SQL contenga el patrón atómico COALESCE(MAX...) +1.
    const sqlArg = mockDb.execute.mock.calls[0]?.[0];
    const serialized = JSON.stringify(sqlArg);
    expect(serialized).toContain('COALESCE');
    expect(serialized).toContain('MAX(numero_turno)');
    expect(serialized).toContain('INSERT INTO turnos_conversacion');
    expect(serialized).toContain('RETURNING');
  });

  it('inserta con numero_turno=N+1 cuando ya hay N turnos previos', async () => {
    mockDb.execute.mockResolvedValueOnce([
      { id: 'turno-uuid-7', numero_turno: 7 },
    ]);

    const out = await persistirTurnoUsuario({
      sesion_id: SESION_ID,
      contenido_texto: 'Respuesta al turno 7',
      fuente: 'usuario_tipea',
    });

    expect(out).toEqual({ turno_id: 'turno-uuid-7', numero_turno: 7 });
  });

  it('arroja si la SQL no retorna fila (caso patológico)', async () => {
    mockDb.execute.mockResolvedValueOnce([]);

    await expect(
      persistirTurnoUsuario({
        sesion_id: SESION_ID,
        contenido_texto: 'x',
        fuente: 'usuario_tipea',
      })
    ).rejects.toThrow(/INSERT no retornó fila/);
  });

  it('soporta fuente usuario_voz (Fase 6 Deepgram)', async () => {
    mockDb.execute.mockResolvedValueOnce([{ id: 'voz-uuid', numero_turno: 3 }]);

    await persistirTurnoUsuario({
      sesion_id: SESION_ID,
      contenido_texto: 'transcripción de voz',
      fuente: 'usuario_voz',
    });

    // El parámetro 'usuario_voz' debe aparecer serializado en algún chunk del
    // SQL emitido (cast a fuente_turno).
    const sqlArg = mockDb.execute.mock.calls[0]?.[0];
    const serialized = JSON.stringify(sqlArg);
    expect(serialized).toContain('usuario_voz');
  });
});

// =============================================================================
// persistirTurnoAgente
// =============================================================================

describe('persistirTurnoAgente', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserta turno agente Sonnet con métricas de tokens y latencia', async () => {
    mockDb.execute.mockResolvedValueOnce([
      { id: 'turno-agt-uuid', numero_turno: 4 },
    ]);

    const out = await persistirTurnoAgente({
      sesion_id: SESION_ID,
      contenido_texto: 'Entendido, aclaremos su tolerancia a buró',
      fuente: 'sonnet_genera',
      modelo_llm: 'claude-sonnet-4-6',
      tokens_input: 1200,
      tokens_output: 250,
      latencia_ms: 980,
    });

    expect(out).toEqual({ turno_id: 'turno-agt-uuid', numero_turno: 4 });
    const sqlArg = mockDb.execute.mock.calls[0]?.[0];
    const serialized = JSON.stringify(sqlArg);
    expect(serialized).toContain('claude-sonnet-4-6');
    expect(serialized).toContain('sonnet_genera');
  });

  it('soporta turno agente sin métricas (placeholder al inicio del stream)', async () => {
    mockDb.execute.mockResolvedValueOnce([
      { id: 'placeholder-uuid', numero_turno: 2 },
    ]);

    const out = await persistirTurnoAgente({
      sesion_id: SESION_ID,
      contenido_texto: '',
      fuente: 'sonnet_genera',
      modelo_llm: 'claude-sonnet-4-6',
      // sin tokens_input/output/latencia_ms
    });

    expect(out.turno_id).toBe('placeholder-uuid');
  });
});

// =============================================================================
// actualizarContenidoTurnoAgente
// =============================================================================

describe('actualizarContenidoTurnoAgente', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('UPDATE con contenido y métricas (cierre normal del stream)', async () => {
    const setSpy = vi.fn(() => chainableResolves(undefined));
    mockDb.update.mockImplementation(() => ({ set: setSpy }));

    await actualizarContenidoTurnoAgente({
      turno_id: TURNO_AGENTE_ID,
      contenido_texto: 'Texto final acumulado del stream',
      tokens_input: 1500,
      tokens_output: 300,
      latencia_ms: 2100,
    });

    expect(mockDb.update).toHaveBeenCalledOnce();
    expect(setSpy).toHaveBeenCalledWith({
      contenido_texto: 'Texto final acumulado del stream',
      tokens_input: 1500,
      tokens_output: 300,
      latencia_ms: 2100,
    });
  });

  it('UPDATE solo contenido cuando no hay métricas', async () => {
    const setSpy = vi.fn(() => chainableResolves(undefined));
    mockDb.update.mockImplementation(() => ({ set: setSpy }));

    await actualizarContenidoTurnoAgente({
      turno_id: TURNO_AGENTE_ID,
      contenido_texto: 'solo texto',
    });

    expect(setSpy).toHaveBeenCalledWith({
      contenido_texto: 'solo texto',
    });
  });
});

// =============================================================================
// persistirExtraccionesBatch
// =============================================================================
//
// Para los tests del batch, mockeamos `db.transaction` para ejecutar el
// callback con un `tx` controlado. El `tx` expone insert + update con el shape
// que persistirExtraccionesBatch consume:
//   tx.insert(table).values({...}).returning({id}) → [{id: 'nuevo'}]
//   tx.update(table).set({...}).where(...).returning({id}) → [{id: 'previo'}] o []
// =============================================================================

interface TxMockConfig {
  /**
   * Cola de ids retornados por cada INSERT (en orden de invocación).
   * Si vacío, defaultea a 'ext-N' donde N es el índice.
   */
  insertReturnIds?: string[];
  /**
   * Cola de respuestas para cada UPDATE de supersede. Cada elemento es la lista
   * de filas previas que el UPDATE marcó. `[]` significa "sin previa".
   */
  updateReturnRows?: Array<Array<{ id: string }>>;
  /**
   * Inyectar error en el INSERT N. Si presente, ese INSERT arroja.
   */
  failInsertAt?: number;
}

function setupTxMock(cfg: TxMockConfig = {}) {
  const insertCalls: Array<Record<string, unknown>> = [];
  const updateCalls: Array<{
    set: Record<string, unknown>;
    whereInvoked: boolean;
  }> = [];

  let insertIdx = 0;
  let updateIdx = 0;

  const tx = {
    insert: vi.fn(() => ({
      values: vi.fn((vals: Record<string, unknown>) => {
        insertCalls.push(vals);
        return {
          returning: vi.fn(() => {
            const id =
              cfg.insertReturnIds?.[insertIdx] ??
              `ext-auto-${insertIdx}`;
            const failAt = cfg.failInsertAt;
            const idxNow = insertIdx;
            insertIdx++;
            if (failAt === idxNow) {
              return Promise.reject(new Error('SIMULATED_INSERT_FAILURE'));
            }
            return Promise.resolve([{ id }]);
          }),
        };
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((s: Record<string, unknown>) => ({
        where: vi.fn(() => {
          updateCalls.push({ set: s, whereInvoked: true });
          return {
            returning: vi.fn(() => {
              const rows =
                cfg.updateReturnRows?.[updateIdx] ?? [];
              updateIdx++;
              return Promise.resolve(rows);
            }),
          };
        }),
      })),
    })),
  };

  // db.transaction llama el callback con el tx. Si el callback arroja, hacemos
  // pasar la excepción para simular el rollback (drizzle hace lo mismo).
  mockDb.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
    return await fn(tx);
  });

  return { insertCalls, updateCalls };
}

describe('persistirExtraccionesBatch — happy path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserta una caja sin previa (no supersede)', async () => {
    const { insertCalls, updateCalls } = setupTxMock({
      insertReturnIds: ['ext-new-1'],
      updateReturnRows: [[]], // UPDATE no encontró previa
    });

    const out = await persistirExtraccionesBatch({
      sesion_id: SESION_ID,
      turno_id: TURNO_AGENTE_ID,
      extracciones: [
        {
          caja_codigo: 'id_razon_social',
          valor: 'Demo SA de CV',
          confianza: 0.95,
          evidencia_textual: 'somos Demo SA de CV',
        },
      ],
    });

    expect(out).toEqual([
      { caja_codigo: 'id_razon_social', extraccion_id: 'ext-new-1' },
      // sin supersedido_id porque el UPDATE retornó []
    ]);
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0]).toMatchObject({
      sesion_id: SESION_ID,
      turno_id: TURNO_AGENTE_ID,
      caja_codigo: 'id_razon_social',
      fuente: 'llm',
    });
    expect(updateCalls).toHaveLength(1); // UPDATE atómico que comprueba si había previa
  });

  it('dispara supersede cuando hay previa no superseded', async () => {
    setupTxMock({
      insertReturnIds: ['ext-new-2'],
      updateReturnRows: [[{ id: 'ext-old-2' }]], // UPDATE marcó la previa
    });

    const out = await persistirExtraccionesBatch({
      sesion_id: SESION_ID,
      turno_id: TURNO_AGENTE_ID,
      extracciones: [
        {
          caja_codigo: 'id_razon_social',
          valor: 'Demo SAPI de CV',
          confianza: 0.97,
          evidencia_textual: 'corregimos: somos Demo SAPI de CV',
        },
      ],
    });

    expect(out).toEqual([
      {
        caja_codigo: 'id_razon_social',
        extraccion_id: 'ext-new-2',
        supersedido_id: 'ext-old-2',
      },
    ]);
  });

  it('múltiples cajas, una con previa otra sin', async () => {
    setupTxMock({
      insertReturnIds: ['ext-A', 'ext-B'],
      updateReturnRows: [
        [{ id: 'ext-A-old' }], // primera tenía previa
        [], // segunda no
      ],
    });

    const out = await persistirExtraccionesBatch({
      sesion_id: SESION_ID,
      turno_id: TURNO_AGENTE_ID,
      extracciones: [
        {
          caja_codigo: 'id_razon_social',
          valor: 'Demo SA',
          confianza: 0.9,
          evidencia_textual: 'somos Demo SA',
        },
        {
          caja_codigo: 'id_rfc',
          valor: 'DEM010101AAA',
          confianza: 0.92,
          evidencia_textual: 'nuestro RFC es DEM010101AAA',
        },
      ],
    });

    expect(out).toEqual([
      {
        caja_codigo: 'id_razon_social',
        extraccion_id: 'ext-A',
        supersedido_id: 'ext-A-old',
      },
      {
        caja_codigo: 'id_rfc',
        extraccion_id: 'ext-B',
        // sin supersedido_id
      },
    ]);
  });
});

describe('persistirExtraccionesBatch — validación', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('arroja ExtraccionInvalidaError cuando valorSchemaFor falla (rollback)', async () => {
    setupTxMock({});

    // co_email_telefono espera { email, telefono } objetos válidos.
    // Mandamos un string → falla parse → ExtraccionInvalidaError.
    await expect(
      persistirExtraccionesBatch({
        sesion_id: SESION_ID,
        turno_id: TURNO_AGENTE_ID,
        extracciones: [
          {
            caja_codigo: 'co_email_telefono',
            valor: 'no-soy-un-objeto',
            confianza: 0.9,
            evidencia_textual: 'mi correo es x',
          },
        ],
      })
    ).rejects.toBeInstanceOf(ExtraccionInvalidaError);
  });

  it('rollback de toda la transacción: si una caja en medio falla, las anteriores no quedan', async () => {
    // Estrategia: tres extracciones [valid, invalid, valid]. La segunda falla
    // → mockDb.transaction propaga, ninguna se persiste. Aunque el primer INSERT
    // ya se llamó dentro del callback, drizzle haría rollback en producción.
    // Aquí verificamos que la función SÍ arroja con shape correcto y reporta el
    // índice 1 (no 0 ni 2).
    setupTxMock({ insertReturnIds: ['ext-OK-0'] });

    const promesa = persistirExtraccionesBatch({
      sesion_id: SESION_ID,
      turno_id: TURNO_AGENTE_ID,
      extracciones: [
        {
          caja_codigo: 'id_razon_social',
          valor: 'Demo SA',
          confianza: 0.9,
          evidencia_textual: 'somos Demo SA',
        },
        {
          // se_sin_historial espera SituacionEspecialSchema (objeto). Le mandamos
          // un boolean → falla.
          caja_codigo: 'se_sin_historial',
          valor: true,
          confianza: 0.8,
          evidencia_textual: 'no tenemos historial',
        },
        {
          caja_codigo: 'id_rfc',
          valor: 'DEM010101AAA',
          confianza: 0.92,
          evidencia_textual: 'RFC',
        },
      ],
    });

    await expect(promesa).rejects.toBeInstanceOf(ExtraccionInvalidaError);
    await expect(promesa).rejects.toMatchObject({
      caja_codigo: 'se_sin_historial',
      indice: 1,
    });
  });

  it('valor válido se persiste con shape parseado por el sub-schema', async () => {
    const { insertCalls } = setupTxMock({
      insertReturnIds: ['ext-eeff'],
      updateReturnRows: [[]],
    });

    await persistirExtraccionesBatch({
      sesion_id: SESION_ID,
      turno_id: TURNO_AGENTE_ID,
      extracciones: [
        {
          caja_codigo: 'op_eeff_auditados',
          valor: { politica: 'desde_monto', monto_min_mxn: 5000000 },
          confianza: 0.9,
          evidencia_textual: 'pedimos auditados desde 5M',
        },
      ],
    });

    expect(insertCalls[0]).toMatchObject({
      caja_codigo: 'op_eeff_auditados',
      valor: { politica: 'desde_monto', monto_min_mxn: 5000000 },
    });
  });
});

describe('persistirExtraccionesBatch — duplicados intra-batch (determinismo)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Decisión documentada en persistence.ts: si un mismo batch trae dos
  // extracciones para la misma caja, se persisten en orden de input. La
  // primera queda como "previa no superseded", luego la segunda se persiste y
  // el UPDATE de supersede la marca. Resultado: solo la última queda con
  // superseded_by IS NULL. Este test verifica que ambos INSERTs se ejecutan y
  // que ambos UPDATEs (intentos de supersede) se invocan.
  it('dos extracciones del mismo batch para la misma caja → ambas persisten', async () => {
    const { insertCalls, updateCalls } = setupTxMock({
      insertReturnIds: ['ext-first', 'ext-second'],
      updateReturnRows: [
        [], // primer UPDATE: no había previa antes del batch
        [{ id: 'ext-first' }], // segundo UPDATE: el "first" es ahora la previa, lo supersedea
      ],
    });

    const out = await persistirExtraccionesBatch({
      sesion_id: SESION_ID,
      turno_id: TURNO_AGENTE_ID,
      extracciones: [
        {
          caja_codigo: 'id_razon_social',
          valor: 'Demo SA',
          confianza: 0.85,
          evidencia_textual: 'somos Demo SA',
        },
        {
          caja_codigo: 'id_razon_social',
          valor: 'Demo SAPI de CV',
          confianza: 0.95,
          evidencia_textual: 'aclaramos: Demo SAPI de CV',
        },
      ],
    });

    expect(out).toEqual([
      { caja_codigo: 'id_razon_social', extraccion_id: 'ext-first' },
      {
        caja_codigo: 'id_razon_social',
        extraccion_id: 'ext-second',
        supersedido_id: 'ext-first',
      },
    ]);
    expect(insertCalls).toHaveLength(2);
    expect(updateCalls).toHaveLength(2);
  });
});
