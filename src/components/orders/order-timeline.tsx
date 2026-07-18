import {
  ClipboardList,
  TestTube2,
  FlaskConical,
  Send,
  Receipt,
  Circle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { Tables } from "@/lib/database.types";

const ENTITY_META: Record<string, { label: string; icon: React.ElementType }> = {
  LIS_orders: { label: "Orden", icon: ClipboardList },
  LIS_order_items: { label: "Estudio", icon: FlaskConical },
  LIS_samples: { label: "Muestra", icon: TestTube2 },
  LIS_results: { label: "Resultado", icon: FlaskConical },
  LIS_result_deliveries: { label: "Entrega", icon: Send },
  LIS_invoices: { label: "Factura", icon: Receipt },
};

const ACTION_LABEL: Record<string, string> = {
  INSERT: "creado",
  UPDATE: "actualizado",
  DELETE: "eliminado",
};

function describe(ev: Tables<"LIS_audit_log">): string {
  const cambios = ev.cambios as Record<string, { de: unknown; a: unknown }> | null;
  if (cambios?.status) {
    return `Estado: ${cambios.status.de ?? "—"} → ${cambios.status.a}`;
  }
  const meta = ENTITY_META[ev.entidad];
  return `${meta?.label ?? ev.entidad} ${ACTION_LABEL[ev.accion] ?? ev.accion}`;
}

export function OrderTimeline({ events }: { events: Tables<"LIS_audit_log">[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Trazabilidad completa</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin eventos registrados.</p>
        ) : (
          <ol className="relative space-y-5 border-l pl-6">
            {events.map((ev) => {
              const meta = ENTITY_META[ev.entidad] ?? { label: ev.entidad, icon: Circle };
              const Icon = meta.icon;
              return (
                <li key={ev.id} className="relative">
                  <span className="absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full border bg-card text-primary">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-medium">{describe(ev)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(ev.created_at, true)}
                      {ev.actor_email && ` · ${ev.actor_email}`}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
