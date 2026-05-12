// Smoke tests del config cementado STT_LIVE_CONFIG y STT_KEYTERMS.
//
// Nota: NO testea grantEphemeralToken (requiere DEEPGRAM_API_KEY real + hit a
// console.deepgram.com). Eso lo cubre smoke manual en /demo/stt.
//
// La idea: regression guard contra cambios silenciosos en la lista de keyterms
// que el founder cementó tras smoke 2026-05-12 (WER en CNBV/CONDUSEF/SOFOM).

import { describe, it, expect } from 'vitest';
import { STT_KEYTERMS, STT_LIVE_CONFIG } from './client';

describe('STT_KEYTERMS', () => {
  it('contiene reguladores federales MX', () => {
    for (const t of ['CNBV', 'CONDUSEF', 'CNSF', 'IPAB', 'UIF', 'SHCP', 'BANXICO']) {
      expect(STT_KEYTERMS).toContain(t);
    }
  });

  it('contiene tipos institucionales MX', () => {
    for (const t of ['SOFOM', 'SOFIPO', 'SOCAP', 'IFC']) {
      expect(STT_KEYTERMS).toContain(t);
    }
  });

  it('contiene métricas financieras críticas', () => {
    for (const t of ['DSCR', 'CETES', 'TIIE']) {
      expect(STT_KEYTERMS).toContain(t);
    }
  });

  it('está frozen — modificar la lista en runtime arroja', () => {
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (STT_KEYTERMS as any).push('NUEVO_TERMINO');
    }).toThrow();
  });

  it('lista única (sin duplicados)', () => {
    const set = new Set(STT_KEYTERMS);
    expect(set.size).toBe(STT_KEYTERMS.length);
  });
});

describe('STT_LIVE_CONFIG', () => {
  it('cablea keyterm con la lista coma-separada', () => {
    expect(STT_LIVE_CONFIG.keyterm).toBe(STT_KEYTERMS.join(','));
  });

  it('mantiene language=multi (decisión cementada para code-switch ES↔EN)', () => {
    expect(STT_LIVE_CONFIG.language).toBe('multi');
  });

  it('mantiene vad_events activo (cold-start y future utterance detection)', () => {
    expect(STT_LIVE_CONFIG.vad_events).toBe('true');
  });

  it('omitir smart_format (deliberado — preposiciones ES en title-case)', () => {
    expect('smart_format' in STT_LIVE_CONFIG).toBe(false);
  });

  it('está frozen', () => {
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (STT_LIVE_CONFIG as any).language = 'es';
    }).toThrow();
  });
});
