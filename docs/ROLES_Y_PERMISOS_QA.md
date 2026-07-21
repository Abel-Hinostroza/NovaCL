# Roles, permisos y flujo de QA · Nova Lab

> Documento de referencia para **implementación y pruebas**. Mantiene la
> matriz de permisos por defecto del sistema, la precedencia cuando se
> sobrescribe, y un guion de actividades por rol para ejecutar QA de extremo
> a extremo.

---

## 1. Roles

Definidos como enum en `supabase/migrations/0001_foundation.sql`
(`app.role`). Se asignan a un usuario por organización y, opcionalmente,
por sede (`sede_id = null` ⇒ el rol aplica a toda la organización).

| Clave | Etiqueta | Visión general |
|---|---|---|
| `org_admin` | Administrador de organización | Acceso total a su organización (todas las sedes). Crea sedes, asigna miembros, configura facturación y permisos. |
| `sede_admin` | Administrador de sede | Acceso total dentro de su sede. Configura equipo/roles y permisos específicos. |
| `recepcion` | Recepción | Registra pacientes y abre órdenes de atención. |
| `toma_muestra` | Toma de muestra | Gestiona el ciclo de vida de las muestras (toma, tránsito, rechazo). |
| `analista` | Analista | Ingresa resultados, carga analitos. |
| `validador` | Validador | Valida y firma resultados; responsable del aviso de críticos. |
| `facturacion` | Facturación | Emite comprobantes y gestiona la integración con Wally. |
| `medico` | Médico solicitante | Lectura de pacientes/resultados; médico con cuenta en el LIS. |
| `lectura` | Solo lectura / auditoría | Visibilidad sin edición. |

> **Superadmin de plataforma** (`LIS_profiles.es_superadmin`) es un caso aparte
> fuera del enum: ignora RLS y toda la matriz de permisos; se usa para
> soporte.

---

## 2. Multi-tenancy y alcance

- **Organization** = tenant (clínica que contrata).
- **Sede** = sucursal dentro de la organización.
- **Membership** = `(organization_id, sede_id?, user_id, role)`. Si `sede_id`
  es `null`, el rol aplica a todas las sedes de la organización.
- El aislamiento entre tenants se garantiza con **Row Level Security** en la
  base de datos (ver `supabase/migrations/0009_rls_policies.sql`); la
  seguridad no depende del código de la app.

---

## 3. Matriz de permisos por defecto

Sin sobrescritura, estos son los permisos efectivos por rol y módulo
(definidos en `src/lib/permissions.ts`).

- `V` = puede **ver** el módulo (aparece en el menú y la ruta carga).
- `E` = puede **editar** (escribir). Implica ver.
- `—` = no tiene acceso por defecto.

| Módulo | org_admin | sede_admin | recepcion | toma_muestra | analista | validador | facturacion | medico | lectura |
|---|---|---|---|---|---|---|---|---|---|
| Panel (dashboard) | V/E | V/E | V/E | V/E | V/E | V/E | V/E | V/E | V |
| Agenda | V/E | V/E | V/E | — | — | — | — | V | — |
| Pacientes | V/E | V/E | V/E | — | — | — | — | V | V |
| Órdenes / Atención | V/E | V/E | V/E | — | — | — | — | — | — |
| Muestras | V/E | V/E | V/E | V/E | V/E | V/E | — | — | — |
| Resultados | V/E | V/E | — | — | V/E | V/E | — | V | — |
| Entrega | V/E | V/E | V/E | — | — | V/E | — | — | — |
| Inventario | V/E | V/E | V/E | V/E | V/E | — | — | — | V |
| Analítica | V/E | V/E | — | — | — | — | V/E | — | V |
| Catálogo | V/E | V/E | — | — | — | — | — | — | — |
| Facturación | V/E | V/E | — | — | — | — | V/E | — | — |
| Trazabilidad | V/E | V/E | — | — | — | — | — | — | V |
| Configuración | V/E | V/E | — | — | — | — | — | — | — |
| Admin · Organizaciones | — | — | — | — | — | — | — | — | — |

