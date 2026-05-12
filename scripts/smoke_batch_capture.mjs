import postgres from 'postgres';
const url = process.env.DATABASE_URL;
const sql = postgres(url, { prepare: false, max: 1 });
const id = '7746c975-b3a0-49d5-8bba-16cdf4bfa87c';
const meta = await sql`SELECT
  metadata->'ultimo_batch'->>'numero_turno_emitido' AS turno_emitido,
  metadata->'ultimo_batch'->'batch'->>'id' AS batch_id,
  metadata->'ultimo_batch'->'batch'->'preguntas' AS preguntas,
  metadata
  FROM sesiones WHERE id = ${id}`;
const turnos = await sql`SELECT numero_turno, rol, LEFT(contenido_texto, 200) AS preview FROM turnos_conversacion WHERE sesion_id = ${id} ORDER BY numero_turno DESC LIMIT 6`;
const extr = await sql`SELECT caja_codigo, valor, confianza FROM extracciones WHERE sesion_id = ${id} AND superseded_by IS NULL ORDER BY created_at`;
console.log(JSON.stringify({ meta: meta[0], turnos, extr }, null, 2));
await sql.end();
