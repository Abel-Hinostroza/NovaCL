-- ============================================================================
-- 0001 · Foundation: extensiones, esquema de utilidades y tipos enumerados
-- ============================================================================

create extension if not exists "pgcrypto";      -- gen_random_uuid, crypt
create extension if not exists "citext";         -- emails case-insensitive
create extension if not exists "pg_trgm";        -- busqueda por similitud

-- Esquema privado para helpers de autorizacion (no expuesto por la API)
create schema if not exists app;

-- ─────────────────────────────────────────────────────────────
-- Tipos enumerados del dominio
-- ─────────────────────────────────────────────────────────────

-- Roles del sistema. Se manejan por sede via memberships.
create type app.role as enum (
  'org_admin',      -- administrador de la organizacion (todas las sedes)
  'sede_admin',     -- administrador de una sede
  'recepcion',      -- registro de pacientes y ordenes
  'toma_muestra',   -- flebotomia / recoleccion de muestras
  'analista',       -- ingreso de resultados
  'validador',      -- validacion / firma de resultados (patologo/bioquimico)
  'facturacion',    -- facturacion e integracion Wally
  'medico',         -- medico solicitante (lectura de resultados)
  'lectura'         -- solo lectura / auditoria
);

create type app.order_status as enum (
  'registrada',     -- creada en recepcion
  'en_toma',        -- en proceso de toma de muestra
  'en_proceso',     -- muestras en laboratorio
  'parcial',        -- algunos resultados listos
  'completada',     -- todos los resultados validados
  'entregada',      -- entregada al paciente
  'anulada'
);

create type app.order_priority as enum ('rutina', 'urgente', 'stat');

create type app.item_status as enum (
  'pendiente',
  'en_proceso',
  'resultado_cargado',
  'validado',
  'rechazado',
  'anulado'
);

create type app.sample_status as enum (
  'pendiente',      -- por tomar
  'tomada',         -- recolectada
  'en_transito',    -- enviada a la sede procesadora
  'recibida',       -- recibida en laboratorio
  'en_analisis',
  'procesada',
  'rechazada'       -- muestra no apta (hemolisis, coagulo, etc.)
);

create type app.result_status as enum (
  'pendiente',
  'preliminar',
  'validado',
  'rechazado',
  'corregido'
);

create type app.result_flag as enum (
  'normal',
  'bajo',
  'alto',
  'critico_bajo',
  'critico_alto',
  'anormal'          -- cualitativo fuera de referencia
);

create type app.value_type as enum ('numerico', 'texto', 'opcion', 'titulo');

create type app.sex as enum ('M', 'F', 'otro', 'desconocido');

create type app.delivery_channel as enum ('portal', 'email', 'sms', 'whatsapp', 'impreso');
create type app.delivery_status as enum ('pendiente', 'enviado', 'visto', 'fallido');

create type app.invoice_status as enum (
  'borrador', 'emitida', 'pagada', 'anulada', 'error_sync'
);

-- ─────────────────────────────────────────────────────────────
-- Utilidad: touch updated_at
-- ─────────────────────────────────────────────────────────────
create or replace function app.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
