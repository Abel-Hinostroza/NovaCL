import { requireRole } from "@/lib/auth/session";
import { requireModuleAccess } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Trazabilidad" };

const ENTITY_LABEL: Record<string, string> = {
  LIS_orders: "Orden",
  LIS_order_items: "Estudio",
  LIS_samples: "Muestra",
  LIS_sample_items: "Muestra–estudio",
  LIS_results: "Resultado",
  LIS_result_deliveries: "Entrega",
  LIS_invoices: "Factura",
  LIS_patients: "Paciente",
  LIS_appointments: "Cita",
  LIS_memberships: "Usuario/rol",
  LIS_professionals: "Profesional",
  LIS_role_permissions: "Permisos",
  LIS_critical_notifications: "Valor crítico",
  LIS_report_documents: "Informe",
  LIS_billing_integrations: "Integración de facturación",
  LIS_studies: "Catálogo · Estudio",
  LIS_study_analytes: "Catálogo · Estudio-analito",
  LIS_study_prices: "Catálogo · Precio",
  LIS_analytes: "Catálogo · Analito",
  LIS_reference_ranges: "Catálogo · Rango de referencia",
  LIS_test_categories: "Catálogo · Categoría",
  LIS_specimen_types: "Catálogo · Tipo de muestra",
  LIS_sedes: "Sede",
  LIS_organizations: "Organización",
  LIS_inventory_items: "Inventario · Artículo",
  LIS_inventory_movements: "Inventario · Movimiento",
};

const ACTION_LABEL: Record<string, string> = {
  INSERT: "Creación",
  UPDATE: "Modificación",
  DELETE: "Eliminación",
};

const ACTION_COLOR: Record<string, string> = {
  INSERT: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  UPDATE: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  DELETE: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

type SearchParams = Promise<{ sede?: string }>;

export default async function TrazabilidadPage(props: { searchParams: SearchParams }) {
  const { sede } = await props.searchParams;
  const ctx = await requireRole(["org_admin", "sede_admin", "lectura"]);
  await requireModuleAccess("trazabilidad");
  const supabase = await createClient();

  let query = supabase
    .from("LIS_audit_log")
    .select("*")
    .eq("organization_id", ctx.activeOrgId!)
    .order("created_at", { ascending: false })
    .limit(150);
  if (sede) query = query.eq("sede_id", sede);

  const { data: logs } = await query;

  // Mapa de sedes de la organización para mostrar el nombre (audit_log guarda solo el id)
  const sedeNombre = new Map(ctx.sedes.map((s) => [s.id, `${s.codigo} · ${s.nombre}`]));

  return (
    <>
      <PageHeader
        title="Trazabilidad"
        description="Registro de auditoría de la organización. Cada evento queda registrado con su autor y sede."
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Sede</TableHead>
                <TableHead>Entidad</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead>Cambios</TableHead>
                <TableHead>Autor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs && logs.length > 0 ? (
                logs.map((l) => {
                  const cambios = l.cambios as Record<string, { de: unknown; a: unknown }> | null;
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDate(l.created_at, true)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {l.sede_id ? (
                          sedeNombre.get(l.sede_id) ?? "—"
                        ) : (
                          <span className="text-muted-foreground">Toda la organización</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{ENTITY_LABEL[l.entidad] ?? l.entidad}</TableCell>
                      <TableCell>
                        <Badge className={ACTION_COLOR[l.accion] ?? ""}>
                          {ACTION_LABEL[l.accion] ?? l.accion}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs text-xs text-muted-foreground">
                        {cambios
                          ? Object.entries(cambios)
                              .slice(0, 3)
                              .map(([k, v]) => `${k}: ${String(v.de ?? "—")} → ${String(v.a ?? "—")}`)
                              .join(" · ")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{l.actor_email ?? "sistema"}</TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    Sin eventos de auditoría todavía.
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
