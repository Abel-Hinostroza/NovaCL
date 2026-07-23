import Link from "next/link";
import { ClipboardList, TestTube2, FlaskConical, Send, Check, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OrderStatus, ItemStatus } from "@/lib/database.types";

type StepState = "done" | "current" | "pending";

/**
 * Stepper de progreso de la orden: Registro → Muestras → Resultados → Entrega.
 * Marca cada etapa (hecha/actual/pendiente) según el avance real y ofrece el
 * atajo de la etapa vigente. Es una guía: no reemplaza las rutas ya existentes
 * (p. ej. "Ingresar resultados" del tab Estudios sigue disponible siempre).
 *
 * El avance se deriva de los estados de los items (sin consultas extra):
 *  · un item deja 'pendiente' al generarse su muestra (→ etapa Muestras),
 *  · 'validado' cuando se firma su resultado (→ etapa Resultados),
 *  · la orden pasa a 'entregada' al enviar (→ etapa Entrega).
 */
export function OrderStepper({
  orderId,
  status,
  items,
}: {
  orderId: string;
  status: OrderStatus;
  items: { status: ItemStatus }[];
}) {
  if (status === "anulada") {
    return (
      <div className="mb-6 rounded-lg border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
        Orden anulada — el flujo de atención está detenido.
      </div>
    );
  }

  const active = items.filter((i) => i.status !== "anulado");
  const total = active.length;
  const conMuestra = active.filter((i) => i.status !== "pendiente").length;
  const validados = active.filter((i) => i.status === "validado").length;

  const done = {
    registro: true,
    muestras: total > 0 && conMuestra === total,
    resultados: total > 0 && validados === total,
    entrega: status === "entregada",
  };

  const defs: {
    key: keyof typeof done;
    label: string;
    icon: LucideIcon;
    doneLabel: string;
    todoLabel: string;
    href: string;
  }[] = [
    { key: "registro", label: "Registro", icon: ClipboardList, doneLabel: "Ver estudios", todoLabel: "Ver estudios", href: `/ordenes/${orderId}?tab=estudios` },
    { key: "muestras", label: "Muestras", icon: TestTube2, doneLabel: "Ver muestras", todoLabel: "Generar muestra", href: `/ordenes/${orderId}?tab=muestras` },
    { key: "resultados", label: "Resultados", icon: FlaskConical, doneLabel: "Ver resultados", todoLabel: "Ingresar resultados", href: `/resultados/${orderId}` },
    { key: "entrega", label: "Entrega", icon: Send, doneLabel: "Ver entrega", todoLabel: "Ir a Entrega", href: "/entrega" },
  ];

  // La etapa "actual" es la primera no completada; el resto quedan pendientes.
  const currentIndex = defs.findIndex((d) => !done[d.key]);

  return (
    <div className="mb-6 grid grid-cols-1 gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
      {defs.map((d, i) => {
        const state: StepState = done[d.key] ? "done" : i === currentIndex ? "current" : "pending";
        const Icon = d.icon;
        return (
          <div key={d.key} className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2",
                state === "done" && "border-primary bg-primary text-primary-foreground",
                state === "current" && "border-primary text-primary",
                state === "pending" && "border-muted text-muted-foreground"
              )}
            >
              {state === "done" ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
            </div>
            <div className="min-w-0">
              <p className={cn("text-sm font-medium", state === "pending" && "text-muted-foreground")}>
                {d.label}
              </p>
              {state === "pending" ? (
                <p className="mt-0.5 text-xs text-muted-foreground">Pendiente</p>
              ) : (
                <Button
                  asChild
                  size="sm"
                  variant={state === "current" ? "default" : "ghost"}
                  className="mt-0.5 h-7 px-2"
                >
                  <Link href={d.href as never}>{state === "done" ? d.doneLabel : d.todoLabel}</Link>
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
