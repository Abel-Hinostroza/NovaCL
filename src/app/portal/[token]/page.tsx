import { FlaskConical, ShieldCheck, AlertTriangle } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { buildOrderReport } from "@/lib/reports";
import { ResultsReport } from "@/components/results/results-report";
import { PrintButton } from "@/components/results/print-button";

export const metadata = { title: "Mis resultados" };
export const dynamic = "force-dynamic";

export default async function PortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: delivery } = await admin
    .from("LIS_result_deliveries")
    .select("id, order_id, token_expira_at")
    .eq("access_token", token)
    .maybeSingle();

  const expired =
    delivery?.token_expira_at && new Date(delivery.token_expira_at) < new Date();

  if (!delivery || expired) {
    return (
      <PortalShell>
        <div className="mx-auto max-w-md rounded-xl border bg-card p-8 text-center">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-500" />
          <h1 className="text-lg font-semibold">Enlace no válido</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {expired
              ? "Este enlace ha expirado. Solicita uno nuevo en tu laboratorio."
              : "No encontramos resultados para este enlace."}
          </p>
        </div>
      </PortalShell>
    );
  }

  // marcar como visto (primera vez)
  await admin
    .from("LIS_result_deliveries")
    .update({ status: "visto", visto_at: new Date().toISOString() })
    .eq("id", delivery.id)
    .neq("status", "visto");

  const report = await buildOrderReport(admin, delivery.order_id, true);

  return (
    <PortalShell>
      {report ? (
        <>
          <div className="no-print mb-4 flex justify-end">
            <PrintButton label="Descargar / Imprimir" />
          </div>
          <ResultsReport data={report} />
          <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4" />
            Documento de resultados validado. Consulta con tu médico para su interpretación.
          </p>
        </>
      ) : (
        <div className="mx-auto max-w-md rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          Los resultados aún no están disponibles.
        </div>
      )}
    </PortalShell>
  );
}

function PortalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-6 py-4 font-semibold">
          <FlaskConical className="h-5 w-5 text-primary" />
          Portal de resultados
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
