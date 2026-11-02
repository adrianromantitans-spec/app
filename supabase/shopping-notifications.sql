-- Run after shopping.sql and the existing notification migrations. No secrets.
begin;
alter table public.divzplit_notification_settings add column if not exists shopping boolean not null default true;
alter table public.divzplit_notifications drop constraint if exists divzplit_notifications_category_check;
alter table public.divzplit_notifications add constraint divzplit_notifications_category_check check(category in ('expenses','polls','tasks','payments','shopping'));
alter table public.divzplit_push_config add column if not exists shopping_sender_ready boolean not null default false;

create table if not exists public.divzplit_shopping_reminders(
 group_id uuid primary key references public.nexo_groups(id) on delete cascade,
 last_sent timestamptz not null,request_id uuid not null,actor_id uuid not null,recipients bigint not null
);
alter table public.divzplit_shopping_reminders enable row level security;
revoke all on public.divzplit_shopping_reminders from public,anon,authenticated;

create or replace function public.divzplit_get_notification_settings() returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;cfg public.divzplit_push_config;
begin
 if auth.uid() is null then raise exception 'NEXO_FORBIDDEN';end if;
 select * into cfg from public.divzplit_push_config where id;
 select to_jsonb(s)-'user_id' into result from public.divzplit_notification_settings s where user_id=auth.uid();
 return coalesce(result,'{"expenses":true,"polls":true,"tasks":true,"payments":true,"shopping":true}'::jsonb)||jsonb_build_object(
  'muted_groups',coalesce((select jsonb_agg(group_id) from public.divzplit_muted_groups where user_id=auth.uid()),'[]'::jsonb),
  'shopping_ready',true,'push_ready',coalesce(cfg.enabled and cfg.public_key is not null,false),'public_key',cfg.public_key);
end $$;
create or replace function public.divzplit_set_notification_settings_v2(p_expenses boolean,p_polls boolean,p_tasks boolean,p_payments boolean,p_shopping boolean,p_muted uuid[]) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if p_shopping is null then raise exception 'NEXO_FORBIDDEN';end if;
 perform public.divzplit_set_notification_settings(p_expenses,p_polls,p_tasks,p_payments,p_muted);
 update public.divzplit_notification_settings set shopping=p_shopping where user_id=auth.uid();
 -- A disabled category must also stop already queued deliveries.
 if not p_shopping then
  update public.divzplit_push_jobs j set status='discarded',lease=null,locked_until=null
  where j.status='pending' and exists(select 1 from public.divzplit_notifications n where n.id=j.notification_id and n.user_id=auth.uid() and n.category='shopping');
 end if;
 return public.divzplit_get_notification_settings();
end $$;

create table if not exists public.divzplit_shopping_notice_throttle(
 group_id uuid not null references public.nexo_groups(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,last_added_at timestamptz not null,
 primary key(group_id,user_id)
);
alter table public.divzplit_shopping_notice_throttle enable row level security;
revoke all on public.divzplit_shopping_notice_throttle from public,anon,authenticated;

create or replace function public.divzplit_deliver_shopping_notice(p_group uuid,p_actor uuid,p_kind text,p_subject text,p_throttle boolean) returns bigint
language plpgsql security definer set search_path='' as $$
declare g public.nexo_groups;sender text;result bigint:=0;target uuid;
begin
 select * into g from public.nexo_groups where id=p_group;
 select m->>'name' into sender from jsonb_array_elements(g.document->'members') m where m->>'id'=p_actor::text;
 for target in
  select m.user_id from public.nexo_members m left join public.divzplit_notification_settings s on s.user_id=m.user_id
  where m.group_id=p_group and m.user_id<>p_actor and coalesce(s.shopping,true)
   and not exists(select 1 from public.divzplit_muted_groups z where z.group_id=p_group and z.user_id=m.user_id)
   and (not p_throttle or not exists(select 1 from public.divzplit_shopping_notice_throttle t where t.group_id=p_group and t.user_id=m.user_id and t.last_added_at>clock_timestamp()-interval '5 minutes'))
 loop
  insert into public.divzplit_notifications(user_id,group_id,kind,category,actor_name,group_name,subject)
  values(target,p_group,p_kind,'shopping',coalesce(sender,'Miembro'),g.document->>'name',left(p_subject,120));
  if p_throttle then
   insert into public.divzplit_shopping_notice_throttle values(p_group,target,clock_timestamp())
   on conflict(group_id,user_id) do update set last_added_at=excluded.last_added_at;
  end if;
  result:=result+1;
 end loop;
 return result;
end $$;
create or replace function public.divzplit_notify_shopping_insert() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.nexo_groups where id=new.group_id for update;
 perform public.divzplit_deliver_shopping_notice(new.group_id,new.created_by,'shopping.added',new.title,true);
 return new;
end $$;
drop trigger if exists divzplit_shopping_added_notice on public.divzplit_shopping_items;
create trigger divzplit_shopping_added_notice after insert on public.divzplit_shopping_items for each row execute function public.divzplit_notify_shopping_insert();

create or replace function public.divzplit_remind_shopping(p_id uuid,p_request_id uuid) returns bigint
language plpgsql security definer set search_path='' as $$
declare previous public.divzplit_shopping_reminders;result bigint;
begin
 if not public.nexo_is_member(p_id) then raise exception 'NEXO_FORBIDDEN';end if;
 if p_request_id is null then raise exception 'NEXO_SHOPPING_FIELDS';end if;
 perform 1 from public.nexo_groups where id=p_id for update;
 select * into previous from public.divzplit_shopping_reminders where group_id=p_id;
 if previous.request_id=p_request_id and previous.actor_id=auth.uid() then return previous.recipients;end if;
 if not exists(select 1 from public.divzplit_shopping_items where group_id=p_id and not bought) then raise exception 'NEXO_SHOPPING_EMPTY';end if;
 if previous.last_sent>clock_timestamp()-interval '15 minutes' then raise exception 'NEXO_SHOPPING_REMINDER_WAIT';end if;
 result:=public.divzplit_deliver_shopping_notice(p_id,auth.uid(),'shopping.reminder','',false);
 insert into public.divzplit_shopping_reminders values(p_id,clock_timestamp(),p_request_id,auth.uid(),result)
 on conflict(group_id) do update set last_sent=excluded.last_sent,request_id=excluded.request_id,actor_id=excluded.actor_id,recipients=excluded.recipients;
 return result;
end $$;

-- Old senders do not yet know shopping copy. Queue shopping push only after
-- the updated, authenticated sender announces support. Inbox alerts work now.
create or replace function public.divzplit_enqueue_push() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.divzplit_push_config where enabled and (new.category<>'shopping' or shopping_sender_ready)) then
  insert into public.divzplit_push_jobs(notification_id,subscription_id)
  select new.id,s.id from public.divzplit_push_subscriptions s where s.user_id=new.user_id and s.enabled
  on conflict(notification_id,subscription_id) do nothing;
 end if;
 return new;
