// ─────────────────────────────────────────────────────────────
// Rangos de referencia e indicador (flag) — lógica pura compartida
// ─────────────────────────────────────────────────────────────
// Espeja EXACTAMENTE el criterio del RPC `upsert_result` / `app.eval_flag`
// (ver supabase/migrations/0023_hardening_flows.sql y 0024_fix_result_status_cast.sql)
// para que el rango y el indicador que ve el técnico MIENTRAS escribe coincidan
// con lo que la BD calculará al guardar. Es una ayuda visual; la fuente de
// verdad sigue siendo el servidor.
//
// Se mantiene libre de imports server-only para poder usarse tanto en el
// Server Component que precarga el rango como en el input en vivo del cliente.

import type { ResultFlag } from "@/lib/database.types";

export type RefRange = {
  sexo: string; // 'M' | 'F' | 'otro' | 'desconocido'
  edadMinDias: number | null;
  edadMaxDias: number | null;
  valorMin: number | null;
  valorMax: number | null;
  criticoMin: number | null;
  criticoMax: number | null;
  textoNormal: string | null;
};

/** Edad en días a partir de la fecha de nacimiento (espeja app.patient_age_days). */
export function patientAgeDays(fechaNac?: string | null): number | null {
  if (!fechaNac) return null;
  const birth = new Date(fechaNac);
  if (Number.isNaN(birth.getTime())) return null;
  const ms = Date.now() - birth.getTime();
  return Math.floor(ms / 86_400_000);
}

/**
 * Elige el rango más específico para el paciente, replicando el ORDER BY del SQL:
 *   1) coincidencia exacta de sexo antes que 'desconocido'
 *   2) rangos con edad acotada antes que los genéricos
 * Filtra por sexo compatible y edad dentro de los límites.
 */
export function pickRange(
  ranges: RefRange[],
  sexo: string | null,
  ageDays: number | null
): RefRange | null {
  const candidatos = ranges.filter((r) => {
    const sexoOk = r.sexo === sexo || r.sexo === "desconocido";
    const minOk = r.edadMinDias == null || ageDays == null || ageDays >= r.edadMinDias;
    const maxOk = r.edadMaxDias == null || ageDays == null || ageDays <= r.edadMaxDias;
    return sexoOk && minOk && maxOk;
  });
  if (candidatos.length === 0) return null;
  candidatos.sort((a, b) => {
    const sexoScore = (r: RefRange) => (r.sexo === sexo ? 1 : 0);
    const edadScore = (r: RefRange) => (r.edadMinDias != null ? 1 : 0);
    return sexoScore(b) - sexoScore(a) || edadScore(b) - edadScore(a);
  });
  return candidatos[0];
}

/** Texto del rango tal como lo arma el RPC (num → "min - max", si no texto_normal). */
export function formatRangeText(range: RefRange | null): string | null {
  if (!range) return null;
  if (range.valorMin != null || range.valorMax != null) {
    return `${range.valorMin ?? ""} - ${range.valorMax ?? ""}`;
  }
  return range.textoNormal;
}

/** Indicador para un valor numérico (espeja app.eval_flag de 0023). */
export function evalFlagNum(valor: number | null, range: RefRange | null): ResultFlag | null {
  if (valor == null || Number.isNaN(valor) || !range) return null;
  const { valorMin: min, valorMax: max, criticoMin: cmin, criticoMax: cmax } = range;
  // Sin ningún límite: el valor no se evaluó; no se reporta "normal".
  if (min == null && max == null && cmin == null && cmax == null) return null;
  if (cmin != null && valor < cmin) return "critico_bajo";
  if (cmax != null && valor > cmax) return "critico_alto";
  if (min != null && valor < min) return "bajo";
  if (max != null && valor > max) return "alto";
  return "normal";
}

/** Indicador para un valor cualitativo (espeja la rama A4 del RPC 0024). */
export function evalFlagText(valor: string, range: RefRange | null): ResultFlag | null {
  const norm = range?.textoNormal;
  if (!valor.trim() || !norm) return null;
  return valor.trim().toLowerCase() === norm.trim().toLowerCase() ? "normal" : "anormal";
}
