"use client";

import { useTransition } from "react";
import { Plus, Paperclip, LinkIcon, FileText, ExternalLink, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import { AnnulButton } from "./annul-button";
import {
  uploadAttachmentAction,
  linkAttachmentAction,
  signedAttachmentUrlAction,
  annulClinicalRecordAction,
} from "@/lib/actions/clinical";
import { formatDate, formatBytes } from "@/lib/utils";
import type { Tables } from "@/lib/database.types";

const KIND_LABEL: Record<string, string> = {
  informe_externo: "Informe externo",
  laboratorio_externo: "Laboratorio externo",
  imagen: "Imagen",
  receta: "Receta",
  consentimiento: "Consentimiento",
  identidad: "Documento de identidad",
  renhice: "RENHICE",
  otro: "Otro",
};

function KindSelect() {
  return (
    <div className="space-y-2">
      <Label>Tipo de documento</Label>
      <Select name="kind" defaultValue="otro">
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
  );
}

function ViewButton({ attachmentId }: { attachmentId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      title="Ver documento"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await signedAttachmentUrlAction(attachmentId);
          if (res.ok) window.open(res.url, "_blank", "noopener,noreferrer");
          else toast.error(res.error);
        })
      }
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
    </Button>
  );
}

export function AttachmentsSection({
  patientId,
  items,
}: {
  patientId: string;
  items: Tables<"LIS_clinical_attachments">[];
}) {
  const activos = items.filter((i) => !i.anulado);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Paperclip className="h-4 w-4" /> Adjuntos y enlaces
        </CardTitle>
        <div className="flex gap-2">
          <ClinicalFormDialog
            title="Subir documento"
            description="PDF, imágenes o Word (máx. 20 MB). Se guarda cifrado en el bucket privado del laboratorio."
            action={uploadAttachmentAction}
            patientId={patientId}
            trigger={
              <Button size="sm" variant="outline" >
                <Plus className="h-4 w-4" /> Subir archivo
              </Button>
            }
          >
            <div className="space-y-4">
              <KindSelect />
              <div className="space-y-2">
                <Label htmlFor="att-titulo">Título</Label>
                <Input id="att-titulo" name="titulo" required placeholder="Ej. Ecografía abdominal 2026" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="att-file">Archivo</Label>
                <Input
                  id="att-file"
                  name="file"
                  type="file"
                  required
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.tiff,.doc,.docx,image/*,application/pdf"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="att-desc">Descripción</Label>
                <Textarea id="att-desc" name="descripcion" />
              </div>
            </div>
          </ClinicalFormDialog>

          <ClinicalFormDialog
            title="Enlazar documento externo"
            description="Enlace a otro sistema (RENHICE, PACS, un drive…) para complementar la historia."
            action={linkAttachmentAction}
            patientId={patientId}
            trigger={
              <Button size="sm" variant="outline" >
                <LinkIcon className="h-4 w-4" /> Enlace
              </Button>
            }
          >
            <div className="space-y-4">
              <KindSelect />
              <div className="space-y-2">
                <Label htmlFor="lnk-titulo">Título</Label>
                <Input id="lnk-titulo" name="titulo" required placeholder="Ej. Historia en RENHICE" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lnk-url">Enlace (URL)</Label>
                <Input id="lnk-url" name="url_externa" type="url" required placeholder="https://…" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lnk-desc">Descripción</Label>
                <Textarea id="lnk-desc" name="descripcion" />
              </div>
            </div>
          </ClinicalFormDialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {activos.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Sin adjuntos ni enlaces.
          </p>
        ) : (
          activos.map((a) => (
            <div
              key={a.id}
              className="flex items-start justify-between gap-3 rounded-lg border p-3"
            >
              <div className="flex items-start gap-3">
                {a.url_externa ? (
                  <LinkIcon className="mt-0.5 h-4 w-4 text-muted-foreground" />
                ) : (
                  <FileText className="mt-0.5 h-4 w-4 text-muted-foreground" />
                )}
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{a.titulo}</span>
                    <Badge className="bg-muted text-muted-foreground">{KIND_LABEL[a.kind]}</Badge>
                  </div>
                  {a.descripcion && (
                    <p className="text-sm text-muted-foreground">{a.descripcion}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {formatDate(a.created_at, true)}
                    {a.size_bytes ? ` · ${formatBytes(a.size_bytes)}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {a.url_externa ? (
                  <Button asChild variant="ghost" size="sm" title="Abrir enlace">
                    <a href={a.url_externa} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                ) : (
                  <ViewButton attachmentId={a.id} />
                )}
                <AnnulButton
                  onAnnul={(m) =>
                    annulClinicalRecordAction("LIS_clinical_attachments", a.id, m, patientId)
                  }
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
