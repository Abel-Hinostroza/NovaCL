"use client";

import { Plus, NotebookPen, Lock } from "lucide-react";
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
import { saveNoteAction, annulNoteAction } from "@/lib/actions/clinical";
import { formatDate } from "@/lib/utils";
import type { Tables } from "@/lib/database.types";

const KIND_LABEL: Record<string, string> = {
  anamnesis: "Anamnesis",
  evolucion: "Evolución",
  interconsulta: "Interconsulta",
  indicaciones: "Indicaciones",
  procedimiento: "Procedimiento",
  otro: "Otro",
};

function NoteForm({ professionals }: { professionals: ProfLite[] }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Tipo de nota</Label>
          <Select name="kind" defaultValue="evolucion">
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
          <Label htmlFor="titulo">Título (opcional)</Label>
          <Input id="titulo" name="titulo" placeholder="Motivo de consulta…" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="cuerpo">Contenido</Label>
        <Textarea
          id="cuerpo"
          name="cuerpo"
          required
          rows={6}
          placeholder="Anamnesis, examen físico, plan…"
        />
      </div>
      <ProfSelect professionals={professionals} label="Profesional firmante (opcional)" />
      <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
        <input type="checkbox" name="firmar" value="true" className="mt-0.5 h-4 w-4" />
        <span>
          <span className="font-medium">Firmar al guardar</span>
          <span className="block text-xs text-muted-foreground">
            Una nota firmada queda bloqueada: no se edita, se corrige con una nueva nota.
          </span>
        </span>
      </label>
    </div>
  );
}

export function NotesSection({
  patientId,
  items,
  professionals,
}: {
  patientId: string;
  items: (Tables<"LIS_clinical_notes"> & {
    profesional?: { nombres: string; apellidos: string; numero_colegiatura: string | null } | null;
  })[];
  professionals: ProfLite[];
}) {
  const visibles = items.filter((i) => i.status !== "anulada");
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <NotebookPen className="h-4 w-4" /> Notas de evolución
        </CardTitle>
        <ClinicalFormDialog
          title="Nueva nota clínica"
          description="Anamnesis, evolución o indicaciones. La firma del profesional es opcional."
          action={saveNoteAction}
          patientId={patientId}
          className="max-w-2xl"
          trigger={
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4" /> Agregar
            </Button>
          }
        >
          <NoteForm professionals={professionals} />
        </ClinicalFormDialog>
      </CardHeader>
      <CardContent className="space-y-3">
        {visibles.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Sin notas registradas.
          </p>
        ) : (
          visibles.map((note) => (
            <div key={note.id} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-muted text-muted-foreground">{KIND_LABEL[note.kind]}</Badge>
                  {note.titulo && <span className="font-medium">{note.titulo}</span>}
                  {note.status === "firmada" ? (
                    <Badge className="flex items-center gap-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      <Lock className="h-3 w-3" /> Firmada
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      Borrador
                    </Badge>
                  )}
                </div>
                <AnnulButton onAnnul={(m) => annulNoteAction(note.id, m, patientId)} />
              </div>
              <p className="whitespace-pre-wrap text-sm">{note.cuerpo}</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(note.firmado_at ?? note.created_at, true)}
                {note.profesional
                  ? ` · ${note.profesional.apellidos}, ${note.profesional.nombres}${
                      note.profesional.numero_colegiatura
                        ? ` (${note.profesional.numero_colegiatura})`
                        : ""
                    }`
                  : ""}
              </p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
