// Zod schemas para PreguntaBatch + UltimoBatch persistido en sesiones.metadata.
//
// Motivación: la PreguntaBatch existía solo como interface TS en
// lib/state/entrevista.ts (cliente). Para rehidratar /entrevista en reload
// necesitamos persistir el batch emitido por Sonnet y leerlo server-side; eso
// requiere validar el shape contra Zod al cargar (la DB pudo migrar formato o
// recibir basura por una versión vieja del producto).
//
// El módulo NO depende de zustand ni de DOM — server-safe.

import { z } from 'zod';

export const TipoPreguntaSchema = z.enum(['directa', 'caso_sintetico_solicitado']);
export type TipoPregunta = z.infer<typeof TipoPreguntaSchema>;

export const PreguntaSchema = z.object({
  id: z.string().min(1),
  texto_pregunta: z.string().min(1),
  // Preamble / framing / reconocimiento opcional renderizado debajo del hero.
  // Permite separar la pregunta cruda del contexto conversacional. Sonnet lo
  // emite cuando aporta (transición temática, framing en tema sensible,
  // anuncio de follow-up); vacío/ausente cuando el hero es autosuficiente.
  auxiliar: z.string().max(200).optional(),
  cajas_objetivo: z.array(z.string()),
  tipo: TipoPreguntaSchema,
});
export type Pregunta = z.infer<typeof PreguntaSchema>;

export const PreguntaBatchSchema = z.object({
  id: z.string().min(1),
  preguntas: z.array(PreguntaSchema).min(1).max(8),
});
export type PreguntaBatch = z.infer<typeof PreguntaBatchSchema>;

// Wrapper persistido en sesiones.metadata.ultimo_batch. Incluye el número de
// turno agente que lo emitió para detectar staleness en rehidratación:
// si el último turno agente en DB tiene un numero distinto al guardado aquí,
// el batch es de un turno previo (Sonnet emitió un agent turn nuevo SIN
// batch, e.g. solo registrar_extraccion + stop) y debe descartarse.
export const UltimoBatchSchema = z.object({
  batch: PreguntaBatchSchema,
  numero_turno_emitido: z.number().int().positive(),
});
export type UltimoBatch = z.infer<typeof UltimoBatchSchema>;
