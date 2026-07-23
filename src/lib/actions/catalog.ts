"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext, hasRole } from "@/lib/auth/session";
import { friendlyDbError } from "@/lib/errors";
import { isValidCategoryColor } from "@/lib/catalog/category-colors";
import type { ValueType } from "@/lib/database.types";

type Ctx = Awaited<ReturnType<typeof getSessionContext>>;

/** Guard de administración del catálogo: devuelve el contexto o un error
 *  manejable por la UI (nunca lanza: un throw rompe el cliente). */
async function catalogAdminCtx(): Promise<{ ctx: Ctx } | { error: string }> {
  const ctx = await getSessionContext();
  if (!hasRole(ctx.roles, ["org_admin", "sede_admin"]) && !ctx.profile?.es_superadmin) {
    return { error: "No autorizado para editar el catálogo." };
  }
  return { ctx };
}

const MAX_NUMERIC_12_2 = 999_999_999.99; // tope de numeric(12,2)

// ── Categorías ───────────────────────────────────────────────
export async function saveCategoryAction(_prev: unknown, formData: FormData) {
  const guard = await catalogAdminCtx();
  if ("error" in guard) return { error: guard.error };
  const ctx = guard.ctx;
  const id = String(formData.get("id") ?? "");
  const codigo = String(formData.get("codigo") ?? "").trim().toUpperCase();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const colorRaw = String(formData.get("color") ?? "").trim();
  if (!codigo || !nombre) return { error: "Código y nombre son obligatorios." };
  if (codigo.length > 40 || nombre.length > 200) return { error: "Código o nombre demasiado largo." };
  if (colorRaw && !isValidCategoryColor(colorRaw)) return { error: "Color no válido." };
  const color = colorRaw || null;

  const supabase = await createClient();
  const payload = { organization_id: ctx.activeOrgId!, codigo, nombre, color };
  const { error } = id
    ? await supabase.from("LIS_test_categories").update(payload).eq("id", id).eq("organization_id", ctx.activeOrgId!)
    : await supabase.from("LIS_test_categories").insert(payload);
  if (error) {
    return { error: error.code === "23505" ? "Ya existe una categoría con ese código." : friendlyDbError(error, "No se pudo guardar.") };
  }
  revalidatePath("/catalogo");
  return { ok: true };
}

/** Baja lógica de una categoría propia. */
export async function deleteCategoryAction(categoryId: string) {
  const guard = await catalogAdminCtx();
  if ("error" in guard) return { error: guard.error };
  const ctx = guard.ctx;
  const supabase = await createClient();

  // Solo categorías propias (las globales son de solo lectura).
  const { data: cat } = await supabase
    .from("LIS_test_categories")
    .select("id, organization_id")
    .eq("id", categoryId)
    .maybeSingle();
  if (!cat || cat.organization_id !== ctx.activeOrgId) {
    return { error: "No se puede eliminar esta categoría." };
  }

  const { error } = await supabase
    .from("LIS_test_categories")
    .update({ activo: false })
    .eq("id", categoryId)
    .eq("organization_id", ctx.activeOrgId!);
  if (error) return { error: friendlyDbError(error, "No se pudo eliminar la categoría.") };
  revalidatePath("/catalogo");
  return { ok: true };
}

/** Baja lógica de un analito propio (bloqueada si está en uso en un estudio). */
export async function deleteAnalyteAction(analyteId: string) {
  const guard = await catalogAdminCtx();
  if ("error" in guard) return { error: guard.error };
  const ctx = guard.ctx;
  const supabase = await createClient();

  const { data: analyte } = await supabase
    .from("LIS_analytes")
    .select("id, organization_id")
    .eq("id", analyteId)
    .maybeSingle();
  if (!analyte || analyte.organization_id !== ctx.activeOrgId) {
    return { error: "No se puede eliminar este analito." };
  }

  // No permitir eliminar un analito que compone algún estudio.
  const { count } = await supabase
    .from("LIS_study_analytes")
    .select("id", { count: "exact", head: true })
    .eq("analyte_id", analyteId);
  if ((count ?? 0) > 0) {
    return { error: "El analito está en uso en uno o más estudios; quítalo de su composición primero." };
  }

  const { error } = await supabase
    .from("LIS_analytes")
    .update({ activo: false })
    .eq("id", analyteId)
    .eq("organization_id", ctx.activeOrgId!);
  if (error) return { error: friendlyDbError(error, "No se pudo eliminar el analito.") };
  revalidatePath("/catalogo");
  return { ok: true };
}

