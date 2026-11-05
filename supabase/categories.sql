-- Run once in the Supabase SQL editor. Keeps the current validation and adds the new expense categories.
begin;
do $$
declare src text;
begin
  select pg_get_functiondef('public.nexo_assert_document(jsonb)'::regprocedure) into src;
  if position('Gasolina' in src)>0 then
    return;
  end if;
  if position('Comida'',''Alojamiento'',''Transporte'',''Actividades'',''Otros' in src)=0 then
    raise exception 'No se encontró la lista de categorías';
  end if;
  execute replace(src,
    'Comida'',''Alojamiento'',''Transporte'',''Actividades'',''Otros''',
    'Comida'',''Transporte'',''Gasolina'',''Alojamiento'',''Viaje'',''Actividades'',''Compras'',''Salud'',''Facturas'',''Ocio'',''Otros''');
end $$;
commit;
