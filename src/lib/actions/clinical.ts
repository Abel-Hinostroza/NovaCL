"use server";

import { z } from "zod";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { friendlyDbError } from "@/lib/errors";
import type { Tables } from "@/lib/database.types";

// ─────────────────────────────────────────────────────────────
// Utilidades comunes
// ─────────────────────────────────────────────────────────────
export type ActionResult = { ok: boolean; error?: string; id?: string };

/** Contexto validado: org activa + permiso de edición del módulo pacientes. */
async function requireClinicalWrite() {
  const ctx = await getSessionContext();
  if (!ctx.activeOrgId) {
    return { error: "Sin organización activa." as const };
  }
  if (!ctx.perms.pacientes?.edit) {
    return { error: "No tienes permiso para editar la historia clínica." as const };
  }
  return { ctx, orgId: ctx.activeOrgId, userId: ctx.user.id };
}

function s(v: FormDataEntryValue | null): string | null {
  const t = String(v ?? "").trim();
  // `__none__` es el centinela de "sin selección" de los <Select> opcionales
  // (Radix no admite value vacío en un SelectItem).
  return t === "" || t === "__none__" ? null : t;
}
function n(v: FormDataEntryValue | null): number | null {
  const t = String(v ?? "").trim();
  if (t === "") return null;
  const num = Number(t);
  return Number.isFinite(num) ? num : null;
}
function b(v: FormDataEntryValue | null): boolean {
  const t = String(v ?? "").trim().toLowerCase();
  return t === "true" || t === "on" || t === "1";
}

// ─────────────────────────────────────────────────────────────
// Catálogo CIE-10
// ─────────────────────────────────────────────────────────────
export async function searchCie10Action(
  q: string
): Promise<Tables<"LIS_cie10">[]> {
  const ctx = await getSessionContext();
  if (!ctx.activeOrgId) return [];
  const term = String(q ?? "").trim().slice(0, 60);
  const supabase = await createClient();
  const { data } = await supabase.rpc("search_cie10", { p_q: term, p_limit: 20 });
  return data ?? [];
}

