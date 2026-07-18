import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import type { InvoiceStatus, Database } from "@/lib/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook de Wally para actualizar el estado de pago de un comprobante.
 *
 * Seguridad: valida un secreto compartido (header `x-wally-signature` o
 * `?secret=`) contra `WALLY_WEBHOOK_SECRET`. Usa service role (sin sesión de
 * usuario) porque lo invoca un sistema externo; por eso el secreto es
 * obligatorio en producción.
 *
 * Payload esperado (flexible):
 *   { external_id | id, status, serie?, numero?, pdf_url? }
 * Estados mapeados: paid/pagado→pagada, cancelled/anulado→anulada, error→error_sync.
 */

const STATUS_MAP: Record<string, InvoiceStatus> = {
  paid: "pagada",
  pagado: "pagada",
  pagada: "pagada",
  cancelled: "anulada",
  canceled: "anulada",
  anulado: "anulada",
  anulada: "anulada",
  voided: "anulada",
  error: "error_sync",
  failed: "error_sync",
  emitida: "emitida",
  issued: "emitida",
};

export async function POST(req: NextRequest) {
  const secret = process.env.WALLY_WEBHOOK_SECRET;
  const provided =
    req.headers.get("x-wally-signature") ??
    req.nextUrl.searchParams.get("secret") ??
    "";

  // En producción el secreto es obligatorio. Si está configurado, debe coincidir.
  if (secret && provided !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const externalId = String(payload.external_id ?? payload.id ?? "").trim();
  const rawStatus = String(payload.status ?? "").toLowerCase().trim();
  if (!externalId) {
    return NextResponse.json({ error: "external_id requerido" }, { status: 400 });
  }

  const nuevoEstado = STATUS_MAP[rawStatus];
  const admin = createAdminClient();

  const { data: invoice } = await admin
    .from("LIS_invoices")
    .select("id, order_id")
    .eq("external_id", externalId)
    .maybeSingle();

  if (!invoice) {
    return NextResponse.json({ error: "comprobante no encontrado" }, { status: 404 });
  }

  // Registrar el evento siempre (auditoría de la integración)
  await admin.from("LIS_invoice_events").insert({
    invoice_id: invoice.id,
    tipo: "webhook",
    detalle: payload as never,
  });

  if (nuevoEstado) {
    const patch: Database["public"]["Tables"]["LIS_invoices"]["Update"] = { status: nuevoEstado };
    if (payload.serie) patch.serie = String(payload.serie);
    if (payload.numero) patch.numero = String(payload.numero);
    if (payload.pdf_url) patch.pdf_url = String(payload.pdf_url);

    const { error } = await admin.from("LIS_invoices").update(patch).eq("id", invoice.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, invoice_id: invoice.id, status: nuevoEstado ?? "sin_cambio" });
}
