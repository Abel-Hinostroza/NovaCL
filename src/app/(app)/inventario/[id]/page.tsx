import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Snowflake,
  ShieldAlert,
  MapPin,
  TriangleAlert,
} from "lucide-react";
import { getSessionContext, hasRole } from "@/lib/auth/session";
import { requireModuleAccess } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ItemGallery } from "@/components/inventory/item-gallery";
import { ItemDialog } from "@/components/inventory/item-dialog";
import { MovementDialog } from "@/components/inventory/movement-dialog";
import {
  INVENTORY_TYPE_LABELS,
  INVENTORY_MOVEMENT_LABELS,
  INVENTORY_MOVEMENT_COLORS,
} from "@/lib/constants";
import { cn, formatDate } from "@/lib/utils";

export const metadata = { title: "Artículo de inventario" };

export default async function ItemDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const ctx = await getSessionContext();
  await requireModuleAccess("inventario");
  const supabase = await createClient();
  const orgId = ctx.activeOrgId!;

  const { data: item } = await supabase
    .from("LIS_inventory_items")
    .select("*")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!item) notFound();

  const [{ data: stock }, { data: movimientos }, { data: sedesData }] = await Promise.all([
    supabase
      .from("LIS_inventory_stock")
      .select("*, sedes:LIS_sedes(nombre, codigo)")
      .eq("item_id", id)
      .gt("cantidad", 0)
      .order("vencimiento", { ascending: true, nullsFirst: false }),
    supabase
      .from("LIS_inventory_movements")
      .select("*, sedes:LIS_sedes!LIS_inventory_movements_sede_id_fkey(nombre)")
      .eq("item_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("LIS_sedes")
      .select("id, nombre, codigo")
      .eq("organization_id", orgId)
      .eq("activo", true),
  ]);

  const isSuper = ctx.profile?.es_superadmin ?? false;
  const canManage = hasRole(ctx.roles, ["org_admin", "sede_admin"]) || isSuper;
  const canOperate =
    hasRole(ctx.roles, ["org_admin", "sede_admin", "analista", "toma_muestra", "recepcion"]) ||
    isSuper;

  const imagenes = (item.imagenes as string[] | null) ?? [];
  const totalStock = (stock ?? []).reduce((s, r) => s + Number(r.cantidad), 0);
  const estadoBajo = totalStock <= Number(item.stock_minimo);

  const hoy = new Date();
  const diasPara = (venc: string | null) =>
    venc ? Math.ceil((new Date(venc).getTime() - hoy.getTime()) / 86_400_000) : null;

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2">
        <Link href="/inventario">
          <ArrowLeft className="h-4 w-4" /> Inventario
        </Link>
      </Button>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{item.nombre}</h1>
            <Badge className="bg-muted text-foreground">{INVENTORY_TYPE_LABELS[item.tipo]}</Badge>
            {item.requiere_refrigeracion && (
              <Badge className="border-transparent bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                <Snowflake className="mr-1 h-3 w-3" /> Cadena de frío
              </Badge>
            )}
            {item.controlado && (
              <Badge className="border-transparent bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                <ShieldAlert className="mr-1 h-3 w-3" /> Controlado
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {item.codigo}
            {item.categoria ? ` · ${item.categoria}` : ""}
            {item.ubicacion ? ` · ${item.ubicacion}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canOperate && (
            <MovementDialog
              itemId={item.id}
              itemNombre={item.nombre}
              unidad={item.unidad}
              sedes={sedesData ?? []}
              activeSedeId={ctx.activeSedeId}
            />
          )}
          {canManage && <ItemDialog orgId={orgId} item={item} />}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <ItemGallery imagenes={imagenes} nombre={item.nombre} />
          <Card>
            <CardContent className="space-y-2 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Existencia total</span>
                <span className={cn("font-semibold", estadoBajo && "text-amber-600")}>
                  {totalStock} {item.unidad}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Stock mínimo</span>
                <span>{item.stock_minimo} {item.unidad}</span>
              </div>
              {item.proveedor && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Proveedor</span>
                  <span>{item.proveedor}</span>
                </div>
              )}
              {item.descripcion && (
                <p className="border-t pt-2 text-xs text-muted-foreground">{item.descripcion}</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Existencias por lote y sede */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Existencias por lote y sede</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {stock && stock.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sede</TableHead>
                      <TableHead>Lote</TableHead>
                      <TableHead>Vencimiento</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stock.map((s) => {
                      const dias = diasPara(s.vencimiento);
                      const alerta = dias !== null && dias <= 60;
                      const vencido = dias !== null && dias < 0;
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="text-sm">
                            <span className="flex items-center gap-1.5">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              {(s.sedes as unknown as { nombre: string } | null)?.nombre ?? "—"}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{s.lote || "—"}</TableCell>
                          <TableCell className="text-sm">
                            {s.vencimiento ? (
                              <span
                                className={cn(
                                  "flex items-center gap-1.5",
                                  vencido
                                    ? "font-medium text-red-600"
                                    : alerta
                                      ? "text-amber-600"
                                      : "text-muted-foreground"
                                )}
                              >
                                {alerta && <TriangleAlert className="h-3 w-3" />}
                                {formatDate(s.vencimiento)}
                                {dias !== null && (
                                  <span className="text-[11px]">
                                    ({vencido ? "vencido" : `${dias} d`})
                                  </span>
                                )}
                              </span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {s.cantidad} {item.unidad}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Sin existencias registradas. Registra una entrada para empezar.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Historial de movimientos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historial de movimientos</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {movimientos && movimientos.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Sede</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movimientos.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {formatDate(m.created_at, true)}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("border-transparent", INVENTORY_MOVEMENT_COLORS[m.tipo])}>
                            {INVENTORY_MOVEMENT_LABELS[m.tipo]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {(m.sedes as unknown as { nombre: string } | null)?.nombre ?? "—"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-medium",
                            m.delta >= 0 ? "text-emerald-600" : "text-red-600"
                          )}
                        >
                          {m.delta >= 0 ? "+" : ""}
                          {m.delta}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {m.stock_resultante}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                          {m.motivo || (m.lote ? `Lote ${m.lote}` : "—")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Sin movimientos registrados todavía.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
