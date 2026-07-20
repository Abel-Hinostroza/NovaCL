-- ============================================================================
-- 0018 · Inventario de insumos y reactivos (módulo Inventario)
--
-- Control de existencias multi-sede con lotes y vencimientos (crítico para un
-- laboratorio clínico), movimientos trazables (entrada/salida/ajuste/merma/
-- transferencia) y galería de imágenes por artículo (Storage bucket `inventory`).
-- ============================================================================

create type app.inventory_item_type as enum (
  'reactivo',     -- reactivos de laboratorio
  'insumo',       -- insumos consumibles (tubos, viales…)
  'consumible',   -- material de oficina/limpieza
  'epp',          -- equipo de protección personal
  'equipo',       -- equipos / instrumental
  'otro'
);

create type app.inventory_movement_type as enum (
  'entrada',        -- compra / ingreso
  'salida',         -- consumo
  'ajuste',         -- ajuste por conteo físico (fija el valor absoluto)
  'merma',          -- baja por vencimiento / daño
  'transferencia'   -- traspaso entre sedes
);

-- ─────────────────────────────────────────────────────────────
-- Artículos (catálogo de inventario, por organización)
-- ─────────────────────────────────────────────────────────────
create table public."LIS_inventory_items" (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public."LIS_organizations"(id) on delete cascade,
  codigo                 text not null,
  nombre                 text not null,
  descripcion            text,
  categoria              text,
  tipo                   app.inventory_item_type not null default 'insumo',
  unidad                 text not null default 'unidad',   -- unidad de medida
  stock_minimo           numeric(12,2) not null default 0, -- punto de reposición
  stock_maximo           numeric(12,2),
  requiere_refrigeracion boolean not null default false,
  controlado             boolean not null default false,   -- requiere control especial
  ubicacion              text,                             -- estante / almacén
  proveedor              text,
  codigo_barras          text,
  costo_referencia       numeric(12,2),
  imagen_url             text,                             -- foto principal
  imagenes               jsonb not null default '[]'::jsonb, -- galería (urls)
  activo                 boolean not null default true,
  created_by             uuid references public."LIS_profiles"(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (organization_id, codigo)
);
create index "LIS_idx_inv_items_org" on public."LIS_inventory_items"(organization_id, activo);
create index "LIS_idx_inv_items_nombre" on public."LIS_inventory_items"
  using gin (nombre gin_trgm_ops);
create trigger trg_inv_items_touch before update on public."LIS_inventory_items"
  for each row execute function app.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Existencias por sede y lote (un renglón por item+sede+lote+vencimiento)
-- ─────────────────────────────────────────────────────────────
create table public."LIS_inventory_stock" (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public."LIS_organizations"(id) on delete cascade,
  item_id         uuid not null references public."LIS_inventory_items"(id) on delete cascade,
  sede_id         uuid not null references public."LIS_sedes"(id) on delete cascade,
  lote            text,
  vencimiento     date,
  cantidad        numeric(12,2) not null default 0,
  updated_at      timestamptz not null default now(),
  unique nulls not distinct (item_id, sede_id, lote, vencimiento)
);
create index "LIS_idx_inv_stock_item" on public."LIS_inventory_stock"(item_id, sede_id);
create index "LIS_idx_inv_stock_sede" on public."LIS_inventory_stock"(sede_id);
create index "LIS_idx_inv_stock_venc" on public."LIS_inventory_stock"(vencimiento)
  where cantidad > 0;
create trigger trg_inv_stock_touch before update on public."LIS_inventory_stock"
  for each row execute function app.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Movimientos (bitácora de inventario, append-only desde la app)
-- ─────────────────────────────────────────────────────────────
create table public."LIS_inventory_movements" (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public."LIS_organizations"(id) on delete cascade,
  item_id         uuid not null references public."LIS_inventory_items"(id) on delete cascade,
  sede_id         uuid not null references public."LIS_sedes"(id) on delete cascade,
  tipo            app.inventory_movement_type not null,
  cantidad        numeric(12,2) not null,       -- magnitud del movimiento (positiva)
  delta           numeric(12,2) not null,       -- efecto neto sobre la sede origen
  stock_resultante numeric(12,2) not null,      -- existencia tras el movimiento
  lote            text,
  vencimiento     date,
  motivo          text,
  referencia      text,                         -- p. ej. código de orden / factura
  sede_destino_id uuid references public."LIS_sedes"(id) on delete set null,
  costo_unitario  numeric(12,2),
  created_by      uuid references public."LIS_profiles"(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index "LIS_idx_inv_mov_item" on public."LIS_inventory_movements"(item_id, created_at desc);
create index "LIS_idx_inv_mov_sede" on public."LIS_inventory_movements"(sede_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- RPC: registrar un movimiento y actualizar existencias atómicamente.
-- Devuelve el movimiento insertado.
-- ─────────────────────────────────────────────────────────────
create or replace function public.inventory_register_movement(
  p_item_id         uuid,
  p_sede_id         uuid,
  p_tipo            app.inventory_movement_type,
  p_cantidad        numeric,
  p_lote            text default null,
  p_vencimiento     date default null,
  p_motivo          text default null,
  p_referencia      text default null,
  p_sede_destino_id uuid default null,
  p_costo_unitario  numeric default null
) returns public."LIS_inventory_movements"
language plpgsql security definer set search_path = public
as $$
declare
  v_org       uuid;
  v_actual    numeric(12,2);
  v_delta     numeric(12,2);
  v_nuevo     numeric(12,2);
  v_mov       public."LIS_inventory_movements";
begin
  select organization_id into v_org from public."LIS_inventory_items" where id = p_item_id;
  if v_org is null then raise exception 'Artículo no encontrado'; end if;

  -- Autorización: el usuario debe poder administrar/operar la sede
  if not app.has_sede_role(p_sede_id,
        array['org_admin','sede_admin','analista','toma_muestra','recepcion']::app.role[]) then
    raise exception 'No autorizado para mover inventario en esta sede';
  end if;
  if p_cantidad is null or p_cantidad < 0 then
    raise exception 'La cantidad debe ser positiva';
  end if;

  -- Existencia actual del renglón (item+sede+lote+vencimiento)
  select cantidad into v_actual
  from public."LIS_inventory_stock"
  where item_id = p_item_id and sede_id = p_sede_id
    and lote is not distinct from p_lote
    and vencimiento is not distinct from p_vencimiento;
  v_actual := coalesce(v_actual, 0);

  -- Efecto según el tipo de movimiento
  if p_tipo = 'entrada' then
    v_delta := p_cantidad;
  elsif p_tipo in ('salida', 'merma') then
    v_delta := -p_cantidad;
  elsif p_tipo = 'transferencia' then
    if p_sede_destino_id is null or p_sede_destino_id = p_sede_id then
      raise exception 'La transferencia requiere una sede destino distinta';
    end if;
    v_delta := -p_cantidad;
  elsif p_tipo = 'ajuste' then
    -- Ajuste fija el valor absoluto contado
    v_delta := p_cantidad - v_actual;
  else
    raise exception 'Tipo de movimiento no soportado';
  end if;

  v_nuevo := v_actual + v_delta;
  if v_nuevo < 0 then
    raise exception 'Existencia insuficiente: hay % y se intentó retirar %', v_actual, p_cantidad;
  end if;

  -- Actualizar existencia de la sede origen
  insert into public."LIS_inventory_stock"(organization_id, item_id, sede_id, lote, vencimiento, cantidad)
  values (v_org, p_item_id, p_sede_id, p_lote, p_vencimiento, v_nuevo)
  on conflict (item_id, sede_id, lote, vencimiento)
  do update set cantidad = v_nuevo, updated_at = now();

  -- Transferencia: sumar en la sede destino
  if p_tipo = 'transferencia' then
    insert into public."LIS_inventory_stock"(organization_id, item_id, sede_id, lote, vencimiento, cantidad)
    values (v_org, p_item_id, p_sede_destino_id, p_lote, p_vencimiento, p_cantidad)
    on conflict (item_id, sede_id, lote, vencimiento)
    do update set cantidad = public."LIS_inventory_stock".cantidad + p_cantidad, updated_at = now();
  end if;

  insert into public."LIS_inventory_movements"(
    organization_id, item_id, sede_id, tipo, cantidad, delta, stock_resultante,
    lote, vencimiento, motivo, referencia, sede_destino_id, costo_unitario, created_by
  ) values (
    v_org, p_item_id, p_sede_id, p_tipo, p_cantidad, v_delta, v_nuevo,
    p_lote, p_vencimiento, p_motivo, p_referencia, p_sede_destino_id, p_costo_unitario, auth.uid()
  ) returning * into v_mov;

  return v_mov;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Vista: existencia consolidada por artículo y sede, con estado.
-- ─────────────────────────────────────────────────────────────
create or replace view public.v_inventory_stock
with (security_invoker = true) as
select
  i.id                                   as item_id,
  i.organization_id,
  st.sede_id,
  i.codigo,
  i.nombre,
  i.categoria,
  i.tipo,
  i.unidad,
  i.stock_minimo,
  i.stock_maximo,
  i.requiere_refrigeracion,
  i.imagen_url,
  i.activo,
  coalesce(sum(st.cantidad), 0)          as stock,
  count(st.id) filter (where st.cantidad > 0)                          as lotes,
  min(st.vencimiento) filter (where st.cantidad > 0 and st.vencimiento is not null)
                                         as proximo_vencimiento,
  case
    when coalesce(sum(st.cantidad), 0) <= 0 then 'agotado'
    when coalesce(sum(st.cantidad), 0) <= i.stock_minimo then 'bajo'
    else 'ok'
  end                                    as estado
from public."LIS_inventory_items" i
left join public."LIS_inventory_stock" st on st.item_id = i.id
group by i.id, st.sede_id;

-- ─────────────────────────────────────────────────────────────
-- Vista: lotes por vencer o vencidos (con existencia) para alertas.
-- ─────────────────────────────────────────────────────────────
create or replace view public.v_inventory_expiring
with (security_invoker = true) as
select
  st.id,
  st.organization_id,
  st.sede_id,
  st.item_id,
  i.codigo,
  i.nombre,
  i.unidad,
  s.nombre                               as sede_nombre,
  st.lote,
  st.vencimiento,
  st.cantidad,
  (st.vencimiento - current_date)        as dias_para_vencer
from public."LIS_inventory_stock" st
join public."LIS_inventory_items" i on i.id = st.item_id
join public."LIS_sedes" s on s.id = st.sede_id
where st.cantidad > 0
  and st.vencimiento is not null
  and st.vencimiento <= current_date + 60;

-- ─────────────────────────────────────────────────────────────
-- RLS
--   SELECT: existencias/artículos visibles a los miembros de la org (stock y
--           movimientos, además, acotados a las sedes visibles del usuario).
--   ESCRITURA de artículos: administradores de la organización.
--   Movimientos: se insertan vía RPC (security definer); igualmente se permite
--                a los roles operativos por si se accede directo.
-- ─────────────────────────────────────────────────────────────
alter table public."LIS_inventory_items"     enable row level security;
alter table public."LIS_inventory_stock"     enable row level security;
alter table public."LIS_inventory_movements" enable row level security;

create policy inv_items_select on public."LIS_inventory_items" for select to authenticated
  using (app.is_superadmin() or organization_id in (select app.member_org_ids()));
create policy inv_items_write on public."LIS_inventory_items" for all to authenticated
  using (app.can_admin_org(organization_id))
  with check (app.can_admin_org(organization_id));

create policy inv_stock_select on public."LIS_inventory_stock" for select to authenticated
  using (app.is_superadmin() or sede_id in (select app.member_sede_ids()));

create policy inv_mov_select on public."LIS_inventory_movements" for select to authenticated
  using (app.is_superadmin() or sede_id in (select app.member_sede_ids()));
create policy inv_mov_insert on public."LIS_inventory_movements" for insert to authenticated
  with check (app.has_sede_role(sede_id,
    array['org_admin','sede_admin','analista','toma_muestra','recepcion']::app.role[]));

-- Auditoría (trazabilidad total, con sede)
create trigger trg_audit_inv_items
  after insert or update or delete on public."LIS_inventory_items"
  for each row execute function app.audit_trigger();
create trigger trg_audit_inv_movements
  after insert or update or delete on public."LIS_inventory_movements"
  for each row execute function app.audit_trigger();

-- ─────────────────────────────────────────────────────────────
-- Storage: bucket público `inventory` para las fotos de los artículos.
--   Path: inventory/{organization_id}/{item_id|tmp}/{uuid}.ext
--   Lectura pública (fotos de producto, no sensibles); escritura acotada a
--   los miembros de la organización dueña del primer segmento del path.
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('inventory', 'inventory', true)
on conflict (id) do nothing;

drop policy if exists "inventory_insert_org" on storage.objects;
create policy "inventory_insert_org" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'inventory'
    and (split_part(name, '/', 1))::uuid in (select app.member_org_ids())
  );

drop policy if exists "inventory_update_org" on storage.objects;
create policy "inventory_update_org" on storage.objects for update to authenticated
  using (
    bucket_id = 'inventory'
    and (split_part(name, '/', 1))::uuid in (select app.member_org_ids())
  );

drop policy if exists "inventory_delete_org" on storage.objects;
create policy "inventory_delete_org" on storage.objects for delete to authenticated
  using (
    bucket_id = 'inventory'
    and (split_part(name, '/', 1))::uuid in (select app.member_org_ids())
  );
