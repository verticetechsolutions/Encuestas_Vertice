import { describe, it, expect } from 'vitest';
import {
  PreguntaBatchSchema,
  UltimoBatchSchema,
} from './pregunta-batch';

describe('PreguntaBatchSchema', () => {
  it('valida un batch bien formado', () => {
    const out = PreguntaBatchSchema.safeParse({
      id: 'batch-xyz',
      preguntas: [
        {
          id: 'batch-xyz-q0',
          texto_pregunta: '¿Cuál es tu razón social?',
          cajas_objetivo: ['id_razon_social'],
          tipo: 'directa',
        },
      ],
    });
    expect(out.success).toBe(true);
  });

  it('rechaza preguntas vacías', () => {
    const out = PreguntaBatchSchema.safeParse({
      id: 'batch-xyz',
      preguntas: [],
    });
    expect(out.success).toBe(false);
  });

  it('rechaza tipo de pregunta desconocido', () => {
    const out = PreguntaBatchSchema.safeParse({
      id: 'batch-xyz',
      preguntas: [
        {
          id: 'batch-xyz-q0',
          texto_pregunta: '¿X?',
          cajas_objetivo: [],
          tipo: 'libre_no_existe',
        },
      ],
    });
    expect(out.success).toBe(false);
  });

  it('acepta pregunta con campo auxiliar', () => {
    const out = PreguntaBatchSchema.safeParse({
      id: 'batch-xyz',
      preguntas: [
        {
          id: 'batch-xyz-q0',
          texto_pregunta: '¿Qué productos crediticios ofrecen hoy?',
          auxiliar: 'Después te pregunto por los segmentos.',
          cajas_objetivo: ['nm_productos_ofrecidos'],
          tipo: 'directa',
        },
      ],
    });
    expect(out.success).toBe(true);
  });

  it('acepta pregunta sin campo auxiliar (opcional)', () => {
    const out = PreguntaBatchSchema.safeParse({
      id: 'batch-xyz',
      preguntas: [
        {
          id: 'batch-xyz-q0',
          texto_pregunta: '¿Aceptan clientes PEP?',
          cajas_objetivo: ['se_pep_estructura'],
          tipo: 'directa',
        },
      ],
    });
    expect(out.success).toBe(true);
  });

  it('rechaza auxiliar mayor a 200 chars', () => {
    const out = PreguntaBatchSchema.safeParse({
      id: 'batch-xyz',
      preguntas: [
        {
          id: 'batch-xyz-q0',
          texto_pregunta: '¿X?',
          auxiliar: 'x'.repeat(201),
          cajas_objetivo: ['c'],
          tipo: 'directa',
        },
      ],
    });
    expect(out.success).toBe(false);
  });
});

describe('UltimoBatchSchema', () => {
  it('exige numero_turno_emitido positivo', () => {
    const ok = UltimoBatchSchema.safeParse({
      batch: {
        id: 'b',
        preguntas: [
          {
            id: 'b-q0',
            texto_pregunta: '¿X?',
            cajas_objetivo: [],
            tipo: 'directa',
          },
        ],
      },
      numero_turno_emitido: 3,
    });
    expect(ok.success).toBe(true);

    const noPositivo = UltimoBatchSchema.safeParse({
      batch: {
        id: 'b',
        preguntas: [
          {
            id: 'b-q0',
            texto_pregunta: '¿X?',
            cajas_objetivo: [],
            tipo: 'directa',
          },
        ],
      },
      numero_turno_emitido: 0,
    });
    expect(noPositivo.success).toBe(false);
  });

  it('rechaza payload sin batch', () => {
    const out = UltimoBatchSchema.safeParse({ numero_turno_emitido: 1 });
    expect(out.success).toBe(false);
  });
});
