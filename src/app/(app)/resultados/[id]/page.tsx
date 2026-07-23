import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ResultsEntry, type ItemGroup } from "@/components/results/results-entry";
import { hasRole } from "@/lib/auth/session";
import { calcAge } from "@/lib/utils";
import {
  formatRangeText,
  patientAgeDays,
  pickRange,
  type RefRange,
} from "@/lib/results/reference";

export default async function ResultEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const fromList = from === "list";
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("LIS_orders")
    .select("*, patients:LIS_patients(nombres,apellidos,sexo,fecha_nacimiento,numero_documento)")
    .eq("id", id)
    .maybeSingle();
  if (!order) notFound();

  const { data: items } = await supabase
    .from("LIS_order_items")
    .select("id,study_id,study_nombre,status, studies:LIS_studies(study_analytes:LIS_study_analytes(orden, analytes:LIS_analytes(id,nombre,unidad,value_type,decimales,opciones)))")
    .eq("order_id", id)
    .neq("status", "anulado")
    .order("created_at");

  const itemIds = (items ?? []).map((i) => i.id);
  const { data: results } = itemIds.length
    ? await supabase.from("LIS_results").select("*").in("order_item_id", itemIds)
    : { data: [] };

  const resultMap = new Map<string, NonNullable<typeof results>[number]>();
  const itemsWithResults = new Set<string>();
  for (const r of results ?? []) {
    resultMap.set(`${r.order_item_id}:${r.analyte_id}`, r);
    itemsWithResults.add(r.order_item_id);
  }

  // Estudios cuya muestra ya concluyó la fase analítica. Solo esos aceptan
  // ingreso de resultados (post-analítica); el resto se muestra bloqueado.
  // upsert_result aplica la misma regla en el servidor.
  const { data: processedLinks } = itemIds.length
    ? await supabase
        .from("LIS_sample_items")
        .select("order_item_id, samples:LIS_samples!inner(status)")
        .in("order_item_id", itemIds)
        .eq("samples.status", "procesada")
    : { data: [] };
  const processedItemIds = new Set((processedLinks ?? []).map((l) => l.order_item_id));

  // Rangos de referencia del catálogo, para mostrar la referencia y el indicador
  // ANTES de guardar (el técnico ve el objetivo mientras digita). El servidor
  // recalcula con el mismo criterio al persistir.
  const analyteIds = Array.from(
    new Set(
      (items ?? []).flatMap((it) =>
        (
          (it.studies as unknown as { study_analytes: { analytes: { id: string } }[] } | null)
            ?.study_analytes ?? []
        ).map((x) => x.analytes.id)
      )
    )
  );
  const { data: ranges } = analyteIds.length
    ? await supabase
        .from("LIS_reference_ranges")
        .select("analyte_id,sexo,edad_min_dias,edad_max_dias,valor_min,valor_max,critico_min,critico_max,texto_normal")
        .in("analyte_id", analyteIds)
    : { data: [] };

  const rangesByAnalyte = new Map<string, RefRange[]>();
  for (const r of ranges ?? []) {
    const arr = rangesByAnalyte.get(r.analyte_id) ?? [];
    arr.push({
      sexo: r.sexo,
      edadMinDias: r.edad_min_dias,
      edadMaxDias: r.edad_max_dias,
      valorMin: r.valor_min,
      valorMax: r.valor_max,
      criticoMin: r.critico_min,
      criticoMax: r.critico_max,
      textoNormal: r.texto_normal,
    });
    rangesByAnalyte.set(r.analyte_id, arr);
  }

  const patientSexo = (order.patients as unknown as { sexo: string }).sexo;
  const patientFechaNac = (order.patients as unknown as { fecha_nacimiento: string | null })
    .fecha_nacimiento;
  const ageDays = patientAgeDays(patientFechaNac);

  const groups: ItemGroup[] = (items ?? []).map((it) => {
    const sa =
      ((it.studies as unknown as { study_analytes: { orden: number; analytes: { id: string; nombre: string; unidad: string | null; value_type: string; decimales: number; opciones: unknown } }[] } | null)
        ?.study_analytes ?? [])
        .slice()
        .sort((a, b) => a.orden - b.orden);
    return {
      orderItemId: it.id,
      studyNombre: it.study_nombre,
      status: it.status,
      // Ingresable: muestra procesada o trabajo ya iniciado (correcciones).
      processable: processedItemIds.has(it.id) || itemsWithResults.has(it.id),
      analytes: sa.map((x) => {
        const r = resultMap.get(`${it.id}:${x.analytes.id}`);
        // Rango aplicable al paciente (sexo/edad); alimenta la referencia
        // precargada y el indicador en vivo del cliente.
        const range = pickRange(rangesByAnalyte.get(x.analytes.id) ?? [], patientSexo, ageDays);
        return {
          analyteId: x.analytes.id,
          nombre: x.analytes.nombre,
          unidad: x.analytes.unidad,
          valueType: x.analytes.value_type,
          opciones: (x.analytes.opciones as string[] | null) ?? null,
          valorNum: r?.valor_num ?? null,
          valorTexto: r?.valor_texto ?? null,
          flag: r?.flag ?? null,
          // Preferir el rango con que se guardó; si aún no hay resultado, el del catálogo.
          rango: r?.rango_texto ?? formatRangeText(range) ?? null,
          range,
          status: r?.status ?? null,
        };
      }),
    };
  });

  const patient = order.patients as unknown as { nombres: string; apellidos: string; sexo: string; fecha_nacimiento: string | null; numero_documento: string };
  const canValidate = hasRole(ctx.roles, ["org_admin", "sede_admin", "validador"]);

  return (
    <>
      {/* Retorno contextual: si se llegó desde la lista, volver a ella (y
          ofrecer el salto a la orden); si se llegó desde la orden, volver a ella. */}
      <div className="mb-2 flex items-center gap-1">
        <Button asChild variant="ghost" size="sm">
          <Link href={fromList ? "/resultados" : `/ordenes/${id}`}>
            <ArrowLeft className="h-4 w-4" /> {fromList ? "Resultados" : `Orden ${order.codigo}`}
          </Link>
        </Button>
        {fromList && (
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link href={`/ordenes/${id}`}>
              <ClipboardList className="h-4 w-4" /> Ver orden {order.codigo}
            </Link>
          </Button>
        )}
      </div>
      <PageHeader
        title={`Resultados · ${order.codigo}`}
        description={`${patient.nombres} ${patient.apellidos} · ${patient.numero_documento} · ${calcAge(patient.fecha_nacimiento)}`}
      />
      <ResultsEntry orderId={id} groups={groups} canValidate={canValidate} />
    </>
  );
}