> **Notas**:
> - `medico` y `lectura` son los dos roles "read-only": ven pero no editan.
> - El superadmin de plataforma ve y edita todo (`ALL_ALLOWED`).
> - La matriz es la **unión** de los permisos del usuario: si un usuario
>   tiene `recepcion + lectura`, gana lo mejor de cada uno.

### 3.1 Precedencia de sobrescrituras

Los administradores de la organización pueden guardar permisos granulares
por rol y por sede en `LIS_role_permissions`. La precedencia es:

1. **Sede específica** (fila con `sede_id = sede activa`) — gana.
2. **Toda la organización** (fila con `sede_id = null`) — segunda.
3. **Defaults del sistema** (este documento) — última instancia.

El botón "Restaurar defaults" en `/configuracion → Permisos` elimina las
filas del rol y el alcance elegidos, volviendo a los defaults.

---

## 4. Reglas de RLS que el QA debe verificar

Estas políticas son la última línea de defensa; la UI las refleja pero no
las sustituye.

| Tabla | Lectura | Escritura |
|---|---|---|
| `LIS_organizations` | miembros de la org | `org_admin` |
| `LIS_sedes` | miembros de la org | `org_admin` |
| `LIS_memberships` | uno mismo o miembros de la org | `org_admin` |
| `LIS_patients` | miembros de la org | `org_admin`, `sede_admin`, `recepcion` |
| `LIS_orders` | miembros con sede asignada | `org_admin`, `sede_admin`, `recepcion`, `facturacion` |
| `LIS_order_items` | los de la orden | `org_admin`, `sede_admin`, `recepcion`, `analista`, `validador` |
| `LIS_samples` | miembros de la org | `org_admin`, `sede_admin`, `recepcion`, `toma_muestra`, `analista`, `validador` |
| `LIS_results` | miembros de la org | `org_admin`, `sede_admin`, `analista`, `validador` |
| `LIS_result_deliveries` | miembros de la org | `org_admin`, `sede_admin`, `recepcion`, `validador` |
| `LIS_invoices` | miembros de la org | `org_admin`, `sede_admin`, `facturacion` |
| `LIS_critical_notifications` | `org_admin`, `sede_admin`, `validador`, `analista`, `recepcion`, `medico` | `org_admin`, `sede_admin`, `validador`, `analista` |
| `LIS_professionals` | miembros de la org | `org_admin` (vía RLS) |
| `LIS_audit_log` | `org_admin`, `sede_admin`, `lectura` | nunca (solo triggers) |

---

## 5. Directorio de profesionales (módulo transversal)

`LIS_professionals` (migración `0016`, extendido en `0021`) es la fuente
canónica de la **identidad profesional** (médico, tecnólogo, patólogo,
químico farmacéutico, biólogo, enfermero u otro), con:

- `nombres`, `apellidos`, `tipo`, `numero_colegiatura`, `colegio`,
  `especialidad`, `telefono`, `email`.
- `externo`: si es médico de otra institución (no usuario del LIS).
- `activo`: baja lógica.
- `user_id`: si además es usuario interno (opcional).

### Vínculos entre profesionales y el dominio clínico

| Entidad | Campo FK | Comportamiento |
|---|---|---|
| `LIS_orders.medico_solicitante_id` | médico que pide la orden | Habilita colegiatura en informe (ISO 15189). |
| `LIS_appointments.medico_solicitante_id` | médico de la cita | Propagado a la orden al hacer check-in. |
| `LIS_critical_notifications.notificado_a_id` | receptor del aviso crítico | Mantiene la constancia de aviso. |
| `LIS_professionals.user_id` | usuario del LIS (analista/validador) | Permite firmar informes con su colegiatura (uso en `consolidated-report.ts`). |

> Los textos libres (`medico_solicitante`, `notificado_a`) se conservan
> como respaldo para profesionales externos no registrados o
> circunstancias donde se quiere registrar un nombre sin ID.

---

## 6. Flujo de actividades por rol (guion de QA)

Esta es la **ruta feliz** de extremo a extremo. Cada paso es verificable
con la consulta al pie.

