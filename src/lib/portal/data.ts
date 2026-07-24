import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ResultFlag } from "@/lib/database.types";

type DB = SupabaseClient<Database>;

export type PortalOrderCard = {
  id: string;
  codigo: string;
  fecha: string;
  organizacion: string;
  sede: string;
  medico: string | null;
  /** Estudios con al menos un resultado validado. */
  estudios: number;
  /** Analitos validados fuera de rango (flag distinto de normal). */
  anormales: number;
  /** Hay algún valor en rango crítico. */
  critico: boolean;
  /** Fecha del último resultado validado (para "listo desde"). */
  validadoAt: string | null;
};

const CRITICAL_FLAGS: ResultFlag[] = ["critico_alto", "critico_bajo"];

/**
 * Lista las órdenes del paciente (por ids de registro) que ya tienen al menos
 * un resultado validado, con un resumen para las tarjetas del portal. Solo se
 * exponen resultados firmados: nada preliminar llega al paciente.
 *
 * Usa el cliente admin (service role) porque el portal es anónimo respecto a
 * RLS; el filtrado por identidad lo garantiza `pids`, derivado de la sesión
 * firmada del paciente.
 */
export async function getPortalOrders(
  admin: DB,
  pids: string[]
): Promise<PortalOrderCard[]> {
  if (pids.length === 0) return [];

  const { data: orders } = await admin
    .from("LIS_orders")
    .select(
      "id, codigo, created_at, medico_solicitante, organizations:LIS_organizations(nombre), sedes:LIS_sedes(nombre)"
    )
    .in("patient_id", pids)
    .neq("status", "anulada")
    .order("created_at", { ascending: false });

  if (!orders || orders.length === 0) return [];
  const orderIds = orders.map((o) => o.id);

  // Ítems vivos de esas órdenes -> para mapear resultado a orden.
  const { data: items } = await admin
    .from("LIS_order_items")
    .select("id, order_id")
    .in("order_id", orderIds)
    .neq("status", "anulado");

  const itemToOrder = new Map<string, string>();
  for (const it of items ?? []) itemToOrder.set(it.id, it.order_id);
  const itemIds = [...itemToOrder.keys()];

  let results: { order_item_id: string; flag: ResultFlag | null; validado_at: string | null }[] = [];
  if (itemIds.length) {
    const { data } = await admin
      .from("LIS_results")
      .select("order_item_id, flag, validado_at")
      .in("order_item_id", itemIds)
      .eq("status", "validado");
    results = data ?? [];
  }

  type Agg = { estudios: Set<string>; anormales: number; critico: boolean; validadoAt: string | null };
  const byOrder = new Map<string, Agg>();

  for (const r of results) {
    const orderId = itemToOrder.get(r.order_item_id);
    if (!orderId) continue;
    const agg =
      byOrder.get(orderId) ??
      { estudios: new Set<string>(), anormales: 0, critico: false, validadoAt: null };
    agg.estudios.add(r.order_item_id);
    if (r.flag && r.flag !== "normal") agg.anormales += 1;
    if (r.flag && CRITICAL_FLAGS.includes(r.flag)) agg.critico = true;
    if (r.validado_at && (!agg.validadoAt || r.validado_at > agg.validadoAt)) {
      agg.validadoAt = r.validado_at;
    }
    byOrder.set(orderId, agg);
  }

  return orders
    .filter((o) => byOrder.has(o.id))
    .map((o) => {
      const agg = byOrder.get(o.id)!;
      return {
        id: o.id,
        codigo: o.codigo,
        fecha: o.created_at,
        organizacion: (o.organizations as unknown as { nombre: string } | null)?.nombre ?? "",
        sede: (o.sedes as unknown as { nombre: string } | null)?.nombre ?? "",
        medico: o.medico_solicitante,
        estudios: agg.estudios.size,
        anormales: agg.anormales,
        critico: agg.critico,
        validadoAt: agg.validadoAt,
      };
    });
}

/** Confirma que una orden pertenece a la identidad del portal. */
export async function orderBelongsToPortal(
  admin: DB,
  orderId: string,
  pids: string[]
): Promise<boolean> {
  if (pids.length === 0) return false;
  const { data } = await admin
    .from("LIS_orders")
    .select("id")
    .eq("id", orderId)
    .in("patient_id", pids)
    .maybeSingle();
  return !!data;
}
