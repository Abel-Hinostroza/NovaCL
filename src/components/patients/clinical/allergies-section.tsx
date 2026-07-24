"use client";

import { Plus, ShieldAlert } from "lucide-react";
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
import { saveAllergyAction, annulClinicalRecordAction } from "@/lib/actions/clinical";
import type { Tables } from "@/lib/database.types";

const TIPO_LABEL: Record<string, string> = {
  farmaco: "Fármaco",
  alimento: "Alimento",
  ambiental: "Ambiental",
  otro: "Otro",
};
const SEV_LABEL: Record<string, string> = {
  leve: "Leve",
  moderada: "Moderada",
  grave: "Grave",
  anafilaxia: "Anafilaxia",
};
const SEV_STYLE: Record<string, string> = {
  leve: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  moderada: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  grave: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  anafilaxia: "bg-red-200 text-red-900 dark:bg-red-900 dark:text-red-100",
};
const NONE = "__none__";

function AllergyForm({ professionals }: { professionals: ProfLite[] }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select name="tipo" defaultValue="farmaco">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TIPO_LABEL).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Severidad</Label>
          <Select name="severidad" defaultValue={NONE}>
            <SelectTrigger>
              <SelectValue placeholder="No especificada" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>No especificada</SelectItem>
              {Object.entries(SEV_LABEL).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="agente">Agente causante</Label>
        <Input id="agente" name="agente" required placeholder="Ej. penicilina, látex, mariscos…" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reaccion">Reacción</Label>
        <Input id="reaccion" name="reaccion" placeholder="Ej. urticaria, angioedema, shock…" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="alg-notas">Notas</Label>
        <Textarea id="alg-notas" name="notas" />
      </div>

      <ProfSelect professionals={professionals} />
    </div>
  );
}

export function AllergiesSection({
  patientId,
  items,
  professionals,
}: {
  patientId: string;
  items: Tables<"LIS_allergies">[];
  professionals: ProfLite[];
}) {
  const activos = items.filter((i) => !i.anulado);
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="h-4 w-4" /> Alergias
        </CardTitle>
        <ClinicalFormDialog
          title="Nueva alergia"
          description="Dato de seguridad: se muestra destacado en el perfil del paciente."
          action={saveAllergyAction}
          patientId={patientId}
          trigger={
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4" /> Agregar
            </Button>
          }
        >
          <AllergyForm professionals={professionals} />
        </ClinicalFormDialog>
      </CardHeader>
      <CardContent className="space-y-3">
        {activos.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Sin alergias registradas.
          </p>
        ) : (
          activos.map((a) => (
            <div
              key={a.id}
              className="flex items-start justify-between gap-3 rounded-lg border p-3"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{a.agente}</span>
                  <Badge className="bg-muted text-muted-foreground">{TIPO_LABEL[a.tipo]}</Badge>
                  {a.severidad && (
                    <Badge className={SEV_STYLE[a.severidad]}>{SEV_LABEL[a.severidad]}</Badge>
                  )}
                  {!a.activa && (
                    <Badge className="bg-muted text-muted-foreground">Inactiva</Badge>
                  )}
                </div>
                {a.reaccion && (
                  <p className="text-sm text-muted-foreground">Reacción: {a.reaccion}</p>
                )}
                {a.notas && <p className="text-sm text-muted-foreground">{a.notas}</p>}
              </div>
              <AnnulButton
                onAnnul={(m) => annulClinicalRecordAction("LIS_allergies", a.id, m, patientId)}
              />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
