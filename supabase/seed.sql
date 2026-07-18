-- ============================================================================
-- SEED · Datos de arranque: catalogo clinico global + organizacion demo
--   Usuario demo:  hinostrozajavier5b@gmail.com  /  AdminNova
-- ============================================================================

-- ─────────────────────────────────────────────────────────────
-- Tipos de muestra (globales)
-- ─────────────────────────────────────────────────────────────
insert into public."LIS_specimen_types" (codigo, nombre, descripcion) values
  ('SANGRE',  'Sangre total',   'Tubo con anticoagulante (EDTA)'),
  ('SUERO',   'Suero',          'Tubo sin anticoagulante / gel separador'),
  ('PLASMA',  'Plasma',         'Tubo con anticoagulante'),
  ('ORINA',   'Orina',          'Muestra de orina'),
  ('HECES',   'Heces',          'Muestra de materia fecal'),
  ('HISOPADO','Hisopado',       'Hisopado nasofaringeo / faringeo')
on conflict (codigo) do nothing;

-- ─────────────────────────────────────────────────────────────
-- Categorias globales (organization_id = null => plantilla compartida)
-- ─────────────────────────────────────────────────────────────
insert into public."LIS_test_categories" (organization_id, codigo, nombre, orden) values
  (null, 'HEM', 'Hematologia', 1),
  (null, 'BIO', 'Bioquimica', 2),
  (null, 'HOR', 'Hormonas', 3),
  (null, 'INM', 'Inmunologia', 4),
  (null, 'URO', 'Uroanalisis', 5),
  (null, 'MIC', 'Microbiologia', 6)
on conflict (organization_id, codigo) do nothing;

-- Helper local: id de categoria global por codigo
-- (se usa via subconsulta en los inserts siguientes)

