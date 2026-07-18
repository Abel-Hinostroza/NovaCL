-- ============================================================================
-- 0005 · Muestras y resultados (nucleo de trazabilidad analitica)
-- ============================================================================

-- ─────────────────────────────────────────────────────────────
-- Muestras (con codigo de barras para trazabilidad)
-- ─────────────────────────────────────────────────────────────
create table public."LIS_samples" (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public."LIS_organizations"(id) on delete cascade,
  order_id          uuid not null references public."LIS_orders"(id) on delete cascade,
  specimen_type_id  uuid references public."LIS_specimen_types"(id) on delete set null,
  barcode           text not null unique,
  status            app.sample_status not null default 'pendiente',
  sede_toma_id      uuid references public."LIS_sedes"(id) on delete set null,
  sede_proceso_id   uuid references public."LIS_sedes"(id) on delete set null,
  tomada_por        uuid references public."LIS_profiles"(id) on delete set null,
  tomada_at         timestamptz,
  recibida_por      uuid references public."LIS_profiles"(id) on delete set null,
  recibida_at       timestamptz,
  motivo_rechazo    text,
  observaciones     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index "LIS_idx_samples_org" on public."LIS_samples"(organization_id);
create index "LIS_idx_samples_order" on public."LIS_samples"(order_id);
create index "LIS_idx_samples_status" on public."LIS_samples"(status);
create trigger trg_sample_touch before update on public."LIS_samples"
  for each row execute function app.touch_updated_at();

-- Relacion muestra <-> item de orden (una muestra puede cubrir varios estudios)
create table public."LIS_sample_items" (
  id            uuid primary key default gen_random_uuid(),
  sample_id     uuid not null references public."LIS_samples"(id) on delete cascade,
  order_item_id uuid not null references public."LIS_order_items"(id) on delete cascade,
  unique (sample_id, order_item_id)
);
create index "LIS_idx_sample_items_sample" on public."LIS_sample_items"(sample_id);
create index "LIS_idx_sample_items_item" on public."LIS_sample_items"(order_item_id);

-- ─────────────────────────────────────────────────────────────
-- Resultados (un valor por analito por item de orden)
-- ─────────────────────────────────────────────────────────────
create table public."LIS_results" (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public."LIS_organizations"(id) on delete cascade,
  order_item_id     uuid not null references public."LIS_order_items"(id) on delete cascade,
  analyte_id        uuid not null references public."LIS_analytes"(id) on delete restrict,
  -- snapshots para reporte historico
  analyte_nombre    text not null,
  analyte_unidad    text,
  valor_num         numeric,
  valor_texto       text,
  flag              app.result_flag,
  rango_texto       text,                       -- rango de referencia mostrado
  status            app.result_status not null default 'pendiente',
  metodo            text,
  ingresado_por     uuid references public."LIS_profiles"(id) on delete set null,
  ingresado_at      timestamptz,
  validado_por      uuid references public."LIS_profiles"(id) on delete set null,
  validado_at       timestamptz,
  nota              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (order_item_id, analyte_id)
);
create index "LIS_idx_results_org" on public."LIS_results"(organization_id);
create index "LIS_idx_results_item" on public."LIS_results"(order_item_id);
create index "LIS_idx_results_status" on public."LIS_results"(status);
create trigger trg_result_touch before update on public."LIS_results"
  for each row execute function app.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Evaluacion de flag segun rango de referencia
-- ─────────────────────────────────────────────────────────────
create or replace function app.eval_flag(
  p_valor numeric, p_min numeric, p_max numeric,
  p_cmin numeric, p_cmax numeric
) returns app.result_flag
language sql immutable
as $$
  select case
    when p_valor is null then null
    when p_cmin is not null and p_valor < p_cmin then 'critico_bajo'::app.result_flag
    when p_cmax is not null and p_valor > p_cmax then 'critico_alto'::app.result_flag
    when p_min  is not null and p_valor < p_min  then 'bajo'::app.result_flag
    when p_max  is not null and p_valor > p_max  then 'alto'::app.result_flag
    else 'normal'::app.result_flag
  end;
$$;
