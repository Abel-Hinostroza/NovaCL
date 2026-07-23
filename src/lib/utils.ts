import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Une clases de Tailwind resolviendo conflictos. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formatea un monto con moneda. */
export function formatMoney(value: number, currency = "PEN", locale = "es-PE") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(value ?? 0);
}

/**
 * Formatea una fecha legible en hora de Perú.
 *
 * La zona se fija a America/Lima (UTC−5) a propósito: los Server Components se
 * renderizan en UTC en Vercel, así que sin esto la hora saldría 5 horas
 * adelantada y, cerca de medianoche, hasta con el día equivocado.
 */
export function formatDate(
  value?: string | null,
  withTime = false,
  timeZone = "America/Lima"
) {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleString("es-PE", {
    timeZone,
    year: "numeric",
    month: "short",
    day: "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

/**
 * Fecha/hora compacta para la etiqueta del tubo: "23/07/26 10:30".
 * Misma razón de zona fija que `formatDate` (America/Lima).
 */
export function formatCompactDateTime(value?: string | null, timeZone = "America/Lima") {
  if (!value) return "—";
  return new Date(value)
    .toLocaleString("es-PE", {
      timeZone,
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .replace(",", "");
}

/** Calcula la edad a partir de una fecha de nacimiento. */
export function calcAge(fecha?: string | null): string {
  if (!fecha) return "—";
  const birth = new Date(fecha);
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) years--;
  if (years < 2) {
    const months =
      (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
    return `${months} meses`;
  }
  return `${years} años`;
}

/** Iniciales para avatares. */
export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/**
 * Genera el código de barras de una muestra (10 caracteres).
 *
 * El largo está acotado a propósito: la etiqueta del tubo es de 50 mm y un
 * Code 128B de 10 caracteres ocupa 165 módulos (~44 mm a 0.26 mm/módulo),
 * que es lo máximo que cabe con zona muda reglamentaria. Un código más largo
 * obligaría a reducir el módulo por debajo de lo legible.
 *   - 6 dígitos base36 del timestamp (ciclo de ~25 días)
 *   - 3 dígitos base36 aleatorios (46 656 combinaciones por ms)
 * La unicidad la garantiza además el constraint UNIQUE de LIS_samples.barcode;
 * los códigos largos generados antes de este cambio siguen siendo válidos.
 */
export function generateBarcode(prefix = "M") {
  const ts = Date.now().toString(36).toUpperCase().slice(-6);
  const rnd = Math.floor(Math.random() * 46656)
    .toString(36)
    .toUpperCase()
    .padStart(3, "0");
  return `${prefix}${ts}${rnd}`;
}