-- ─────────────────────────────────────────────────────────────
-- Analitos globales
-- ─────────────────────────────────────────────────────────────
insert into public."LIS_analytes" (organization_id, category_id, codigo, nombre, abreviatura, unidad, value_type, decimales, metodo, orden)
values
  -- Hematologia
  (null, (select id from public."LIS_test_categories" where codigo='HEM' and organization_id is null), 'HB',   'Hemoglobina',      'Hb',   'g/dL',   'numerico', 1, 'Espectrofotometria', 1),
  (null, (select id from public."LIS_test_categories" where codigo='HEM' and organization_id is null), 'HTO',  'Hematocrito',      'Hto',  '%',      'numerico', 1, 'Impedancia', 2),
  (null, (select id from public."LIS_test_categories" where codigo='HEM' and organization_id is null), 'GB',   'Leucocitos',       'GB',   '10^3/uL','numerico', 2, 'Impedancia', 3),
  (null, (select id from public."LIS_test_categories" where codigo='HEM' and organization_id is null), 'PLT',  'Plaquetas',        'Plt',  '10^3/uL','numerico', 0, 'Impedancia', 4),
  (null, (select id from public."LIS_test_categories" where codigo='HEM' and organization_id is null), 'GR',   'Eritrocitos',      'GR',   '10^6/uL','numerico', 2, 'Impedancia', 5),
  -- Bioquimica
  (null, (select id from public."LIS_test_categories" where codigo='BIO' and organization_id is null), 'GLU',  'Glucosa',          'Glu',  'mg/dL',  'numerico', 0, 'Hexoquinasa', 1),
  (null, (select id from public."LIS_test_categories" where codigo='BIO' and organization_id is null), 'CT',   'Colesterol total', 'CT',   'mg/dL',  'numerico', 0, 'Enzimatico', 2),
  (null, (select id from public."LIS_test_categories" where codigo='BIO' and organization_id is null), 'HDL',  'Colesterol HDL',   'HDL',  'mg/dL',  'numerico', 0, 'Enzimatico', 3),
  (null, (select id from public."LIS_test_categories" where codigo='BIO' and organization_id is null), 'LDL',  'Colesterol LDL',   'LDL',  'mg/dL',  'numerico', 0, 'Calculado', 4),
  (null, (select id from public."LIS_test_categories" where codigo='BIO' and organization_id is null), 'TG',   'Trigliceridos',    'TG',   'mg/dL',  'numerico', 0, 'Enzimatico', 5),
  (null, (select id from public."LIS_test_categories" where codigo='BIO' and organization_id is null), 'CREA', 'Creatinina',       'Crea', 'mg/dL',  'numerico', 2, 'Jaffe', 6),
  (null, (select id from public."LIS_test_categories" where codigo='BIO' and organization_id is null), 'UREA', 'Urea',             'Urea', 'mg/dL',  'numerico', 0, 'Enzimatico', 7),
  (null, (select id from public."LIS_test_categories" where codigo='BIO' and organization_id is null), 'TGO',  'TGO (AST)',        'AST',  'U/L',    'numerico', 0, 'Cinetico UV', 8),
  (null, (select id from public."LIS_test_categories" where codigo='BIO' and organization_id is null), 'TGP',  'TGP (ALT)',        'ALT',  'U/L',    'numerico', 0, 'Cinetico UV', 9),
  -- Hormonas
  (null, (select id from public."LIS_test_categories" where codigo='HOR' and organization_id is null), 'TSH',  'TSH',              'TSH',  'uUI/mL', 'numerico', 2, 'Quimioluminiscencia', 1),
  (null, (select id from public."LIS_test_categories" where codigo='HOR' and organization_id is null), 'T4L',  'T4 Libre',         'T4L',  'ng/dL',  'numerico', 2, 'Quimioluminiscencia', 2),
  -- Inmunologia
  (null, (select id from public."LIS_test_categories" where codigo='INM' and organization_id is null), 'PCR',  'Proteina C Reactiva','PCR','mg/L',  'numerico', 1, 'Turbidimetria', 1),
  -- Uroanalisis (cualitativos)
  (null, (select id from public."LIS_test_categories" where codigo='URO' and organization_id is null), 'U_ASP','Aspecto',          null,   null,     'texto',    0, 'Macroscopico', 1),
  (null, (select id from public."LIS_test_categories" where codigo='URO' and organization_id is null), 'U_LEU','Leucocitos (sedimento)', null, '/campo', 'texto', 0, 'Microscopia', 2),
  -- Microbiologia
  (null, (select id from public."LIS_test_categories" where codigo='MIC' and organization_id is null), 'UROC', 'Urocultivo',       null,   null,     'texto',    0, 'Cultivo', 1)
on conflict (organization_id, codigo) do nothing;

