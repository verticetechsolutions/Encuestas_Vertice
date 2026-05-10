// Formatters reutilizables para el template del PDF. Conversión de valores
// del schema (`unknown`) a strings legibles + helpers de fechas y números.
//
// `formatValor` es el más complejo: recibe un valor de `caja.valor` (cuyo
// shape depende de `tipo_dato` de `CajaCanon`) y produce un texto humano.
// Casos: null → "Sin requisito" o "No aplica" según `permite_no_aplica`,
// number → tabular MX locale, array → bullets, objeto → key: value lines,
// string → tal cual.

import type { CajaCanon } from '@/lib/schemas/cajas';

const NF_MX = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });
const NF_MX_PCT = new Intl.NumberFormat('es-MX', {
  style: 'percent',
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});
const NF_MXN = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
});
const DT_MX = new Intl.DateTimeFormat('es-MX', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});
const DT_MX_LONG = new Intl.DateTimeFormat('es-MX', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Mexico_City',
});

export function formatFecha(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return DT_MX.format(date);
}

export function formatFechaLarga(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return DT_MX_LONG.format(date);
}

export function formatPct(ratio: number): string {
  return NF_MX_PCT.format(ratio);
}

export function formatNumero(n: number): string {
  return NF_MX.format(n);
}

export function formatMontoMXN(n: number): string {
  return NF_MXN.format(n);
}

/**
 * Renderiza un `valor` de caja a texto humano. Heurística por tipo:
 *  - null          → "Sin requisito" o "No aplica" (según flag de la caja)
 *  - boolean       → "Sí" / "No"
 *  - number        → MX locale, currency si caja.tipo_dato es 'int' y suena a monto
 *  - string        → tal cual
 *  - array         → "• item1\n• item2"
 *  - object        → "key: value\nkey2: value2"
 */
export function formatValor(valor: unknown, caja: CajaCanon | undefined): string {
  if (valor === null || valor === undefined) {
    return caja?.permite_no_aplica ? 'No aplica / sin requisito' : '—';
  }
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (typeof valor === 'number') {
    if (caja?.tipo_dato === 'real' && Math.abs(valor) <= 10) {
      // Probablemente un ratio o un múltiplo (DSCR, deuda/EBITDA, cobertura).
      return formatNumero(valor);
    }
    if (caja?.codigo?.includes('monto') || caja?.codigo?.includes('facturacion')) {
      return formatMontoMXN(valor);
    }
    return formatNumero(valor);
  }
  if (typeof valor === 'string') return valor;
  if (Array.isArray(valor)) {
    if (valor.length === 0) return '—';
    return valor.map((v) => `• ${formatScalar(v)}`).join('\n');
  }
  if (typeof valor === 'object') {
    const obj = valor as Record<string, unknown>;
    return Object.entries(obj)
      .map(([k, v]) => `${k}: ${formatScalar(v)}`)
      .join('\n');
  }
  return String(valor);
}

function formatScalar(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (typeof v === 'number') return formatNumero(v);
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

export function formatTipoInstitucion(tipo: string): string {
  const map: Record<string, string> = {
    banco: 'Banco múltiple',
    sofom_er: 'Sofom Entidad Regulada',
    sofom_enr: 'Sofom Entidad No Regulada',
    sofipo: 'Sociedad Financiera Popular',
    socap: 'Sociedad Cooperativa de Ahorro',
    arrendadora: 'Arrendadora financiera',
    factoraje: 'Empresa de factoraje',
    ifc: 'IFC',
    otro: 'Otro',
  };
  return map[tipo] ?? tipo;
}

export function formatGrupoUI(grupo: string): string {
  const map: Record<string, string> = {
    identificacion: 'Identificación institucional',
    productos_y_mercado: 'Productos y mercado',
    numeros_del_negocio: 'Números del negocio',
    operacion: 'Operación',
    pricing_y_criterio: 'Pricing y criterio',
    contacto_y_especificos: 'Contacto y específicos',
  };
  return map[grupo] ?? grupo;
}

export function formatFuente(fuente: string): string {
  const map: Record<string, string> = {
    llm: 'IA',
    manual: 'Manual',
    decline_to_answer: 'Decline',
    no_aplica: 'N/A',
  };
  return map[fuente] ?? fuente;
}

export function formatRazonDeclinada(razon: string): string {
  const map: Record<string, string> = {
    cap_casos_alcanzado: 'Cap de casos alcanzado',
    cap_turnos_alcanzado: 'Cap de turnos alcanzado',
    no_aplica_explicito: 'Entrevistado declaró que no aplica',
    fatiga_detectada: 'Fatiga detectada',
    avanzar_pendiente_blanda: 'Caja blanda diferida al avanzar',
  };
  return map[razon] ?? razon;
}
