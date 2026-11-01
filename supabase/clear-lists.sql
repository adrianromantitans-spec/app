-- Run after collaboration.sql and notifications.sql. No existing data is deleted here.
begin;
create or replace function public.divzplit_clear_history(p_id uuid) returns bigint
language plpgsql security definer set search_path='' as $$
declare g public.nexo_groups; removed bigint;
begin
 select * into g from public.nexo_groups where id=p_id for update;
 if auth.uid() is null or g.owner_id is distinct from auth.uid() then raise exception 'NEXO_OWNER';end if;
 delete from public.divzplit_history where group_id=p_id;
 get diagnostics removed=row_count;
 return removed;
end;
$$;
create or replace function public.divzplit_clear_notifications() returns bigint
language plpgsql security definer set search_path='' as $$
declare removed bigint;
begin
 if auth.uid() is null then raise exception 'NEXO_FORBIDDEN';end if;
 delete from public.divzplit_notifications where user_id=auth.uid();
 get diagnostics removed=row_count;
 return removed;
end;
$$;
revoke all on function public.divzplit_clear_history(uuid),public.divzplit_clear_notifications() from public,anon,authenticated;
grant execute on function public.divzplit_clear_history(uuid),public.divzplit_clear_notifications() to authenticated;
notify pgrst,'reload schema';
commit;
