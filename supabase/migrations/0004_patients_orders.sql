-- ============================================================================
-- 0004 · Pacientes y ordenes de atencion
-- ============================================================================

-- ─────────────────────────────────────────────────────────────
-- Pacientes (por organizacion, compartidos entre sedes)
-- ─────────────────────────────────────────────────────────────
create table public."LIS_patients" (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public."LIS_organizations"(id) on delete cascade,
  tipo_documento    text not null default 'DNI',
  numero_documento  text not null,
  nombres           text not null,
  apellidos         text not null,
  fecha_nacimiento  date,
  sexo              app.sex not null default 'desconocido',
  telefono          text,
  email             citext,
  direccion         text,
  -- vinculo opcional a una cuenta de portal del paciente
  portal_user_id    uuid references public."LIS_profiles"(id) on delete set null,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (organization_id, tipo_documento, numero_documento)
);
create index "LIS_idx_patients_org" on public."LIS_patients"(organization_id);
create index "LIS_idx_patients_doc" on public."LIS_patients"(numero_documento);
create index "LIS_idx_patients_nombre_trgm" on public."LIS_patients"
  using gin ((nombres || ' ' || apellidos) gin_trgm_ops);
create trigger trg_patient_touch before update on public."LIS_patients"
  for each row execute function app.touch_updated_at();

-- Edad en dias (para seleccionar rango de referencia)
create or replace function app.patient_age_days(p_fecha_nac date)
returns int
language sql immutable
as $$
  select case when p_fecha_nac is null then null
              else (current_date - p_fecha_nac) end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Secuencia legible de ordenes por organizacion
-- ─────────────────────────────────────────────────────────────
create table public."LIS_order_counters" (
  organization_id uuid primary key references public."LIS_organizations"(id) on delete cascade,
  last_number     bigint not null default 0
);

create or replace function app.next_order_code(p_org uuid)
returns text
language plpgsql
as $$
declare
  n bigint;
begin
  insert into public."LIS_order_counters"(organization_id, last_number)
    values (p_org, 1)
  on conflict (organization_id)
    do update set last_number = public."LIS_order_counters".last_number + 1
  returning last_number into n;
  return 'ORD-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 6, '0');
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Ordenes (una por atencion / visita)
-- ─────────────────────────────────────────────────────────────
create table public."LIS_orders" (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public."LIS_organizations"(id) on delete cascade,
  sede_id           uuid not null references public."LIS_sedes"(id) on delete restrict,
  patient_id        uuid not null references public."LIS_patients"(id) on delete restrict,
  codigo            text not null,
  status            app.order_status not null default 'registrada',
  prioridad         app.order_priority not null default 'rutina',
  medico_solicitante text,
  diagnostico       text,
  observaciones     text,
  moneda            text not null default 'PEN',
  total             numeric(12,2) not null default 0,
  created_by        uuid references public."LIS_profiles"(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (organization_id, codigo)
);
create index "LIS_idx_orders_org" on public."LIS_orders"(organization_id);
create index "LIS_idx_orders_sede" on public."LIS_orders"(sede_id);
create index "LIS_idx_orders_patient" on public."LIS_orders"(patient_id);
create index "LIS_idx_orders_status" on public."LIS_orders"(status);
create index "LIS_idx_orders_created" on public."LIS_orders"(created_at desc);
create trigger trg_order_touch before update on public."LIS_orders"
  for each row execute function app.touch_updated_at();

-- Items de la orden (un estudio ordenado)
create table public."LIS_order_items" (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public."LIS_orders"(id) on delete cascade,
  study_id      uuid not null references public."LIS_studies"(id) on delete restrict,
  status        app.item_status not null default 'pendiente',
  precio        numeric(12,2) not null default 0,
  descuento     numeric(12,2) not null default 0,
  -- snapshot para reportes historicos
  study_nombre  text not null,
  study_codigo  text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index "LIS_idx_order_items_order" on public."LIS_order_items"(order_id);
create index "LIS_idx_order_items_study" on public."LIS_order_items"(study_id);
create index "LIS_idx_order_items_status" on public."LIS_order_items"(status);
create trigger trg_order_item_touch before update on public."LIS_order_items"
  for each row execute function app.touch_updated_at();
