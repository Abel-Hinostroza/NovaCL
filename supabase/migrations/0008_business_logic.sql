-- ============================================================================
-- 0008 · Logica de negocio: perfiles, totales y rollup de estados
-- ============================================================================

-- ─────────────────────────────────────────────────────────────
-- Crear profile automaticamente al registrar un usuario en auth
-- ─────────────────────────────────────────────────────────────
create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public."LIS_profiles"(id, email, nombre)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists "LIS_on_auth_user_created" on auth.users;
create trigger "LIS_on_auth_user_created"
  after insert on auth.users
  for each row execute function app.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- Recalcular total de la orden cuando cambian sus items
-- ─────────────────────────────────────────────────────────────
create or replace function app.recalc_order_total()
returns trigger
language plpgsql
as $$
declare
  v_order uuid := coalesce(new.order_id, old.order_id);
begin
  update public."LIS_orders" o
  set total = coalesce((
    select sum(oi.precio - oi.descuento)
    from public."LIS_order_items" oi
    where oi.order_id = v_order and oi.status <> 'anulado'
  ), 0)
  where o.id = v_order;
  return coalesce(new, old);
end;
$$;

create trigger trg_recalc_order_total
  after insert or update of precio, descuento, status or delete on public."LIS_order_items"
  for each row execute function app.recalc_order_total();

-- ─────────────────────────────────────────────────────────────
-- Rollup: estado del item segun sus resultados
-- ─────────────────────────────────────────────────────────────
create or replace function app.rollup_item_status()
returns trigger
language plpgsql
as $$
declare
  v_item uuid := coalesce(new.order_item_id, old.order_item_id);
  v_total int;
  v_validados int;
  v_cargados int;
begin
  select count(*),
         count(*) filter (where status = 'validado'),
         count(*) filter (where status in ('preliminar','validado','corregido'))
    into v_total, v_validados, v_cargados
  from public."LIS_results" where order_item_id = v_item;

  update public."LIS_order_items" oi
  set status = case
    when v_total = 0 then 'pendiente'
    when v_validados = v_total then 'validado'
    when v_cargados > 0 then 'resultado_cargado'
    else 'en_proceso'
  end::app.item_status
  where oi.id = v_item and oi.status not in ('anulado','rechazado');

  return coalesce(new, old);
end;
$$;

create trigger trg_rollup_item_status
  after insert or update of status or delete on public."LIS_results"
  for each row execute function app.rollup_item_status();

-- ─────────────────────────────────────────────────────────────
-- Rollup: estado de la orden segun sus items
-- ─────────────────────────────────────────────────────────────
create or replace function app.rollup_order_status()
returns trigger
language plpgsql
as $$
declare
  v_order uuid := coalesce(new.order_id, old.order_id);
  v_total int;
  v_validados int;
  v_pendientes int;
  v_cur app.order_status;
begin
  select status into v_cur from public."LIS_orders" where id = v_order;
  -- no sobreescribir estados terminales/manuales
  if v_cur in ('anulada','entregada') then
    return coalesce(new, old);
  end if;

  select count(*),
         count(*) filter (where status = 'validado'),
         count(*) filter (where status in ('pendiente','en_proceso','resultado_cargado'))
    into v_total, v_validados, v_pendientes
  from public."LIS_order_items"
  where order_id = v_order and status <> 'anulado';

  update public."LIS_orders" o
  set status = case
    when v_total = 0 then 'registrada'
    when v_validados = v_total then 'completada'
    when v_validados > 0 then 'parcial'
    else o.status
  end::app.order_status
  where o.id = v_order;

  return coalesce(new, old);
end;
$$;

create trigger trg_rollup_order_status
  after insert or update of status or delete on public."LIS_order_items"
  for each row execute function app.rollup_order_status();

