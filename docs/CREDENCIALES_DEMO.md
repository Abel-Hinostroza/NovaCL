# Credenciales demo · Nova Lab

> Documento generado para entregar a clientes durante demos de Nova Lab. **No** usar en producción.

## Cómo se crean los usuarios

1. Aplicar el esquema: `supabase/apply_all_schema.sql` (o `supabase db reset`).
2. Cargar la clínica demo: `supabase/seed_clinicas_demo.sql` (crea Santa Lucia y Ceramed con sus sedes).
3. Generar usuarios por rol: `supabase/seed_usuarios_demo.sql`.

   El script es idempotente. Tras ejecutarlo, **todas las credenciales quedan persistidas en la tabla `public._demo_credentials`** (junto con el bloque `RAISE NOTICE` por usuario). Ceramed incluye un `org_admin` con alcance organizacional (sede = "Toda la organización") que ve tanto Cusco como Lima.

4. **Consultar y limpiar** las credenciales generadas:

   ```sql
   -- 1) Leer todas las credenciales (incluye el org_admin de Ceramed)
   select tenant, sede, role, email, password
   from public._demo_credentials
   order by tenant, sede, role;

   -- 2) Tras copiarlas al documento, eliminar la tabla temporal
   drop table public._demo_credentials;
   ```

> Las contraseñas son aleatorias (`encode(gen_random_bytes(9),'base64')`). El operador debe copiarlas desde `select` y guardarlas en su gestor de secretos. **Nunca** versionarlas.

## Convenciones

- Cada usuario queda con:
  - `auth.users` (password = bcrypt).
  - `auth.identities` (provider `email`).
  - `public."LIS_profiles"` (`es_superadmin = false`).
  - `public."LIS_memberships"` con `activo = true`.
- Email: `<rol>+<slug-clinica>@nova-clinic.example` (slug en minúsculas).
- Nombre: `Rol · Tenant` (capitalizado).

## Matriz generada por `seed_usuarios_demo.sql`

| Clínica | Sede | Roles creados |
|---|---|---|
| Santa Lucia | Santa Lucia La Merced | recepcion, toma_muestra, analista, validador, facturacion, medico, lectura, sede_admin |
| Ceramed | Ceramed Cusco | recepcion, toma_muestra, analista, validador, facturacion, medico, lectura, sede_admin |
| Ceramed | Ceramed Lima | recepcion, toma_muestra, analista, validador, facturacion, medico, lectura, sede_admin |
| Ceramed | Toda la organización | org_admin (ve ambas sedes: Cusco y Lima) |

Total: **25 usuarios** (3 sedes con 8 roles + 1 org_admin de Ceramed).

## Roles disponibles en Nova Lab

| Rol | Visión general |
|---|---|
| `org_admin` | Administrador de la organización completa. Crea/edita sedes, asigna miembros, configura facturación. |
| `sede_admin` | Administrador de una sede específica. Configura equipos y permisos dentro de su sede. |
| `recepcion` | Registra pacientes y abre órdenes de atención. |
| `toma_muestra` | Gestiona muestras y su ciclo de vida (toma, tránsito, rechazo). |
| `analista` | Ingresa resultados y carga analitos. |
| `validador` | Valida/firma resultados y autoriza entregas. |
| `facturacion` | Emite comprobantes y gestiona la integración con Wally. |
| `medico` | Médico solicitante: lectura de pacientes y resultados propios. |
| `lectura` | Solo lectura/auditoría. |

## Plantilla para entrega al cliente

> Reemplaza los placeholders `<EMAIL>` y `<PASSWORD>` con los valores generados por el script.

### Santa Lucia — Santa Lucia La Merced

| Email | Contraseña | Rol |
|---|---|---|
| `recepcion+santa-lucia@nova-clinic.example` | `<PASSWORD>` | recepcion |
| `toma_muestra+santa-lucia@nova-clinic.example` | `<PASSWORD>` | toma_muestra |
| `analista+santa-lucia@nova-clinic.example` | `<PASSWORD>` | analista |
| `validador+santa-lucia@nova-clinic.example` | `<PASSWORD>` | validador |
| `facturacion+santa-lucia@nova-clinic.example` | `<PASSWORD>` | facturacion |
| `medico+santa-lucia@nova-clinic.example` | `<PASSWORD>` | medico |
| `lectura+santa-lucia@nova-clinic.example` | `<PASSWORD>` | lectura |
| `sede_admin+santa-lucia@nova-clinic.example` | `<PASSWORD>` | sede_admin |

### Ceramed — Ceramed Cusco

| Email | Contraseña | Rol |
|---|---|---|
| `recepcion+ceramed@nova-clinic.example` | `<PASSWORD>` | recepcion |
| `toma_muestra+ceramed@nova-clinic.example` | `<PASSWORD>` | toma_muestra |
| `analista+ceramed@nova-clinic.example` | `<PASSWORD>` | analista |
| `validador+ceramed@nova-clinic.example` | `<PASSWORD>` | validador |
| `facturacion+ceramed@nova-clinic.example` | `<PASSWORD>` | facturacion |
| `medico+ceramed@nova-clinic.example` | `<PASSWORD>` | medico |
| `lectura+ceramed@nova-clinic.example` | `<PASSWORD>` | lectura |
| `sede_admin+ceramed@nova-clinic.example` | `<PASSWORD>` | sede_admin |

### Ceramed — Ceramed Lima

| Email | Contraseña | Rol |
|---|---|---|
| `recepcion+ceramed@nova-clinic.example` | `<PASSWORD>` | recepcion |
| `toma_muestra+ceramed@nova-clinic.example` | `<PASSWORD>` | toma_muestra |
| `analista+ceramed@nova-clinic.example` | `<PASSWORD>` | analista |
| `validador+ceramed@nova-clinic.example` | `<PASSWORD>` | validador |
| `facturacion+ceramed@nova-clinic.example` | `<PASSWORD>` | facturacion |
| `medico+ceramed@nova-clinic.example` | `<PASSWORD>` | medico |
| `lectura+ceramed@nova-clinic.example` | `<PASSWORD>` | lectura |
| `sede_admin+ceramed@nova-clinic.example` | `<PASSWORD>` | sede_admin |

### Ceramed — Toda la organización (org_admin)

| Email | Contraseña | Rol |
|---|---|---|
| `org_admin+ceramed@nova-clinic.example` | `<PASSWORD>` | org_admin (sede = "Toda la organización"; ve Cusco y Lima) |

## Cómo volver a generar las contraseñas

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 \
  -f supabase/seed_clinicas_demo.sql \
  -f supabase/seed_usuarios_demo.sql
```

> Ambos scripts usan `begin; … commit;`, son idempotentes y limpian sus propios datos previos antes de reinsertar. El segundo script recrea `public._demo_credentials`; recuerda ejecutar el `drop table` después de copiar las contraseñas al documento.

## Buenas prácticas

1. **Cambia la contraseña** al primer inicio de sesión. El usuario lo puede hacer desde *Mi cuenta* (próximamente) o vía Supabase Auth (admin).
2. **Promueve o degrada roles** desde `/admin/organizaciones` (solo superadmin) o `/configuracion` (admin de org/sede).
3. **Limpia los datos demo** cuando termines:

   ```sql
   delete from public."LIS_organizations"
   where slug in ('santa-lucia','ceramed');
   ```

   La cascada elimina sedes, membresías, pacientes, órdenes, muestras, resultados, facturas y auditoría.
4. **Nunca** subas las credenciales generadas al repositorio; guárdalas en tu gestor de secretos (1Password, Vault, etc.).