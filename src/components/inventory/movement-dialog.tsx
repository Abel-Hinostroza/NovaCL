"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ArrowLeftRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { registerMovementAction } from "@/lib/actions/inventory";
import { INVENTORY_MOVEMENT_LABELS } from "@/lib/constants";
import type { InventoryMovementType } from "@/lib/database.types";

export function MovementDialog({
  itemId,
  itemNombre,
  unidad,
  sedes,
  activeSedeId,
  trigger,
}: {
  itemId: string;
  itemNombre: string;
  unidad: string;
  sedes: { id: string; nombre: string; codigo: string }[];
  activeSedeId: string | null;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [tipo, setTipo] = useState<InventoryMovementType>("entrada");
  const [cantidad, setCantidad] = useState<number>(0);
  const [lote, setLote] = useState("");
  const [vencimiento, setVencimiento] = useState("");
  const [motivo, setMotivo] = useState("");
  const [sedeDestino, setSedeDestino] = useState("");

  const requiereLote = tipo === "entrada";
  const esTransferencia = tipo === "transferencia";
  const otrasSedes = sedes.filter((s) => s.id !== activeSedeId);

  function registrar() {
    startTransition(async () => {
      const res = await registerMovementAction({
        itemId,
        tipo,
        cantidad: Number(cantidad) || 0,
        lote: lote || undefined,
        vencimiento: vencimiento || undefined,
        motivo: motivo || undefined,
        sedeDestinoId: esTransferencia ? sedeDestino || undefined : undefined,
      });
      if (res.ok) {
        toast.success("Movimiento registrado.");
        setOpen(false);
        setCantidad(0);
        setLote("");
        setVencimiento("");
        setMotivo("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline">
            <ArrowLeftRight className="h-4 w-4" /> Movimiento
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar movimiento</DialogTitle>
          <DialogDescription>{itemNombre}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo de movimiento</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as InventoryMovementType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(INVENTORY_MOVEMENT_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                {tipo === "ajuste" ? "Cantidad contada (absoluta)" : "Cantidad"} ({unidad})
              </Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={cantidad}
                onChange={(e) => setCantidad(Number(e.target.value))}
              />
            </div>
          </div>

          {esTransferencia && (
            <div className="space-y-2">
              <Label>Sede destino</Label>
              <Select value={sedeDestino} onValueChange={setSedeDestino}>
                <SelectTrigger>
                  <SelectValue placeholder="Elige la sede destino" />
                </SelectTrigger>
                <SelectContent>
                  {otrasSedes.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.codigo} · {s.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Lote {requiereLote ? "" : "(opcional)"}</Label>
              <Input value={lote} onChange={(e) => setLote(e.target.value)} placeholder="L-2026-045" />
            </div>
            <div className="space-y-2">
              <Label>Vencimiento {requiereLote ? "" : "(opcional)"}</Label>
              <Input type="date" value={vencimiento} onChange={(e) => setVencimiento(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Motivo / observación</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={
                tipo === "salida"
                  ? "Consumo en procesamiento de muestras…"
                  : tipo === "merma"
                    ? "Vencido / dañado…"
                    : "Compra, orden, proveedor…"
              }
            />
          </div>
          <p className="text-xs text-muted-foreground">
            El movimiento afecta la existencia de la <strong>sede activa</strong>. Las salidas,
            mermas y transferencias no pueden dejar el stock en negativo.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={registrar} disabled={pending || cantidad < 0}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
