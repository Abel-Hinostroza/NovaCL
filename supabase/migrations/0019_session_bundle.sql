-- ============================================================================
-- 0019 · Bundle de sesion (perfil + membresias + sede activa + permisos)
--   Consolida en un solo round-trip lo que el layout de (app) necesita en
--   cada navegacion (antes: profile + memberships + sedes + role_permissions
--   en 4 queries secuenciales, mas un getEffectivePermissions duplicado).
-- ============================================================================

-- ─────────────────────────────────────────────────────────────
-- RPC: bundle de sesion del usuario autenticado
--   p_org_cookie / p_sede_cookie: preferencia guardada en cookies del
--   cliente; si no son validas (no pertenece a esa org/sede) se usa la
--   primera disponible — misma logica que hoy vive en session.ts.
--   Devuelve null si no hay usuario autenticado.
-- ─────────────────────────────────────────────────────────────
create or replace function public.get_session_bundle(
  p_org_cookie uuid default null,
  p_sede_cookie uuid default null
) returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid           uuid := auth.uid();
  v_profile       jsonb;
  v_is_super      boolean;
  v_memberships   jsonb;
  v_organizations jsonb;
  v_org_ids       uuid[];
  v_active_org    uuid;
  v_sedes         jsonb;
  v_sede_ids      uuid[];
  v_active_sede   uuid;
  v_roles         jsonb;
  v_perm_rows     jsonb;
begin
  if v_uid is null then
    return null;
  end if;

  select to_jsonb(p) into v_profile
  from public."LIS_profiles" p
  where p.id = v_uid;

  v_is_super := coalesce((v_profile->>'es_superadmin')::boolean, false);

  -- membresias activas, con organizacion/sede embebidas (para el switcher)
  select coalesce(jsonb_agg(
           to_jsonb(m) || jsonb_build_object(
             'organizations', case when o.id is null then null else
               jsonb_build_object('id', o.id, 'nombre', o.nombre, 'slug', o.slug) end,
             'sedes', case when s.id is null then null else
               jsonb_build_object('id', s.id, 'nombre', s.nombre, 'codigo', s.codigo) end
           )
         ), '[]'::jsonb)
    into v_memberships
  from public."LIS_memberships" m
  left join public."LIS_organizations" o on o.id = m.organization_id
  left join public."LIS_sedes" s on s.id = m.sede_id
  where m.user_id = v_uid and m.activo;

  -- organizaciones unicas del usuario
  select coalesce(jsonb_agg(distinct jsonb_build_object(
           'id', o.id, 'nombre', o.nombre, 'slug', o.slug
         )), '[]'::jsonb),
         array_agg(distinct o.id order by o.id)
    into v_organizations, v_org_ids
  from public."LIS_memberships" m
  join public."LIS_organizations" o on o.id = m.organization_id
  where m.user_id = v_uid and m.activo;

  if p_org_cookie is not null and p_org_cookie = any(v_org_ids) then
    v_active_org := p_org_cookie;
  else
    v_active_org := v_org_ids[1];
  end if;

  -- sedes visibles en la organizacion activa
  if v_active_org is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', s.id, 'nombre', s.nombre, 'codigo', s.codigo,
             'organization_id', s.organization_id
           ) order by s.codigo), '[]'::jsonb),
           array_agg(s.id order by s.codigo)
      into v_sedes, v_sede_ids
    from public."LIS_sedes" s
    where s.organization_id = v_active_org and s.activo;
  else
    v_sedes := '[]'::jsonb;
  end if;

  if p_sede_cookie is not null and p_sede_cookie = any(v_sede_ids) then
    v_active_sede := p_sede_cookie;
  else
    v_active_sede := v_sede_ids[1];
  end if;

  -- roles del usuario en la organizacion activa
  select coalesce(jsonb_agg(distinct m.role), '[]'::jsonb)
    into v_roles
  from public."LIS_memberships" m
  where m.user_id = v_uid and m.activo and m.organization_id = v_active_org;

  -- permisos granulares (filas crudas; el merge con los defaults se hace en TS)
  if not v_is_super and v_active_org is not null then
    select coalesce(jsonb_agg(to_jsonb(rp)), '[]'::jsonb)
      into v_perm_rows
    from public."LIS_role_permissions" rp
    where rp.organization_id = v_active_org
      and rp.role in (select jsonb_array_elements_text(v_roles)::app.role);
  else
    v_perm_rows := '[]'::jsonb;
  end if;

  return jsonb_build_object(
    'user', jsonb_build_object('id', v_uid, 'email', auth.email()),
    'profile', v_profile,
    'memberships', v_memberships,
    'organizations', v_organizations,
    'sedes', v_sedes,
    'activeOrgId', v_active_org,
    'activeSedeId', v_active_sede,
    'roles', v_roles,
    'permissionRows', v_perm_rows,
    'isSuperadmin', v_is_super
  );
end;
$$;
