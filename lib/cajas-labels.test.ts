// FIELD_LABELS — derivado del catálogo CAJAS_CANON + CAJAS_EXTENSION_POR_TIPO.
// Resuelve el debug leak nm_productos_ofrecidos en /preview/ui (sesión 2026-05-08)
// mostrando descripciones humanas en el right rail "Esta pregunta cubre".

import { describe, it, expect } from 'vitest';
import { FIELD_LABELS, getFieldLabel } from './cajas-labels';
import { CAJAS_CANON, CAJAS_EXTENSION_POR_TIPO } from './schemas/cajas';

describe('FIELD_LABELS', () => {
  it('contiene un label para cada caja del CAJAS_CANON', () => {
    for (const caja of CAJAS_CANON) {
      expect(FIELD_LABELS[caja.codigo]).toBeDefined();
      expect(FIELD_LABELS[caja.codigo]).not.toBe('');
    }
  });

  it('contiene un label para cada caja de las extensiones por tipo', () => {
    for (const cajas of Object.values(CAJAS_EXTENSION_POR_TIPO)) {
      for (const caja of cajas) {
        expect(FIELD_LABELS[caja.codigo]).toBeDefined();
        expect(FIELD_LABELS[caja.codigo]).not.toBe('');
      }
    }
  });

  it('mapea nm_productos_ofrecidos a "Productos ofrecidos"', () => {
    expect(FIELD_LABELS['nm_productos_ofrecidos']).toBe('Productos ofrecidos');
  });

  it('mapea id_razon_social a "Razón social completa"', () => {
    expect(FIELD_LABELS['id_razon_social']).toBe('Razón social completa');
  });

  it('los labels NO son el código crudo (nada empieza con prefijos técnicos)', () => {
    const tecnicos = /^(nm|id|ru|gr|to|cb|cs|csp|cc|ca|cf|cif)_/;
    for (const [codigo, label] of Object.entries(FIELD_LABELS)) {
      expect(label, `${codigo} → ${label}`).not.toMatch(tecnicos);
    }
  });
});

describe('getFieldLabel', () => {
  it('devuelve el label si existe', () => {
    expect(getFieldLabel('nm_productos_ofrecidos')).toBe('Productos ofrecidos');
  });

  it('devuelve el código original si no hay mapping (fallback)', () => {
    expect(getFieldLabel('codigo_inexistente_zzz')).toBe('codigo_inexistente_zzz');
  });
});
