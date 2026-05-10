// Print CSS scoped al documento de síntesis. NO usa Tailwind — el HTML del
// PDF nunca se sirve por Next, así que evitamos el overhead del runtime de
// Tailwind y declaramos cada selector explícito. El output es estable,
// reviewable, y cero dependencia transitoria.
//
// Paleta navy + gold + cream, leyendo los hex literales desde la marca
// `app/globals.css` (mantener en sync con esos tokens si la marca evoluciona).
//
// `@page` controla márgenes A4 y permite headers/footers (los inyectamos via
// puppeteer page.pdf({ headerTemplate, footerTemplate }) — más control que
// running headers CSS, que Chromium no implementa completo).
//
// page-break controls: `break-before: page` para Cover y cada SectionGroup,
// `break-inside: avoid` para filas de tabla y bloques cohesivos.

import { embedFontsCss, FONT_STACKS } from './fonts';

// Brand tokens — espejo de --ink, --gold, etc. de globals.css. Mantenerlos
// inline aquí (no var(--x)) porque @page rules no resuelven custom props
// declaradas fuera de su scope.
export const COLORS = {
  ink: '#0A0F1C',
  inkRaised: '#1A2236',
  inkSoft: '#2A3349', // computed mid entre ink-raised y un gris-azul para texto secundario
  cream: '#F4F1EA',
  creamDeep: '#E8E2D2', // hairlines suaves sobre cream
  gold: '#C8A864',
  goldDeep: '#9C824A',
  goldBright: '#F2D89C',
  goldLight: '#E0BE7C',
  burgundy: '#8B3A3A',
  // Grises tipográficos — NO usar #000 puro (regla CLAUDE.md).
  textPrimary: '#0E1422',
  textSecondary: '#4A536B',
  textMuted: '#7A8198',
  hairline: 'rgba(10, 15, 28, 0.08)',
  hairlineStrong: 'rgba(10, 15, 28, 0.16)',
} as const;

