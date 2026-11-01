-- Run after collaboration.sql. Push stays disabled until the sender is configured.
begin;
create table if not exists public.divzplit_notification_settings(
 user_id uuid primary key references auth.users(id) on delete cascade,
 expenses boolean not null default true,polls boolean not null default true,
 tasks boolean not null default true,payments boolean not null default true
);
create table if not exists public.divzplit_muted_groups(
 user_id uuid not null references auth.users(id) on delete cascade,
 group_id uuid not null references public.nexo_groups(id) on delete cascade,primary key(user_id,group_id)
);
create table if not exists public.divzplit_notifications(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 group_id uuid not null references public.nexo_groups(id) on delete cascade,
 event_id uuid references public.divzplit_history(id) on delete set null,
 kind text not null,category text not null check(category in ('expenses','polls','tasks','payments')),
 actor_name text not null,group_name text not null,subject text not null default '',
 created_at timestamptz not null default clock_timestamp(),read_at timestamptz,
 unique(event_id,user_id)
);
create index if not exists divzplit_notification_inbox on public.divzplit_notifications(user_id,created_at desc,id desc);
create table if not exists public.divzplit_push_config(
 id boolean primary key default true check(id),enabled boolean not null default false,public_key text,
 check(public_key is null or public_key ~ '^[A-Za-z0-9_-]{87}$')
);
insert into public.divzplit_push_config(id) values(true) on conflict do nothing;
create table if not exists public.divzplit_push_subscriptions(
 id text primary key,user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null,p256dh text not null,auth text not null,
 language text not null check(language in ('es','en','ro')),enabled boolean not null default true,
 updated_at timestamptz not null default clock_timestamp()
);
create table if not exists public.divzplit_push_jobs(
 id uuid primary key default gen_random_uuid(),notification_id uuid not null references public.divzplit_notifications(id) on delete cascade,
 subscription_id text not null references public.divzplit_push_subscriptions(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','processing','sent','discarded')),
 attempts integer not null default 0,next_attempt_at timestamptz not null default now(),
 locked_until timestamptz,lease uuid,last_status integer,unique(notification_id,subscription_id)
);
create index if not exists divzplit_push_due on public.divzplit_push_jobs(status,next_attempt_at);
alter table public.divzplit_notification_settings enable row level security;
alter table public.divzplit_muted_groups enable row level security;
alter table public.divzplit_notifications enable row level security;
alter table public.divzplit_push_config enable row level security;
alter table public.divzplit_push_subscriptions enable row level security;
alter table public.divzplit_push_jobs enable row level security;
revoke all on public.divzplit_notification_settings,public.divzplit_muted_groups,public.divzplit_notifications,public.divzplit_push_config,public.divzplit_push_subscriptions,public.divzplit_push_jobs from public,anon,authenticated;

create or replace function public.divzplit_notify_event() returns trigger
language plpgsql security definer set search_path='' as $$
declare target record; cat text; data jsonb:=coalesce(new.after_data,new.before_data); recipient text;
begin
 if new.kind in ('expenses.added','expenses.updated','expenses.deleted') then cat:='expenses';
 elsif new.kind='polls.added' then cat:='polls';
 elsif new.kind='tasks.added' or (new.kind='tasks.updated' and new.before_data->>'assignee' is distinct from new.after_data->>'assignee') then cat:='tasks';recipient:=data->>'assignee';
 elsif new.kind='payment.requested' then cat:='payments';recipient:=data->>'to_id';
 elsif new.kind='payments.added' then cat:='payments';recipient:=data->>'from';
 elsif new.kind='payment.rejected' then cat:='payments';recipient:=data->>'from_id';
 elsif new.kind='payment.cancelled' then cat:='payments';recipient:=data->>'to_id';
 else return new;end if;
 for target in
  select m.user_id,g.document->>'name' as name from public.nexo_members m
  join public.nexo_groups g on g.id=m.group_id
  left join public.divzplit_notification_settings s on s.user_id=m.user_id
  where m.group_id=new.group_id and m.user_id is distinct from new.actor_id
   and (recipient is null or m.user_id::text=recipient)
   and case cat when 'expenses' then coalesce(s.expenses,true) when 'polls' then coalesce(s.polls,true) when 'tasks' then coalesce(s.tasks,true) else coalesce(s.payments,true) end
   and not exists(select 1 from public.divzplit_muted_groups x where x.user_id=m.user_id and x.group_id=new.group_id)
 loop
  insert into public.divzplit_notifications(user_id,group_id,event_id,kind,category,actor_name,group_name,subject)
  values(target.user_id,new.group_id,new.id,new.kind,cat,new.actor_name,target.name,left(coalesce(data->>'title',''),120)) on conflict(event_id,user_id) do nothing;
 end loop;
 return new;
end;
$$;
drop trigger if exists divzplit_event_notification on public.divzplit_history;
create trigger divzplit_event_notification after insert on public.divzplit_history for each row execute function public.divzplit_notify_event();
create or replace function public.divzplit_enqueue_push() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.divzplit_push_config where enabled) then
  insert into public.divzplit_push_jobs(notification_id,subscription_id)
  select new.id,s.id from public.divzplit_push_subscriptions s where s.user_id=new.user_id and s.enabled
  on conflict(notification_id,subscription_id) do nothing;
 end if;
 return new;
