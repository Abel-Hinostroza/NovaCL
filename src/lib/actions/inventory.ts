"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext, hasRole } from "@/lib/auth/session";
import type { InventoryMovementType } from "@/lib/database.types";

const ADMIN_ROLES = ["org_admin", "sede_admin"] as const;
const OPERATIVE_ROLES = [
  "org_admin",
  "sede_admin",
  "analista",
  "toma_muestra",
  "recepcion",
] as const;

async function requireInventoryAdmin() {
  const ctx = await getSessionContext();
  if (!hasRole(ctx.roles, [...ADMIN_ROLES]) && !ctx.profile?.es_superadmin) {
    throw new Error("Solo un administrador puede gestionar el catálogo de inventario.");
  }
  return ctx;
}

async function requireInventoryOperator() {
  const ctx = await getSessionContext();
  if (!hasRole(ctx.roles, [...OPERATIVE_ROLES]) && !ctx.profile?.es_superadmin) {
    throw new Error("No autorizado para registrar movimientos de inventario.");
  }
  return ctx;
}

// ── Artículos ────────────────────────────────────────────────
const itemSchema = z.object({
  id: z.string().uuid().optional(),
  codigo: z.string().trim().min(1, "El código es obligatorio"),
  nombre: z.string().trim().min(2, "El nombre es obligatorio"),
  descripcion: z.string().trim().optional(),
  categoria: z.string().trim().optional(),
  tipo: z.enum(["reactivo", "insumo", "consumible", "epp", "equipo", "otro"]),
  unidad: z.string().trim().min(1),
  stock_minimo: z.number().nonnegative().optional(),
  stock_maximo: z.number().nonnegative().nullish(),
  requiere_refrigeracion: z.boolean().optional(),
  controlado: z.boolean().optional(),
  ubicacion: z.string().trim().optional(),
  proveedor: z.string().trim().optional(),
  codigo_barras: z.string().trim().optional(),
  costo_referencia: z.number().nonnegative().nullish(),
  imagenes: z.array(z.string().url()).optional(),
});

export type SaveItemResult = { ok: true; id: string } | { ok: false; error: string };

export async function saveItemAction(input: unknown): Promise<SaveItemResult> {
  const ctx = await requireInventoryAdmin();
  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const d = parsed.data;
  const imagenes = d.imagenes ?? [];

  const supabase = await createClient();
  const row = {
    organization_id: ctx.activeOrgId!,
    codigo: d.codigo,
    nombre: d.nombre,
    descripcion: d.descripcion || null,
    categoria: d.categoria || null,
    tipo: d.tipo,
    unidad: d.unidad,
    stock_minimo: d.stock_minimo ?? 0,
    stock_maximo: d.stock_maximo ?? null,
    requiere_refrigeracion: d.requiere_refrigeracion ?? false,
    controlado: d.controlado ?? false,
    ubicacion: d.ubicacion || null,
    proveedor: d.proveedor || null,
    codigo_barras: d.codigo_barras || null,
    costo_referencia: d.costo_referencia ?? null,
    imagenes,
    imagen_url: imagenes[0] ?? null,
  };

  const query = d.id
    ? supabase.from("LIS_inventory_items").update(row).eq("id", d.id).select("id").single()
    : supabase
        .from("LIS_inventory_items")
        .insert({ ...row, created_by: ctx.user.id })
        .select("id")
        .single();

  const { data: saved, error } = await query;
  revalidatePath("/inventario");
  if (d.id) revalidatePath(`/inventario/${d.id}`);
  if (error) {
    return {
      ok: false,
      error: error.code === "23505" ? "Ya existe un artículo con ese código." : error.message,
    };
  }
  return { ok: true, id: saved.id };
}

export async function toggleItemAction(id: string, activo: boolean) {
  await requireInventoryAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("LIS_inventory_items").update({ activo }).eq("id", id);
  revalidatePath("/inventario");
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}

// ── Movimientos ──────────────────────────────────────────────
const movementSchema = z.object({
  itemId: z.string().uuid(),
  tipo: z.enum(["entrada", "salida", "ajuste", "merma", "transferencia"]),
  cantidad: z.number().nonnegative(),
  lote: z.string().trim().optional(),
  vencimiento: z.string().optional(),
  motivo: z.string().trim().optional(),
  referencia: z.string().trim().optional(),
  sedeDestinoId: z.string().uuid().nullish(),
  costoUnitario: z.number().nonnegative().nullish(),
});

export type MovementResult = { ok: true } | { ok: false; error: string };

export async function registerMovementAction(input: unknown): Promise<MovementResult> {
  const ctx = await requireInventoryOperator();
  const parsed = movementSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const d = parsed.data;
  if (!ctx.activeSedeId) {
    return { ok: false, error: "Selecciona una sede activa para mover inventario." };
  }
  if (d.tipo === "transferencia" && !d.sedeDestinoId) {
    return { ok: false, error: "Elige la sede destino de la transferencia." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("inventory_register_movement", {
    p_item_id: d.itemId,
    p_sede_id: ctx.activeSedeId,
    p_tipo: d.tipo as InventoryMovementType,
    p_cantidad: d.cantidad,
    p_lote: d.lote || null,
    p_vencimiento: d.vencimiento || null,
    p_motivo: d.motivo || null,
    p_referencia: d.referencia || null,
    p_sede_destino_id: d.sedeDestinoId ?? null,
    p_costo_unitario: d.costoUnitario ?? null,
  });

  revalidatePath("/inventario");
  revalidatePath(`/inventario/${d.itemId}`);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
