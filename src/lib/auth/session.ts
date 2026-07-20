import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/roles";
import {
  computeEffectivePermissions,
  type PermissionMap,
  type PermissionRow,
} from "@/lib/permissions";
import type { Role, Tables } from "@/lib/database.types";

export { hasRole };

export const ACTIVE_ORG_COOKIE = "nova_org";
export const ACTIVE_SEDE_COOKIE = "nova_sede";

/**
 * Headers confiables seteados por el middleware (src/lib/supabase/middleware.ts),
 * que ya valido la sesion con auth.getUser() para este request. Evita repetir
 * esa llamada de red en cada Server Component. El middleware siempre borra
 * cualquier valor entrante con estos nombres antes de recalcularlos, asi que
 * un cliente no puede falsificarlos.
 */
const TRUSTED_USER_ID_HEADER = "x-nova-user-id";
const TRUSTED_USER_EMAIL_HEADER = "x-nova-user-email";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type MembershipRow = Tables<"LIS_memberships"> & {
  organizations: Pick<Tables<"LIS_organizations">, "id" | "nombre" | "slug"> | null;
  sedes: Pick<Tables<"LIS_sedes">, "id" | "nombre" | "codigo"> | null;
};

export type SessionContext = {
  user: { id: string; email: string };
  profile: Tables<"LIS_profiles"> | null;
  memberships: MembershipRow[];
  organizations: { id: string; nombre: string; slug: string }[];
  sedes: { id: string; nombre: string; codigo: string; organization_id: string }[];
  activeOrgId: string | null;
  activeSedeId: string | null;
  roles: Role[]; // roles del usuario en la organizacion activa
  isSuperadmin: boolean;
  permissionRows: PermissionRow[];
  perms: PermissionMap;
};

type SessionBundle = {
  profile: Tables<"LIS_profiles"> | null;
  memberships: MembershipRow[];
  organizations: { id: string; nombre: string; slug: string }[];
  sedes: { id: string; nombre: string; codigo: string; organization_id: string }[];
  activeOrgId: string | null;
  activeSedeId: string | null;
  roles: Role[];
  permissionRows: PermissionRow[];
  isSuperadmin: boolean;
};

/** Usuario autenticado (id + email), confiando en el header del middleware. */
async function getTrustedUser(): Promise<{ id: string; email: string } | null> {
  const h = await headers();
  const id = h.get(TRUSTED_USER_ID_HEADER);
  if (id) {
    return { id, email: h.get(TRUSTED_USER_EMAIL_HEADER) ?? "" };
  }

  // Fuera del alcance del matcher del middleware (edge case): fallback a la red.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { id: user.id, email: user.email ?? "" };
}

/** Usuario autenticado o redireccion a login. */
export const requireUser = cache(async () => {
  const user = await getTrustedUser();
  if (!user) redirect("/login");
  return user;
});

/**
 * Construye el contexto de sesion: perfil, membresias, organizacion/sede
 * activas (segun cookies) y permisos efectivos, en un solo round-trip a
 * Supabase (RPC get_session_bundle) en vez de 4 queries + un merge repetido.
 */
export const getSessionContext = cache(async (): Promise<SessionContext> => {
  const user = await getTrustedUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const cookieStore = await cookies();
  const orgCookie = cookieStore.get(ACTIVE_ORG_COOKIE)?.value ?? null;
  const sedeCookie = cookieStore.get(ACTIVE_SEDE_COOKIE)?.value ?? null;

  const { data, error } = await supabase.rpc("get_session_bundle", {
    p_org_cookie: orgCookie && UUID_RE.test(orgCookie) ? orgCookie : null,
    p_sede_cookie: sedeCookie && UUID_RE.test(sedeCookie) ? sedeCookie : null,
  });
  if (error) throw error;
  if (!data) redirect("/login");

  const bundle = data as unknown as SessionBundle;

  const perms = computeEffectivePermissions(
    bundle.permissionRows,
    bundle.activeSedeId,
    bundle.roles,
    bundle.isSuperadmin
  );

  return {
    user,
    profile: bundle.profile,
    memberships: bundle.memberships,
    organizations: bundle.organizations,
    sedes: bundle.sedes,
    activeOrgId: bundle.activeOrgId,
    activeSedeId: bundle.activeSedeId,
    roles: bundle.roles,
    isSuperadmin: bundle.isSuperadmin,
    permissionRows: bundle.permissionRows,
    perms,
  };
});

/** Exige alguno de los roles o lanza a una pagina sin permiso. */
export async function requireRole(allowed: Role[]) {
  const ctx = await getSessionContext();
  if (!hasRole(ctx.roles, allowed) && !ctx.profile?.es_superadmin) {
    redirect("/sin-permiso");
  }
  return ctx;
}

/** Solo superadmin de plataforma. Devuelve el contexto si pasa. */
export async function requireSuperadmin() {
  const ctx = await getSessionContext();
  if (!ctx.profile?.es_superadmin) redirect("/sin-permiso");
  return ctx;
}
