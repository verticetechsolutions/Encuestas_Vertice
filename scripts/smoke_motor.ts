// Smoke unit tests para lib/motor/{mapa,fatiga}.ts. Sin DB ni LLM.

import { computeMapaIncertidumbre, type CajaState } from '../lib/motor/mapa';
import { detectarFatiga, type TurnoUsuario } from '../lib/motor/fatiga';
import { CAJAS_CANON, type CajaCanon } from '../lib/schemas/cajas';
import type { Extraccion } from '../lib/schemas/extracciones';

let pasos = 0;
let fallos = 0;
function ok(name: string, cond: boolean, detalle?: unknown) {
  pasos++;
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    fallos++;
    console.log(`  ✗ ${name}`, detalle ?? '');
  }
}

// =========================================================================
// computeMapaIncertidumbre
// =========================================================================
console.log('\n[mapa] computeMapaIncertidumbre');

// Catálogo de prueba: 3 críticas + 2 blandas.
const cajasMock: CajaCanon[] = [
  { codigo: 'cri_a', descripcion: 'A', criticidad: 'critica', tipo_dato: 'text', grupo_ui: 'identificacion' },
  { codigo: 'cri_b', descripcion: 'B', criticidad: 'critica', tipo_dato: 'int', grupo_ui: 'numeros_del_negocio' },
  { codigo: 'cri_c', descripcion: 'C', criticidad: 'critica', tipo_dato: 'enum', grupo_ui: 'identificacion' },
  { codigo: 'bla_a', descripcion: 'BA', criticidad: 'blanda', tipo_dato: 'text', grupo_ui: 'pricing_y_criterio' },
  { codigo: 'bla_b', descripcion: 'BB', criticidad: 'blanda', tipo_dato: 'real', grupo_ui: 'numeros_del_negocio' },
];

function ext(over: Partial<Extraccion> & { caja_codigo: string; confianza: number; valor: unknown }): Extraccion {
  return {
    sesion_id: '7d7e1c3a-4b8a-4d6a-9c2a-2234567890ab',
    turno_id: '7d7e1c3a-4b8a-4d6a-9c2a-3234567890ab',
    fuente: 'llm',
    version: 1,
    ...over,
  } as Extraccion;
}

// Caso 1: cero extracciones → todas vacías.
{
  const m = computeMapaIncertidumbre([], cajasMock);
  ok('todo vacío: 5 cajas con status=vacia', Object.values(m.cajas).every((c: CajaState) => c.status === 'vacia'));
  ok('cajas_criticas_pct = 0', m.cajas_criticas_pct === 0);
  ok('cajas_blandas_pct = 0', m.cajas_blandas_pct === 0);
  ok('confianza_global = 0', m.confianza_global === 0);
  ok('top atacar prioriza críticas (3 primeras)', m.top_cajas_a_atacar.slice(0, 3).every((c) => c.startsWith('cri_')));
}

// Caso 2: 1 crítica llena, 1 crítica parcial, 1 blanda llena.
{
  const exts: Extraccion[] = [
    ext({ caja_codigo: 'cri_a', valor: 'X', confianza: 0.92, fuente: 'llm' }),
    ext({ caja_codigo: 'cri_b', valor: 100, confianza: 0.7, fuente: 'llm' }),
    ext({ caja_codigo: 'bla_a', valor: 'Y', confianza: 0.7, fuente: 'llm' }),
  ];
  const m = computeMapaIncertidumbre(exts, cajasMock);
  ok('cri_a llena (0.92 ≥ 0.80)', m.cajas['cri_a'].status === 'llena');
  ok('cri_b parcial (0.70 < 0.80)', m.cajas['cri_b'].status === 'parcial');
  ok('bla_a llena (0.70 ≥ 0.65)', m.cajas['bla_a'].status === 'llena');
  ok('cri_c sigue vacía', m.cajas['cri_c'].status === 'vacia');
  ok('cajas_criticas_pct = 1/3', Math.abs(m.cajas_criticas_pct - 1 / 3) < 0.01);
  ok('cajas_blandas_pct = 1/2', m.cajas_blandas_pct === 0.5);
  ok('top a atacar empieza con crítica parcial cri_b (más cerca de threshold)', m.top_cajas_a_atacar[0] === 'cri_b');
}

// Caso 3: contradictoria (2 extracciones no-superseded con valores distintos).
{
  const exts: Extraccion[] = [
    ext({ caja_codigo: 'cri_a', valor: 'X', confianza: 0.9, version: 1, fuente: 'llm' }),
    ext({ caja_codigo: 'cri_a', valor: 'Y', confianza: 0.85, version: 2, fuente: 'llm' }),
  ];
  const m = computeMapaIncertidumbre(exts, cajasMock);
  ok('cri_a contradictoria (2 valores distintos)', m.cajas['cri_a'].status === 'contradictoria');
  ok('contradictoria queda primera en top a atacar', m.top_cajas_a_atacar[0] === 'cri_a');
}

