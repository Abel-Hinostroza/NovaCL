-- ============================================================================
-- 0029 · Historia clínica del paciente (módulo completo)
--
--   Sustenta una historia clínica electrónica dentro del perfil del paciente,
--   alineada a la práctica y normativa del sector salud peruano:
--     · NTS N° 139-MINSA/2018/DGAIN — Gestión de la Historia Clínica
--       (estructura mínima, identificación del profesional, inmutabilidad).
--     · Ley N° 30024 / RENHICE — HCE interoperable (adjuntos por enlace externo).
--     · Ley N° 29733 — Protección de Datos Personales (consentimiento + auditoría).
--     · ISO 15189 — la anamnesis/antecedentes sustentan la interpretación de
--       resultados de laboratorio.
--
--   Principio rector: la historia clínica NO se borra ni reescribe; los
--   registros se anulan con motivo (soft-delete) y quedan firmados por el
--   profesional. Todo cambio queda en LIS_audit_log (append-only, 0007).
--
--   Contenido:
--     0) Enums de dominio clínico.
--     1) Catálogo CIE-10 (referencia global) + búsqueda por trigrama.
--     2) LIS_clinical_profile   — 1 fila por paciente (filiación ampliada,
--        seguridad, gineco-obstétrico, hábitos, consentimiento de datos).
--     3) LIS_clinical_conditions — lista de problemas / antecedentes (CIE-10).
--     4) LIS_allergies          — alergias estructuradas (dato de seguridad).
--     5) LIS_medications        — medicación habitual / actual.
--     6) LIS_vitals             — signos vitales / antropometría (evolutivo).
--     7) LIS_clinical_notes     — notas de evolución (firma profesional opcional).
--     8) LIS_clinical_attachments — adjuntos: archivos, imágenes y enlaces.
--     9) RLS de todas las tablas nuevas.
--    10) Bucket de Storage privado `clinical` + políticas.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────
-- 0 · Enums de dominio clínico
-- ─────────────────────────────────────────────────────────────
do $$ begin
  create type app.condition_kind as enum
    ('personal','familiar','quirurgico','congenito','no_patologico','otro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app.condition_status as enum ('activo','cronico','resuelto');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app.allergy_type as enum ('farmaco','alimento','ambiental','otro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app.allergy_severity as enum ('leve','moderada','grave','anafilaxia');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app.med_route as enum
    ('oral','intravenosa','intramuscular','subcutanea','topica','inhalatoria','oftalmica','otica','rectal','otra');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app.med_status as enum ('activo','suspendido','finalizado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app.clinical_note_kind as enum
    ('anamnesis','evolucion','interconsulta','indicaciones','procedimiento','otro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app.clinical_note_status as enum ('borrador','firmada','anulada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app.attachment_kind as enum
    ('informe_externo','laboratorio_externo','imagen','receta','consentimiento','identidad','renhice','otro');
exception when duplicate_object then null; end $$;

-- Helper de autorización: ¿el usuario puede escribir historia clínica en la org?
-- Historia clínica la registran recepción (filiación), personal clínico y
-- médicos. Se centraliza aquí para no repetir el arreglo de roles.
create or replace function app.can_write_clinical(p_org uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select app.is_superadmin() or app.has_org_role(p_org,
    array['org_admin','sede_admin','recepcion','medico','analista','validador']::app.role[]);
$$;

-- ─────────────────────────────────────────────────────────────
-- 1 · Catálogo CIE-10 (referencia global, compartida entre tenants)
--   Se siembra un subconjunto frecuente; la lista MINSA completa puede
--   cargarse en bloque con COPY sobre esta misma tabla sin migración.
-- ─────────────────────────────────────────────────────────────
create table if not exists public."LIS_cie10" (
  codigo       text primary key,          -- p.ej. 'E11.9'
  descripcion  text not null,
  categoria    text,                       -- código de 3 caracteres (padre)
  capitulo     text,                       -- capítulo CIE-10
  activo       boolean not null default true
);
create index if not exists "LIS_idx_cie10_desc_trgm" on public."LIS_cie10"
  using gin (descripcion gin_trgm_ops);
create index if not exists "LIS_idx_cie10_cod_trgm" on public."LIS_cie10"
  using gin (codigo gin_trgm_ops);

comment on table public."LIS_cie10" is
  'Catálogo CIE-10 (referencia global). Búsqueda por código o descripción vía app.search_cie10().';

-- Búsqueda tolerante (código exacto/prefijo o descripción por trigrama)
create or replace function app.search_cie10(p_q text, p_limit int default 20)
returns setof public."LIS_cie10"
language sql stable
as $$
  select *
  from public."LIS_cie10"
  where activo
    and (
      p_q is null or btrim(p_q) = ''
      or codigo ilike btrim(p_q) || '%'
      or descripcion ilike '%' || btrim(p_q) || '%'
    )
  order by
    (codigo ilike btrim(p_q) || '%') desc,     -- prioriza coincidencia por código
    codigo
  limit greatest(1, least(p_limit, 50));
$$;
grant execute on function app.search_cie10(text, int) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2 · Perfil clínico (1 fila por paciente)
-- ─────────────────────────────────────────────────────────────
create table if not exists public."LIS_clinical_profile" (
  patient_id        uuid primary key references public."LIS_patients"(id) on delete cascade,
  organization_id   uuid not null references public."LIS_organizations"(id) on delete cascade,
  -- filiación ampliada (NTS 139 · datos generales)
  estado_civil      text,   -- soltero/casado/conviviente/viudo/divorciado
  ocupacion         text,
  grado_instruccion text,   -- primaria/secundaria/técnica/superior…
  lugar_nacimiento  text,
  procedencia       text,
  -- seguridad (viajan al banner del perfil)
  factor_rh         text,   -- '+', '-', 'desconocido'  (el grupo ABO ya vive en LIS_patients.grupo_sanguineo)
  donante_organos   boolean,
  -- gineco-obstétrico (se muestra según sexo)
  go_menarquia_edad int,
  go_fur            date,   -- fecha de última regla
  go_gestaciones    int,
  go_partos         int,
  go_abortos        int,
  go_cesareas       int,
  go_anticonceptivo text,
  go_notas          text,
  -- hábitos nocivos / estilo de vida
  habito_tabaco     text,
  habito_alcohol    text,
  habito_drogas     text,
  habito_actividad  text,
  -- consentimiento de tratamiento de datos (Ley 29733)
  consent_datos     boolean not null default false,
  consent_datos_at  timestamptz,
  consent_version   text,
  notas_generales   text,
  updated_por       uuid references public."LIS_profiles"(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists "LIS_idx_clin_profile_org" on public."LIS_clinical_profile"(organization_id);
drop trigger if exists trg_clin_profile_touch on public."LIS_clinical_profile";
create trigger trg_clin_profile_touch before update on public."LIS_clinical_profile"
  for each row execute function app.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 3 · Antecedentes / lista de problemas (con CIE-10)
-- ─────────────────────────────────────────────────────────────
create table if not exists public."LIS_clinical_conditions" (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public."LIS_organizations"(id) on delete cascade,
  patient_id      uuid not null references public."LIS_patients"(id) on delete cascade,
  kind            app.condition_kind not null default 'personal',
  cie10_codigo    text references public."LIS_cie10"(codigo) on delete set null,
  descripcion     text not null,          -- glosa (snapshot CIE-10 o texto libre)
  status          app.condition_status not null default 'activo',
  fecha_inicio    date,
  fecha_resolucion date,
  parentesco      text,                    -- para antecedentes familiares
  notas           text,
  profesional_id  uuid references public."LIS_professionals"(id) on delete set null, -- firma opcional
  registrado_por  uuid references public."LIS_profiles"(id) on delete set null,
  anulado         boolean not null default false,
  anulado_motivo  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists "LIS_idx_clin_cond_patient" on public."LIS_clinical_conditions"(patient_id, anulado);
drop trigger if exists trg_clin_cond_touch on public."LIS_clinical_conditions";
create trigger trg_clin_cond_touch before update on public."LIS_clinical_conditions"
  for each row execute function app.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 4 · Alergias (dato de seguridad, se muestra destacado)
-- ─────────────────────────────────────────────────────────────
create table if not exists public."LIS_allergies" (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public."LIS_organizations"(id) on delete cascade,
  patient_id      uuid not null references public."LIS_patients"(id) on delete cascade,
  tipo            app.allergy_type not null default 'farmaco',
  agente          text not null,           -- penicilina, látex, mariscos…
  reaccion        text,                     -- urticaria, edema, shock…
  severidad       app.allergy_severity,
  activa          boolean not null default true,
  notas           text,
  profesional_id  uuid references public."LIS_professionals"(id) on delete set null,
  registrado_por  uuid references public."LIS_profiles"(id) on delete set null,
  anulado         boolean not null default false,
  anulado_motivo  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists "LIS_idx_allergy_patient" on public."LIS_allergies"(patient_id, anulado);
drop trigger if exists trg_allergy_touch on public."LIS_allergies";
create trigger trg_allergy_touch before update on public."LIS_allergies"
  for each row execute function app.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 5 · Medicación habitual / actual
-- ─────────────────────────────────────────────────────────────
create table if not exists public."LIS_medications" (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public."LIS_organizations"(id) on delete cascade,
  patient_id      uuid not null references public."LIS_patients"(id) on delete cascade,
  farmaco         text not null,
  dosis           text,                    -- '500 mg', '10 UI'…
  via             app.med_route,
  frecuencia      text,                    -- 'c/8h', '1 vez al día'…
  indicado_por    text,                    -- prescriptor (texto libre)
  profesional_id  uuid references public."LIS_professionals"(id) on delete set null,
  status          app.med_status not null default 'activo',
  fecha_inicio    date,
  fecha_fin       date,
  notas           text,
  registrado_por  uuid references public."LIS_profiles"(id) on delete set null,
  anulado         boolean not null default false,
  anulado_motivo  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists "LIS_idx_med_patient" on public."LIS_medications"(patient_id, anulado);
drop trigger if exists trg_med_touch on public."LIS_medications";
create trigger trg_med_touch before update on public."LIS_medications"
  for each row execute function app.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 6 · Signos vitales / antropometría (registro evolutivo)
--   IMC calculado y almacenado a partir de peso/talla.
-- ─────────────────────────────────────────────────────────────
create table if not exists public."LIS_vitals" (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public."LIS_organizations"(id) on delete cascade,
  patient_id         uuid not null references public."LIS_patients"(id) on delete cascade,
  tomado_at          timestamptz not null default now(),
  pa_sistolica       int,        -- mmHg
  pa_diastolica      int,        -- mmHg
  fc                 int,        -- lpm
  fr                 int,        -- rpm
  temperatura        numeric(4,1), -- °C
  sato2              int,        -- %
  peso_kg            numeric(5,2),
  talla_cm           numeric(5,1),
  imc                numeric(5,2) generated always as (
    case when peso_kg is not null and talla_cm is not null and talla_cm > 0
      then round(peso_kg / power(talla_cm / 100.0, 2), 2)
    end
  ) stored,
  perimetro_abdominal numeric(5,1), -- cm
  glucosa_capilar    numeric(5,1),  -- mg/dL
  notas              text,
  profesional_id     uuid references public."LIS_professionals"(id) on delete set null,
  tomado_por         uuid references public."LIS_profiles"(id) on delete set null,
  anulado            boolean not null default false,
  anulado_motivo     text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists "LIS_idx_vitals_patient" on public."LIS_vitals"(patient_id, tomado_at desc);
drop trigger if exists trg_vitals_touch on public."LIS_vitals";
create trigger trg_vitals_touch before update on public."LIS_vitals"
  for each row execute function app.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 7 · Notas de evolución / encuentros clínicos
--   Firma de profesional opcional; una nota firmada es inmutable (se corrige
--   creando una nueva o anulando con motivo).
-- ─────────────────────────────────────────────────────────────
create table if not exists public."LIS_clinical_notes" (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public."LIS_organizations"(id) on delete cascade,
  patient_id      uuid not null references public."LIS_patients"(id) on delete cascade,
  order_id        uuid references public."LIS_orders"(id) on delete set null, -- atención vinculada (opcional)
  kind            app.clinical_note_kind not null default 'evolucion',
  titulo          text,
  cuerpo          text not null,
  status          app.clinical_note_status not null default 'borrador',
  profesional_id  uuid references public."LIS_professionals"(id) on delete set null, -- firmante opcional
  firmado_at      timestamptz,
  registrado_por  uuid references public."LIS_profiles"(id) on delete set null,
  anulado_motivo  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists "LIS_idx_clin_note_patient" on public."LIS_clinical_notes"(patient_id, created_at desc);
drop trigger if exists trg_clin_note_touch on public."LIS_clinical_notes";
create trigger trg_clin_note_touch before update on public."LIS_clinical_notes"
  for each row execute function app.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 8 · Adjuntos: archivos (imágenes/documentos) y enlaces externos
--   Cada fila es un archivo en Storage O un enlace externo, nunca ambos.
-- ─────────────────────────────────────────────────────────────
create table if not exists public."LIS_clinical_attachments" (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public."LIS_organizations"(id) on delete cascade,
  patient_id      uuid not null references public."LIS_patients"(id) on delete cascade,
  order_id        uuid references public."LIS_orders"(id) on delete set null,
  kind            app.attachment_kind not null default 'otro',
  titulo          text not null,
  descripcion     text,
  storage_path    text,      -- ruta en el bucket privado `clinical`
  url_externa     text,      -- enlace a otro sistema (RENHICE, PACS, drive…)
  mime            text,
  size_bytes      bigint,
  subido_por      uuid references public."LIS_profiles"(id) on delete set null,
  anulado         boolean not null default false,
  anulado_motivo  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint "LIS_chk_attachment_source" check (
    (storage_path is not null and url_externa is null)
    or (storage_path is null and url_externa is not null)
  )
);
create index if not exists "LIS_idx_clin_att_patient" on public."LIS_clinical_attachments"(patient_id, anulado);
drop trigger if exists trg_clin_att_touch on public."LIS_clinical_attachments";
create trigger trg_clin_att_touch before update on public."LIS_clinical_attachments"
  for each row execute function app.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 9 · Auditoría (append-only) para todas las tablas nuevas
-- ─────────────────────────────────────────────────────────────
drop trigger if exists trg_audit_clin_profile on public."LIS_clinical_profile";
create trigger trg_audit_clin_profile after insert or update or delete on public."LIS_clinical_profile"
  for each row execute function app.audit_trigger();
drop trigger if exists trg_audit_clin_cond on public."LIS_clinical_conditions";
create trigger trg_audit_clin_cond after insert or update or delete on public."LIS_clinical_conditions"
  for each row execute function app.audit_trigger();
drop trigger if exists trg_audit_allergy on public."LIS_allergies";
create trigger trg_audit_allergy after insert or update or delete on public."LIS_allergies"
  for each row execute function app.audit_trigger();
drop trigger if exists trg_audit_med on public."LIS_medications";
create trigger trg_audit_med after insert or update or delete on public."LIS_medications"
  for each row execute function app.audit_trigger();
drop trigger if exists trg_audit_vitals on public."LIS_vitals";
create trigger trg_audit_vitals after insert or update or delete on public."LIS_vitals"
  for each row execute function app.audit_trigger();
drop trigger if exists trg_audit_clin_note on public."LIS_clinical_notes";
create trigger trg_audit_clin_note after insert or update or delete on public."LIS_clinical_notes"
  for each row execute function app.audit_trigger();
drop trigger if exists trg_audit_clin_att on public."LIS_clinical_attachments";
create trigger trg_audit_clin_att after insert or update or delete on public."LIS_clinical_attachments"
  for each row execute function app.audit_trigger();

-- ─────────────────────────────────────────────────────────────
-- 10 · RLS
-- ─────────────────────────────────────────────────────────────
alter table public."LIS_cie10"                 enable row level security;
alter table public."LIS_clinical_profile"      enable row level security;
alter table public."LIS_clinical_conditions"   enable row level security;
alter table public."LIS_allergies"             enable row level security;
alter table public."LIS_medications"           enable row level security;
alter table public."LIS_vitals"                enable row level security;
alter table public."LIS_clinical_notes"        enable row level security;
alter table public."LIS_clinical_attachments"  enable row level security;

-- Catálogo CIE-10: lectura para todo miembro autenticado; escritura superadmin.
drop policy if exists cie10_select on public."LIS_cie10";
create policy cie10_select on public."LIS_cie10" for select to authenticated using (true);
drop policy if exists cie10_write on public."LIS_cie10";
create policy cie10_write on public."LIS_cie10" for all to authenticated
  using (app.is_superadmin()) with check (app.is_superadmin());

-- Tablas de historia clínica: lectura por miembros del tenant; escritura por
-- roles clínicos. La firma y la inmutabilidad se aplican en la capa de negocio.
do $$
declare
  t text;
begin
  foreach t in array array[
    'LIS_clinical_profile','LIS_clinical_conditions','LIS_allergies',
    'LIS_medications','LIS_vitals','LIS_clinical_notes','LIS_clinical_attachments'
  ]
  loop
    execute format(
      'drop policy if exists %I on public.%I;', t || '_select', t);
    execute format($f$
      create policy %I on public.%I for select to authenticated
      using (organization_id in (select app.member_org_ids()));
    $f$, t || '_select', t);

    execute format(
      'drop policy if exists %I on public.%I;', t || '_write', t);
    execute format($f$
      create policy %I on public.%I for all to authenticated
      using (app.can_write_clinical(organization_id))
      with check (app.can_write_clinical(organization_id));
    $f$, t || '_write', t);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 11 · Storage: bucket privado `clinical`
--   Estructura: clinical/{organization_id}/{patient_id}/{uuid}.{ext}
--   Lectura: miembros del tenant (primer segmento del path = org). Escritura
--   reservada al service role del servidor (signed URLs para el visor).
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('clinical', 'clinical', false)
on conflict (id) do nothing;

drop policy if exists "clinical_read_org_members" on storage.objects;
create policy "clinical_read_org_members"
on storage.objects for select to authenticated
using (
  bucket_id = 'clinical'
  and (split_part(name, '/', 1))::uuid in (select app.member_org_ids())
);
-- Sin políticas de insert/update/delete para authenticated: la escritura queda
-- reservada al service role del servidor (createAdminClient).

-- ─────────────────────────────────────────────────────────────
-- 12 · Seed CIE-10 (subconjunto frecuente)
--   Diagnósticos y antecedentes de alta prevalencia en la práctica
--   ambulatoria y de laboratorio. La lista MINSA completa (~14 mil ítems)
--   puede cargarse luego con COPY sobre public."LIS_cie10".
-- ─────────────────────────────────────────────────────────────
insert into public."LIS_cie10" (codigo, descripcion, categoria, capitulo) values
  ('A09.0','Diarrea y gastroenteritis de presunto origen infeccioso','A09','I Infecciosas'),
  ('A15.0','Tuberculosis pulmonar','A15','I Infecciosas'),
  ('B24.X','Enfermedad por VIH sin otra especificación','B24','I Infecciosas'),
  ('B18.1','Hepatitis viral crónica tipo B','B18','I Infecciosas'),
  ('B18.2','Hepatitis viral crónica tipo C','B18','I Infecciosas'),
  ('B34.9','Infección viral no especificada','B34','I Infecciosas'),
  ('B54.X','Paludismo (malaria) no especificado','B54','I Infecciosas'),
  ('A90.X','Dengue clásico','A90','I Infecciosas'),
  ('U07.1','COVID-19, virus identificado','U07','XXII Códigos especiales'),
  ('C50.9','Tumor maligno de la mama, no especificado','C50','II Neoplasias'),
  ('C61.X','Tumor maligno de la próstata','C61','II Neoplasias'),
  ('C18.9','Tumor maligno del colon, no especificado','C18','II Neoplasias'),
  ('C53.9','Tumor maligno del cuello del útero, no especificado','C53','II Neoplasias'),
  ('D50.9','Anemia por deficiencia de hierro sin otra especificación','D50','III Sangre'),
  ('D64.9','Anemia de tipo no especificado','D64','III Sangre'),
  ('D68.9','Defecto de la coagulación no especificado','D68','III Sangre'),
  ('E03.9','Hipotiroidismo no especificado','E03','IV Endocrinas'),
  ('E05.9','Tirotoxicosis (hipertiroidismo) no especificada','E05','IV Endocrinas'),
  ('E10.9','Diabetes mellitus tipo 1 sin complicaciones','E10','IV Endocrinas'),
  ('E11.9','Diabetes mellitus tipo 2 sin complicaciones','E11','IV Endocrinas'),
  ('E14.9','Diabetes mellitus no especificada sin complicaciones','E14','IV Endocrinas'),
  ('E66.9','Obesidad no especificada','E66','IV Endocrinas'),
  ('E78.0','Hipercolesterolemia pura','E78','IV Endocrinas'),
  ('E78.5','Hiperlipidemia no especificada','E78','IV Endocrinas'),
  ('E79.0','Hiperuricemia sin signos de artritis inflamatoria','E79','IV Endocrinas'),
  ('E86.X','Depleción del volumen (deshidratación)','E86','IV Endocrinas'),
  ('F32.9','Episodio depresivo no especificado','F32','V Mentales'),
  ('F41.9','Trastorno de ansiedad no especificado','F41','V Mentales'),
  ('F17.2','Dependencia del tabaco','F17','V Mentales'),
  ('F10.2','Dependencia del alcohol','F10','V Mentales'),
  ('G40.9','Epilepsia, tipo no especificado','G40','VI Nervioso'),
  ('G43.9','Migraña no especificada','G43','VI Nervioso'),
  ('H10.9','Conjuntivitis no especificada','H10','VII Ojo'),
  ('H66.9','Otitis media no especificada','H66','VIII Oído'),
  ('I10.X','Hipertensión esencial (primaria)','I10','IX Circulatorio'),
  ('I11.9','Enfermedad cardíaca hipertensiva sin insuficiencia cardíaca','I11','IX Circulatorio'),
  ('I20.9','Angina de pecho no especificada','I20','IX Circulatorio'),
  ('I21.9','Infarto agudo de miocardio sin otra especificación','I21','IX Circulatorio'),
  ('I25.9','Enfermedad isquémica crónica del corazón no especificada','I25','IX Circulatorio'),
  ('I48.X','Fibrilación y aleteo auricular','I48','IX Circulatorio'),
  ('I50.9','Insuficiencia cardíaca no especificada','I50','IX Circulatorio'),
  ('I63.9','Infarto cerebral no especificado','I63','IX Circulatorio'),
  ('I84.9','Hemorroides sin otra especificación','I84','IX Circulatorio'),
  ('J00.X','Rinofaringitis aguda (resfriado común)','J00','X Respiratorio'),
  ('J02.9','Faringitis aguda no especificada','J02','X Respiratorio'),
  ('J03.9','Amigdalitis aguda no especificada','J03','X Respiratorio'),
  ('J06.9','Infección aguda de las vías respiratorias superiores','J06','X Respiratorio'),
  ('J18.9','Neumonía no especificada','J18','X Respiratorio'),
  ('J20.9','Bronquitis aguda no especificada','J20','X Respiratorio'),
  ('J45.9','Asma no especificada','J45','X Respiratorio'),
  ('J44.9','Enfermedad pulmonar obstructiva crónica no especificada','J44','X Respiratorio'),
  ('K21.9','Enfermedad por reflujo gastroesofágico sin esofagitis','K21','XI Digestivo'),
  ('K25.9','Úlcera gástrica no especificada','K25','XI Digestivo'),
  ('K29.7','Gastritis no especificada','K29','XI Digestivo'),
  ('K30.X','Dispepsia','K30','XI Digestivo'),
  ('K35.8','Apendicitis aguda no especificada','K35','XI Digestivo'),
  ('K52.9','Colitis y gastroenteritis no infecciosa no especificada','K52','XI Digestivo'),
  ('K59.0','Estreñimiento','K59','XI Digestivo'),
  ('K76.0','Hígado graso no clasificado en otra parte','K76','XI Digestivo'),
  ('K80.2','Cálculo de la vesícula biliar sin colecistitis','K80','XI Digestivo'),
  ('L23.9','Dermatitis alérgica de contacto de causa no especificada','L23','XII Piel'),
  ('L29.9','Prurito no especificado','L29','XII Piel'),
  ('L50.9','Urticaria no especificada','L50','XII Piel'),
  ('M05.9','Artritis reumatoide seropositiva no especificada','M05','XIII Osteomuscular'),
  ('M10.9','Gota no especificada','M10','XIII Osteomuscular'),
  ('M17.9','Gonartrosis (artrosis de rodilla) no especificada','M17','XIII Osteomuscular'),
  ('M54.5','Lumbago no especificado','M54','XIII Osteomuscular'),
  ('M81.9','Osteoporosis no especificada','M81','XIII Osteomuscular'),
  ('N18.9','Enfermedad renal crónica no especificada','N18','XIV Genitourinario'),
  ('N20.0','Cálculo del riñón','N20','XIV Genitourinario'),
  ('N39.0','Infección de vías urinarias, sitio no especificado','N39','XIV Genitourinario'),
  ('N40.X','Hiperplasia de la próstata','N40','XIV Genitourinario'),
  ('N83.2','Quiste de ovario no especificado','N83','XIV Genitourinario'),
  ('N92.0','Menstruación excesiva y frecuente con ciclo regular','N92','XIV Genitourinario'),
  ('N95.1','Estados menopáusicos y climatéricos femeninos','N95','XIV Genitourinario'),
  ('O26.9','Complicación relacionada con el embarazo no especificada','O26','XV Embarazo'),
  ('Z34.9','Supervisión de embarazo normal no especificado','Z34','XXI Factores'),
  ('Z01.4','Examen ginecológico general','Z01','XXI Factores'),
  ('Z00.0','Examen médico general','Z00','XXI Factores'),
  ('Z13.9','Examen de pesquisa (screening) no especificado','Z13','XXI Factores'),
  ('Z71.3','Consulta para instrucción y vigilancia dietética','Z71','XXI Factores'),
  ('R50.9','Fiebre no especificada','R50','XVIII Síntomas'),
  ('R51.X','Cefalea','R51','XVIII Síntomas'),
  ('R10.4','Dolor abdominal no especificado','R10','XVIII Síntomas'),
  ('R05.X','Tos','R05','XVIII Síntomas'),
  ('R07.4','Dolor torácico no especificado','R07','XVIII Síntomas'),
  ('R42.X','Mareo y desvanecimiento','R42','XVIII Síntomas'),
  ('R53.X','Malestar y fatiga','R53','XVIII Síntomas'),
  ('R73.9','Hiperglucemia no especificada','R73','XVIII Síntomas'),
  ('T78.2','Choque anafiláctico no especificado','T78','XIX Traumatismos'),
  ('T78.4','Alergia no especificada','T78','XIX Traumatismos'),
  ('Z88.0','Historia personal de alergia a la penicilina','Z88','XXI Factores'),
  ('Z88.9','Historia personal de alergia a drogas/medicamentos no especificados','Z88','XXI Factores')
on conflict (codigo) do nothing;
