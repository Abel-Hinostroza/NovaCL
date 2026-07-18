-- ============================================================================
-- SEED (solo catalogo global) · Sin datos demo (usuarios/organizaciones)
--   Ejecutar DESPUES de apply_all_schema.sql en el SQL Editor de Supabase.
--   Crea el catalogo clinico compartido (organization_id = null) que veran
--   todas las organizaciones. Tu creas tu organizacion con el onboarding.
-- ============================================================================

-- ── Tipos de muestra ─────────────────────────────────────────
insert into public."LIS_specimen_types" (codigo, nombre, descripcion) values
  ('SANGRE',  'Sangre total',   'Tubo con anticoagulante (EDTA)'),
  ('SUERO',   'Suero',          'Tubo sin anticoagulante / gel separador'),
  ('PLASMA',  'Plasma',         'Tubo con anticoagulante'),
  ('ORINA',   'Orina',          'Muestra de orina'),
  ('HECES',   'Heces',          'Muestra de materia fecal'),
  ('HISOPADO','Hisopado',       'Hisopado nasofaringeo / faringeo')
on conflict (codigo) do nothing;

-- ── Categorias globales ──────────────────────────────────────
insert into public."LIS_test_categories" (organization_id, codigo, nombre, orden) values
  (null, 'HEM', 'Hematologia', 1),
  (null, 'BIO', 'Bioquimica', 2),
  (null, 'HOR', 'Hormonas', 3),
  (null, 'INM', 'Inmunologia', 4),
  (null, 'URO', 'Uroanalisis', 5),
  (null, 'MIC', 'Microbiologia', 6)
on conflict (organization_id, codigo) do nothing;

-- ── Analitos globales ────────────────────────────────────────
insert into public."LIS_analytes" (organization_id, category_id, codigo, nombre, abreviatura, unidad, value_type, decimales, metodo, orden)
values
  (null, (select id from public."LIS_test_categories" where codigo='HEM' and organization_id is null), 'HB',   'Hemoglobina',      'Hb',   'g/dL',   'numerico', 1, 'Espectrofotometria', 1),
  (null, (select id from public."LIS_test_categories" where codigo='HEM' and organization_id is null), 'HTO',  'Hematocrito',      'Hto',  '%',      'numerico', 1, 'Impedancia', 2),
  (null, (select id from public."LIS_test_categories" where codigo='HEM' and organization_id is null), 'GB',   'Leucocitos',       'GB',   '10^3/uL','numerico', 2, 'Impedancia', 3),
  (null, (select id from public."LIS_test_categories" where codigo='HEM' and organization_id is null), 'PLT',  'Plaquetas',        'Plt',  '10^3/uL','numerico', 0, 'Impedancia', 4),
  (null, (select id from public."LIS_test_categories" where codigo='HEM' and organization_id is null), 'GR',   'Eritrocitos',      'GR',   '10^6/uL','numerico', 2, 'Impedancia', 5),
  (null, (select id from public."LIS_test_categories" where codigo='BIO' and organization_id is null), 'GLU',  'Glucosa',          'Glu',  'mg/dL',  'numerico', 0, 'Hexoquinasa', 1),
  (null, (select id from public."LIS_test_categories" where codigo='BIO' and organization_id is null), 'CT',   'Colesterol total', 'CT',   'mg/dL',  'numerico', 0, 'Enzimatico', 2),
  (null, (select id from public."LIS_test_categories" where codigo='BIO' and organization_id is null), 'HDL',  'Colesterol HDL',   'HDL',  'mg/dL',  'numerico', 0, 'Enzimatico', 3),
  (null, (select id from public."LIS_test_categories" where codigo='BIO' and organization_id is null), 'LDL',  'Colesterol LDL',   'LDL',  'mg/dL',  'numerico', 0, 'Calculado', 4),
  (null, (select id from public."LIS_test_categories" where codigo='BIO' and organization_id is null), 'TG',   'Trigliceridos',    'TG',   'mg/dL',  'numerico', 0, 'Enzimatico', 5),
  (null, (select id from public."LIS_test_categories" where codigo='BIO' and organization_id is null), 'CREA', 'Creatinina',       'Crea', 'mg/dL',  'numerico', 2, 'Jaffe', 6),
  (null, (select id from public."LIS_test_categories" where codigo='BIO' and organization_id is null), 'UREA', 'Urea',             'Urea', 'mg/dL',  'numerico', 0, 'Enzimatico', 7),
  (null, (select id from public."LIS_test_categories" where codigo='BIO' and organization_id is null), 'TGO',  'TGO (AST)',        'AST',  'U/L',    'numerico', 0, 'Cinetico UV', 8),
  (null, (select id from public."LIS_test_categories" where codigo='BIO' and organization_id is null), 'TGP',  'TGP (ALT)',        'ALT',  'U/L',    'numerico', 0, 'Cinetico UV', 9),
  (null, (select id from public."LIS_test_categories" where codigo='HOR' and organization_id is null), 'TSH',  'TSH',              'TSH',  'uUI/mL', 'numerico', 2, 'Quimioluminiscencia', 1),
  (null, (select id from public."LIS_test_categories" where codigo='HOR' and organization_id is null), 'T4L',  'T4 Libre',         'T4L',  'ng/dL',  'numerico', 2, 'Quimioluminiscencia', 2),
  (null, (select id from public."LIS_test_categories" where codigo='INM' and organization_id is null), 'PCR',  'Proteina C Reactiva','PCR','mg/L',  'numerico', 1, 'Turbidimetria', 1),
  (null, (select id from public."LIS_test_categories" where codigo='URO' and organization_id is null), 'U_ASP','Aspecto',          null,   null,     'texto',    0, 'Macroscopico', 1),
  (null, (select id from public."LIS_test_categories" where codigo='URO' and organization_id is null), 'U_LEU','Leucocitos (sedimento)', null, '/campo', 'texto', 0, 'Microscopia', 2),
  (null, (select id from public."LIS_test_categories" where codigo='MIC' and organization_id is null), 'UROC', 'Urocultivo',       null,   null,     'texto',    0, 'Cultivo', 1)
