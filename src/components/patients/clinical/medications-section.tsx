"use client";

import { Plus, Pill } from "lucide-react";
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
import { ProfSelect, type ProfLite } from "./prof-select";
import { AnnulButton } from "./annul-button";
import { saveMedicationAction, annulClinicalRecordAction } from "@/lib/actions/clinical";
import type { Tables } from "@/lib/database.types";

const VIA_LABEL: Record<string, string> = {
  oral: "Oral",
  intravenosa: "IV",
  intramuscular: "IM",
  subcutanea: "SC",
  topica: "Tópica",
  inhalatoria: "Inhalatoria",
  oftalmica: "Oftálmica",
  otica: "Ótica",
  rectal: "Rectal",
  otra: "Otra",
};
const STATUS_LABEL: Record<string, string> = {
  activo: "Activo",
  suspendido: "Suspendido",
  finalizado: "Finalizado",
};
const STATUS_STYLE: Record<string, string> = {
  activo: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  suspendido: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  finalizado: "bg-muted text-muted-foreground",
};
const NONE = "__none__";

function MedicationForm({ professionals }: { professionals: ProfLite[] }) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="farmaco">Fármaco</Label>
        <Input id="farmaco" name="farmaco" required placeholder="Ej. Metformina" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="dosis">Dosis</Label>
          <Input id="dosis" name="dosis" placeholder="500 mg" />
        </div>
        <div className="space-y-2">
          <Label>Vía</Label>
          <Select name="via" defaultValue={NONE}>
            <SelectTrigger>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>—</SelectItem>
              {Object.entries(VIA_LABEL).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="frecuencia">Frecuencia</Label>
          <Input id="frecuencia" name="frecuencia" placeholder="c/8 h" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
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
        <div className="space-y-2">
          <Label htmlFor="indicado_por">Indicado por</Label>
          <Input id="indicado_por" name="indicado_por" placeholder="Prescriptor" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fecha_inicio">Inicio</Label>
          <Input id="fecha_inicio" name="fecha_inicio" type="date" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fecha_fin">Fin</Label>
          <Input id="fecha_fin" name="fecha_fin" type="date" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="med-notas">Notas</Label>
        <Textarea id="med-notas" name="notas" />
      </div>
      <ProfSelect professionals={professionals} />
    </div>
  );
}

export function MedicationsSection({
  patientId,
  items,
  professionals,
}: {
  patientId: string;
  items: Tables<"LIS_medications">[];
  professionals: ProfLite[];
}) {
  const activos = items.filter((i) => !i.anulado);
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Pill className="h-4 w-4" /> Medicación
        </CardTitle>
        <ClinicalFormDialog
          title="Nueva medicación"
          description="Medicación habitual o en curso del paciente."
          action={saveMedicationAction}
          patientId={patientId}
          trigger={
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4" /> Agregar
            </Button>
          }
        >
          <MedicationForm professionals={professionals} />
        </ClinicalFormDialog>
      </CardHeader>
      <CardContent className="space-y-3">
        {activos.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Sin medicación registrada.
          </p>
        ) : (
          activos.map((m) => (
            <div
              key={m.id}
              className="flex items-start justify-between gap-3 rounded-lg border p-3"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{m.farmaco}</span>
                  <Badge className={STATUS_STYLE[m.status]}>{STATUS_LABEL[m.status]}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {[m.dosis, m.via ? VIA_LABEL[m.via] : null, m.frecuencia]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                  {m.indicado_por ? ` · Indicado por ${m.indicado_por}` : ""}
                </p>
                {m.notas && <p className="text-sm text-muted-foreground">{m.notas}</p>}
              </div>
              <AnnulButton
                onAnnul={(mo) => annulClinicalRecordAction("LIS_medications", m.id, mo, patientId)}
              />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
