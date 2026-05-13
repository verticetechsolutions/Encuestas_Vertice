// Curated subset of 10 cases from docs/reference/guion-casos-mini.pdf (full PDF: 75 casos / 5 sectores).
// Used as: (a) fallback when Opus synthetic-case generation fails, (b) few-shots for Opus.
//
// Selection rationale:
//   - 5 sectores covered (4 construcción / 1 transporte / 2 manufactura / 1 comercio / 1 agro)
//   - 9 productos distintos (personal nómina, factoraje, arrendamiento financiero, simple
//     consolidador, refaccionario, revolvente, refaccionario FIRA, sindicado bimoneda)
//   - Rango $80K → $195M
//   - Las 5 tolerancias `to_*` cubiertas:
//       to_historial_credito  ← CASO-002 (sin Buró PM), CASO-005 (MOP 02), CASO-031 (retraso 30d)
//       to_situacion_fiscal   ← CASO-002 (RESICO), CASO-012 (32-D negativa)
//       to_ratios_financieros ← CASO-008 (DSCR 1.05x)
//       to_colateral          ← CASO-005 (cesión derechos), CASO-006 (juicio mercantil)
//       to_gobierno_documentacion ← CASO-006 (juicio activo en reporte especial)
//
// `decision_esperada_por_tipo` is intentionally `undefined` for all 10 — empirical data from
// real interviews seeds this field post-launch (founder decision 2026-04-30, P2 option A).
//
// Note on `pago_estimado_mxn`: stored as monthly equivalent for cross-case comparability.
// CASO-105 has semestral periodicity ($2.4M/semestre) — monthly equivalent stored, actual
// periodicity flagged in complicaciones.
// Note on `facturacion_*` for PF: CASO-101 is asalariado — `facturacion` fields hold ingreso
// neto (the semantic analog) since the type doesn't carry a separate ingreso slot.

import type { CasoSintetico } from '@/lib/schemas/casos';

