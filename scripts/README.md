# Scripts

## Catálogo CIE-10 completo (`load-cie10.mjs`)

Carga masiva del catálogo CIE-10 en la tabla `public."LIS_cie10"` (definida en la
migración `0029_clinical_history.sql`). La migración ya siembra ~90 códigos
frecuentes con glosas curadas; este loader completa el resto (~12,600 códigos
asignables: categorías de 3 caracteres y subcategorías).

### Requisitos

1. La migración `0029` debe estar aplicada (tabla `LIS_cie10` existente).
2. Variables en `.env.local` (o en el entorno):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

### Uso

```bash
pnpm db:cie10                      # usa scripts/data/cie10.csv
node scripts/load-cie10.mjs otro.csv
```

El loader usa `upsert(..., { ignoreDuplicates: true })` sobre la PK `codigo`, así
que **no sobrescribe** los códigos ya sembrados por la migración: conserva las
glosas curadas y solo agrega los que faltan. Es idempotente (puedes re-ejecutarlo).

### Datos (`data/cie10.csv`)

Columnas: `codigo,descripcion,categoria,capitulo`. Los códigos están normalizados
al formato con punto de la CIE-10 (`L59.9`, no `L599`).

**Procedencia:** derivado del dataset público [verasativa/CIE-10](https://github.com/verasativa/CIE-10)
(construido a partir de icdcode.info y deis.cl). Se filtraron los rangos de
capítulo/bloque y se conservaron solo los códigos asignables. Para la lista
oficial peruana, reemplaza este CSV por el catálogo CIE-10 vigente del MINSA
(mismas columnas) y vuelve a ejecutar el loader.
