-- ─────────────────────────────────────────────────────────────
-- 0026 · Color identificador por categoría del catálogo
-- ─────────────────────────────────────────────────────────────
-- Añade un color opcional a las categorías para facilitar la lectura y
-- diferenciación en el catálogo. El color es una señal secundaria (siempre
-- acompaña al código/nombre en la UI).
--
-- Es nullable a propósito: si una categoría no tiene color, la app deriva uno
-- estable de su código (ver src/lib/catalog/category-colors.ts). Así las
-- plantillas GLOBALES —que las organizaciones no pueden editar— muestran color
-- de inmediato sin tocar datos compartidos, y cada organización puede elegir el
-- color de SUS propias categorías.
--
-- La validación de que el valor pertenezca a la paleta se hace en la capa de
-- aplicación (saveCategoryAction) para no acoplar la paleta al esquema.
-- ─────────────────────────────────────────────────────────────

alter table public."LIS_test_categories"
  add column if not exists color text;
