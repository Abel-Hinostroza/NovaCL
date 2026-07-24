import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { readPortalSession } from "@/lib/portal/session";
import { orderBelongsToPortal } from "@/lib/portal/data";
import { buildOrderReport } from "@/lib/reports";
import { ResultsReport } from "@/components/results/results-report";
import { PrintButton } from "@/components/results/print-button";
import { PortalTopbar } from "../../_components/portal-topbar";

export const metadata = { title: "Resultado · Portal del paciente" };
export const dynamic = "force-dynamic";

export default async function PortalOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await readPortalSession();
  if (!session) redirect("/portal");

  const admin = createAdminClient();

  // La orden debe pertenecer a la identidad del paciente en sesión.
  const owns = await orderBelongsToPortal(admin, id, session.pids);
  if (!owns) notFound();

  // onlyValidated=true: el paciente solo ve resultados firmados.
  const report = await buildOrderReport(admin, id, true);

  return (
    <div
      className="theme-light min-h-screen bg-slate-50 print:bg-white"
      style={{ ["--portal-accent" as string]: "#0f8a8d" }}
    >
      <PortalTopbar nombre={session.nombre} />

      <div className="no-print border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <Link
            href="/portal/mis-resultados"
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" /> Mis resultados
          </Link>
          {report && report.studies.length > 0 && (
            <PrintButton label="Descargar / Imprimir" />
          )}
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 print:px-0 print:py-0">
        {report && report.studies.length > 0 ? (
          <>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-slate-900">
                  {report.organizacion}
                </p>
                <p className="text-sm text-slate-500">{report.sede}</p>
              </div>
              <p className="text-right text-sm font-medium text-slate-500">
                Reporte de resultados
              </p>
            </div>

            <ResultsReport data={report} />

            <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-slate-400">
              <ShieldCheck className="h-4 w-4" />
              Documento de resultados validado. Consulta con tu médico para su
              interpretación.
            </p>
          </>
        ) : (
          <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Los resultados de esta orden aún no están disponibles.
          </div>
        )}
      </main>
    </div>
  );
}
