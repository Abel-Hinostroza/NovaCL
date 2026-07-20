"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Boxes,
  TriangleAlert,
  PackageX,
  CalendarClock,
  Search,
  Snowflake,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ItemDialog } from "@/components/inventory/item-dialog";
import { MovementDialog } from "@/components/inventory/movement-dialog";
import {
  INVENTORY_TYPE_LABELS,
  INVENTORY_ESTADO_LABELS,
  INVENTORY_ESTADO_COLORS,
} from "@/lib/constants";
import { cn, formatDate } from "@/lib/utils";
import type { InventoryItemType, Tables } from "@/lib/database.types";

export type InventoryRow = Tables<"LIS_inventory_items"> & {
  stock: number;
  estado: "ok" | "bajo" | "agotado";
  proximo_vencimiento: string | null;
};

type Estado = "ok" | "bajo" | "agotado";

export function InventoryClient({
  rows,
  orgId,
  sedes,
  activeSedeId,
  sedeNombre,
  canManage,
  canOperate,
}: {
  rows: InventoryRow[];
  orgId: string;
  sedes: { id: string; nombre: string; codigo: string }[];
  activeSedeId: string | null;
  sedeNombre: string;
  canManage: boolean;
  canOperate: boolean;
}) {
  const [q, setQ] = useState("");
  const [fEstado, setFEstado] = useState<Estado | null>(null);
  const [fTipo, setFTipo] = useState<InventoryItemType | null>(null);

  const kpis = useMemo(() => {
    const bajo = rows.filter((r) => r.estado === "bajo").length;
    const agotado = rows.filter((r) => r.estado === "agotado").length;
    const porVencer = rows.filter((r) => {
      if (!r.proximo_vencimiento) return false;
      const dias = Math.ceil(
        (new Date(r.proximo_vencimiento).getTime() - Date.now()) / 86_400_000
      );
      return dias <= 60;
    }).length;
    return { total: rows.length, bajo, agotado, porVencer };
  }, [rows]);

  const filtradas = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (fEstado === null || r.estado === fEstado) &&
        (fTipo === null || r.tipo === fTipo) &&
        (!term ||
          r.nombre.toLowerCase().includes(term) ||
          r.codigo.toLowerCase().includes(term) ||
          (r.categoria ?? "").toLowerCase().includes(term))
    );
  }, [rows, q, fEstado, fTipo]);

  const tiposEnUso = useMemo(
    () => [...new Set(rows.map((r) => r.tipo))],
    [rows]
  );
  const filtros = fEstado !== null || fTipo !== null || q.trim() !== "";

  const KPIS = [
    { label: "Artículos", value: kpis.total, icon: Boxes, accent: "text-primary" },
    { label: "Stock bajo", value: kpis.bajo, icon: TriangleAlert, accent: "text-amber-600", estado: "bajo" as Estado },
    { label: "Agotados", value: kpis.agotado, icon: PackageX, accent: "text-red-600", estado: "agotado" as Estado },
    { label: "Por vencer (60 d)", value: kpis.porVencer, icon: CalendarClock, accent: "text-orange-600" },
  ];

  return (
    <div className="space-y-4">
      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPIS.map((k) => (
          <Card
            key={k.label}
            className={cn(
              "cursor-default transition-colors",
              k.estado && "cursor-pointer",
              k.estado && fEstado === k.estado && "border-primary shadow-glow"
            )}
            onClick={() => k.estado && setFEstado(fEstado === k.estado ? null : k.estado)}
          >
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-sm text-muted-foreground">{k.label}</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight">{k.value}</p>
              </div>
              <div className={cn("rounded-lg bg-muted p-3", k.accent)}>
                <k.icon className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, código o categoría…"
            className="pl-9"
          />
        </div>
        {tiposEnUso.map((t) => (
          <button
            key={t}
            onClick={() => setFTipo(fTipo === t ? null : t)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              fTipo === t
                ? "border-primary bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent"
            )}
          >
            {INVENTORY_TYPE_LABELS[t]}
          </button>
        ))}
        {filtros && (
          <button
            onClick={() => {
              setQ("");
              setFEstado(null);
              setFTipo(null);
            }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" /> Limpiar
          </button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          Existencias en {sedeNombre}
        </span>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtradas.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12" />
                  <TableHead>Artículo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Próx. venc.</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="relative h-10 w-10 overflow-hidden rounded-md border bg-muted">
                        {r.imagen_url ? (
                          <Image
                            src={r.imagen_url}
                            alt={r.nombre}
                            fill
                            sizes="40px"
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-muted-foreground">
                            <Boxes className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/inventario/${r.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {r.nombre}
                      </Link>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {r.codigo}
                        {r.categoria ? ` · ${r.categoria}` : ""}
                        {r.requiere_refrigeracion && (
                          <Snowflake className="h-3 w-3 text-sky-500" />
                        )}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {INVENTORY_TYPE_LABELS[r.tipo]}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-medium">{r.stock}</span>{" "}
                      <span className="text-xs text-muted-foreground">{r.unidad}</span>
                      {r.stock_minimo > 0 && (
                        <p className="text-[11px] text-muted-foreground">mín {r.stock_minimo}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("border-transparent", INVENTORY_ESTADO_COLORS[r.estado])}>
                        {INVENTORY_ESTADO_LABELS[r.estado]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.proximo_vencimiento ? formatDate(r.proximo_vencimiento) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canOperate && (
                          <MovementDialog
                            itemId={r.id}
                            itemNombre={r.nombre}
                            unidad={r.unidad}
                            sedes={sedes}
                            activeSedeId={activeSedeId}
                          />
                        )}
                        {canManage && <ItemDialog orgId={orgId} item={r} />}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {rows.length === 0
                ? "Aún no hay artículos. Crea el primero."
                : "Ningún artículo coincide con los filtros."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
