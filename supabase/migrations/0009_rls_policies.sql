-- ============================================================================
-- 0009 · Row Level Security (aislamiento multi-tenant por organizacion/sede)
--   Regla base: cada fila pertenece a una organizacion; un usuario solo ve
--   filas de sus organizaciones. Las escrituras exigen el rol adecuado.
--   Las funciones SECURITY DEFINER (triggers, RPC) omiten RLS por diseno.
-- ============================================================================

-- Habilitar RLS en todas las tablas del dominio
alter table public."LIS_organizations"       enable row level security;
alter table public."LIS_sedes"               enable row level security;
alter table public."LIS_profiles"            enable row level security;
alter table public."LIS_memberships"         enable row level security;
alter table public."LIS_specimen_types"      enable row level security;
alter table public."LIS_test_categories"     enable row level security;
alter table public."LIS_analytes"            enable row level security;
alter table public."LIS_reference_ranges"    enable row level security;
alter table public."LIS_studies"             enable row level security;
alter table public."LIS_study_analytes"      enable row level security;
alter table public."LIS_study_prices"        enable row level security;
alter table public."LIS_patients"            enable row level security;
alter table public."LIS_order_counters"      enable row level security;
alter table public."LIS_orders"              enable row level security;
alter table public."LIS_order_items"         enable row level security;
alter table public."LIS_samples"             enable row level security;
alter table public."LIS_sample_items"        enable row level security;
alter table public."LIS_results"             enable row level security;
alter table public."LIS_report_documents"    enable row level security;
alter table public."LIS_result_deliveries"   enable row level security;
alter table public."LIS_billing_integrations" enable row level security;
alter table public."LIS_invoices"            enable row level security;
alter table public."LIS_invoice_events"      enable row level security;
alter table public."LIS_audit_log"           enable row level security;

-- ─────────────────────────────────────────────────────────────
-- organizations
-- ─────────────────────────────────────────────────────────────
create policy org_select on public."LIS_organizations" for select to authenticated
  using (app.is_superadmin() or id in (select app.member_org_ids()));
create policy org_update on public."LIS_organizations" for update to authenticated
  using (app.can_admin_org(id)) with check (app.can_admin_org(id));
create policy org_insert on public."LIS_organizations" for insert to authenticated
  with check (app.is_superadmin());

-- ─────────────────────────────────────────────────────────────
-- sedes
-- ─────────────────────────────────────────────────────────────
create policy sede_select on public."LIS_sedes" for select to authenticated
  using (app.is_superadmin() or organization_id in (select app.member_org_ids()));
create policy sede_write on public."LIS_sedes" for all to authenticated
  using (app.can_admin_org(organization_id))
  with check (app.can_admin_org(organization_id));

-- ─────────────────────────────────────────────────────────────
-- profiles: cada quien ve su perfil y el de colegas de su organizacion
-- ─────────────────────────────────────────────────────────────
create policy profile_select_self on public."LIS_profiles" for select to authenticated
  using (
    id = auth.uid()
    or app.is_superadmin()
    or id in (
      select m.user_id from public."LIS_memberships" m
      where m.organization_id in (select app.member_org_ids())
    )
  );
create policy profile_update_self on public."LIS_profiles" for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- memberships
-- ─────────────────────────────────────────────────────────────
create policy membership_select on public."LIS_memberships" for select to authenticated
  using (
    user_id = auth.uid()
    or app.is_superadmin()
    or organization_id in (select app.member_org_ids())
  );
create policy membership_write on public."LIS_memberships" for all to authenticated
  using (app.can_admin_org(organization_id))
  with check (app.can_admin_org(organization_id));

-- ─────────────────────────────────────────────────────────────
-- Catalogo: lectura de plantillas globales (org null) + propias.
--   Escritura solo admins de la organizacion propietaria.
-- ─────────────────────────────────────────────────────────────
create policy specimen_select on public."LIS_specimen_types" for select to authenticated using (true);
create policy specimen_write on public."LIS_specimen_types" for all to authenticated
  using (app.is_superadmin()) with check (app.is_superadmin());

-- Macro reutilizable via patron: categorias, analitos, estudios
create policy category_select on public."LIS_test_categories" for select to authenticated
  using (organization_id is null or organization_id in (select app.member_org_ids()));
create policy category_write on public."LIS_test_categories" for all to authenticated
  using (organization_id is not null and app.can_admin_org(organization_id))
  with check (organization_id is not null and app.can_admin_org(organization_id));