### 6.1 Recepción (`recepcion`)

1. Inicia sesión → **Panel** muestra KPIs.
2. Va a **Pacientes** → "Nuevo paciente" → completa identificación y
   datos clínicos de seguridad (grupo sanguíneo, alergias, seguro,
   contacto de emergencia).
3. Va a **Órdenes → Nueva atención**:
   - Selecciona paciente.
   - Elige uno o más estudios del catálogo.
   - Elige prioridad (`rutina` / `urgente` / `stat`).
   - **Médico solicitante**: usa el buscador del directorio de
     profesionales (debe autocompletar por nombre, apellido, colegiatura o
     especialidad). Verifica que la colegiatura aparece en el detalle de
     la orden.
   - Diagnóstico, observaciones.
4. Crea la orden. El sistema asigna `codigo` correlativo.
5. (Opcional) **Agregar estudio** a una orden existente desde el detalle.

**Verificación RLS**: el rol `toma_muestra` NO debe ver la lista de
órdenes registradas hasta que haya una muestra asociada, y NO debe poder
editar la orden.

### 6.2 Agenda y check-in (`recepcion`, `sede_admin`)

1. Va a **Agenda** → "+" → **Nueva cita**.
2. Busca paciente, fija fecha/hora/duración/canal, motivo y médico
   solicitante (usando el buscador de profesionales).
3. Preselecciona estudios (opcional).
4. Al llegar el paciente: clic en la cita → **Check-in**. El sistema crea
   la orden con los estudios preseleccionados y enlaza la cita.

### 6.3 Toma de muestra (`toma_muestra`)

1. Va a **Muestras**: ve la worklist con los códigos de barras pendientes.
2. Toma la muestra: cambia estado a `tomada` (queda registrada la hora y
   el usuario).
3. Recepción en sede procesadora: cambia a `recibida`.
4. Si hay problemas: cambia a `rechazada` con motivo (esto regresa el
   `order_item` correspondiente a `en_proceso` para una nueva toma).

### 6.4 Análisis (`analista`)

1. Va a **Resultados** → elige la orden → ve los analitos del estudio.
2. Ingresa los valores numéricos o de opción. El sistema calcula
   automáticamente el flag (`normal`, `bajo`, `alto`, `critico_bajo`,
   `critico_alto`, `anormal`) comparando contra los rangos de referencia
   del analito (filtrados por sexo y edad del paciente).
3. **Guardar borrador** (estado `preliminar`).
4. Si la variación frente al último resultado validado del paciente es
   superior al 50 % (delta check), aparece un diálogo amarillo pidiendo
   revisar identidad de la muestra.
5. Si los valores son críticos, aparece el diálogo rojo de aviso.

### 6.5 Validación y firma (`validador`)

1. Tras guardar el borrador, hace clic en **Validar y firmar**.
2. El sistema marca cada resultado como `validado` con
   `validado_por = user_id` y `validado_at = now()`.
3. Cuando el último `order_item` se valida, la orden pasa a
   `completada` y se dispara la **automatización**:
   - Genera un PDF del informe en Storage (`LIS_report_documents`).
   - Si `auto_invoice` está activo, emite el comprobante vía Wally.
   - Si `auto_deliver` está activo, envía los resultados al paciente.

### 6.6 Aviso de valor crítico (`validador` o `analista`)

Al validar, si hay críticos:

1. Aparece un diálogo obligatorio.
2. En **"Se avisó a"**: el QA debe buscar al profesional receptor desde
   el directorio (autocomplete por nombre, colegiatura, especialidad).
3. Selecciona **medio** (teléfono/email/presencial/otro), añade nota.
4. Al confirmar, se persiste `LIS_critical_notifications` con el
   `notificado_a_id` para que la trazabilidad registre **quién** recibió
   el aviso y, cuando aplique, su colegiatura.

### 6.7 Entrega (`recepcion`, `validador`)

1. Va a **Entrega** → elige la orden completada.
2. Elige canal (`email` o `portal`) y destino. Se genera un `access_token`
   público con expiración.
3. El paciente entra a `/portal/[token]` y ve sus resultados validados,
   sin necesidad de cuenta.

