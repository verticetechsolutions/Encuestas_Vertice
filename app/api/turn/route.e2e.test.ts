// E2E tests del route handler `/api/turn` (Phase 5 step 5 — sub-paso vii
// pending list). Verifica los gates HTTP que la POST function aplica antes
// de invocar Sonnet:
//
//   1. SONNET_FASE1_PROMPT_READY=false → 503 sonnet_fase1_prompt_not_ready
//   2. Body no-JSON → 400 invalid_request
//   3. Body JSON sin sesion_id válido → 400 invalid_request (Zod)
//   4. Sesión no existe en DB → 404 sesion_not_found
//   5. Sesión status='completa' → 409 sesion_not_open
//   6. Sesión sin consentimiento_at → 403 consentimiento_pendiente
//   7. Happy path con prompt ready + sesión válida → 200 stream
//
// Estrategia: mockear @/lib/db con chainable thenable, @/lib/prompts/sonnet_fase1
// con accessor toggleable, @ai-sdk/anthropic con createMockSonnet helper, y
// @/lib/motor/persistence/review con stubs in-memory.
//
// Lo que NO se cubre aquí (pertenece a otros suites):
//   - Drift Sonnet→tools (lib/motor/conversation*.e2e.test.ts).
//   - Side-effects DB reales (lib/motor/review.integration.test.ts).
//   - Stream chunk shapes del UI message protocol (smoke validado por la
//     suite de happy path multi-grupo).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSonnet } from '@/lib/motor/__test_helpers__/mock-sonnet';

// =============================================================================
// Hoisted mock state — estado controlable per-test
// =============================================================================

const { mockState, mockDbSelect } = vi.hoisted(() => {
  // Cuando true: el handler entra al stream. Cuando false: 503 short-circuit.
  // Default true para que los tests que no toggleen tengan happy path.
  const mockState = {
    promptReady: true as boolean,
    sesionRow: null as null | {
      status: string;
      consentimiento_at: Date | null;
      tipo: string;
    },
  };
  // mockDbSelect lo usa el .select(...).from(...).innerJoin(...).where(...).limit()
  // chainable. Lo dejamos accessible para que los tests configuren el row.
  const mockDbSelect = vi.fn();
  return { mockState, mockDbSelect };
});

// =============================================================================
// Mocks de módulos
// =============================================================================

vi.mock('@/lib/prompts/sonnet_fase1', () => ({
  // Live binding: route.ts lee SONNET_FASE1_PROMPT_READY en cada request.
  // Usamos `get` para que cada lectura devuelva el valor actual de mockState.
  get SONNET_FASE1_PROMPT_READY() {
    return mockState.promptReady;
  },
  SONNET_FASE1_SYSTEM_PROMPT: 'Mock Sonnet system prompt para tests E2E',
}));

vi.mock('@/lib/db', () => {
  // Chainable thenable mock — imita Drizzle. Cada método devuelve `obj` (el
  // mismo objeto), y `await obj` resuelve a lo que mockDbSelect retorne.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj: any = {};
  const methods = [
    'select',
    'from',
    'where',
    'limit',
    'innerJoin',
    'leftJoin',
    'orderBy',
    'groupBy',
  ];
  for (const m of methods) {
    obj[m] = vi.fn(() => obj);
  }
  // .then resuelve a lo que el test haya configurado en mockDbSelect.
  obj.then = (
    onFulfilled?: (v: unknown) => unknown,
    onRejected?: (e: unknown) => unknown
  ) => Promise.resolve(mockDbSelect()).then(onFulfilled, onRejected);
  // El select() del handler arranca la chain: route.ts hace
  //   db.select({...}).from(sesiones).innerJoin(...).where(...).limit(1)
  // Sólo necesitamos que select() devuelva el chainable.
  return { db: obj };
});

vi.mock('@/lib/motor/persistence', () => ({
  ExtraccionInvalidaError: class extends Error {},
  persistirTurnoUsuario: vi.fn(async () => ({ turno_id: 't-user-1', numero_turno: 1 })),
  persistirTurnoAgente: vi.fn(async () => ({ turno_id: 't-agente-1', numero_turno: 2 })),
  actualizarContenidoTurnoAgente: vi.fn(async () => undefined),
  persistirExtraccionesBatch: vi.fn(async () => []),
  listarExtraccionesActivas: vi.fn(async () => []),
  listarCajasDeclinadas: vi.fn(async () => []),
  siguienteNumeroTurno: vi.fn(async () => 1),
}));

vi.mock('@/lib/motor/review', () => ({
  processSolicitarReview: vi.fn(),
  OpusReviewPromptNotReady: class extends Error {},
}));

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

// Mock de anthropic provider — devuelve un MockSonnet que termina rápido
// (un solo step con texto y finishReason='stop'). El happy path test no
// drive un loop completo, sólo verifica que el handler llega al stream.
vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn(() =>
    createMockSonnet([{ text: 'Respuesta mock del agente.' }])
  ),
}));

// Imports DESPUÉS de los mocks.
import { POST } from './route';

// =============================================================================
// Helpers
// =============================================================================

// UUID v4 válido bajo Zod v4 strict (version=4, variant=[8-b]).
const SESION_VALIDA_UUID = '11111111-1111-4111-8111-111111111111';

