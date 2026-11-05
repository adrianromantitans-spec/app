-- Run in the Supabase SQL editor to enable all expense categories, including Supermercado.
-- Safe to repeat on both the original and expanded category lists.
begin;
do $$
declare src text;
        previous_list text;
        categories text := '''Comida'',''Supermercado'',''Transporte'',''Gasolina'',''Alojamiento'',''Viaje'',''Actividades'',''Compras'',''Salud'',''Facturas'',''Ocio'',''Otros''';
begin
  select pg_get_functiondef('public.nexo_assert_document(jsonb)'::regprocedure) into src;
  if position(categories in src)>0 then
    return;
  end if;
  foreach previous_list in array array[
    '''Comida'',''Transporte'',''Gasolina'',''Alojamiento'',''Viaje'',''Actividades'',''Compras'',''Salud'',''Facturas'',''Ocio'',''Otros''',
    '''Comida'',''Alojamiento'',''Transporte'',''Actividades'',''Otros'''
  ] loop
    if position(previous_list in src)>0 then
      execute replace(src, previous_list, categories);
      return;
    end if;
  end loop;
  raise exception 'No se encontró la lista de categorías';
end $$;
commit;
