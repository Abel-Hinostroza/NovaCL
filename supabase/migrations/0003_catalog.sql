-- ============================================================================
-- 0003 · Catalogo de laboratorio (modular)
--   Base global (plantillas) + overrides por organizacion.
--   categorias -> analitos -> rangos de referencia
--   estudios/perfiles -> analitos que los componen -> precios por sede
-- ============================================================================

-- Tipos de muestra (sangre, orina, heces, etc.)
create table public."LIS_specimen_types" (
  id            uuid primary key default gen_random_uuid(),
  codigo        text not null unique,
  nombre        text not null,
  descripcion   text,
  activo        boolean not null default true
);

-- Categorias de estudios (hematologia, bioquimica, microbiologia, ...)
-- organization_id NULL => plantilla global compartida.
create table public."LIS_test_categories" (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public."LIS_organizations"(id) on delete cascade,
  codigo          text not null,
  nombre          text not null,
  descripcion     text,
  orden           int not null default 0,
  activo          boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (organization_id, codigo)
);
create index "LIS_idx_categories_org" on public."LIS_test_categories"(organization_id);

-- Analitos / parametros individuales (hemoglobina, glucosa, TSH, ...)
create table public."LIS_analytes" (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public."LIS_organizations"(id) on delete cascade,
  category_id     uuid references public."LIS_test_categories"(id) on delete set null,
  codigo          text not null,
  nombre          text not null,
  abreviatura     text,
  loinc_code      text,                       -- estandar internacional
  unidad          text,                       -- g/dL, mg/dL, U/L...
  value_type      app.value_type not null default 'numerico',
  opciones        jsonb,                      -- para value_type='opcion' (positivo/negativo...)
  decimales       int not null default 2,
  metodo          text,                       -- metodo analitico
  orden           int not null default 0,
  activo          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, codigo)
);
create index "LIS_idx_analytes_org" on public."LIS_analytes"(organization_id);
create index "LIS_idx_analytes_cat" on public."LIS_analytes"(category_id);
create index "LIS_idx_analytes_nombre_trgm" on public."LIS_analytes" using gin (nombre gin_trgm_ops);
create trigger trg_analyte_touch before update on public."LIS_analytes"
  for each row execute function app.touch_updated_at();

-- Rangos de referencia por analito (segun sexo y edad)
create table public."LIS_reference_ranges" (
  id              uuid primary key default gen_random_uuid(),
  analyte_id      uuid not null references public."LIS_analytes"(id) on delete cascade,
  sexo            app.sex not null default 'desconocido',
  edad_min_dias   int,                        -- limite inferior de edad en dias
  edad_max_dias   int,
  valor_min       numeric,
  valor_max       numeric,
  critico_min     numeric,
  critico_max     numeric,
  texto_normal    text,                       -- para cualitativos: "Negativo"
  nota            text,
  created_at      timestamptz not null default now()
);
create index "LIS_idx_refranges_analyte" on public."LIS_reference_ranges"(analyte_id);

-- Estudios / perfiles que se ordenan (Hemograma, Perfil lipidico, ...)
create table public."LIS_studies" (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid references public."LIS_organizations"(id) on delete cascade,
  category_id       uuid references public."LIS_test_categories"(id) on delete set null,
  specimen_type_id  uuid references public."LIS_specimen_types"(id) on delete set null,
  codigo            text not null,
  nombre            text not null,
  descripcion       text,
  loinc_code        text,
  tiempo_entrega_h  int,                       -- TAT objetivo en horas
  requiere_ayuno    boolean not null default false,
  indicaciones      text,                      -- preparacion del paciente
  activo            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (organization_id, codigo)
);
create index "LIS_idx_studies_org" on public."LIS_studies"(organization_id);
create index "LIS_idx_studies_cat" on public."LIS_studies"(category_id);
create index "LIS_idx_studies_nombre_trgm" on public."LIS_studies" using gin (nombre gin_trgm_ops);
create trigger trg_study_touch before update on public."LIS_studies"
  for each row execute function app.touch_updated_at();

-- Composicion: analitos que integran cada estudio
create table public."LIS_study_analytes" (
  id          uuid primary key default gen_random_uuid(),
  study_id    uuid not null references public."LIS_studies"(id) on delete cascade,
  analyte_id  uuid not null references public."LIS_analytes"(id) on delete cascade,
  orden       int not null default 0,
  formula     text,                            -- para calculados (ej. VLDL = TG/5)
  unique (study_id, analyte_id)
);
create index "LIS_idx_study_analytes_study" on public."LIS_study_analytes"(study_id);

-- Precios por organizacion/sede y moneda
create table public."LIS_study_prices" (
  id          uuid primary key default gen_random_uuid(),
  study_id    uuid not null references public."LIS_studies"(id) on delete cascade,
  sede_id     uuid references public."LIS_sedes"(id) on delete cascade,  -- null => precio base org
  moneda      text not null default 'PEN',
  precio      numeric(12,2) not null default 0,
  vigente_desde date not null default current_date,
  activo      boolean not null default true,
  unique (study_id, sede_id, moneda, vigente_desde)
);
create index "LIS_idx_prices_study" on public."LIS_study_prices"(study_id);
