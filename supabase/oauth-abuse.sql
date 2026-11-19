-- MANUAL INSTALL ONLY. Does NOT enable an Auth Hook or CAPTCHA setting.
-- Preflight verification alone cannot stop direct Supabase OAuth signup.
begin;
create schema if not exists divzplit_security;
revoke all on schema divzplit_security from public,anon,authenticated;
create table if not exists divzplit_security.turnstile_tokens(
 digest text primary key check(digest~'^[0-9a-f]{64}$'),
 expires_at timestamptz not null
);
create table if not exists divzplit_security.turnstile_flow_limits(
 digest text not null check(digest~'^[0-9a-f]{64}$'),
 window_start timestamptz not null,
 attempts integer not null,
 primary key(digest,window_start)
);
create table if not exists divzplit_security.oauth_policy(
 id boolean primary key default true check(id),
 mode text not null check(mode in ('observe','block_new_google'))
);
insert into divzplit_security.oauth_policy(id,mode) values(true,'observe') on conflict(id) do nothing;
revoke all on all tables in schema divzplit_security from public,anon,authenticated;
alter table divzplit_security.turnstile_tokens enable row level security;
alter table divzplit_security.turnstile_flow_limits enable row level security;
alter table divzplit_security.oauth_policy enable row level security;

create or replace function public.divzplit_turnstile_reserve(p_token_digest text,p_flow_digest text)
returns text language plpgsql security definer set search_path='' as $$
declare n integer; stamp timestamptz:=clock_timestamp();
begin
 if p_token_digest is null or p_token_digest!~'^[0-9a-f]{64}$' or p_flow_digest is null or p_flow_digest!~'^[0-9a-f]{64}$' then raise exception 'Invalid preflight digest';end if;
 -- Bounded cleanup; only token/flow hashes, never raw tokens, identities or IPs.
 delete from divzplit_security.turnstile_tokens where digest in(select digest from divzplit_security.turnstile_tokens where expires_at<stamp limit 100);
 delete from divzplit_security.turnstile_flow_limits where (digest,window_start) in(select digest,window_start from divzplit_security.turnstile_flow_limits where window_start<stamp-interval '10 minutes' limit 100);
 insert into divzplit_security.turnstile_flow_limits(digest,window_start,attempts)
 values(p_flow_digest,date_trunc('minute',stamp),1)
 on conflict(digest,window_start) do update set attempts=least(divzplit_security.turnstile_flow_limits.attempts+1,1000)
 returning attempts into n;
 if n>6 then return 'rate_limited';end if;
 insert into divzplit_security.turnstile_tokens(digest,expires_at) values(p_token_digest,stamp+interval '6 minutes') on conflict do nothing;
 if not found then return 'replay';end if;
 return 'reserved';
end $$;
revoke all on function public.divzplit_turnstile_reserve(text,text) from public,anon,authenticated;
grant execute on function public.divzplit_turnstile_reserve(text,text) to service_role;

-- Optional Before User Created POSTGRES hook. It is deliberately NOT registered
-- in config.toml. Manual activation/mode changes must follow the staging checklist.
-- No claim is made that this can consume a CAPTCHA grant tied to an OAuth flow.
create or replace function public.divzplit_before_user_created(event jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare policy text; provider text;
begin
 if coalesce(jsonb_typeof(event),'null')<>'object' or coalesce(jsonb_typeof(event->'user'),'null')<>'object' or coalesce(jsonb_typeof(event#>'{user,app_metadata}'),'null')<>'object' or coalesce(jsonb_typeof(event#>'{user,app_metadata,provider}'),'null')<>'string' then
  return jsonb_build_object('error',jsonb_build_object('http_code',400,'message','Invalid signup event.'));
 end if;
 -- app_metadata.provider is set by Supabase Auth after provider verification.
 -- Do not read user_metadata, email, IP, cookies, redirect params or client flags.
 provider:=event#>>'{user,app_metadata,provider}';
 select mode into policy from divzplit_security.oauth_policy where id;
 if policy is null then return jsonb_build_object('error',jsonb_build_object('http_code',503,'message','Signup policy unavailable.'));end if;
 if provider='google' then
  if policy='block_new_google' then
   raise log 'divzplit_oauth_policy provider=google decision=block_new';
   return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','New Google registration is temporarily unavailable. Existing users can still sign in.'));
  end if;
  raise log 'divzplit_oauth_policy provider=google decision=observe';
 end if;
 return '{}'::jsonb;
end $$;
revoke all on function public.divzplit_before_user_created(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.divzplit_before_user_created(jsonb) to supabase_auth_admin;
commit;