create policy analyte_select on public."LIS_analytes" for select to authenticated
  using (organization_id is null or organization_id in (select app.member_org_ids()));
create policy analyte_write on public."LIS_analytes" for all to authenticated
  using (organization_id is not null and app.can_admin_org(organization_id))
  with check (organization_id is not null and app.can_admin_org(organization_id));

create policy study_select on public."LIS_studies" for select to authenticated
  using (organization_id is null or organization_id in (select app.member_org_ids()));
create policy study_write on public."LIS_studies" for all to authenticated
  using (organization_id is not null and app.can_admin_org(organization_id))
  with check (organization_id is not null and app.can_admin_org(organization_id));

-- Hijos del catalogo: heredan visibilidad del padre
create policy refrange_select on public."LIS_reference_ranges" for select to authenticated
  using (exists (select 1 from public."LIS_analytes" a where a.id = analyte_id
    and (a.organization_id is null or a.organization_id in (select app.member_org_ids()))));
create policy refrange_write on public."LIS_reference_ranges" for all to authenticated
  using (exists (select 1 from public."LIS_analytes" a where a.id = analyte_id
    and a.organization_id is not null and app.can_admin_org(a.organization_id)))
  with check (exists (select 1 from public."LIS_analytes" a where a.id = analyte_id
    and a.organization_id is not null and app.can_admin_org(a.organization_id)));

create policy studyanalyte_select on public."LIS_study_analytes" for select to authenticated
  using (exists (select 1 from public."LIS_studies" s where s.id = study_id
    and (s.organization_id is null or s.organization_id in (select app.member_org_ids()))));
create policy studyanalyte_write on public."LIS_study_analytes" for all to authenticated
  using (exists (select 1 from public."LIS_studies" s where s.id = study_id
    and s.organization_id is not null and app.can_admin_org(s.organization_id)))
  with check (exists (select 1 from public."LIS_studies" s where s.id = study_id
    and s.organization_id is not null and app.can_admin_org(s.organization_id)));

create policy studyprice_select on public."LIS_study_prices" for select to authenticated
  using (exists (select 1 from public."LIS_studies" s where s.id = study_id
    and (s.organization_id is null or s.organization_id in (select app.member_org_ids()))));
create policy studyprice_write on public."LIS_study_prices" for all to authenticated
  using (exists (select 1 from public."LIS_studies" s where s.id = study_id
    and s.organization_id is not null and app.can_admin_org(s.organization_id)))
  with check (exists (select 1 from public."LIS_studies" s where s.id = study_id
    and s.organization_id is not null and app.can_admin_org(s.organization_id)));

-- ─────────────────────────────────────────────────────────────
-- Pacientes (org-scoped). Escritura: recepcion/admin.
-- ─────────────────────────────────────────────────────────────
create policy patient_select on public."LIS_patients" for select to authenticated
  using (organization_id in (select app.member_org_ids()));
create policy patient_write on public."LIS_patients" for all to authenticated
  using (app.has_org_role(organization_id,
    array['org_admin','sede_admin','recepcion']::app.role[]))
  with check (app.has_org_role(organization_id,
    array['org_admin','sede_admin','recepcion']::app.role[]));

-- ─────────────────────────────────────────────────────────────
-- order_counters: solo lectura para miembros; escritura via RPC definer
-- ─────────────────────────────────────────────────────────────
create policy counter_select on public."LIS_order_counters" for select to authenticated
  using (organization_id in (select app.member_org_ids()));

-- ─────────────────────────────────────────────────────────────
-- Ordenes (scope por sede). Escritura: recepcion/admin.
-- ─────────────────────────────────────────────────────────────
create policy order_select on public."LIS_orders" for select to authenticated
  using (sede_id in (select app.member_sede_ids()));
create policy order_write on public."LIS_orders" for all to authenticated
  using (app.has_sede_role(sede_id,
    array['org_admin','sede_admin','recepcion','facturacion']::app.role[]))
  with check (app.has_sede_role(sede_id,
    array['org_admin','sede_admin','recepcion','facturacion']::app.role[]));

-- order_items: heredan de la orden
create policy orderitem_select on public."LIS_order_items" for select to authenticated
  using (exists (select 1 from public."LIS_orders" o where o.id = order_id
    and o.sede_id in (select app.member_sede_ids())));
