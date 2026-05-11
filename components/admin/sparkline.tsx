// Sparkline minimalista — SVG path con curve smoothed (catmull-rom como cubic
// bezier approximation). Fill opcional con opacidad baja para depth, line
// monocromo crisp.
//
// Decisiones de design:
// - currentColor por default → hereda el color del parent text, así el sparkline
//   se integra tipográficamente sin forzar tono específico.
// - preserveAspectRatio="none" para que el path se estire al width/height del
//   contenedor sin distorsión.
// - Padding interno de 2px arriba/abajo para que los extremos no se peguen al
//   borde top/bottom del SVG.

interface Props {
  /** Serie de datapoints. Mínimo 2 valores. */
  data: readonly number[];
  /** Ancho en px del SVG (no del path — el path siempre se escala). Default 80. */
  width?: number;
  /** Alto en px. Default 24. */
  height?: number;
  /** Color del stroke + fill. Default currentColor. */
  color?: string;
  /** Mostrar fill semitransparente debajo del path. Default true. */
  showFill?: boolean;
  /** Opacidad del fill (si showFill). Default 0.08. */
  fillOpacity?: number;
  /** Grosor del stroke en px. Default 1.5. */
  strokeWidth?: number;
  className?: string;
}

export function Sparkline({
  data,
  width = 80,
  height = 24,
  color = 'currentColor',
  showFill = true,
  fillOpacity = 0.08,
  strokeWidth = 1.5,
  className,
}: Props) {
  if (data.length < 2) {
    return null;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  // Padding vertical de 2px en cada extremo para que el sparkline respire
  // dentro del viewBox.
  const padY = 2;
  const drawableHeight = height - padY * 2;

  const points = data.map((d, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - padY - ((d - min) / range) * drawableHeight,
  }));

  // Smooth curve via cubic bezier con control points en el midpoint horizontal
  // entre puntos adyacentes — efecto similar a monotone interpolation pero sin
  // dependencia de Recharts/D3. Performante (un path string per render).
  const linePath = points.reduce((acc, p, i, arr) => {
    if (i === 0) return `M ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
    const prev = arr[i - 1];
    const cpX = (prev.x + p.x) / 2;
    return `${acc} C ${cpX.toFixed(2)} ${prev.y.toFixed(2)}, ${cpX.toFixed(2)} ${p.y.toFixed(2)}, ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  }, '');

  const fillPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg
      aria-hidden
      className={className}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      preserveAspectRatio="none"
    >
      {showFill && (
        <path d={fillPath} fill={color} fillOpacity={fillOpacity} />
      )}
      <path
        d={linePath}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
