-- ============================================================================
-- SEED · Inventario básico de referencia para el módulo Inventario
-- ----------------------------------------------------------------------------
-- Carga un catálogo típico de laboratorio (reactivos, tubos, insumos, EPP y
-- consumibles) con existencias por sede, lotes y vencimientos, para que el
-- módulo Inventario tenga datos realistas de referencia.
--
-- Se apunta a la organización demo de `seed.sql` (slug 'clinica-demo', sedes
-- S001/S002). Es idempotente: reejecutarlo no duplica.
--
-- Ejecutar tras `supabase db reset` (que corre seed.sql):
--   psql "$DATABASE_URL" -f supabase/seed_inventory.sql
--   -- o en local:  supabase db execute --file supabase/seed_inventory.sql
--
-- Los vencimientos usan `current_date + N` para que las alertas de "por vencer"
-- (vista v_inventory_expiring, ventana de 60 días) queden vivas sin importar
-- cuándo se corra el seed.
-- ============================================================================

do $$
declare
  v_org   uuid;
  v_sede1 uuid;  -- Sede Central (procesadora)
  v_sede2 uuid;  -- Sede Norte
begin
  select id into v_org from public."LIS_organizations" where slug = 'clinica-demo';
  if v_org is null then
    raise notice 'seed_inventory: organización demo (clinica-demo) no encontrada; se omite.';
    return;
  end if;
  select id into v_sede1 from public."LIS_sedes" where organization_id = v_org and codigo = 'S001';
  select id into v_sede2 from public."LIS_sedes" where organization_id = v_org and codigo = 'S002';

  -- ──────────────────────────────────────────────────────────
  -- Artículos (catálogo de inventario)
  -- ──────────────────────────────────────────────────────────
  insert into public."LIS_inventory_items"
    (organization_id, codigo, nombre, categoria, tipo, unidad,
     stock_minimo, stock_maximo, requiere_refrigeracion, ubicacion, proveedor, costo_referencia)
  values
    -- Reactivos (cadena de frío)
    (v_org, 'RG-HB',   'Reactivo Hemoglobina (Drabkin)',        'Reactivos', 'reactivo',   'mL',     500, 5000, true,  'Refrigerador A', 'Wiener Lab',  0.15),
    (v_org, 'RG-GLU',  'Reactivo Glucosa (Hexoquinasa)',        'Reactivos', 'reactivo',   'mL',     500, 5000, true,  'Refrigerador A', 'Roche',       0.20),
    (v_org, 'RG-CREA', 'Reactivo Creatinina (Jaffe)',           'Reactivos', 'reactivo',   'mL',     300, 3000, true,  'Refrigerador A', 'Wiener Lab',  0.22),
    (v_org, 'RG-CT',   'Reactivo Colesterol (CHOD-PAP)',        'Reactivos', 'reactivo',   'mL',     300, 3000, true,  'Refrigerador A', 'Wiener Lab',  0.18),
    (v_org, 'TIRA-U',  'Tira reactiva de orina 10 parámetros',  'Reactivos', 'reactivo',   'unidad', 100, 2000, false, 'Estante B',      'Cypress',     0.30),
    -- Tubos e insumos de toma
    (v_org, 'TUBO-EDTA','Tubo EDTA K2 tapa lila 4 mL',          'Tubos',     'insumo',     'unidad', 200, 4000, false, 'Estante C',      'BD',          0.35),
    (v_org, 'TUBO-SUE', 'Tubo suero con gel tapa amarilla 5 mL','Tubos',     'insumo',     'unidad', 200, 4000, false, 'Estante C',      'BD',          0.40),
    (v_org, 'TUBO-CIT', 'Tubo citrato tapa celeste 3 mL',       'Tubos',     'insumo',     'unidad', 100, 2000, false, 'Estante C',      'BD',          0.42),
    (v_org, 'AGUJA-VAC','Aguja vacutainer 21G',                 'Insumos',   'insumo',     'unidad', 200, 4000, false, 'Estante C',      'BD',          0.12),
    (v_org, 'JER-5',    'Jeringa descartable 5 mL',             'Insumos',   'insumo',     'unidad', 150, 3000, false, 'Estante C',      'Nipro',       0.20),
    (v_org, 'ALG-TOR',  'Torundas de algodón',                  'Insumos',   'insumo',     'unidad', 500, 8000, false, 'Estante D',      'Genérico',    0.02),
    (v_org, 'GASA',     'Gasa estéril 10x10 cm',                'Insumos',   'insumo',     'paquete', 50,  500, false, 'Estante D',      'Genérico',    0.50),
    -- EPP
    (v_org, 'GUA-NIT-M','Guantes de nitrilo talla M',           'EPP',       'epp',        'caja',    10,  200, false, 'Estante E',      'MedGlove',   12.00),
    (v_org, 'MASC-QX',  'Mascarilla quirúrgica 3 pliegues',     'EPP',       'epp',        'caja',    10,  200, false, 'Estante E',      '3M',         18.00),
    (v_org, 'MAND-DESC','Mandil descartable',                   'EPP',       'epp',        'unidad',  30,  600, false, 'Estante E',      'Genérico',    1.20),
    -- Consumibles / limpieza
    (v_org, 'ALC-70',   'Alcohol etílico 70% x 1 L',            'Consumibles','consumible', 'litro',    5,  100, false, 'Almacén General','Genérico',    8.00),
    (v_org, 'HIPO-5',   'Hipoclorito de sodio 5% x 1 L',        'Consumibles','consumible', 'litro',    5,  100, false, 'Almacén General','Genérico',    6.00),
    (v_org, 'PAP-TOA',  'Papel toalla',                         'Consumibles','consumible', 'rollo',   20,  400, false, 'Almacén General','Genérico',    3.00)
  on conflict (organization_id, codigo) do nothing;

  -- ──────────────────────────────────────────────────────────
  -- Existencias en Sede Central (v_sede1)
  --   Estados representativos: ok / bajo / por vencer / vencido.
  --   TUBO-CIT se deja sin stock a propósito → estado "agotado".
  -- ──────────────────────────────────────────────────────────
  insert into public."LIS_inventory_stock"
    (organization_id, item_id, sede_id, lote, vencimiento, cantidad)
  select v_org, i.id, v_sede1, x.lote, x.venc, x.cant
  from (values
    ('RG-HB',    'L-HB-2401',  (current_date + 40)::date, 1200::numeric),  -- por vencer (≤60 d)
    ('RG-GLU',   'L-GLU-2405', (current_date + 210)::date, 2400),
    ('RG-CREA',  'L-CR-2312',  (current_date + 120)::date, 250),           -- bajo (< mínimo 300)
    ('RG-CT',    'L-CT-2310',  (current_date - 10)::date,  180),           -- VENCIDO
    ('RG-CT',    'L-CT-2406',  (current_date + 300)::date, 1500),
    ('TIRA-U',   'L-TU-2404',  (current_date + 25)::date,  600),           -- por vencer
    ('TUBO-EDTA','L-ED-A',     null,                       1800),
    ('TUBO-SUE', 'L-SU-A',     null,                       1600),
    ('AGUJA-VAC',null,          null,                       2200),
    ('JER-5',    null,          null,                       900),
    ('ALG-TOR',  null,          null,                       5000),
    ('GASA',     'L-GA-01',    (current_date + 500)::date, 220),
    ('GUA-NIT-M','L-GN-M-07',  (current_date + 400)::date, 45),
    ('MASC-QX',  'L-MQ-03',    (current_date + 400)::date, 30),
    ('MAND-DESC',null,          null,                       120),
    ('ALC-70',   null,          null,                       28),
    ('HIPO-5',   null,          null,                       3),             -- bajo (< mínimo 5)
    ('PAP-TOA',  null,          null,                       60)
  ) as x(codigo, lote, venc, cant)
  join public."LIS_inventory_items" i
    on i.organization_id = v_org and i.codigo = x.codigo
  on conflict (item_id, sede_id, lote, vencimiento) do nothing;

  -- ──────────────────────────────────────────────────────────
  -- Existencias en Sede Norte (v_sede2): subconjunto de consumo frecuente.
  -- ──────────────────────────────────────────────────────────
  if v_sede2 is not null then
    insert into public."LIS_inventory_stock"
      (organization_id, item_id, sede_id, lote, vencimiento, cantidad)
    select v_org, i.id, v_sede2, x.lote, x.venc, x.cant
    from (values
      ('TUBO-EDTA','L-ED-B',    null,                       600::numeric),
      ('TUBO-SUE', 'L-SU-B',    null,                       500),
      ('AGUJA-VAC',null,         null,                       800),
      ('GUA-NIT-M','L-GN-M-07', (current_date + 400)::date, 8),             -- bajo (= mínimo 10 → bajo)
      ('ALC-70',   null,         null,                       12),
      ('RG-GLU',   'L-GLU-2405',(current_date + 210)::date, 400)
    ) as x(codigo, lote, venc, cant)
    join public."LIS_inventory_items" i
      on i.organization_id = v_org and i.codigo = x.codigo
    on conflict (item_id, sede_id, lote, vencimiento) do nothing;
  end if;

  -- ──────────────────────────────────────────────────────────
  -- Bitácora inicial: unos movimientos de "entrada" para que el historial
  -- no arranque vacío (carga inicial; delta = cantidad = stock resultante).
  -- ──────────────────────────────────────────────────────────
  insert into public."LIS_inventory_movements"
    (organization_id, item_id, sede_id, tipo, cantidad, delta, stock_resultante,
     lote, vencimiento, motivo, referencia)
  select v_org, i.id, v_sede1, 'entrada'::app.inventory_movement_type,
         x.cant, x.cant, x.cant, x.lote, x.venc, 'Carga inicial de inventario', 'SEED'
  from (values
    ('RG-GLU', 'L-GLU-2405', (current_date + 210)::date, 2400::numeric),
    ('TUBO-EDTA','L-ED-A',   null,                        1800),
    ('GUA-NIT-M','L-GN-M-07',(current_date + 400)::date,  45)
  ) as x(codigo, lote, venc, cant)
  join public."LIS_inventory_items" i
    on i.organization_id = v_org and i.codigo = x.codigo
  where not exists (
    select 1 from public."LIS_inventory_movements" m
    where m.item_id = i.id and m.referencia = 'SEED'
  );

  raise notice 'seed_inventory: inventario básico cargado para clinica-demo.';
end $$;
