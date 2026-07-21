"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";

export type ProfessionalLite = {
  id: string;
  tipo: string;
  nombres: string;
  apellidos: string;
  numero_colegiatura: string | null;
  colegio: string | null;
  especialidad: string | null;
  externo: boolean;
};

/**
 * Búsqueda navegable del directorio de profesionales activos de la
 * organización activa. Pensada para autocomplete en formularios
 * (orden, cita, aviso de valor crítico).
 *
 * RLS (0016): todos los miembros ven los profesionales de su org.
 */
export async function searchProfessionalsAction(query: string): Promise<ProfessionalLite[]> {
  const ctx = await getSessionContext();
  if (!ctx.activeOrgId) return [];

  const supabase = await createClient();
  const q = query.trim();
  let req = supabase
    .from("LIS_professionals")
    .select("id, tipo, nombres, apellidos, numero_colegiatura, colegio, especialidad, externo")
    .eq("organization_id", ctx.activeOrgId)
    .eq("activo", true)
    .order("apellidos")
    .limit(25);

  if (q.length > 0) {
    // Búsqueda simple por OR sobre los campos visibles. Suficiente para
    // un selector con autocomplete: pocos cientos de profesionales por org.
    const ilike = `%${q}%`;
    req = req.or(
      `nombres.ilike.${ilike},apellidos.ilike.${ilike},numero_colegiatura.ilike.${ilike},especialidad.ilike.${ilike}`
    );
  }

  const { data, error } = await req;
  if (error) return [];
  return (data ?? []) as ProfessionalLite[];
}
