import { getSessionContext, hasRole } from "@/lib/auth/session";
import { requireModuleAccess } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  CategoryDialog,
  AnalyteDialog,
  StudyDialog,
  type Option,
  type AnalyteOption,
  type ReferenceRangeInput,
} from "@/components/catalog/catalog-forms";
import { StudyPricesDialog } from "@/components/catalog/catalog-prices";
import { DeleteCatalogButton, AdoptStudyButton } from "@/components/catalog/catalog-row-actions";
import { resolveCategoryColor } from "@/lib/catalog/category-colors";
import { formatMoney } from "@/lib/utils";

export const metadata = { title: "Catálogo" };

type JoinedCategory = { nombre: string; codigo: string; color: string | null } | null;

/** Chip de categoría: punto de color (señal secundaria) + nombre. */
function CategoryChip({ category }: { category: JoinedCategory }) {
  if (!category) return <span className="text-muted-foreground">—</span>;
  const hex = resolveCategoryColor(category.codigo ?? category.nombre, category.color);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10"
        style={{ backgroundColor: hex }}
        aria-hidden
      />
      {category.nombre}
    </span>
  );
}

/** Resumen compacto del rango de referencia: el general si existe, si no el
 *  primero; "· +n" indica rangos adicionales por sexo/edad. */
function RangeSummary({ ranges }: { ranges?: ReferenceRangeInput[] }) {
  if (!ranges || ranges.length === 0) return <span className="text-muted-foreground">—</span>;
  const shown =
    ranges.find((r) => r.sexo === "desconocido" && r.edad_min_dias === null && r.edad_max_dias === null) ??
    ranges[0];
  const text =
    shown.valor_min !== null || shown.valor_max !== null
      ? `${shown.valor_min ?? ""} – ${shown.valor_max ?? ""}`
      : shown.texto_normal ?? "—";
  const extra = ranges.length - 1;
  return (
    <span>
      {text}
      {extra > 0 && <span className="text-xs text-muted-foreground"> · +{extra}</span>}
    </span>
  );
}

