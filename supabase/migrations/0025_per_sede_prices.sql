-- ─────────────────────────────────────────────────────────────
-- 0025 · Precios por sede (incluye override sobre plantillas globales)
-- ─────────────────────────────────────────────────────────────
-- Requerimiento: cada sede configura su propio precio de forma independiente.
--   · sede_admin  → solo el precio de SU sede
--   · org_admin   → precio base + todas las sedes + replicar
--   · Se permite fijar precio por sede incluso sobre estudios GLOBALES
--     (organization_id null): el override lo "ancla" a la org vía la sede,
--     sin necesidad de clonar la plantilla. El precio base global sigue
--     siendo de solo lectura para las organizaciones.
--
-- Modelo (ya existente): LIS_study_prices(study_id, sede_id, precio).
--   sede_id null      = precio base (org propietaria del estudio, o global seed)
--   sede_id = <sede>  = override para esa sede
-- create_order ya resuelve sede-específico > base (0022).
-- ─────────────────────────────────────────────────────────────

-- SELECT: la fila base se ve si el estudio es global o de una org del usuario;
-- la fila por sede solo se ve si la sede es accesible para el usuario (evita
-- que una org vea los overrides de sede de otra org sobre la misma plantilla).
drop policy if exists studyprice_select on public."LIS_study_prices";
create policy studyprice_select on public."LIS_study_prices" for select to authenticated
  using (
    case
      when sede_id is null then
        exists (
          select 1 from public."LIS_studies" s
          where s.id = study_id
            and (s.organization_id is null or s.organization_id in (select app.member_org_ids()))
        )
      else
        sede_id in (select app.member_sede_ids())
    end
  );

-- WRITE: el precio base solo lo edita un org_admin sobre estudios propios
-- (nunca sobre una plantilla global). El precio por sede lo edita quien tenga
-- rol admin en esa sede: has_sede_role da acceso a org_admin (rol a nivel org,
-- todas las sedes) y a sede_admin (solo su sede), tanto en estudios propios
-- como globales.
drop policy if exists studyprice_write on public."LIS_study_prices";
create policy studyprice_write on public."LIS_study_prices" for all to authenticated
  using (
    case
      when sede_id is null then
        exists (
          select 1 from public."LIS_studies" s
          where s.id = study_id
            and s.organization_id is not null
            and app.can_admin_org(s.organization_id)
        )
      else
        app.has_sede_role(sede_id, array['org_admin','sede_admin']::app.role[])
    end
  )
  with check (
    case
      when sede_id is null then
        exists (
          select 1 from public."LIS_studies" s
          where s.id = study_id
            and s.organization_id is not null
            and app.can_admin_org(s.organization_id)
        )
      else
        app.has_sede_role(sede_id, array['org_admin','sede_admin']::app.role[])
    end
  );
