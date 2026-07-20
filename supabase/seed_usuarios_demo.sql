-- ============================================================================
-- SEED · Credenciales demo por rol para cada clínica/sede
--
-- OBJETIVO
--   Crear un usuario por cada rol activo (recepcion, toma_muestra, analista,
--   validador, facturacion, medico, lectura, sede_admin) en Santa Lucia y en
--   las dos sedes de Ceramed (Cusco + Lima). Para Ceramed también crea un
--   org_admin con alcance organizacional (sede_id = null) que ve ambas sedes.
--   Cada usuario queda con:
--     - fila en auth.users (password = bcrypt aleatorio)
--     - fila en auth.identities (provider email)
--     - fila en public."LIS_profiles" (es_superadmin=false)
--     - membership en la organización y sede objetivo con su rol
--
--   Además, las credenciales se persisten en una TABLA TEMPORAL de sesión
--   (public._demo_credentials) que se puede consultar con `select` después
--   del commit. **Bórrala** cuando termines de copiar los datos al documento
--   de entrega (DROP TABLE public._demo_credentials).
--
-- REQUISITOS
--   1) Haber aplicado supabase/apply_all_schema.sql
--   2) Haber corrido supabase/seed_clinicas_demo.sql (clínicas demo creadas)
--   3) Conexión con rol service_role o postgres (puede escribir en auth.*)
--
-- EJECUCIÓN
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/seed_usuarios_demo.sql
--   o pegar el archivo en el SQL Editor de Supabase.
--
-- LECTURA DE CREDENCIALES
--   Tras el commit ejecuta:
--     select tenant, sede, role, email, password, created_at
--     from public._demo_credentials
--     order by tenant, sede, role;
--
--   Para Ceramed org_admin la fila tendrá sede = 'Toda la organización'.
--
-- IDEMPOTENTE
--   Cada fila usa "on conflict" por email o por (org, sede, role, user) para
--   permitir reejecución sin duplicar usuarios ni membresías. La tabla
--   _demo_credentials se recrea en cada corrida.
-- ============================================================================

begin;

-- Crea (o recrea) la tabla temporal para que el operador consulte los credenciales.
drop table if exists public._demo_credentials;
create table public._demo_credentials (
  tenant     text not null,
  sede       text not null,
  role       text not null,
  email      text not null,
  password   text not null,
  user_id    uuid not null,
  created_at timestamptz not null default now()
);
comment on table public._demo_credentials is
  'Tabla temporal con las credenciales generadas por seed_usuarios_demo.sql. '
  'Borrar con DROP TABLE public._demo_credentials tras copiar al documento.';

do $$
declare
  v_sl_org  constant uuid := '734c7500-0000-0000-0000-000000000001';
  v_sl_sede constant uuid := '734c7500-0000-0000-0000-000000000002';

  v_cm_org    constant uuid := '636d6400-0000-0000-0000-000000000001';
  v_cm_cusco  constant uuid := '636d6400-0000-0000-0000-000000000002';
  v_cm_lima   constant uuid := '636d6400-0000-0000-0000-000000000003';

  v_rows jsonb := jsonb_build_array(
    jsonb_build_object(
      'tenant', 'Santa Lucia', 'slug', 'santa-lucia',
      'sede',   'Santa Lucia La Merced',
      'org',    v_sl_org, 'sede_id', v_sl_sede,
      'roles',  jsonb_build_array(
        'recepcion','toma_muestra','analista','validador','facturacion','medico','lectura','sede_admin'
      )
    ),
    jsonb_build_object(
      'tenant', 'Ceramed', 'slug', 'ceramed',
      'sede',   'Ceramed Cusco',
      'org',    v_cm_org, 'sede_id', v_cm_cusco,
      'roles',  jsonb_build_array(
        'recepcion','toma_muestra','analista','validador','facturacion','medico','lectura','sede_admin'
      )
    ),
    jsonb_build_object(
      'tenant', 'Ceramed', 'slug', 'ceramed',
      'sede',   'Ceramed Lima',
      'org',    v_cm_org, 'sede_id', v_cm_lima,
      'roles',  jsonb_build_array(
        'recepcion','toma_muestra','analista','validador','facturacion','medico','lectura','sede_admin'
      )
    ),
    jsonb_build_object(
      'tenant', 'Ceramed', 'slug', 'ceramed',
      'sede',   'Toda la organización',
      'org',    v_cm_org, 'sede_id', null,
      'roles',  jsonb_build_array('org_admin')
    )
  );

  v_tenant record;
  v_role   text;
  v_user_id uuid;
  v_email   text;
  v_pwd     text;