export default async function CatalogoPage() {
  const ctx = await getSessionContext();
  await requireModuleAccess("catalogo");
  const supabase = await createClient();
  const orgId = ctx.activeOrgId!;
  const orFilter = `organization_id.is.null,organization_id.eq.${orgId}`;
  const canEdit = hasRole(ctx.roles, ["org_admin", "sede_admin"]) || !!ctx.profile?.es_superadmin;

  // Alcance de precios: org_admin/superadmin editan todas las sedes + base;
  // sede_admin solo las sedes donde tiene ese rol.
  const orgMemberships = ctx.memberships.filter((m) => m.organization_id === orgId && m.activo);
  const isOrgAdmin = !!ctx.profile?.es_superadmin || orgMemberships.some((m) => m.role === "org_admin");
  const orgSedes = ctx.sedes.filter((s) => s.organization_id === orgId);
  const priceSedes = isOrgAdmin
    ? orgSedes
    : orgSedes.filter((s) =>
        orgMemberships.some((m) => m.role === "sede_admin" && m.sede_id === s.id)
      );
  const canEditPrices = isOrgAdmin || priceSedes.length > 0;

  const [{ data: studies }, { data: analytes }, { data: categories }, { data: specimenTypes }] =
    await Promise.all([
      supabase
        .from("LIS_studies")
        .select(
          "id,codigo,nombre,requiere_ayuno,tiempo_entrega_h,category_id,specimen_type_id,organization_id, test_categories:LIS_test_categories(nombre,codigo,color), study_analytes:LIS_study_analytes(analyte_id), study_prices:LIS_study_prices(precio,sede_id)"
        )
        .eq("activo", true)
        .or(orFilter)
        .order("nombre"),
      supabase
        .from("LIS_analytes")
        .select("id,codigo,nombre,unidad,value_type,metodo,category_id,organization_id, test_categories:LIS_test_categories(nombre,codigo,color)")
        .eq("activo", true)
        .or(orFilter)
        .order("nombre"),
      supabase
        .from("LIS_test_categories")
        .select("id,codigo,nombre,color,organization_id")
        .eq("activo", true)
        .or(orFilter)
        .order("orden"),
      supabase.from("LIS_specimen_types").select("id,nombre,codigo").eq("activo", true).order("nombre"),
    ]);

  // Rangos de referencia vigentes de los analitos visibles (propios + globales),
  // para precargarlos en el editor y mostrar un resumen en la tabla.
  const analyteIds = (analytes ?? []).map((a) => a.id);
  const { data: rangeRows } = await supabase
    .from("LIS_reference_ranges")
    .select("analyte_id,sexo,edad_min_dias,edad_max_dias,valor_min,valor_max,critico_min,critico_max,texto_normal,nota")
    .in("analyte_id", analyteIds.length > 0 ? analyteIds : ["00000000-0000-0000-0000-000000000000"]);

  const rangesByAnalyte = new Map<string, ReferenceRangeInput[]>();
  for (const r of rangeRows ?? []) {
    const list = rangesByAnalyte.get(r.analyte_id) ?? [];
    list.push({
      sexo: r.sexo,
      edad_min_dias: r.edad_min_dias,
      edad_max_dias: r.edad_max_dias,
      valor_min: r.valor_min,
      valor_max: r.valor_max,
      critico_min: r.critico_min,
      critico_max: r.critico_max,
      texto_normal: r.texto_normal,
      nota: r.nota,
    });
    rangesByAnalyte.set(r.analyte_id, list);
  }
  // Orden estable: primero el rango general, luego por edad mínima.
  for (const list of rangesByAnalyte.values()) {
    list.sort(
      (a, b) =>
        Number(a.sexo !== "desconocido") - Number(b.sexo !== "desconocido") ||
        (a.edad_min_dias ?? 0) - (b.edad_min_dias ?? 0)
    );
  }

  // Opciones para componer estudios/analitos: propias + plantillas globales
  // (para poder editar un estudio adoptado que referencia analitos globales).
  const categoryOptions: Option[] = (categories ?? []).map((c) => ({
    id: c.id,
    nombre: c.organization_id ? c.nombre : `${c.nombre} (global)`,
    codigo: c.codigo,
  }));
  const specimenOptions: Option[] = (specimenTypes ?? []).map((s) => ({ id: s.id, nombre: s.nombre }));
  const analyteOptions: AnalyteOption[] = (analytes ?? []).map((a) => ({
    id: a.id,
    nombre: a.organization_id ? a.nombre : `${a.nombre} (global)`,
    unidad: a.unidad,
  }));

  return (
    <>
      <PageHeader
        title="Catálogo de laboratorio"
        description="Estudios, analitos y categorías. Las plantillas globales son de solo lectura; adóptalas o crea las propias de tu organización."
      >
        {canEdit && (
          <>
            <CategoryDialog />
            <AnalyteDialog categories={categoryOptions} />
            <StudyDialog
              categories={categoryOptions}
              specimenTypes={specimenOptions}
              analytes={analyteOptions}
            />
          </>
        )}
      </PageHeader>

      <Tabs defaultValue="estudios">
        <TabsList>
          <TabsTrigger value="estudios">Estudios ({studies?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="analitos">Analitos ({analytes?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="categorias">Categorías ({categories?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="estudios">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Estudio</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Analitos</TableHead>
                    <TableHead>Precio</TableHead>
                    <TableHead>Origen</TableHead>
                    {canEdit && <TableHead className="text-right">Acciones</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studies?.map((s) => {
                    const own = s.organization_id === orgId;
                    const composition = (s.study_analytes as unknown as { analyte_id: string }[]) ?? [];
                    const prices = (s.study_prices as unknown as { precio: number; sede_id: string | null }[]) ?? [];
                    const base = prices.find((p) => p.sede_id === null)?.precio ?? 0;
                    const priceBySede = new Map(
                      prices.filter((p) => p.sede_id !== null).map((p) => [p.sede_id as string, p.precio])
                    );
                    const sedePrices = priceSedes.map((se) => ({
                      sedeId: se.id,
                      nombre: se.nombre,
                      precio: priceBySede.get(se.id) ?? null,
                    }));
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="text-sm">{s.codigo}</TableCell>
                        <TableCell className="font-medium">
                          {s.nombre}
                          {s.requiere_ayuno && (
                            <Badge className="ml-2 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              Ayuno
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <CategoryChip category={s.test_categories as unknown as JoinedCategory} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{composition.length}</TableCell>
                        <TableCell className="text-sm">{formatMoney(base)}</TableCell>
                        <TableCell>
                          <Badge className={own ? "bg-primary/10 text-primary" : "bg-muted text-foreground"}>
                            {own ? "Propio" : "Global"}
                          </Badge>
                        </TableCell>
                        {canEdit && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {canEditPrices && (
                                <StudyPricesDialog
                                  study={{ id: s.id, codigo: s.codigo, nombre: s.nombre, esGlobal: !own }}
                                  basePrice={base}
                                  canEditBase={isOrgAdmin && own}
                                  isOrgAdmin={isOrgAdmin}
                                  sedePrices={sedePrices}
                                />
                              )}
                              {own && (
                                <>
                                  <StudyDialog
                                    categories={categoryOptions}
                                    specimenTypes={specimenOptions}
                                    analytes={analyteOptions}
                                    study={{
                                      id: s.id,
                                      codigo: s.codigo,
                                      nombre: s.nombre,
                                      category_id: s.category_id,
                                      specimen_type_id: s.specimen_type_id,
                                      tiempo_entrega_h: s.tiempo_entrega_h,
                                      requiere_ayuno: s.requiere_ayuno,
                                      analyteIds: composition.map((c) => c.analyte_id),
                                      precio: base,
                                    }}
                                  />
                                  <DeleteCatalogButton kind="study" id={s.id} nombre={s.nombre} />
                                </>
                              )}
                              {!own && isOrgAdmin && <AdoptStudyButton studyId={s.id} />}
                              {!own && !isOrgAdmin && !canEditPrices && (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analitos">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Analito</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Referencia</TableHead>
                    <TableHead>Origen</TableHead>
                    {canEdit && <TableHead className="text-right">Acciones</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytes?.map((a) => {
                    const own = a.organization_id === orgId;
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="text-sm">{a.codigo}</TableCell>
                        <TableCell className="font-medium">{a.nombre}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <CategoryChip category={a.test_categories as unknown as JoinedCategory} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{a.unidad ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{a.value_type}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{a.metodo ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <RangeSummary ranges={rangesByAnalyte.get(a.id)} />
                        </TableCell>
                        <TableCell>
                          <Badge className={own ? "bg-primary/10 text-primary" : "bg-muted text-foreground"}>
                            {own ? "Propio" : "Global"}
                          </Badge>
                        </TableCell>
                        {canEdit && (
                          <TableCell className="text-right">
                            {own ? (
                              <div className="flex items-center justify-end gap-1">
                                <AnalyteDialog
                                  categories={categoryOptions}
                                  ranges={rangesByAnalyte.get(a.id) ?? []}
                                  analyte={{
                                    id: a.id,
                                    codigo: a.codigo,
                                    nombre: a.nombre,
                                    unidad: a.unidad,
                                    metodo: a.metodo,
                                    value_type: a.value_type,
                                    category_id: a.category_id,
                                  }}
                                />
                                <DeleteCatalogButton kind="analyte" id={a.id} nombre={a.nombre} />
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categorias">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Origen</TableHead>
                    {canEdit && <TableHead className="text-right">Acciones</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories?.map((c) => {
                    const own = c.organization_id === orgId;
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="text-sm">{c.codigo}</TableCell>
                        <TableCell className="font-medium">
                          <CategoryChip
                            category={{ nombre: c.nombre, codigo: c.codigo, color: c.color }}
                          />
                        </TableCell>
                        <TableCell>
                          <Badge className={own ? "bg-primary/10 text-primary" : "bg-muted text-foreground"}>
                            {own ? "Propio" : "Global"}
                          </Badge>
                        </TableCell>
                        {canEdit && (
                          <TableCell className="text-right">
                            {own ? (
                              <div className="flex items-center justify-end gap-1">
                                <CategoryDialog
                                  category={{ id: c.id, codigo: c.codigo, nombre: c.nombre, color: c.color }}
                                />
                                <DeleteCatalogButton kind="category" id={c.id} nombre={c.nombre} />
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
