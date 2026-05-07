// Vitest suite para lib/motor/sintesis_final.ts (Fase 8 scaffold).
//
// Patrón de mocks idéntico a persistence.test.ts y review.test.ts: vi.hoisted
// + chainableResolves para los builders de Drizzle.
//
// Lo que cubre:
//   - productionOpusSintesisCall arroja OpusSintesisPromptNotReady mientras
//     OPUS_SINTESIS_FINAL_PROMPT_READY=false.
//   - generarSintesis valida output con PerfilDecisionFinalConsistenteSchema:
//     output válido pasa, output con metricas inconsistentes lanza
//     SintesisValidacionError con `issues`.
//   - persistirPerfil computa version=N+1 desde el max actual y emite el
//     INSERT con shape correcto.
//   - marcarSesionCompleta y marcarSesionAbandonada respetan el guard de
//     status='sintetizando'.
//   - procesarSintesisFinal orquesta build → opus → persist → marcar y
//     retorna shape coherente.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDb } = vi.hoisted(() => {
  return {
    mockDb: {
      insert: vi.fn(),
      update: vi.fn(),
      select: vi.fn(),
      execute: vi.fn(),
    },
  };
});

vi.mock('@/lib/db', () => ({ db: mockDb }));

// El logger mockeado evita ruido en stdout durante tests + nos permite
// asertar emisiones (e.g. transicion_noop).
const { mockLogger } = vi.hoisted(() => ({
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    review: { resultado: vi.fn(), profundizacionCajaCollateral: vi.fn() },
    extraccion: { contradiceSinPrevia: vi.fn() },
    decline: { registrado: vi.fn() },
    caso: { consumidoPorGrupo: vi.fn() },
    sesion: { listaParaSintesis: vi.fn(), sintesisFailed: vi.fn() },
    flush: vi.fn(),
  },
}));
vi.mock('@/lib/observability/axiom', () => ({ logger: mockLogger }));

import {
  productionOpusSintesisCall,
  generarSintesis,
  persistirPerfil,
  marcarSesionCompleta,
  marcarSesionAbandonada,
  procesarSintesisFinal,
  OpusSintesisPromptNotReady,
  SintesisValidacionError,
  type SintesisInput,
} from './sintesis_final';
import type { PerfilDecisionFinal } from '@/lib/schemas/perfil_decision_final';

// =============================================================================
// Helper: chainable Drizzle builder
// =============================================================================

