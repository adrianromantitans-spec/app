-- DivZplit: install native tables and reviewed privacy/deletion integration atomically.
-- Does NOT activate FCM or contain private credentials.
begin;
-- SOURCE: supabase/native-push.sql
-- Run after notifications.sql, shopping-notifications.sql and account-deletion.sql.
-- Adds a separate Android FCM transport. Existing Web Push tables/functions stay intact.

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

-- SOURCE: supabase/account-deletion.sql
-- Self-serve account deletion for Google Play and GDPR-style erasure.
-- Run once in the Supabase SQL editor after the current migrations.
-- Safe to run again. It does not delete other members' expenses or balances.
--
-- The auth user row is kept as an anonymized, banned key so shared ledgers
-- (payments, shopping authorship, membership) stay valid. Sign-in, email,
-- name, sessions and push data are removed. Groups with no other member are
-- deleted. Shared groups keep the person as "Cuenta eliminada".

create or replace function public.divzplit_delete_account() returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=auth.uid();
  rec record;
  members jsonb;
  successor uuid;
  solo uuid[]:='{}';
  gid uuid;
  shared_count integer:=0;
  removed_count integer:=0;
begin
  if actor is null then raise exception 'NEXO_FORBIDDEN'; end if;

  for rec in
    select g.id,g.owner_id,g.document
    from public.nexo_groups g
    where exists(select 1 from public.nexo_members m where m.group_id=g.id and m.user_id=actor)
    for update
  loop
    if not exists(select 1 from public.nexo_members m where m.group_id=rec.id and m.user_id<>actor) then
      solo:=solo||rec.id;
      continue;
    end if;
    select coalesce(jsonb_agg(
      case when elem->>'id'=actor::text
        then (elem-'email')||jsonb_build_object('name','Cuenta eliminada','initials','·')
        else elem end
      order by ord), '[]'::jsonb)
    into members
    from jsonb_array_elements(rec.document->'members') with ordinality as t(elem,ord);
    update public.nexo_groups
      set document=jsonb_set(rec.document,'{members}',members), version=version+1
      where id=rec.id;
    if rec.owner_id=actor then
      select m.user_id into successor
      from public.nexo_members m
      where m.group_id=rec.id and m.user_id<>actor
      order by m.user_id
      limit 1;
      if successor is null then raise exception 'NEXO_DELETE_OWNER'; end if;
      update public.nexo_groups set owner_id=successor where id=rec.id;
    end if;
    shared_count:=shared_count+1;
  end loop;

  if to_regclass('public.nexo_deleted_groups') is not null then
    insert into public.nexo_deleted_groups(id,owner_id)
    select s.id,actor from unnest(solo) as s(id)
    on conflict(id) do nothing;
  end if;
  delete from public.nexo_groups where id=any(solo);
  get diagnostics removed_count=row_count;
  if to_regclass('storage.objects') is not null then
    foreach gid in array solo loop
      delete from storage.objects
      where bucket_id='divzplit-receipts' and name like gid::text||'/%';
    end loop;
    if to_regclass('public.nexo_deleted_groups') is not null then
      update public.nexo_deleted_groups set cleaned_at=clock_timestamp()
      where owner_id=actor and id=any(solo) and cleaned_at is null;
    end if;
  end if;

  if to_regclass('public.divzplit_native_subscriptions') is not null then
    delete from public.divzplit_native_subscriptions where user_id=actor;
  end if;
  if to_regclass('public.divzplit_push_subscriptions') is not null then
    delete from public.divzplit_push_subscriptions where user_id=actor;
  end if;
  if to_regclass('public.divzplit_notifications') is not null then
    delete from public.divzplit_notifications where user_id=actor;
  end if;
  if to_regclass('public.divzplit_notification_settings') is not null then
    delete from public.divzplit_notification_settings where user_id=actor;
  end if;
  if to_regclass('public.divzplit_muted_groups') is not null then
    delete from public.divzplit_muted_groups where user_id=actor;
  end if;
  if to_regclass('public.divzplit_fx_quotes') is not null then
    delete from public.divzplit_fx_quotes where user_id=actor;
  end if;
  if to_regclass('public.divzplit_shopping_notice_throttle') is not null then
    delete from public.divzplit_shopping_notice_throttle where user_id=actor;
  end if;
  if to_regclass('public.divzplit_history') is not null then
    update public.divzplit_history set actor_id=null, actor_name='Cuenta eliminada' where actor_id=actor;
  end if;

  if to_regclass('auth.mfa_challenges') is not null and to_regclass('auth.mfa_factors') is not null then
    delete from auth.mfa_challenges where factor_id in (select id from auth.mfa_factors where user_id=actor);
  end if;
  if to_regclass('auth.mfa_factors') is not null then
    delete from auth.mfa_factors where user_id=actor;
  end if;
  if to_regclass('auth.sessions') is not null then
    delete from auth.sessions where user_id=actor;
  end if;
  if to_regclass('auth.refresh_tokens') is not null then
    delete from auth.refresh_tokens where user_id::text=actor::text;
  end if;
  if to_regclass('auth.identities') is not null then
    delete from auth.identities where user_id=actor;
  end if;
  if to_regclass('auth.one_time_tokens') is not null then
    delete from auth.one_time_tokens where user_id=actor;
  end if;

  update auth.users set
    email='deleted+'||id::text||'@users.divzplit.invalid',
    phone=null,
    encrypted_password='',
    email_confirmed_at=null,
    raw_user_meta_data='{}'::jsonb,
    raw_app_meta_data=coalesce(raw_app_meta_data,'{}'::jsonb)||jsonb_build_object('deleted',true),
    banned_until='infinity',
    confirmation_token='',
    recovery_token='',
    email_change='',
    email_change_token_new='',
    email_change_token_current=''
  where id=actor;

  return jsonb_build_object('deleted',true,'shared_groups',shared_count,'removed_groups',removed_count);