// Caso 4: superseded_by oculta extracción vieja.
{
  const exts: Extraccion[] = [
    ext({
      id: '7d7e1c3a-4b8a-4d6a-9c2a-aaaaaaaa1111',
      caja_codigo: 'cri_a',
      valor: 'viejo',
      confianza: 0.9,
      version: 1,
      fuente: 'llm',
      superseded_by: '7d7e1c3a-4b8a-4d6a-9c2a-aaaaaaaa2222',
    }),
    ext({
      id: '7d7e1c3a-4b8a-4d6a-9c2a-aaaaaaaa2222',
      caja_codigo: 'cri_a',
      valor: 'nuevo',
      confianza: 0.95,
      version: 2,
      fuente: 'llm',
    }),
  ];
  const m = computeMapaIncertidumbre(exts, cajasMock);
  ok('cri_a llena tras supersede (no contradictoria)', m.cajas['cri_a'].status === 'llena');
  ok('confianza es la de la versión nueva', m.cajas['cri_a'].confianza === 0.95);
}

// Caso 5: no_aplica = manual + null + sobre threshold.
{
  const exts: Extraccion[] = [
    ext({ caja_codigo: 'cri_b', valor: null, confianza: 1.0, fuente: 'manual' }),
  ];
  const m = computeMapaIncertidumbre(exts, cajasMock);
  ok('no_aplica solo cuando manual + null + ≥ threshold', m.cajas['cri_b'].status === 'no_aplica');
}

// Caso 6: null por LLM no es no_aplica (es parcial o llena según threshold).
{
  const exts: Extraccion[] = [
    ext({ caja_codigo: 'cri_b', valor: null, confianza: 0.95, fuente: 'llm' }),
  ];
  const m = computeMapaIncertidumbre(exts, cajasMock);
  ok('llm + null + alta confianza ≠ no_aplica (es llena)', m.cajas['cri_b'].status === 'llena');
}

// Caso 7: integración con CAJAS_CANON real.
{
  const m = computeMapaIncertidumbre([], CAJAS_CANON);
  ok(`CAJAS_CANON real (${CAJAS_CANON.length}) carga sin errores`, Object.keys(m.cajas).length === CAJAS_CANON.length);
  ok('todas vacías con catálogo real', Object.values(m.cajas).every((c: CajaState) => c.status === 'vacia'));
}

// =========================================================================
// detectarFatiga
// =========================================================================
console.log('\n[fatiga] detectarFatiga');

// Caso 1: lista vacía → no detectada.
{
  const r = detectarFatiga([]);
  ok('lista vacía → no detectada', !r.detectada);
}

// Caso 2: silencio previo > 30s.
{
  const r = detectarFatiga([{ texto: 'hola', silencio_previo_segundos: 45 }]);
  ok('silencio 45s dispara silencio_pausa', r.detectada && r.tipo === 'silencio_pausa');
}

// Caso 3: keyword "ya no sé".
{
  const r = detectarFatiga([{ texto: 'pues ya no sé qué decirte' }]);
  ok('"ya no sé" dispara keyword', r.detectada && r.tipo === 'keyword');
}

// Caso 4: keyword "siguiente".
{
  const r = detectarFatiga([{ texto: 'siguiente pregunta porfa' }]);
  ok('"siguiente pregunta" dispara keyword', r.detectada && r.tipo === 'keyword');
}

// Caso 5: keyword "no aplica" sola.
{
  const r = detectarFatiga([{ texto: 'no aplica' }]);
  ok('"no aplica" dispara keyword', r.detectada && r.tipo === 'keyword');
}

// Caso 6: brevedad — 3 turnos cortos.
{
  const turnos: TurnoUsuario[] = [
    { texto: 'sí' },
    { texto: 'no sé' },
    { texto: 'igual' },
  ];
  const r = detectarFatiga(turnos);
  ok('3 turnos < 5 palabras dispara brevedad', r.detectada && (r.tipo === 'brevedad' || r.tipo === 'keyword'));
}

// Caso 7: turno largo no dispara nada (sin silencio, sin keyword).
{
  const r = detectarFatiga([{ texto: 'damos crédito desde 2 millones de pesos hasta 200 millones para PMs' }]);
  ok('respuesta detallada no dispara fatiga', !r.detectada);
}

// Caso 8: velocidad — baseline 5 turnos rápidos, luego turno lento.
{
  const baseline: TurnoUsuario[] = Array(5).fill(null).map(() => ({
    texto: 'esta es una respuesta de aproximadamente diez palabras claras y largas hoy',
    duracion_segundos: 5,
  }));
  const lento: TurnoUsuario = { texto: 'eh respuesta corta', duracion_segundos: 30 };
  const r = detectarFatiga([...baseline, lento]);
  ok('WPM cae > 40% dispara velocidad', r.detectada);
}

// =========================================================================
console.log(`\n${pasos - fallos}/${pasos} smoke ✓${fallos ? ` — ${fallos} fallos ✗` : ''}`);
process.exit(fallos === 0 ? 0 : 1);
