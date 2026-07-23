import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/results/print-button";
import { Barcode128 } from "@/components/barcode/barcode-128";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Etiqueta de muestra" };

export default async function EtiquetaMuestraPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();
  const supabase = await createClient();

  const { data: sample } = await supabase
    .from("LIS_samples")
    .select(
      "id, barcode, tomada_at, orders:LIS_orders(codigo, patients:LIS_patients(nombres,apellidos,numero_documento)), specimen_types:LIS_specimen_types(nombre)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!sample) notFound();

  const order = sample.orders as unknown as {
    codigo: string;
    patients: { nombres: string; apellidos: string; numero_documento: string } | null;
  } | null;
  const tipo = (sample.specimen_types as unknown as { nombre: string } | null)?.nombre ?? null;
  const paciente = order?.patients
    ? `${order.patients.apellidos}, ${order.patients.nombres}`
    : "—";

  return (
    <div className="min-h-screen bg-muted/30 print:bg-white">
      {/* Ajuste de página al imprimir: sin márgenes grandes, tamaño automático */}
      <style>{`@media print { @page { margin: 4mm; } }`}</style>

      {/* Barra de acciones (no se imprime) */}
      <div className="no-print sticky top-0 z-10 border-b bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/muestras">
              <ArrowLeft className="h-4 w-4" /> Muestras
            </Link>
          </Button>
          <PrintButton label="Imprimir etiqueta" />
        </div>
      </div>

      <main className="mx-auto flex max-w-3xl flex-col items-center px-4 py-10 print:p-0">
        {/* Etiqueta del tubo. Ancho fijo pensado para etiqueta térmica. */}
        <div className="w-90 rounded-md border border-black bg-white p-3 text-black print:border-0">
          <div className="flex items-baseline justify-between text-[11px] font-semibold">
            <span className="truncate">{paciente}</span>
            <span className="shrink-0 tabular-nums">{order?.patients?.numero_documento ?? ""}</span>
          </div>
          <div className="mt-0.5 flex items-center justify-between text-[10px] text-neutral-700">
            <span>Orden {order?.codigo ?? "—"}</span>
            <span>{tipo ?? ""}</span>
          </div>

          <div className="mt-2 flex justify-center">
            <Barcode128 value={sample.barcode} height={54} moduleWidth={2} />
          </div>

          <div className="mt-1 text-center text-[10px] text-neutral-700">
            Toma: {formatDate(sample.tomada_at, true)}
          </div>
        </div>

        <p className="no-print mt-6 max-w-sm text-center text-sm text-muted-foreground">
          Pega esta etiqueta en el tubo. El código es escaneable con cualquier lector
          Code 128. Usa &quot;Imprimir etiqueta&quot; y selecciona tu impresora de etiquetas
          (o Guardar como PDF).
        </p>
      </main>
    </div>
  );
}
