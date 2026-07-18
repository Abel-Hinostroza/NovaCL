"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/session";

export type ResultInput = {
  orderItemId: string;
  analyteId: string;
  valorNum?: number | null;
  valorTexto?: string | null;
  nota?: string | null;
};

/** Guarda (o corrige) un lote de resultados sin validar. */
export async function saveResultsAction(orderId: string, inputs: ResultInput[]) {
  const supabase = await createClient();
  for (const r of inputs) {
    const { error } = await supabase.rpc("upsert_result", {
      p_order_item_id: r.orderItemId,
      p_analyte_id: r.analyteId,
      p_valor_num: r.valorNum ?? null,
      p_valor_texto: r.valorTexto ?? null,
      p_nota: r.nota ?? null,
      p_validar: false,
    });
    if (error) return { error: error.message };
  }
  revalidatePath(`/resultados/${orderId}`);
  revalidatePath(`/ordenes/${orderId}`);
  return { ok: true };
}

/** Valida (firma) los resultados de la orden. Requiere rol validador. */
export async function validateResultsAction(orderId: string, inputs: ResultInput[]) {
  const ctx = await getSessionContext();
  if (!hasRole(ctx.roles, ["org_admin", "sede_admin", "validador"])) {
    return { error: "Solo un validador puede firmar los resultados." };
  }
  const supabase = await createClient();
  for (const r of inputs) {
    const { error } = await supabase.rpc("upsert_result", {
      p_order_item_id: r.orderItemId,
      p_analyte_id: r.analyteId,
      p_valor_num: r.valorNum ?? null,
      p_valor_texto: r.valorTexto ?? null,
      p_nota: r.nota ?? null,
      p_validar: true,
    });
    if (error) return { error: error.message };
  }
  revalidatePath(`/resultados/${orderId}`);
  revalidatePath(`/ordenes/${orderId}`);
  return { ok: true };
}