/**
 * Adopta una plantilla GLOBAL como estudio propio de la organización: clona el
 * estudio (campos + composición + precio base) sin tocar el global, que sigue
 * compartido. La composición mantiene la referencia a los analitos originales
 * (incluidos los globales), así que el estudio adoptado hereda sus rangos de
 * referencia. Operación de catálogo a nivel org → requiere org_admin.
 */
export async function adoptStudyAction(studyId: string) {
  const ctx = await getSessionContext();
  const orgId = ctx.activeOrgId;
  const isOrgAdmin =
    !!ctx.profile?.es_superadmin ||
    ctx.memberships.some(
      (m) => m.organization_id === orgId && m.activo && m.role === "org_admin"
    );
  if (!orgId) return { error: "Selecciona una organización activa." };
  if (!isOrgAdmin) return { error: "Solo un administrador de organización puede adoptar plantillas." };

  const supabase = await createClient();
  const { data: global } = await supabase
    .from("LIS_studies")
    .select(
      "id, organization_id, category_id, specimen_type_id, codigo, nombre, descripcion, loinc_code, tiempo_entrega_h, requiere_ayuno, indicaciones, study_analytes:LIS_study_analytes(analyte_id, orden, formula), study_prices:LIS_study_prices(precio, sede_id)"
    )
    .eq("id", studyId)
    .maybeSingle();
  if (!global) return { error: "Estudio no encontrado." };
  if (global.organization_id !== null) return { error: "Este estudio ya es propio de una organización." };

  // Código único por organización: sufijar si ya existe uno propio.
  let codigo = global.codigo;
  const { data: clash } = await supabase
    .from("LIS_studies")
    .select("id")
    .eq("organization_id", orgId)
    .eq("codigo", codigo)
    .maybeSingle();
  if (clash) codigo = `${global.codigo}-1`.slice(0, 40);

  const { data: study, error } = await supabase
    .from("LIS_studies")
    .insert({
      organization_id: orgId,
      category_id: global.category_id,
      specimen_type_id: global.specimen_type_id,
      codigo,
      nombre: global.nombre,
      descripcion: global.descripcion,
      loinc_code: global.loinc_code,
      tiempo_entrega_h: global.tiempo_entrega_h,
      requiere_ayuno: global.requiere_ayuno,
      indicaciones: global.indicaciones,
    })
    .select("id")
    .single();
  if (error) return { error: friendlyDbError(error, "No se pudo adoptar el estudio.") };

  const composition = (global.study_analytes as unknown as { analyte_id: string; orden: number; formula: string | null }[]) ?? [];
  if (composition.length > 0) {
    const { error: compError } = await supabase.from("LIS_study_analytes").insert(
      composition.map((c) => ({ study_id: study.id, analyte_id: c.analyte_id, orden: c.orden, formula: c.formula }))
    );
    if (compError) return { error: friendlyDbError(compError, "El estudio se adoptó pero no su composición.") };
  }

  const basePrice = (global.study_prices as unknown as { precio: number; sede_id: string | null }[])
    ?.find((p) => p.sede_id === null)?.precio;
  const { error: priceError } = await supabase.from("LIS_study_prices").insert({
    study_id: study.id,
    sede_id: null,
    moneda: "PEN",
    precio: basePrice ?? 0,
  });
  if (priceError) return { error: friendlyDbError(priceError, "El estudio se adoptó pero no su precio.") };

  revalidatePath("/catalogo");
  return { ok: true, id: study.id };
}

