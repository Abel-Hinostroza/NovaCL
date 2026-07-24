"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Anulación con motivo (soft-delete). La historia clínica no se borra: el
 * registro queda marcado como anulado con la razón, auditable.
 */
export function AnnulButton({
  onAnnul,
  label = "Anular",
}: {
  onAnnul: (motivo: string) => Promise<{ ok: boolean; error?: string }>;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [pending, start] = useTransition();

  function confirm() {
    start(async () => {
      const res = await onAnnul(motivo);
      if (res.ok) {
        toast.success("Registro anulado");
        setOpen(false);
        setMotivo("");
        router.refresh();
      } else {
        toast.error(res.error ?? "No se pudo anular.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive"
          title={label}
        >
          <Ban className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Anular registro</DialogTitle>
          <DialogDescription>
            El registro no se elimina: queda marcado como anulado con el motivo, para
            trazabilidad. Esta acción es auditable.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="annul-motivo">Motivo</Label>
          <Textarea
            id="annul-motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej. registro duplicado, dato corregido en otra entrada…"
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            onClick={confirm}
            disabled={pending || motivo.trim().length < 4}
          >
            {pending ? "Anulando…" : "Confirmar anulación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
