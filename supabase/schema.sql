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
  collection text;
begin
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

-- Functions default to PUBLIC execute in PostgreSQL: remove it explicitly.
revoke all on function public.nexo_is_member(uuid), public.nexo_member_document(),
  public.nexo_assert_document(jsonb),public.nexo_create_group(jsonb),
  public.nexo_save_group(uuid,bigint,jsonb),public.nexo_create_invite(uuid),
  public.nexo_revoke_invites(uuid),public.nexo_join_group(text) from public,anon,authenticated;
grant execute on function public.nexo_is_member(uuid),public.nexo_create_group(jsonb),
  public.nexo_save_group(uuid,bigint,jsonb),public.nexo_create_invite(uuid),
  public.nexo_revoke_invites(uuid),public.nexo_join_group(text) to authenticated;

commit;
