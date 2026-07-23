// ─────────────────────────────────────────────────────────────
// Code 128 (subconjunto B) — encoder puro, sin dependencias
// ─────────────────────────────────────────────────────────────
// Convierte una cadena ASCII (32–126) en las franjas (barras/espacios) de un
// código de barras Code 128B. Se eligió Code 128 por ser el estándar de facto
// para etiquetas de tubos en laboratorio (alfanumérico, denso, legible por
// cualquier lector/analizador configurado para esa simbología; ver CLSI AUTO12).
//
// Es lógica pura (sin React ni server-only): la usa el componente SVG para
// dibujar la barra. La fuente de verdad de la tabla de patrones es la norma
// ISO/IEC 15417.

/**
 * Tabla de patrones Code 128 (índices 0–106).
 * Cada patrón son 6 anchos (barra,espacio,barra,espacio,barra,espacio) salvo el
 * de PARADA (índice 106), que trae 7 (barra final extra). Suman 11 módulos
 * (13 el de parada).
 */
const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];

const START_B = 104;
const STOP = 106;

export type Stripe = { w: number; bar: boolean };

/** Deja solo caracteres imprimibles ASCII (32–126); el resto → '?'. */
export function sanitizeCode128(input: string): string {
  return [...input]
    .map((c) => {
      const code = c.charCodeAt(0);
      return code >= 32 && code <= 126 ? c : "?";
    })
    .join("");
}

/**
 * Codifica `input` en Code 128B.
 * Devuelve las franjas alternadas (barra/espacio) y el total de módulos, para
 * que el renderer sólo tenga que multiplicar por el ancho de módulo deseado.
 */
export function encodeCode128B(input: string): { stripes: Stripe[]; modules: number } {
  const text = sanitizeCode128(input);
  const values: number[] = [START_B];
  for (const c of text) values.push(c.charCodeAt(0) - 32);

  // Dígito de control: (104 + Σ posición·valor) mod 103, posición desde 1.
  let sum = START_B;
  [...text].forEach((c, i) => {
    sum += (i + 1) * (c.charCodeAt(0) - 32);
  });
  values.push(sum % 103);
  values.push(STOP);

  const stripes: Stripe[] = [];
  let modules = 0;
  for (const v of values) {
    const pattern = CODE128_PATTERNS[v];
    for (let i = 0; i < pattern.length; i++) {
      const w = pattern.charCodeAt(i) - 48; // '0'..'4' → 0..4
      stripes.push({ w, bar: i % 2 === 0 });
      modules += w;
    }
  }
  return { stripes, modules };
}