// ── Analitos ─────────────────────────────────────────────────
export async function saveAnalyteAction(_prev: unknown, formData: FormData) {
  const guard = await catalogAdminCtx();
  if ("error" in guard) return { error: guard.error };
  const ctx = guard.ctx;
  const id = String(formData.get("id") ?? "");
  const codigo = String(formData.get("codigo") ?? "").trim().toUpperCase();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const unidad = String(formData.get("unidad") ?? "").trim();
  const metodo = String(formData.get("metodo") ?? "").trim();
  const categoryId = String(formData.get("category_id") ?? "");
  const valueType = String(formData.get("value_type") ?? "numerico") as ValueType;
  const decimales = Number(formData.get("decimales") ?? 2);
  // rango de referencia (opcional, simple)
  const valorMin = formData.get("valor_min");
  const valorMax = formData.get("valor_max");

  if (!codigo || !nombre) return { error: "Código y nombre son obligatorios." };
  if (!["numerico", "texto", "opcion"].includes(valueType)) return { error: "Tipo de valor inválido." };
  if (!Number.isInteger(decimales) || decimales < 0 || decimales > 4) {
    return { error: "Decimales debe ser un entero entre 0 y 4." };
  }

  const minN = valorMin ? Number(valorMin) : null;
  const maxN = valorMax ? Number(valorMax) : null;
  for (const [label, v] of [["mínimo", minN], ["máximo", maxN]] as const) {
    if (v !== null && (!Number.isFinite(v) || Math.abs(v) > MAX_NUMERIC_12_2)) {
      return { error: `El valor ${label} del rango no es válido.` };
    }
  }
  if (minN !== null && maxN !== null && minN > maxN) {
    return { error: "El valor mínimo no puede ser mayor que el valor máximo." };
  }

  const supabase = await createClient();
  const payload = {
    organization_id: ctx.activeOrgId!,
    category_id: categoryId || null,
    codigo,
    nombre,
    unidad: unidad || null,
    metodo: metodo || null,
    value_type: valueType,
    decimales,
  };

  const { data: saved, error } = id
    ? await supabase.from("LIS_analytes").update(payload).eq("id", id).select("id").single()
    : await supabase.from("LIS_analytes").insert(payload).select("id").single();

  if (error) {
    return { error: error.code === "23505" ? "Ya existe un analito con ese código." : friendlyDbError(error, "No se pudo guardar.") };
  }

  // rango de referencia general (solo al crear, si se proporcionó)
  if (!id && valueType === "numerico" && (minN !== null || maxN !== null)) {
    const { error: rangeError } = await supabase.from("LIS_reference_ranges").insert({
      analyte_id: saved.id,
      sexo: "desconocido",
      valor_min: minN,
      valor_max: maxN,
    });
    if (rangeError) {
      return { error: friendlyDbError(rangeError, "El analito se guardó pero no su rango de referencia.") };
    }
  }

  revalidatePath("/catalogo");
  return { ok: true };
}