-- ─────────────────────────────────────────────────────────────
-- Rangos de referencia (por sexo cuando aplica)
-- ─────────────────────────────────────────────────────────────
insert into public."LIS_reference_ranges" (analyte_id, sexo, valor_min, valor_max, critico_min, critico_max)
select id, 'M', 13.5, 17.5, 7.0, 20.0 from public."LIS_analytes" where codigo='HB' and organization_id is null;
insert into public."LIS_reference_ranges" (analyte_id, sexo, valor_min, valor_max, critico_min, critico_max)
select id, 'F', 12.0, 16.0, 7.0, 20.0 from public."LIS_analytes" where codigo='HB' and organization_id is null;
insert into public."LIS_reference_ranges" (analyte_id, sexo, valor_min, valor_max)
select id, 'M', 41, 53 from public."LIS_analytes" where codigo='HTO' and organization_id is null;
insert into public."LIS_reference_ranges" (analyte_id, sexo, valor_min, valor_max)
select id, 'F', 36, 46 from public."LIS_analytes" where codigo='HTO' and organization_id is null;
insert into public."LIS_reference_ranges" (analyte_id, sexo, valor_min, valor_max, critico_min, critico_max)
select id, 'desconocido', 4.0, 11.0, 1.0, 30.0 from public."LIS_analytes" where codigo='GB' and organization_id is null;
insert into public."LIS_reference_ranges" (analyte_id, sexo, valor_min, valor_max, critico_min, critico_max)
select id, 'desconocido', 150, 450, 20, 1000 from public."LIS_analytes" where codigo='PLT' and organization_id is null;
insert into public."LIS_reference_ranges" (analyte_id, sexo, valor_min, valor_max)
select id, 'M', 4.5, 5.9 from public."LIS_analytes" where codigo='GR' and organization_id is null;
insert into public."LIS_reference_ranges" (analyte_id, sexo, valor_min, valor_max)
select id, 'F', 4.1, 5.1 from public."LIS_analytes" where codigo='GR' and organization_id is null;
insert into public."LIS_reference_ranges" (analyte_id, sexo, valor_min, valor_max, critico_min, critico_max)
select id, 'desconocido', 70, 100, 40, 400 from public."LIS_analytes" where codigo='GLU' and organization_id is null;
insert into public."LIS_reference_ranges" (analyte_id, sexo, valor_max)
select id, 'desconocido', 200 from public."LIS_analytes" where codigo='CT' and organization_id is null;
insert into public."LIS_reference_ranges" (analyte_id, sexo, valor_min)
select id, 'desconocido', 40 from public."LIS_analytes" where codigo='HDL' and organization_id is null;
insert into public."LIS_reference_ranges" (analyte_id, sexo, valor_max)
select id, 'desconocido', 100 from public."LIS_analytes" where codigo='LDL' and organization_id is null;
insert into public."LIS_reference_ranges" (analyte_id, sexo, valor_max)
select id, 'desconocido', 150 from public."LIS_analytes" where codigo='TG' and organization_id is null;
insert into public."LIS_reference_ranges" (analyte_id, sexo, valor_min, valor_max)
select id, 'M', 0.7, 1.3 from public."LIS_analytes" where codigo='CREA' and organization_id is null;
insert into public."LIS_reference_ranges" (analyte_id, sexo, valor_min, valor_max)
select id, 'F', 0.6, 1.1 from public."LIS_analytes" where codigo='CREA' and organization_id is null;
insert into public."LIS_reference_ranges" (analyte_id, sexo, valor_min, valor_max)
select id, 'desconocido', 15, 45 from public."LIS_analytes" where codigo='UREA' and organization_id is null;
insert into public."LIS_reference_ranges" (analyte_id, sexo, valor_max)
select id, 'desconocido', 40 from public."LIS_analytes" where codigo='TGO' and organization_id is null;
insert into public."LIS_reference_ranges" (analyte_id, sexo, valor_max)
select id, 'desconocido', 41 from public."LIS_analytes" where codigo='TGP' and organization_id is null;
insert into public."LIS_reference_ranges" (analyte_id, sexo, valor_min, valor_max)
select id, 'desconocido', 0.4, 4.0 from public."LIS_analytes" where codigo='TSH' and organization_id is null;
insert into public."LIS_reference_ranges" (analyte_id, sexo, valor_min, valor_max)
select id, 'desconocido', 0.8, 1.8 from public."LIS_analytes" where codigo='T4L' and organization_id is null;
insert into public."LIS_reference_ranges" (analyte_id, sexo, valor_max)
select id, 'desconocido', 5.0 from public."LIS_analytes" where codigo='PCR' and organization_id is null;
insert into public."LIS_reference_ranges" (analyte_id, sexo, texto_normal)
select id, 'desconocido', 'Claro / Amarillo' from public."LIS_analytes" where codigo='U_ASP' and organization_id is null;
insert into public."LIS_reference_ranges" (analyte_id, sexo, texto_normal)
select id, 'desconocido', '0-5 /campo' from public."LIS_analytes" where codigo='U_LEU' and organization_id is null;
insert into public."LIS_reference_ranges" (analyte_id, sexo, texto_normal)
select id, 'desconocido', 'Negativo / < 10^3 UFC/mL' from public."LIS_analytes" where codigo='UROC' and organization_id is null;

