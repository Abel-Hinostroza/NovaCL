"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext, hasRole } from "@/lib/auth/session";
import { getBillingProvider, type BillingProviderConfig } from "@/lib/integrations/billing";

/**
 * Emite el comprobante de una orden a través del proveedor configurado por el
 * tenant (por defecto Wally). Registra la factura y su bitácora de eventos.
 */
export async function emitInvoiceAction(orderId: string) {
  const ctx = await getSessionContext();
  if (!hasRole(ctx.roles, ["org_admin", "sede_admin", "facturacion"])) {
    return { error: "No autorizado para facturar." };
  }

  const supabase = await createClient();

  const { data: order } = await supabase
    .from("LIS_orders")
    .select(
      "id, codigo, moneda, patients:LIS_patients(nombres,apellidos,tipo_documento,numero_documento,email,direccion), order_items:LIS_order_items(study_nombre,study_codigo,precio,descuento,status)"
    )
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { error: "Orden no encontrada." };

  // Configuración de facturación del tenant
  const { data: integ } = await supabase
    .from("LIS_billing_integrations")
    .select("*")
    .eq("organization_id", ctx.activeOrgId!)
    .maybeSingle();

  const cfg: BillingProviderConfig = {
    provider: integ?.provider ?? "wally",
    enabled: integ?.enabled ?? true,
    config: (integ?.config as Record<string, unknown>) ?? {},
  };

  const patient = order.patients as unknown as {
    nombres: string;
    apellidos: string;
    tipo_documento: string;
    numero_documento: string;
    email: string | null;
    direccion: string | null;
  };
  const items = (order.order_items as unknown as { study_nombre: string; study_codigo: string; precio: number; descuento: number; status: string }[])
    .filter((i) => i.status !== "anulado");

  const provider = getBillingProvider(cfg);
  const result = await provider.emitInvoice({
    moneda: order.moneda,
    referencia: order.codigo,
    cliente: {
      tipo_documento: patient.tipo_documento,
      numero_documento: patient.numero_documento,
      nombre: `${patient.nombres} ${patient.apellidos}`,
      email: patient.email,
      direccion: patient.direccion,
    },
    lineas: items.map((i) => ({
      descripcion: i.study_nombre,
      codigo: i.study_codigo,
      cantidad: 1,
      precio_unitario: i.precio - i.descuento,
    })),
  });

  const { data: invoice, error } = await supabase
    .from("LIS_invoices")
    .insert({
      organization_id: ctx.activeOrgId!,
      order_id: orderId,
      provider: cfg.provider,
      external_id: result.externalId ?? null,
      serie: result.serie ?? null,
      numero: result.numero ?? null,
      status: result.ok ? "emitida" : "error_sync",
      moneda: order.moneda,
      subtotal: result.subtotal,
      impuestos: result.impuestos,
      total: result.total,
      pdf_url: result.pdfUrl ?? null,
      xml_url: result.xmlUrl ?? null,
      payload: (result.raw as never) ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await supabase.from("LIS_invoice_events").insert({
    invoice_id: invoice.id,
    tipo: result.ok ? "response" : "error",
    detalle: { ok: result.ok, error: result.error ?? null } as never,
  });

  revalidatePath("/facturacion");
  revalidatePath(`/ordenes/${orderId}`);

  if (!result.ok) return { error: result.error ?? "Error al emitir el comprobante." };
  return { ok: true };
}
