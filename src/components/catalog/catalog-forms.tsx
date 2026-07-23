"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, FlaskConical, FolderPlus, Trash2 } from "lucide-react";
import {
  saveCategoryAction,
  saveAnalyteAction,
  saveStudyAction,
} from "@/lib/actions/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { codeFromName } from "@/lib/text/slug";
import { cn } from "@/lib/utils";
import { StickyFormActions } from "@/components/forms/sticky-form-actions";
import { CATEGORY_PALETTE, resolveCategoryColor } from "@/lib/catalog/category-colors";
import type { Sex } from "@/lib/database.types";

export type Option = { id: string; nombre: string; codigo?: string };
export type AnalyteOption = Option & { unidad: string | null };

/** Rango de referencia tal como se edita/persiste (sexo "desconocido" = aplica a todos). */
export type ReferenceRangeInput = {
  sexo: Sex;
  edad_min_dias: number | null;
  edad_max_dias: number | null;
  valor_min: number | null;
  valor_max: number | null;
  critico_min: number | null;
  critico_max: number | null;
  texto_normal: string | null;
  nota: string | null;
};

// ── Editor de rangos de referencia ───────────────────────────
type RangeRow = {
  sexo: Sex;
  edadMin: string;
  edadMax: string;
  valorMin: string;
  valorMax: string;
  criticoMin: string;
  criticoMax: string;
  textoNormal: string;
  nota: string;
};

const EMPTY_RANGE_ROW: RangeRow = {
  sexo: "desconocido",
  edadMin: "",
  edadMax: "",
  valorMin: "",
  valorMax: "",
  criticoMin: "",
  criticoMax: "",
  textoNormal: "",
  nota: "",
};

function rangeToRow(r: ReferenceRangeInput): RangeRow {
  const num = (v: number | null) => (v === null ? "" : String(v));
  return {
    sexo: r.sexo,
    edadMin: num(r.edad_min_dias),
    edadMax: num(r.edad_max_dias),
    valorMin: num(r.valor_min),
    valorMax: num(r.valor_max),
    criticoMin: num(r.critico_min),
    criticoMax: num(r.critico_max),
    textoNormal: r.texto_normal ?? "",
    nota: r.nota ?? "",
  };
}

function rangeRowHasData(r: RangeRow): boolean {
  return [r.edadMin, r.edadMax, r.valorMin, r.valorMax, r.criticoMin, r.criticoMax, r.textoNormal, r.nota].some(
    (v) => v.trim() !== ""
  );
}

/** Serializa las filas con datos al JSON que espera saveAnalyteAction. */
function rangeRowsToJson(rows: RangeRow[]): string {
  const clean = rows.filter(rangeRowHasData).map((r) => ({
    sexo: r.sexo,
    edad_min_dias: r.edadMin === "" ? null : Number.parseInt(r.edadMin, 10),
    edad_max_dias: r.edadMax === "" ? null : Number.parseInt(r.edadMax, 10),
    valor_min: r.valorMin === "" ? null : Number(r.valorMin),
    valor_max: r.valorMax === "" ? null : Number(r.valorMax),
    critico_min: r.criticoMin === "" ? null : Number(r.criticoMin),
    critico_max: r.criticoMax === "" ? null : Number(r.criticoMax),
    texto_normal: r.textoNormal.trim() || null,
    nota: r.nota.trim() || null,
  }));
  return JSON.stringify(clean);
}