export const safeRailsCasos: CasoSintetico[] = [
  {
    id: 'CASO-101',
    titulo: 'Abogado empleado de despacho reconocido solicita préstamo personal para remodelación de vivienda',
    resumen_ejecutivo:
      'Abogado asalariado 28 años, 3 años en despacho jurídico de Guadalajara, ingreso neto $27K/mes. Busca $80K crédito personal nómina para remodelar vivienda familiar. Primera operación formal, historial corto en Buró PF.',
    sector: 'Construcción e Inmobiliario',
    tipo_credito: 'Crédito personal con descuento por nómina',
    monto_solicitado_mxn: 80_000,
    necesidad: {
      destino: 'Remodelación de vivienda familiar',
      desglose: 'Materiales ($45K) + mano de obra ($35K)',
      urgencia: 'Inicio de obra en 3 semanas',
    },
    situacion_financiera: {
      facturacion_mensual_mxn: 27_000, // ingreso neto sueldos y salarios
      facturacion_anual_mxn: 324_000,
      gastos_fijos_mxn: 18_500,
      pasivos_vigentes: '1 TDC personal con saldo $12K (uso ocasional)',
      pago_estimado_mxn: 2_700, // mensual equivalente; pago real quincenal $1,350
      plazo_meses: 36,
    },
    historial_crediticio: {
      antiguedad_anos: 3,
      retrasos: 'Sin retrasos registrados',
      score_buro_pm: null,
      score_buro_pf: 695,
      opinion_sat_32d: 'positiva',
    },
    garantias: {
      items: [
        { tipo: 'Capacidad de pago por descuento vía nómina (72 quincenas × $2,700)', valor_mxn: 194_400 },
        { tipo: 'TDC personal disponible como línea de contingencia', valor_mxn: 88_000 },
      ],
      suma_mxn: 194_400,
      cobertura_x: 2.43,
    },
    complicaciones: [
      'Producto depende del convenio de descuento por nómina firmado por el despacho. Si el patrón no firma, el producto se convierte en crédito personal estándar con tasa 5-8 pp más alta (27-32% vs 20-24%).',
      'Primera operación formal de crédito: historial Buró corto (solo 1 TDC) limita acceso a tasas preferenciales bancarias. Canalizar a fintechs con scoring alternativo (Klar, Kueski, Flink, Nu) — aprueban en 48 h con tasa 20-24%.',
      'DTI ~10% saludable, pero margen mensual disponible ($8,500 después de gastos fijos) debe absorber imprevistos. Recomendar seguro de vida y desempleo asociado al crédito.',
    ],
    documentacion_disponible: [
      'INE vigente, CURP, RFC',
      'Últimos 3 recibos de nómina con sello del despacho',
      'Constancia laboral firmada por socio del despacho',
      'Comprobante de domicilio (no mayor a 3 meses)',
      'Estados de cuenta bancarios personales 6 meses',
      'Buró de Crédito PF',
      'Declaración anual de personas físicas del último ejercicio',
      'Consentimiento firmado para descuento vía nómina',
    ],
    cajas_objetivo: ['nm_tipos_cliente', 'ru_monto_min', 'nm_productos_ofrecidos', 'op_documentacion_estandar'],
  },

  {
    id: 'CASO-002',
    titulo: 'Subcontratista hombre-camión quiere crecer flota de volteos para obra carretera',
    resumen_ejecutivo:
      'Operador PFAE RESICO, 9 años en movimiento de tierras con 2 Kenworth T370 pagados. Gana subcontrato carretero en Los Altos de Jalisco y requiere 3 volteos adicionales por $3.2M. Sin historial formal en Buró PM (expediente no encontrado), CFDI $280K/mes pero flujo bancario real $340K.',
    sector: 'Construcción e Inmobiliario',
    tipo_credito: 'Arrendamiento financiero',
    monto_solicitado_mxn: 3_200_000,
    necesidad: {
      destino: 'Adquisición de 3 volteos seminuevos',
      desglose: '3 Kenworth T370 2022 ($1.05M c/u + placas y GPS)',
      urgencia: 'Inicio de obra en 6 semanas',
    },
    situacion_financiera: {
      facturacion_mensual_mxn: 280_000, // CFDI; flujo bancario real $340K
      facturacion_anual_mxn: 3_360_000,
      gastos_fijos_mxn: 215_000,
      pasivos_vigentes: 'Ninguno. Unidades actuales liquidadas.',
      pago_estimado_mxn: 85_000,
      plazo_meses: 48,
    },
    historial_crediticio: {
      antiguedad_anos: 9,
      retrasos: 'Sin historial formal en Buró PM (expediente no encontrado pese a 9 años operando)',
      score_buro_pm: null,
      score_buro_pf: 640,
      opinion_sat_32d: 'positiva',
    },
    garantias: {
      items: [
        { tipo: '3 volteos Kenworth T370 2022 (prendaria sobre activo nuevo)', valor_mxn: 3_200_000 },
        { tipo: '2 volteos actuales libres de gravamen', valor_mxn: 1_700_000 },
        { tipo: 'Casa familiar escriturada a nombre del solicitante', valor_mxn: 2_800_000 },
        { tipo: 'Aval solidario de la esposa', valor_mxn: 0 },
      ],
      suma_mxn: 7_700_000,
      cobertura_x: 2.41,
    },
    complicaciones: [
      'Sin historial formal en Buró PM pese a 9 años operando. Banca comercial rechaza por score empresarial inexistente — requiere SOFOM especializada en transporte o fintech con scoring alternativo (Konfío, One Financiera).',
      'Régimen RESICO simplificado limita la comprobación de flujo real. La facturación CFDI ($280K) no respalda por sí sola el pago mensual; deben usarse estados de cuenta bancarios para demostrar flujo adicional.',
      'Las 3 unidades nuevas requieren alta SCT, Carta Porte CFDI 4.0, GPS y póliza integral antes del primer viaje (3-4 semanas).',
    ],
    documentacion_disponible: [
      'INE y CURP',
      'Constancia de situación fiscal RESICO',
      'Estados de cuenta bancarios 12 meses',
      'Facturación CFDI 12 meses',
      'Tarjetas de circulación y permisos SCT de los 2 volteos actuales',
      'Opinión SAT 32-D vigente',
      'Contrato de subcontratación firmado con constructora',
      'Escrituras de la casa familiar',
      'Buró PF y consulta especial de Buró PM',
    ],
    cajas_objetivo: [
      'to_historial_credito',
      'to_situacion_fiscal',
      'se_sin_historial',
      'nm_tipos_cliente',
      'gr_tipos_garantia',
    ],
  },

  {
    id: 'CASO-005',
    titulo: 'Contratista con estimaciones gubernamentales atrasadas requiere liquidez',
    resumen_ejecutivo:
      'Constructora ejecuta obra de rehabilitación vial en Zapopan ($18M total). Tiene 3 estimaciones validadas por $4.5M sin pago de tesorería municipal. Buró registra MOP 02 activo (30 días) con proveedor de materiales causado por la misma falta de pago. Cláusula de rescisión a 45 días de suspensión.',
    sector: 'Construcción e Inmobiliario',
    tipo_credito: 'Factoraje sin recurso sobre estimaciones (NAFIN Cadenas Productivas)',
    monto_solicitado_mxn: 4_500_000,
    necesidad: {
      destino: 'Liquidez inmediata por estimaciones atrasadas',
      desglose: '3 estimaciones validadas a descuento (3-4% sobre valor nominal)',
      urgencia: 'Reanudar obra en 3 semanas (cláusula de rescisión a 45 días)',
    },
    situacion_financiera: {
      facturacion_mensual_mxn: 2_800_000,
      facturacion_anual_mxn: 33_600_000,
      gastos_fijos_mxn: 2_100_000,
      pasivos_vigentes:
        'Crédito simple $2.5M (saldo $820K, al corriente) + línea revolvente $1.5M (dispuesta $780K)',
      pago_estimado_mxn: 140_000, // costo del factoraje (descuento)
      plazo_meses: 3, // 45-90 días al cobro del municipio
    },
    historial_crediticio: {
      antiguedad_anos: 11,
      retrasos:
        '1 retraso MOP 02 activo con proveedor (30 días) — causado por falta de pago de la tesorería municipal',
      score_buro_pm: 625,
      score_buro_pf: 670,
      opinion_sat_32d: 'positiva',
    },
    garantias: {
      items: [
        { tipo: '3 estimaciones municipales validadas y cedidas', valor_mxn: 4_500_000 },
        { tipo: 'Casa del director general como aval', valor_mxn: 3_200_000 },
        { tipo: 'Contrato municipal vigente como respaldo de flujo ($18M total)', valor_mxn: 0 },
      ],
      suma_mxn: 7_700_000,
      cobertura_x: 1.71,
    },
    complicaciones: [
      'MOP 02 activo en Buró (no regularizado) → rechazo automático en banca comercial. Solo factoraje que evalúa al pagador (municipio), no al cedente, resuelve la situación.',
      'Las 3 estimaciones requieren cesión formal de derechos ante tesorería municipal (2-3 semanas). Carta aclaratoria del oficio de validación es indispensable.',
      'Cláusula de rescisión a 45 días de suspensión de obra: si no se resuelve en 3 semanas, se pierde el contrato completo y se cae en cartera vencida múltiple.',
    ],
    documentacion_disponible: [
      'Contrato de obra municipal',
      '3 estimaciones validadas con oficios de validación',
      'Actas de recepción parcial',
      'Buró PM y PF actualizados',
      'Estados financieros 2 ejercicios',
      'Cédula fiscal',
      'Opinión SAT 32-D',
      'Estados de cuenta 12 meses',
      'Carta de solicitud de cesión de derechos ante tesorería',
      'Oficios del municipio reconociendo el adeudo',
    ],
    cajas_objetivo: [
      'nm_productos_ofrecidos',
      'nm_sectores_aceptados',
      'to_historial_credito',
      'to_colateral',
      'gr_tipos_garantia',
    ],
  },

  {
    id: 'CASO-006',
    titulo: 'Constructora con juicio mercantil activo busca maquinaria para obra privada',
    resumen_ejecutivo:
      'Constructora de Guadalajara, 8 años, enfrenta demanda mercantil por $2.1M (disputa por calidad de material). Juicio en 1ª instancia (14 meses) aparece en reporte especial de Buró PM. Tiene contrato firme con cadena hotelera en Puerto Vallarta por $28M y requiere maquinaria. Banca comercial la rechaza automáticamente.',
    sector: 'Construcción e Inmobiliario',
    tipo_credito: 'Arrendamiento financiero',
    monto_solicitado_mxn: 5_200_000,
    necesidad: {
      destino: 'Maquinaria ligera para obra hotelera',
      desglose: '2 miniexcavadoras CAT 308 ($2.3M c/u) + compactadora Bomag BW 211 ($600K)',
      urgencia: 'Inicio de obra en 5 semanas',
    },
    situacion_financiera: {
      facturacion_mensual_mxn: 4_600_000,
      facturacion_anual_mxn: 55_200_000,
      gastos_fijos_mxn: 3_100_000,
      pasivos_vigentes:
        'Crédito simple $6M (saldo $2.8M) + arrendamiento $1.4M (saldo $480K), ambos al corriente',
      pago_estimado_mxn: 170_000,
      plazo_meses: 36,
    },
    historial_crediticio: {
      antiguedad_anos: 8,
      retrasos:
        'Sin retrasos en créditos. Juicio mercantil activo $2.1M en 1ª instancia (registro permanece en Buró hasta 6 años).',
      score_buro_pm: 595,
      score_buro_pf: 715,
      opinion_sat_32d: 'positiva',
    },
    garantias: {
      items: [
        { tipo: 'Contrato firme con cadena hotelera Puerto Vallarta', valor_mxn: 28_000_000 },
        { tipo: 'Inmueble del director general (aval, sin gravamen)', valor_mxn: 4_800_000 },
        { tipo: 'Maquinaria nueva (prendaria sobre activo)', valor_mxn: 5_200_000 },
        { tipo: 'Nave de almacén libre de gravamen', valor_mxn: 3_500_000 },
      ],
      suma_mxn: 41_500_000,
      cobertura_x: 7.98,
    },
    complicaciones: [
      'Juicio mercantil de $2.1M aparece en reporte especial de Buró PM y activa rechazo automático en banca. Canalizar a SOFOM especializada (Pretmex, Arrendadora Actinver) con enfoque en garantía real sobre el inmueble del DG.',
      'Riesgo de embargo precautorio sobre activos si el demandante solicita medida cautelar. Garantizar el monto del juicio con fianza judicial.',
      'Aunque el litigio se resuelva (estimación abogado: 12-18 meses), el registro permanece en Buró hasta 6 años. Alternativa de mediano plazo: operar nuevas operaciones a nombre de filial con perfil limpio.',
    ],
    documentacion_disponible: [
      'Acta constitutiva',
      'Informe legal del juicio y carta del abogado con estimación de resolución',
      'Contrato firmado con cadena hotelera',
      'Estados financieros auditados 3 ejercicios',
      'Escrituras de inmuebles libres de gravamen',
      'Cotización de maquinaria CAT',
      'Pólizas de seguro vigentes',
      'Buró PM y PF',
      'Opinión SAT 32-D',
      'Propuesta de fianza judicial',
    ],
    cajas_objetivo: [
      'to_colateral',
      'to_gobierno_documentacion',
      'se_concurso_mercantil',
      'gr_tipos_garantia',
      'gr_cobertura_min',
    ],
  },

  {
    id: 'CASO-008',
    titulo: 'Constructora regional consolida cuatro créditos activos con DSCR ajustado',
    resumen_ejecutivo:
      'Constructora regional 18 años, 240 empleados, $189.6M facturación anual, ejecuta obra pública y privada en 4 estados. Tiene 4 créditos activos ($31M total) y DSCR cayó a 1.05x. Ninguna institución le aprueba nuevo financiamiento. Necesita consolidar urgentemente para liberar flujo y evitar cartera vencida.',
    sector: 'Construcción e Inmobiliario',
    tipo_credito: 'Crédito simple consolidador',
    monto_solicitado_mxn: 26_000_000,
    necesidad: {
      destino: 'Consolidar 4 créditos vigentes en 1 solo',
      desglose: 'Liquidar $31M a valor presente con quitas y prepagos negociados',
      urgencia: 'Liberar flujo en 8 semanas',
    },
    situacion_financiera: {
      facturacion_mensual_mxn: 15_800_000,
      facturacion_anual_mxn: 189_600_000,
      gastos_fijos_mxn: 11_200_000,
      pasivos_vigentes:
        '2 arrendamientos ($18M saldo, $485K/mes) + crédito puente ($9M saldo, $280K/mes) + revolvente ($4M dispuesta, $95K/mes). Pago actual total $860K/mes — DSCR 1.05x.',
      pago_estimado_mxn: 620_000, // pago consolidado estimado, ahorro $240K/mes vs actual
      plazo_meses: 60,
    },
    historial_crediticio: {
      antiguedad_anos: 18,
      retrasos: 'Sin retrasos, pero DSCR 1.05x (en el límite que las contrapartes aún toleran)',
      score_buro_pm: 680,
      score_buro_pf: 720,
      opinion_sat_32d: 'positiva',
    },
    garantias: {
      items: [
        { tipo: 'Flota de maquinaria liberada tras liquidación de arrendamientos', valor_mxn: 22_000_000 },
        { tipo: 'Nave industrial y patio propio', valor_mxn: 14_000_000 },
        { tipo: 'Aval patrimonial del director general', valor_mxn: 5_800_000 },
      ],
      suma_mxn: 41_800_000,
      cobertura_x: 1.61,
    },
    complicaciones: [
      'Crédito puente tiene cláusula de prepago con penalización 2.5% ($225K). El ahorro neto debe superar esta penalización + comisiones de apertura del nuevo crédito.',
      'Los 2 arrendamientos requieren liquidación anticipada y liberación de gravamen (4-6 semanas). El nuevo acreedor exige ver cancelación de gravamen antes del desembolso.',
      'DSCR 1.05x apenas cubre servicio de deuda actual. La única forma de aprobar el nuevo crédito es demostrar que la consolidación reduce el pago mensual a un nivel que eleve el DSCR a 1.35x o más (Engen Capital, Kapital México, Banorte Refinanciamiento PYME).',
    ],
    documentacion_disponible: [
      'Contratos de los 4 créditos vigentes',
      'Estados de cuenta de cada acreedor',
      'Cartas de saldo con penalización por prepago',
      'Estados financieros auditados 3 ejercicios',
      'Proyección de flujo con y sin consolidación',
      'Avalúos recientes de maquinaria y nave',
      'Plan de consolidación con ahorro estimado',
      'Opinión SAT 32-D',
      'Buró PM y PF',
      'Contrato vigente de obras en ejecución',
    ],
    cajas_objetivo: [
      'to_ratios_financieros',
      'gr_dscr_min',
      'gr_deuda_ebitda_max',
      'ru_monto_max',
      'pc_conversion_producto',
    ],
  },

  {
    id: 'CASO-012',
    titulo: 'Transportista con diferencias en IVA y opinión SAT negativa busca crecer flota',
    resumen_ejecutivo:
      'Transportista 10 años, 8 unidades en rutas Jalisco-Sonora. Diferencias IVA por $3M acumuladas en 3 ejercicios (errores en acreditamiento de combustible) → opinión SAT 32-D NEGATIVA. Quiere 2 tractocamiones Kenworth T680 nuevos para contrato adicional. La 32-D negativa bloquea automáticamente banca y la mayoría de SOFOMes.',
    sector: 'Transporte y Logística',
    tipo_credito: 'Factoraje + arrendamiento financiero escalonado (post-regularización SAT)',
    monto_solicitado_mxn: 4_200_000,
    necesidad: {
      destino: '2 tractocamiones nuevos',
      desglose: '2 Kenworth T680 2025 ($2.05M c/u) + placas federales y GPS ($100K)',
      urgencia: 'Contrato inicia en 8 semanas',
    },
    situacion_financiera: {
      facturacion_mensual_mxn: 3_600_000,
      facturacion_anual_mxn: 43_200_000,
      gastos_fijos_mxn: 2_500_000,
      pasivos_vigentes:
        'Crédito fiscal SAT $3M (no firme) + 1 arrendamiento $1.8M (saldo $620K, al corriente)',
      pago_estimado_mxn: 115_000,
      plazo_meses: 48,
    },
    historial_crediticio: {
      antiguedad_anos: 10,
      retrasos: 'Sin retrasos en créditos comerciales. Diferencias IVA $3M ante SAT (no firmes).',
      score_buro_pm: 655,
      score_buro_pf: 700,
      opinion_sat_32d: 'negativa',
    },
    garantias: {
      items: [
        { tipo: '5 unidades libres de gravamen (de flota actual de 8)', valor_mxn: 7_200_000 },
        { tipo: 'Inmueble habitacional del propietario', valor_mxn: 3_400_000 },
        { tipo: 'Cuentas por cobrar cedibles (4 clientes corporativos)', valor_mxn: 2_100_000 },
      ],
      suma_mxn: 12_700_000,
      cobertura_x: 3.02,
    },
    complicaciones: [
      'Opinión SAT 32-D negativa = causal de rechazo automático en banca y la mayoría de SOFOMes. Primera acción: tramitar convenio de pago en parcialidades (hasta 36 mensualidades) ante SAT para cambiar la opinión a positiva en 1-2 semanas.',
      'Mientras se regulariza el SAT, obtener liquidez inmediata vía factoraje sin 32-D en Fondimex o Xepelin, cediendo los $2.1M de CxC con clientes corporativos para no perder el contrato.',
      'Una vez con opinión positiva (3-4 semanas), formalizar arrendamiento financiero en One Financiera con las 5 unidades libres como garantía complementaria, evitando hipoteca sobre el inmueble familiar.',
    ],
    documentacion_disponible: [
      'Acta constitutiva',
      'Acuse de solicitud de convenio SAT',
      'Estados financieros 3 ejercicios',
      'Declaraciones de IVA y ISR con notas explicativas',
      'Facturación CFDI 12 meses',
      'Buró PM y PF',
      'Permisos SCT vigentes',
      'Contratos de clientes corporativos (cedibles)',
      'Escrituras del inmueble habitacional',
      'Contrato del nuevo cliente',
    ],
    cajas_objetivo: ['to_situacion_fiscal', 'se_sat_32d_negativa', 'nm_productos_ofrecidos', 'pc_conversion_producto'],
  },

  {
    id: 'CASO-024',
    titulo: 'Fábrica de autopartes Tier 2 amplía línea de producción con maquinaria CNC',
    resumen_ejecutivo:
      'Fabricante de autopartes metálicas, corredor Jalisco-Bajío, 15 años, Tier 2 de dos armadoras internacionales. La demanda por nearshoring requiere segunda línea de producción con 4 centros CNC y horno térmico ($25M). Flujo sólido y nave propia, pero pérdida fiscal 2024 por deducción acelerada de ampliación de nave.',
    sector: 'Manufactura',
    tipo_credito: 'Crédito refaccionario',
    monto_solicitado_mxn: 25_000_000,
    necesidad: {
      destino: 'Maquinaria industrial para segunda línea de producción',
      desglose: '4 centros de maquinado CNC ($4.5M c/u) + horno de tratamiento térmico ($7M)',
      urgencia: 'Auditoría de armadora en 4 meses',
    },
    situacion_financiera: {
      facturacion_mensual_mxn: 18_400_000,
      facturacion_anual_mxn: 220_800_000,
      gastos_fijos_mxn: 14_200_000,
      pasivos_vigentes: 'Crédito simple $8M (saldo $3.4M, al corriente)',
      pago_estimado_mxn: 580_000,
      plazo_meses: 60, // rango 48-60
    },
    historial_crediticio: {
      antiguedad_anos: 15,
      retrasos:
        'Sin retrasos. Crédito vigente al corriente. Pérdida fiscal 2024 por deducción acelerada de nave ($12M invertidos) — EBITDA operativo real positivo $4.2M/mes.',
      score_buro_pm: 700,
      score_buro_pf: 720,
      opinion_sat_32d: 'positiva',
    },
    garantias: {
      items: [
        { tipo: 'Maquinaria CNC (4 uds) y horno térmico (prendaria)', valor_mxn: 25_000_000 },
        { tipo: 'Nave industrial 2,800 m² (avalúo)', valor_mxn: 38_000_000 },
        { tipo: 'Aval conjunto de 2 socios fundadores', valor_mxn: 0 },
      ],
      suma_mxn: 63_000_000,
      cobertura_x: 2.52,
    },
    complicaciones: [
      'Pérdida fiscal 2024 por deducción acelerada — necesario explicar el ajuste y demostrar EBITDA operativo positivo ($4.2M/mes) para que la institución no descalifique por la pérdida contable.',
      'Concentración de clientes: 2 armadoras representan 72% de la facturación. Si una reduce órdenes, impacta flujo. Cláusulas de mitigación (caída de ventas) deben preverse.',
      'Maquinaria CNC importada (Alemania/Japón): riesgo cambiario y tiempos de importación 10-14 semanas. Considerar cobertura cambiaria forward y desembolso escalonado contra hitos de importación.',
    ],
    documentacion_disponible: [
      'Acta constitutiva',
      'Estados financieros auditados 3 ejercicios',
      'Declaraciones anuales',
      'Estados de cuenta 12 meses',
      'Buró PM y PF',
      'Escrituras nave industrial',
      'Avalúo vigente',
      'Órdenes de compra de armadoras',
      'Opinión SAT 32-D',
      'Cotización de maquinaria',
      'Plan de negocios',
    ],
    cajas_objetivo: ['nm_sectores_aceptados', 'nm_productos_ofrecidos', 'gr_capital_contable_min', 'op_eeff_auditados'],
  },

  {
    id: 'CASO-031',
    titulo: 'Distribuidora de alimentos requiere línea revolvente por estacionalidad',
    resumen_ejecutivo:
      'Distribuidora de alimentos y bebidas en ZMG, 7 años, 4 sucursales, $69.6M facturación anual. Necesita línea revolvente $6M para picos estacionales (Semana Santa, septiembre, Navidad). Buen flujo, pero retraso leve 30 días en Buró hace 2 años (regularizado). CxC $3.8M con cadenas regionales.',
    sector: 'Comercio y Distribución',
    tipo_credito: 'Línea de crédito revolvente',
    monto_solicitado_mxn: 6_000_000,
    necesidad: {
      destino: 'Capital de trabajo estacional',
      desglose: 'Compra anticipada de inventario y logística para picos de demanda',
      urgencia: 'Temporada alta inicia en 8 semanas',
    },
    situacion_financiera: {
      facturacion_mensual_mxn: 5_800_000, // promedio; picos $9.2M, valles ene-feb $3.1M
      facturacion_anual_mxn: 69_600_000,
      gastos_fijos_mxn: 4_300_000,
      pasivos_vigentes: 'Crédito automotriz $1.4M (saldo $620K)',
      pago_estimado_mxn: 75_000, // intereses sobre saldo dispuesto $60-90K/mes (uso medio 75K)
      plazo_meses: 12, // renovación anual
    },
    historial_crediticio: {
      antiguedad_anos: 7,
      retrasos: '1 retraso 30 días en 2024 (proveedor logístico), regularizado',
      score_buro_pm: 640,
      score_buro_pf: 690,
      opinion_sat_32d: 'positiva',
    },
    garantias: {
      items: [
        { tipo: 'Inventario rotativo (bebidas y alimentos)', valor_mxn: 4_200_000 },
        { tipo: 'Local comercial propio', valor_mxn: 8_500_000 },
        { tipo: 'Cuentas por cobrar cedidas a cadenas regionales', valor_mxn: 3_800_000 },
        { tipo: 'Aval patrimonial del socio fundador', valor_mxn: 0 },
      ],
      suma_mxn: 16_500_000,
      cobertura_x: 2.75,
    },
    complicaciones: [
      'Retraso de 30 días en Buró hace 2 años (proveedor logístico, ya regularizado). Score PM 640 — algunas instituciones podrían exigir 12-18 meses adicionales de comportamiento limpio antes de aprobar línea revolvente.',
      'Flujo estacional marcado: enero-febrero facturan $3.1M (vs picos $9.2M). La línea revolvente debe considerar esta variabilidad — disponibilidad y aforo deben dimensionarse para soportar el pico, no el promedio.',
      'CxC con cadenas regionales a 45-60 días generan desfase de flujo en picos. Cesión de CxC como garantía aceptable solo si la institución revisa límites por pagador.',
    ],
    documentacion_disponible: [
      'Acta constitutiva',
      'Estados financieros 3 ejercicios',
      'Declaraciones anuales y mensuales',
      'Estados de cuenta 12 meses',
      'Buró PM y PF',
      'Contratos con cadenas de autoservicio',
      'Póliza de seguro de inventario',
      'Escrituras del local comercial',
    ],
    cajas_objetivo: ['nm_productos_ofrecidos', 'nm_sectores_aceptados', 'to_historial_credito', 'ru_ticket_ideal'],
  },

  {
    id: 'CASO-064',
    titulo: 'Planta de backend testing y packaging de semiconductores instala línea OSAT en Tijuana',
    resumen_ejecutivo:
      'OSAT con 7 años en Tijuana (matriz USA con 18 años, BB+) que escala de testing MCU automotriz a backend packaging completo (wire bond, flip-chip, encapsulado, burn-in) para 3 fabless USA. 520 empleados, 92% facturación en USD. Requiere $195M (sindicado bimoneda + Plan México 91%) para sala limpia clase 10,000 + líneas ASM/Besi/Advantest/Yamada/Cognex.',
    sector: 'Manufactura',
    tipo_credito: 'Crédito sindicado bimoneda USD (Bancomext + banca corporativa) + Plan México 91%',
    monto_solicitado_mxn: 195_000_000,
    necesidad: {
      destino: 'Sala limpia clase 10,000 + backend OSAT (wire bond, flip-chip, burn-in)',
      desglose:
        'Sala limpia 1,800 m² ($42M) + ASM AMICRA wire bond ($38M) + Besi flip-chip ($34M) + Advantest burn-in ($32M) + Yamada encapsulado ($18M) + X-ray, AOI Cognex, EFEM ($16M) + obra civil, utilidades, validación ($15M)',
      urgencia: 'Calificación con 3 fabless arranca en 6 meses',
    },
    situacion_financiera: {
      facturacion_mensual_mxn: 118_000_000, // 92% USD
      facturacion_anual_mxn: 1_416_000_000, // +31% YoY
      gastos_fijos_mxn: 86_000_000,
      pasivos_vigentes:
        'Línea Bancomext USD 12M (saldo USD 4.8M) + arrendamientos $45M (saldo $18M)',
      pago_estimado_mxn: 3_150_000,
      plazo_meses: 84, // con 12 meses de gracia en capital
    },
    historial_crediticio: {
      antiguedad_anos: 7, // matriz USA 18 años
      retrasos:
        'Sin retrasos. Certificaciones IATF 16949, ISO 9001, IMMEX 4.0, JEDEC compliance vigentes.',
      score_buro_pm: 742,
      score_buro_pf: 755,
      opinion_sat_32d: 'positiva',
    },
    garantias: {
      items: [
        { tipo: 'Planta 9,200 m² parque aeroespacial Tijuana (hipoteca)', valor_mxn: 240_000_000 },
        { tipo: 'Equipo nuevo ASM, Besi, Advantest, Yamada, Cognex (prendaria)', valor_mxn: 195_000_000 },
        { tipo: 'Testing MCU + sala limpia clase 100,000 existentes (en libros)', valor_mxn: 165_000_000 },
        {
          tipo: 'MSA take-or-pay 5 años con 3 fabless USA + aval corporativo matriz USA BB+',
          valor_mxn: 0,
        },
      ],
      suma_mxn: 600_000_000,
      cobertura_x: 3.08,
    },
    complicaciones: [
      'Monto y tecnología exceden el apetito individual de la banca comercial mexicana. Estructurar sindicato liderado por Bancomext Crédito Directo (USD 3M+) con BBVA Empresas, Santander corporativo, HSBC comercio exterior. Tramo USD referenciado a SOFR + 3-4 pp (~8-9% USD) para casar con 92% de facturación dolarizada. Aplicar Plan México 91% deducción activos fijos antes del cierre fiscal 2026.',
      'ASM AMICRA, Besi y Advantest tienen lead times 32-40 semanas (53% del monto). Estructurar desembolso en 5 tramos (anticipo origen, FOB, pedimento IMMEX 4.0, instalación, qualification). Cobertura cambiaria forward 12 meses para tramo MXN de obra civil (rango 15.4-17.4 MXN/USD proyectado 2026).',
      'Riesgo de cola: calificación de los 3 fabless (process qualification, reliability, burn-in) toma 6-9 meses antes de volumen comercial. Sin calificación no hay facturación plena. Exigir 12 meses gracia en capital + sweep de caja al 40% del excedente operativo. Reforzar MSA take-or-pay con cláusulas de pago mínimo durante calificación.',
    ],
    documentacion_disponible: [
      'Acta constitutiva',
      'Estados financieros auditados 3 ejercicios',
      'Declaraciones anuales',
      'Estados de cuenta 24 meses',
      'Buró PM y PF',
      'Escrituras de planta con avalúo industrial',
      'Certificaciones IATF 16949, ISO 9001, IMMEX 4.0, JEDEC compliance',
      'MSA take-or-pay firmado con 3 fabless USA',
      'Cotización ASM AMICRA, Besi, Advantest, Yamada, Cognex con pedimentos estimados',
      'Plan de validación y calificación',
      'Carta de compromiso Bancomext Crédito Directo',
      'EEFF consolidados de matriz USA con aval corporativo',
      'Opinión SAT 32-D',
      'Memorandum fiscal Plan México deducción 91%',
    ],
    cajas_objetivo: [
      'ru_monto_max',
      'ru_moneda',
      'nm_productos_ofrecidos',
      'nm_cobertura_geografica',
      'op_eeff_auditados',
    ],
  },

  {
    id: 'CASO-105',
    titulo: 'Productor de granos PFAE — refaccionario bajo garantía FIRA-Agronegocios',
    resumen_ejecutivo:
      'PFAE granero, 11 años, 3 tractores John Deere 8R 340 ($21M, 60 meses semestrales) bajo crédito refaccionario con garantía parcial FIRA-Agronegocios (hasta 80% del principal). Programa "Modernización del Sector Rural" ejercicio 2026. Tasa preferencial TIIE+3 a TIIE+5 (vs TIIE+7-9 comercial directo).',
    sector: 'Agro y Agroindustria',
    tipo_credito: 'Crédito refaccionario con garantía parcial FIRA-Agronegocios',
    monto_solicitado_mxn: 21_000_000,
    necesidad: {
      destino: '3 tractores John Deere 8R 340 de alta potencia',
      desglose:
        'Crédito refaccionario con garantía parcial FIRA (hasta 80% principal). Aportación propia mínima 20% ($5.25M) con recursos propios o equipo existente.',
      urgencia: 'Alineado a calendario de ciclo agrícola; tiempo de respuesta 8-12 semanas (vs 3-5 comercial estándar)',
    },
    situacion_financiera: {
      facturacion_mensual_mxn: 12_700_000, // promedio estacional
      facturacion_anual_mxn: 152_000_000,
      gastos_fijos_mxn: 9_200_000,
      pasivos_vigentes: 'Arrendamiento agrícola $6M (saldo $2.1M, al corriente)',
      pago_estimado_mxn: 400_000, // mensual equivalente; pago real semestral $2.4M
      plazo_meses: 60, // 10 semestres con 6 meses gracia en capital
    },
    historial_crediticio: {
      antiguedad_anos: 11,
      retrasos:
        'Sin retrasos registrados. Padrón productores SIAP/SADER vigente. Elegibilidad FIRA confirmada por dictamen preliminar.',
      score_buro_pm: null, // PFAE
      score_buro_pf: 728,
      opinion_sat_32d: 'positiva',
    },
    garantias: {
      items: [
        { tipo: 'Garantía parcial FIRA-Agronegocios (80% del principal)', valor_mxn: 16_800_000 },
        { tipo: '3 tractores John Deere 8R 340 nuevos (prendaria)', valor_mxn: 21_000_000 },
        { tipo: 'Equipo existente afectado como aportación propia', valor_mxn: 5_250_000 },
        {
          tipo: 'Contratos forward 2026-2027 firmados (compraventa de cosecha) — respaldo de flujo',
          valor_mxn: 0,
        },
      ],
      suma_mxn: 42_050_000,
      cobertura_x: 2.0,
    },
    complicaciones: [
      'Tiempo de respuesta extendido 8-12 semanas (vs 3-5 comercial estándar) por proceso paralelo de dictamen del Fideicomiso FIRA. Si el productor requiere los tractores antes de preparación de suelos primavera-verano 2026, canalizar al CASO-104 (refaccionario comercial directo) o CASO-106 (arrendamiento puro 2-3 semanas).',
      'Alineación obligatoria con programa "Modernización del Sector Rural" (ejercicio fiscal). Requiere proyecto técnico con beneficios cuantificados (-18% combustible, +1,500 ha por ciclo) y dictamen ambiental. La banca acreditada (Banorte, Banregio, Santander, BBVA, HSBC) canaliza al Fideicomiso.',
      'El diferencial de tasa (ahorro estimado $0.4M/semestre = $4M en vida del crédito) compensa el costo operativo del trámite más largo y reporte trimestral a FIRA. Conviene si el productor tiene flexibilidad de 2-3 meses en calendario de adquisición.',
      'Pago periodicidad SEMESTRAL ($2.4M/semestre) — el campo `pago_estimado_mxn` almacena el equivalente mensual ($400K) por consistencia con los demás casos.',
    ],
    documentacion_disponible: [
      'INE y CURP',
      'Constancia de situación fiscal PFAE',
      'Estados financieros 3 ejercicios',
      'Declaraciones anuales',
      'Estados de cuenta 12 meses',
      'Buró PF',
      'Padrón SIAP/SADER vigente',
      'Proyecto técnico ejecutivo con análisis costo-beneficio',
      'Dictamen preliminar de elegibilidad FIRA',
      'Constancia del programa Modernización del Sector Rural',
      'Estudio de impacto ambiental',
      'EEFF proforma con y sin modernización',
      'Contratos forward de compraventa 2026-2027',
      'Solicitud formal ante mesa FIRA del banco acreditado',
    ],
    cajas_objetivo: [
      'nm_sectores_aceptados',
      'nm_productos_ofrecidos',
      'gr_tipos_garantia',
      'op_tiempo_fondeo',
      'pc_tasas_por_producto',
    ],
  },
];
