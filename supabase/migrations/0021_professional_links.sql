-- ─────────────────────────────────────────────────────────────
-- 0021: Vínculo del directorio de profesionales a todas las
-- entidades que guardan "médico/profesional" como texto libre.
--
-- El directorio LIS_professionals (0016) cubre al médico
-- solicitante, al validador, al tecnólogo y al receptor de un
-- aviso crítico. Este migration cierra los huecos donde el
-- vínculo solo estaba en texto:
--
--   • LIS_orders.medico_solicitante_id  (ya existía, 0016)
--   • LIS_appointments.medico_solicitante_id  ← nuevo
--   • LIS_critical_notifications.notificado_a_id  ← nuevo
--
-- Además extiende el RPC create_order para que la app pueda
-- pasar el id al crear la orden, en lugar de solo el texto.
-- ─────────────────────────────────────────────────────────────

-- ── Citas: médico solicitante (FK opcional) ─────────────────
alter table public."LIS_appointments"
  add column if not exists medico_solicitante_id uuid
    references public."LIS_professionals"(id) on delete set null;

create index if not exists "LIS_idx_appt_medico"
  on public."LIS_appointments"(medico_solicitante_id);

-- ── Aviso de valor crítico: a quién se notificó (FK opcional) ─
alter table public."LIS_critical_notifications"
  add column if not exists notificado_a_id uuid
    references public."LIS_professionals"(id) on delete set null;

create index if not exists "LIS_idx_critnotif_to"
  on public."LIS_critical_notifications"(notificado_a_id);

-- ── RPC create_order: aceptar el id del profesional ─────────
-- Se conserva p_medico (texto) por compatibilidad con historiales
-- y médicos externos no registrados: si viene p_medico_id, ese
-- gana; si no, se guarda solo el texto tal como antes.
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

  -- Si llega medico_id, validamos que pertenezca a la misma organización.
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
