"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteCategoryAction,
  deleteAnalyteAction,
  deleteStudyAction,
  adoptStudyAction,
} from "@/lib/actions/catalog";

type Result = { ok?: boolean; error?: string };

const KINDS = {
  category: { action: deleteCategoryAction, label: "categoría" },
  analyte: { action: deleteAnalyteAction, label: "analito" },
  study: { action: deleteStudyAction, label: "estudio" },
} as const;

/** Botón de baja lógica con confirmación, para categorías, analitos y estudios propios. */
export function DeleteCatalogButton({
  kind,
  id,
  nombre,
}: {
  kind: keyof typeof KINDS;
  id: string;
  nombre: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const { action, label } = KINDS[kind];

  function confirm() {
    start(async () => {
      const r: Result = await action(id);
      if (r?.error) toast.error(r.error);
      else {
        toast.success(`${label[0].toUpperCase()}${label.slice(1)} eliminado`);
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        title="Eliminar"
        className="text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Eliminar {label}</DialogTitle>
          <DialogDescription>
            Se dará de baja <span className="font-medium">{nombre}</span>. Podrás volver a crearlo
            con el mismo código más adelante.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Adopta una plantilla global como estudio propio de la organización. */
export function AdoptStudyButton({ studyId }: { studyId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function adopt() {
    start(async () => {
      const r: Result = await adoptStudyAction(studyId);
      if (r?.error) toast.error(r.error);
      else {
        toast.success("Plantilla adoptada como estudio propio");
        router.refresh();
      }
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={adopt} disabled={pending} title="Crear una copia propia editable">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
      Adoptar
    </Button>
  );
}
