// Template React server-only que produce el HTML del PDF de síntesis.
// Renderizado vía `renderToStaticMarkup` (sin hidration). Cada componente
// produce HTML semántico y minimal, con clases que matchean `styles.ts`.
//
// Estructura del documento (1 PDF por sesión):
//   1. Cover           — marca + razón social + tipo institución + chips
//   2. MetricsBack     — completitud, confianza, intentos, fatiga
//   3. Summary         — resumen_ejecutivo de Opus (1-3 párrafos)
//   4. SectionGroup×N  — una página por grupo_ui (6 grupos)
//   5. DeclinedTable   — cajas que cerraron sin valor
//
// Mapping de cajas: el perfil tiene `cajas: Record<codigo, entry>`. Algunas
// son CANON (49) y otras EXTENSION por tipo (32 max). El template las
// agrupa por `grupo_ui` usando getCajaAny() y filtra a las que aplican a
// esta institución (CAJAS_CANON + EXTENSION[tipo]).

// `import * as React` mantiene compatibilidad con classic JSX transform
// (que necesita React.createElement en scope) además del automatic runtime.
// Necesario porque este archivo se consume desde tsx-cli/scripts (transform
// classic por default) y desde Next/Vitest (automatic runtime). Sin esto,
// classic mode arroja "React is not defined" en runtime.
import * as React from 'react';
import {
  CAJAS_CANON,
  CAJAS_EXTENSION_POR_TIPO,
  type CajaCanon,
  type GrupoUI,
} from '@/lib/schemas/cajas';
import type { TipoInstitucion } from '@/lib/schemas/casos';
import type {
  PerfilDecisionFinal,
  CajaPerfilEntry,
} from '@/lib/schemas/perfil_decision_final';
import {
  formatFecha,
  formatFechaLarga,
  formatPct,
  formatNumero,
  formatValor,
  formatTipoInstitucion,
  formatGrupoUI,
  formatFuente,
  formatRazonDeclinada,
} from './format';

const GRUPO_ORDER: GrupoUI[] = [
  'identificacion',
  'productos_y_mercado',
  'numeros_del_negocio',
  'operacion',
  'pricing_y_criterio',
  'contacto_y_especificos',
];

interface TemplateProps {
  perfil: PerfilDecisionFinal;
  stylesheet: string;
}

export function PdfTemplate({ perfil, stylesheet }: TemplateProps): React.ReactElement {
  const tipo = perfil.institucion.tipo as TipoInstitucion;
  const cajasAplicables = collectCajasAplicables(tipo);
  const cajasPorGrupo = groupByGrupoUI(cajasAplicables);

  // Cajas declinadas (en el perfil, fuente decline_to_answer/no_aplica) +
  // Cajas faltantes (no presentes en perfil.cajas pero aplicables al tipo).
  const declinadas = collectDeclinadas(perfil, cajasAplicables);

  return (
    <html lang="es-MX">
      <head>
        <meta charSet="utf-8" />
        <title>{`Vértice · ${perfil.institucion.razon_social}`}</title>
        {/* `dangerouslySetInnerHTML` mantiene el CSS literal sin React-escape
            de pseudoclases (`@page`, `@font-face`). Es contenido controlado
            por nosotros, no input externo. */}
        <style dangerouslySetInnerHTML={{ __html: stylesheet }} />
      </head>
      <body>
        <Cover perfil={perfil} />
        <MetricsBack perfil={perfil} />
        <Summary text={perfil.resumen_ejecutivo} />
        {GRUPO_ORDER.map((grupo, idx) => {
          const cajas = cajasPorGrupo[grupo] ?? [];
          if (cajas.length === 0) return null;
          return (
            <SectionGroup
              key={grupo}
              numero={idx + 1}
              grupo={grupo}
              cajas={cajas}
              perfil={perfil}
            />
          );
        })}
        {declinadas.length > 0 && <DeclinedSection declinadas={declinadas} />}
      </body>
    </html>
  );
}

