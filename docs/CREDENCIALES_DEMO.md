# Credenciales demo · Nova Lab

> Documento generado para entregar a clientes durante demos de Nova Lab. **No** usar en producción.

## Cómo se crean los usuarios

1. Aplicar el esquema: `supabase/apply_all_schema.sql` (o `supabase db reset`).
2. Cargar la clínica demo: `supabase/seed_clinicas_demo.sql` (crea Santa Lucia y Ceramed con sus sedes).
3. Generar usuarios por rol: `supabase/seed_usuarios_demo.sql`.

   El script es idempotente, define **una sola contraseña compartida** (`NovaLab`) para todos los usuarios demo y los persiste en la tabla temporal `public._demo_credentials` (junto con el bloque `RAISE NOTICE` por usuario). Ceramed incluye un `org_admin` con alcance organizacional (sede = "Toda la organización") que ve tanto Cusco como Lima.

4. Consultar/limpiar las credenciales generadas:

   ```sql
   -- 1) Leer credenciales (incluye el org_admin de Ceramed)
   select tenant, sede, role, email, password
   from public._demo_credentials
   order by tenant, sede, role;

   -- 2) Tras copiar, eliminar la tabla temporal
   drop table public._demo_credentials;
   ```

> Contraseña compartida demo: `NovaLab`. Email patrón: `<rol>.<slug-clinica>@novalab.dev`.

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

## Matriz generada por `seed_usuarios_demo.sql`

| Clínica | Sede | Cantidad de usuarios | Roles |
|---|---|---|---|
| Santa Lucia | Santa Lucia La Merced | 8 | recepcion, toma_muestra, analista, validador, facturacion, medico, lectura, sede_admin |
| Ceramed | Ceramed Cusco | 8 | recepcion, toma_muestra, analista, validador, facturacion, medico, lectura, sede_admin |
| Ceramed | Ceramed Lima | 8 | recepcion, toma_muestra, analista, validador, facturacion, medico, lectura, sede_admin |
| Ceramed | Toda la organización | 1 | org_admin |

**Total: 25 usuarios**, todos con la misma contraseña `NovaLab`. Total por clínica y por sede: cada correo es único porque el patrón incluye el slug.

## Plantilla para entrega al cliente

> Todos los usuarios comparten la contraseña: **`NovaLab`**.
> Tras el primer inicio de sesión se recomienda cambiarla desde Supabase Auth (admin) o desde la pantalla de cuenta del propio usuario.

### Santa Lucia — Santa Lucia La Merced

| Email | Rol |
|---|---|
| `recepcion.santa-lucia@novalab.dev` | recepcion |
| `toma_muestra.santa-lucia@novalab.dev` | toma_muestra |
| `analista.santa-lucia@novalab.dev` | analista |
| `validador.santa-lucia@novalab.dev` | validador |
| `facturacion.santa-lucia@novalab.dev` | facturacion |
| `medico.santa-lucia@novalab.dev` | medico |
| `lectura.santa-lucia@novalab.dev` | lectura |
| `sede_admin.santa-lucia@novalab.dev` | sede_admin |

### Ceramed — Ceramed Cusco

| Email | Rol |
|---|---|
| `recepcion.ceramed@novalab.dev` | recepcion |
| `toma_muestra.ceramed@novalab.dev` | toma_muestra |
| `analista.ceramed@novalab.dev` | analista |
| `validador.ceramed@novalab.dev` | validador |
| `facturacion.ceramed@novalab.dev` | facturacion |
| `medico.ceramed@novalab.dev` | medico |
| `lectura.ceramed@novalab.dev` | lectura |
| `sede_admin.ceramed@novalab.dev` | sede_admin |

### Ceramed — Ceramed Lima

| Email | Rol |
|---|---|
| `recepcion.ceramed@novalab.dev` | recepcion |
| `toma_muestra.ceramed@novalab.dev` | toma_muestra |
| `analista.ceramed@novalab.dev` | analista |
| `validador.ceramed@novalab.dev` | validador |
| `facturacion.ceramed@novalab.dev` | facturacion |
| `medico.ceramed@novalab.dev` | medico |
| `lectura.ceramed@novalab.dev` | lectura |
| `sede_admin.ceramed@novalab.dev` | sede_admin |

### Ceramed — Toda la organización (org_admin)

| Email | Rol |
|---|---|
| `org_admin.ceramed@novalab.dev` | org_admin (sede = "Toda la organización"; ve Cusco y Lima) |

## Cómo volver a generar las credenciales

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 \
  -f supabase/seed_clinicas_demo.sql \
  -f supabase/seed_usuarios_demo.sql
```

> Ambos scripts usan `begin; … commit;`, son idempotentes y limpian sus propios datos previos antes de reinsertar. El segundo script recrea `public._demo_credentials`; recuerda ejecutar el `drop table` después de copiarlas al documento.

## Buenas prácticas

1. **Cambia la contraseña** al primer inicio de sesión desde Supabase Auth (admin) — todos los usuarios demo comparten `NovaLab` y es una credencial pública.
2. **Promueve o degrada roles** desde `/admin/organizaciones` (solo superadmin) o `/configuracion` (admin de org/sede).
3. **Limpia los datos demo** cuando termines:

   ```sql
   delete from public."LIS_organizations"
   where slug in ('santa-lucia','ceramed');
   ```

   La cascada elimina sedes, membresías, pacientes, órdenes, muestras, resultados, facturas y auditoría.
4. **Nunca** subas las credenciales generadas al repositorio; envía este documento al cliente por canal seguro (correo cifrado, Vault, etc.).