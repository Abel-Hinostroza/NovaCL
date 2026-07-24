"use client";

import { ClinicalFormDialog } from "./clinical-form-dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveClinicalProfileAction } from "@/lib/actions/clinical";
import type { Tables } from "@/lib/database.types";

const NONE = "__none__";

export function ClinicalProfileDialog({
  patientId,
  sexo,
  profile,
  trigger,
}: {
  patientId: string;
  sexo: string;
  profile: Tables<"LIS_clinical_profile"> | null;
  trigger: React.ReactNode;
}) {
  const showGineco = sexo === "F";
  const p = profile;
  return (
    <ClinicalFormDialog
      title="Datos clínicos del paciente"
      description="Filiación ampliada, datos de seguridad, hábitos y consentimiento de datos (Ley 29733)."
      action={saveClinicalProfileAction}
      patientId={patientId}
      className="max-h-[85vh] max-w-2xl overflow-y-auto"
      submitLabel="Guardar perfil clínico"
      trigger={trigger}
    >
      <div className="space-y-5">
        {/* Filiación ampliada */}
        <section className="space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground">Datos generales</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="estado_civil">Estado civil</Label>
              <Select name="estado_civil" defaultValue={p?.estado_civil ?? NONE}>
                <SelectTrigger id="estado_civil">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {["Soltero(a)", "Casado(a)", "Conviviente", "Viudo(a)", "Divorciado(a)"].map(
                    (e) => (
                      <SelectItem key={e} value={e}>
                        {e}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="grado_instruccion">Grado de instrucción</Label>
              <Select name="grado_instruccion" defaultValue={p?.grado_instruccion ?? NONE}>
                <SelectTrigger id="grado_instruccion">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {["Sin instrucción", "Primaria", "Secundaria", "Técnica", "Superior"].map(
                    (g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ocupacion">Ocupación</Label>
              <Input id="ocupacion" name="ocupacion" defaultValue={p?.ocupacion ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lugar_nacimiento">Lugar de nacimiento</Label>
              <Input
                id="lugar_nacimiento"
                name="lugar_nacimiento"
                defaultValue={p?.lugar_nacimiento ?? ""}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="procedencia">Procedencia</Label>
              <Input id="procedencia" name="procedencia" defaultValue={p?.procedencia ?? ""} />
            </div>
          </div>
        </section>

        {/* Seguridad */}
        <section className="space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground">Datos de seguridad</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="factor_rh">Factor Rh</Label>
              <Select name="factor_rh" defaultValue={p?.factor_rh ?? NONE}>
                <SelectTrigger id="factor_rh">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No determinado</SelectItem>
                  <SelectItem value="+">Positivo (+)</SelectItem>
                  <SelectItem value="-">Negativo (−)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="donante_organos">Donante de órganos</Label>
              <Select
                name="donante_organos"
                defaultValue={p?.donante_organos == null ? NONE : p.donante_organos ? "true" : "false"}
              >
                <SelectTrigger id="donante_organos">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No especifica</SelectItem>
                  <SelectItem value="true">Sí</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* Gineco-obstétrico */}
        {showGineco && (
          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground">
              Antecedentes gineco-obstétricos
            </h4>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="go_menarquia_edad">Menarquia (edad)</Label>
                <Input
                  id="go_menarquia_edad"
                  name="go_menarquia_edad"
                  type="number"
                  min="5"
                  max="25"
                  defaultValue={p?.go_menarquia_edad ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="go_fur">FUR</Label>
                <Input id="go_fur" name="go_fur" type="date" defaultValue={p?.go_fur ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="go_gestaciones">Gestaciones</Label>
                <Input
                  id="go_gestaciones"
                  name="go_gestaciones"
                  type="number"
                  min="0"
                  defaultValue={p?.go_gestaciones ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="go_partos">Partos</Label>
                <Input id="go_partos" name="go_partos" type="number" min="0" defaultValue={p?.go_partos ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="go_abortos">Abortos</Label>
                <Input id="go_abortos" name="go_abortos" type="number" min="0" defaultValue={p?.go_abortos ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="go_cesareas">Cesáreas</Label>
                <Input id="go_cesareas" name="go_cesareas" type="number" min="0" defaultValue={p?.go_cesareas ?? ""} />
              </div>
              <div className="space-y-2 sm:col-span-3">
                <Label htmlFor="go_anticonceptivo">Método anticonceptivo</Label>
                <Input
                  id="go_anticonceptivo"
                  name="go_anticonceptivo"
                  defaultValue={p?.go_anticonceptivo ?? ""}
                />
              </div>
              <div className="space-y-2 sm:col-span-3">
                <Label htmlFor="go_notas">Notas gineco-obstétricas</Label>
                <Textarea id="go_notas" name="go_notas" defaultValue={p?.go_notas ?? ""} />
              </div>
            </div>
          </section>
        )}

        {/* Hábitos */}
        <section className="space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground">Hábitos / estilo de vida</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="habito_tabaco">Tabaco</Label>
              <Input id="habito_tabaco" name="habito_tabaco" defaultValue={p?.habito_tabaco ?? ""} placeholder="No / ex / actual…" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="habito_alcohol">Alcohol</Label>
              <Input id="habito_alcohol" name="habito_alcohol" defaultValue={p?.habito_alcohol ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="habito_drogas">Otras sustancias</Label>
              <Input id="habito_drogas" name="habito_drogas" defaultValue={p?.habito_drogas ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="habito_actividad">Actividad física</Label>
              <Input id="habito_actividad" name="habito_actividad" defaultValue={p?.habito_actividad ?? ""} />
            </div>
          </div>
        </section>

        {/* Notas y consentimiento */}
        <section className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="notas_generales">Notas generales</Label>
            <Textarea id="notas_generales" name="notas_generales" defaultValue={p?.notas_generales ?? ""} />
          </div>
          <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
            <input
              type="checkbox"
              name="consent_datos"
              value="true"
              defaultChecked={p?.consent_datos ?? false}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <span className="font-medium">
                Consentimiento de tratamiento de datos personales (Ley N° 29733)
              </span>
              <span className="block text-xs text-muted-foreground">
                El paciente autoriza el tratamiento de sus datos de salud para fines de atención.
                Se registra la fecha y versión del consentimiento.
              </span>
            </span>
          </label>
          <input type="hidden" name="consent_version" value="v1" />
        </section>
      </div>
    </ClinicalFormDialog>
  );
}
