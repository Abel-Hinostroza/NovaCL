-- ============================================================================
-- 0006 · Entrega de resultados y facturacion (Wally)
-- ============================================================================

-- ─────────────────────────────────────────────────────────────
-- Documentos de reporte generados (PDF en Storage)
-- ─────────────────────────────────────────────────────────────
create table public."LIS_report_documents" (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public."LIS_organizations"(id) on delete cascade,
  order_id        uuid not null references public."LIS_orders"(id) on delete cascade,
  storage_path    text,                      -- ruta en el bucket 'reports'
  version         int not null default 1,
  hash            text,                      -- integridad del documento
  generado_por    uuid references public."LIS_profiles"(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index "LIS_idx_reportdocs_order" on public."LIS_report_documents"(order_id);

-- ─────────────────────────────────────────────────────────────
-- Entregas de resultados al paciente (multi-canal + token de acceso)
-- ─────────────────────────────────────────────────────────────
create table public."LIS_result_deliveries" (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public."LIS_organizations"(id) on delete cascade,
  order_id        uuid not null references public."LIS_orders"(id) on delete cascade,
  canal           app.delivery_channel not null,
  destino         text,                      -- email o telefono
  status          app.delivery_status not null default 'pendiente',
  access_token    text unique default encode(gen_random_bytes(24), 'hex'),
  token_expira_at timestamptz,
  enviado_at      timestamptz,
  visto_at        timestamptz,
  enviado_por     uuid references public."LIS_profiles"(id) on delete set null,
  error_detalle   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index "LIS_idx_deliveries_order" on public."LIS_result_deliveries"(order_id);
create index "LIS_idx_deliveries_token" on public."LIS_result_deliveries"(access_token);
create trigger trg_delivery_touch before update on public."LIS_result_deliveries"
  for each row execute function app.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Configuracion de integracion de facturacion por organizacion
-- ─────────────────────────────────────────────────────────────
create table public."LIS_billing_integrations" (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public."LIS_organizations"(id) on delete cascade,
  provider        text not null default 'wally',   -- 'wally' | 'manual' | otros
  enabled         boolean not null default false,
  config          jsonb not null default '{}'::jsonb,  -- endpoints, serie, etc.
  -- credenciales referenciadas por nombre a variables de entorno / vault
  credential_ref  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, provider)
);
create trigger trg_billing_touch before update on public."LIS_billing_integrations"
  for each row execute function app.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Facturas (espejo local del documento emitido por el proveedor)
-- ─────────────────────────────────────────────────────────────
create table public."LIS_invoices" (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public."LIS_organizations"(id) on delete cascade,
  order_id        uuid not null references public."LIS_orders"(id) on delete cascade,
  provider        text not null default 'wally',
  external_id     text,                      -- id del documento en Wally
  serie           text,
  numero          text,
  status          app.invoice_status not null default 'borrador',
  moneda          text not null default 'PEN',
  subtotal        numeric(12,2) not null default 0,
  impuestos       numeric(12,2) not null default 0,
  total           numeric(12,2) not null default 0,
  pdf_url         text,
  xml_url         text,
  payload         jsonb,                     -- respuesta cruda del proveedor
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index "LIS_idx_invoices_order" on public."LIS_invoices"(order_id);
create index "LIS_idx_invoices_org" on public."LIS_invoices"(organization_id);
create trigger trg_invoice_touch before update on public."LIS_invoices"
  for each row execute function app.touch_updated_at();

-- Bitacora de sincronizacion con el proveedor de facturacion
create table public."LIS_invoice_events" (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public."LIS_invoices"(id) on delete cascade,
  tipo        text not null,                 -- 'request','response','webhook','error'
  detalle     jsonb,
  created_at  timestamptz not null default now()
);
create index "LIS_idx_invoice_events_invoice" on public."LIS_invoice_events"(invoice_id);
