-- Apply after the original schema. No existing group data is rewritten.
begin;

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

notify pgrst,'reload schema';
commit;
