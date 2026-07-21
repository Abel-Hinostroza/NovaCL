-- ============================================================================
-- 0010 · Vistas de consulta y RPC de alto nivel
-- ============================================================================

-- ─────────────────────────────────────────────────────────────
-- Vista: resumen de ordenes con paciente y progreso
--   (hereda RLS de las tablas base; usa security_invoker)
-- ─────────────────────────────────────────────────────────────
create or replace view public.v_order_overview
with (security_invoker = true) as
select
  o.id,
  o.organization_id,
  o.sede_id,
  o.codigo,
  o.status,
  o.prioridad,
  o.total,
  o.moneda,
  o.created_at,
  s.nombre               as sede_nombre,
  p.id                   as patient_id,
  (p.nombres || ' ' || p.apellidos) as paciente,
  p.numero_documento,
  p.sexo,
  p.fecha_nacimiento,
  count(oi.id)                                          as items_total,
  count(oi.id) filter (where oi.status = 'validado')    as items_validados,
  count(oi.id) filter (where oi.status = 'pendiente')   as items_pendientes
from public."LIS_orders" o
join public."LIS_sedes" s      on s.id = o.sede_id
join public."LIS_patients" p   on p.id = o.patient_id
left join public."LIS_order_items" oi on oi.order_id = o.id
group by o.id, s.nombre, p.id;

-- ─────────────────────────────────────────────────────────────
-- RPC: crear una orden con sus items (recepcion)
--   p_items: jsonb array de { study_id }
-- ─────────────────────────────────────────────────────────────
create or replace function public.create_order(
  p_sede_id uuid,
  p_patient_id uuid,
  p_items jsonb,
  p_prioridad app.order_priority default 'rutina',
  p_medico text default null,
  p_medico_id uuid default null,
  p_diagnostico text default null,
  p_observaciones text default null
) returns public."LIS_orders"
language plpgsql security definer set search_path = public
as $$
declare
  v_org    uuid;
  v_order  public."LIS_orders";
  v_item   jsonb;
  v_study  public."LIS_studies";
  v_precio numeric;
begin
  select organization_id into v_org from public."LIS_sedes" where id = p_sede_id;
  if v_org is null then
    raise exception 'sede % no existe', p_sede_id;
  end if;

  -- autorizacion: recepcion/admin de esa sede
  if not (app.is_superadmin() or app.has_sede_role(p_sede_id,
       array['org_admin','sede_admin','recepcion']::app.role[])) then
    raise exception 'no autorizado para crear ordenes en esta sede';
  end if;

  if p_medico_id is not null then
    if not exists (
      select 1 from public."LIS_professionals" p
      where p.id = p_medico_id and p.organization_id = v_org
    ) then
      raise exception 'profesional % no pertenece a la organizacion', p_medico_id;
    end if;
  end if;

  insert into public."LIS_orders"(
    organization_id, sede_id, patient_id, codigo, prioridad,
    medico_solicitante, medico_solicitante_id,
    diagnostico, observaciones, created_by
  ) values (
    v_org, p_sede_id, p_patient_id, app.next_order_code(v_org), p_prioridad,
    p_medico, p_medico_id,
    p_diagnostico, p_observaciones, auth.uid()
  ) returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_study from public."LIS_studies" where id = (v_item->>'study_id')::uuid;
    if v_study.id is null then
      raise exception 'estudio % no existe', v_item->>'study_id';
    end if;

    select precio into v_precio from public."LIS_study_prices"
    where study_id = v_study.id
      and (sede_id = p_sede_id or sede_id is null)
      and activo
    order by (sede_id = p_sede_id) desc, vigente_desde desc
    limit 1;

    insert into public."LIS_order_items"(
      order_id, study_id, precio, study_nombre, study_codigo
    ) values (
      v_order.id, v_study.id, coalesce(v_precio, 0), v_study.nombre, v_study.codigo
    );
  end loop;

  return v_order;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- RPC: bootstrap de una organizacion con su admin (setup inicial)
-- ─────────────────────────────────────────────────────────────
create or replace function public.bootstrap_organization(
  p_slug text,
  p_nombre text,
  p_sede_nombre text default 'Sede Principal'
) returns public."LIS_organizations"
language plpgsql security definer set search_path = public
as $$
declare
  v_org  public."LIS_organizations";
  v_sede public."LIS_sedes";
begin
  if auth.uid() is null then
    raise exception 'requiere autenticacion';
  end if;

  insert into public."LIS_organizations"(slug, nombre)
  values (p_slug, p_nombre) returning * into v_org;

  insert into public."LIS_sedes"(organization_id, codigo, nombre)
  values (v_org.id, 'S001', p_sede_nombre) returning * into v_sede;

  -- el creador queda como administrador de la organizacion
  insert into public."LIS_memberships"(organization_id, sede_id, user_id, role)
  values (v_org.id, null, auth.uid(), 'org_admin');

  return v_org;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- RPC: trazabilidad de una orden (linea de tiempo de auditoria)
-- ─────────────────────────────────────────────────────────────
create or replace function public.order_timeline(p_order_id uuid)
returns setof public."LIS_audit_log"
language sql stable security definer set search_path = public
as $$
  select a.*
  from public."LIS_audit_log" a
  where a.organization_id in (select app.member_org_ids())
    and (
      (a.entidad = 'LIS_orders' and a.entidad_id = p_order_id::text)
      or (a.entidad = 'LIS_order_items' and a.entidad_id in (
            select oi.id::text from public."LIS_order_items" oi where oi.order_id = p_order_id))
      or (a.entidad = 'LIS_samples' and a.entidad_id in (
            select s.id::text from public."LIS_samples" s where s.order_id = p_order_id))
      or (a.entidad = 'LIS_results' and a.entidad_id in (
            select r.id::text from public."LIS_results" r
            join public."LIS_order_items" oi on oi.id = r.order_item_id
            where oi.order_id = p_order_id))
      or (a.entidad = 'LIS_result_deliveries' and a.entidad_id in (
            select d.id::text from public."LIS_result_deliveries" d where d.order_id = p_order_id))
    )
  order by a.created_at asc;
$$;