end;
$$;

revoke all on function public.divzplit_delete_account() from public,anon;
grant execute on function public.divzplit_delete_account() to authenticated;
notify pgrst, 'reload schema';

-- SOURCE: supabase/privacy-operations.sql
-- Privacy tools for an existing DivZplit installation. Run after all current
-- migrations. No account, shared expense or confirmed payment is deleted.

create or replace function public.divzplit_privacy_export() returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); account_data jsonb; result jsonb; native_data jsonb;
begin
 if actor is null then raise exception 'NEXO_FORBIDDEN';end if;
 select jsonb_build_object('id',u.id,'email',to_jsonb(u)->'email','created_at',to_jsonb(u)->'created_at',
  'metadata',u.raw_user_meta_data) into account_data from auth.users u where u.id=actor;
 if account_data is null then raise exception 'NEXO_FORBIDDEN';end if;
 result:=jsonb_build_object('format','divzplit-account-export-v1','generated_at',clock_timestamp(),
  'account',account_data,
  'groups',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'owner_id',g.owner_id,'version',g.version,'document',g.document) order by g.id)
    from public.nexo_groups g where exists(select 1 from public.nexo_members m where m.group_id=g.id and m.user_id=actor)),'[]'::jsonb),
  'history',coalesce((select jsonb_agg(to_jsonb(h) order by h.created_at,h.id) from public.divzplit_history h
    where exists(select 1 from public.nexo_members m where m.group_id=h.group_id and m.user_id=actor)),'[]'::jsonb),
  'payment_requests',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at,p.id) from public.divzplit_payment_requests p
    where exists(select 1 from public.nexo_members m where m.group_id=p.group_id and m.user_id=actor)),'[]'::jsonb),
  'shopping',coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at,s.id) from public.divzplit_shopping_items s
    where exists(select 1 from public.nexo_members m where m.group_id=s.group_id and m.user_id=actor)),'[]'::jsonb),
  'notifications',coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at,n.id) from public.divzplit_notifications n where n.user_id=actor),'[]'::jsonb),
  'notification_settings',(select to_jsonb(s)-'user_id' from public.divzplit_notification_settings s where s.user_id=actor),
  'muted_groups',coalesce((select jsonb_agg(m.group_id order by m.group_id) from public.divzplit_muted_groups m where m.user_id=actor),'[]'::jsonb),
  'push_subscriptions',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'language',p.language,'enabled',p.enabled,'updated_at',p.updated_at) order by p.id)
    from public.divzplit_push_subscriptions p where p.user_id=actor),'[]'::jsonb),
  'scope',jsonb_build_object('shared_group_data',true,'receipt_images','References included; request the image files from support.',
   'provider_logs_and_backups','Not included; contact support for a full access request.'));
 if to_regclass('public.divzplit_native_subscriptions') is not null then
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'language',p.language,'enabled',p.enabled,'updated_at',p.updated_at) order by p.id),'[]'::jsonb)
   into native_data from public.divzplit_native_subscriptions p where p.user_id=actor;
  result:=result||jsonb_build_object('native_push_subscriptions',native_data);
 end if;
 return result;
end;
$$;
create or replace function public.divzplit_privacy_retention() returns jsonb
language plpgsql security definer set search_path='' as $$
declare notices bigint; jobs bigint; subscriptions bigint; quotes bigint; invites bigint;
begin
 -- Internal-only, scheduled below. No user-controlled identifiers or SQL.
 if to_regclass('public.divzplit_native_jobs') is not null then
  delete from public.divzplit_native_jobs where status in ('sent','discarded') and next_attempt_at<clock_timestamp()-interval '7 days';
  delete from public.divzplit_native_subscriptions where not enabled and updated_at<clock_timestamp()-interval '30 days';
 end if;
 delete from public.divzplit_push_jobs where status in ('sent','discarded') and next_attempt_at<clock_timestamp()-interval '7 days';get diagnostics jobs=row_count;
 delete from public.divzplit_notifications where created_at<clock_timestamp()-interval '90 days';get diagnostics notices=row_count;
 delete from public.divzplit_push_subscriptions where not enabled and updated_at<clock_timestamp()-interval '30 days';get diagnostics subscriptions=row_count;
 delete from public.divzplit_fx_quotes where checked_at<clock_timestamp()-interval '2 days';get diagnostics quotes=row_count;
 delete from public.nexo_invites where expires_at<clock_timestamp()-interval '30 days';get diagnostics invites=row_count;
 return jsonb_build_object('notifications',notices,'terminal_push_jobs',jobs,'disabled_subscriptions',subscriptions,'expired_fx_quotes',quotes,'expired_invites',invites);
end;
$$;
revoke all on function public.divzplit_privacy_export(),public.divzplit_privacy_retention() from public,anon,authenticated;
grant execute on function public.divzplit_privacy_export() to authenticated;
grant execute on function public.divzplit_privacy_retention() to service_role;
do $$
begin
 if exists(select 1 from pg_available_extensions where name='pg_cron') then
  execute 'create extension if not exists pg_cron with schema pg_catalog';
  if not exists(select 1 from cron.job where jobname='divzplit-privacy-retention') then
   perform cron.schedule('divzplit-privacy-retention','17 3 * * *','select public.divzplit_privacy_retention();');
  end if;
 end if;
end;
$$;
notify pgrst, 'reload schema';

-- If pg_cron is unavailable, arrange a trusted daily execution manually.
-- Verify on Supabase: select jobname,active from cron.job where jobname='divzplit-privacy-retention';

commit;