-- ─────────────────────────────────────────────────────────────
-- Estudios globales + composicion
-- ─────────────────────────────────────────────────────────────
insert into public."LIS_studies" (organization_id, category_id, specimen_type_id, codigo, nombre, tiempo_entrega_h, requiere_ayuno, indicaciones)
values
  (null, (select id from public."LIS_test_categories" where codigo='HEM' and organization_id is null),
         (select id from public."LIS_specimen_types" where codigo='SANGRE'),
         'HEMOG', 'Hemograma completo', 4, false, null),
  (null, (select id from public."LIS_test_categories" where codigo='BIO' and organization_id is null),
         (select id from public."LIS_specimen_types" where codigo='SUERO'),
         'GLUCO', 'Glucosa en ayunas', 4, true, 'Ayuno de 8 horas'),
  (null, (select id from public."LIS_test_categories" where codigo='BIO' and organization_id is null),
         (select id from public."LIS_specimen_types" where codigo='SUERO'),
         'PLIP', 'Perfil lipidico', 6, true, 'Ayuno de 12 horas'),
  (null, (select id from public."LIS_test_categories" where codigo='BIO' and organization_id is null),
         (select id from public."LIS_specimen_types" where codigo='SUERO'),
         'PHEP', 'Perfil hepatico', 6, false, null),
  (null, (select id from public."LIS_test_categories" where codigo='BIO' and organization_id is null),
         (select id from public."LIS_specimen_types" where codigo='SUERO'),
         'PREN', 'Perfil renal', 6, false, null),
  (null, (select id from public."LIS_test_categories" where codigo='HOR' and organization_id is null),
         (select id from public."LIS_specimen_types" where codigo='SUERO'),
         'TIRO', 'Perfil tiroideo (TSH + T4L)', 24, false, null),
  (null, (select id from public."LIS_test_categories" where codigo='URO' and organization_id is null),
         (select id from public."LIS_specimen_types" where codigo='ORINA'),
         'ECOOR', 'Examen completo de orina', 4, false, 'Primera orina de la manana'),
  (null, (select id from public."LIS_test_categories" where codigo='MIC' and organization_id is null),
         (select id from public."LIS_specimen_types" where codigo='ORINA'),
         'UROCU', 'Urocultivo', 72, false, 'Muestra de chorro medio')
on conflict (organization_id, codigo) do nothing;

-- Composicion de estudios
do $$
declare
  s_hemog uuid := (select id from public."LIS_studies" where codigo='HEMOG' and organization_id is null);
  s_gluco uuid := (select id from public."LIS_studies" where codigo='GLUCO' and organization_id is null);
  s_plip  uuid := (select id from public."LIS_studies" where codigo='PLIP' and organization_id is null);
  s_phep  uuid := (select id from public."LIS_studies" where codigo='PHEP' and organization_id is null);
  s_pren  uuid := (select id from public."LIS_studies" where codigo='PREN' and organization_id is null);
  s_tiro  uuid := (select id from public."LIS_studies" where codigo='TIRO' and organization_id is null);
  s_eco   uuid := (select id from public."LIS_studies" where codigo='ECOOR' and organization_id is null);
  s_uroc  uuid := (select id from public."LIS_studies" where codigo='UROCU' and organization_id is null);
begin
  insert into public."LIS_study_analytes" (study_id, analyte_id, orden)
  select s_hemog, id, orden from public."LIS_analytes" where organization_id is null and codigo in ('HB','HTO','GB','PLT','GR')
  on conflict do nothing;
  insert into public."LIS_study_analytes" (study_id, analyte_id, orden)
  select s_gluco, id, 1 from public."LIS_analytes" where organization_id is null and codigo='GLU'
  on conflict do nothing;
  insert into public."LIS_study_analytes" (study_id, analyte_id, orden)
  select s_plip, id, orden from public."LIS_analytes" where organization_id is null and codigo in ('CT','HDL','LDL','TG')
  on conflict do nothing;
  insert into public."LIS_study_analytes" (study_id, analyte_id, orden)
  select s_phep, id, orden from public."LIS_analytes" where organization_id is null and codigo in ('TGO','TGP')
  on conflict do nothing;
  insert into public."LIS_study_analytes" (study_id, analyte_id, orden)
  select s_pren, id, orden from public."LIS_analytes" where organization_id is null and codigo in ('CREA','UREA')
  on conflict do nothing;
  insert into public."LIS_study_analytes" (study_id, analyte_id, orden)
  select s_tiro, id, orden from public."LIS_analytes" where organization_id is null and codigo in ('TSH','T4L')
  on conflict do nothing;
  insert into public."LIS_study_analytes" (study_id, analyte_id, orden)
  select s_eco, id, orden from public."LIS_analytes" where organization_id is null and codigo in ('U_ASP','U_LEU')
  on conflict do nothing;
  insert into public."LIS_study_analytes" (study_id, analyte_id, orden)
  select s_uroc, id, 1 from public."LIS_analytes" where organization_id is null and codigo='UROC'
  on conflict do nothing;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Organizacion demo + usuario admin + pacientes
