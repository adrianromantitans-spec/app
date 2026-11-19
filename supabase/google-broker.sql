-- MANUAL INSTALL AFTER oauth-abuse.sql. Defaults remain observe/inactive.
-- No Auth Hook or policy mode is changed by this file. If already in block mode,
-- installing these triggers immediately enforces that existing policy.
begin;
create table if not exists divzplit_security.google_flows(
 id uuid primary key,
 state_digest text not null unique check(state_digest~'^[0-9a-f]{64}$'),
 app_challenge text not null check(app_challenge~'^[A-Za-z0-9_-]{43}$'),
 return_to text not null,
 nonce_digest text not null check(nonce_digest~'^[0-9a-f]{64}$'),
 sealed_context text,
 expires_at timestamptz not null,
 phase text not null check(phase in ('prepared','pending','callback_claimed','ready','completion_claimed','authorizing','done','failed')),
 google_subject text, verified_email text,
 completion_digest text unique, completion_expires_at timestamptz,
 target_user_id uuid, authorization_consumed_at timestamptz, identity_consumed_at timestamptz
);
alter table divzplit_security.google_flows add column if not exists launch_digest text;
alter table divzplit_security.google_flows add column if not exists launch_expires_at timestamptz;
alter table divzplit_security.google_flows drop constraint if exists google_flows_phase_check;
alter table divzplit_security.google_flows add constraint google_flows_phase_check check(phase in ('prepared','pending','callback_claimed','ready','completion_claimed','authorizing','done','failed'));
create unique index if not exists google_flows_launch_digest_idx on divzplit_security.google_flows(launch_digest);
create table if not exists divzplit_security.google_provisions(
 google_subject text primary key, email text not null,user_id uuid not null,expires_at timestamptz not null
);
revoke all on divzplit_security.google_provisions from public,anon,authenticated;
alter table divzplit_security.google_provisions enable row level security;
revoke all on divzplit_security.google_flows from public,anon,authenticated;
alter table divzplit_security.google_flows enable row level security;

-- Database backstop: protects direct OAuth even if a dashboard hook is forgotten.
-- Admin creation starts as an email user and is a server-privileged operation;
-- the broker permits it only after atomically consuming the bound authorization.
create or replace function divzplit_security.guard_google_creation()
returns trigger language plpgsql security definer set search_path='' as $$
declare policy text;
begin
 if new.raw_app_meta_data->>'provider'='google' then
  select mode into policy from divzplit_security.oauth_policy where id;
  if policy is null or policy='block_new_google' then raise exception 'GOOGLE_BROKER_REQUIRED' using errcode='42501';end if;
 end if;
 return new;
end $$;
revoke all on function divzplit_security.guard_google_creation() from public,anon,authenticated,service_role;
drop trigger if exists divzplit_require_google_broker on auth.users;
create trigger divzplit_require_google_broker before insert on auth.users for each row execute function divzplit_security.guard_google_creation();

-- The actual identity enrollment consumes the private authorization. This also
-- blocks pre-create-email-then-link-Google bypasses. Existing identity updates
-- keep working; no user/email/browser metadata is accepted as evidence.
create or replace function divzplit_security.guard_google_identity()
returns trigger language plpgsql security definer set search_path='' as $$
declare policy text; approved uuid;
begin
 if new.provider<>'google' then return new;end if;
 if tg_op='UPDATE' and old.provider=new.provider and old.provider_id=new.provider_id and old.user_id=new.user_id then return new;end if;
 select mode into policy from divzplit_security.oauth_policy where id;
 if policy='observe' then return new;end if;
 if policy is null then raise exception 'GOOGLE_BROKER_REQUIRED' using errcode='42501';end if;
 select id into approved from divzplit_security.google_flows
 where phase='authorizing' and google_subject=new.provider_id and target_user_id=new.user_id
 and authorization_consumed_at is not null and identity_consumed_at is null
 and completion_expires_at>clock_timestamp() and expires_at>clock_timestamp()
 order by authorization_consumed_at limit 1 for update;
 if approved is null then raise exception 'GOOGLE_BROKER_REQUIRED' using errcode='42501';end if;
 update divzplit_security.google_flows set identity_consumed_at=clock_timestamp() where id=approved;
 return new;
end $$;
revoke all on function divzplit_security.guard_google_identity() from public,anon,authenticated,service_role;
drop trigger if exists divzplit_require_google_enrollment on auth.identities;
create trigger divzplit_require_google_enrollment before insert or update of provider,provider_id,user_id on auth.identities for each row execute function divzplit_security.guard_google_identity();