// =============================================================================
// Cover
// =============================================================================

function Cover({ perfil }: { perfil: PerfilDecisionFinal }): React.ReactElement {
  return (
    <section className="page cover">
      <div>
        <div className="cover__brand">
          <span className="cover__logo-mark" aria-hidden="true" />
          <span className="cover__logo">Vértice</span>
        </div>
        <p className="cover__tagline">Credit box · Síntesis de entrevista</p>
      </div>

      <div>
        <p className="eyebrow">Perfil de decisión</p>
        <h1 className="cover__title">{perfil.institucion.razon_social}</h1>
        {perfil.institucion.nombre_comercial && (
          <p className="cover__subtitle">{perfil.institucion.nombre_comercial}</p>
        )}
        <div style={{ marginTop: '24pt' }}>
          <span className="cover__chip">{formatTipoInstitucion(perfil.institucion.tipo)}</span>
          <span className="cover__chip">v{perfil.schema_version}</span>
        </div>
      </div>

      <dl className="cover__meta">
        <div>
          <dt>Generado</dt>
          <dd>{formatFechaLarga(perfil.generado_at)}</dd>
        </div>
        <div>
          <dt>Sesión</dt>
          <dd style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: '9pt' }}>
            {perfil.sesion_id.slice(0, 8)}…
          </dd>
        </div>
        <div>
          <dt>Cajas aplicables</dt>
          <dd>{formatNumero(perfil.metricas.cajas_aplicables)}</dd>
        </div>
        <div>
          <dt>Completitud</dt>
          <dd>{formatPct(perfil.metricas.completitud)}</dd>
        </div>
      </dl>
    </section>
  );
}

// =============================================================================
// Metrics back-cover
// =============================================================================

function MetricsBack({ perfil }: { perfil: PerfilDecisionFinal }): React.ReactElement {
  const m = perfil.metricas;
  return (
    <section className="page metrics">
      <p className="eyebrow">Indicadores globales</p>
      <h2 className="section__title" style={{ marginTop: '6pt' }}>
        Cómo leer este perfil
      </h2>
      <p className="cover__subtitle" style={{ marginTop: '6pt', maxWidth: '38em' }}>
        Cada caja del credit box se llenó con una de tres fuentes: extracción de la entrevista,
        intervención manual del entrevistador, o cierre sin valor (cap de casos sintéticos
        alcanzado o respuesta explícita de no aplica). Las métricas siguientes resumen el material.
      </p>

      <div className="metrics__grid">
        <Metric label="Completitud" value={formatPct(m.completitud)} caption={`${formatNumero(m.cajas_llenas)} de ${formatNumero(m.cajas_aplicables)} cajas`} />
        <Metric label="Confianza global" value={formatPct(m.confianza_global)} caption="Promedio ponderado" />
        <Metric label="Cajas críticas" value={formatPct(m.cajas_criticas_pct)} caption="Decisión fondea/no fondea" />
        <Metric label="Cajas blandas" value={formatPct(m.cajas_blandas_pct)} caption="Contexto y matiz" />
        <Metric
          label="Casos sintéticos"
          value={formatNumero(m.casos_sinteticos_aplicados)}
          caption="De 5 disponibles por sesión"
          small
        />
        <Metric
          label="Fatiga"
          value={m.fatiga_detectada ? 'Detectada' : 'No detectada'}
          caption={
            m.fatiga_detectada
              ? 'Acortamos batches en la última sección'
              : 'Sesión completa sin recortes'
          }
          small
        />
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  caption,
  small,
}: {
  label: string;
  value: string;
  caption: string;
  small?: boolean;
}): React.ReactElement {
  return (
    <div className="metric">
      <div className="metric__label">{label}</div>
      <div className={'metric__value' + (small ? ' metric__value--small' : '')}>{value}</div>
      <div className="metric__caption">{caption}</div>
    </div>
  );
}

