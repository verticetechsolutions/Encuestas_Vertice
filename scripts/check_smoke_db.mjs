import postgres from 'postgres';
const url = process.env.DATABASE_URL;
const sql = postgres(url, { prepare: false, max: 1 });
const id = '3cd25a96-cdf6-4a61-9495-1828ea129a03';
const turnos = await sql`SELECT numero_turno, rol, LEFT(contenido_texto, 80) AS preview FROM turnos_conversacion WHERE sesion_id = ${id} ORDER BY numero_turno`;
const meta = await sql`SELECT
  metadata->'ultimo_batch'->>'numero_turno_emitido' AS turno_emitido,
  metadata->'ultimo_batch'->'batch'->>'id' AS batch_id,
  jsonb_array_length(metadata->'ultimo_batch'->'batch'->'preguntas') AS num_preguntas,
  metadata->'ultimo_batch'->'batch'->'preguntas'->0->>'texto_pregunta' AS first_q,
  metadata->'ultimo_batch'->'batch'->'preguntas'->1->>'texto_pregunta' AS second_q
  FROM sesiones WHERE id = ${id}`;
const extr = await sql`SELECT caja_codigo, valor, confianza FROM extracciones WHERE sesion_id = ${id} AND superseded_by IS NULL ORDER BY created_at`;
console.log(JSON.stringify({turnos, meta, extr}, null, 2));
await sql.end();