function makeRequest(body: unknown, opts: { rawBody?: string } = {}) {
  const bodyStr =
    opts.rawBody !== undefined ? opts.rawBody : JSON.stringify(body);
  return new Request('http://localhost:3000/api/turn', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: bodyStr,
  });
}

beforeEach(() => {
  // Reset estado controlado: prompt listo + sin sesión configurada.
  mockState.promptReady = true;
  mockState.sesionRow = null;
  vi.clearAllMocks();
  // Default: db.select().from()...limit() resuelve a [] (sesión no existe).
  // Los tests que necesiten una sesión la inyectan vía mockDbSelect.mockReturnValueOnce.
  mockDbSelect.mockReturnValue([]);
});

// =============================================================================
// Tests
// =============================================================================

describe('POST /api/turn — gates', () => {
  it('1. PROMPT_READY=false → 503 sonnet_fase1_prompt_not_ready', async () => {
    mockState.promptReady = false;
    const res = await POST(
      makeRequest({ sesion_id: SESION_VALIDA_UUID, mensaje_usuario: 'hola' })
    );
    expect(res.status).toBe(503);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('sonnet_fase1_prompt_not_ready');
  });

  it('2. Body no-JSON → 400 invalid_request', async () => {
    const res = await POST(makeRequest(null, { rawBody: 'esto no es json válido {' }));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('invalid_request');
  });

  it('3. Zod fail (sin sesion_id) → 400 invalid_request', async () => {
    const res = await POST(makeRequest({ mensaje_usuario: 'hola sin id' }));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('invalid_request');
  });

  it('3b. Zod fail (sesion_id no UUID) → 400 invalid_request', async () => {
    const res = await POST(
      makeRequest({ sesion_id: 'not-a-uuid', mensaje_usuario: 'hola' })
    );
    expect(res.status).toBe(400);
  });

  it('3c. Zod fail (mensaje vacío) → 400 invalid_request', async () => {
    const res = await POST(
      makeRequest({ sesion_id: SESION_VALIDA_UUID, mensaje_usuario: '' })
    );
    expect(res.status).toBe(400);
  });

  it('4. Sesión no existe → 404 sesion_not_found', async () => {
    mockDbSelect.mockReturnValue([]);
    const res = await POST(
      makeRequest({ sesion_id: SESION_VALIDA_UUID, mensaje_usuario: 'hola' })
    );
    expect(res.status).toBe(404);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('sesion_not_found');
  });

  it('5. Sesión status=completa → 409 sesion_not_open', async () => {
    mockDbSelect.mockReturnValue([
      { status: 'completa', consentimiento_at: new Date(), tipo: 'banco' },
    ]);
    const res = await POST(
      makeRequest({ sesion_id: SESION_VALIDA_UUID, mensaje_usuario: 'hola' })
    );
    expect(res.status).toBe(409);
    const json = (await res.json()) as { error: string; status: string };
    expect(json.error).toBe('sesion_not_open');
    expect(json.status).toBe('completa');
  });

  it('5b. Sesión status=sintetizando → 409 sesion_not_open', async () => {
    mockDbSelect.mockReturnValue([
      { status: 'sintetizando', consentimiento_at: new Date(), tipo: 'banco' },
    ]);
    const res = await POST(
      makeRequest({ sesion_id: SESION_VALIDA_UUID, mensaje_usuario: 'hola' })
    );
    expect(res.status).toBe(409);
  });

  it('6. Sesión sin consentimiento_at → 403 consentimiento_pendiente', async () => {
    mockDbSelect.mockReturnValue([
      { status: 'abierta', consentimiento_at: null, tipo: 'banco' },
    ]);
    const res = await POST(
      makeRequest({ sesion_id: SESION_VALIDA_UUID, mensaje_usuario: 'hola' })
    );
    expect(res.status).toBe(403);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('consentimiento_pendiente');
  });

  it('7. Happy path — sesión válida + prompt ready → 200 stream', async () => {
    mockDbSelect.mockReturnValue([
      { status: 'abierta', consentimiento_at: new Date('2026-05-01'), tipo: 'banco' },
    ]);
    const res = await POST(
      makeRequest({ sesion_id: SESION_VALIDA_UUID, mensaje_usuario: 'Somos Banco Demo SA' })
    );
    expect(res.status).toBe(200);
    // toUIMessageStreamResponse devuelve un body streamable. Drenamos para
    // verificar que el stream produce contenido (non-empty). Content-Type
    // del UI message stream del AI SDK v6 puede variar entre 'text/event-stream'
    // y 'application/octet-stream' según el transport — verificamos solo que
    // el body es un ReadableStream consumible.
    expect(res.body).not.toBeNull();
    const reader = res.body!.getReader();
    let totalBytes = 0;
    let chunks = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value?.length ?? 0;
      chunks += 1;
      if (chunks > 100) break; // safety net
    }
    expect(totalBytes).toBeGreaterThan(0);
  });

  it('7b. Happy path — instituciones tipo=sofom_er también pasa', async () => {
    mockDbSelect.mockReturnValue([
      { status: 'abierta', consentimiento_at: new Date('2026-05-01'), tipo: 'sofom_er' },
    ]);
    const res = await POST(
      makeRequest({ sesion_id: SESION_VALIDA_UUID, mensaje_usuario: 'Sofom ER regulada' })
    );
    expect(res.status).toBe(200);
    // Drenar el body para liberar el reader (sino vitest puede colgar).
    if (res.body) {
      const reader = res.body.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    }
  });
});
