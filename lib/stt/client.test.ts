// Smoke tests del config cementado STT_LIVE_CONFIG y STT_KEYTERMS.
//
// Nota: NO testea grantEphemeralToken (requiere DEEPGRAM_API_KEY real + hit a
// console.deepgram.com). Eso lo cubre smoke manual en /demo/stt.
//
// La idea: regression guard contra cambios silenciosos en la lista de keyterms
// que el founder cementó tras smoke 2026-05-12 (WER en CNBV/CONDUSEF/SOFOM).

import { describe, it, expect } from 'vitest';
import {
  STT_AUDIO_CONSTRAINTS,
  STT_FINALIZE_GRACE_MS,
  STT_KEEPALIVE_INTERVAL_MS,
  STT_KEYTERMS,
  STT_LIVE_CONFIG,
  STT_MAX_RECORDING_MS,
  STT_WARN_LONG_RECORDING_MS,
} from './client';

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

  it('configura utterance_end_ms para detección precisa de fin de turno', () => {
    expect(STT_LIVE_CONFIG.utterance_end_ms).toBe('1000');
  });

  it('está frozen', () => {
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (STT_LIVE_CONFIG as any).language = 'es';
    }).toThrow();
  });
});

describe('STT_AUDIO_CONSTRAINTS', () => {
  it('habilita echoCancellation + noiseSuppression + AGC para calidad pro', () => {
    expect(STT_AUDIO_CONSTRAINTS.echoCancellation).toBe(true);
    expect(STT_AUDIO_CONSTRAINTS.noiseSuppression).toBe(true);
    expect(STT_AUDIO_CONSTRAINTS.autoGainControl).toBe(true);
  });

  it('captura mono a 16kHz (óptimo speech, ahorra bandwidth)', () => {
    expect(STT_AUDIO_CONSTRAINTS.channelCount).toBe(1);
    expect(STT_AUDIO_CONSTRAINTS.sampleRate).toBe(16000);
  });
});

describe('STT timing constants', () => {
  it('keepalive interval ≤ 10s (Deepgram idle timeout)', () => {
    // Deepgram cierra el WS tras ~10-12s sin audio. Margin de 2s mínimo.
    expect(STT_KEEPALIVE_INTERVAL_MS).toBeLessThanOrEqual(10_000);
    expect(STT_KEEPALIVE_INTERVAL_MS).toBeGreaterThanOrEqual(2_000);
  });

  it('finalize grace cubre roundtrip + procesamiento (≥400ms)', () => {
    expect(STT_FINALIZE_GRACE_MS).toBeGreaterThanOrEqual(400);
    expect(STT_FINALIZE_GRACE_MS).toBeLessThanOrEqual(2_000);
  });

  it('max recording 30min + warning 25min (warning antes del cap)', () => {
    expect(STT_MAX_RECORDING_MS).toBe(30 * 60 * 1000);
    expect(STT_WARN_LONG_RECORDING_MS).toBeLessThan(STT_MAX_RECORDING_MS);
    expect(STT_MAX_RECORDING_MS - STT_WARN_LONG_RECORDING_MS).toBeGreaterThanOrEqual(
      2 * 60 * 1000
    );
  });
});
