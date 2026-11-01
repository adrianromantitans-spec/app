-- Run once in the Supabase SQL editor of your own project.
-- No credentials belong in this file. The migration is transactional.
begin;

create table if not exists public.nexo_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  document jsonb not null,
  version bigint not null default 1,
  created_at timestamptz not null default now()
);
create table if not exists public.nexo_members (
  group_id uuid not null references public.nexo_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  primary key (group_id,user_id)
);
create index if not exists nexo_members_user on public.nexo_members(user_id);
create table if not exists public.nexo_invites (
  token_hash text primary key,
  group_id uuid not null references public.nexo_groups(id) on delete cascade,
  expires_at timestamptz not null,
  uses integer not null default 0,
  max_uses integer not null default 20,
  revoked boolean not null default false
);
create index if not exists nexo_invites_group on public.nexo_invites(group_id);

alter table public.nexo_groups enable row level security;
alter table public.nexo_members enable row level security;
alter table public.nexo_invites enable row level security;
revoke all on public.nexo_groups, public.nexo_members, public.nexo_invites from anon, authenticated;
grant select on public.nexo_groups, public.nexo_members to authenticated;

create or replace function public.nexo_is_member(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.nexo_members where group_id=p_id and user_id=auth.uid());
$$;
drop policy if exists nexo_group_read on public.nexo_groups;
create policy nexo_group_read on public.nexo_groups for select to authenticated
using (public.nexo_is_member(id));
drop policy if exists nexo_member_read on public.nexo_members;
create policy nexo_member_read on public.nexo_members for select to authenticated
using (public.nexo_is_member(group_id));

create or replace function public.nexo_member_document() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id',u.id::text,
    'name',coalesce(nullif(left(trim(u.raw_user_meta_data->>'display_name'),40),''),'Miembro'),
    'initials',upper(left(coalesce(nullif(trim(u.raw_user_meta_data->>'display_name'),''),'ME'),2)),
    'color','purple'
  ) from auth.users u where u.id=auth.uid();
$$;

create or replace function public.nexo_assert_document(d jsonb) returns void
language plpgsql set search_path = '' as $$
declare
  ids text[]; e jsonb; p jsonb; t jsonb; m jsonb; o jsonb; k text; v text;
  collection text; split_sum numeric;
begin
  if d?'currency' and (jsonb_typeof(d->'currency') is distinct from 'string' or (d->>'currency' in ('EUR','RON')) is not true) then
    raise exception 'NEXO_CURRENCY';
  end if;
  if jsonb_typeof(d) is distinct from 'object' or octet_length(d::text)>250000 then
    raise exception using errcode='22023',message='Invalid group document';
  end if;
  if jsonb_typeof(d->'name') is distinct from 'string' or length(trim(d->>'name')) not between 1 and 60
     or jsonb_typeof(d->'place') is distinct from 'string' or length(d->>'place')>80
     or jsonb_typeof(d->'emoji') is distinct from 'string' or length(d->>'emoji')>10
     or (d->>'type' in ('Viaje','Convivencia','Pareja','Plan con amigos')) is not true
     or jsonb_typeof(d->'budget') is distinct from 'number'
     or ((d->>'budget') ~ '^[0-9]+$') is not true
     or (d->>'budget')::numeric not between 100 and 1000000000 then
    raise exception using errcode='22023',message='Invalid group fields';
  end if;
  foreach k in array array['date','endDate'] loop
    if jsonb_typeof(d->k) is distinct from 'string' then
      raise exception using errcode='22023',message='Invalid date';
    end if;
    if d->>k<>'' then
      if (d->>k ~ '^\d{4}-\d{2}-\d{2}$') is not true then
        raise exception using errcode='22023',message='Invalid date';
      end if;
      perform (d->>k)::date;
    end if;
  end loop;
  if d->>'endDate'<>'' and (d->>'date'='' or d->>'endDate'<d->>'date') then
    raise exception using errcode='22023',message='Invalid date range';
  end if;
  foreach collection in array array['members','expenses','payments','polls','tasks'] loop
    if jsonb_typeof(d->collection) is distinct from 'array' then
      raise exception using errcode='22023',message='Invalid collection';
    end if;
    if exists(select 1 from jsonb_array_elements(d->collection) x where
      jsonb_typeof(x->'id') is distinct from 'string' or length(x->>'id') not between 1 and 80)
      or (select count(*) from jsonb_array_elements(d->collection)) <>
         (select count(distinct x->>'id') from jsonb_array_elements(d->collection) x) then
      raise exception using errcode='22023',message='Duplicate or invalid identifiers';
    end if;
  end loop;
  if jsonb_array_length(d->'members') not between 1 and 50
     or jsonb_array_length(d->'expenses')>1000 or jsonb_array_length(d->'payments')>1000
     or jsonb_array_length(d->'polls')>100 or jsonb_array_length(d->'tasks')>500 then
    raise exception using errcode='22023',message='Group capacity exceeded';
  end if;
  select array_agg(x->>'id') into ids from jsonb_array_elements(d->'members') x;
  for e in select * from jsonb_array_elements(d->'expenses') loop
    if jsonb_typeof(e->'title') is distinct from 'string' or length(trim(e->>'title')) not between 1 and 100
      or ((e->>'payer')=any(ids)) is not true
      or ((e->>'createdBy')=any(ids)) is not true
      or jsonb_typeof(e->'amount') is distinct from 'number' or ((e->>'amount') ~ '^[0-9]+$') is not true
      or (e->>'amount')::numeric not between 1 and 100000000
      or jsonb_typeof(e->'participants') is distinct from 'array'
      or (e->>'category' in ('Comida','Alojamiento','Transporte','Actividades','Otros')) is not true
      or jsonb_typeof(e->'date') is distinct from 'string' or ((e->>'date') ~ '^\d{4}-\d{2}-\d{2}$') is not true then
      raise exception using errcode='22023',message='Invalid expense';
    end if;
    perform (e->>'date')::date;
    if jsonb_array_length(e->'participants') not between 1 and 50
      or exists(select 1 from jsonb_array_elements_text(e->'participants') id where (id=any(ids)) is not true)
      or jsonb_array_length(e->'participants')<>(select count(distinct id) from jsonb_array_elements_text(e->'participants') id) then
      raise exception using errcode='22023',message='Invalid expense participants';
    end if;
    if e?'split' then
      if jsonb_typeof(e->'split') is distinct from 'object'
        or (e->'split'->>'mode' in ('amounts','percent','shares')) is not true
        or jsonb_typeof(e->'split'->'values') is distinct from 'object' then raise exception 'NEXO_SPLIT'; end if;
      if (select count(*) from jsonb_object_keys(e->'split'->'values'))<>jsonb_array_length(e->'participants')
        or exists(select 1 from jsonb_object_keys(e->'split'->'values') key where not (e->'participants' ? key)) then
        raise exception 'NEXO_SPLIT';
      end if;
      split_sum:=0;
      for k,v in select * from jsonb_each_text(e->'split'->'values') loop
        if jsonb_typeof(e->'split'->'values'->k) is distinct from 'number' or (v ~ '^[0-9]+$') is not true then raise exception 'NEXO_SPLIT'; end if;
        if v::numeric>100000000
          or (e->'split'->>'mode'='percent' and v::numeric>10000)
          or (e->'split'->>'mode'='shares' and v::numeric not between 1 and 1000000) then raise exception 'NEXO_SPLIT'; end if;
        split_sum:=split_sum+v::numeric;
      end loop;
      if (e->'split'->>'mode'='amounts' and split_sum<>(e->>'amount')::numeric)
        or (e->'split'->>'mode'='percent' and split_sum<>10000) then raise exception 'NEXO_SPLIT'; end if;
    end if;
  end loop;
  for t in select * from jsonb_array_elements(d->'tasks') loop
    if jsonb_typeof(t->'title') is distinct from 'string' or length(trim(t->>'title')) not between 1 and 120
      or ((t->>'assignee')=any(ids)) is not true or jsonb_typeof(t->'done') is distinct from 'boolean' then
      raise exception using errcode='22023',message='Invalid task';
    end if;
  end loop;
  for p in select * from jsonb_array_elements(d->'payments') loop
    if ((p->>'from')=any(ids)) is not true or ((p->>'to')=any(ids)) is not true
      or p->>'from'=p->>'to' or jsonb_typeof(p->'amount') is distinct from 'number'
      or ((p->>'amount') ~ '^[0-9]+$') is not true or (p->>'amount')::numeric not between 1 and 1000000000
      or jsonb_typeof(p->'date') is distinct from 'string' or ((p->>'date') ~ '^\d{4}-\d{2}-\d{2}$') is not true then
      raise exception using errcode='22023',message='Invalid payment';
    end if;
    perform (p->>'date')::date;
  end loop;
  for p in select * from jsonb_array_elements(d->'polls') loop
    if jsonb_typeof(p->'title') is distinct from 'string' or length(trim(p->>'title')) not between 1 and 120
      or jsonb_typeof(p->'description') is distinct from 'string' or length(p->>'description')>160
      or jsonb_typeof(p->'options') is distinct from 'array' or jsonb_typeof(p->'votes') is distinct from 'object' then
      raise exception using errcode='22023',message='Invalid poll';
    end if;
    if jsonb_array_length(p->'options') not between 2 and 6
      or jsonb_array_length(p->'options')<>(select count(distinct x->>'id') from jsonb_array_elements(p->'options') x) then
      raise exception using errcode='22023',message='Invalid poll options';
    end if;
    for o in select * from jsonb_array_elements(p->'options') loop
      if jsonb_typeof(o->'id') is distinct from 'string' or length(o->>'id') not between 1 and 80
        or jsonb_typeof(o->'label') is distinct from 'string' or length(trim(o->>'label')) not between 1 and 100 then
        raise exception using errcode='22023',message='Invalid poll option';
      end if;
    end loop;
    for k,v in select * from jsonb_each_text(p->'votes') loop
      if (k=any(ids)) is not true or not exists(select 1 from jsonb_array_elements(p->'options') x where x->>'id'=v) then
        raise exception using errcode='22023',message='Invalid vote';
      end if;
    end loop;
  end loop;