function chainableResolves<T>(value: T) {
  const methods = ['values', 'set', 'where', 'limit', 'returning', 'from', 'orderBy', 'groupBy'];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj: any = {};
  for (const m of methods) obj[m] = vi.fn(() => obj);
  obj.then = (onFulfilled?: (v: T) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(value).then(onFulfilled, onRejected);
  return obj;
}

// =============================================================================
// Fixtures
// =============================================================================

// UUIDs v4-compliant (Zod v4 enforza formato estricto: 3rd group 4xxx, 4th group 8/9/a/b xxx).
const INSTITUCION_ID = '11111111-1111-4111-8111-111111111111';
const SESION_ID = '22222222-2222-4222-8222-222222222222';
const PERFIL_ID = '33333333-3333-4333-8333-333333333333';

function perfilValido(overrides: Partial<PerfilDecisionFinal> = {}): PerfilDecisionFinal {
  return {
    schema_version: '1.0',
    institucion: {
      id: INSTITUCION_ID,
      razon_social: 'Atlas Financiera S.A.',
      nombre_comercial: 'Atlas',
      tipo: 'sofom_er',
    },
    sesion_id: SESION_ID,
    generado_at: new Date('2026-05-07T12:00:00Z'),
    metricas: {
      cajas_llenas: 30,
      cajas_aplicables: 60,
      completitud: 0.5,
      confianza_global: 0.78,
      cajas_criticas_pct: 0.6,
      cajas_blandas_pct: 0.4,
      casos_sinteticos_aplicados: 2,
      fatiga_detectada: false,
    },
    cajas: {
      ru_monto_max: {
        valor: 80000000,
        confianza: 0.85,
        fuente: 'llm',
        evidencia_textual: 'Arriba de 80 ya queremos sindicar',
        intentos: 1,
      },
    },
    resumen_ejecutivo:
      'Sofom ER del Bajío con apetito por construcción y manufactura, ticket sweet spot 20-50M.',
    ...overrides,
  };
}

function inputMinimo(): SintesisInput {
  return {
    sesion: {
      id: SESION_ID,
      institucion: {
        id: INSTITUCION_ID,
        razon_social: 'Atlas',
        nombre_comercial: null,
        tipo: 'sofom_er',
      },
      cajas_aplicables: 60,
      fatiga_detectada: false,
      casos_sinteticos_aplicados: 0,
    },
    cajas_aplicables_codigos: [],
    extracciones: [],
    cajas_declinadas: [],
  };
}

// =============================================================================
// productionOpusSintesisCall
// =============================================================================

describe('productionOpusSintesisCall', () => {
  it('arroja OpusSintesisPromptNotReady mientras el prompt no esté firmado', async () => {
    await expect(productionOpusSintesisCall(inputMinimo())).rejects.toBeInstanceOf(
      OpusSintesisPromptNotReady
    );
  });
});

// =============================================================================
// generarSintesis — validación Zod
// =============================================================================

describe('generarSintesis', () => {
  it('output válido pasa el schema y se devuelve tipado', async () => {
    const opusCall = vi.fn().mockResolvedValue(perfilValido());
    const result = await generarSintesis(inputMinimo(), opusCall);
    expect(result.metricas.completitud).toBe(0.5);
    expect(opusCall).toHaveBeenCalledOnce();
  });

  it('inconsistencia metricas.completitud vs cajas_llenas/cajas_aplicables → SintesisValidacionError', async () => {
    const opusCall = vi.fn().mockResolvedValue(
      perfilValido({
        metricas: {
          cajas_llenas: 30,
          cajas_aplicables: 60,
          completitud: 0.9, // mismatch (real es 0.5)
          confianza_global: 0.78,
          cajas_criticas_pct: 0.6,
          cajas_blandas_pct: 0.4,
          casos_sinteticos_aplicados: 0,
          fatiga_detectada: false,
        },
      })
    );
    await expect(generarSintesis(inputMinimo(), opusCall)).rejects.toBeInstanceOf(
      SintesisValidacionError
    );
  });

  it('cajas_llenas > cajas_aplicables → SintesisValidacionError', async () => {
    const opusCall = vi.fn().mockResolvedValue(
      perfilValido({
        metricas: {
          cajas_llenas: 70,
          cajas_aplicables: 60,
          completitud: 1,
          confianza_global: 0.78,
          cajas_criticas_pct: 1,
          cajas_blandas_pct: 1,
          casos_sinteticos_aplicados: 0,
          fatiga_detectada: false,
        },
      })
    );
    await expect(generarSintesis(inputMinimo(), opusCall)).rejects.toBeInstanceOf(
      SintesisValidacionError
    );
  });

  it('propaga errores del opusCall sin atrapar (Inngest decide retries)', async () => {
    const opusCall = vi.fn().mockRejectedValue(new OpusSintesisPromptNotReady());
    await expect(generarSintesis(inputMinimo(), opusCall)).rejects.toBeInstanceOf(
      OpusSintesisPromptNotReady
    );
  });
});

// =============================================================================
// persistirPerfil
// =============================================================================

describe('persistirPerfil', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('version = max(actual)+1 — primera vez de la institución → v1', async () => {
    mockDb.select
      .mockReturnValueOnce(chainableResolves([{ max_version: 0 }]));
    mockDb.insert.mockReturnValueOnce(chainableResolves([{ id: PERFIL_ID }]));

    const r = await persistirPerfil(perfilValido());
    expect(r).toEqual({ perfil_id: PERFIL_ID, version: 1 });
    expect(mockDb.insert).toHaveBeenCalledOnce();
  });

  it('version se autoincrementa cuando ya hay perfiles previos', async () => {
    mockDb.select.mockReturnValueOnce(chainableResolves([{ max_version: 3 }]));
    mockDb.insert.mockReturnValueOnce(chainableResolves([{ id: PERFIL_ID }]));

    const r = await persistirPerfil(perfilValido());
    expect(r.version).toBe(4);
  });
});

// =============================================================================
// Transiciones
// =============================================================================

describe('marcarSesionCompleta', () => {
  beforeEach(() => vi.clearAllMocks());

  it('UPDATE returning una fila → true (transición ok)', async () => {
    mockDb.update.mockReturnValueOnce(chainableResolves([{ id: SESION_ID }]));
    expect(await marcarSesionCompleta(SESION_ID)).toBe(true);
  });

  it('UPDATE returning vacío → false (no estaba en sintetizando)', async () => {
    mockDb.update.mockReturnValueOnce(chainableResolves([]));
    expect(await marcarSesionCompleta(SESION_ID)).toBe(false);
  });
});

