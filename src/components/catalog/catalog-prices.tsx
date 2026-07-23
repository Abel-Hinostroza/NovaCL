"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Tag, Loader2, Copy } from "lucide-react";
import {
  setStudyPriceAction,
  replicateStudyPriceAction,
} from "@/lib/actions/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatMoney } from "@/lib/utils";

export type SedePriceRow = { sedeId: string; nombre: string; precio: number | null };

/**
 * Editor de precios por sede de un estudio. Cada sede se guarda de forma
 * independiente. El precio base (org) solo lo edita un org_admin sobre estudios
 * propios; el org_admin además puede replicar un precio a todas las sedes.
 * El sede_admin ve únicamente su(s) sede(s).
 */
export function StudyPricesDialog({
  study,
  basePrice,
  canEditBase,
  isOrgAdmin,
  sedePrices,
}: {
  study: { id: string; codigo: string; nombre: string; esGlobal: boolean };
  basePrice: number;
  canEditBase: boolean;
  isOrgAdmin: boolean;
  sedePrices: SedePriceRow[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, start] = useTransition();

  // Estado local editable, indexado por clave ("base" | sedeId).
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = { base: String(basePrice) };
    for (const s of sedePrices) init[s.sedeId] = s.precio != null ? String(s.precio) : "";
    return init;
  });
  const [replicate, setReplicate] = useState("");

  function run(fn: () => Promise<{ ok?: boolean; error?: string }>) {
    start(async () => {
      const r = await fn();
      if (r?.error) toast.error(r.error);
      else {
        toast.success("Precio actualizado");
        router.refresh();
      }
    });
  }

  function saveOne(sedeId: string | null) {
    const key = sedeId ?? "base";
    const precio = Number(values[key]);
    if (!Number.isFinite(precio) || precio < 0) {
      toast.error("Precio inválido");
      return;
    }
    run(() => setStudyPriceAction(study.id, sedeId, precio));
  }

  function doReplicate() {
    const precio = Number(replicate);
    if (!Number.isFinite(precio) || precio < 0) {
      toast.error("Precio inválido");
      return;
    }
    run(() => replicateStudyPriceAction(study.id, precio));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Precios por sede">
          <Tag className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Precios · {study.nombre}</DialogTitle>
          <DialogDescription>
            Cada sede tiene su propio precio. Si una sede no define precio, se usa el precio base.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Precio base (org) */}
          <div className="rounded-lg border bg-muted/30 p-3">
            <Label className="text-xs font-medium text-muted-foreground">
              Precio base {study.esGlobal ? "(plantilla global)" : "(organización)"}
            </Label>
            {canEditBase ? (
              <div className="mt-2 flex items-center gap-2">
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={values.base ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, base: e.target.value }))}
                  className="w-40"
                />
                <Button size="sm" onClick={() => saveOne(null)} disabled={pending}>
                  Guardar
                </Button>
              </div>
            ) : (
              <p className="mt-1 text-sm">
                {formatMoney(basePrice)}
                <span className="ml-2 text-xs text-muted-foreground">
                  {study.esGlobal
                    ? "· solo lectura; fija un precio por sede"
                    : "· solo el administrador de organización lo edita"}
                </span>
              </p>
            )}
          </div>

          {/* Precios por sede */}
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Precio por sede
            </Label>
            {sedePrices.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay sedes bajo tu administración.
              </p>
            ) : (
              <div className="space-y-2">
                {sedePrices.map((s) => (
                  <div key={s.sedeId} className="flex items-center gap-2">
                    <span className="flex-1 truncate text-sm">{s.nombre}</span>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      placeholder={`base: ${basePrice}`}
                      value={values[s.sedeId] ?? ""}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [s.sedeId]: e.target.value }))
                      }
                      className="w-36"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => saveOne(s.sedeId)}
                      disabled={pending}
                    >
                      Guardar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Replicar a todas las sedes (solo org_admin) */}
          {isOrgAdmin && sedePrices.length > 1 && (
            <div className="rounded-lg border border-dashed p-3">
              <Label className="text-xs font-medium text-muted-foreground">
                Replicar un precio a todas las sedes
              </Label>
              <div className="mt-2 flex items-center gap-2">
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  placeholder="Precio"
                  value={replicate}
                  onChange={(e) => setReplicate(e.target.value)}
                  className="w-40"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={doReplicate}
                  disabled={pending || replicate === ""}
                >
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  Replicar
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
