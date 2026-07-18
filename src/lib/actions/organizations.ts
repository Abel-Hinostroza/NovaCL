"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function bootstrapOrgAction(_prev: unknown, formData: FormData) {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const sede = String(formData.get("sede") ?? "Sede Principal").trim();
  if (!nombre) return { error: "El nombre de la organización es obligatorio." };

  const slug = nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || `org-${Date.now()}`;

  const supabase = await createClient();
  const { error } = await supabase.rpc("bootstrap_organization", {
    p_slug: slug,
    p_nombre: nombre,
    p_sede_nombre: sede || "Sede Principal",
  });

  if (error) {
    return {
      error: error.message.includes("duplicate")
        ? "Ya existe una organización con ese nombre."
        : "No se pudo crear la organización.",
    };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
