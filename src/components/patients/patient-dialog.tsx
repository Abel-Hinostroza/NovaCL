"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PatientForm } from "./patient-form";
import type { Tables } from "@/lib/database.types";

export function PatientDialog({
  patient,
  trigger,
}: {
  patient?: Tables<"LIS_patients">;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <UserPlus className="h-4 w-4" /> Nuevo paciente
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{patient ? "Editar paciente" : "Registrar paciente"}</DialogTitle>
          <DialogDescription>
            Los pacientes se comparten entre todas las sedes de la organización.
          </DialogDescription>
        </DialogHeader>
        <PatientForm patient={patient} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