export function buildStylesheet(): string {
  return `
${embedFontsCss()}

/* =========================================================================
   Reset mínimo + base tipográfica
   ========================================================================= */
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: ${FONT_STACKS.sans};
  font-size: 10.5pt;
  line-height: 1.55;
  color: ${COLORS.textPrimary};
  background: #ffffff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
  font-feature-settings: 'cv11', 'ss01', 'tnum';
  -webkit-font-smoothing: antialiased;
}

/* @page A4 portrait con márgenes editoriales (24mm). Header/footer lo
   inyecta puppeteer.page.pdf — no usamos margin boxes CSS porque Chromium
   tiene soporte parcial. */
@page {
  size: A4 portrait;
  margin: 24mm 22mm;
}
@page:first {
  /* La portada respira más arriba; reducimos el margen superior para que
     el bloque marca + razón social caiga centrado. */
  margin: 28mm 22mm;
}

/* =========================================================================
   Layout primitives
   ========================================================================= */
.page {
  break-before: page;
  break-inside: auto;
}
.page:first-child { break-before: auto; }

.eyebrow {
  font-family: ${FONT_STACKS.mono};
  font-size: 8pt;
  font-weight: 500;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: ${COLORS.goldDeep};
}

.hairline {
  height: 1px;
  background: ${COLORS.hairline};
  border: 0;
  margin: 0;
}
.hairline-gold {
  height: 1px;
  background: ${COLORS.gold};
  border: 0;
  margin: 0;
}

/* =========================================================================
   Cover
   ========================================================================= */
.cover {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: calc(297mm - 56mm); /* alto A4 menos márgenes */
  break-after: page;
}
.cover__brand {
  display: flex;
  align-items: baseline;
  gap: 14pt;
}
.cover__logo {
  font-family: ${FONT_STACKS.display};
  font-size: 22pt;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: ${COLORS.ink};
}
.cover__logo-mark {
  display: inline-block;
  width: 22pt;
  height: 22pt;
  border: 1.5pt solid ${COLORS.gold};
  transform: rotate(45deg);
  position: relative;
  top: 2pt;
}
.cover__tagline {
  font-family: ${FONT_STACKS.mono};
  font-size: 8.5pt;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: ${COLORS.textSecondary};
}
.cover__title {
  margin: 0;
  font-family: ${FONT_STACKS.display};
  font-size: 36pt;
  line-height: 1.05;
  letter-spacing: -0.02em;
  font-weight: 600;
  color: ${COLORS.ink};
  max-width: 14em;
}
.cover__subtitle {
  margin-top: 18pt;
  font-size: 12pt;
  line-height: 1.45;
  color: ${COLORS.textSecondary};
  max-width: 38em;
}
.cover__chip {
  display: inline-block;
  font-family: ${FONT_STACKS.mono};
  font-size: 8pt;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: ${COLORS.goldDeep};
  border: 1px solid ${COLORS.gold};
  padding: 4pt 10pt;
  border-radius: 999px;
  margin-right: 8pt;
}
.cover__meta {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 18pt 24pt;
  margin-top: 28pt;
  padding-top: 18pt;
  border-top: 1px solid ${COLORS.gold};
}
.cover__meta dt {
  font-family: ${FONT_STACKS.mono};
  font-size: 8pt;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: ${COLORS.textMuted};
  margin-bottom: 4pt;
}
.cover__meta dd {
  margin: 0;
  font-size: 11pt;
  font-weight: 500;
  color: ${COLORS.ink};
  font-variant-numeric: tabular-nums;
}

/* =========================================================================
   Métricas (cover-back)
   ========================================================================= */
.metrics {
  break-before: page;
  break-after: page;
}
.metrics__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0;
  margin-top: 18pt;
  border-top: 1px solid ${COLORS.hairline};
}
.metric {
  padding: 16pt 18pt;
  border-right: 1px solid ${COLORS.hairline};
  border-bottom: 1px solid ${COLORS.hairline};
}
.metric:nth-child(2n) { border-right: 0; }
.metric__label {
  font-family: ${FONT_STACKS.mono};
  font-size: 7.5pt;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: ${COLORS.textMuted};
}
.metric__value {
  font-family: ${FONT_STACKS.display};
  font-size: 26pt;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: ${COLORS.ink};
  margin-top: 4pt;
  font-variant-numeric: tabular-nums;
}
.metric__value--small {
  font-size: 18pt;
  font-weight: 500;
}
.metric__caption {
  font-size: 9pt;
  color: ${COLORS.textSecondary};
  margin-top: 4pt;
}

/* =========================================================================
   Resumen ejecutivo
   ========================================================================= */
.summary {
  break-before: page;
}
.summary__title {
  font-family: ${FONT_STACKS.display};
  font-size: 22pt;
  letter-spacing: -0.01em;
  font-weight: 600;
  color: ${COLORS.ink};
  margin: 8pt 0 14pt;
}
.summary__body {
  font-size: 11pt;
  line-height: 1.7;
  color: ${COLORS.textPrimary};
  max-width: 38em;
  white-space: pre-wrap;
}
.summary__body p {
  margin: 0 0 12pt;
}

/* =========================================================================
   Sections (grupos UI)
   ========================================================================= */
.section {
  break-before: page;
}
.section__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 18pt;
  padding-bottom: 12pt;
  border-bottom: 1px solid ${COLORS.gold};
}
.section__number {
  font-family: ${FONT_STACKS.mono};
  font-size: 9pt;
  letter-spacing: 0.16em;
  color: ${COLORS.goldDeep};
}
.section__title {
  font-family: ${FONT_STACKS.display};
  font-size: 24pt;
  letter-spacing: -0.01em;
  font-weight: 600;
  color: ${COLORS.ink};
  margin: 0;
  flex: 1;
}
.section__count {
  font-family: ${FONT_STACKS.mono};
  font-size: 9pt;
  color: ${COLORS.textMuted};
  letter-spacing: 0.06em;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* =========================================================================
   Box table
   ========================================================================= */
.box-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 14pt;
  font-size: 9.5pt;
}
.box-table thead th {
  font-family: ${FONT_STACKS.mono};
  font-size: 7.5pt;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: ${COLORS.textMuted};
  text-align: left;
  padding: 10pt 8pt 8pt;
  border-bottom: 1px solid ${COLORS.hairlineStrong};
}
.box-table tbody tr {
  break-inside: avoid;
}
.box-table tbody td {
  vertical-align: top;
  padding: 11pt 8pt;
  border-bottom: 1px solid ${COLORS.hairline};
}
.box-table tbody tr:last-child td { border-bottom: 0; }
.box-row__label {
  width: 36%;
}
.box-row__name {
  font-weight: 500;
  color: ${COLORS.ink};
  font-size: 10pt;
  display: block;
  line-height: 1.35;
}
.box-row__codigo {
  font-family: ${FONT_STACKS.mono};
  font-size: 8pt;
  color: ${COLORS.textMuted};
  margin-top: 2pt;
  letter-spacing: 0.04em;
}
.box-row__codigo--critical {
  color: ${COLORS.goldDeep};
}
.box-row__valor {
  font-size: 10pt;
  color: ${COLORS.textPrimary};
  font-variant-numeric: tabular-nums;
  white-space: pre-wrap;
  word-break: break-word;
}
.box-row__valor--null { color: ${COLORS.textMuted}; font-style: italic; }
.box-row__fuente {
  width: 12%;
  font-family: ${FONT_STACKS.mono};
  font-size: 8pt;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${COLORS.textSecondary};
}
.box-row__confianza {
  width: 14%;
  font-family: ${FONT_STACKS.mono};
  font-size: 9.5pt;
  font-variant-numeric: tabular-nums;
  text-align: right;
  color: ${COLORS.ink};
}
.box-row__confianza--low { color: ${COLORS.burgundy}; }
.box-row__confianza--mid { color: ${COLORS.goldDeep}; }

/* =========================================================================
   Declined table
   ========================================================================= */
.declined {
  break-before: page;
}
.declined__intro {
  font-size: 10pt;
  color: ${COLORS.textSecondary};
  max-width: 38em;
  margin: 12pt 0 16pt;
}
.declined-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 9.5pt;
}
.declined-table thead th {
  font-family: ${FONT_STACKS.mono};
  font-size: 7.5pt;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: ${COLORS.textMuted};
  text-align: left;
  padding: 10pt 8pt 8pt;
  border-bottom: 1px solid ${COLORS.hairlineStrong};
}
.declined-table tbody tr { break-inside: avoid; }
.declined-table tbody td {
  padding: 10pt 8pt;
  border-bottom: 1px solid ${COLORS.hairline};
  vertical-align: top;
}
.declined-table tbody tr:last-child td { border-bottom: 0; }
.declined-table .codigo {
  font-family: ${FONT_STACKS.mono};
  font-size: 8.5pt;
  color: ${COLORS.goldDeep};
  letter-spacing: 0.04em;
}

/* =========================================================================
   Empty state (no aplica esta sección)
   ========================================================================= */
.empty-state {
  margin-top: 14pt;
  padding: 14pt 18pt;
  border-left: 2px solid ${COLORS.gold};
  font-size: 10pt;
  color: ${COLORS.textSecondary};
  background: rgba(200, 168, 100, 0.05);
}
`.trim();
}