### 6.8 Facturación (`facturacion`)

1. Va a **Facturación** → elige orden → **Emitir comprobante**.
2. El sistema llama a Wally con los items, igv, moneda y serie
   configurados en `/configuracion`.
3. El webhook `POST /api/webhooks/wally` actualiza el estado de pago.

### 6.9 Médico solicitante (`medico`)

1. Ve **Pacientes** y **Resultados** (solo lectura).
2. Para auditoría: la colegiatura del médico que validó cada resultado
   aparece en el PDF del informe (campo `validadoPor` del reporte
   consolidado).

### 6.10 Solo lectura (`lectura`)

1. Ve Dashboard, Pacientes, Inventario, Analítica y Trazabilidad sin
   poder editar nada. Útil para auditores externos.

### 6.11 Configuración (`org_admin` / `sede_admin`)

1. **Sedes**: alta/baja de sucursales. Solo `org_admin` puede crear.
2. **Equipo y roles**: alta/baja de miembros.
3. **Profesionales** (directorio): registrar médicos, tecnólogos, etc.
   Su colegiatura aparece luego en órdenes, citas y avisos críticos.
4. **Permisos**: matriz granular por rol y sede, con botón "Restaurar
   defaults".
5. **Facturación**: activar Wally, definir serie, igv, auto-facturación,
   auto-entrega.

---

## 7. Consultas SQL de verificación para QA

```sql
-- 1) Confirmar el esquema de profesionales y los FKs
\d public."LIS_professionals"
\d public."LIS_orders"
\d public."LIS_appointments"
\d public."LIS_critical_notifications"

-- 2) Permisos efectivos: simular la matriz por rol para la org activa
select m.role, p.module, p.can_view, p.can_edit, p.sede_id
from   public."LIS_role_permissions" p
join   public."LIS_memberships" m on m.organization_id = p.organization_id
where  p.organization_id = '<org_id>'
order  by m.role, p.module;

-- 3) Auditoría reciente (quién hizo qué)
select actor_email, entidad, accion, created_at
from   public."LIS_audit_log"
where  organization_id = '<org_id>'
order  by created_at desc
limit  50;

-- 4) Avisos críticos recientes
select created_at, notificado_a, notificado_a_id, medio, analitos
from   public."LIS_critical_notifications"
where  organization_id = '<org_id>'
order  by created_at desc
limit  20;

-- 5) Profesionales activos de la organización
select id, tipo, nombres, apellidos, numero_colegiatura, colegio, especialidad, externo
from   public."LIS_professionals"
where  organization_id = '<org_id>'
  and  activo = true
order  by apellidos, nombres;
```

---

## 8. Cambios recientes (resumen para QA)

| Cambio | Migración / archivo | Impacto |
|---|---|---|
| `LIS_orders.medico_solicitante_id` ya existía, pero no se usaba | `0016` | Mostrar colegiatura en orden y reporte. |
| `LIS_appointments.medico_solicitante_id` | `0021_professional_links.sql` | Cita → orden hereda el médico. |
| `LIS_critical_notifications.notificado_a_id` | `0021_professional_links.sql` | Trazabilidad de avisos críticos con identidad del receptor. |
| `create_order(p_medico_id)` | `0021_professional_links.sql` + `0010_views_rpc.sql` | La RPC acepta el id del profesional. |
| `ProfessionalPicker` (selector con búsqueda) | `src/components/professionals/professional-picker.tsx` | Usado en nueva orden, nueva cita y aviso de crítico. |
| `searchProfessionalsAction` | `src/lib/actions/professionals.ts` | Server action para el buscador. |
| Reporte consolidado muestra colegiatura del médico solicitante | `src/lib/consolidated-report.ts` | Cumplimiento ISO 15189. |

### Aplicar el cambio en una BD existente

```bash
# Con la CLI de Supabase enlazada al proyecto
supabase db push

# O sin CLI: desde el SQL Editor, en orden
# 001_foundation … 0020_app_schema_grants (estado previo)
# 0021_professional_links.sql   ← nueva
```
