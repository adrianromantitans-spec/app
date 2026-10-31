-- Run after expense-tools.sql for existing projects. No data is rewritten.
begin;
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
commit;
