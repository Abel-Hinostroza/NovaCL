import { getSessionContext, hasRole } from "@/lib/auth/session";
import { requireModuleAccess } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { ItemDialog } from "@/components/inventory/item-dialog";
import { InventoryClient, type InventoryRow } from "@/components/inventory/inventory-client";

export const metadata = { title: "Inventario" };

function estadoDe(stock: number, minimo: number): "ok" | "bajo" | "agotado" {
  if (stock <= 0) return "agotado";
  if (stock <= minimo) return "bajo";
  return "ok";
}

export default async function InventarioPage() {
  const ctx = await getSessionContext();
  await requireModuleAccess("inventario");
  const supabase = await createClient();
  const orgId = ctx.activeOrgId!;
  const sedeId = ctx.activeSedeId;

  const [{ data: items }, { data: stock }] = await Promise.all([
    supabase
      .from("LIS_inventory_items")
      .select("*")
      .eq("organization_id", orgId)
      .eq("activo", true)
      .order("nombre"),
    sedeId
      ? supabase
          .from("LIS_inventory_stock")
          .select("item_id, cantidad, vencimiento")
          .eq("sede_id", sedeId)
      : Promise.resolve({ data: [] as { item_id: string; cantidad: number; vencimiento: string | null }[] }),
  ]);

  // Agregar existencia por artículo en la sede activa
  const stockMap = new Map<string, { total: number; prox: string | null }>();
  for (const s of stock ?? []) {
    const cur = stockMap.get(s.item_id) ?? { total: 0, prox: null };
    cur.total += Number(s.cantidad);
    if (s.cantidad > 0 && s.vencimiento) {
      cur.prox = !cur.prox || s.vencimiento < cur.prox ? s.vencimiento : cur.prox;
    }
    stockMap.set(s.item_id, cur);
  }

  const rows: InventoryRow[] = (items ?? []).map((it) => {
    const agg = stockMap.get(it.id) ?? { total: 0, prox: null };
    return {
      ...it,
      stock: agg.total,
      estado: estadoDe(agg.total, Number(it.stock_minimo)),
      proximo_vencimiento: agg.prox,
    };
  });

  const isSuper = ctx.profile?.es_superadmin ?? false;
  const canManage = hasRole(ctx.roles, ["org_admin", "sede_admin"]) || isSuper;
  const canOperate =
    hasRole(ctx.roles, ["org_admin", "sede_admin", "analista", "toma_muestra", "recepcion"]) ||
    isSuper;
  const sedeNombre =
    ctx.sedes.find((s) => s.id === sedeId)?.nombre ?? "la sede activa";

  return (
    <>
      <PageHeader
        title="Inventario"
        description="Insumos y reactivos por sede, con lotes, vencimientos y trazabilidad de movimientos."
      >
        {canManage && <ItemDialog orgId={orgId} />}
      </PageHeader>

      <InventoryClient
        rows={rows}
        orgId={orgId}
        sedes={ctx.sedes}
        activeSedeId={sedeId}
        sedeNombre={sedeNombre}
        canManage={canManage}
        canOperate={canOperate}
      />
    </>
  );
}
