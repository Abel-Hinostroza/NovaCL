# Despliegue — Vercel + Supabase

## 1. Crear el proyecto en Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Aplica las migraciones y el seed. Con la CLI:
   ```bash
   supabase link --project-ref <TU_REF>
   supabase db push          # aplica supabase/migrations/*
   # Seed (opcional en producción; contiene datos demo):
   psql "$DATABASE_URL" -f supabase/seed.sql
   ```
   > En producción probablemente NO quieras el usuario/organización demo del seed.
   > Puedes correr solo la parte del catálogo global, o registrar tu primer usuario
   > desde la app y crear la organización con el onboarding (`bootstrap_organization`).
3. En **Authentication → URL Configuration**, agrega tu dominio de Vercel a
   *Site URL* y *Redirect URLs*.

## 2. Variables de entorno

Configúralas en Vercel (**Project → Settings → Environment Variables**) y en
`.env.local` para desarrollo:

| Variable | Descripción |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Llave anónima (pública). |
| `SUPABASE_SERVICE_ROLE_KEY` | Llave service role. **Solo servidor.** Usada por el portal público y jobs. |
| `NEXT_PUBLIC_APP_URL` | URL pública de la app. |
| `RESULTS_PUBLIC_BASE_URL` | Base del portal de resultados (`https://tu-dominio/portal`). |
| `RESEND_API_KEY` | (Opcional) envío de emails de resultados. |
| `WALLY_API_BASE_URL`, `WALLY_API_KEY` | (Opcional) integración de facturación. Sin ellas, modo simulación. |

## 3. Desplegar en Vercel

1. Importa el repositorio en Vercel (framework: **Next.js**, sin configuración extra).
2. Define las variables de entorno de arriba.
3. Deploy. El build ejecuta `next build`.

El middleware (`src/middleware.ts`) refresca la sesión y protege las rutas
privadas; el portal público (`/portal/...`) y `/login` quedan accesibles sin sesión.

## 4. Primer uso

1. Regístrate desde `/login` (o crea un usuario en Supabase Auth).
2. Al no tener organización, verás el **onboarding**: crea tu organización y su
   primera sede; quedarás como `org_admin`.
3. En **Configuración** añade sedes y asigna roles a tu equipo (por email; el
   usuario debe haberse registrado antes).

## 5. Notas de seguridad

- La `SUPABASE_SERVICE_ROLE_KEY` nunca se expone al cliente: solo se usa en
  `createAdminClient()` (portal público acotado por token, integraciones).
- El aislamiento entre clínicas lo garantiza RLS en Postgres.
- Los enlaces del portal caducan (30 días por defecto) y registran cuándo se ven.
- Revisa las políticas de retención/consentimiento aplicables a datos de salud en
  tu jurisdicción antes de operar en producción.
