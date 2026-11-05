-- Optional budgets, compact task/poll lists, deadlines and reminders. No secrets.
-- Run after the existing collaboration and notification migrations.
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
      or (e->>'category' in ('Comida','Transporte','Gasolina','Alojamiento','Viaje','Actividades','Compras','Salud','Facturas','Ocio','Otros')) is not true
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
commit;
