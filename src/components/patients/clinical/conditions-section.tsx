"use client";

import { Plus, Stethoscope } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClinicalFormDialog } from "./clinical-form-dialog";
import { Cie10Combobox } from "./cie10-combobox";
import { ProfSelect, type ProfLite } from "./prof-select";
import { AnnulButton } from "./annul-button";
import { saveConditionAction, annulClinicalRecordAction } from "@/lib/actions/clinical";
import { formatDate } from "@/lib/utils";
import type { Tables } from "@/lib/database.types";

const KIND_LABEL: Record<string, string> = {
  personal: "Personal patológico",
  familiar: "Familiar",
  quirurgico: "Quirúrgico",
  congenito: "Congénito",
  no_patologico: "No patológico",
  otro: "Otro",
};
const STATUS_LABEL: Record<string, string> = {
  activo: "Activo",
  cronico: "Crónico",
  resuelto: "Resuelto",
};
const STATUS_STYLE: Record<string, string> = {
  activo: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  cronico: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  resuelto: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
};

function ConditionForm({ professionals }: { professionals: ProfLite[] }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select name="kind" defaultValue="personal">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(KIND_LABEL).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Estado</Label>
          <Select name="status" defaultValue="activo">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_LABEL).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Cie10Combobox />

      <div className="space-y-2">
        <Label htmlFor="descripcion">Diagnóstico / descripción</Label>
        <Textarea id="descripcion" name="descripcion" required placeholder="Glosa clínica" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fecha_inicio">Fecha de inicio</Label>
          <Input id="fecha_inicio" name="fecha_inicio" type="date" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fecha_resolucion">Fecha de resolución</Label>
          <Input id="fecha_resolucion" name="fecha_resolucion" type="date" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="parentesco">Parentesco (si es familiar)</Label>
        <Input id="parentesco" name="parentesco" placeholder="Ej. madre, padre, hermano…" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="cond-notas">Notas</Label>
        <Textarea id="cond-notas" name="notas" />
      </div>

      <ProfSelect professionals={professionals} />
    </div>
  );
}

export function ConditionsSection({
  patientId,
  items,
  professionals,
}: {
  patientId: string;
  items: Tables<"LIS_clinical_conditions">[];
  professionals: ProfLite[];
}) {
  const activos = items.filter((i) => !i.anulado);
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Stethoscope className="h-4 w-4" /> Antecedentes y problemas
        </CardTitle>
        <ClinicalFormDialog
          title="Nuevo antecedente"
          description="Antecedente personal, familiar o quirúrgico. Puedes codificarlo con CIE-10."
          action={saveConditionAction}
          patientId={patientId}
          trigger={
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4" /> Agregar
            </Button>
          }
        >
          <ConditionForm professionals={professionals} />
        </ClinicalFormDialog>
      </CardHeader>
      <CardContent className="space-y-3">
        {activos.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Sin antecedentes registrados.
          </p>
        ) : (
          activos.map((c) => (
            <div
              key={c.id}
              className="flex items-start justify-between gap-3 rounded-lg border p-3"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{c.descripcion}</span>
                  {c.cie10_codigo && (
                    <span className="font-mono text-xs text-primary">{c.cie10_codigo}</span>
                  )}
                  <Badge className={STATUS_STYLE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {KIND_LABEL[c.kind]}
                  {c.parentesco ? ` · ${c.parentesco}` : ""}
                  {c.fecha_inicio ? ` · desde ${formatDate(c.fecha_inicio)}` : ""}
                </p>
                {c.notas && <p className="text-sm text-muted-foreground">{c.notas}</p>}
              </div>
              <AnnulButton
                onAnnul={(m) =>
                  annulClinicalRecordAction("LIS_clinical_conditions", c.id, m, patientId)
                }
              />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