// ── Estudios (con composición y precio base) ─────────────────
export async function saveStudyAction(_prev: unknown, formData: FormData) {
  const guard = await catalogAdminCtx();
  if ("error" in guard) return { error: guard.error };
  const ctx = guard.ctx;
  const id = String(formData.get("id") ?? "");
  const codigo = String(formData.get("codigo") ?? "").trim().toUpperCase();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const categoryId = String(formData.get("category_id") ?? "");
  const specimenTypeId = String(formData.get("specimen_type_id") ?? "");
  const tatH = formData.get("tiempo_entrega_h");
  const requiereAyuno = formData.get("requiere_ayuno") === "on";
  const precio = Number(formData.get("precio") ?? 0);
  const analyteIds = [...new Set(formData.getAll("analyte_ids").map(String).filter(Boolean))];

  if (!codigo || !nombre) return { error: "Código y nombre son obligatorios." };
  if (analyteIds.length === 0) return { error: "Selecciona al menos un analito." };
  if (!analyteIds.every((a) => z.string().uuid().safeParse(a).success)) {
    return { error: "La composición incluye un analito inválido." };
  }
  if (!Number.isFinite(precio) || precio < 0 || precio > MAX_NUMERIC_12_2) {
    return { error: "El precio debe ser un número entre 0 y 999,999,999.99." };
  }
  const tat = tatH ? Number(tatH) : null;
  if (tat !== null && (!Number.isInteger(tat) || tat < 0 || tat > 8760)) {
    return { error: "El tiempo de entrega debe ser un entero de horas válido (0-8760)." };
  }

  const supabase = await createClient();
  const payload = {
    organization_id: ctx.activeOrgId!,
    category_id: categoryId || null,
    specimen_type_id: specimenTypeId || null,
    codigo,
    nombre,
    tiempo_entrega_h: tat,
    requiere_ayuno: requiereAyuno,
  };

  const { data: study, error } = id
    ? await supabase.from("LIS_studies").update(payload).eq("id", id).select("id").single()
    : await supabase.from("LIS_studies").insert(payload).select("id").single();

  if (error) {
    return { error: error.code === "23505" ? "Ya existe un estudio con ese código." : friendlyDbError(error, "No se pudo guardar.") };
  }

  // Reemplazar composición
  const { error: delError } = await supabase.from("LIS_study_analytes").delete().eq("study_id", study.id);
  if (delError) return { error: friendlyDbError(delError, "No se pudo actualizar la composición.") };
  const { error: compError } = await supabase.from("LIS_study_analytes").insert(
    analyteIds.map((analyte_id, i) => ({ study_id: study.id, analyte_id, orden: i + 1 }))
  );
  if (compError) return { error: friendlyDbError(compError, "No se pudo guardar la composición del estudio.") };

  // Precio base (sede null). Upsert manual: borrar el base vigente y crear.
  const { error: delPriceError } = await supabase
    .from("LIS_study_prices")
    .delete()
    .eq("study_id", study.id)
    .is("sede_id", null);
  if (delPriceError) return { error: friendlyDbError(delPriceError, "No se pudo actualizar el precio.") };
  const { error: priceError } = await supabase.from("LIS_study_prices").insert({
    study_id: study.id,
    sede_id: null,
    moneda: "PEN",
    precio,
  });
  if (priceError) return { error: friendlyDbError(priceError, "El estudio se guardó pero no su precio.") };

  revalidatePath("/catalogo");
  return { ok: true };
}

// ── Precios por sede ─────────────────────────────────────────

/**
 * Alcance de administración de precios del usuario en la organización activa.
 *   · isOrgAdmin  → puede editar el precio base y el de cualquier sede, y replicar.
 *   · sedeAdminIds → sedes puntuales donde es sede_admin (solo esas puede editar).
 * El superadmin se trata como org_admin a estos efectos.
 */
function priceAdminScope(ctx: Ctx) {
  const orgId = ctx.activeOrgId;
  const superadmin = !!ctx.profile?.es_superadmin;
  const orgMs = ctx.memberships.filter((m) => m.organization_id === orgId && m.activo);
  const isOrgAdmin = superadmin || orgMs.some((m) => m.role === "org_admin");
  const sedeAdminIds = orgMs
    .filter((m) => m.role === "sede_admin" && m.sede_id)
    .map((m) => m.sede_id as string);
  return { orgId, isOrgAdmin, sedeAdminIds };
}

function validPrice(precio: number): string | null {
  if (!Number.isFinite(precio) || precio < 0 || precio > MAX_NUMERIC_12_2) {
    return "El precio debe ser un número entre 0 y 999,999,999.99.";
  }
  return null;
}

/** Reemplaza (upsert manual) el precio de un estudio para una sede, o el base
 *  (sede_id null). El estudio puede ser propio o una plantilla global. */
