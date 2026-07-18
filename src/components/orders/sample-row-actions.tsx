"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateSampleStatusAction } from "@/lib/actions/orders";
import type { SampleStatus } from "@/lib/database.types";

const NEXT: Partial<Record<SampleStatus, { to: "recibida" | "en_analisis" | "procesada"; label: string }>> = {
  tomada: { to: "recibida", label: "Recibir" },
  en_transito: { to: "recibida", label: "Recibir" },
  recibida: { to: "en_analisis", label: "En análisis" },
  en_analisis: { to: "procesada", label: "Procesar" },
};

export function SampleRowActions({ sampleId, status }: { sampleId: string; status: SampleStatus }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const next = NEXT[status];
  if (!next) return null;

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await updateSampleStatusAction(sampleId, next.to);
          if (r.error) toast.error(r.error);
          else {
            toast.success("Muestra actualizada");
            router.refresh();
          }
        })
      }
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {next.label}
    </Button>
  );
}
