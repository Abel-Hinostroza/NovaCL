import { encodeCode128B } from "@/lib/barcode/code128";

/**
 * Dibuja `value` como código de barras Code 128 en SVG (nítido para escaneo).
 * Sin dependencias externas → compatible con el CSP de la app.
 *
 * - `moduleWidth`: ancho en px del módulo más fino. La norma ISO/IEC 15417 no
 *   fija un mínimo; el piso práctico lo da la impresora: en una térmica de
 *   203 dpi (punto = 0.125 mm) conviene que el módulo sea ≥ 2 puntos, es
 *   decir 0.25 mm ≈ 0.95 px. En pantalla el contraste se degrada antes, por
 *   eso el valor por defecto es 2.
 * - `maxWidth`: si se indica, reduce `moduleWidth` lo necesario para que el
 *   código (con sus zonas mudas) quepa en ese ancho. Sirve para códigos
 *   largos (legacy) en etiquetas estrechas; úsese con criterio porque por
 *   debajo de ~0.95 px/módulo aumentan las fallas de lectura.
 * - `quietZone`: módulos en blanco a cada lado. La norma exige un mínimo de
 *   10 módulos: reducirlo por debajo de eso hace que el lector no reconozca
 *   dónde empieza/termina el código. No bajar de 10.
 * - `showText`: imprime el valor legible debajo (buena práctica CLSI AUTO12).
 */
export function Barcode128({
  value,
  height = 56,
  moduleWidth = 2,
  maxWidth,
  quietZone = 10,
  showText = true,
  fontSize = 13,
  className,
}: {
  value: string;
  height?: number;
  moduleWidth?: number;
  maxWidth?: number;
  quietZone?: number;
  showText?: boolean;
  fontSize?: number;
  className?: string;
}) {
  const { stripes, modules } = encodeCode128B(value);
  const totalModules = modules + quietZone * 2;
  const effectiveModuleWidth = maxWidth
    ? Math.min(moduleWidth, maxWidth / totalModules)
    : moduleWidth;
  const barsWidth = totalModules * effectiveModuleWidth;
  const textH = showText ? fontSize + 4 : 0;
  // El texto (monoespaciado) puede ser más ancho que las barras cuando el
  // módulo es muy angosto; se ensancha el lienzo si hace falta para que no
  // se recorte, en vez de asumir overflow visible en el <svg>.
  const estTextWidth = showText ? value.length * fontSize * 0.62 : 0;
  const width = Math.max(barsWidth, estTextWidth);
  const barsOffset = (width - barsWidth) / 2;

  const rects: React.ReactElement[] = [];
  let x = quietZone;
  let k = 0;
  for (const s of stripes) {
    if (s.bar) {
      rects.push(
        <rect
          key={k++}
          x={barsOffset + x * effectiveModuleWidth}
          y={0}
          width={s.w * effectiveModuleWidth}
          height={height}
        />
      );
    }
    x += s.w;
  }

  return (
    <svg
      className={className}
      width={width}
      height={height + textH}
      viewBox={`0 0 ${width} ${height + textH}`}
      role="img"
      aria-label={`Código de barras ${value}`}
      shapeRendering="crispEdges"
    >
      <rect x={0} y={0} width={width} height={height + textH} fill="#ffffff" />
      <g fill="#000000">{rects}</g>
      {showText && (
        <text
          x={width / 2}
          y={height + textH - 3}
          textAnchor="middle"
          fontFamily="ui-monospace, monospace"
          fontSize={fontSize}
          letterSpacing={1}
          fill="#000000"
        >
          {value}
        </text>
      )}
    </svg>
  );
}
