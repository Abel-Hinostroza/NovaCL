/**
 * Helpers de normalización de texto para autocompletar sugerencias en formularios
 * (slug, códigos de sede/estudio/categoría). Mantener simétricos con el `seed`
 * para que los nombres coincidan al pegarlos en la base.
 */

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Código corto a partir de un nombre: 1 palabra → 6 mayúsculas; 2+ palabras
 * → 3-3 separadas por guion.
 * Ej: "Sede Central" → "SED-CEN", "Centro" → "CENTRO", "Santa Lucia La Merced" → "SAN-LUC".
 */
export function codeFromName(value: string): string {
  const tokens = slugify(value)
    .split("-")
    .filter(Boolean);
  if (tokens.length === 0) return "";
  const left = tokens[0].slice(0, 3).toUpperCase();
  if (tokens.length === 1) return left.slice(0, 6);
  const right = tokens[1].slice(0, 3).toUpperCase();
  return `${left}-${right}`;
}