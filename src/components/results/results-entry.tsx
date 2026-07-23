"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Save, ShieldCheck, Loader2, AlertTriangle, Send, ArrowRight, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  recordCriticalNotificationAction,
  saveResultsAction,
  validateResultsAction,
  type CriticalValue,
  type DeltaAlert,
  type ResultInput,
} from "@/lib/actions/results";
import type { FinalizeSummary } from "@/lib/automation";
import { FLAG_LABELS, FLAG_COLORS, ITEM_STATUS_LABELS } from "@/lib/constants";
import { ProfessionalPicker } from "@/components/professionals/professional-picker";
import { cn } from "@/lib/utils";
import { evalFlagNum, evalFlagText, type RefRange } from "@/lib/results/reference";
import type { ItemStatus, ResultFlag, ResultStatus } from "@/lib/database.types";

export type AnalyteRow = {
  analyteId: string;
  nombre: string;
  unidad: string | null;
  valueType: string;
  opciones: string[] | null;
  valorNum: number | null;
  valorTexto: string | null;
  flag: ResultFlag | null;
  rango: string | null;
  range: RefRange | null;
  status: ResultStatus | null;
};

export type ItemGroup = {
  orderItemId: string;
  studyNombre: string;
  status: ItemStatus;
  /** true si la muestra del estudio ya fue procesada (o el estudio ya tiene
   * resultados cargados): solo entonces el ingreso está habilitado. */
  processable: boolean;
  analytes: AnalyteRow[];
};