export async function setStudyPriceAction(
  studyId: string,
  sedeId: string | null,
  precio: number
) {
  const ctx = await getSessionContext();
  const { orgId, isOrgAdmin, sedeAdminIds } = priceAdminScope(ctx);
  if (!orgId) return { error: "Selecciona una organización activa." };
  if (!isOrgAdmin && sedeAdminIds.length === 0) {
    return { error: "No autorizado para editar precios." };
  }
  const priceError = validPrice(precio);
  if (priceError) return { error: priceError };

  const supabase = await createClient();

  // El estudio debe existir y ser propio o global (visible para la org).
  const { data: study } = await supabase
    .from("LIS_studies")
    .select("id, organization_id")
    .eq("id", studyId)
    .maybeSingle();
  if (!study || (study.organization_id !== null && study.organization_id !== orgId)) {
    return { error: "Estudio no encontrado." };
  }

  if (sedeId === null) {
    // Precio base: solo org_admin y solo sobre estudios propios (no globales).
    if (!isOrgAdmin) {
      return { error: "Solo un administrador de organización edita el precio base." };
    }
    if (study.organization_id === null) {
      return {
        error: "No se edita el precio base de una plantilla global; fija un precio por sede.",
      };
    }
  } else {
    // Precio por sede: la sede debe estar en el alcance del usuario…
    if (!isOrgAdmin && !sedeAdminIds.includes(sedeId)) {
      return { error: "Solo puedes editar el precio de tu sede." };
    }
    // …y pertenecer a la organización activa.
    const { data: sede } = await supabase
      .from("LIS_sedes")
      .select("id")
      .eq("id", sedeId)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (!sede) return { error: "Sede no encontrada." };
  }

  const del = supabase.from("LIS_study_prices").delete().eq("study_id", studyId);
  const { error: delErr } =
    sedeId === null ? await del.is("sede_id", null) : await del.eq("sede_id", sedeId);
  if (delErr) return { error: friendlyDbError(delErr, "No se pudo actualizar el precio.") };

  const { error: insErr } = await supabase.from("LIS_study_prices").insert({
    study_id: studyId,
    sede_id: sedeId,
    moneda: "PEN",
    precio,
  });
  if (insErr) return { error: friendlyDbError(insErr, "No se pudo guardar el precio.") };

  revalidatePath("/catalogo");
  return { ok: true };
}

/** Replica un mismo precio por sede a TODAS las sedes de la organización.
 *  Solo org_admin. */
export async function replicateStudyPriceAction(studyId: string, precio: number) {
  const ctx = await getSessionContext();
  const { orgId, isOrgAdmin } = priceAdminScope(ctx);
  if (!orgId) return { error: "Selecciona una organización activa." };
  if (!isOrgAdmin) {
    return { error: "Solo un administrador de organización puede replicar precios." };
  }
  const priceError = validPrice(precio);
  if (priceError) return { error: priceError };

  const supabase = await createClient();
  const { data: study } = await supabase
    .from("LIS_studies")
    .select("id, organization_id")
    .eq("id", studyId)
    .maybeSingle();
  if (!study || (study.organization_id !== null && study.organization_id !== orgId)) {
    return { error: "Estudio no encontrado." };
  }

  const { data: sedes } = await supabase
    .from("LIS_sedes")
    .select("id")
    .eq("organization_id", orgId)
    .eq("activo", true);
  if (!sedes || sedes.length === 0) return { error: "No hay sedes en la organización." };

  const sedeIds = sedes.map((s) => s.id);
  const { error: delErr } = await supabase
    .from("LIS_study_prices")
    .delete()
    .eq("study_id", studyId)
    .in("sede_id", sedeIds);
  if (delErr) return { error: friendlyDbError(delErr, "No se pudo replicar el precio.") };

  const { error: insErr } = await supabase.from("LIS_study_prices").insert(
    sedeIds.map((sede_id) => ({ study_id: studyId, sede_id, moneda: "PEN", precio }))
  );
  if (insErr) return { error: friendlyDbError(insErr, "No se pudo replicar el precio.") };

  revalidatePath("/catalogo");
  return { ok: true };
}

export async function deleteStudyAction(studyId: string) {
  const guard = await catalogAdminCtx();
  if ("error" in guard) return { error: guard.error };
  const supabase = await createClient();
  const { error } = await supabase.from("LIS_studies").update({ activo: false }).eq("id", studyId);
  if (error) return { error: friendlyDbError(error, "No se pudo dar de baja el estudio.") };
  revalidatePath("/catalogo");
  return { ok: true };
}
