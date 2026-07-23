import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/results/print-button";
import { Barcode128 } from "@/components/barcode/barcode-128";
import { cn, formatCompactDateTime } from "@/lib/utils";

export const metadata = { title: "Etiqueta de muestra" };

type LabelSize = "compact" | "standard";

/**
 * Geometría de cada variante de etiqueta (tubo pequeño → compact).
 * `barcodeMaxWidth` es el ancho útil en px (96 px = 25.4 mm) disponible para
 * el código dentro de la etiqueta; el componente reduce el módulo si un
 * código largo (formato anterior) no cupiera con el `moduleWidth` nominal.
 */
const LABEL_CONFIG: Record<
  LabelSize,
  {
    pageSize: string;
    width: string;
    height: string;
    padding: string;
    barcodeHeight: number;
    moduleWidth: number;
    barcodeMaxWidth: number;
    barcodeFontSize: number;
    lineClass: string;
    footClass: string;
  }
> = {
  compact: {
    pageSize: "50mm 25mm",
    width: "50mm",
    height: "25mm",
    padding: "1mm",
    barcodeHeight: 30,
    moduleWidth: 1, // 0.26 mm ≈ 2 puntos en térmica de 203 dpi
    barcodeMaxWidth: 178,
    barcodeFontSize: 7.5,
    lineClass: "text-[7.5px] font-semibold leading-tight",
    footClass: "text-[6.5px] leading-tight text-neutral-700",
  },
  standard: {
    pageSize: "70mm 25mm",
    width: "70mm",
    height: "25mm",
    padding: "1.5mm",
    barcodeHeight: 34,
    moduleWidth: 1.3,
    barcodeMaxWidth: 250,
    barcodeFontSize: 8.5,
    lineClass: "text-[8.5px] font-semibold leading-tight",
    footClass: "text-[7px] leading-tight text-neutral-700",
  },
};

export default async function EtiquetaMuestraPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ size?: string }>;
}) {
  const { id } = await params;
  const { size: sizeParam } = await searchParams;
  await requireUser();
  const supabase = await createClient();

  const { data: sample } = await supabase
    .from("LIS_samples")
    .select(
      "id, barcode, tomada_at, orders:LIS_orders(codigo, patients:LIS_patients(nombres,apellidos,numero_documento)), specimen_types:LIS_specimen_types(codigo,nombre)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!sample) notFound();

  // Los códigos del formato anterior (>10 caracteres) no caben con buen
  // módulo en 50 mm: por defecto se proponen en 70 mm. El usuario puede
  // forzar la compacta igualmente (se muestra un aviso).
  const size: LabelSize =
    sizeParam === "compact" || sizeParam === "standard"
      ? sizeParam
      : sample.barcode.length > 10
        ? "standard"
        : "compact";
  const cfg = LABEL_CONFIG[size];
  const longCodeInCompact = size === "compact" && sample.barcode.length > 10;

  const order = sample.orders as unknown as {
    codigo: string;
    patients: { nombres: string; apellidos: string; numero_documento: string } | null;
  } | null;
  const specimen = sample.specimen_types as unknown as {
    codigo: string;
    nombre: string;
  } | null;

  const paciente = order?.patients
    ? `${order.patients.apellidos}, ${order.patients.nombres}`
    : "—";
  // Identificación abreviada para la compacta: 1er apellido + inicial del
  // nombre. Junto al documento cumple los dos identificadores del tubo.
  const apellido1 = order?.patients?.apellidos?.trim().split(/\s+/)[0] ?? "";
  const inicialNombre = order?.patients?.nombres?.trim().charAt(0) ?? "";
  const pacienteCorto = `${apellido1} ${inicialNombre}`.trim() || "—";
  const documento = order?.patients?.numero_documento ?? "";
  const tipo = specimen ? (size === "compact" ? specimen.codigo : specimen.nombre) : "";
  const fechaToma = formatCompactDateTime(sample.tomada_at);

  return (
    <div className="min-h-screen bg-muted/30 print:bg-white">
      {/* Tamaño físico exacto de la etiqueta; el driver térmico maneja sus márgenes */}
      <style>{`@media print { @page { size: ${cfg.pageSize}; margin: 0; } }`}</style>

      {/* Barra de acciones (no se imprime) */}
      <div className="no-print sticky top-0 z-10 border-b bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-6 py-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/muestras">
              <ArrowLeft className="h-4 w-4" /> Muestras
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-lg border bg-background p-0.5 text-xs">
              {(["compact", "standard"] as const).map((s) => (
                <Link
                  key={s}
                  href={`/etiquetas/muestra/${id}?size=${s}`}
                  className={cn(
                    "rounded-md px-2.5 py-1 transition-colors",
                    s === size
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {s === "compact" ? "50 × 25 mm" : "70 × 25 mm"}
                </Link>
              ))}
            </div>
            <PrintButton label="Imprimir etiqueta" />
          </div>
        </div>
      </div>

      <main className="mx-auto flex max-w-3xl flex-col items-center px-4 py-10 print:p-0">
        {longCodeInCompact && (
          <div className="no-print mb-4 flex max-w-md items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Este código tiene {sample.barcode.length} caracteres (formato anterior). En
              50 mm las barras quedan más finas de lo recomendado y el lector podría
              fallar; se ajustaron para que quepa, pero lo ideal es la etiqueta de
              70 × 25 mm.
            </p>
          </div>
        )}

        {/*
          Etiqueta del tubo. Solo lo indispensable junto al código:
          paciente + documento (los dos identificadores exigidos por buenas
          prácticas), tipo de muestra y fecha/hora de toma. La orden se omite
          a propósito: el barcode ya vincula la muestra con la orden.
        */}
        <div
          style={{ width: cfg.width, height: cfg.height, padding: cfg.padding }}
          className="flex flex-col justify-between overflow-hidden rounded-sm border border-dashed border-neutral-400 bg-white text-black print:rounded-none print:border-0"
        >
          <div className={cn("flex items-baseline justify-between gap-1", cfg.lineClass)}>
            <span className="truncate">{size === "compact" ? pacienteCorto : paciente}</span>
            <span className="shrink-0 tabular-nums">{documento}</span>
          </div>

          <div className="flex justify-center">
            <Barcode128
              value={sample.barcode}
              height={cfg.barcodeHeight}
              moduleWidth={cfg.moduleWidth}
              maxWidth={cfg.barcodeMaxWidth}
              fontSize={cfg.barcodeFontSize}
            />
          </div>

          <div className={cn("flex items-baseline justify-between gap-1", cfg.footClass)}>
            <span className="truncate">{tipo}</span>
            <span className="shrink-0 tabular-nums">{fechaToma}</span>
          </div>
        </div>

        <div className="no-print mt-6 max-w-md space-y-2 text-center text-sm text-muted-foreground">
          <p>
            Vista previa en tamaño real ({cfg.pageSize}). Al imprimir elige papel de{" "}
            {cfg.pageSize}, escala <span className="font-medium">100&nbsp;% / tamaño real</span>{" "}
            y márgenes <span className="font-medium">ningunos</span>.
          </p>
          <p className="text-xs">
            50 × 25 mm: tubos pequeños (códigos nuevos de 10 caracteres). 70 × 25 mm:
            códigos del formato anterior o si tu impresora es de 203 dpi y notas lecturas
            fallidas con la compacta.
          </p>
        </div>
      </main>
    </div>
  );
}
