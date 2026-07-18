-- ============================================================================
-- 0002 · Multi-tenancy y control de acceso basado en roles (RBAC)
--   organization (cliente/clinica) -> sedes -> memberships por sede
-- ============================================================================

-- ─────────────────────────────────────────────────────────────
-- Organizacion = tenant (cada clinica que usa el sistema)
-- ─────────────────────────────────────────────────────────────
create table public."LIS_organizations" (
  id            uuid primary key default gen_random_uuid(),
  slug          citext not null unique,
  nombre        text not null,
  ruc           text,                     -- identificacion fiscal
  logo_url      text,
  timezone      text not null default 'America/Lima',
  locale        text not null default 'es-PE',
  activo        boolean not null default true,
  settings      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_org_touch before update on public."LIS_organizations"
  for each row execute function app.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Sedes (sucursales) dentro de una organizacion
-- ─────────────────────────────────────────────────────────────
create table public."LIS_sedes" (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public."LIS_organizations"(id) on delete cascade,
  codigo          text not null,          -- codigo interno de sede
  nombre          text not null,
  direccion       text,
  telefono        text,
  email           citext,
  es_procesadora  boolean not null default true,  -- procesa muestras o solo toma
  activo          boolean not null default true,
  settings        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, codigo)
);
create index "LIS_idx_sedes_org" on public."LIS_sedes"(organization_id);
create trigger trg_sede_touch before update on public."LIS_sedes"
  for each row execute function app.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Perfil de usuario (1:1 con auth.users)
-- ─────────────────────────────────────────────────────────────
create table public."LIS_profiles" (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         citext not null,
  nombre        text not null default '',
  telefono      text,
  avatar_url    text,
  es_superadmin boolean not null default false,   -- soporte de la plataforma
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_profile_touch before update on public."LIS_profiles"
  for each row execute function app.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Membership: un usuario pertenece a una sede con un rol.
--   sede_id NULL => rol a nivel de toda la organizacion (org_admin)
-- ─────────────────────────────────────────────────────────────
create table public."LIS_memberships" (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public."LIS_organizations"(id) on delete cascade,
  sede_id         uuid references public."LIS_sedes"(id) on delete cascade,
  user_id         uuid not null references public."LIS_profiles"(id) on delete cascade,
  role            app.role not null,
  activo          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, sede_id, user_id, role)
);
create index "LIS_idx_memberships_user" on public."LIS_memberships"(user_id) where activo;
create index "LIS_idx_memberships_org" on public."LIS_memberships"(organization_id);
create index "LIS_idx_memberships_sede" on public."LIS_memberships"(sede_id);
create trigger trg_membership_touch before update on public."LIS_memberships"
  for each row execute function app.touch_updated_at();

-- ============================================================================
-- Helpers de autorizacion (SECURITY DEFINER) usados por las politicas RLS.
--   Evitan recursion consultando memberships con privilegios del owner.
-- ============================================================================

-- ¿Es superadmin de plataforma?
create or replace function app.is_superadmin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select es_superadmin from public."LIS_profiles" where id = auth.uid()),
    false
  );
$$;

-- Organizaciones a las que pertenece el usuario actual
create or replace function app.member_org_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select distinct organization_id
  from public."LIS_memberships"
  where user_id = auth.uid() and activo;
$$;

-- Sedes a las que el usuario tiene acceso.
--   Un org_admin (sede_id null) tiene acceso a TODAS las sedes de su org.
create or replace function app.member_sede_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select s.id
  from public."LIS_sedes" s
  where s.organization_id in (
    -- orgs donde el usuario es admin de toda la organizacion
    select m.organization_id from public."LIS_memberships" m
    where m.user_id = auth.uid() and m.activo and m.sede_id is null
  )
  union
  select m.sede_id
  from public."LIS_memberships" m
  where m.user_id = auth.uid() and m.activo and m.sede_id is not null;
$$;

-- ¿El usuario tiene alguno de los roles indicados en la organizacion dada?
create or replace function app.has_org_role(p_org uuid, p_roles app.role[])
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public."LIS_memberships" m
    where m.user_id = auth.uid() and m.activo
      and m.organization_id = p_org
      and m.role = any(p_roles)
  );
$$;

-- ¿El usuario tiene alguno de los roles en la sede dada (o como org_admin)?
create or replace function app.has_sede_role(p_sede uuid, p_roles app.role[])
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public."LIS_sedes" s
    join public."LIS_memberships" m on m.organization_id = s.organization_id
    where s.id = p_sede and m.user_id = auth.uid() and m.activo
      and (
        (m.sede_id = p_sede and m.role = any(p_roles))
        or (m.sede_id is null and m.role = any(p_roles))  -- rol a nivel org
      )
  );
$$;

-- ¿Puede administrar la organizacion? (org_admin o superadmin)
create or replace function app.can_admin_org(p_org uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select app.is_superadmin() or app.has_org_role(p_org, array['org_admin']::app.role[]);
$$;
