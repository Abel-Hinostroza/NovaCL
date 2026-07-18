"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import type { DeliveryChannel } from "@/lib/database.types";
import { sendResultEmail } from "@/lib/integrations/notifications";

/**
 * Crea una entrega de resultados. Genera un token de acceso al portal público
 * y, si el canal es email, dispara la notificación (proveedor configurable).
 */
export async function createDeliveryAction(
  orderId: string,
  canal: DeliveryChannel,
  destino: string
) {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const expira = new Date();
  expira.setDate(expira.getDate() + 30);

  const { data: delivery, error } = await supabase
    .from("LIS_result_deliveries")
    .insert({
      organization_id: ctx.activeOrgId!,
      order_id: orderId,
      canal,
      destino,
      status: "pendiente",
      token_expira_at: expira.toISOString(),
      enviado_por: ctx.user.id,
    })
    .select("id, access_token")
    .single();

  if (error) return { error: error.message };

  const portalBase = process.env.RESULTS_PUBLIC_BASE_URL ?? "http://localhost:3000/portal";
  const link = `${portalBase}/${delivery.access_token}`;

  let sent = true;
  let errorDetalle: string | null = null;

  if (canal === "email") {
    const res = await sendResultEmail(destino, link);
    sent = res.ok;
    errorDetalle = res.error ?? null;
  }
  // portal / sms / whatsapp: se marca enviado; el envío real se integra aparte.

  await supabase
    .from("LIS_result_deliveries")
    .update({
      status: sent ? "enviado" : "fallido",
      enviado_at: sent ? new Date().toISOString() : null,
      error_detalle: errorDetalle,
    })
    .eq("id", delivery.id);

  revalidatePath("/entrega");
  revalidatePath(`/ordenes/${orderId}`);
  return { ok: true, link, sent };
}
