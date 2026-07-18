-- ============================================================================
-- 0007 · Trazabilidad completa (bitacora de auditoria append-only)
--   Registra cada INSERT/UPDATE/DELETE de las tablas criticas con actor,
--   estado anterior y nuevo. Permite reconstruir el historial de una orden.
-- ============================================================================

create table public."LIS_audit_log" (
  id              bigint generated always as identity primary key,
  organization_id uuid,
  sede_id         uuid,
  actor_id        uuid,                      -- auth.uid() al momento del cambio
  actor_email     text,
  entidad         text not null,             -- nombre de la tabla
  entidad_id      text,                      -- pk afectada
  accion          text not null,             -- INSERT | UPDATE | DELETE
  cambios         jsonb,                     -- diff de campos modificados
  estado_anterior jsonb,
  estado_nuevo    jsonb,
  contexto        jsonb,                     -- info adicional opcional
  created_at      timestamptz not null default now()
);
create index "LIS_idx_audit_org" on public."LIS_audit_log"(organization_id);
create index "LIS_idx_audit_entidad" on public."LIS_audit_log"(entidad, entidad_id);
create index "LIS_idx_audit_created" on public."LIS_audit_log"(created_at desc);
create index "LIS_idx_audit_actor" on public."LIS_audit_log"(actor_id);

-- ─────────────────────────────────────────────────────────────
-- Trigger generico de auditoria
-- ─────────────────────────────────────────────────────────────
create or replace function app.audit_trigger()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_old       jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) else null end;
  v_new       jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) else null end;
  v_row       jsonb := coalesce(v_new, v_old);
  v_org       uuid;
  v_id        text;
  v_diff      jsonb := '{}'::jsonb;
  v_key       text;
  v_email     text;
begin
  -- organizacion (si la tabla la tiene)
  begin v_org := (v_row->>'organization_id')::uuid; exception when others then v_org := null; end;
  -- fallback para tablas sin organization_id (p.ej. order_items): via order_id
  if v_org is null and (v_row ? 'order_id') then
    select o.organization_id into v_org
    from public."LIS_orders" o where o.id = (v_row->>'order_id')::uuid;
  end if;
  v_id := coalesce(v_row->>'id', '');

  -- diff de campos cambiados en UPDATE
  if tg_op = 'UPDATE' then
    for v_key in select jsonb_object_keys(v_new) loop
      if v_new->v_key is distinct from v_old->v_key
         and v_key not in ('updated_at') then
        v_diff := v_diff || jsonb_build_object(
          v_key, jsonb_build_object('de', v_old->v_key, 'a', v_new->v_key)
        );
      end if;
    end loop;
    if v_diff = '{}'::jsonb then
      return coalesce(new, old);  -- sin cambios reales, no registrar
    end if;
  end if;

  select email into v_email from public."LIS_profiles" where id = auth.uid();

  insert into public."LIS_audit_log"(
    organization_id, actor_id, actor_email, entidad, entidad_id,
    accion, cambios, estado_anterior, estado_nuevo
  ) values (
    v_org, auth.uid(), v_email, tg_table_name, v_id,
    tg_op, nullif(v_diff, '{}'::jsonb), v_old, v_new
  );

  return coalesce(new, old);
end;
$$;

-- Adjuntar el trigger a las tablas criticas para trazabilidad
create trigger trg_audit_orders after insert or update or delete on public."LIS_orders"
  for each row execute function app.audit_trigger();
create trigger trg_audit_order_items after insert or update or delete on public."LIS_order_items"
  for each row execute function app.audit_trigger();
create trigger trg_audit_samples after insert or update or delete on public."LIS_samples"
  for each row execute function app.audit_trigger();
create trigger trg_audit_results after insert or update or delete on public."LIS_results"
  for each row execute function app.audit_trigger();
create trigger trg_audit_deliveries after insert or update or delete on public."LIS_result_deliveries"
  for each row execute function app.audit_trigger();
create trigger trg_audit_invoices after insert or update or delete on public."LIS_invoices"
  for each row execute function app.audit_trigger();
create trigger trg_audit_patients after insert or update or delete on public."LIS_patients"
  for each row execute function app.audit_trigger();
create trigger trg_audit_memberships after insert or update or delete on public."LIS_memberships"
  for each row execute function app.audit_trigger();
