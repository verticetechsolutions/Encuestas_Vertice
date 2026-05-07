import { describe, it, expect } from 'vitest';
import {
  SONNET_FASE1_TOOLS,
  REGISTRAR_EXTRACCION_TOOL,
  GENERAR_BATCH_PREGUNTAS_TOOL,
  SOLICITAR_CASO_SINTETICO_TOOL,
  SOLICITAR_REVIEW_SECCION_TOOL,
  type SonnetToolName,
} from './tools';

describe('SONNET_FASE1_TOOLS bundle', () => {
  it('contiene exactamente 4 tools tras Phase 5 step 5', () => {
    expect(SONNET_FASE1_TOOLS).toHaveLength(4);
  });

  it('incluye los 4 tools nominales en el bundle', () => {
    const names = SONNET_FASE1_TOOLS.map((t) => t.name);
    expect(names).toEqual([
      'registrar_extraccion',
      'generar_batch_preguntas',
      'solicitar_caso_sintetico',
      'solicitar_review_seccion',
    ]);
  });

  it('cada tool tiene name, description, e input_schema', () => {
    for (const tool of SONNET_FASE1_TOOLS) {
      expect(tool.name).toBeTruthy();
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.input_schema).toBeDefined();
      expect(typeof tool.input_schema).toBe('object');
    }
  });
});

describe('SOLICITAR_REVIEW_SECCION_TOOL', () => {
  it('expone el name correcto', () => {
    expect(SOLICITAR_REVIEW_SECCION_TOOL.name).toBe('solicitar_review_seccion');
  });

  it('description menciona los conceptos clave del trigger', () => {
    const d = SOLICITAR_REVIEW_SECCION_TOOL.description;
    expect(d).toMatch(/director/i);
    expect(d).toMatch(/grupo_ui/i);
    expect(d).toMatch(/cajas_no_clausuradas/i);
    expect(d).toMatch(/hipotesis_sonnet/i);
  });

  it('input_schema generado vía z.toJSONSchema declara los campos top-level', () => {
    const schema = SOLICITAR_REVIEW_SECCION_TOOL.input_schema as {
      type: string;
      properties: Record<string, unknown>;
      required?: string[];
    };
    expect(schema.type).toBe('object');
    expect(schema.properties).toHaveProperty('grupo_ui_codigo');
    expect(schema.properties).toHaveProperty('extracciones_snapshot');
    expect(schema.properties).toHaveProperty('cajas_no_clausuradas');
    expect(schema.properties).toHaveProperty('hipotesis_sonnet');
    expect(schema.properties).toHaveProperty('turno_disparador');
  });
});

describe('Identidad y unicidad de tools', () => {
  it('cada tool del bundle es referencialmente única (no duplicados accidentales)', () => {
    const set = new Set(SONNET_FASE1_TOOLS);
    expect(set.size).toBe(SONNET_FASE1_TOOLS.length);
  });

  it('tools individuales coinciden con sus refs en el bundle', () => {
    expect(SONNET_FASE1_TOOLS).toContain(REGISTRAR_EXTRACCION_TOOL);
    expect(SONNET_FASE1_TOOLS).toContain(GENERAR_BATCH_PREGUNTAS_TOOL);
    expect(SONNET_FASE1_TOOLS).toContain(SOLICITAR_CASO_SINTETICO_TOOL);
    expect(SONNET_FASE1_TOOLS).toContain(SOLICITAR_REVIEW_SECCION_TOOL);
  });

  it('SonnetToolName cubre los 4 nombres del bundle (compile-time)', () => {
    const names: SonnetToolName[] = [
      'registrar_extraccion',
      'generar_batch_preguntas',
      'solicitar_caso_sintetico',
      'solicitar_review_seccion',
    ];
    // Si TS aceptó el array sin error, el union type cubre los 4 valores.
    expect(names).toHaveLength(4);
  });
});
