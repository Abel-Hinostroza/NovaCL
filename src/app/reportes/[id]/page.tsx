import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FlaskConical, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { buildOrderReport } from "@/lib/reports";
import { ResultsReport } from "@/components/results/results-report";
import { PrintButton } from "@/components/results/print-button";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Reporte de resultados" };

export default async function ReportePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();
  const supabase = await createClient();

  // onlyValidated=false: el personal puede imprimir borradores marcados como tal
  const report = await buildOrderReport(supabase, id, false);
  if (!report) notFound();

  return (
    <div className="min-h-screen bg-muted/30 print:bg-white">
      {/* Barra de acciones (no se imprime) */}
      <div className="no-print sticky top-0 z-10 border-b bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/ordenes/${id}`}>
              <ArrowLeft className="h-4 w-4" /> Volver a la orden
            </Link>
          </Button>
          <PrintButton />
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-8 print:px-0 print:py-0">
        {/* Encabezado del reporte */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <FlaskConical className="h-6 w-6 text-primary" />
            {report.organizacion}
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Reporte de resultados</p>
            <p>{report.sede}</p>
          </div>
        </div>

        <ResultsReport data={report} />

        <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4" />
          Los valores fuera de rango se indican con su marca. Consulte a su médico para la interpretación.
        </p>
      </main>
    </div>
  );
}