begin
  for v_tenant in
    select * from jsonb_to_recordset(v_rows) as x(
      tenant text, slug text, sede text, org uuid, sede_id uuid, roles jsonb
    )
  loop
    for v_role in select * from jsonb_array_elements_text(v_tenant.roles)
    loop
      v_email := v_role || '+' || v_tenant.slug || '@nova-clinic.example';
      v_pwd   := 'NC-' || encode(gen_random_bytes(9),'base64');

      select id into v_user_id
        from auth.users
       where lower(email) = lower(v_email)
       limit 1;

      if v_user_id is null then
        v_user_id := gen_random_uuid();
        insert into auth.users (
          instance_id, id, aud, role, email,
          encrypted_password, email_confirmed_at,
          created_at, updated_at,
          raw_app_meta_data, raw_user_meta_data,
          confirmation_token, recovery_token,
          email_change_token_new, email_change
        ) values (
          '00000000-0000-0000-0000-000000000000',
          v_user_id,
          'authenticated',
          'authenticated',
          v_email,
          crypt(v_pwd, gen_salt('bf')),
          now(), now(), now(),
          '{"provider":"email","providers":["email"]}'::jsonb,
          jsonb_build_object('nombre', initcap(replace(v_role,'_',' ')) || ' ' || v_tenant.tenant),
          '', '', '', ''
        );
      else
        update auth.users
           set encrypted_password = crypt(v_pwd, gen_salt('bf')),
               updated_at          = now()
         where id = v_user_id;
      end if;

      insert into auth.identities (
        id, user_id, provider_id, identity_data, provider, created_at, updated_at
      )
      select gen_random_uuid(), v_user_id, v_user_id::text,
             jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
             'email', now(), now()
      where not exists (
        select 1 from auth.identities
        where user_id = v_user_id and provider = 'email'
      );

      insert into public."LIS_profiles" (id, email, nombre, es_superadmin)
      values (v_user_id, v_email,
              initcap(replace(v_role,'_',' ')) || ' · ' || v_tenant.tenant,
              false)
      on conflict (id) do update set
        email      = excluded.email,
        nombre     = excluded.nombre,
        updated_at = now();

      insert into public."LIS_memberships" (organization_id, sede_id, user_id, role, activo)
      values (v_tenant.org, v_tenant.sede_id, v_user_id, v_role::app.role, true)
      on conflict (organization_id, sede_id, user_id, role) do update set
        activo = true;

      insert into public._demo_credentials (tenant, sede, role, email, password, user_id)
      values (v_tenant.tenant, v_tenant.sede, v_role, v_email, v_pwd, v_user_id);

      raise notice 'CRED | % | % | % | %',
        v_email, v_pwd, v_tenant.tenant, v_tenant.sede;
      raise notice 'CRED role=% id=%', v_role, v_user_id;
    end loop;
  end loop;
end
$$;

commit;

-- ============================================================================
-- CONSULTA DE CREDENCIALES GENERADAS
--   Después del commit, ejecuta:
--     select tenant, sede, role, email, password
--     from public._demo_credentials
--     order by tenant, sede, role;
--   Luego, una vez copiadas en el documento de entrega:
--     drop table public._demo_credentials;
-- ============================================================================