// =============================================================================
// Summary (resumen ejecutivo)
// =============================================================================

function Summary({ text }: { text: string }): React.ReactElement {
  // Opus emite 1-3 párrafos separados por \n\n. Splitamos en <p> para
  // que CSS controle line-height + spacing — más limpio que <pre-wrap>.
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return (
    <section className="page summary">
      <p className="eyebrow">Resumen ejecutivo</p>
      <h2 className="summary__title">Lectura sintética</h2>
      <hr className="hairline-gold" />
      <div className="summary__body" style={{ marginTop: '14pt' }}>
        {paragraphs.length > 0
          ? paragraphs.map((p, i) => <p key={i}>{p}</p>)
          : <p>{text}</p>}
      </div>
    </section>
  );
}

// =============================================================================
// SectionGroup (página por grupo_ui)
// =============================================================================

function SectionGroup({
  numero,
  grupo,
  cajas,
  perfil,
}: {
  numero: number;
  grupo: GrupoUI;
  cajas: CajaCanon[];
  perfil: PerfilDecisionFinal;
}): React.ReactElement {
  const llenas = cajas.filter((c) => {
    const entry = perfil.cajas[c.codigo];
    return entry && entry.fuente !== 'decline_to_answer';
  });
  const titulo = formatGrupoUI(grupo);

  return (
    <section className="section">
      <header className="section__header">
        <span className="section__number">{`§ 0${numero}`}</span>
        <h2 className="section__title">{titulo}</h2>
        <span className="section__count">{`${formatNumero(llenas.length)}/${formatNumero(cajas.length)} cajas`}</span>
      </header>

      {llenas.length === 0 ? (
        <div className="empty-state">
          Esta sección no recolectó valores en la entrevista. Ninguna de las {cajas.length} cajas
          aplicables cerró con respuesta directa.
        </div>
      ) : (
        <table className="box-table">
          <thead>
            <tr>
              <th className="box-row__label">Caja</th>
              <th>Valor</th>
              <th className="box-row__fuente">Fuente</th>
              <th className="box-row__confianza">Conf.</th>
            </tr>
          </thead>
          <tbody>
            {cajas.map((c) => {
              const entry = perfil.cajas[c.codigo];
              if (!entry || entry.fuente === 'decline_to_answer') return null;
              return <BoxRow key={c.codigo} caja={c} entry={entry} />;
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

function BoxRow({ caja, entry }: { caja: CajaCanon; entry: CajaPerfilEntry }): React.ReactElement {
  const valor = formatValor(entry.valor, caja);
  const valorIsNull = entry.valor === null || entry.valor === undefined;
  const conf = entry.confianza;
  const confClass =
    conf < 0.6 ? ' box-row__confianza--low' : conf < 0.8 ? ' box-row__confianza--mid' : '';
  const codigoClass = caja.criticidad === 'critica' ? ' box-row__codigo--critical' : '';

  return (
    <tr>
      <td className="box-row__label">
        <span className="box-row__name">{caja.descripcion}</span>
        <span className={'box-row__codigo' + codigoClass}>
          {caja.codigo}
          {caja.criticidad === 'critica' ? ' · crítica' : ''}
        </span>
      </td>
      <td className={'box-row__valor' + (valorIsNull ? ' box-row__valor--null' : '')}>
        {valor}
      </td>
      <td className="box-row__fuente">{formatFuente(entry.fuente)}</td>
      <td className={'box-row__confianza' + confClass}>{conf.toFixed(2)}</td>
    </tr>
  );
}

// =============================================================================
// Declined section
// =============================================================================

interface DeclinadaItem {
  codigo: string;
  descripcion: string;
  razon: string;
  intentos: number;
}

function DeclinedSection({ declinadas }: { declinadas: DeclinadaItem[] }): React.ReactElement {
  return (
    <section className="declined">
      <header className="section__header">
        <span className="section__number">§ 07</span>
        <h2 className="section__title">Cajas sin cierre</h2>
        <span className="section__count">{`${formatNumero(declinadas.length)} cajas`}</span>
      </header>
      <p className="declined__intro">
        Las siguientes cajas cerraron sin valor por cap de casos sintéticos, fatiga, o
        respuesta explícita de no aplica. Conservadas para auditoría y para guiar el
        prompt en sesiones futuras.
      </p>
      <table className="declined-table">
        <thead>
          <tr>
            <th style={{ width: '24%' }}>Código</th>
            <th>Descripción</th>
            <th style={{ width: '24%' }}>Razón</th>
            <th style={{ width: '10%', textAlign: 'right' }}>Intentos</th>
          </tr>
        </thead>
        <tbody>
          {declinadas.map((d) => (
            <tr key={d.codigo}>
              <td className="codigo">{d.codigo}</td>
              <td>{d.descripcion}</td>
              <td>{formatRazonDeclinada(d.razon)}</td>
              <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {d.intentos}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function collectCajasAplicables(tipo: TipoInstitucion): CajaCanon[] {
  return [...CAJAS_CANON, ...(CAJAS_EXTENSION_POR_TIPO[tipo] ?? [])];
}

function groupByGrupoUI(cajas: CajaCanon[]): Record<GrupoUI, CajaCanon[]> {
  const out: Record<GrupoUI, CajaCanon[]> = {
    identificacion: [],
    productos_y_mercado: [],
    numeros_del_negocio: [],
    operacion: [],
    pricing_y_criterio: [],
    contacto_y_especificos: [],
  };
  for (const c of cajas) out[c.grupo_ui].push(c);
  return out;
}

function collectDeclinadas(
  perfil: PerfilDecisionFinal,
  cajasAplicables: CajaCanon[]
): DeclinadaItem[] {
  const out: DeclinadaItem[] = [];
  for (const caja of cajasAplicables) {
    const entry = perfil.cajas[caja.codigo];
    if (!entry) {
      out.push({
        codigo: caja.codigo,
        descripcion: caja.descripcion,
        razon: 'no_recolectada',
        intentos: 0,
      });
      continue;
    }
    if (entry.fuente === 'decline_to_answer') {
      out.push({
        codigo: caja.codigo,
        descripcion: caja.descripcion,
        razon: 'cap_alcanzado',
        intentos: entry.intentos,
      });
    }
  }
  return out;
}

// Footer template usado por puppeteer.page.pdf({ footerTemplate }). Se inyecta
// directamente en el contexto de impresión de Chromium — Chromium soporta
// las clases especiales `pageNumber`, `totalPages`, `date`. Mantener inline
// styles porque el footer NO hereda los <style> del documento.
export function pdfFooterTemplate(perfil: PerfilDecisionFinal): string {
  const fecha = formatFecha(perfil.generado_at);
  return `
<div style="font-family: 'Geist', system-ui, sans-serif; font-size: 7.5pt; color: #4A536B; padding: 0 22mm; width: 100%; display: flex; justify-content: space-between; align-items: center;">
  <span style="letter-spacing: 0.12em; text-transform: uppercase;">Vértice · ${escapeHtml(perfil.institucion.razon_social)}</span>
  <span style="font-variant-numeric: tabular-nums;">${escapeHtml(fecha)} · <span class="pageNumber"></span> / <span class="totalPages"></span></span>
</div>
`.trim();
}

export function pdfHeaderTemplate(): string {
  // Header minimalista — solo hairline gold + tagline. Chromium descarta el
  // header si está vacío, pero queremos uniformidad visual entre páginas.
  return `
<div style="width: 100%; padding: 0 22mm; font-family: 'Geist Mono', ui-monospace, monospace; font-size: 7pt; color: #9C824A; letter-spacing: 0.16em; text-transform: uppercase; display: flex; justify-content: flex-end;">
  <span>Credit box · perfil de decisión</span>
</div>
`.trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
