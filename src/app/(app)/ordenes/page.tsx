import Link from "next/link";
import { ClipboardList, ArrowRight } from "lucide-react";
import { getSessionContext } from "@/lib/auth/session";
import { requireModuleAccess } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { SearchInput } from "@/components/search-input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OrderStatusBadge, PriorityBadge } from "@/components/status-badge";
import { StatusFilter } from "@/components/orders/status-filter";
import { formatDate, formatMoney } from "@/lib/utils";
import type { OrderStatus } from "@/lib/database.types";

export const metadata = { title: "Órdenes" };

/**
 * Acción del paso vigente de la orden, misma lógica que el stepper del detalle.
 * Un item deja 'pendiente' al generarse su muestra, así que
 * conMuestra = items_total − items_pendientes.
 */
function nextAction(o: {
  id: string;
  status: OrderStatus;
  items_total: number;
  items_pendientes: number;
  items_validados: number;
}): { label: string; href: string; primary: boolean } | null {
  if (o.status === "anulada") return null;
  if (o.status === "entregada") return { label: "Reporte", href: `/reportes/${o.id}`, primary: false };
  const total = o.items_total ?? 0;
  if (total === 0) return { label: "Ver orden", href: `/ordenes/${o.id}`, primary: false };
  const conMuestra = total - (o.items_pendientes ?? 0);
  const validados = o.items_validados ?? 0;
  if (o.status === "completada" || validados === total)
    return { label: "Ir a Entrega", href: "/entrega", primary: true };
  if (conMuestra < total)
    return { label: "Generar muestra", href: `/ordenes/${o.id}?tab=muestras`, primary: true };
  return { label: "Ingresar resultados", href: `/resultados/${o.id}?from=list`, primary: true };
}

export default async function OrdenesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;
  const ctx = await getSessionContext();
  await requireModuleAccess("ordenes");
  const supabase = await createClient();

  let query = supabase
    .from("v_order_overview")
    .select("*")
    .eq("organization_id", ctx.activeOrgId!)
    .order("created_at", { ascending: false })
    .limit(60);

  if (ctx.activeSedeId) query = query.eq("sede_id", ctx.activeSedeId);
  if (status && status !== "todas") query = query.eq("status", status as OrderStatus);
  if (q) query = query.or(`codigo.ilike.%${q}%,paciente.ilike.%${q}%`);

  const { data: orders } = await query;

  return (
    <>
      <PageHeader title="Órdenes / Atenciones" description="Gestión de atenciones de la sede.">
        <Button asChild>
          <Link href="/ordenes/nueva">
            <ClipboardList className="h-4 w-4" /> Nueva atención
          </Link>
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput placeholder="Buscar por código o paciente..." />
        <StatusFilter />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Progreso</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders && orders.length > 0 ? (
                orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Link href={`/ordenes/${o.id}`} className="font-medium text-primary hover:underline">
                        {o.codigo}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{o.paciente}</span>
                        <PriorityBadge priority={o.prioridad} />
                      </div>
                      <p className="text-xs text-muted-foreground">{o.numero_documento}</p>
                    </TableCell>
                    <TableCell>
                      <OrderStatusBadge status={o.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full bg-brand-gradient transition-all duration-500"
                            style={{
                              width: `${
                                o.items_total ? (o.items_validados / o.items_total) * 100 : 0
                              }%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {o.items_validados}/{o.items_total}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{formatMoney(o.total, o.moneda)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(o.created_at, true)}
                    </TableCell>
                    <TableCell className="text-right">
                      {(() => {
                        const action = nextAction(o);
                        if (!action) return <span className="text-xs text-muted-foreground">—</span>;
                        return (
                          <Button asChild size="sm" variant={action.primary ? "default" : "ghost"}>
                            <Link href={action.href as never}>
                              {action.label}
                              {action.primary && <ArrowRight className="h-4 w-4" />}
                            </Link>
                          </Button>
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    No hay órdenes que coincidan.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