create or replace function public.divzplit_google_broker_ready()
returns boolean language sql security definer set search_path='' as $$
 select exists(select from divzplit_security.oauth_policy where id and mode='block_new_google')
 and exists(select from pg_catalog.pg_trigger where tgrelid='auth.users'::regclass and tgname='divzplit_require_google_broker' and tgenabled in ('O','A'))
 and exists(select from pg_catalog.pg_trigger where tgrelid='auth.identities'::regclass and tgname='divzplit_require_google_enrollment' and tgenabled in ('O','A'));
$$;

create or replace function public.divzplit_google_flow_start(p_id uuid,p_state text,p_challenge text,p_return text,p_nonce text,p_sealed text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.divzplit_google_broker_ready() then raise exception 'BROKER_NOT_READY';end if;
 if p_state!~'^[0-9a-f]{64}$' or p_challenge!~'^[A-Za-z0-9_-]{43}$' or p_nonce!~'^[0-9a-f]{64}$' or length(p_sealed)>32768 then raise exception 'BROKER_INPUT';end if;
 delete from divzplit_security.google_provisions where google_subject in(select google_subject from divzplit_security.google_provisions where expires_at<clock_timestamp() limit 100);
 -- Wipe sensitive expired contexts; no raw credentials are stored here.
 update divzplit_security.google_flows set sealed_context=null,phase='failed' where id in(select id from divzplit_security.google_flows where (expires_at<clock_timestamp() or completion_expires_at<clock_timestamp()) and sealed_context is not null limit 100);
 delete from divzplit_security.google_flows where id in(select id from divzplit_security.google_flows where expires_at<clock_timestamp()-interval '1 day' limit 100);
 insert into divzplit_security.google_flows(id,state_digest,app_challenge,return_to,nonce_digest,sealed_context,expires_at,phase)
 values(p_id,p_state,p_challenge,p_return,p_nonce,p_sealed,clock_timestamp()+interval '10 minutes','pending');
end $$;

create or replace function public.divzplit_google_flow_prepare(p_id uuid,p_state text,p_challenge text,p_return text,p_nonce text,p_sealed text,p_ticket text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_ticket is null or p_ticket!~'^[0-9a-f]{64}$' then raise exception 'BROKER_INPUT';end if;
 perform public.divzplit_google_flow_start(p_id,p_state,p_challenge,p_return,p_nonce,p_sealed);
 update divzplit_security.google_flows set phase='prepared',launch_digest=p_ticket,launch_expires_at=clock_timestamp()+interval '2 minutes',expires_at=clock_timestamp()+interval '2 minutes' where id=p_id;
end $$;
create or replace function public.divzplit_google_launch_claim(p_ticket text,p_challenge text,p_return text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare f divzplit_security.google_flows;
begin
 if not public.divzplit_google_broker_ready() then raise exception 'BROKER_NOT_READY';end if;
 update divzplit_security.google_flows set phase='pending',launch_digest=null,expires_at=clock_timestamp()+interval '10 minutes'
 where launch_digest=p_ticket and phase='prepared' and app_challenge=p_challenge and return_to=p_return and launch_expires_at>clock_timestamp() returning * into f;
 if f.id is null then raise exception 'BROKER_LAUNCH';end if;
 return jsonb_build_object('id',f.id,'returnTo',f.return_to,'nonceDigest',f.nonce_digest,'sealed',f.sealed_context);
end $$;

create or replace function public.divzplit_google_callback_claim(p_state text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare f divzplit_security.google_flows;
begin
 if not public.divzplit_google_broker_ready() then raise exception 'BROKER_NOT_READY';end if;
 update divzplit_security.google_flows set phase='callback_claimed' where state_digest=p_state and phase='pending' and expires_at>clock_timestamp() returning * into f;
 if f.id is null then raise exception 'BROKER_STATE';end if;
 return jsonb_build_object('id',f.id,'returnTo',f.return_to,'nonceDigest',f.nonce_digest,'sealed',f.sealed_context);
end $$;

create or replace function public.divzplit_google_callback_ready(p_id uuid,p_subject text,p_email text,p_sealed text,p_completion text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if length(p_subject) not between 1 and 255 or length(p_email) not between 3 and 254 or p_completion!~'^[0-9a-f]{64}$' or length(p_sealed)>32768 then raise exception 'BROKER_INPUT';end if;
 update divzplit_security.google_flows set phase='ready',google_subject=p_subject,verified_email=p_email,sealed_context=p_sealed,completion_digest=p_completion,completion_expires_at=least(expires_at,clock_timestamp()+interval '90 seconds')
 where id=p_id and phase='callback_claimed' and expires_at>clock_timestamp();
 if not found then raise exception 'BROKER_STATE';end if;
end $$;

drop function if exists public.divzplit_google_completion_claim(text,text,text);
create or replace function public.divzplit_google_completion_claim(p_code text,p_challenge text,p_return text,p_flow uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare f divzplit_security.google_flows;
begin
 if not public.divzplit_google_broker_ready() then raise exception 'BROKER_NOT_READY';end if;
 update divzplit_security.google_flows set phase='completion_claimed',completion_digest=null
 where id=p_flow and completion_digest=p_code and app_challenge=p_challenge and return_to=p_return and phase='ready' and completion_expires_at>clock_timestamp() and expires_at>clock_timestamp() returning * into f;
 if f.id is null then raise exception 'BROKER_COMPLETION';end if;
 return jsonb_build_object('id',f.id,'nonceDigest',f.nonce_digest,'sealed',f.sealed_context,'subject',f.google_subject,'email',f.verified_email);
end $$;

drop function if exists public.divzplit_google_authorize_provision(uuid,uuid);
create or replace function public.divzplit_google_authorize_provision(p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare f divzplit_security.google_flows; target uuid; fresh boolean:=false;
begin
 if not public.divzplit_google_broker_ready() then raise exception 'BROKER_NOT_READY';end if;
 select * into f from divzplit_security.google_flows where id=p_id for update;
 if f.id is null or f.phase<>'completion_claimed' or f.completion_expires_at<=clock_timestamp() then raise exception 'BROKER_AUTHORIZATION';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('divzplit-google:'||f.google_subject,0));
 -- Existing identity is authoritative. Email lookup only selects a candidate for
 -- Supabase's normal ID-token linking policy; never update/confirm that account.
 select user_id into target from auth.identities where provider='google' and provider_id=f.google_subject limit 1;
 if target is null then select id into target from auth.users where lower(email)=lower(f.verified_email) and aud='authenticated' and coalesce(is_sso_user,false)=false limit 1;end if;
 if target is null then
  select user_id into target from divzplit_security.google_provisions where google_subject=f.google_subject and email=f.verified_email and expires_at>clock_timestamp() for update;
  -- Rotate an old lease after account deletion/email change, never resurrect it.
  if target is not null and exists(select from auth.users where id=target and coalesce(lower(email),'')<>lower(f.verified_email)) then target:=null;end if;
  if target is null then
   target:=gen_random_uuid();
   insert into divzplit_security.google_provisions(google_subject,email,user_id,expires_at) values(f.google_subject,f.verified_email,target,clock_timestamp()+interval '10 minutes')
   on conflict(google_subject) do update set email=excluded.email,user_id=excluded.user_id,expires_at=excluded.expires_at;
  end if;
  fresh:=true;
 end if;
 update divzplit_security.google_flows set phase='authorizing',target_user_id=target,authorization_consumed_at=clock_timestamp() where id=p_id;
 return jsonb_build_object('userId',target,'create',fresh);
end $$;

create or replace function public.divzplit_google_flow_finish(p_id uuid,p_success boolean default false)
returns void language sql security definer set search_path='' as $$
 update divzplit_security.google_flows set sealed_context=null,phase=case when phase in ('done','failed') then phase when p_success then 'done' else 'failed' end,completion_digest=null where id=p_id;
$$;

revoke all on function public.divzplit_google_broker_ready(),public.divzplit_google_flow_start(uuid,text,text,text,text,text),public.divzplit_google_flow_prepare(uuid,text,text,text,text,text,text),public.divzplit_google_launch_claim(text,text,text),public.divzplit_google_callback_claim(text),public.divzplit_google_callback_ready(uuid,text,text,text,text),public.divzplit_google_completion_claim(text,text,text,uuid),public.divzplit_google_authorize_provision(uuid),public.divzplit_google_flow_finish(uuid,boolean) from public,anon,authenticated;
grant execute on function public.divzplit_google_broker_ready(),public.divzplit_google_flow_start(uuid,text,text,text,text,text),public.divzplit_google_flow_prepare(uuid,text,text,text,text,text,text),public.divzplit_google_launch_claim(text,text,text),public.divzplit_google_callback_claim(text),public.divzplit_google_callback_ready(uuid,text,text,text,text),public.divzplit_google_completion_claim(text,text,text,uuid),public.divzplit_google_authorize_provision(uuid),public.divzplit_google_flow_finish(uuid,boolean) to service_role;
commit;