end;
$$;
drop trigger if exists divzplit_notification_push on public.divzplit_notifications;
create trigger divzplit_notification_push after insert on public.divzplit_notifications for each row execute function public.divzplit_enqueue_push();

create or replace function public.divzplit_get_notification_settings() returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; cfg public.divzplit_push_config;
begin
 if auth.uid() is null then raise exception 'NEXO_FORBIDDEN';end if;
 select * into cfg from public.divzplit_push_config where id;
 select to_jsonb(s)-'user_id' into result from public.divzplit_notification_settings s where user_id=auth.uid();
 return coalesce(result,'{"expenses":true,"polls":true,"tasks":true,"payments":true}'::jsonb)||jsonb_build_object(
  'muted_groups',coalesce((select jsonb_agg(group_id) from public.divzplit_muted_groups where user_id=auth.uid()),'[]'::jsonb),
  'push_ready',coalesce(cfg.enabled and cfg.public_key is not null,false),'public_key',cfg.public_key);
end;
$$;
create or replace function public.divzplit_set_notification_settings(p_expenses boolean,p_polls boolean,p_tasks boolean,p_payments boolean,p_muted uuid[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare gid uuid;
begin
 if auth.uid() is null or p_expenses is null or p_polls is null or p_tasks is null or p_payments is null or p_muted is null or cardinality(p_muted)>100 then raise exception 'NEXO_FORBIDDEN';end if;
 foreach gid in array p_muted loop if not public.nexo_is_member(gid) then raise exception 'NEXO_FORBIDDEN';end if;end loop;
 insert into public.divzplit_notification_settings values(auth.uid(),p_expenses,p_polls,p_tasks,p_payments)
 on conflict(user_id) do update set expenses=excluded.expenses,polls=excluded.polls,tasks=excluded.tasks,payments=excluded.payments;
 delete from public.divzplit_muted_groups where user_id=auth.uid();
 insert into public.divzplit_muted_groups select auth.uid(),unnest(p_muted) on conflict do nothing;
 return public.divzplit_get_notification_settings();
end;
$$;
create or replace function public.divzplit_notification_inbox(p_before timestamptz default null,p_before_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare items jsonb; unread bigint; last_item jsonb; has_more boolean;
begin
 if auth.uid() is null then raise exception 'NEXO_FORBIDDEN';end if;
 select coalesce(jsonb_agg(x order by x.created_at desc,x.id desc),'[]'::jsonb) into items from (
  select id,group_id,kind,category,actor_name,group_name,subject,created_at,read_at from public.divzplit_notifications
  where user_id=auth.uid() and public.nexo_is_member(group_id)
   and (p_before is null or (created_at,id)<(p_before,p_before_id)) order by created_at desc,id desc limit 31
 ) x;
 has_more:=jsonb_array_length(items)>30;
 if has_more then items:=items-30;end if;
 last_item:=items->(jsonb_array_length(items)-1);
 select count(*) into unread from public.divzplit_notifications where user_id=auth.uid() and read_at is null and public.nexo_is_member(group_id);
 return jsonb_build_object('items',items,'unread',unread,'next',case when has_more then jsonb_build_object('created_at',last_item->>'created_at','id',last_item->>'id') else null end);
end;
$$;
create or replace function public.divzplit_read_notifications(p_ids uuid[] default null) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or cardinality(p_ids)>100 then raise exception 'NEXO_FORBIDDEN';end if;
 update public.divzplit_notifications set read_at=coalesce(read_at,clock_timestamp()) where user_id=auth.uid() and public.nexo_is_member(group_id) and (p_ids is null or id=any(p_ids));
end;
$$;
create or replace function public.divzplit_open_notification(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare n public.divzplit_notifications;
begin
 update public.divzplit_notifications set read_at=coalesce(read_at,clock_timestamp()) where id=p_id and user_id=auth.uid() and public.nexo_is_member(group_id) returning * into n;
 if not found then raise exception 'NEXO_FORBIDDEN';end if;
 return jsonb_build_object('group_id',n.group_id,'kind',n.kind);
end;
$$;
create or replace function public.divzplit_register_push(p_endpoint text,p_p256dh text,p_auth text,p_language text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'NEXO_FORBIDDEN';end if;
 if not exists(select 1 from public.divzplit_push_config where enabled and public_key is not null) then raise exception 'NEXO_PUSH_NOT_READY';end if;
 if p_endpoint is null or length(p_endpoint)>4096 or p_endpoint !~ '^https://(fcm[.]googleapis[.]com|([a-z0-9-]+[.])*push[.]apple[.]com|([a-z0-9-]+[.])*push[.]services[.]mozilla[.]com|([a-z0-9-]+[.])+notify[.]windows[.]com)/[^[:space:]#]*$'
  or p_p256dh is null or p_p256dh !~ '^[A-Za-z0-9_-]{87}$' or p_auth is null or p_auth !~ '^[A-Za-z0-9_-]{22}$' or p_language is null or p_language not in ('es','en','ro') then raise exception 'NEXO_FORBIDDEN';end if;
 insert into public.divzplit_push_subscriptions as existing_sub(id,user_id,endpoint,p256dh,auth,language)
 values(encode(sha256(convert_to(p_endpoint,'UTF8')),'hex'),auth.uid(),p_endpoint,p_p256dh,p_auth,p_language)
 on conflict(id) do update set user_id=excluded.user_id,p256dh=excluded.p256dh,auth=excluded.auth,language=excluded.language,enabled=true,updated_at=clock_timestamp()
 where existing_sub.user_id=auth.uid() or (existing_sub.p256dh=excluded.p256dh and existing_sub.auth=excluded.auth);
 if not found then raise exception 'NEXO_FORBIDDEN';end if;
end;
$$;
create or replace function public.divzplit_remove_push(p_endpoint text) returns void
language plpgsql security definer set search_path='' as $$
begin
 update public.divzplit_push_subscriptions set enabled=false where id=encode(sha256(convert_to(p_endpoint,'UTF8')),'hex') and user_id=auth.uid();
end;
$$;

-- These worker operations are exclusively for the server service_role.
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
    and case n.category when 'expenses' then coalesce(p.expenses,true) when 'polls' then coalesce(p.polls,true) when 'tasks' then coalesce(p.tasks,true) else coalesce(p.payments,true) end
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
create or replace function public.divzplit_finish_push(p_id uuid,p_lease uuid,p_status integer,p_retry boolean default false,p_disable boolean default false) returns boolean
language plpgsql security definer set search_path='' as $$
declare j public.divzplit_push_jobs;
begin
 select * into j from public.divzplit_push_jobs where id=p_id and status='processing' and lease=p_lease for update;
 if not found then return false;end if;
 update public.divzplit_push_jobs set status=case when p_retry and attempts<5 then 'pending' when p_status between 200 and 299 then 'sent' else 'discarded' end,
 next_attempt_at=now()+make_interval(secs=>least(3600,(30*power(2,least(attempts,6)))::integer)),last_status=p_status,locked_until=null,lease=null where id=j.id;
 if p_disable then update public.divzplit_push_subscriptions s set enabled=false where s.id=j.subscription_id and s.user_id=(select user_id from public.divzplit_notifications where id=j.notification_id);end if;
 return true;
end;
$$;
revoke all on function public.divzplit_notify_event(),public.divzplit_enqueue_push() from public,anon,authenticated;
revoke all on function public.divzplit_get_notification_settings(),public.divzplit_set_notification_settings(boolean,boolean,boolean,boolean,uuid[]),public.divzplit_notification_inbox(timestamptz,uuid),public.divzplit_read_notifications(uuid[]),public.divzplit_open_notification(uuid),public.divzplit_register_push(text,text,text,text),public.divzplit_remove_push(text),public.divzplit_claim_push(integer),public.divzplit_finish_push(uuid,uuid,integer,boolean,boolean) from public,anon,authenticated;
grant execute on function public.divzplit_get_notification_settings(),public.divzplit_set_notification_settings(boolean,boolean,boolean,boolean,uuid[]),public.divzplit_notification_inbox(timestamptz,uuid),public.divzplit_read_notifications(uuid[]),public.divzplit_open_notification(uuid),public.divzplit_register_push(text,text,text,text),public.divzplit_remove_push(text) to authenticated;
grant execute on function public.divzplit_claim_push(integer),public.divzplit_finish_push(uuid,uuid,integer,boolean,boolean) to service_role;
notify pgrst,'reload schema';
commit;
