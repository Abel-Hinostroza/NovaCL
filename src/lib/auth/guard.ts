import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/session";
import type { ModuleKey, PermissionMap } from "@/lib/permissions";

/**
 * Guard de módulo: verifica el permiso efectivo (ya calculado una vez en
 * getSessionContext, sin query adicional) y redirige a /sin-permiso si no
 * alcanza. Devuelve el mapa de permisos por si la página necesita decidir
 * más fino.
 */
export async function requireModuleAccess(
  module: ModuleKey,
  action: "view" | "edit" = "view"
): Promise<PermissionMap> {
  const ctx = await getSessionContext();
  if (!ctx.perms[module]?.[action]) redirect("/sin-permiso");
  return ctx.perms;
}