export function ResultsEntry({
  orderId,
  groups,
  canValidate,
}: {
  orderId: string;
  groups: ItemGroup[];
  canValidate: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // Orden completamente firmada: ya no queda trabajo de resultados, el siguiente
  // paso del flujo es Entrega. Los inputs quedan bloqueados y Guardar/Validar no
  // tienen efecto, así que la barra ofrece el salto al siguiente módulo.
  const allValidated = groups.length > 0 && groups.every((g) => g.status === "validado");
  // Ningún estudio con muestra procesada: no hay trabajo post-analítico que
  // hacer aquí todavía (acceso directo por URL antes de procesar la muestra).
  const anyProcessable = groups.some((g) => g.processable);
  const [criticos, setCriticos] = useState<CriticalValue[]>([]);
  const [deltas, setDeltas] = useState<DeltaAlert[]>([]);
  const [avisadoA, setAvisadoA] = useState("");
  const [avisadoAId, setAvisadoAId] = useState<string | null>(null);
  const [medioAviso, setMedioAviso] = useState("telefono");
  const [notaAviso, setNotaAviso] = useState("");
  const [savingAviso, startAviso] = useTransition();
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const g of groups) {
      for (const a of g.analytes) {
        const key = `${g.orderItemId}:${a.analyteId}`;
        init[key] = a.valueType === "numerico"
          ? a.valorNum?.toString() ?? ""
          : a.valorTexto ?? "";
      }
    }
    return init;
  });

  function collect(): ResultInput[] {
    const inputs: ResultInput[] = [];
    for (const g of groups) {
      // Estudios sin muestra procesada no se envían: el ingreso es
      // post-analítico (el servidor también los rechaza en upsert_result).
      if (!g.processable) continue;
      for (const a of g.analytes) {
        // Los resultados ya validados nunca se reenvían: un guardado de
        // borrador no puede revertir una firma (la BD también lo rechaza);
        // una corrección exige pasar de nuevo por "Validar y firmar".
        if (a.status === "validado") continue;
        const key = `${g.orderItemId}:${a.analyteId}`;
        const raw = values[key]?.trim() ?? "";
        if (raw === "") continue;
        inputs.push({
          orderItemId: g.orderItemId,
          analyteId: a.analyteId,
          valorNum: a.valueType === "numerico" ? Number(raw) : null,
          valorTexto: a.valueType === "numerico" ? null : raw,
        });
      }
    }
    return inputs;
  }

  function run(validate: boolean) {
    const inputs = collect();
    if (inputs.length === 0) {
      toast.error("Ingresa al menos un valor");
      return;
    }
    start(async () => {
      const res = validate
        ? await validateResultsAction(orderId, inputs)
        : await saveResultsAction(orderId, inputs);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(validate ? "Resultados validados" : "Resultados guardados");

      // Alerta activa de valores críticos: exige registrar el aviso al médico.
      if (res.criticos && res.criticos.length > 0) setCriticos(res.criticos);
      // Delta check: variación anómala frente al histórico del paciente.
      if (res.deltas && res.deltas.length > 0) setDeltas(res.deltas);

      // Efectos de la automatización al completar la orden
      const auto = ("automation" in res ? res.automation : undefined) as
        | FinalizeSummary
        | undefined;
      if (auto?.reportVersion) {
        toast.success(`Informe v${auto.reportVersion} archivado en el repositorio`);
      }
      if (auto?.reportError) {
        toast.warning(`Informe no archivado: ${auto.reportError}`);
      }
      if (auto?.invoice === "emitida") toast.success("Comprobante emitido automáticamente");
      if (auto?.invoice === "error") toast.warning("La auto-facturación falló; emite manualmente desde Facturación");
      if (auto?.delivery === "enviada") toast.success("Resultados enviados al paciente");
      if (auto?.delivery === "error") toast.warning("La auto-entrega falló; envía manualmente desde Entrega");

      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <Card key={g.orderItemId}>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">{g.studyNombre}</CardTitle>
            <div className="flex items-center gap-2">
              {!g.processable && (
                <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" /> Muestra sin procesar — solo lectura
                </span>
              )}
              <Badge className="bg-muted text-foreground">{ITEM_STATUS_LABELS[g.status]}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[32%]">Analito</TableHead>
                  <TableHead className="w-[24%]">Resultado</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Indicador</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {g.analytes.map((a) => {
                  const key = `${g.orderItemId}:${a.analyteId}`;
                  // Bloqueado si ya está validado o si la muestra del estudio
                  // aún no fue procesada (fase analítica sin concluir).
                  const locked = a.status === "validado" || !g.processable;
                  // Indicador en vivo: recalculado con el valor que se está
                  // digitando, con el mismo criterio que el servidor. Si el campo
                  // está vacío, se muestra el flag del último guardado.
                  const raw = values[key]?.trim() ?? "";
                  const liveFlag =
                    raw === ""
                      ? a.flag
                      : a.valueType === "numerico"
                        ? evalFlagNum(Number(raw), a.range)
                        : evalFlagText(raw, a.range);
                  return (
                    <TableRow key={a.analyteId}>
                      <TableCell className="font-medium">{a.nombre}</TableCell>
                      <TableCell>
                        {a.valueType === "opcion" && a.opciones ? (
                          <select
                            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm disabled:opacity-60"
                            value={values[key] ?? ""}
                            disabled={locked}
                            onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                          >
                            <option value="">—</option>
                            {a.opciones.map((op) => (
                              <option key={op} value={op}>
                                {op}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Input
                            type={a.valueType === "numerico" ? "number" : "text"}
                            step="any"
                            value={values[key] ?? ""}
                            disabled={locked}
                            onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                            className={cn(
                              locked && "opacity-70",
                              // Semaforización: el borde refleja el indicador en vivo
                              liveFlag === "critico_alto" || liveFlag === "critico_bajo"
                                ? "border-l-4 border-l-red-500"
                                : liveFlag === "alto" || liveFlag === "bajo" || liveFlag === "anormal"
                                  ? "border-l-4 border-l-amber-500"
                                  : liveFlag === "normal"
                                    ? "border-l-4 border-l-emerald-500"
                                    : undefined
                            )}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.unidad ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.rango ?? "—"}</TableCell>
                      <TableCell>
                        {liveFlag ? (
                          <span className={cn("text-sm", FLAG_COLORS[liveFlag])}>{FLAG_LABELS[liveFlag]}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {g.analytes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-4 text-center text-sm text-muted-foreground">
                      Este estudio no tiene analitos configurados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      <div className="sticky bottom-4 flex items-center gap-2 rounded-lg border bg-card/90 p-3 shadow-lg backdrop-blur">
        {allValidated ? (
          <>
            <span className="flex-1 text-sm text-muted-foreground">
              Orden completada y firmada. Siguiente paso: entregar al paciente.
            </span>
            <Button asChild>
              <Link href="/entrega">
                <Send className="h-4 w-4" /> Ir a Entrega <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </>
        ) : !anyProcessable ? (
          <span className="flex-1 text-sm text-muted-foreground">
            Ningún estudio tiene la muestra procesada todavía. El ingreso de
            resultados se habilita al concluir el procesamiento (módulo Muestras).
          </span>
        ) : (
          <div className="flex flex-1 justify-end gap-2">
            {/* Carga masiva de resultados desde un documento (CSV/analizador).
                Deshabilitado por ahora: se habilitará cuando exista el parser
                de importación para estudios con muchos campos. */}
            <Button
              variant="outline"
              disabled
              title="Próximamente: cargar resultados desde un documento (CSV / analizador)"
              className="text-muted-foreground"
            >
              <Upload className="h-4 w-4" />
              Importar
            </Button>
            <Button variant="outline" onClick={() => run(false)} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar borrador
            </Button>
            {canValidate && (
              <Button onClick={() => run(true)} disabled={pending}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Validar y firmar
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Valores críticos: exige registrar la constancia de aviso (ISO 15189) */}
      <Dialog open={criticos.length > 0} onOpenChange={() => undefined}>
        <DialogContent className="max-w-md border-red-300 dark:border-red-900 [&>button]:hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-5 w-5 animate-pulse-glow rounded-full" />
              Valores críticos — registrar aviso
            </DialogTitle>
          </DialogHeader>
          <ul className="space-y-2">
            {criticos.map((c, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm dark:border-red-900 dark:bg-red-950/40"
              >
                <span className="font-medium">{c.analito}</span>
                <span className="font-mono text-red-700 dark:text-red-300">{c.valor}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            Comunica estos resultados al médico o servicio solicitante de inmediato y
            registra la constancia. Este registro queda en la trazabilidad de la orden.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="avisado-a">Se avisó a *</Label>
            <ProfessionalPicker
              value={avisadoAId}
              onChange={(id) => setAvisadoAId(id)}
              freeText={avisadoA}
              onFreeTextChange={(t) => setAvisadoA(t)}
            />
            <Input
              id="avisado-a"
              value={avisadoA}
              onChange={(e) => setAvisadoA(e.target.value)}
              placeholder="O escribe manualmente: Dr./Dra., servicio…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="medio-aviso">Medio</Label>
            <select
              id="medio-aviso"
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={medioAviso}
              onChange={(e) => setMedioAviso(e.target.value)}
            >
              <option value="telefono">Teléfono</option>
              <option value="email">Email</option>
              <option value="presencial">Presencial</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nota-aviso">Nota (opcional)</Label>
            <Input
              id="nota-aviso"
              value={notaAviso}
              onChange={(e) => setNotaAviso(e.target.value)}
              placeholder="Ej. se indicó repetir la toma en 2 horas"
            />
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              disabled={savingAviso || !avisadoA.trim()}
              onClick={() =>
                startAviso(async () => {
                  const r = await recordCriticalNotificationAction(
                    orderId,
                    criticos,
                    avisadoA,
                    medioAviso,
                    notaAviso,
                    avisadoAId ?? undefined
                  );
                  if ("error" in r && r.error) {
                    toast.error(r.error);
                    return;
                  }
                  toast.success("Aviso crítico registrado en la trazabilidad");
                  setCriticos([]);
                  setAvisadoA("");
                  setAvisadoAId(null);
                  setNotaAviso("");
                })
              }
            >
              {savingAviso && <Loader2 className="h-4 w-4 animate-spin" />}
              Registrar aviso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delta check: variación anómala frente al histórico del paciente */}
      <Dialog open={deltas.length > 0} onOpenChange={(o) => !o && setDeltas([])}>
        <DialogContent className="max-w-md border-amber-300 dark:border-amber-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" /> Fallo delta — verificar identidad de la muestra
            </DialogTitle>
          </DialogHeader>
          <ul className="space-y-2">
            {deltas.map((d, i) => (
              <li
                key={i}
                className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900 dark:bg-amber-950/40"
              >
                <p className="font-medium">{d.analito}</p>
                <p className="text-xs text-muted-foreground">
                  Anterior: <span className="font-mono">{d.anterior}</span> → Actual:{" "}
                  <span className="font-mono font-semibold text-amber-700 dark:text-amber-300">
                    {d.actual}
                  </span>
                </p>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            La variación frente al último resultado validado del paciente supera el umbral.
            Verifica que el tubo corresponda al paciente y que el analizador esté calibrado
            antes de firmar.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeltas([])}>
              Revisado, continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
