-- ============================================================================
-- 0028 · Portal público del paciente: registro de intentos de acceso
--
--   El portal de autoservicio autentica al paciente con DNI + fecha de
--   nacimiento (dato semi-público). Para evitar el barrido de fechas contra
--   un documento conocido, cada intento se registra y el servidor limita la
--   cantidad por IP en una ventana de tiempo.
--
--   La tabla la escribe/consulta SOLO el service role desde el servidor
--   (server actions del portal). RLS queda habilitada sin políticas: ningún
--   rol de la app (anon/authenticated) puede leerla ni escribirla.
-- ============================================================================

create table if not exists public."LIS_portal_login_attempts" (
  id          uuid primary key default gen_random_uuid(),
  ip          text,
  documento   text,
  exito       boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Ventana de rate-limit por IP: se cuentan los intentos recientes.
create index if not exists "LIS_idx_portal_attempts_ip"
  on public."LIS_portal_login_attempts"(ip, created_at desc);

-- Consulta de intentos fallidos por documento (defensa adicional).
create index if not exists "LIS_idx_portal_attempts_doc"
  on public."LIS_portal_login_attempts"(documento, created_at desc);

alter table public."LIS_portal_login_attempts" enable row level security;
-- Sin políticas: bloqueado para todos los roles excepto service_role.

-- Purga de higiene: los intentos antiguos no aportan al rate-limit.
-- (Se puede invocar desde un cron; también es seguro llamarla ad-hoc.)
create or replace function app.purge_portal_login_attempts(p_older_than interval default interval '7 days')
returns void
language sql
security definer set search_path = public
as $$
  delete from public."LIS_portal_login_attempts"
  where created_at < now() - p_older_than;
$$;