on conflict (organization_id, codigo) do nothing;

-- ── Rangos de referencia ─────────────────────────────────────
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

-- ── Estudios globales ────────────────────────────────────────
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

-- ── Composicion de estudios ──────────────────────────────────
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
  select s_hemog, id, orden from public."LIS_analytes" where organization_id is null and codigo in ('HB','HTO','GB','PLT','GR') on conflict do nothing;
  insert into public."LIS_study_analytes" (study_id, analyte_id, orden)
  select s_gluco, id, 1 from public."LIS_analytes" where organization_id is null and codigo='GLU' on conflict do nothing;
  insert into public."LIS_study_analytes" (study_id, analyte_id, orden)
  select s_plip, id, orden from public."LIS_analytes" where organization_id is null and codigo in ('CT','HDL','LDL','TG') on conflict do nothing;
  insert into public."LIS_study_analytes" (study_id, analyte_id, orden)
  select s_phep, id, orden from public."LIS_analytes" where organization_id is null and codigo in ('TGO','TGP') on conflict do nothing;
  insert into public."LIS_study_analytes" (study_id, analyte_id, orden)
  select s_pren, id, orden from public."LIS_analytes" where organization_id is null and codigo in ('CREA','UREA') on conflict do nothing;
  insert into public."LIS_study_analytes" (study_id, analyte_id, orden)
  select s_tiro, id, orden from public."LIS_analytes" where organization_id is null and codigo in ('TSH','T4L') on conflict do nothing;
  insert into public."LIS_study_analytes" (study_id, analyte_id, orden)
  select s_eco, id, orden from public."LIS_analytes" where organization_id is null and codigo in ('U_ASP','U_LEU') on conflict do nothing;
  insert into public."LIS_study_analytes" (study_id, analyte_id, orden)
  select s_uroc, id, 1 from public."LIS_analytes" where organization_id is null and codigo='UROC' on conflict do nothing;
end $$;

-- ── Precios base (sede_id null = precio base, en PEN) ─────────
insert into public."LIS_study_prices" (study_id, sede_id, moneda, precio)
select s.id, null, 'PEN',
  case s.codigo
    when 'HEMOG' then 25 when 'GLUCO' then 12 when 'PLIP' then 45
    when 'PHEP' then 40 when 'PREN' then 35 when 'TIRO' then 80
    when 'ECOOR' then 15 when 'UROCU' then 55 else 20 end
from public."LIS_studies" s where s.organization_id is null
on conflict do nothing;
