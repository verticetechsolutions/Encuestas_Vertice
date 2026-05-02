// Verifies the contract of the <formato_valores_por_caja> XML block against
// CAJAS_CANON: 49 entries, no orphan codes, no missing codes, each entry has
// the 5 required sub-tags, and criticidad XML maps correctly to CAJAS_CANON.

import { describe, it, expect } from 'vitest';
import { CAJAS_CANON } from '../schemas/cajas';
import {
  FORMATO_VALORES_POR_CAJA_XML,
  SONNET_FASE1_SYSTEM_PROMPT,
  SONNET_FASE1_PROMPT_READY,
} from './sonnet_fase1';

const REQUIRED_SUBTAGS = ['descripcion', 'criticidad', 'tipo_dato', 'formato_esperado', 'ejemplo_valido'] as const;

function extractFormatoBlock(prompt: string): string {
  const match = prompt.match(/<formato_valores_por_caja>[\s\S]*?<\/formato_valores_por_caja>/);
  if (!match) throw new Error('bloque <formato_valores_por_caja> no encontrado en el system prompt');
  return match[0];
}

function extractCajaEntries(block: string): Array<{ codigo: string; body: string }> {
  const entries: Array<{ codigo: string; body: string }> = [];
  const re = /<caja codigo="([^"]+)">([\s\S]*?)<\/caja>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    entries.push({ codigo: m[1], body: m[2] });
  }
  return entries;
}

describe('SONNET_FASE1 — formato_valores_por_caja', () => {
  it('FORMATO_VALORES_POR_CAJA_XML está embebido en el system prompt', () => {
    expect(SONNET_FASE1_SYSTEM_PROMPT).toContain(FORMATO_VALORES_POR_CAJA_XML);
  });

  it('SONNET_FASE1_PROMPT_READY === true', () => {
    expect(SONNET_FASE1_PROMPT_READY).toBe(true);
  });

  it('el bloque tiene exactamente 49 entradas <caja>', () => {
    const block = extractFormatoBlock(SONNET_FASE1_SYSTEM_PROMPT);
    const entries = extractCajaEntries(block);
    expect(entries.length).toBe(49);
  });

  it('todos los códigos del XML existen en CAJAS_CANON', () => {
    const block = extractFormatoBlock(SONNET_FASE1_SYSTEM_PROMPT);
    const entries = extractCajaEntries(block);
    const canonCodigos = new Set(CAJAS_CANON.map((c) => c.codigo));
    const huerfanos = entries.map((e) => e.codigo).filter((c) => !canonCodigos.has(c));
    expect(huerfanos).toEqual([]);
  });

  it('ningún código de CAJAS_CANON falta del XML', () => {
    const block = extractFormatoBlock(SONNET_FASE1_SYSTEM_PROMPT);
    const entries = extractCajaEntries(block);
    const xmlCodigos = new Set(entries.map((e) => e.codigo));
    const faltantes = CAJAS_CANON.map((c) => c.codigo).filter((c) => !xmlCodigos.has(c));
    expect(faltantes).toEqual([]);
  });

  it('cada entrada tiene los 5 sub-tags requeridos', () => {
    const block = extractFormatoBlock(SONNET_FASE1_SYSTEM_PROMPT);
    const entries = extractCajaEntries(block);
    for (const { codigo, body } of entries) {
      for (const tag of REQUIRED_SUBTAGS) {
        const re = new RegExp(`<${tag}>[\\s\\S]+?</${tag}>`);
        expect(re.test(body), `caja "${codigo}" debe tener <${tag}>`).toBe(true);
      }
    }
  });

  it('criticidad XML coincide con CAJAS_CANON (alta ↔ critica)', () => {
    const block = extractFormatoBlock(SONNET_FASE1_SYSTEM_PROMPT);
    const entries = extractCajaEntries(block);
    const canonByCodigo = new Map(CAJAS_CANON.map((c) => [c.codigo, c]));
    for (const { codigo, body } of entries) {
      const m = body.match(/<criticidad>([\s\S]*?)<\/criticidad>/)!;
      const xml = m[1].trim();
      const canon = canonByCodigo.get(codigo)!;
      const expected = canon.criticidad === 'critica' ? 'alta' : 'blanda';
      expect(xml, `caja "${codigo}": canon=${canon.criticidad}, xml=${xml}`).toBe(expected);
    }
  });
});
