"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { TestTube2, Plus, Loader2, PackageCheck, FlaskConical, ArrowRight, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createSampleAction } from "@/lib/actions/orders";
import { SampleRowActions } from "@/components/orders/sample-row-actions";
import { hasRole } from "@/lib/auth/roles";
import { cn, formatDate } from "@/lib/utils";
import type { ItemStatus, Role, SampleStatus } from "@/lib/database.types";

type Item = { id: string; nombre: string; status: ItemStatus };
type Sample = {
  id: string;
  barcode: string;
  status: SampleStatus;
  statusLabel: string;
  tipo: string;
  tomada_at: string | null;
};

export function SamplesPanel({
  orderId,
  items,
  samples,
  roles,
}: {
  orderId: string;
  items: Item[];
  samples: Sample[];
  roles: Role[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();

  const canTake = hasRole(roles, ["org_admin", "sede_admin", "recepcion", "toma_muestra", "analista"]);
  // Solo se ofrecen estudios sin muestra viva (un item deja 'pendiente' al
  // generarse su muestra). Evita duplicar el espécimen del mismo estudio.
  const pendientes = items.filter((i) => i.status === "pendiente");

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function createSample() {
    if (selected.size === 0) return toast.error("Selecciona estudios para la muestra");
    start(async () => {
      const r = await createSampleAction(orderId, [...selected]);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Muestra registrada");
        setSelected(new Set());
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {canTake && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TestTube2 className="h-4 w-4 text-primary" /> Registrar toma de muestra
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendientes.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Selecciona los estudios que cubre esta muestra.
                </p>
                <div className="space-y-2">
                  {pendientes.map((it) => (
                    <button
                      key={it.id}
                      onClick={() => toggle(it.id)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm",
                        selected.has(it.id) ? "border-primary bg-primary/5" : "hover:bg-accent"
                      )}
                    >
                      {it.nombre}
                      <span
                        className={cn(
                          "h-4 w-4 rounded-full border",
                          selected.has(it.id) && "border-primary bg-primary"
                        )}
                      />
                    </button>
                  ))}
                </div>
                <Button onClick={createSample} disabled={pending} className="w-full">
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Generar muestra
                </Button>
              </>
            ) : (
              <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-sm">
                <p className="font-medium">Todos los estudios ya tienen muestra tomada.</p>
                <p className="mt-1 text-muted-foreground">
                  No hace falta generar más. Si una muestra resultó inadecuada (hemólisis,
                  volumen insuficiente, mal rotulada), recházala desde el worklist de{" "}
                  <span className="font-medium">Muestras</span> y el estudio quedará
                  disponible para volver a tomarla.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className={cn(!canTake && "lg:col-span-2")}>
        <CardHeader>
          <CardTitle className="text-base">Muestras de la orden</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {samples.length === 0 && (
            <p className="text-sm text-muted-foreground">Aún no se han tomado muestras.</p>
          )}
          {samples.map((s) => (
            <div key={s.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono text-sm">
                  <PackageCheck className="h-4 w-4 text-muted-foreground" />
                  {s.barcode}
                </div>
                <div className="flex items-center gap-2">
                  <Button asChild variant="ghost" size="sm" className="h-7 px-2" title="Imprimir etiqueta del tubo">
                    <Link href={`/etiquetas/muestra/${s.id}`} target="_blank">
                      <Tag className="h-3.5 w-3.5" /> Etiqueta
                    </Link>
                  </Button>
                  <Badge className="bg-muted text-foreground">{s.statusLabel}</Badge>
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {s.tipo} · {formatDate(s.tomada_at, true)}
              </p>
              {canTake && (
                <div className="mt-2">
                  <SampleRowActions sampleId={s.id} status={s.status} />
                </div>
              )}
            </div>
          ))}

          {/* Siguiente paso del flujo: con la muestra tomada, ya se pueden
              ingresar resultados. Enlace opcional (no fuerza el salto). */}
          {samples.length > 0 && (
            <div className="flex justify-end border-t pt-3">
              <Button asChild size="sm" variant="outline">
                <Link href={`/resultados/${orderId}`}>
                  <FlaskConical className="h-4 w-4" /> Ir a Resultados <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
