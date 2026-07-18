"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save, ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { saveResultsAction, validateResultsAction, type ResultInput } from "@/lib/actions/results";
import { FLAG_LABELS, FLAG_COLORS, ITEM_STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
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
  status: ResultStatus | null;
};

export type ItemGroup = {
  orderItemId: string;
  studyNombre: string;
  status: ItemStatus;
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
      for (const a of g.analytes) {
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
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <Card key={g.orderItemId}>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">{g.studyNombre}</CardTitle>
            <Badge className="bg-muted text-foreground">{ITEM_STATUS_LABELS[g.status]}</Badge>
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
                  const locked = a.status === "validado";
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
                            className={cn(locked && "opacity-70")}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.unidad ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.rango ?? "—"}</TableCell>
                      <TableCell>
                        {a.flag ? (
                          <span className={cn("text-sm", FLAG_COLORS[a.flag])}>{FLAG_LABELS[a.flag]}</span>
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

      <div className="sticky bottom-4 flex justify-end gap-2 rounded-lg border bg-card/90 p-3 shadow-lg backdrop-blur">
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
    </div>
  );
}
