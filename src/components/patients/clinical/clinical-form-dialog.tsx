"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ActionResult } from "@/lib/actions/clinical";

type ClinicalAction = (
  prev: ActionResult | undefined,
  formData: FormData
) => Promise<ActionResult>;

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Guardando…" : label}
    </Button>
  );
}

/**
 * Diálogo + formulario genérico para las entidades de historia clínica.
 * Cierra y refresca al guardar; muestra el error de la acción si falla.
 */
export function ClinicalFormDialog({
  title,
  description,
  trigger,
  action,
  patientId,
  children,
  submitLabel = "Guardar",
  className,
}: {
  title: string;
  description?: string;
  trigger: React.ReactNode;
  action: ClinicalAction;
  patientId: string;
  children: React.ReactNode;
  submitLabel?: string;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(action, undefined);

  useEffect(() => {
    if (state?.ok) {
      toast.success("Registro guardado");
      setOpen(false);
      router.refresh();
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className={className ?? "max-w-lg"}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="patient_id" value={patientId} />
          {children}
          {state?.error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <SubmitButton label={submitLabel} />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