end;
$$;

create or replace function public.nexo_create_group(p_fields jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g public.nexo_groups; actor uuid:=auth.uid(); d jsonb;
  gid uuid:=coalesce(nullif(p_fields->>'requestId','')::uuid,gen_random_uuid());
begin
  if actor is null then raise exception 'NEXO_FORBIDDEN'; end if;
  -- Serialize this owner's creates and make retries of the same form idempotent.
  perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
  if to_regclass('public.nexo_deleted_groups') is not null then
    if exists(select 1 from public.nexo_deleted_groups where id=gid) then raise exception 'NEXO_FORBIDDEN'; end if;
  end if;
  select * into g from public.nexo_groups where id=gid;
  if found then
    if g.owner_id<>actor then raise exception 'NEXO_FORBIDDEN'; end if;
    return to_jsonb(g);
  end if;
  if (select count(*) from public.nexo_groups where owner_id=actor)>=30 then
    raise exception using errcode='22023',message='Too many groups';
  end if;
  d=jsonb_build_object('id',gid::text,'name',p_fields->>'name','emoji',p_fields->>'emoji',
    'type',p_fields->>'type','place',coalesce(p_fields->>'place',''),'date',coalesce(p_fields->>'date',''),
    'endDate',coalesce(p_fields->>'endDate',''),'budget',p_fields->'budget',
    'currency',coalesce(p_fields->>'currency','EUR'),
    'members',jsonb_build_array(public.nexo_member_document()),'expenses','[]'::jsonb,
    'payments','[]'::jsonb,'tasks','[]'::jsonb,'polls','[]'::jsonb);
  perform public.nexo_assert_document(d);
  insert into public.nexo_groups(id,owner_id,document) values(gid,actor,d) returning * into g;
  insert into public.nexo_members values(gid,actor);
  return to_jsonb(g);
end;
$$;

create or replace function public.nexo_save_group(p_id uuid,p_version bigint,p_document jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g public.nexo_groups; actor text:=auth.uid()::text; previous jsonb; current_item jsonb; k text;
begin
  if not public.nexo_is_member(p_id) then raise exception 'NEXO_FORBIDDEN'; end if;
  select * into g from public.nexo_groups where id=p_id for update;
  if g.version<>p_version then raise exception 'NEXO_CONFLICT'; end if;
  if coalesce(p_document->>'currency','EUR') is distinct from coalesce(g.document->>'currency','EUR') then
    if actor<>g.owner_id::text then raise exception 'NEXO_OWNER'; end if;
    if jsonb_array_length(g.document->'expenses')>0 or jsonb_array_length(g.document->'payments')>0 then
      raise exception 'NEXO_CURRENCY_LOCKED';
    end if;
  end if;
  perform public.nexo_assert_document(p_document);
  if p_document->'members' is distinct from g.document->'members'
    or p_document->>'id' is distinct from p_id::text then raise exception 'NEXO_FORBIDDEN'; end if;
  if actor<>g.owner_id::text then
    foreach k in array array['name','emoji','type','place','date','endDate','budget'] loop
      if p_document->k is distinct from g.document->k then raise exception 'NEXO_OWNER'; end if;
    end loop;
  end if;
  -- Votes belong to their voter. Existing poll questions/options are immutable.
  for previous in select * from jsonb_array_elements(g.document->'polls') loop
    select x into current_item from jsonb_array_elements(p_document->'polls') x where x->>'id'=previous->>'id';
    if current_item is null or (current_item-'votes') is distinct from (previous-'votes')
      or ((current_item->'votes')-actor) is distinct from ((previous->'votes')-actor) then
      raise exception 'NEXO_FORBIDDEN';
    end if;
  end loop;
  for current_item in select * from jsonb_array_elements(p_document->'polls') loop
    if not exists(select 1 from jsonb_array_elements(g.document->'polls') x where x->>'id'=current_item->>'id')
      and ((current_item->'votes')-actor)<>'{}'::jsonb then raise exception 'NEXO_FORBIDDEN'; end if;
  end loop;
  -- A member may add expenses, but only their author or the owner can alter/remove them.
  for previous in select * from jsonb_array_elements(g.document->'expenses') loop
    select x into current_item from jsonb_array_elements(p_document->'expenses') x where x->>'id'=previous->>'id';
    if current_item is distinct from previous and actor<>g.owner_id::text and actor<>previous->>'createdBy' then
      raise exception 'NEXO_FORBIDDEN';
    end if;
    if current_item is not null and current_item->>'createdBy' is distinct from previous->>'createdBy' then
      raise exception 'NEXO_FORBIDDEN';
    end if;
  end loop;
  for current_item in select * from jsonb_array_elements(p_document->'expenses') loop
    if not exists(select 1 from jsonb_array_elements(g.document->'expenses') x where x->>'id'=current_item->>'id')
      and current_item->>'createdBy' is distinct from actor then raise exception 'NEXO_FORBIDDEN'; end if;
  end loop;
  -- Recorded payments are append-only and can be confirmed only by either party.
  for previous in select * from jsonb_array_elements(g.document->'payments') loop
    if not exists(select 1 from jsonb_array_elements(p_document->'payments') x where x=previous) then
      raise exception 'NEXO_FORBIDDEN';
    end if;
  end loop;
  for current_item in select * from jsonb_array_elements(p_document->'payments') loop
    if not exists(select 1 from jsonb_array_elements(g.document->'payments') x where x->>'id'=current_item->>'id')
      and actor<>current_item->>'from' and actor<>current_item->>'to' then raise exception 'NEXO_FORBIDDEN'; end if;
  end loop;
  update public.nexo_groups set document=p_document,version=version+1 where id=p_id returning * into g;
  return to_jsonb(g);
end;
$$;

create or replace function public.nexo_create_invite(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g public.nexo_groups; token text; expiry timestamptz:=now()+interval '7 days';
begin
  select * into g from public.nexo_groups where id=p_id for update;
  if g.owner_id is distinct from auth.uid() or auth.uid() is null then raise exception 'NEXO_OWNER'; end if;
  token=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
  update public.nexo_invites set revoked=true where group_id=p_id;
  insert into public.nexo_invites(token_hash,group_id,expires_at)
    values(encode(sha256(convert_to(token,'UTF8')),'hex'),p_id,expiry);
  return jsonb_build_object('token',token,'expires_at',expiry);
end;
$$;
create or replace function public.nexo_revoke_invites(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare owner uuid;
begin
  select owner_id into owner from public.nexo_groups where id=p_id for update;
  if owner is distinct from auth.uid() or auth.uid() is null then raise exception 'NEXO_OWNER'; end if;
  update public.nexo_invites set revoked=true where group_id=p_id;
end;
$$;

create or replace function public.nexo_join_group(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare invitation public.nexo_invites; g public.nexo_groups; gid uuid; actor uuid:=auth.uid(); hashed text;
begin
  if actor is null then raise exception 'NEXO_FORBIDDEN'; end if;
  if (p_token ~ '^[0-9a-f]{64}$') is not true then raise exception 'NEXO_INVITE'; end if;
  hashed=encode(sha256(convert_to(p_token,'UTF8')),'hex');
  select group_id into gid from public.nexo_invites where token_hash=hashed;
  if gid is null then raise exception 'NEXO_INVITE'; end if;
  -- Always lock the group first, like save/create/revoke, to avoid deadlocks.
  select * into g from public.nexo_groups where id=gid for update;
  select * into invitation from public.nexo_invites where token_hash=hashed for update;
  if invitation.revoked or invitation.expires_at<=now() or invitation.uses>=invitation.max_uses then
    raise exception 'NEXO_INVITE';
  end if;
  if public.nexo_is_member(gid) then return to_jsonb(g); end if;
  if jsonb_array_length(g.document->'members')>=50 then raise exception 'NEXO_INVITE'; end if;
  insert into public.nexo_members values(gid,actor);
  update public.nexo_groups set
    document=jsonb_set(document,'{members}',(document->'members')||jsonb_build_array(public.nexo_member_document())),
    version=version+1 where id=gid returning * into g;
  update public.nexo_invites set uses=uses+1 where token_hash=hashed;
  return to_jsonb(g);
end;
$$;

create or replace function public.divzplit_currency_support() returns boolean
language sql stable as $$select true;$$;
revoke all on function public.divzplit_currency_support() from public,anon;
grant execute on function public.divzplit_currency_support() to authenticated;


-- Only identifiers are retained for idempotent deletion and private-file cleanup.
create table if not exists public.nexo_deleted_groups (
 id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade,
 deleted_at timestamptz not null default now(), cleaned_at timestamptz
);
alter table public.nexo_deleted_groups enable row level security;
revoke all on public.nexo_deleted_groups from public,anon,authenticated;
grant select on public.nexo_deleted_groups to authenticated;
drop policy if exists nexo_deleted_groups_owner on public.nexo_deleted_groups;
create policy nexo_deleted_groups_owner on public.nexo_deleted_groups for select to authenticated using(owner_id=auth.uid());

create or replace function public.divzplit_deleted_receipt_access(object_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.nexo_deleted_groups d where d.id::text=split_part(object_name,'/',1)
 and d.owner_id=auth.uid() and d.cleaned_at is null
 and not exists(select 1 from public.nexo_groups g where g.id=d.id));
$$;
revoke all on function public.divzplit_deleted_receipt_access(text) from public,anon;
grant execute on function public.divzplit_deleted_receipt_access(text) to authenticated;

do $policy$ begin
 if to_regclass('storage.objects') is not null then
  execute 'drop policy if exists divzplit_deleted_receipt_read on storage.objects';
  execute 'create policy divzplit_deleted_receipt_read on storage.objects for select to authenticated using(bucket_id=''divzplit-receipts'' and public.divzplit_deleted_receipt_access(name))';
  execute 'drop policy if exists divzplit_deleted_receipt_remove on storage.objects';
  execute 'create policy divzplit_deleted_receipt_remove on storage.objects for delete to authenticated using(bucket_id=''divzplit-receipts'' and public.divzplit_deleted_receipt_access(name))';
 end if;
end $policy$;

create or replace function public.nexo_delete_group(p_id uuid,p_version bigint) returns boolean
language plpgsql security definer set search_path='' as $$
declare g public.nexo_groups; actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'NEXO_FORBIDDEN'; end if;
 select * into g from public.nexo_groups where id=p_id for update;
 if not found then
  if exists(select 1 from public.nexo_deleted_groups where id=p_id and owner_id=actor) then return true; end if;
  raise exception 'NEXO_FORBIDDEN';
 end if;
 if g.owner_id<>actor then raise exception 'NEXO_OWNER'; end if;
 if g.version<>p_version then raise exception 'NEXO_CONFLICT'; end if;
 insert into public.nexo_deleted_groups(id,owner_id) values(p_id,actor);
 delete from public.nexo_groups where id=p_id;
 return true;
end;
$$;
revoke all on function public.nexo_delete_group(uuid,bigint) from public,anon;
grant execute on function public.nexo_delete_group(uuid,bigint) to authenticated;

create or replace function public.divzplit_finish_group_cleanup(p_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.nexo_deleted_groups where id=p_id and owner_id=auth.uid()) then raise exception 'NEXO_FORBIDDEN'; end if;
 if exists(select 1 from public.nexo_groups where id=p_id) then raise exception 'NEXO_FORBIDDEN'; end if;
 if to_regclass('storage.objects') is not null then
  if exists(select 1 from storage.objects where bucket_id='divzplit-receipts' and name like p_id::text||'/%') then return false; end if;
 end if;
 update public.nexo_deleted_groups set cleaned_at=now() where id=p_id and owner_id=auth.uid();
 return true;
end;
$$;
revoke all on function public.divzplit_finish_group_cleanup(uuid) from public,anon;
grant execute on function public.divzplit_finish_group_cleanup(uuid) to authenticated;

create or replace function public.divzplit_expense_tools_support() returns boolean language sql stable as $$select true;$$;
revoke all on function public.divzplit_expense_tools_support() from public,anon;
grant execute on function public.divzplit_expense_tools_support() to authenticated;

-- Functions default to PUBLIC execute in PostgreSQL: remove it explicitly.
revoke all on function public.nexo_is_member(uuid), public.nexo_member_document(),
  public.nexo_assert_document(jsonb),public.nexo_create_group(jsonb),
  public.nexo_save_group(uuid,bigint,jsonb),public.nexo_create_invite(uuid),
  public.nexo_revoke_invites(uuid),public.nexo_join_group(text) from public,anon,authenticated;
grant execute on function public.nexo_is_member(uuid),public.nexo_create_group(jsonb),
  public.nexo_save_group(uuid,bigint,jsonb),public.nexo_create_invite(uuid),
  public.nexo_revoke_invites(uuid),public.nexo_join_group(text) to authenticated;


-- Confirmed repayments and server-generated history.

create table if not exists public.divzplit_history (
 id uuid primary key default gen_random_uuid(),
 group_id uuid not null references public.nexo_groups(id) on delete cascade,
 actor_id uuid, actor_name text not null,
 kind text not null, entity_id text not null,
 before_data jsonb, after_data jsonb,
 currency text not null, created_at timestamptz not null default clock_timestamp()
);
create index if not exists divzplit_history_group on public.divzplit_history(group_id,created_at desc,id desc);
create table if not exists public.divzplit_payment_requests (
 id uuid primary key,
 group_id uuid not null references public.nexo_groups(id) on delete cascade,
 from_id uuid not null references auth.users(id), to_id uuid not null references auth.users(id),
 amount bigint not null check(amount between 1 and 1000000000),
 currency text not null check(currency in ('EUR','RON')),
 status text not null default 'pending' check(status in ('pending','confirmed','rejected','cancelled')),
 created_at timestamptz not null default clock_timestamp(), resolved_at timestamptz,
 check(from_id<>to_id)
);
create index if not exists divzplit_pending_group on public.divzplit_payment_requests(group_id,status);
alter table public.divzplit_history enable row level security;
alter table public.divzplit_payment_requests enable row level security;
revoke all on public.divzplit_history,public.divzplit_payment_requests from public,anon,authenticated;
grant select on public.divzplit_history,public.divzplit_payment_requests to authenticated;
drop policy if exists divzplit_history_read on public.divzplit_history;
create policy divzplit_history_read on public.divzplit_history for select to authenticated using(public.nexo_is_member(group_id));
drop policy if exists divzplit_requests_read on public.divzplit_payment_requests;
create policy divzplit_requests_read on public.divzplit_payment_requests for select to authenticated using(public.nexo_is_member(group_id));

create or replace function public.divzplit_log(p_group uuid,p_kind text,p_entity text,p_before jsonb,p_after jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare d jsonb; actor uuid:=auth.uid(); actor_name text;
begin
 select document into d from public.nexo_groups where id=p_group;
 select m->>'name' into actor_name from jsonb_array_elements(d->'members') m where m->>'id'=actor::text;
 insert into public.divzplit_history(group_id,actor_id,actor_name,kind,entity_id,before_data,after_data,currency)
 values(p_group,actor,coalesce(actor_name,'Miembro'),p_kind,p_entity,p_before,p_after,coalesce(d->>'currency','EUR'));
end;
$$;
create or replace function public.divzplit_capture_history() returns trigger
language plpgsql security definer set search_path='' as $$
declare collection text; item record; before_fields jsonb; after_fields jsonb;
begin
 if TG_OP='INSERT' then
  perform public.divzplit_log(new.id,'group.created',new.id::text,null,jsonb_build_object('name',new.document->>'name'));
  return new;
 end if;
 if old.document is not distinct from new.document then return new; end if;
 select jsonb_object_agg(k,v) into before_fields from jsonb_each(old.document) x(k,v) where k in ('name','emoji','type','place','date','endDate','budget','currency');
 select jsonb_object_agg(k,v) into after_fields from jsonb_each(new.document) x(k,v) where k in ('name','emoji','type','place','date','endDate','budget','currency');
 if before_fields is distinct from after_fields then perform public.divzplit_log(new.id,'group.updated',new.id::text,before_fields,after_fields); end if;
 foreach collection in array array['expenses','payments','tasks','polls','members'] loop
  for item in
   select coalesce(a.x->>'id',b.x->>'id') as id,a.x as before_item,b.x as after_item
   from jsonb_array_elements(old.document->collection) a(x)
   full join jsonb_array_elements(new.document->collection) b(x) on a.x->>'id'=b.x->>'id'
   where a.x is distinct from b.x
  loop
   perform public.divzplit_log(new.id,collection||'.'||case when item.before_item is null then 'added' when item.after_item is null then 'deleted' else 'updated' end,item.id,item.before_item,item.after_item);
  end loop;
 end loop;
 return new;
end;
$$;
drop trigger if exists divzplit_history_capture on public.nexo_groups;
create trigger divzplit_history_capture after insert or update of document on public.nexo_groups for each row execute function public.divzplit_capture_history();

-- Exact cent allocation, including stable largest-remainder custom splits.
create or replace function public.divzplit_member_balance(d jsonb,p_member text) returns bigint
language plpgsql immutable set search_path='' as $$
declare e jsonb; p jsonb; result bigint:=0; share bigint; mode text; denominator numeric;
begin
 for e in select * from jsonb_array_elements(d->'expenses') loop
  if e->>'payer'=p_member then result:=result+(e->>'amount')::bigint; end if;
  if not (e->'participants') ? p_member then continue; end if;
  mode:=coalesce(e->'split'->>'mode','equal');
  if mode='amounts' then share:=(e->'split'->'values'->>p_member)::bigint;
  else
   select sum(case when mode='equal' then 1 else (e->'split'->'values'->>id)::numeric end)
   into denominator from jsonb_array_elements_text(e->'participants') x(id);
   with weights as (
    select id,ord,(e->>'amount')::numeric*case when mode='equal' then 1 else (e->'split'->'values'->>id)::numeric end as numerator
    from jsonb_array_elements_text(e->'participants') with ordinality x(id,ord)
   ), ranked as (
    select id,floor(numerator/denominator) as base,
     row_number() over(order by mod(numerator,denominator) desc,ord) as rank,
     sum(floor(numerator/denominator)) over() as allocated from weights
   ) select (base+case when rank <= (e->>'amount')::numeric-allocated then 1 else 0 end)::bigint into share from ranked where id=p_member;
  end if;
  result:=result-share;
 end loop;
 for p in select * from jsonb_array_elements(d->'payments') loop
  if p->>'from'=p_member then result:=result+(p->>'amount')::bigint; end if;
  if p->>'to'=p_member then result:=result-(p->>'amount')::bigint; end if;
 end loop;
 return result;
end;
$$;

create or replace function public.divzplit_request_payment(p_id uuid,p_version bigint,p_request_id uuid,p_to uuid,p_amount bigint,p_currency text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g public.nexo_groups; r public.divzplit_payment_requests; actor uuid:=auth.uid(); reserved_from bigint; reserved_to bigint;
begin
 if not public.nexo_is_member(p_id) then raise exception 'NEXO_FORBIDDEN'; end if;
 select * into g from public.nexo_groups where id=p_id for update;
 select * into r from public.divzplit_payment_requests where id=p_request_id;
 if found then
  if r.group_id<>p_id or r.from_id<>actor or r.to_id<>p_to or r.amount<>p_amount or r.currency<>p_currency then raise exception 'NEXO_FORBIDDEN'; end if;
  return to_jsonb(r);
 end if;
 if g.version<>p_version then raise exception 'NEXO_CONFLICT'; end if;
 if p_request_id is null or p_to is null or p_to=actor or p_amount is null or p_amount not between 1 and 1000000000 or p_currency is distinct from coalesce(g.document->>'currency','EUR') then raise exception 'NEXO_PAYMENT_CHANGED'; end if;
 if not exists(select 1 from public.nexo_members where group_id=p_id and user_id=p_to) then raise exception 'NEXO_FORBIDDEN'; end if;
 select coalesce(sum(amount) filter(where from_id=actor),0),coalesce(sum(amount) filter(where to_id=p_to),0)
 into reserved_from,reserved_to from public.divzplit_payment_requests where group_id=p_id and status='pending';
 if (select count(*) from public.divzplit_payment_requests where group_id=p_id and status='pending')>=100 then raise exception 'NEXO_PAYMENT_CHANGED'; end if;
 if p_amount>least(-public.divzplit_member_balance(g.document,actor::text)-reserved_from,public.divzplit_member_balance(g.document,p_to::text)-reserved_to) then raise exception 'NEXO_PAYMENT_CHANGED'; end if;
 insert into public.divzplit_payment_requests(id,group_id,from_id,to_id,amount,currency) values(p_request_id,p_id,actor,p_to,p_amount,p_currency) returning * into r;
 perform public.divzplit_log(p_id,'payment.requested',r.id::text,null,to_jsonb(r));
 return to_jsonb(r);
end;
$$;

create or replace function public.divzplit_respond_payment(p_id uuid,p_request_id uuid,p_action text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g public.nexo_groups; r public.divzplit_payment_requests; actor uuid:=auth.uid(); target_status text;
begin
 if not public.nexo_is_member(p_id) then raise exception 'NEXO_FORBIDDEN'; end if;
 select * into g from public.nexo_groups where id=p_id for update;
 select * into r from public.divzplit_payment_requests where id=p_request_id and group_id=p_id for update;
 if not found then raise exception 'NEXO_PAYMENT_CHANGED'; end if;
 if p_action in ('confirm','reject') then
  if actor<>r.to_id then raise exception 'NEXO_FORBIDDEN'; end if;
  target_status:=case when p_action='confirm' then 'confirmed' else 'rejected' end;
 elsif p_action='cancel' then
  if actor<>r.from_id then raise exception 'NEXO_FORBIDDEN'; end if;
  target_status:='cancelled';
 else raise exception 'NEXO_FORBIDDEN'; end if;
 if r.status=target_status then return to_jsonb(g); end if;
 if r.status<>'pending' then raise exception 'NEXO_PAYMENT_CHANGED'; end if;
 if p_action='confirm' then
  if r.currency is distinct from coalesce(g.document->>'currency','EUR') or r.amount>least(-public.divzplit_member_balance(g.document,r.from_id::text),public.divzplit_member_balance(g.document,r.to_id::text)) then raise exception 'NEXO_PAYMENT_CHANGED'; end if;
  update public.nexo_groups set document=jsonb_set(document,'{payments}',jsonb_build_array(jsonb_build_object('id',r.id::text,'from',r.from_id::text,'to',r.to_id::text,'amount',r.amount,'date',current_date::text))||(document->'payments')),version=version+1 where id=p_id returning * into g;
  perform public.nexo_assert_document(g.document);
 else
  perform public.divzplit_log(p_id,'payment.'||target_status,r.id::text,to_jsonb(r),to_jsonb(r)||jsonb_build_object('status',target_status));
 end if;
 update public.divzplit_payment_requests set status=target_status,resolved_at=clock_timestamp() where id=r.id;
 return to_jsonb(g);
end;
$$;
create or replace function public.divzplit_delete_history(p_id uuid,p_event_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare g public.nexo_groups;
begin
 select * into g from public.nexo_groups where id=p_id for update;
 if auth.uid() is null or g.owner_id is distinct from auth.uid() then raise exception 'NEXO_OWNER'; end if;
 delete from public.divzplit_history where group_id=p_id and id=p_event_id;
 return found;
end;
$$;
create or replace function public.nexo_save_group(p_id uuid,p_version bigint,p_document jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g public.nexo_groups; actor text:=auth.uid()::text; previous jsonb; current_item jsonb; k text;
begin
  if not public.nexo_is_member(p_id) then raise exception 'NEXO_FORBIDDEN'; end if;
  select * into g from public.nexo_groups where id=p_id for update;
  if g.version<>p_version then raise exception 'NEXO_CONFLICT'; end if;
  if coalesce(p_document->>'currency','EUR') is distinct from coalesce(g.document->>'currency','EUR') then
    if actor<>g.owner_id::text then raise exception 'NEXO_OWNER'; end if;
    if jsonb_array_length(g.document->'expenses')>0 or jsonb_array_length(g.document->'payments')>0 then
      raise exception 'NEXO_CURRENCY_LOCKED';
    end if;
  end if;
  perform public.nexo_assert_document(p_document);
  if p_document->'members' is distinct from g.document->'members'
    or p_document->>'id' is distinct from p_id::text then raise exception 'NEXO_FORBIDDEN'; end if;
  if actor<>g.owner_id::text then
    foreach k in array array['name','emoji','type','place','date','endDate','budget'] loop
      if p_document->k is distinct from g.document->k then raise exception 'NEXO_OWNER'; end if;
    end loop;
  end if;
  -- Votes belong to their voter. Existing poll questions/options are immutable.
  for previous in select * from jsonb_array_elements(g.document->'polls') loop
    select x into current_item from jsonb_array_elements(p_document->'polls') x where x->>'id'=previous->>'id';
    if current_item is null or (current_item-'votes') is distinct from (previous-'votes')
      or ((current_item->'votes')-actor) is distinct from ((previous->'votes')-actor) then
      raise exception 'NEXO_FORBIDDEN';
    end if;
  end loop;
  for current_item in select * from jsonb_array_elements(p_document->'polls') loop
    if not exists(select 1 from jsonb_array_elements(g.document->'polls') x where x->>'id'=current_item->>'id')
      and ((current_item->'votes')-actor)<>'{}'::jsonb then raise exception 'NEXO_FORBIDDEN'; end if;
  end loop;
  -- A member may add expenses, but only their author or the owner can alter/remove them.
  for previous in select * from jsonb_array_elements(g.document->'expenses') loop
    select x into current_item from jsonb_array_elements(p_document->'expenses') x where x->>'id'=previous->>'id';
    if current_item is distinct from previous and actor<>g.owner_id::text and actor<>previous->>'createdBy' then
      raise exception 'NEXO_FORBIDDEN';
    end if;
    if current_item is not null and current_item->>'createdBy' is distinct from previous->>'createdBy' then
      raise exception 'NEXO_FORBIDDEN';
    end if;
  end loop;
  for current_item in select * from jsonb_array_elements(p_document->'expenses') loop
    if not exists(select 1 from jsonb_array_elements(g.document->'expenses') x where x->>'id'=current_item->>'id')
      and current_item->>'createdBy' is distinct from actor then raise exception 'NEXO_FORBIDDEN'; end if;
  end loop;
  -- Repayments enter the document only through recipient confirmation.
  if p_document->'payments' is distinct from g.document->'payments' then
    raise exception 'NEXO_PAYMENT_FLOW';
  end if;
  update public.nexo_groups set document=p_document,version=version+1 where id=p_id returning * into g;
  return to_jsonb(g);
end;
$$;
create or replace function public.divzplit_collaboration_support() returns boolean language sql stable as $$select true;$$;
revoke all on function public.divzplit_log(uuid,text,text,jsonb,jsonb),public.divzplit_capture_history(),public.divzplit_member_balance(jsonb,text) from public,anon,authenticated;
revoke all on function public.divzplit_request_payment(uuid,bigint,uuid,uuid,bigint,text),public.divzplit_respond_payment(uuid,uuid,text),public.divzplit_delete_history(uuid,uuid),public.divzplit_collaboration_support() from public,anon,authenticated;
grant execute on function public.divzplit_request_payment(uuid,bigint,uuid,uuid,bigint,text),public.divzplit_respond_payment(uuid,uuid,text),public.divzplit_delete_history(uuid,uuid),public.divzplit_collaboration_support() to authenticated;
notify pgrst,'reload schema';


-- In-app notifications and optional Web Push.

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


-- Explicit bulk clears, preserving group finances and account preferences.

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


-- Compact payment list cleanup without removing confirmed ledger entries.

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


create or replace function public.nexo_assert_document(d jsonb) returns void
language plpgsql set search_path = '' as $$
declare
  ids text[]; e jsonb; p jsonb; t jsonb; m jsonb; o jsonb; k text; v text;
  collection text; split_sum numeric;
begin
  if d?'currency' and (jsonb_typeof(d->'currency') is distinct from 'string' or (d->>'currency' in ('EUR','RON')) is not true) then
    raise exception 'NEXO_CURRENCY';
  end if;
  if jsonb_typeof(d) is distinct from 'object' or octet_length(d::text)>250000 then
    raise exception using errcode='22023',message='Invalid group document';
  end if;
  if jsonb_typeof(d->'name') is distinct from 'string' or length(trim(d->>'name')) not between 1 and 60
     or jsonb_typeof(d->'place') is distinct from 'string' or length(d->>'place')>80
     or jsonb_typeof(d->'emoji') is distinct from 'string' or length(d->>'emoji')>10
     or (d->>'type' in ('Viaje','Convivencia','Pareja','Plan con amigos')) is not true
     or jsonb_typeof(d->'budget') is distinct from 'number'
     or ((d->>'budget') ~ '^[0-9]+$') is not true
     or ((d->>'budget')::numeric<>0 and (d->>'budget')::numeric not between 100 and 1000000000) then
    raise exception using errcode='22023',message='Invalid group fields';
  end if;
  foreach k in array array['date','endDate'] loop
    if jsonb_typeof(d->k) is distinct from 'string' then
      raise exception using errcode='22023',message='Invalid date';
    end if;
    if d->>k<>'' then
      if (d->>k ~ '^\d{4}-\d{2}-\d{2}$') is not true then
        raise exception using errcode='22023',message='Invalid date';
      end if;
      perform (d->>k)::date;
    end if;
  end loop;
  if d->>'endDate'<>'' and (d->>'date'='' or d->>'endDate'<d->>'date') then
    raise exception using errcode='22023',message='Invalid date range';
  end if;
  foreach collection in array array['members','expenses','payments','polls','tasks'] loop
    if jsonb_typeof(d->collection) is distinct from 'array' then
      raise exception using errcode='22023',message='Invalid collection';
    end if;
    if exists(select 1 from jsonb_array_elements(d->collection) x where
      jsonb_typeof(x->'id') is distinct from 'string' or length(x->>'id') not between 1 and 80)
      or (select count(*) from jsonb_array_elements(d->collection)) <>
         (select count(distinct x->>'id') from jsonb_array_elements(d->collection) x) then
      raise exception using errcode='22023',message='Duplicate or invalid identifiers';
    end if;
  end loop;
  if jsonb_array_length(d->'members') not between 1 and 50
     or jsonb_array_length(d->'expenses')>1000 or jsonb_array_length(d->'payments')>1000
     or jsonb_array_length(d->'polls')>100 or jsonb_array_length(d->'tasks')>500 then
    raise exception using errcode='22023',message='Group capacity exceeded';
  end if;
  select array_agg(x->>'id') into ids from jsonb_array_elements(d->'members') x;
  for e in select * from jsonb_array_elements(d->'expenses') loop
    if jsonb_typeof(e->'title') is distinct from 'string' or length(trim(e->>'title')) not between 1 and 100
      or ((e->>'payer')=any(ids)) is not true
      or ((e->>'createdBy')=any(ids)) is not true
      or jsonb_typeof(e->'amount') is distinct from 'number' or ((e->>'amount') ~ '^[0-9]+$') is not true
      or (e->>'amount')::numeric not between 1 and 100000000
      or jsonb_typeof(e->'participants') is distinct from 'array'
      or (e->>'category' in ('Comida','Alojamiento','Transporte','Actividades','Otros')) is not true
      or jsonb_typeof(e->'date') is distinct from 'string' or ((e->>'date') ~ '^\d{4}-\d{2}-\d{2}$') is not true then
      raise exception using errcode='22023',message='Invalid expense';
    end if;
    perform (e->>'date')::date;
    if jsonb_array_length(e->'participants') not between 1 and 50
      or exists(select 1 from jsonb_array_elements_text(e->'participants') id where (id=any(ids)) is not true)
      or jsonb_array_length(e->'participants')<>(select count(distinct id) from jsonb_array_elements_text(e->'participants') id) then
      raise exception using errcode='22023',message='Invalid expense participants';
    end if;
    if e?'split' then
      if jsonb_typeof(e->'split') is distinct from 'object'
        or (e->'split'->>'mode' in ('amounts','percent','shares')) is not true
        or jsonb_typeof(e->'split'->'values') is distinct from 'object' then raise exception 'NEXO_SPLIT'; end if;
      if (select count(*) from jsonb_object_keys(e->'split'->'values'))<>jsonb_array_length(e->'participants')
        or exists(select 1 from jsonb_object_keys(e->'split'->'values') key where not (e->'participants' ? key)) then
        raise exception 'NEXO_SPLIT';
      end if;
      split_sum:=0;
      for k,v in select * from jsonb_each_text(e->'split'->'values') loop
        if jsonb_typeof(e->'split'->'values'->k) is distinct from 'number' or (v ~ '^[0-9]+$') is not true then raise exception 'NEXO_SPLIT'; end if;
        if v::numeric>100000000
          or (e->'split'->>'mode'='percent' and v::numeric>10000)
          or (e->'split'->>'mode'='shares' and v::numeric not between 1 and 1000000) then raise exception 'NEXO_SPLIT'; end if;
        split_sum:=split_sum+v::numeric;
      end loop;
      if (e->'split'->>'mode'='amounts' and split_sum<>(e->>'amount')::numeric)
        or (e->'split'->>'mode'='percent' and split_sum<>10000) then raise exception 'NEXO_SPLIT'; end if;
    end if;
  end loop;
  for t in select * from jsonb_array_elements(d->'tasks') loop
    if jsonb_typeof(t->'title') is distinct from 'string' or length(trim(t->>'title')) not between 1 and 120
      or ((t->>'assignee')=any(ids)) is not true or jsonb_typeof(t->'done') is distinct from 'boolean' then
      raise exception using errcode='22023',message='Invalid task';
    end if;
  end loop;
  for p in select * from jsonb_array_elements(d->'payments') loop
    if ((p->>'from')=any(ids)) is not true or ((p->>'to')=any(ids)) is not true
      or p->>'from'=p->>'to' or jsonb_typeof(p->'amount') is distinct from 'number'
      or ((p->>'amount') ~ '^[0-9]+$') is not true or (p->>'amount')::numeric not between 1 and 1000000000
      or jsonb_typeof(p->'date') is distinct from 'string' or ((p->>'date') ~ '^\d{4}-\d{2}-\d{2}$') is not true then
      raise exception using errcode='22023',message='Invalid payment';
    end if;
    perform (p->>'date')::date;
  end loop;
  for p in select * from jsonb_array_elements(d->'polls') loop
    if jsonb_typeof(p->'title') is distinct from 'string' or length(trim(p->>'title')) not between 1 and 120
      or jsonb_typeof(p->'description') is distinct from 'string' or length(p->>'description')>160
      or jsonb_typeof(p->'options') is distinct from 'array' or jsonb_typeof(p->'votes') is distinct from 'object' then
      raise exception using errcode='22023',message='Invalid poll';
    end if;
    if jsonb_array_length(p->'options') not between 2 and 6
      or jsonb_array_length(p->'options')<>(select count(distinct x->>'id') from jsonb_array_elements(p->'options') x) then
      raise exception using errcode='22023',message='Invalid poll options';
    end if;
    for o in select * from jsonb_array_elements(p->'options') loop
      if jsonb_typeof(o->'id') is distinct from 'string' or length(o->>'id') not between 1 and 80
        or jsonb_typeof(o->'label') is distinct from 'string' or length(trim(o->>'label')) not between 1 and 100 then
        raise exception using errcode='22023',message='Invalid poll option';
      end if;
    end loop;
    for k,v in select * from jsonb_each_text(p->'votes') loop
      if (k=any(ids)) is not true or not exists(select 1 from jsonb_array_elements(p->'options') x where x->>'id'=v) then
        raise exception using errcode='22023',message='Invalid vote';
      end if;
    end loop;
  end loop;
  foreach collection in array array['tasks','polls'] loop
    for t in select * from jsonb_array_elements(d->collection) loop
      if t?'important' and jsonb_typeof(t->'important') is distinct from 'boolean' then raise exception 'NEXO_PLAN_FIELDS';end if;
      if t?'createdBy' and ((t->>'createdBy')=any(ids)) is not true then raise exception 'NEXO_PLAN_FIELDS';end if;
      foreach k in array array['dueAt','remindAt'] loop
        if t?k and (jsonb_typeof(t->k) is distinct from 'string' or
          (t->>k<>'' and (t->>k !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$' or not isfinite((t->>k)::timestamptz)))) then
          raise exception 'NEXO_PLAN_FIELDS';
        end if;
      end loop;
      if coalesce(t->>'remindAt','')<>'' and (coalesce(t->>'dueAt','')='' or (t->>'remindAt')::timestamptz>=(t->>'dueAt')::timestamptz) then raise exception 'NEXO_PLAN_FIELDS';end if;
    end loop;
  end loop;
end;
$$;

create or replace function public.nexo_create_group(p_fields jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g public.nexo_groups; actor uuid:=auth.uid(); d jsonb;
  gid uuid:=coalesce(nullif(p_fields->>'requestId','')::uuid,gen_random_uuid());
begin
  if actor is null then raise exception 'NEXO_FORBIDDEN'; end if;
  -- Serialize this owner's creates and make retries of the same form idempotent.
  perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
  if to_regclass('public.nexo_deleted_groups') is not null then
    if exists(select 1 from public.nexo_deleted_groups where id=gid) then raise exception 'NEXO_FORBIDDEN'; end if;
  end if;
  select * into g from public.nexo_groups where id=gid;
  if found then
    if g.owner_id<>actor then raise exception 'NEXO_FORBIDDEN'; end if;
    return to_jsonb(g);
  end if;
  if (select count(*) from public.nexo_groups where owner_id=actor)>=30 then
    raise exception using errcode='22023',message='Too many groups';
  end if;
  d=jsonb_build_object('id',gid::text,'name',p_fields->>'name','emoji',p_fields->>'emoji',
    'type',p_fields->>'type','place',coalesce(p_fields->>'place',''),'date',coalesce(p_fields->>'date',''),
    'endDate',coalesce(p_fields->>'endDate',''),'budget',coalesce(p_fields->'budget','0'::jsonb),
    'currency',coalesce(p_fields->>'currency','EUR'),
    'members',jsonb_build_array(public.nexo_member_document()),'expenses','[]'::jsonb,
    'payments','[]'::jsonb,'tasks','[]'::jsonb,'polls','[]'::jsonb);
  perform public.nexo_assert_document(d);
  insert into public.nexo_groups(id,owner_id,document) values(gid,actor,d) returning * into g;
  insert into public.nexo_members values(gid,actor);
  return to_jsonb(g);
end;
$$;

-- The guard also covers older clients saving the full group document.
create or replace function public.divzplit_guard_planning() returns trigger
language plpgsql security definer set search_path='' as $$
declare actor text:=auth.uid()::text; collection text; previous jsonb; item jsonb; result jsonb; k text; manager boolean;
begin
 if actor is null then return new;end if;
 foreach collection in array array['tasks','polls'] loop
  result:='[]'::jsonb;
  for item in select * from jsonb_array_elements(new.document->collection) loop
   previous:=null;
   if TG_OP='UPDATE' then select x into previous from jsonb_array_elements(old.document->collection) x where x->>'id'=item->>'id';end if;
   if previous is null then
    if item?'createdBy' and item->>'createdBy' is distinct from actor then raise exception 'NEXO_FORBIDDEN';end if;
    item:=item||jsonb_build_object('createdBy',actor);
   else
    manager:=actor=new.owner_id::text or actor=coalesce(previous->>'createdBy','');
    if item->'createdBy' is distinct from previous->'createdBy' then raise exception 'NEXO_FORBIDDEN';end if;
    if collection='polls' then
     if item->'options' is distinct from previous->'options' then raise exception 'NEXO_FORBIDDEN';end if;
     if (item->'votes')-actor is distinct from (previous->'votes')-actor then raise exception 'NEXO_FORBIDDEN';end if;
     if item->'votes' is distinct from previous->'votes' and nullif(previous->>'dueAt','')::timestamptz<=clock_timestamp() then raise exception 'NEXO_POLL_CLOSED';end if;
     if item-'votes' is distinct from previous-'votes' and not manager then raise exception 'NEXO_FORBIDDEN';end if;
    elsif item-'done' is distinct from previous-'done' and not manager then raise exception 'NEXO_FORBIDDEN';
    end if;
   end if;
   foreach k in array array['dueAt','remindAt'] loop
    if coalesce(item->>k,'')<>'' and item->>k is distinct from previous->>k and (item->>k)::timestamptz<=clock_timestamp() then raise exception 'NEXO_PLAN_PAST';end if;
   end loop;
   result:=result||jsonb_build_array(item);
  end loop;
  if TG_OP='UPDATE' then
   for previous in select * from jsonb_array_elements(old.document->collection) loop
    if not exists(select 1 from jsonb_array_elements(result) x where x->>'id'=previous->>'id')
     and actor<>new.owner_id::text and actor<>coalesce(previous->>'createdBy','') then raise exception 'NEXO_FORBIDDEN';end if;
   end loop;
  end if;
  new.document:=jsonb_set(new.document,array[collection],result);
 end loop;
 return new;
end;
$$;
drop trigger if exists divzplit_planning_guard on public.nexo_groups;
create trigger divzplit_planning_guard before insert or update of document on public.nexo_groups for each row execute function public.divzplit_guard_planning();

create or replace function public.divzplit_plan_action(p_id uuid,p_version bigint,p_kind text,p_action text,p_item jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g public.nexo_groups; previous jsonb; item jsonb; items jsonb; actor text:=auth.uid()::text;
begin
 if not public.nexo_is_member(p_id) then raise exception 'NEXO_FORBIDDEN';end if;
 if p_kind is null or p_kind not in ('tasks','polls') or p_action is null or p_action not in ('save','delete','clear') then raise exception 'NEXO_PLAN_FIELDS';end if;
 select * into g from public.nexo_groups where id=p_id for update;
 if g.version is distinct from p_version then raise exception 'NEXO_CONFLICT';end if;
 select x into previous from jsonb_array_elements(g.document->p_kind) x where x->>'id'=p_item->>'id';
 if p_action='clear' then
  if g.owner_id::text<>actor then raise exception 'NEXO_OWNER';end if;
  items:='[]'::jsonb;
 else
  if previous is not null and actor<>g.owner_id::text and actor<>coalesce(previous->>'createdBy','') then raise exception 'NEXO_FORBIDDEN';end if;
  if p_action='delete' and previous is null then return to_jsonb(g);end if;
  if p_action='save' then
   if previous is null then
    item:=p_item||jsonb_build_object('createdBy',actor);
    if p_kind='polls' then item:=item||jsonb_build_object('votes','{}'::jsonb);else item:=item||jsonb_build_object('done',false);end if;
   else
    item:=previous||p_item;
    -- Voters and completion are updated using the normal vote/task controls.
    if p_kind='polls' then item:=item||jsonb_build_object('votes',previous->'votes','options',previous->'options');
    else item:=item||jsonb_build_object('done',previous->'done');end if;
   end if;
  end if;
  select coalesce(jsonb_agg(case when x->>'id'=p_item->>'id' then item else x end order by n),'[]'::jsonb) into items
   from jsonb_array_elements(g.document->p_kind) with ordinality a(x,n)
   where p_action<>'delete' or x->>'id'<>p_item->>'id';
  if p_action='save' and previous is null then items:=jsonb_build_array(item)||items;end if;
 end if;
 g.document:=jsonb_set(g.document,array[p_kind],items);
 perform public.nexo_assert_document(g.document);
 update public.nexo_groups set document=g.document,version=version+1 where id=p_id returning * into g;
 return to_jsonb(g);
end;
$$;

create table if not exists public.divzplit_plan_reminders(
 group_id uuid not null references public.nexo_groups(id) on delete cascade,
 kind text not null check(kind in ('tasks','polls')),item_id text not null,
 last_manual_at timestamptz,scheduled_at timestamptz,primary key(group_id,kind,item_id)
);
alter table public.divzplit_plan_reminders enable row level security;
revoke all on public.divzplit_plan_reminders from public,anon,authenticated;

-- Internal delivery: the group lock is held by both callers. Existing notification
-- and push triggers preserve preferences, muted groups and device subscriptions.
create or replace function public.divzplit_deliver_plan_reminder(p_group uuid,p_kind text,p_item jsonb,p_actor uuid) returns bigint
language plpgsql security definer set search_path='' as $$
declare g public.nexo_groups; eid uuid:=gen_random_uuid(); sender text; delivered bigint;
begin
 select * into g from public.nexo_groups where id=p_group;
 select m->>'name' into sender from jsonb_array_elements(g.document->'members') m where m->>'id'=p_actor::text;
 insert into public.divzplit_history(id,group_id,actor_id,actor_name,kind,entity_id,before_data,after_data,currency)
 values(eid,p_group,p_actor,coalesce(sender,'Miembro'),p_kind||'.reminder',p_item->>'id',null,p_item,coalesce(g.document->>'currency','EUR'));
 insert into public.divzplit_notifications(user_id,group_id,event_id,kind,category,actor_name,group_name,subject)
 select m.user_id,p_group,eid,p_kind||'.reminder',p_kind,coalesce(sender,'Miembro'),g.document->>'name',
  left(case when coalesce((p_item->>'important')::boolean,false) then '❗ ' else '' end||(p_item->>'title'),120)
 from public.nexo_members m left join public.divzplit_notification_settings s on s.user_id=m.user_id
 where m.group_id=p_group and m.user_id<>p_actor
  and case p_kind when 'tasks' then coalesce(s.tasks,true) else coalesce(s.polls,true) end
  and not exists(select 1 from public.divzplit_muted_groups x where x.group_id=p_group and x.user_id=m.user_id)
 on conflict(event_id,user_id) do nothing;
 get diagnostics delivered=row_count;
 return delivered;
end;
$$;

create or replace function public.divzplit_remind_plan(p_id uuid,p_kind text,p_item_id text) returns bigint
language plpgsql security definer set search_path='' as $$
declare g public.nexo_groups; item jsonb; last_sent timestamptz; actor uuid:=auth.uid(); result bigint;
begin
 if not public.nexo_is_member(p_id) then raise exception 'NEXO_FORBIDDEN';end if;
 if p_kind is null or p_kind not in ('tasks','polls') then raise exception 'NEXO_PLAN_FIELDS';end if;
 select * into g from public.nexo_groups where id=p_id for update;
 select x into item from jsonb_array_elements(g.document->p_kind) x where x->>'id'=p_item_id;
 if item is null or (g.owner_id<>actor and coalesce(item->>'createdBy','')<>actor::text) then raise exception 'NEXO_FORBIDDEN';end if;
 if (p_kind='tasks' and (item->>'done')::boolean) or (p_kind='polls' and nullif(item->>'dueAt','')::timestamptz<=clock_timestamp()) then raise exception 'NEXO_PLAN_FINISHED';end if;
 select last_manual_at into last_sent from public.divzplit_plan_reminders where group_id=p_id and kind=p_kind and item_id=p_item_id;
 if last_sent>clock_timestamp()-interval '15 minutes' then raise exception 'NEXO_REMINDER_WAIT';end if;
 result:=public.divzplit_deliver_plan_reminder(p_id,p_kind,item,actor);
 insert into public.divzplit_plan_reminders(group_id,kind,item_id,last_manual_at) values(p_id,p_kind,p_item_id,clock_timestamp())
 on conflict(group_id,kind,item_id) do update set last_manual_at=excluded.last_manual_at;
 return result;
end;
$$;

create or replace function public.divzplit_run_plan_reminders() returns bigint
language plpgsql security definer set search_path='' as $$
declare g public.nexo_groups; collection text; item jsonb; scheduled timestamptz; last_sent timestamptz; actor uuid; total bigint:=0;
begin
 for g in select * from public.nexo_groups ng where exists(
  select 1 from (values ('tasks'),('polls')) c(collection) cross join lateral jsonb_array_elements(ng.document->c.collection) x
  where nullif(x->>'remindAt','')::timestamptz<=clock_timestamp()
   and nullif(x->>'dueAt','')::timestamptz>clock_timestamp()
   and not coalesce((x->>'done')::boolean,false)
   and not exists(select 1 from public.divzplit_plan_reminders r where r.group_id=ng.id and r.kind=c.collection and r.item_id=x->>'id' and r.scheduled_at=nullif(x->>'remindAt','')::timestamptz)
 ) order by ng.id limit 100 for update skip locked loop
  foreach collection in array array['tasks','polls'] loop
   for item in select * from jsonb_array_elements(g.document->collection) loop
    scheduled:=nullif(item->>'remindAt','')::timestamptz;
    if scheduled is null or scheduled>clock_timestamp() or nullif(item->>'dueAt','')::timestamptz<=clock_timestamp() or (collection='tasks' and (item->>'done')::boolean) then continue;end if;
    select scheduled_at into last_sent from public.divzplit_plan_reminders where group_id=g.id and kind=collection and item_id=item->>'id';
    if last_sent=scheduled then continue;end if;
    actor:=coalesce(nullif(item->>'createdBy','')::uuid,g.owner_id);
    total:=total+public.divzplit_deliver_plan_reminder(g.id,collection,item,actor);
    insert into public.divzplit_plan_reminders(group_id,kind,item_id,scheduled_at) values(g.id,collection,item->>'id',scheduled)
    on conflict(group_id,kind,item_id) do update set scheduled_at=excluded.scheduled_at;
   end loop;
  end loop;
 end loop;
 return total;
end;
$$;

-- Supabase already has pg_cron from push activation. Local test databases may
-- omit the extension; the worker can still be exercised explicitly there.
do $$
begin
 if exists(select 1 from pg_available_extensions where name='pg_cron') then
  execute 'create extension if not exists pg_cron with schema pg_catalog';
  if not exists(select 1 from cron.job where jobname='divzplit-plan-reminders') then
   perform cron.schedule('divzplit-plan-reminders','* * * * *','select public.divzplit_run_plan_reminders();');
  end if;
 end if;
end;
$$;
create or replace function public.divzplit_planning_support() returns jsonb
language plpgsql security definer set search_path='' as $$
declare scheduled boolean:=false;
begin
 if auth.uid() is null then raise exception 'NEXO_FORBIDDEN';end if;
 if to_regclass('cron.job') is not null then execute 'select exists(select 1 from cron.job where jobname=''divzplit-plan-reminders'' and active)' into scheduled;end if;
 return jsonb_build_object('enabled',true,'scheduling',scheduled);
end;
$$;
revoke all on function public.divzplit_guard_planning(),public.divzplit_deliver_plan_reminder(uuid,text,jsonb,uuid),public.divzplit_run_plan_reminders() from public,anon,authenticated;
revoke all on function public.divzplit_plan_action(uuid,bigint,text,text,jsonb),public.divzplit_remind_plan(uuid,text,text),public.divzplit_planning_support() from public,anon,authenticated;
grant execute on function public.divzplit_plan_action(uuid,bigint,text,text,jsonb),public.divzplit_remind_plan(uuid,text,text),public.divzplit_planning_support() to authenticated;
notify pgrst,'reload schema';


alter table public.divzplit_payment_requests drop constraint if exists divzplit_payment_requests_currency_check;
alter table public.divzplit_payment_requests add constraint divzplit_payment_requests_currency_check check(currency in ('EUR','RON','USD','GBP','CHF','PLN','CZK','HUF','SEK','DKK','NOK','ISK','ALL','BAM','MKD','RSD','MDL','UAH','RUB','BYN','TRY','GEL','AMD','AZN','GIP'));
alter table public.divzplit_payment_requests add column if not exists fx jsonb;
create table if not exists public.divzplit_fx_quotes(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 currency text not null,rate numeric(24,10) not null check(rate>0 and rate<=100000000),
 rate_date date not null,source text not null check(source in ('ECB','ExchangeRate-API')),
 checked_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null default clock_timestamp()+interval '15 minutes'
);
create index if not exists divzplit_fx_quotes_user on public.divzplit_fx_quotes(user_id,checked_at);
alter table public.divzplit_fx_quotes enable row level security;
revoke all on public.divzplit_fx_quotes from public,anon,authenticated;

create or replace function public.nexo_assert_document(d jsonb) returns void
language plpgsql set search_path = '' as $$
declare
  ids text[]; e jsonb; p jsonb; t jsonb; m jsonb; o jsonb; k text; v text;
  collection text; split_sum numeric;
begin
  if d?'currency' and (jsonb_typeof(d->'currency') is distinct from 'string' or (d->>'currency' in ('EUR','RON','USD','GBP','CHF','PLN','CZK','HUF','SEK','DKK','NOK','ISK','ALL','BAM','MKD','RSD','MDL','UAH','RUB','BYN','TRY','GEL','AMD','AZN','GIP')) is not true) then
    raise exception 'NEXO_CURRENCY';
  end if;
  if jsonb_typeof(d) is distinct from 'object' or octet_length(d::text)>250000 then
    raise exception using errcode='22023',message='Invalid group document';
  end if;
  if jsonb_typeof(d->'name') is distinct from 'string' or length(trim(d->>'name')) not between 1 and 60
     or jsonb_typeof(d->'place') is distinct from 'string' or length(d->>'place')>80
     or jsonb_typeof(d->'emoji') is distinct from 'string' or length(d->>'emoji')>10
     or (d->>'type' in ('Viaje','Convivencia','Pareja','Plan con amigos')) is not true
     or jsonb_typeof(d->'budget') is distinct from 'number'
     or ((d->>'budget') ~ '^[0-9]+$') is not true
     or ((d->>'budget')::numeric<>0 and (d->>'budget')::numeric not between (case when d->>'currency'='ISK' then 1 else 100 end) and 1000000000) then
    raise exception using errcode='22023',message='Invalid group fields';
  end if;
  foreach k in array array['date','endDate'] loop
    if jsonb_typeof(d->k) is distinct from 'string' then
      raise exception using errcode='22023',message='Invalid date';
    end if;
    if d->>k<>'' then
      if (d->>k ~ '^\d{4}-\d{2}-\d{2}$') is not true then
        raise exception using errcode='22023',message='Invalid date';
      end if;
      perform (d->>k)::date;
    end if;
  end loop;
  if d->>'endDate'<>'' and (d->>'date'='' or d->>'endDate'<d->>'date') then
    raise exception using errcode='22023',message='Invalid date range';
  end if;
  foreach collection in array array['members','expenses','payments','polls','tasks'] loop
    if jsonb_typeof(d->collection) is distinct from 'array' then
      raise exception using errcode='22023',message='Invalid collection';
    end if;
    if exists(select 1 from jsonb_array_elements(d->collection) x where
      jsonb_typeof(x->'id') is distinct from 'string' or length(x->>'id') not between 1 and 80)
      or (select count(*) from jsonb_array_elements(d->collection)) <>
         (select count(distinct x->>'id') from jsonb_array_elements(d->collection) x) then
      raise exception using errcode='22023',message='Duplicate or invalid identifiers';
    end if;
  end loop;
  if jsonb_array_length(d->'members') not between 1 and 50
     or jsonb_array_length(d->'expenses')>1000 or jsonb_array_length(d->'payments')>1000
     or jsonb_array_length(d->'polls')>100 or jsonb_array_length(d->'tasks')>500 then
    raise exception using errcode='22023',message='Group capacity exceeded';
  end if;
  select array_agg(x->>'id') into ids from jsonb_array_elements(d->'members') x;
  for e in select * from jsonb_array_elements(d->'expenses') loop
    if jsonb_typeof(e->'title') is distinct from 'string' or length(trim(e->>'title')) not between 1 and 100
      or ((e->>'payer')=any(ids)) is not true
      or ((e->>'createdBy')=any(ids)) is not true
      or jsonb_typeof(e->'amount') is distinct from 'number' or ((e->>'amount') ~ '^[0-9]+$') is not true
      or (e->>'amount')::numeric not between 1 and 100000000
      or jsonb_typeof(e->'participants') is distinct from 'array'
      or (e->>'category' in ('Comida','Alojamiento','Transporte','Actividades','Otros')) is not true
      or jsonb_typeof(e->'date') is distinct from 'string' or ((e->>'date') ~ '^\d{4}-\d{2}-\d{2}$') is not true then
      raise exception using errcode='22023',message='Invalid expense';
    end if;
    perform (e->>'date')::date;
    if jsonb_array_length(e->'participants') not between 1 and 50
      or exists(select 1 from jsonb_array_elements_text(e->'participants') id where (id=any(ids)) is not true)
      or jsonb_array_length(e->'participants')<>(select count(distinct id) from jsonb_array_elements_text(e->'participants') id) then
      raise exception using errcode='22023',message='Invalid expense participants';
    end if;
    if e?'split' then
      if jsonb_typeof(e->'split') is distinct from 'object'
        or (e->'split'->>'mode' in ('amounts','percent','shares')) is not true
        or jsonb_typeof(e->'split'->'values') is distinct from 'object' then raise exception 'NEXO_SPLIT'; end if;
      if (select count(*) from jsonb_object_keys(e->'split'->'values'))<>jsonb_array_length(e->'participants')
        or exists(select 1 from jsonb_object_keys(e->'split'->'values') key where not (e->'participants' ? key)) then
        raise exception 'NEXO_SPLIT';
      end if;
      split_sum:=0;
      for k,v in select * from jsonb_each_text(e->'split'->'values') loop
        if jsonb_typeof(e->'split'->'values'->k) is distinct from 'number' or (v ~ '^[0-9]+$') is not true then raise exception 'NEXO_SPLIT'; end if;
        if v::numeric>100000000
          or (e->'split'->>'mode'='percent' and v::numeric>10000)
          or (e->'split'->>'mode'='shares' and v::numeric not between 1 and 1000000) then raise exception 'NEXO_SPLIT'; end if;
        split_sum:=split_sum+v::numeric;
      end loop;
      if (e->'split'->>'mode'='amounts' and split_sum<>(e->>'amount')::numeric)
        or (e->'split'->>'mode'='percent' and split_sum<>10000) then raise exception 'NEXO_SPLIT'; end if;
    end if;
  end loop;
  for t in select * from jsonb_array_elements(d->'tasks') loop
    if jsonb_typeof(t->'title') is distinct from 'string' or length(trim(t->>'title')) not between 1 and 120
      or ((t->>'assignee')=any(ids)) is not true or jsonb_typeof(t->'done') is distinct from 'boolean' then
      raise exception using errcode='22023',message='Invalid task';
    end if;
  end loop;
  for p in select * from jsonb_array_elements(d->'payments') loop
    if ((p->>'from')=any(ids)) is not true or ((p->>'to')=any(ids)) is not true
      or p->>'from'=p->>'to' or jsonb_typeof(p->'amount') is distinct from 'number'
      or ((p->>'amount') ~ '^[0-9]+$') is not true or (p->>'amount')::numeric not between 1 and 1000000000
      or jsonb_typeof(p->'date') is distinct from 'string' or ((p->>'date') ~ '^\d{4}-\d{2}-\d{2}$') is not true then
      raise exception using errcode='22023',message='Invalid payment';
    end if;
    perform (p->>'date')::date;
  end loop;
  for p in select * from jsonb_array_elements(d->'polls') loop
    if jsonb_typeof(p->'title') is distinct from 'string' or length(trim(p->>'title')) not between 1 and 120
      or jsonb_typeof(p->'description') is distinct from 'string' or length(p->>'description')>160
      or jsonb_typeof(p->'options') is distinct from 'array' or jsonb_typeof(p->'votes') is distinct from 'object' then
      raise exception using errcode='22023',message='Invalid poll';
    end if;
    if jsonb_array_length(p->'options') not between 2 and 6
      or jsonb_array_length(p->'options')<>(select count(distinct x->>'id') from jsonb_array_elements(p->'options') x) then
      raise exception using errcode='22023',message='Invalid poll options';
    end if;
    for o in select * from jsonb_array_elements(p->'options') loop
      if jsonb_typeof(o->'id') is distinct from 'string' or length(o->>'id') not between 1 and 80
        or jsonb_typeof(o->'label') is distinct from 'string' or length(trim(o->>'label')) not between 1 and 100 then
        raise exception using errcode='22023',message='Invalid poll option';
      end if;
    end loop;
    for k,v in select * from jsonb_each_text(p->'votes') loop
      if (k=any(ids)) is not true or not exists(select 1 from jsonb_array_elements(p->'options') x where x->>'id'=v) then
        raise exception using errcode='22023',message='Invalid vote';
      end if;
    end loop;
  end loop;
  foreach collection in array array['tasks','polls'] loop
    for t in select * from jsonb_array_elements(d->collection) loop
      if t?'important' and jsonb_typeof(t->'important') is distinct from 'boolean' then raise exception 'NEXO_PLAN_FIELDS';end if;
      if t?'createdBy' and ((t->>'createdBy')=any(ids)) is not true then raise exception 'NEXO_PLAN_FIELDS';end if;
      foreach k in array array['dueAt','remindAt'] loop
        if t?k and (jsonb_typeof(t->k) is distinct from 'string' or
          (t->>k<>'' and (t->>k !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$' or not isfinite((t->>k)::timestamptz)))) then
          raise exception 'NEXO_PLAN_FIELDS';
        end if;
      end loop;
      if coalesce(t->>'remindAt','')<>'' and (coalesce(t->>'dueAt','')='' or (t->>'remindAt')::timestamptz>=(t->>'dueAt')::timestamptz) then raise exception 'NEXO_PLAN_FIELDS';end if;
    end loop;
  end loop;
end;
$$;

create or replace function public.divzplit_respond_payment(p_id uuid,p_request_id uuid,p_action text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g public.nexo_groups; r public.divzplit_payment_requests; actor uuid:=auth.uid(); target_status text;
begin
 if not public.nexo_is_member(p_id) then raise exception 'NEXO_FORBIDDEN'; end if;
 select * into g from public.nexo_groups where id=p_id for update;
 select * into r from public.divzplit_payment_requests where id=p_request_id and group_id=p_id for update;
 if not found then raise exception 'NEXO_PAYMENT_CHANGED'; end if;
 if p_action in ('confirm','reject') then
  if actor<>r.to_id then raise exception 'NEXO_FORBIDDEN'; end if;
  target_status:=case when p_action='confirm' then 'confirmed' else 'rejected' end;
 elsif p_action='cancel' then
  if actor<>r.from_id then raise exception 'NEXO_FORBIDDEN'; end if;
  target_status:='cancelled';
 else raise exception 'NEXO_FORBIDDEN'; end if;
 if r.status=target_status then return to_jsonb(g); end if;
 if r.status<>'pending' then raise exception 'NEXO_PAYMENT_CHANGED'; end if;
 if p_action='confirm' then
  if r.currency is distinct from coalesce(g.document->>'currency','EUR') or r.amount>least(-public.divzplit_member_balance(g.document,r.from_id::text),public.divzplit_member_balance(g.document,r.to_id::text)) then raise exception 'NEXO_PAYMENT_CHANGED'; end if;
  update public.nexo_groups set document=jsonb_set(document,'{payments}',jsonb_build_array((jsonb_build_object('id',r.id::text,'from',r.from_id::text,'to',r.to_id::text,'amount',r.amount,'date',current_date::text)||case when r.fx is not null then jsonb_build_object('fx',r.fx) else '{}'::jsonb end))||(document->'payments')),version=version+1 where id=p_id returning * into g;
  perform public.nexo_assert_document(g.document);
 else
  perform public.divzplit_log(p_id,'payment.'||target_status,r.id::text,to_jsonb(r),to_jsonb(r)||jsonb_build_object('status',target_status));
 end if;
 update public.divzplit_payment_requests set status=target_status,resolved_at=clock_timestamp() where id=r.id;
 return to_jsonb(g);
end;
$$;

-- Only the authenticated Edge Function can issue a trusted daily quote.
create or replace function public.divzplit_issue_fx_quote(p_user uuid,p_currency text,p_rate numeric,p_date date,p_source text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare q public.divzplit_fx_quotes;
begin
 if p_user is null or not exists(select 1 from auth.users where id=p_user)
  or p_currency is null or p_currency not in ('RON','USD','GBP','CHF','PLN','CZK','HUF','SEK','DKK','NOK','ISK','ALL','BAM','MKD','RSD','MDL','UAH','RUB','BYN','TRY','GEL','AMD','AZN','GIP')
  or p_rate is null or p_rate<=0 or p_rate>100000000 or p_rate::text in ('NaN','Infinity','-Infinity')
  or p_date is null or p_date>current_date or p_date<current_date-7
  or p_source is null or p_source not in ('ECB','ExchangeRate-API') then raise exception 'NEXO_FX_RATE';end if;
 -- No payment references quotes: its immutable snapshot is stored on the request.
 delete from public.divzplit_fx_quotes where user_id=p_user and checked_at<clock_timestamp()-interval '1 day';
 insert into public.divzplit_fx_quotes(user_id,currency,rate,rate_date,source) values(p_user,p_currency,p_rate,p_date,p_source) returning * into q;
 return to_jsonb(q)-'user_id';
end;
$$;
create or replace function public.divzplit_fx_support() returns boolean language sql stable as $$select true;$$;
create or replace function public.divzplit_request_payment_eur(p_id uuid,p_version bigint,p_request_id uuid,p_to uuid,p_amount bigint,p_currency text,p_quote uuid,p_eur_amount bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g public.nexo_groups; r public.divzplit_payment_requests; q public.divzplit_fx_quotes; actor uuid:=auth.uid();
 reserved_from bigint; reserved_to bigint; converted bigint; snapshot jsonb;
begin
 if not public.nexo_is_member(p_id) then raise exception 'NEXO_FORBIDDEN';end if;
 select * into g from public.nexo_groups where id=p_id for update;
 select * into r from public.divzplit_payment_requests where id=p_request_id;
 if found then
  if r.group_id is distinct from p_id or r.from_id is distinct from actor or r.to_id is distinct from p_to or r.amount is distinct from p_amount or r.currency is distinct from p_currency
   or r.fx is null or r.fx->>'quoteId' is distinct from p_quote::text or (r.fx->>'amount')::bigint is distinct from p_eur_amount then raise exception 'NEXO_FORBIDDEN';end if;
  return to_jsonb(r);
 end if;
 if g.version is distinct from p_version then raise exception 'NEXO_CONFLICT';end if;
 if p_request_id is null or p_to is null or p_to=actor or p_amount is null or p_amount not between 1 and 1000000000 or p_currency is distinct from coalesce(g.document->>'currency','EUR') or p_currency='EUR' then raise exception 'NEXO_PAYMENT_CHANGED';end if;
 if not exists(select 1 from public.nexo_members where group_id=p_id and user_id=p_to) then raise exception 'NEXO_FORBIDDEN';end if;
 select * into q from public.divzplit_fx_quotes where id=p_quote and user_id=actor and currency=p_currency;
 if not found or q.expires_at<=clock_timestamp() then raise exception 'NEXO_FX_EXPIRED';end if;
 converted:=round(p_amount::numeric*100/(case when p_currency='ISK' then 1 else 100 end)/q.rate)::bigint;
 if converted<1 or converted>1000000000 or converted is distinct from p_eur_amount then raise exception 'NEXO_FX_AMOUNT';end if;
 select coalesce(sum(amount) filter(where from_id=actor),0),coalesce(sum(amount) filter(where to_id=p_to),0)
 into reserved_from,reserved_to from public.divzplit_payment_requests where group_id=p_id and status='pending';
 if (select count(*) from public.divzplit_payment_requests where group_id=p_id and status='pending')>=100
  or p_amount>least(-public.divzplit_member_balance(g.document,actor::text)-reserved_from,public.divzplit_member_balance(g.document,p_to::text)-reserved_to) then raise exception 'NEXO_PAYMENT_CHANGED';end if;
 snapshot:=jsonb_build_object('quoteId',q.id,'currency','EUR','amount',converted,'rate',q.rate::text,'date',q.rate_date,'source',q.source,'checkedAt',q.checked_at);
 insert into public.divzplit_payment_requests(id,group_id,from_id,to_id,amount,currency,fx)
 values(p_request_id,p_id,actor,p_to,p_amount,p_currency,snapshot) returning * into r;
 perform public.divzplit_log(p_id,'payment.requested',r.id::text,null,to_jsonb(r));
 return to_jsonb(r);
end;
$$;
revoke all on function public.divzplit_issue_fx_quote(uuid,text,numeric,date,text),public.divzplit_fx_support(),public.divzplit_request_payment_eur(uuid,bigint,uuid,uuid,bigint,text,uuid,bigint) from public,anon,authenticated;
grant execute on function public.divzplit_issue_fx_quote(uuid,text,numeric,date,text) to service_role;
grant execute on function public.divzplit_fx_support(),public.divzplit_request_payment_eur(uuid,bigint,uuid,uuid,bigint,text,uuid,bigint) to authenticated;
notify pgrst,'reload schema';

commit;
