-- ============================================================================
-- 0030 · Corrección: search_cie10 debe vivir en `public`
--
--   La 0029 creó la función en el schema `app`, que PostgREST NO expone, así
--   que `supabase.rpc("search_cie10")` (buscador CIE-10 de la historia clínica)
--   fallaba con "Could not find the function public.search_cie10". Se recrea en
--   `public` y se elimina la versión de `app`.
-- ============================================================================

drop function if exists app.search_cie10(text, int);

create or replace function public.search_cie10(p_q text, p_limit int default 20)
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
    (codigo ilike btrim(p_q) || '%') desc,
    codigo
  limit greatest(1, least(p_limit, 50));
$$;

grant execute on function public.search_cie10(text, int) to authenticated;

-- Refresca el cache de esquema de PostgREST para que la función quede disponible.
notify pgrst, 'reload schema';