function ReferenceRangesEditor({
  valueType,
  initialRanges,
}: {
  valueType: string;
  initialRanges: ReferenceRangeInput[];
}) {
  const [rows, setRows] = useState<RangeRow[]>(() =>
    initialRanges.length > 0 ? initialRanges.map(rangeToRow) : [{ ...EMPTY_RANGE_ROW }]
  );
  const numeric = valueType === "numerico";

  const updateRow = (i: number, patch: Partial<RangeRow>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
      <input type="hidden" name="ranges" value={rangeRowsToJson(rows)} />
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Rangos de referencia (opcional)
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => setRows((prev) => [...prev, { ...EMPTY_RANGE_ROW }])}
        >
          <Plus className="h-3.5 w-3.5" /> Agregar rango
        </Button>
      </div>

      {rows.map((row, i) => (
        <div key={i} className="space-y-2 rounded-md border bg-card p-2.5">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Sexo</Label>
              <Select value={row.sexo} onValueChange={(v) => updateRow(i, { sexo: v as Sex })}>
                <SelectTrigger className="h-8 w-[104px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desconocido">Todos</SelectItem>
                  <SelectItem value="M">Masc.</SelectItem>
                  <SelectItem value="F">Fem.</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Edad mín (días)</Label>
              <Input
                className="h-8 w-24 text-xs"
                type="number"
                min={0}
                placeholder="0"
                value={row.edadMin}
                onChange={(e) => updateRow(i, { edadMin: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Edad máx (días)</Label>
              <Input
                className="h-8 w-24 text-xs"
                type="number"
                min={0}
                placeholder="sin límite"
                value={row.edadMax}
                onChange={(e) => updateRow(i, { edadMax: e.target.value })}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="ml-auto h-8 w-8 text-muted-foreground hover:text-destructive"
              title="Quitar este rango"
              onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {numeric ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-xs">Mínimo</Label>
                <Input
                  className="h-8 text-xs"
                  type="number"
                  step="any"
                  value={row.valorMin}
                  onChange={(e) => updateRow(i, { valorMin: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Máximo</Label>
                <Input
                  className="h-8 text-xs"
                  type="number"
                  step="any"
                  value={row.valorMax}
                  onChange={(e) => updateRow(i, { valorMax: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Crítico mín</Label>
                <Input
                  className="h-8 text-xs"
                  type="number"
                  step="any"
                  value={row.criticoMin}
                  onChange={(e) => updateRow(i, { criticoMin: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Crítico máx</Label>
                <Input
                  className="h-8 text-xs"
                  type="number"
                  step="any"
                  value={row.criticoMax}
                  onChange={(e) => updateRow(i, { criticoMax: e.target.value })}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <Label className="text-xs">Valor normal (texto)</Label>
              <Input
                className="h-8 text-xs"
                placeholder='p. ej. "Negativo"'
                value={row.textoNormal}
                onChange={(e) => updateRow(i, { textoNormal: e.target.value })}
              />
            </div>
          )}

          <Input
            className="h-8 text-xs"
            placeholder="Nota (opcional)"
            value={row.nota}
            onChange={(e) => updateRow(i, { nota: e.target.value })}
          />
        </div>
      ))}

      <p className="text-xs text-muted-foreground">
        Edad en días: 30 ≈ 1 mes, 365 = 1 año; vacío = sin límite. El rango con sexo «Todos» y sin
        edad aplica por defecto cuando no hay uno más específico.
      </p>
    </div>
  );
}

function useCloseOnOk(
  state: { ok?: boolean; id?: string; error?: string } | undefined,
  onOk: () => void
) {
  const router = useRouter();
  const lastSigRef = useRef<string | null>(null);
  useEffect(() => {
    if (state?.ok) {
      const sig = `ok:${state.id ?? ""}:${state.error ?? ""}`;
      if (lastSigRef.current !== sig) {
        lastSigRef.current = sig;
        toast.success("Guardado");
        onOk();
        router.refresh();
      }
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, onOk, router]);
}

// ── Categoría ────────────────────────────────────────────────
export function CategoryDialog({
  category,
}: {
  category?: { id: string; codigo: string; nombre: string; color: string | null };
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(saveCategoryAction, undefined);
  const [nombre, setNombre] = useState(category?.nombre ?? "");
  const [codigo, setCodigo] = useState(category?.codigo ?? "");
  const [codigoTouched, setCodigoTouched] = useState(Boolean(category));
  const [color, setColor] = useState(category?.color ?? "");
  useCloseOnOk(state, () => setOpen(false));

  // Vista previa: color elegido, o el derivado del código si es "Automático".
  const previewColor = resolveCategoryColor(codigo || "?", color || null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {category ? (
          <Button variant="ghost" size="icon" title="Editar categoría">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="outline">
            <FolderPlus className="h-4 w-4" /> Nueva categoría
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
          <DialogDescription>Agrupa estudios y analitos (p. ej. Serología).</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          {category && <input type="hidden" name="id" value={category.id} />}
          <input type="hidden" name="color" value={color} />
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="codigo">Código</Label>
              <Input
                id="codigo"
                name="codigo"
                placeholder="SER"
                required
                value={codigo}
                onChange={(e) => {
                  setCodigoTouched(true);
                  setCodigo(e.target.value.toUpperCase());
                }}
                title="Sugerencia automática según el nombre"
              />
              {!codigo && nombre && (
                <p className="text-xs text-muted-foreground">
                  Sugerencia: <span className="font-mono">{codeFromName(nombre)}</span>
                </p>
              )}
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input
                id="nombre"
                name="nombre"
                placeholder="Serología"
                required
                value={nombre}
                onChange={(e) => {
                  const next = e.target.value;
                  setNombre(next);
                  if (!codigoTouched) setCodigo(codeFromName(next));
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              Color{" "}
              <span
                className="ml-1 inline-block h-3 w-3 rounded-full align-middle ring-1 ring-black/10"
                style={{ backgroundColor: previewColor }}
              />
            </Label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setColor("")}
                className={cn(
                  "rounded-md border px-2 py-1 text-xs",
                  color === "" ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"
                )}
                title="Derivar el color automáticamente del código"
              >
                Automático
              </button>
              {CATEGORY_PALETTE.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setColor(c.hex)}
                  title={c.label}
                  aria-label={c.label}
                  className={cn(
                    "h-6 w-6 rounded-full ring-1 ring-black/10 transition",
                    color.toUpperCase() === c.hex ? "ring-2 ring-offset-2 ring-foreground" : ""
                  )}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              El color acompaña al código y nombre; no los reemplaza.
            </p>
          </div>

          <div className="flex justify-end">
            <StickyFormActions
              placement="inline"
              label={category ? "Guardar" : "Crear categoría"}
              busyLabel={category ? "Guardando…" : "Creando…"}
              cancel={{ label: "Cancelar", onClick: () => setOpen(false) }}
            />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Analito ──────────────────────────────────────────────────
export function AnalyteDialog({
  categories,
  analyte,
  ranges,
}: {
  categories: Option[];
  analyte?: {
    id: string;
    codigo: string;
    nombre: string;
    unidad: string | null;
    metodo: string | null;
    value_type: string;
    category_id: string | null;
  };
  /** Rangos de referencia vigentes (precargados para conservarlos al editar). */
  ranges?: ReferenceRangeInput[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(saveAnalyteAction, undefined);
  const [valueType, setValueType] = useState(analyte?.value_type ?? "numerico");
  const [nombre, setNombre] = useState(analyte?.nombre ?? "");
  const [codigo, setCodigo] = useState(analyte?.codigo ?? "");
  const [codigoTouched, setCodigoTouched] = useState(Boolean(analyte));
  // Remonta el editor de rangos tras guardar para no reusar valores en el próximo alta.
  const [rangesResetKey, setRangesResetKey] = useState(0);
  useCloseOnOk(state, () => {
    setOpen(false);
    setRangesResetKey((k) => k + 1);
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {analyte ? (
          <Button variant="ghost" size="icon" title="Editar analito y rangos de referencia">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="outline">
            <Plus className="h-4 w-4" /> Nuevo analito
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{analyte ? "Editar analito" : "Nuevo analito"}</DialogTitle>
          <DialogDescription>Parámetro medible (p. ej. Hemoglobina).</DialogDescription>
        </DialogHeader>
        <form
          action={action}
          onSubmit={(e) => {
            const form = e.currentTarget;
            const raw = String(
              (form.elements.namedItem("ranges") as HTMLInputElement | null)?.value ?? "[]"
            );
            let parsed: ReferenceRangeInput[];
            try {
              parsed = JSON.parse(raw);
            } catch {
              return; // el servidor valida el formato
            }
            for (const r of parsed) {
              const invalido =
                (r.valor_min !== null && r.valor_max !== null && r.valor_min > r.valor_max) ||
                (r.critico_min !== null && r.critico_max !== null && r.critico_min > r.critico_max) ||
                (r.edad_min_dias !== null && r.edad_max_dias !== null && r.edad_min_dias > r.edad_max_dias);
              if (invalido) {
                e.preventDefault();
                toast.error("Rango inválido: un mínimo no puede ser mayor que su máximo.");
                return;
              }
            }
          }}
          className="space-y-4"
        >
          {analyte && <input type="hidden" name="id" value={analyte.id} />}
          <input type="hidden" name="value_type" value={valueType} />
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="a_codigo">Código</Label>
              <Input
                id="a_codigo"
                name="codigo"
                defaultValue={analyte?.codigo}
                required
                value={codigo}
                onChange={(e) => {
                  setCodigoTouched(true);
                  setCodigo(e.target.value.toUpperCase());
                }}
                title="Sugerencia automática según el nombre"
              />
              {!codigo && nombre && (
                <p className="text-xs text-muted-foreground">
                  Sugerencia: <span className="font-mono">{codeFromName(nombre)}</span>
                </p>
              )}
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="a_nombre">Nombre</Label>
              <Input
                id="a_nombre"
                name="nombre"
                defaultValue={analyte?.nombre}
                required
                value={nombre}
                onChange={(e) => {
                  const next = e.target.value;
                  setNombre(next);
                  if (!codigoTouched) setCodigo(codeFromName(next));
                }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select name="category_id" defaultValue={analyte?.category_id ?? ""}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo de valor</Label>
              <Select value={valueType} onValueChange={setValueType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="numerico">Numérico</SelectItem>
                  <SelectItem value="texto">Texto</SelectItem>
                  <SelectItem value="opcion">Opción</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="a_unidad">Unidad</Label>
              <Input id="a_unidad" name="unidad" defaultValue={analyte?.unidad ?? ""} placeholder="mg/dL" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="a_decimales">Decimales</Label>
              <Input id="a_decimales" name="decimales" type="number" defaultValue={2} min={0} max={4} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="a_metodo">Método</Label>
              <Input id="a_metodo" name="metodo" defaultValue={analyte?.metodo ?? ""} />
            </div>
          </div>
          <ReferenceRangesEditor
            key={`${analyte?.id ?? "nuevo"}:${rangesResetKey}`}
            valueType={valueType}
            initialRanges={ranges ?? []}
          />
          <div className="flex justify-end">
            <StickyFormActions
              placement="inline"
              label={analyte ? "Guardar" : "Crear analito"}
              busyLabel="Guardando…"
              cancel={{ label: "Cancelar", onClick: () => setOpen(false) }}
            />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Estudio ──────────────────────────────────────────────────
export function StudyDialog({
  categories,
  specimenTypes,
  analytes,
  study,
}: {
  categories: Option[];
  specimenTypes: Option[];
  analytes: AnalyteOption[];
  study?: {
    id: string;
    codigo: string;
    nombre: string;
    category_id: string | null;
    specimen_type_id: string | null;
    tiempo_entrega_h: number | null;
    requiere_ayuno: boolean;
    analyteIds: string[];
    precio: number;
  };
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(saveStudyAction, undefined);
  const [selected, setSelected] = useState<Set<string>>(new Set(study?.analyteIds ?? []));
  const [nombreEstudio, setNombreEstudio] = useState(study?.nombre ?? "");
  const [codigoEstudio, setCodigoEstudio] = useState(study?.codigo ?? "");
  const [codigoTouchedEstudio, setCodigoTouchedEstudio] = useState(Boolean(study));
  useCloseOnOk(state, () => setOpen(false));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {study ? (
          <Button variant="ghost" size="icon">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button>
            <FlaskConical className="h-4 w-4" /> Nuevo estudio
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{study ? "Editar estudio" : "Nuevo estudio"}</DialogTitle>
          <DialogDescription>Perfil que se ordena (p. ej. Hemograma completo).</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          {study && <input type="hidden" name="id" value={study.id} />}
          {[...selected].map((id) => (
            <input key={id} type="hidden" name="analyte_ids" value={id} />
          ))}

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="s_codigo">Código</Label>
              <Input
                id="s_codigo"
                name="codigo"
                defaultValue={study?.codigo}
                required
                value={codigoEstudio}
                onChange={(e) => {
                  setCodigoTouchedEstudio(true);
                  setCodigoEstudio(e.target.value.toUpperCase());
                }}
                title="Sugerencia automática según el nombre"
              />
              {!codigoEstudio && nombreEstudio && (
                <p className="text-xs text-muted-foreground">
                  Sugerencia: <span className="font-mono">{codeFromName(nombreEstudio)}</span>
                </p>
              )}
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="s_nombre">Nombre</Label>
              <Input
                id="s_nombre"
                name="nombre"
                defaultValue={study?.nombre}
                required
                value={nombreEstudio}
                onChange={(e) => {
                  const next = e.target.value;
                  setNombreEstudio(next);
                  if (!codigoTouchedEstudio) setCodigoEstudio(codeFromName(next));
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select name="category_id" defaultValue={study?.category_id ?? ""}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo de muestra</Label>
              <Select name="specimen_type_id" defaultValue={study?.specimen_type_id ?? ""}>
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {specimenTypes.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="s_tat">TAT (horas)</Label>
              <Input id="s_tat" name="tiempo_entrega_h" type="number" defaultValue={study?.tiempo_entrega_h ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s_precio">Precio base (PEN)</Label>
              <Input id="s_precio" name="precio" type="number" step="0.01" defaultValue={study?.precio ?? 0} />
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input type="checkbox" name="requiere_ayuno" defaultChecked={study?.requiere_ayuno} className="h-4 w-4" />
              Requiere ayuno
            </label>
          </div>

          <div className="space-y-2">
            <Label>Analitos que componen el estudio ({selected.size})</Label>
            <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border p-2">
              {analytes.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggle(a.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-sm",
                    selected.has(a.id) ? "bg-primary/10 text-primary" : "hover:bg-accent"
                  )}
                >
                  <span>
                    {a.nombre} {a.unidad && <span className="text-muted-foreground">({a.unidad})</span>}
                  </span>
                  <span
                    className={cn(
                      "h-4 w-4 rounded-full border",
                      selected.has(a.id) && "border-primary bg-primary"
                    )}
                  />
                </button>
              ))}
              {analytes.length === 0 && (
                <p className="p-2 text-sm text-muted-foreground">
                  Primero crea analitos para poder componer estudios.
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <StickyFormActions
              placement="inline"
              label={study ? "Guardar estudio" : "Crear estudio"}
              busyLabel="Guardando…"
              cancel={{ label: "Cancelar", onClick: () => setOpen(false) }}
            />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
