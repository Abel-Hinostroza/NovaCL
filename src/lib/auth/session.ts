import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/roles";
import type { Role, Tables } from "@/lib/database.types";

export { hasRole };

export const ACTIVE_ORG_COOKIE = "nova_org";
export const ACTIVE_SEDE_COOKIE = "nova_sede";

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
};

/** Usuario autenticado o redireccion a login. */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
});

/**
 * Construye el contexto de sesion: perfil, membresias, organizacion y sede
 * activas (segun cookies) y roles efectivos en la organizacion activa.
 */
export const getSessionContext = cache(async (): Promise<SessionContext> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("LIS_profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("LIS_memberships")
      .select(
        "*, organizations:LIS_organizations(id,nombre,slug), sedes:LIS_sedes(id,nombre,codigo)"
      )
      .eq("user_id", user.id)
      .eq("activo", true),
  ]);

  const mships = (memberships ?? []) as unknown as MembershipRow[];

  // Organizaciones unicas
  const orgMap = new Map<string, { id: string; nombre: string; slug: string }>();
  for (const m of mships) {
    if (m.organizations) orgMap.set(m.organizations.id, m.organizations);
  }
  const organizations = [...orgMap.values()];

  const cookieStore = await cookies();
  let activeOrgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value ?? null;
  if (!activeOrgId || !orgMap.has(activeOrgId)) {
    activeOrgId = organizations[0]?.id ?? null;
  }

  // Sedes visibles en la organizacion activa
  const { data: sedesData } = activeOrgId
    ? await supabase
        .from("LIS_sedes")
        .select("id,nombre,codigo,organization_id")
        .eq("organization_id", activeOrgId)
        .eq("activo", true)
        .order("codigo")
    : { data: [] };
  const sedes = sedesData ?? [];

  let activeSedeId = cookieStore.get(ACTIVE_SEDE_COOKIE)?.value ?? null;
  if (!activeSedeId || !sedes.some((s) => s.id === activeSedeId)) {
    activeSedeId = sedes[0]?.id ?? null;
  }

  const roles = mships
    .filter((m) => m.organization_id === activeOrgId)
    .map((m) => m.role);

  return {
    user: { id: user.id, email: user.email ?? "" },
    profile: profile ?? null,
    memberships: mships,
    organizations,
    sedes,
    activeOrgId,
    activeSedeId,
    roles: [...new Set(roles)],
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
