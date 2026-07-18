import type { Role } from "@/lib/database.types";

/**
 * Helpers de roles SIN dependencias de servidor (no importan next/headers),
 * por lo que pueden usarse tanto en componentes cliente como servidor.
 */
export function hasRole(roles: Role[], allowed: Role[]) {
  return roles.some((r) => allowed.includes(r));
}
