"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ProfLite = {
  id: string;
  nombres: string;
  apellidos: string;
  numero_colegiatura: string | null;
};

const NONE = "__none__";

/**
 * Select de profesional firmante (opcional). El value vacío se envía como
 * cadena vacía para que la acción lo trate como null.
 */
export function ProfSelect({
  professionals,
  defaultValue = "",
  label = "Profesional (opcional)",
}: {
  professionals: ProfLite[];
  defaultValue?: string;
  label?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {/* Radix Select emite un input oculto con este name; NONE se normaliza a "" */}
      <Select name="profesional_id" defaultValue={defaultValue || NONE}>
        <SelectTrigger>
          <SelectValue placeholder="Sin firma profesional" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Sin firma profesional</SelectItem>
          {professionals.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.apellidos}, {p.nombres}
              {p.numero_colegiatura ? ` · ${p.numero_colegiatura}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