-- ─────────────────────────────────────────────────────────────
do $$
declare
  v_uid   uuid := '00000000-0000-0000-0000-0000000000a2';
  v_org   uuid := '00000000-0000-0000-0000-0000000000b1';
  v_sede1 uuid := '00000000-0000-0000-0000-0000000000c1';
  v_sede2 uuid := '00000000-0000-0000-0000-0000000000c2';
begin
  -- usuario de autenticacion demo
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    v_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'hinostrozajavier5b@gmail.com', crypt('AdminNova', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"nombre":"Administrador Demo"}'::jsonb,
    '', '', '', ''
  ) on conflict (id) do nothing;

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, created_at, updated_at
  ) values (
    gen_random_uuid(), v_uid, v_uid::text,
    format('{"sub":"%s","email":"hinostrozajavier5b@gmail.com"}', v_uid)::jsonb,
    'email', now(), now()
  ) on conflict do nothing;

  insert into public."LIS_profiles" (id, email, nombre)
  values (v_uid, 'hinostrozajavier5b@gmail.com', 'Administrador Demo')
  on conflict (id) do nothing;

  -- organizacion y sedes
  insert into public."LIS_organizations" (id, slug, nombre, ruc)
  values (v_org, 'clinica-demo', 'Clinica Demo', '20123456789')
  on conflict (id) do nothing;

  insert into public."LIS_sedes" (id, organization_id, codigo, nombre, direccion, es_procesadora)
  values
    (v_sede1, v_org, 'S001', 'Sede Central', 'Av. Principal 123', true),
    (v_sede2, v_org, 'S002', 'Sede Norte', 'Av. Norte 456', false)
  on conflict (id) do nothing;

  -- admin de la organizacion
  insert into public."LIS_memberships" (organization_id, sede_id, user_id, role)
  values (v_org, null, v_uid, 'org_admin')
  on conflict do nothing;

  -- pacientes demo
  insert into public."LIS_patients" (organization_id, tipo_documento, numero_documento, nombres, apellidos, fecha_nacimiento, sexo, telefono, email)
  values
    (v_org, 'DNI', '45678901', 'Maria', 'Gomez Rios', '1990-05-14', 'F', '987654321', 'maria.gomez@example.com'),
    (v_org, 'DNI', '12345678', 'Carlos', 'Perez Luna', '1978-11-02', 'M', '912345678', 'carlos.perez@example.com'),
    (v_org, 'DNI', '87654321', 'Lucia', 'Torres Vega', '2015-03-20', 'F', '900112233', null)
  on conflict do nothing;

  -- precios base para los estudios globales en esta organizacion (sede null = base)
  insert into public."LIS_study_prices" (study_id, sede_id, moneda, precio)
  select s.id, null, 'PEN',
    case s.codigo
      when 'HEMOG' then 25 when 'GLUCO' then 12 when 'PLIP' then 45
      when 'PHEP' then 40 when 'PREN' then 35 when 'TIRO' then 80
      when 'ECOOR' then 15 when 'UROCU' then 55 else 20 end
  from public."LIS_studies" s where s.organization_id is null
  on conflict do nothing;
end $$;