-- ─────────────────────────────────────────────────────────────
-- RPC: guardar un resultado calculando flag y rango automaticamente
-- ─────────────────────────────────────────────────────────────
create or replace function public.upsert_result(
  p_order_item_id uuid,
  p_analyte_id uuid,
  p_valor_num numeric default null,
  p_valor_texto text default null,
  p_nota text default null,
  p_validar boolean default false
) returns public."LIS_results"
language plpgsql security definer set search_path = public
as $$
declare
  v_org        uuid;
  v_patient_id uuid;
  v_patient    "LIS_patients"%rowtype;
  v_analyte    "LIS_analytes"%rowtype;
  v_range      "LIS_reference_ranges"%rowtype;
  v_age        int;
  v_flag       app.result_flag;
  v_rango_txt  text;
  v_res        public."LIS_results";
begin
  select o.organization_id, o.patient_id into v_org, v_patient_id
  from public."LIS_order_items" oi
  join public."LIS_orders" o on o.id = oi.order_id
  where oi.id = p_order_item_id;

  if v_org is null then
    raise exception 'order_item % no encontrado', p_order_item_id;
  end if;

  select * into v_patient
  from public."LIS_patients"
  where id = v_patient_id;

  -- autorizacion: analista/validador/admin de esa organizacion
  if not (app.is_superadmin() or app.has_org_role(v_org,
       array['org_admin','sede_admin','analista','validador']::app.role[])) then
    raise exception 'no autorizado para cargar resultados';
  end if;

  select * into v_analyte from public."LIS_analytes" where id = p_analyte_id;
  v_age := app.patient_age_days(v_patient.fecha_nacimiento);

  -- seleccionar rango de referencia mas especifico
  select * into v_range from public."LIS_reference_ranges" r
  where r.analyte_id = p_analyte_id
    and (r.sexo = v_patient.sexo or r.sexo = 'desconocido')
    and (r.edad_min_dias is null or v_age is null or v_age >= r.edad_min_dias)
    and (r.edad_max_dias is null or v_age is null or v_age <= r.edad_max_dias)
  order by (r.sexo = v_patient.sexo) desc,
           (r.edad_min_dias is not null) desc
  limit 1;

  if p_valor_num is not null then
    v_flag := app.eval_flag(p_valor_num, v_range.valor_min, v_range.valor_max,
                            v_range.critico_min, v_range.critico_max);
  end if;

  if v_range.valor_min is not null or v_range.valor_max is not null then
    v_rango_txt := coalesce(v_range.valor_min::text,'') || ' - ' || coalesce(v_range.valor_max::text,'');
  else
    v_rango_txt := v_range.texto_normal;
  end if;

  insert into public."LIS_results" as r (
    organization_id, order_item_id, analyte_id, analyte_nombre, analyte_unidad,
    valor_num, valor_texto, flag, rango_texto, metodo, nota,
    status, ingresado_por, ingresado_at,
    validado_por, validado_at
  ) values (
    v_org, p_order_item_id, p_analyte_id, v_analyte.nombre, v_analyte.unidad,
    p_valor_num, p_valor_texto, v_flag, v_rango_txt, v_analyte.metodo, p_nota,
    case when p_validar then 'validado' else 'preliminar' end,
    auth.uid(), now(),
    case when p_validar then auth.uid() end,
    case when p_validar then now() end
  )
  on conflict (order_item_id, analyte_id) do update set
    valor_num     = excluded.valor_num,
    valor_texto   = excluded.valor_texto,
    flag          = excluded.flag,
    rango_texto   = excluded.rango_texto,
    nota          = excluded.nota,
    status        = case when p_validar then 'validado'
                         when r.status = 'validado' then 'corregido'
                         else 'preliminar' end::app.result_status,
    ingresado_por = auth.uid(),
    ingresado_at  = now(),
    validado_por  = case when p_validar then auth.uid() else r.validado_por end,
    validado_at   = case when p_validar then now() else r.validado_at end,
    updated_at    = now()
  returning * into v_res;

  return v_res;
end;
$$;