describe('marcarSesionAbandonada', () => {
  beforeEach(() => vi.clearAllMocks());

  it('UPDATE returning una fila → true', async () => {
    mockDb.update.mockReturnValueOnce(chainableResolves([{ id: SESION_ID }]));
    expect(await marcarSesionAbandonada(SESION_ID)).toBe(true);
  });

  it('UPDATE returning vacío → false (guard contra doble llamada)', async () => {
    mockDb.update.mockReturnValueOnce(chainableResolves([]));
    expect(await marcarSesionAbandonada(SESION_ID)).toBe(false);
  });
});

// =============================================================================
// procesarSintesisFinal — entry point completo
// =============================================================================

describe('procesarSintesisFinal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('happy path: build → opus → persist → marcar completa', async () => {
    // buildSintesisInput consume 5 selects (sesion, institucion, extracciones,
    // intentos group, declinadas, casos) — devolvemos shape mínimo.
    mockDb.select
      // sesion
      .mockReturnValueOnce(
        chainableResolves([
          {
            id: SESION_ID,
            institucion_id: INSTITUCION_ID,
            cajas_aplicables: 60,
            metadata: { fatiga_detectada: false },
          },
        ])
      )
      // institucion
      .mockReturnValueOnce(
        chainableResolves([
          {
            id: INSTITUCION_ID,
            razon_social: 'Atlas',
            nombre_comercial: null,
            tipo: 'sofom_er',
          },
        ])
      )
      // extracciones activas
      .mockReturnValueOnce(chainableResolves([]))
      // intentos group by
      .mockReturnValueOnce(chainableResolves([]))
      // declinadas
      .mockReturnValueOnce(chainableResolves([]))
      // casos count
      .mockReturnValueOnce(chainableResolves([{ n: 0 }]))
      // persistirPerfil → max version
      .mockReturnValueOnce(chainableResolves([{ max_version: 0 }]));

    mockDb.insert.mockReturnValueOnce(chainableResolves([{ id: PERFIL_ID }]));
    mockDb.update.mockReturnValueOnce(chainableResolves([{ id: SESION_ID }]));

    const opusCall = vi.fn().mockResolvedValue(
      perfilValido({ institucion: { id: INSTITUCION_ID, razon_social: 'Atlas', nombre_comercial: null, tipo: 'sofom_er' } })
    );

    const result = await procesarSintesisFinal(SESION_ID, { opusCall });
    expect(result.perfil_id).toBe(PERFIL_ID);
    expect(result.version).toBe(1);
    expect(result.status_transition).toBe('completa');
    expect(opusCall).toHaveBeenCalledOnce();
  });

  it('cuando marcarSesionCompleta es no-op (sesión ya procesada) emite warn y devuelve flag', async () => {
    mockDb.select
      .mockReturnValueOnce(
        chainableResolves([
          {
            id: SESION_ID,
            institucion_id: INSTITUCION_ID,
            cajas_aplicables: 60,
            metadata: null,
          },
        ])
      )
      .mockReturnValueOnce(
        chainableResolves([
          {
            id: INSTITUCION_ID,
            razon_social: 'Atlas',
            nombre_comercial: null,
            tipo: 'sofom_er',
          },
        ])
      )
      .mockReturnValueOnce(chainableResolves([]))
      .mockReturnValueOnce(chainableResolves([]))
      .mockReturnValueOnce(chainableResolves([]))
      .mockReturnValueOnce(chainableResolves([{ n: 0 }]))
      .mockReturnValueOnce(chainableResolves([{ max_version: 2 }]));

    mockDb.insert.mockReturnValueOnce(chainableResolves([{ id: PERFIL_ID }]));
    // UPDATE devuelve [] → status no estaba en sintetizando.
    mockDb.update.mockReturnValueOnce(chainableResolves([]));

    const opusCall = vi.fn().mockResolvedValue(
      perfilValido({ institucion: { id: INSTITUCION_ID, razon_social: 'Atlas', nombre_comercial: null, tipo: 'sofom_er' } })
    );

    const result = await procesarSintesisFinal(SESION_ID, { opusCall });
    expect(result.status_transition).toBe('noop_already_processed');
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'sesion.sintesis.transicion_noop',
      expect.objectContaining({ sesion_id: SESION_ID })
    );
  });
});