end $$;
create or replace function public.divzplit_shopping_sender_ready() returns void
language sql security definer set search_path='' as $$
 update public.divzplit_push_config set shopping_sender_ready=true where id and not shopping_sender_ready;
$$;
revoke all on function public.divzplit_deliver_shopping_notice(uuid,uuid,text,text,boolean),public.divzplit_notify_shopping_insert(),public.divzplit_shopping_sender_ready() from public,anon,authenticated;
revoke all on function public.divzplit_set_notification_settings_v2(boolean,boolean,boolean,boolean,boolean,uuid[]),public.divzplit_remind_shopping(uuid,uuid) from public,anon;
grant execute on function public.divzplit_set_notification_settings_v2(boolean,boolean,boolean,boolean,boolean,uuid[]),public.divzplit_remind_shopping(uuid,uuid) to authenticated;
grant execute on function public.divzplit_shopping_sender_ready() to service_role;
create or replace function public.divzplit_claim_push(p_limit integer default 25) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not exists(select 1 from public.divzplit_push_config where enabled and public_key is not null) then return '[]'::jsonb;end if;
 update public.divzplit_push_jobs j set status='discarded' where j.status in ('pending','processing') and (j.status='pending' or j.locked_until<now()) and (
  j.attempts>=5 or not exists(
   select 1 from public.divzplit_notifications n join public.divzplit_push_subscriptions s on s.id=j.subscription_id and s.user_id=n.user_id and s.enabled
   join public.nexo_members m on m.group_id=n.group_id and m.user_id=n.user_id
   left join public.divzplit_notification_settings p on p.user_id=n.user_id
   where n.id=j.notification_id and n.created_at>now()-interval '1 day' and n.read_at is null
    and not exists(select 1 from public.divzplit_muted_groups z where z.group_id=n.group_id and z.user_id=n.user_id)
    and case n.category when 'expenses' then coalesce(p.expenses,true) when 'polls' then coalesce(p.polls,true) when 'tasks' then coalesce(p.tasks,true) when 'shopping' then coalesce(p.shopping,true) else coalesce(p.payments,true) end
  )
 );
 with due as (
  select id from public.divzplit_push_jobs where (status='pending' and next_attempt_at<=now()) or (status='processing' and locked_until<now())
  order by next_attempt_at,id for update skip locked limit greatest(1,least(coalesce(p_limit,25),50))
 ), claimed as (
  update public.divzplit_push_jobs j set status='processing',attempts=attempts+1,lease=gen_random_uuid(),locked_until=now()+interval '2 minutes'
  from due where j.id=due.id returning j.*
 ) select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'lease',c.lease,'attempts',c.attempts,'endpoint',s.endpoint,'keys',jsonb_build_object('p256dh',s.p256dh,'auth',s.auth),'language',s.language,'notification_id',n.id,'user_id',n.user_id,'kind',n.kind)),'[]'::jsonb)
 into result from claimed c join public.divzplit_notifications n on n.id=c.notification_id join public.divzplit_push_subscriptions s on s.id=c.subscription_id;
 return result;
end;
$$;

notify pgrst,'reload schema';
commit;
