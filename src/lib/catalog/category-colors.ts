/**
 * Paleta de colores para categorías del catálogo.
 *
 * Se usa la paleta de Okabe-Ito: 8 tonos diseñados para ser distinguibles
 * incluso con daltonismo (deuteranopía/protanopía), el estándar de facto para
 * codificación categórica accesible. El color es SIEMPRE una señal secundaria:
 * en la UI acompaña al código/nombre, nunca los reemplaza.
 */
export type CategoryColor = { key: string; label: string; hex: string };

export const CATEGORY_PALETTE: CategoryColor[] = [
  { key: "blue", label: "Azul", hex: "#0072B2" },
  { key: "green", label: "Verde", hex: "#009E73" },
  { key: "orange", label: "Naranja", hex: "#E69F00" },
  { key: "sky", label: "Celeste", hex: "#56B4E9" },
  { key: "vermillion", label: "Rojo", hex: "#D55E00" },
  { key: "purple", label: "Púrpura", hex: "#CC79A7" },
  { key: "gold", label: "Dorado", hex: "#F0E442" },
  { key: "gray", label: "Gris", hex: "#999999" },
];

const BY_HEX = new Map(CATEGORY_PALETTE.map((c) => [c.hex.toUpperCase(), c]));

/** ¿El valor almacenado es un color válido de la paleta? */
export function isValidCategoryColor(value: string | null | undefined): boolean {
  return !!value && BY_HEX.has(value.toUpperCase());
}

/** Hash estable de un string a un índice de la paleta. */
function hashIndex(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % CATEGORY_PALETTE.length;
}

/**
 * Color efectivo de una categoría: el elegido si es válido; si no, uno derivado
 * de forma determinista del código (así las plantillas globales, que no se
 * pueden editar, muestran un color estable sin necesidad de persistirlo).
 */
export function resolveCategoryColor(codigo: string, stored?: string | null): string {
  if (isValidCategoryColor(stored)) return stored as string;
  return CATEGORY_PALETTE[hashIndex(codigo || "?")].hex;
}
