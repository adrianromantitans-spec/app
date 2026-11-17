-- Run after notifications.sql, shopping-notifications.sql and account-deletion.sql.
-- Adds a separate Android FCM transport. Existing Web Push tables/functions stay intact.
begin;
create table if not exists public.divzplit_native_push_config(
 id boolean primary key default true check(id), enabled boolean not null default false
);
insert into public.divzplit_native_push_config(id) values(true) on conflict do nothing;
create table if not exists public.divzplit_native_subscriptions(
 id text primary key,user_id uuid not null references auth.users(id) on delete cascade,
 token text not null,language text not null check(language in ('es','en','ro')),
 enabled boolean not null default true,updated_at timestamptz not null default clock_timestamp()
);
create table if not exists public.divzplit_native_jobs(
 id uuid primary key default gen_random_uuid(),notification_id uuid not null references public.divzplit_notifications(id) on delete cascade,
 subscription_id text not null references public.divzplit_native_subscriptions(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','processing','sent','discarded')),
 attempts integer not null default 0,next_attempt_at timestamptz not null default now(),
 locked_until timestamptz,lease uuid,last_status integer,unique(notification_id,subscription_id)
);
create index if not exists divzplit_native_due on public.divzplit_native_jobs(status,next_attempt_at);
alter table public.divzplit_native_push_config enable row level security;
alter table public.divzplit_native_subscriptions enable row level security;
alter table public.divzplit_native_jobs enable row level security;
revoke all on public.divzplit_native_push_config,public.divzplit_native_subscriptions,public.divzplit_native_jobs from public,anon,authenticated;
create or replace function public.divzplit_native_push_status() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('enabled',auth.uid() is not null and exists(select 1 from public.divzplit_native_push_config where enabled));
$$;
create or replace function public.divzplit_register_native_push(p_token text,p_language text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from auth.users u where u.id=auth.uid() and coalesce((to_jsonb(u)->>'banned_until')::timestamptz,'-infinity'::timestamptz)<now()) then raise exception 'NEXO_FORBIDDEN';end if;
 if not exists(select 1 from public.divzplit_native_push_config where enabled) then raise exception 'NEXO_PUSH_NOT_READY';end if;
 if p_token is null or length(p_token)<20 or length(p_token)>4096 or p_token !~ '^[A-Za-z0-9_:.-]+$' or p_language is null or p_language not in ('es','en','ro') then raise exception 'NEXO_FORBIDDEN';end if;
 insert into public.divzplit_native_subscriptions(id,user_id,token,language)
 values(encode(sha256(convert_to(p_token,'UTF8')),'hex'),auth.uid(),p_token,p_language)
 on conflict(id) do update set user_id=excluded.user_id,token=excluded.token,language=excluded.language,enabled=true,updated_at=clock_timestamp();
end;
$$;
create or replace function public.divzplit_remove_native_push(p_token text) returns void
language sql security definer set search_path='' as $$
 update public.divzplit_native_subscriptions set enabled=false
 where id=encode(sha256(convert_to(p_token,'UTF8')),'hex') and user_id=auth.uid();
$$;
create or replace function public.divzplit_enqueue_native_push() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.divzplit_native_push_config where enabled) then return new;end if;
 insert into public.divzplit_native_jobs(notification_id,subscription_id)
 select new.id,s.id from public.divzplit_native_subscriptions s where s.user_id=new.user_id and s.enabled
 on conflict(notification_id,subscription_id) do nothing;
 return new;
end;
$$;
drop trigger if exists divzplit_native_push_enqueue on public.divzplit_notifications;
create trigger divzplit_native_push_enqueue after insert on public.divzplit_notifications for each row execute function public.divzplit_enqueue_native_push();
create or replace function public.divzplit_claim_native_push(p_limit integer default 25) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not exists(select 1 from public.divzplit_native_push_config where enabled) then return '[]'::jsonb;end if;
 update public.divzplit_native_jobs j set status='discarded' where j.status in ('pending','processing') and (j.status='pending' or j.locked_until<now()) and (
  j.attempts>=5 or not exists(
   select 1 from public.divzplit_notifications n join public.divzplit_native_subscriptions s on s.id=j.subscription_id and s.user_id=n.user_id and s.enabled
   join public.nexo_members m on m.group_id=n.group_id and m.user_id=n.user_id
   join auth.users u on u.id=n.user_id and coalesce((to_jsonb(u)->>'banned_until')::timestamptz,'-infinity'::timestamptz)<now()
   left join public.divzplit_notification_settings p on p.user_id=n.user_id
   where n.id=j.notification_id and n.created_at>now()-interval '1 day' and n.read_at is null
    and not exists(select 1 from public.divzplit_muted_groups z where z.group_id=n.group_id and z.user_id=n.user_id)
    and case n.category when 'expenses' then coalesce(p.expenses,true) when 'polls' then coalesce(p.polls,true) when 'tasks' then coalesce(p.tasks,true) when 'shopping' then coalesce(p.shopping,true) else coalesce(p.payments,true) end
  )
 );
 with due as (
  select id from public.divzplit_native_jobs where (status='pending' and next_attempt_at<=now()) or (status='processing' and locked_until<now())
  order by next_attempt_at,id for update skip locked limit greatest(1,least(coalesce(p_limit,25),50))
 ), claimed as (
  update public.divzplit_native_jobs j set status='processing',attempts=attempts+1,lease=gen_random_uuid(),locked_until=now()+interval '2 minutes'
  from due where j.id=due.id returning j.*
 ) select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'lease',c.lease,'attempts',c.attempts,'token',s.token,'language',s.language,'notification_id',n.id,'user_id',n.user_id,'kind',n.kind)),'[]'::jsonb)
 into result from claimed c join public.divzplit_notifications n on n.id=c.notification_id join public.divzplit_native_subscriptions s on s.id=c.subscription_id;
 return result;
end;
$$;


create or replace function public.divzplit_finish_native_push(p_id uuid,p_lease uuid,p_status integer,p_retry boolean default false,p_disable boolean default false) returns boolean
language plpgsql security definer set search_path='' as $$
declare j public.divzplit_native_jobs;
begin
 select * into j from public.divzplit_native_jobs where id=p_id and status='processing' and lease=p_lease for update;
 if not found then return false;end if;
 update public.divzplit_native_jobs set status=case when p_retry and attempts<5 then 'pending' when p_status between 200 and 299 then 'sent' else 'discarded' end,
 next_attempt_at=now()+make_interval(secs=>least(3600,(30*power(2,least(attempts,6)))::integer)),last_status=p_status,locked_until=null,lease=null where id=j.id;
 if p_disable then update public.divzplit_native_subscriptions s set enabled=false where s.id=j.subscription_id and s.user_id=(select user_id from public.divzplit_notifications where id=j.notification_id);end if;
 return true;
end;
$$;

revoke all on function public.divzplit_native_push_status(),public.divzplit_register_native_push(text,text),public.divzplit_remove_native_push(text),public.divzplit_enqueue_native_push(),public.divzplit_claim_native_push(integer),public.divzplit_finish_native_push(uuid,uuid,integer,boolean,boolean) from public,anon,authenticated;
grant execute on function public.divzplit_native_push_status(),public.divzplit_register_native_push(text,text),public.divzplit_remove_native_push(text) to authenticated;
grant execute on function public.divzplit_claim_native_push(integer),public.divzplit_finish_native_push(uuid,uuid,integer,boolean,boolean) to service_role;
notify pgrst,'reload schema';
commit;