// ─────────────────────────────────────────────────────────────
// Perfil clínico (upsert de 1 fila por paciente)
// ─────────────────────────────────────────────────────────────
export async function saveClinicalProfileAction(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const guard = await requireClinicalWrite();
  if ("error" in guard) return { ok: false, error: guard.error };
  const { orgId, userId } = guard;

  const patientId = String(formData.get("patient_id") ?? "");
  if (!patientId) return { ok: false, error: "Paciente no especificado." };

  const consent = b(formData.get("consent_datos"));
  const donante = s(formData.get("donante_organos")); // "__none__"/"" → null
  const payload = {
    patient_id: patientId,
    organization_id: orgId,
    estado_civil: s(formData.get("estado_civil")),
    ocupacion: s(formData.get("ocupacion")),
    grado_instruccion: s(formData.get("grado_instruccion")),
    lugar_nacimiento: s(formData.get("lugar_nacimiento")),
    procedencia: s(formData.get("procedencia")),
    factor_rh: s(formData.get("factor_rh")),
    donante_organos: donante == null ? null : donante === "true",
    go_menarquia_edad: n(formData.get("go_menarquia_edad")),
    go_fur: s(formData.get("go_fur")),
    go_gestaciones: n(formData.get("go_gestaciones")),
    go_partos: n(formData.get("go_partos")),
    go_abortos: n(formData.get("go_abortos")),
    go_cesareas: n(formData.get("go_cesareas")),
    go_anticonceptivo: s(formData.get("go_anticonceptivo")),
    go_notas: s(formData.get("go_notas")),
    habito_tabaco: s(formData.get("habito_tabaco")),
    habito_alcohol: s(formData.get("habito_alcohol")),
    habito_drogas: s(formData.get("habito_drogas")),
    habito_actividad: s(formData.get("habito_actividad")),
    consent_datos: consent,
    consent_datos_at: consent ? new Date().toISOString() : null,
    consent_version: consent ? s(formData.get("consent_version")) ?? "v1" : null,
    notas_generales: s(formData.get("notas_generales")),
    updated_por: userId,
  };

  const supabase = await createClient();
  const { error } = await supabase
    .from("LIS_clinical_profile")
    .upsert(payload, { onConflict: "patient_id" });
  if (error) return { ok: false, error: friendlyDbError(error, "No se pudo guardar el perfil clínico.") };

  revalidatePath(`/pacientes/${patientId}`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Antecedentes / problemas (CIE-10)
// ─────────────────────────────────────────────────────────────
const conditionSchema = z.object({
  kind: z.enum(["personal", "familiar", "quirurgico", "congenito", "no_patologico", "otro"]),
  descripcion: z.string().min(1, "Descripción requerida").max(500),
  status: z.enum(["activo", "cronico", "resuelto"]).default("activo"),
});

export async function saveConditionAction(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const guard = await requireClinicalWrite();
  if ("error" in guard) return { ok: false, error: guard.error };
  const { orgId, userId } = guard;

  const patientId = String(formData.get("patient_id") ?? "");
  if (!patientId) return { ok: false, error: "Paciente no especificado." };

  const parsed = conditionSchema.safeParse({
    kind: formData.get("kind"),
    descripcion: formData.get("descripcion"),
    status: formData.get("status") || "activo",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const id = s(formData.get("id"));
  const payload = {
    organization_id: orgId,
    patient_id: patientId,
    kind: parsed.data.kind,
    cie10_codigo: s(formData.get("cie10_codigo")),
    descripcion: parsed.data.descripcion,
    status: parsed.data.status,
    fecha_inicio: s(formData.get("fecha_inicio")),
    fecha_resolucion: s(formData.get("fecha_resolucion")),
    parentesco: s(formData.get("parentesco")),
    notas: s(formData.get("notas")),
    profesional_id: s(formData.get("profesional_id")),
    registrado_por: userId,
  };

  const supabase = await createClient();
  const query = id
    ? supabase.from("LIS_clinical_conditions").update(payload).eq("id", id)
    : supabase.from("LIS_clinical_conditions").insert(payload);
  const { error } = await query;
  if (error) return { ok: false, error: friendlyDbError(error, "No se pudo guardar el antecedente.") };

  revalidatePath(`/pacientes/${patientId}`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Alergias
// ─────────────────────────────────────────────────────────────
export async function saveAllergyAction(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const guard = await requireClinicalWrite();
  if ("error" in guard) return { ok: false, error: guard.error };
  const { orgId, userId } = guard;

  const patientId = String(formData.get("patient_id") ?? "");
  const agente = s(formData.get("agente"));
  if (!patientId) return { ok: false, error: "Paciente no especificado." };
  if (!agente) return { ok: false, error: "El agente causante es obligatorio." };

  const id = s(formData.get("id"));
  const severidad = s(formData.get("severidad"));
  const payload = {
    organization_id: orgId,
    patient_id: patientId,
    tipo: (s(formData.get("tipo")) ?? "farmaco") as Tables<"LIS_allergies">["tipo"],
    agente,
    reaccion: s(formData.get("reaccion")),
    severidad: (severidad as Tables<"LIS_allergies">["severidad"]) ?? null,
    activa: formData.get("activa") == null ? true : b(formData.get("activa")),
    notas: s(formData.get("notas")),
    profesional_id: s(formData.get("profesional_id")),
    registrado_por: userId,
  };

  const supabase = await createClient();
  const query = id
    ? supabase.from("LIS_allergies").update(payload).eq("id", id)
    : supabase.from("LIS_allergies").insert(payload);
  const { error } = await query;
  if (error) return { ok: false, error: friendlyDbError(error, "No se pudo guardar la alergia.") };

  revalidatePath(`/pacientes/${patientId}`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Medicación
// ─────────────────────────────────────────────────────────────
export async function saveMedicationAction(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const guard = await requireClinicalWrite();
  if ("error" in guard) return { ok: false, error: guard.error };
  const { orgId, userId } = guard;

  const patientId = String(formData.get("patient_id") ?? "");
  const farmaco = s(formData.get("farmaco"));
  if (!patientId) return { ok: false, error: "Paciente no especificado." };
  if (!farmaco) return { ok: false, error: "El fármaco es obligatorio." };

  const id = s(formData.get("id"));
  const via = s(formData.get("via"));
  const payload = {
    organization_id: orgId,
    patient_id: patientId,
    farmaco,
    dosis: s(formData.get("dosis")),
    via: (via as Tables<"LIS_medications">["via"]) ?? null,
    frecuencia: s(formData.get("frecuencia")),
    indicado_por: s(formData.get("indicado_por")),
    profesional_id: s(formData.get("profesional_id")),
    status: (s(formData.get("status")) ?? "activo") as Tables<"LIS_medications">["status"],
    fecha_inicio: s(formData.get("fecha_inicio")),
    fecha_fin: s(formData.get("fecha_fin")),
    notas: s(formData.get("notas")),
    registrado_por: userId,
  };

  const supabase = await createClient();
  const query = id
    ? supabase.from("LIS_medications").update(payload).eq("id", id)
    : supabase.from("LIS_medications").insert(payload);
  const { error } = await query;
  if (error) return { ok: false, error: friendlyDbError(error, "No se pudo guardar la medicación.") };

  revalidatePath(`/pacientes/${patientId}`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Signos vitales / antropometría
// ─────────────────────────────────────────────────────────────
export async function saveVitalsAction(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const guard = await requireClinicalWrite();
  if ("error" in guard) return { ok: false, error: guard.error };
  const { orgId, userId } = guard;

  const patientId = String(formData.get("patient_id") ?? "");
  if (!patientId) return { ok: false, error: "Paciente no especificado." };

  const tomado = s(formData.get("tomado_at"));
  const payload = {
    organization_id: orgId,
    patient_id: patientId,
    tomado_at: tomado ? new Date(tomado).toISOString() : new Date().toISOString(),
    pa_sistolica: n(formData.get("pa_sistolica")),
    pa_diastolica: n(formData.get("pa_diastolica")),
    fc: n(formData.get("fc")),
    fr: n(formData.get("fr")),
    temperatura: n(formData.get("temperatura")),
    sato2: n(formData.get("sato2")),
    peso_kg: n(formData.get("peso_kg")),
    talla_cm: n(formData.get("talla_cm")),
    perimetro_abdominal: n(formData.get("perimetro_abdominal")),
    glucosa_capilar: n(formData.get("glucosa_capilar")),
    notas: s(formData.get("notas")),
    profesional_id: s(formData.get("profesional_id")),
    tomado_por: userId,
  };

  const supabase = await createClient();
  const { error } = await supabase.from("LIS_vitals").insert(payload);
  if (error) return { ok: false, error: friendlyDbError(error, "No se pudieron guardar los signos vitales.") };

  revalidatePath(`/pacientes/${patientId}`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Notas de evolución (firma de profesional opcional)
// ─────────────────────────────────────────────────────────────
export async function saveNoteAction(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const guard = await requireClinicalWrite();
  if ("error" in guard) return { ok: false, error: guard.error };
  const { orgId, userId } = guard;

  const patientId = String(formData.get("patient_id") ?? "");
  const cuerpo = s(formData.get("cuerpo"));
  if (!patientId) return { ok: false, error: "Paciente no especificado." };
  if (!cuerpo) return { ok: false, error: "El cuerpo de la nota es obligatorio." };

  const id = s(formData.get("id"));
  const firmar = b(formData.get("firmar"));
  const profesionalId = s(formData.get("profesional_id"));

  const supabase = await createClient();

  // Una nota firmada es inmutable: no se reescribe.
  if (id) {
    const { data: existing } = await supabase
      .from("LIS_clinical_notes")
      .select("status")
      .eq("id", id)
      .maybeSingle();
    if (existing?.status === "firmada") {
      return { ok: false, error: "La nota ya está firmada: crea una nota nueva para corregir." };
    }
  }

  const payload = {
    organization_id: orgId,
    patient_id: patientId,
    order_id: s(formData.get("order_id")),
    kind: (s(formData.get("kind")) ?? "evolucion") as Tables<"LIS_clinical_notes">["kind"],
    titulo: s(formData.get("titulo")),
    cuerpo,
    status: (firmar ? "firmada" : "borrador") as Tables<"LIS_clinical_notes">["status"],
    profesional_id: profesionalId,
    firmado_at: firmar ? new Date().toISOString() : null,
    registrado_por: userId,
  };

  const query = id
    ? supabase.from("LIS_clinical_notes").update(payload).eq("id", id)
    : supabase.from("LIS_clinical_notes").insert(payload);
  const { error } = await query;
  if (error) return { ok: false, error: friendlyDbError(error, "No se pudo guardar la nota.") };

  revalidatePath(`/pacientes/${patientId}`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Adjuntos: enlace externo, archivo subido y URL firmada de lectura
// ─────────────────────────────────────────────────────────────
const ATT_BUCKET = "clinical";
const MAX_ATT_BYTES = 20 * 1024 * 1024; // 20 MB
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/tiff",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export async function linkAttachmentAction(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const guard = await requireClinicalWrite();
  if ("error" in guard) return { ok: false, error: guard.error };
  const { orgId, userId } = guard;

  const patientId = String(formData.get("patient_id") ?? "");
  const titulo = s(formData.get("titulo"));
  const url = s(formData.get("url_externa"));
  if (!patientId) return { ok: false, error: "Paciente no especificado." };
  if (!titulo) return { ok: false, error: "El título es obligatorio." };
  if (!url) return { ok: false, error: "El enlace es obligatorio." };
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return { ok: false, error: "El enlace debe empezar con http:// o https://" };
    }
  } catch {
    return { ok: false, error: "El enlace no es una URL válida." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("LIS_clinical_attachments").insert({
    organization_id: orgId,
    patient_id: patientId,
    kind: (s(formData.get("kind")) ?? "otro") as Tables<"LIS_clinical_attachments">["kind"],
    titulo,
    descripcion: s(formData.get("descripcion")),
    url_externa: url,
    subido_por: userId,
  });
  if (error) return { ok: false, error: friendlyDbError(error, "No se pudo guardar el enlace.") };

  revalidatePath(`/pacientes/${patientId}`);
  return { ok: true };
}

export async function uploadAttachmentAction(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const guard = await requireClinicalWrite();
  if ("error" in guard) return { ok: false, error: guard.error };
  const { orgId, userId } = guard;

  const patientId = String(formData.get("patient_id") ?? "");
  const titulo = s(formData.get("titulo"));
  const file = formData.get("file");
  if (!patientId) return { ok: false, error: "Paciente no especificado." };
  if (!titulo) return { ok: false, error: "El título es obligatorio." };
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Adjunta un archivo válido." };
  }
  if (file.size > MAX_ATT_BYTES) {
    return { ok: false, error: "El archivo supera el máximo de 20 MB." };
  }
  if (file.type && !ALLOWED_MIME.has(file.type)) {
    return { ok: false, error: "Formato no permitido (PDF, imágenes o Word)." };
  }

  // Confirmar que el paciente pertenece a la organización activa.
  const supabase = await createClient();
  const { data: patient } = await supabase
    .from("LIS_patients")
    .select("id")
    .eq("id", patientId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!patient) return { ok: false, error: "Paciente no encontrado en tu organización." };

  const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
  const storagePath = `${orgId}/${patientId}/${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  // La escritura al bucket privado va con service role (RLS solo permite lectura).
  const admin = createAdminClient();
  const { error: upErr } = await admin.storage.from(ATT_BUCKET).upload(storagePath, buffer, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (upErr) return { ok: false, error: `Storage: ${upErr.message}` };

  // El registro va con el cliente del usuario para que RLS + auditoría capturen al actor.
  const { error: insErr } = await supabase.from("LIS_clinical_attachments").insert({
    organization_id: orgId,
    patient_id: patientId,
    kind: (s(formData.get("kind")) ?? "otro") as Tables<"LIS_clinical_attachments">["kind"],
    titulo,
    descripcion: s(formData.get("descripcion")),
    storage_path: storagePath,
    mime: file.type || null,
    size_bytes: file.size,
    subido_por: userId,
  });
  if (insErr) {
    // rollback del archivo si el registro falla
    await admin.storage.from(ATT_BUCKET).remove([storagePath]);
    return { ok: false, error: friendlyDbError(insErr, "No se pudo registrar el adjunto.") };
  }

  revalidatePath(`/pacientes/${patientId}`);
  return { ok: true };
}

/** URL firmada de lectura (1 hora) para un adjunto almacenado. */
export async function signedAttachmentUrlAction(
  attachmentId: string
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const ctx = await getSessionContext();
  if (!ctx.activeOrgId) return { ok: false, error: "Sin organización activa." };

  const supabase = await createClient();
  const { data: att } = await supabase
    .from("LIS_clinical_attachments")
    .select("storage_path, organization_id")
    .eq("id", attachmentId)
    .maybeSingle();
  if (!att?.storage_path) return { ok: false, error: "Adjunto no encontrado." };
  if (att.organization_id !== ctx.activeOrgId) return { ok: false, error: "No autorizado." };

  const admin = createAdminClient();
  const { data } = await admin.storage.from(ATT_BUCKET).createSignedUrl(att.storage_path, 3600);
  if (!data?.signedUrl) return { ok: false, error: "No se pudo firmar el enlace." };
  return { ok: true, url: data.signedUrl };
}

// ─────────────────────────────────────────────────────────────
// Anulación con motivo (soft-delete común a las entidades de historia)
//   No se borra físicamente: la historia clínica es inmutable.
// ─────────────────────────────────────────────────────────────
type AnnulTable =
  | "LIS_clinical_conditions"
  | "LIS_allergies"
  | "LIS_medications"
  | "LIS_vitals"
  | "LIS_clinical_attachments";

export async function annulClinicalRecordAction(
  table: AnnulTable,
  id: string,
  motivo: string,
  patientId: string
): Promise<ActionResult> {
  const guard = await requireClinicalWrite();
  if ("error" in guard) return { ok: false, error: guard.error };

  const reason = String(motivo ?? "").trim();
  if (reason.length < 4) return { ok: false, error: "Indica el motivo de la anulación." };

  const supabase = await createClient();
  const { error } = await supabase
    .from(table)
    .update({ anulado: true, anulado_motivo: reason })
    .eq("id", id);
  if (error) return { ok: false, error: friendlyDbError(error, "No se pudo anular el registro.") };

  revalidatePath(`/pacientes/${patientId}`);
  return { ok: true };
}

/** Anulación específica de notas (usa el enum de estado en vez de un booleano). */
export async function annulNoteAction(
  id: string,
  motivo: string,
  patientId: string
): Promise<ActionResult> {
  const guard = await requireClinicalWrite();
  if ("error" in guard) return { ok: false, error: guard.error };

  const reason = String(motivo ?? "").trim();
  if (reason.length < 4) return { ok: false, error: "Indica el motivo de la anulación." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("LIS_clinical_notes")
    .update({ status: "anulada", anulado_motivo: reason })
    .eq("id", id);
  if (error) return { ok: false, error: friendlyDbError(error, "No se pudo anular la nota.") };

  revalidatePath(`/pacientes/${patientId}`);
  return { ok: true };
}