create policy orderitem_write on public."LIS_order_items" for all to authenticated
  using (exists (select 1 from public."LIS_orders" o where o.id = order_id
    and app.has_sede_role(o.sede_id,
      array['org_admin','sede_admin','recepcion','analista','validador']::app.role[])))
  with check (exists (select 1 from public."LIS_orders" o where o.id = order_id
    and app.has_sede_role(o.sede_id,
      array['org_admin','sede_admin','recepcion','analista','validador']::app.role[])));

-- ─────────────────────────────────────────────────────────────
-- Muestras y resultados (org-scoped; roles de laboratorio)
-- ─────────────────────────────────────────────────────────────
create policy sample_select on public."LIS_samples" for select to authenticated
  using (organization_id in (select app.member_org_ids()));
create policy sample_write on public."LIS_samples" for all to authenticated
  using (app.has_org_role(organization_id,
    array['org_admin','sede_admin','recepcion','toma_muestra','analista','validador']::app.role[]))
  with check (app.has_org_role(organization_id,
    array['org_admin','sede_admin','recepcion','toma_muestra','analista','validador']::app.role[]));

create policy sampleitem_select on public."LIS_sample_items" for select to authenticated
  using (exists (select 1 from public."LIS_samples" s where s.id = sample_id
    and s.organization_id in (select app.member_org_ids())));
create policy sampleitem_write on public."LIS_sample_items" for all to authenticated
  using (exists (select 1 from public."LIS_samples" s where s.id = sample_id
    and app.has_org_role(s.organization_id,
      array['org_admin','sede_admin','toma_muestra','analista']::app.role[])))
  with check (exists (select 1 from public."LIS_samples" s where s.id = sample_id
    and app.has_org_role(s.organization_id,
      array['org_admin','sede_admin','toma_muestra','analista']::app.role[])));

create policy result_select on public."LIS_results" for select to authenticated
  using (organization_id in (select app.member_org_ids()));
create policy result_write on public."LIS_results" for all to authenticated
  using (app.has_org_role(organization_id,
    array['org_admin','sede_admin','analista','validador']::app.role[]))
  with check (app.has_org_role(organization_id,
    array['org_admin','sede_admin','analista','validador']::app.role[]));

-- ─────────────────────────────────────────────────────────────
-- Reportes, entregas, facturacion (org-scoped)
-- ─────────────────────────────────────────────────────────────
create policy reportdoc_select on public."LIS_report_documents" for select to authenticated
  using (organization_id in (select app.member_org_ids()));
create policy reportdoc_write on public."LIS_report_documents" for all to authenticated
  using (app.has_org_role(organization_id,
    array['org_admin','sede_admin','analista','validador','recepcion']::app.role[]))
  with check (app.has_org_role(organization_id,
    array['org_admin','sede_admin','analista','validador','recepcion']::app.role[]));

create policy delivery_select on public."LIS_result_deliveries" for select to authenticated
  using (organization_id in (select app.member_org_ids()));
create policy delivery_write on public."LIS_result_deliveries" for all to authenticated
  using (app.has_org_role(organization_id,
    array['org_admin','sede_admin','recepcion','validador']::app.role[]))
  with check (app.has_org_role(organization_id,
    array['org_admin','sede_admin','recepcion','validador']::app.role[]));

create policy billing_select on public."LIS_billing_integrations" for select to authenticated
  using (organization_id in (select app.member_org_ids()));
create policy billing_write on public."LIS_billing_integrations" for all to authenticated
  using (app.can_admin_org(organization_id))
  with check (app.can_admin_org(organization_id));

create policy invoice_select on public."LIS_invoices" for select to authenticated
  using (organization_id in (select app.member_org_ids()));
create policy invoice_write on public."LIS_invoices" for all to authenticated
  using (app.has_org_role(organization_id,
    array['org_admin','sede_admin','facturacion']::app.role[]))
  with check (app.has_org_role(organization_id,
    array['org_admin','sede_admin','facturacion']::app.role[]));

create policy invoiceevent_select on public."LIS_invoice_events" for select to authenticated
  using (exists (select 1 from public."LIS_invoices" i where i.id = invoice_id
    and i.organization_id in (select app.member_org_ids())));

-- ─────────────────────────────────────────────────────────────
-- Auditoria: lectura para admins/lectura; nunca escritura via API
-- ─────────────────────────────────────────────────────────────
create policy audit_select on public."LIS_audit_log" for select to authenticated
  using (
    app.is_superadmin()
    or app.has_org_role(organization_id, array['org_admin','sede_admin','lectura']::app.role[])
  );
