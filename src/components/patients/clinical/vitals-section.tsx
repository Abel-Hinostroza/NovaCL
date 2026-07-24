"use client";

import { Plus, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClinicalFormDialog } from "./clinical-form-dialog";
import { ProfSelect, type ProfLite } from "./prof-select";
import { AnnulButton } from "./annul-button";
import { saveVitalsAction, annulClinicalRecordAction } from "@/lib/actions/clinical";
import { formatDate } from "@/lib/utils";
import type { Tables } from "@/lib/database.types";

function VitalsForm({ professionals }: { professionals: ProfLite[] }) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="tomado_at">Fecha y hora de la toma</Label>
        <Input id="tomado_at" name="tomado_at" type="datetime-local" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="pa_sistolica">PA sistólica (mmHg)</Label>
          <Input id="pa_sistolica" name="pa_sistolica" type="number" inputMode="numeric" min="0" max="300" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pa_diastolica">PA diastólica (mmHg)</Label>
          <Input id="pa_diastolica" name="pa_diastolica" type="number" inputMode="numeric" min="0" max="200" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fc">FC (lpm)</Label>
          <Input id="fc" name="fc" type="number" inputMode="numeric" min="0" max="300" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fr">FR (rpm)</Label>
          <Input id="fr" name="fr" type="number" inputMode="numeric" min="0" max="100" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="temperatura">Temp (°C)</Label>
          <Input id="temperatura" name="temperatura" type="number" step="0.1" min="25" max="45" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sato2">SatO₂ (%)</Label>
          <Input id="sato2" name="sato2" type="number" inputMode="numeric" min="0" max="100" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="peso_kg">Peso (kg)</Label>
          <Input id="peso_kg" name="peso_kg" type="number" step="0.1" min="0" max="500" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="talla_cm">Talla (cm)</Label>
          <Input id="talla_cm" name="talla_cm" type="number" step="0.1" min="0" max="260" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="perimetro_abdominal">P. abdominal (cm)</Label>
          <Input id="perimetro_abdominal" name="perimetro_abdominal" type="number" step="0.1" min="0" max="250" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="glucosa_capilar">Glucosa (mg/dL)</Label>
          <Input id="glucosa_capilar" name="glucosa_capilar" type="number" step="0.1" min="0" max="1000" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="vit-notas">Notas</Label>
        <Textarea id="vit-notas" name="notas" />
      </div>
      <ProfSelect professionals={professionals} label="Tomado por profesional (opcional)" />
    </div>
  );
}

const dash = (v: number | null | undefined) => (v == null ? "—" : String(v));

export function VitalsSection({
  patientId,
  items,
  professionals,
}: {
  patientId: string;
  items: Tables<"LIS_vitals">[];
  professionals: ProfLite[];
}) {
  const activos = items.filter((i) => !i.anulado);
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4" /> Signos vitales y antropometría
        </CardTitle>
        <ClinicalFormDialog
          title="Nueva toma de signos vitales"
          description="El IMC se calcula automáticamente a partir de peso y talla."
          action={saveVitalsAction}
          patientId={patientId}
          className="max-w-2xl"
          trigger={
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4" /> Registrar
            </Button>
          }
        >
          <VitalsForm professionals={professionals} />
        </ClinicalFormDialog>
      </CardHeader>
      <CardContent className="p-0">
        {activos.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sin tomas registradas.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>PA</TableHead>
                  <TableHead>FC</TableHead>
                  <TableHead>FR</TableHead>
                  <TableHead>Temp</TableHead>
                  <TableHead>SatO₂</TableHead>
                  <TableHead>Peso</TableHead>
                  <TableHead>Talla</TableHead>
                  <TableHead>IMC</TableHead>
                  <TableHead>Glucosa</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activos.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDate(v.tomado_at, true)}
                    </TableCell>
                    <TableCell>
                      {v.pa_sistolica != null || v.pa_diastolica != null
                        ? `${dash(v.pa_sistolica)}/${dash(v.pa_diastolica)}`
                        : "—"}
                    </TableCell>
                    <TableCell>{dash(v.fc)}</TableCell>
                    <TableCell>{dash(v.fr)}</TableCell>
                    <TableCell>{dash(v.temperatura)}</TableCell>
                    <TableCell>{dash(v.sato2)}</TableCell>
                    <TableCell>{dash(v.peso_kg)}</TableCell>
                    <TableCell>{dash(v.talla_cm)}</TableCell>
                    <TableCell className="font-medium">{dash(v.imc)}</TableCell>
                    <TableCell>{dash(v.glucosa_capilar)}</TableCell>
                    <TableCell>
                      <AnnulButton
                        onAnnul={(m) =>
                          annulClinicalRecordAction("LIS_vitals", v.id, m, patientId)
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
