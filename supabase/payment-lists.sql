-- Requires collaboration.sql, notifications.sql and clear-lists.sql.
begin;
create table if not exists public.divzplit_archived_repayments(
 group_id uuid not null references public.nexo_groups(id) on delete cascade,
 payment_id text not null,archived_at timestamptz not null default clock_timestamp(),
 archived_by uuid not null references auth.users(id),primary key(group_id,payment_id)
);
alter table public.divzplit_archived_repayments enable row level security;
revoke all on public.divzplit_archived_repayments from public,anon,authenticated;
create or replace function public.divzplit_get_payment_archives(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not public.nexo_is_member(p_id) then raise exception 'NEXO_FORBIDDEN';end if;
 return coalesce((select jsonb_agg(payment_id order by payment_id) from public.divzplit_archived_repayments where group_id=p_id),'[]'::jsonb);
end;
$$;
create or replace function public.divzplit_archive_repayments(p_id uuid) returns bigint
language plpgsql security definer set search_path='' as $$
declare g public.nexo_groups; removed bigint;
begin
 select * into g from public.nexo_groups where id=p_id for update;
 if auth.uid() is null or g.owner_id is distinct from auth.uid() then raise exception 'NEXO_OWNER';end if;
 insert into public.divzplit_archived_repayments(group_id,payment_id,archived_by)
 select p_id,p->>'id',auth.uid() from jsonb_array_elements(g.document->'payments') p on conflict do nothing;
 get diagnostics removed=row_count;
 return removed;
end;
$$;
create or replace function public.divzplit_cancel_pending_payments(p_id uuid) returns bigint
language plpgsql security definer set search_path='' as $$
declare g public.nexo_groups; r public.divzplit_payment_requests; event_id uuid;
 actor uuid:=auth.uid(); actor_name text; removed bigint:=0; resolved timestamptz;
begin
 select * into g from public.nexo_groups where id=p_id for update;
 if actor is null or g.owner_id is distinct from actor then raise exception 'NEXO_OWNER';end if;
 select m->>'name' into actor_name from jsonb_array_elements(g.document->'members') m where m->>'id'=actor::text;
 for r in select * from public.divzplit_payment_requests where group_id=p_id and status='pending' for update loop
  resolved:=clock_timestamp();event_id:=gen_random_uuid();
  update public.divzplit_payment_requests set status='cancelled',resolved_at=resolved where id=r.id;
  insert into public.divzplit_history(id,group_id,actor_id,actor_name,kind,entity_id,before_data,after_data,currency)
  values(event_id,p_id,actor,coalesce(actor_name,'Miembro'),'payment.cancelled',r.id::text,to_jsonb(r),to_jsonb(r)||jsonb_build_object('status','cancelled','resolved_at',resolved,'cancelled_by',actor),r.currency);
  -- The existing trigger notifies the recipient; notify the sender as well when
  -- the administrator is a third party. Preferences and group mute still apply.
  insert into public.divzplit_notifications(user_id,group_id,event_id,kind,category,actor_name,group_name)
  select r.from_id,p_id,event_id,'payment.cancelled','payments',coalesce(actor_name,'Miembro'),g.document->>'name'
  where r.from_id<>actor
   and exists(select 1 from public.nexo_members where group_id=p_id and user_id=r.from_id)
   and coalesce((select payments from public.divzplit_notification_settings where user_id=r.from_id),true)
   and not exists(select 1 from public.divzplit_muted_groups where group_id=p_id and user_id=r.from_id)
  on conflict do nothing;
  removed:=removed+1;
 end loop;
 return removed;
end;
$$;
revoke all on function public.divzplit_get_payment_archives(uuid),public.divzplit_archive_repayments(uuid),public.divzplit_cancel_pending_payments(uuid) from public,anon,authenticated;
grant execute on function public.divzplit_get_payment_archives(uuid),public.divzplit_archive_repayments(uuid),public.divzplit_cancel_pending_payments(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
