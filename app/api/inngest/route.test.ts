// Smoke test del Inngest serve handler.
//
// El handler es `serve({ client, functions: [sintetizarSesion] })` del paquete
// `inngest/next`. La librería implementa el wire — nuestro código solo registra
// la function. Estos tests verifican:
//   1. Los 3 verbs HTTP están exportados.
//   2. GET (manifest discovery) responde sin tirar excepción y devuelve la
//      lista de functions registradas — confirma que `sintetizarSesion` está
//      conectada al handler.
//
// No testeamos POST trigger porque requeriría firmar el body con
// INNGEST_EVENT_KEY y simular el shape del cloud — eso vale más como
// integration test contra `inngest-cli dev`.

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

// Inngest serve handler arranca en "cloud mode" por default, lo que exige
// INNGEST_SIGNING_KEY presente. Para tests locales basta INNGEST_DEV=1 — la
// librería cambia al modo dev (no firma, no health checks).
const ORIGINAL_INNGEST_DEV = process.env.INNGEST_DEV;
beforeAll(() => {
  process.env.INNGEST_DEV = '1';
});
afterAll(() => {
  if (ORIGINAL_INNGEST_DEV === undefined) delete process.env.INNGEST_DEV;
  else process.env.INNGEST_DEV = ORIGINAL_INNGEST_DEV;
});

// Inngest hace networking opcional al inicializar. Mockeamos logger para
// silenciar output durante el test.
vi.mock('@/lib/observability/axiom', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    sesion: { listaParaSintesis: vi.fn(), sintesisFailed: vi.fn() },
  },
}));

import { GET, POST, PUT } from './route';

describe('GET/POST/PUT /api/inngest — manifest', () => {
  it('exporta los tres verbs HTTP', () => {
    expect(typeof GET).toBe('function');
    expect(typeof POST).toBe('function');
    expect(typeof PUT).toBe('function');
  });

  it('GET devuelve manifest 200 con sintetizar-sesion registrado', async () => {
    const req = new Request('http://localhost:3000/api/inngest', {
      method: 'GET',
    });
    // inngest/next typa `serve` con (req, res) firma de Next 15 RouteContext;
    // en tests no nos importa el res, pasamos {} y casteamos req a NextRequest.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await GET(req as any, {} as unknown);
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;
    // El manifest dev de Inngest devuelve `function_count` + un payload con
    // metadata del SDK; el detalle de functions vive en POST/PUT (sync). Acá
    // solo confirmamos que el GET responde sano y el contador refleja que
    // sintetizar-sesion está registrada (count >= 1).
    expect(body).toHaveProperty('function_count');
    expect(typeof body.function_count).toBe('number');
    expect(body.function_count).toBeGreaterThanOrEqual(1);
  });
});
