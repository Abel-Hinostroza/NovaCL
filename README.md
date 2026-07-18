# Nova Lab — Sistema de Información de Laboratorio Clínico (LIS)

Plataforma **multi-sede** y **multi-tenant** para laboratorios clínicos: registro de
pacientes, atención/órdenes, toma de muestras, ingreso y validación de resultados,
entrega al paciente (portal + email), facturación (integración **Wally**) y
**trazabilidad completa** de cada acción.

Construido para **desplegar en Vercel** con **Supabase** (Postgres + Auth + RLS + Storage).

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 15 (App Router, Server Components, Server Actions) |
| Lenguaje | TypeScript (strict) |
| UI | Tailwind CSS v4 + componentes propios estilo shadcn/ui + Radix UI |
| Estado servidor | TanStack Query (donde aplica), Server Actions |
| Base de datos | Supabase / PostgreSQL con Row Level Security |
| Auth | Supabase Auth (email/password), sesión por cookies (SSR) |
| Validación | Zod |
| Notificaciones | Adaptador de email (Resend, opcional) |
| Facturación | Adaptador Wally (modular, con modo simulación) |

---

## Arranque rápido (local)

Requisitos: Node 20+, [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
# 1. Dependencias
npm install

# 2. Variables de entorno
cp .env.example .env.local
# (con Supabase local, usa las llaves que imprime `supabase start`)

# 3. Base de datos local (aplica migraciones + seed)
supabase start
supabase db reset      # corre supabase/migrations/*.sql y supabase/seed.sql

# 4. App
npm run dev
```

El usuario administrativo inicial se crea mediante `supabase/seed.sql` y sus
credenciales se administran desde Supabase Auth.

---

## Módulos

| Módulo | Ruta | Descripción |
|--------|------|-------------|
| Panel | `/dashboard` | Métricas operativas de la sede (órdenes, críticos, pacientes). |
| Pacientes | `/pacientes` | Registro y búsqueda; historial por paciente. |
| Órdenes / Atención | `/ordenes` | Alta de atención, selección de estudios y precios, prioridad. |
| Muestras | `/muestras` | Worklist de muestras con código de barras y cambios de estado. |
| Resultados | `/resultados` | Ingreso de valores con flag automático y validación/firma. |
| Entrega | `/entrega` | Envío al paciente por email o enlace al portal. |
| Portal paciente | `/portal/[token]` | Vista pública de resultados validados (sin login, por token). |
| Reporte PDF | `/reportes/[id]` | Reporte imprimible del resultado (Guardar como PDF desde el navegador). |
| Catálogo | `/catalogo` | CRUD de estudios, analitos y categorías (globales de solo lectura + propios editables). |
| Facturación | `/facturacion` | Emisión de comprobantes vía Wally (o manual) + webhook de estados de pago. |
| Trazabilidad | `/trazabilidad` | Bitácora de auditoría de la organización. |
| Configuración | `/configuracion` | Sedes, equipo/roles e integración de facturación. |

---

## Multi-tenancy y roles

- **Organization** = tenant (cada clínica que usa el sistema).
- **Sede** = sucursal dentro de una organización.
- **Membership** = usuario + rol, opcionalmente acotado a una sede
  (`sede_id = null` ⇒ rol para toda la organización).

Roles: `org_admin`, `sede_admin`, `recepcion`, `toma_muestra`, `analista`,
`validador`, `facturacion`, `medico`, `lectura`.

El aislamiento entre organizaciones se garantiza con **Row Level Security** en la
base de datos (ver `supabase/migrations/0009_rls_policies.sql`), de modo que la
seguridad no depende del código de la aplicación.

Consulta [ARCHITECTURE.md](./ARCHITECTURE.md) para el detalle del modelo de datos,
las políticas RLS y los puntos de extensión.

---

## Webhook de facturación (Wally)

Endpoint: `POST /api/webhooks/wally` — actualiza el estado de pago de un
comprobante (`pagada`, `anulada`, …) y registra el evento en `LIS_invoice_events`.

- Autenticación por secreto compartido: header `x-wally-signature` (o `?secret=`)
  validado contra `WALLY_WEBHOOK_SECRET`.
- Payload flexible: `{ external_id | id, status, serie?, numero?, pdf_url? }`.
- Configura esta URL en el panel de Wally apuntando a tu dominio de Vercel.

```bash
curl -X POST https://tu-dominio/api/webhooks/wally \
  -H "x-wally-signature: $WALLY_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"external_id":"INV-123","status":"paid"}'
```

## Migración a Supabase remoto (sin CLI)

Para un proyecto Supabase hosted, aplica el esquema desde el **SQL Editor**:

1. `supabase/apply_all_schema.sql` → crea tablas, funciones, RLS y triggers.
2. `supabase/seed_catalog.sql` → carga el catálogo clínico global (sin datos demo).

Alternativamente, con la CLI enlazada: `supabase db push`.

---

## Despliegue

Ver [DEPLOYMENT.md](./DEPLOYMENT.md) para el paso a paso en **Vercel + Supabase**
(migraciones, variables de entorno, dominios y portal público).

---

## Scripts

```bash
npm run dev        # desarrollo
npm run build      # build de producción
npm run start      # servir el build
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run db:reset   # resetear BD local (migraciones + seed)
npm run db:types   # regenerar src/lib/database.types.ts desde el esquema
```

> `src/lib/database.types.ts` está escrito a mano para reflejar el esquema.
> Con Supabase CLI puedes regenerarlo (`npm run db:types`) para obtener tipos
> completos de relaciones; entonces podrás retirar los `as unknown as` usados en
> los *embeds* de consultas anidadas.
