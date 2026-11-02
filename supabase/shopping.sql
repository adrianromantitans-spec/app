-- Optional shared shopping list. Run after the existing DivZplit migrations.
-- Safe to run again. Removing the UI does not delete expenses or payments.
begin;
create table if not exists public.divzplit_shopping_items (
 id uuid primary key,
 group_id uuid not null references public.nexo_groups(id) on delete cascade,
 title text not null check(length(btrim(title)) between 1 and 120),
 quantity text not null default '' check(length(quantity)<=40),
 bought boolean not null default false,
 created_by uuid not null references auth.users(id),
 expense_id text,
 version bigint not null default 1,
 created_at timestamptz not null default now()
);
create index if not exists divzplit_shopping_group on public.divzplit_shopping_items(group_id,created_at);
alter table public.divzplit_shopping_items enable row level security;
revoke all on public.divzplit_shopping_items from public,anon,authenticated;
-- All reads/writes go through membership-checked RPCs.
create or replace function public.divzplit_shopping_list(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not public.nexo_is_member(p_id) then raise exception 'NEXO_FORBIDDEN'; end if;
 return coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at,i.id) from public.divzplit_shopping_items i where i.group_id=p_id),'[]'::jsonb);
end $$;
create or replace function public.divzplit_shopping_action(p_id uuid,p_action text,p_item jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g public.nexo_groups; old public.divzplit_shopping_items; item_id uuid; actor uuid:=auth.uid();
begin
 if not public.nexo_is_member(p_id) then raise exception 'NEXO_FORBIDDEN'; end if;
 select * into g from public.nexo_groups where id=p_id for update;
 if p_action='clear' then
  if g.owner_id<>actor then raise exception 'NEXO_OWNER'; end if;
  delete from public.divzplit_shopping_items where group_id=p_id and bought;
  return public.divzplit_shopping_list(p_id);
 end if;
 if p_action not in ('add','edit','check','delete') or p_action is null then raise exception 'NEXO_SHOPPING_FIELDS'; end if;
 item_id:=(p_item->>'id')::uuid;
 if item_id is null then raise exception 'NEXO_SHOPPING_FIELDS'; end if;
 select * into old from public.divzplit_shopping_items where id=item_id;
 if p_action='add' then
  if old.id is not null then
   if old.group_id<>p_id or old.created_by<>actor then raise exception 'NEXO_FORBIDDEN'; end if;
   if old.title is distinct from btrim(p_item->>'title') or old.quantity is distinct from coalesce(btrim(p_item->>'quantity'),'') then raise exception 'NEXO_SHOPPING_CHANGED'; end if;
   return public.divzplit_shopping_list(p_id);
  end if;
  if (select count(*) from public.divzplit_shopping_items where group_id=p_id)>=200 then raise exception 'NEXO_SHOPPING_LIMIT'; end if;
 else
  if old.id is null or old.group_id<>p_id then raise exception 'NEXO_SHOPPING_CHANGED'; end if;
  if p_action in ('edit','delete') and old.created_by<>actor and g.owner_id<>actor then raise exception 'NEXO_FORBIDDEN'; end if;
  if old.version is distinct from (p_item->>'version')::bigint then raise exception 'NEXO_SHOPPING_CHANGED'; end if;
  if p_action='delete' then
   delete from public.divzplit_shopping_items where id=item_id;
   return public.divzplit_shopping_list(p_id);
  end if;
  if old.expense_id is not null then raise exception 'NEXO_SHOPPING_LINKED'; end if;
 end if;
 if p_action in ('add','edit') then
  if jsonb_typeof(p_item->'title') is distinct from 'string' or length(btrim(p_item->>'title')) not between 1 and 120
    or jsonb_typeof(coalesce(p_item->'quantity','""'::jsonb)) is distinct from 'string' or length(coalesce(p_item->>'quantity',''))>40 then raise exception 'NEXO_SHOPPING_FIELDS'; end if;
  if p_action='add' then
   insert into public.divzplit_shopping_items(id,group_id,title,quantity,created_by) values(item_id,p_id,btrim(p_item->>'title'),coalesce(btrim(p_item->>'quantity'),''),actor);
  else
   update public.divzplit_shopping_items set title=btrim(p_item->>'title'),quantity=coalesce(btrim(p_item->>'quantity'),''),version=version+1 where id=item_id;
  end if;
 else
  if jsonb_typeof(p_item->'bought') is distinct from 'boolean' then raise exception 'NEXO_SHOPPING_FIELDS'; end if;
  update public.divzplit_shopping_items set bought=(p_item->>'bought')::boolean,version=version+1 where id=item_id;
 end if;
 return public.divzplit_shopping_list(p_id);
end $$;

-- Saving the expense and linking its products is one transaction. Stable IDs
-- make retries safe even when the first response is lost. Group locking also
-- prevents two members from turning the same products into two expenses.
create or replace function public.divzplit_shopping_checkout(p_id uuid,p_version bigint,p_document jsonb,p_expense_id text,p_items uuid[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g public.nexo_groups; result jsonb; old_expenses jsonb; n integer;
begin
 if not public.nexo_is_member(p_id) then raise exception 'NEXO_FORBIDDEN'; end if;
 select * into g from public.nexo_groups where id=p_id for update;
 n:=cardinality(p_items);
 if n is null or n<1 or n>200 or (select count(distinct i) from unnest(p_items) i)<>n or p_expense_id is null then raise exception 'NEXO_SHOPPING_FIELDS'; end if;
 if (select count(*) from public.divzplit_shopping_items where group_id=p_id and id=any(p_items))<>n then raise exception 'NEXO_SHOPPING_CHANGED'; end if;
 if exists(select 1 from jsonb_array_elements(g.document->'expenses') e where e->>'id'=p_expense_id) then
  if (select count(*) from public.divzplit_shopping_items where group_id=p_id and id=any(p_items) and expense_id=p_expense_id)=n then return to_jsonb(g); end if;
  raise exception 'NEXO_SHOPPING_CHANGED';
 end if;
 if exists(select 1 from public.divzplit_shopping_items where group_id=p_id and id=any(p_items) and (not bought or expense_id is not null)) then raise exception 'NEXO_SHOPPING_CHANGED'; end if;
 if p_document-'expenses' is distinct from g.document-'expenses' or jsonb_typeof(p_document->'expenses') is distinct from 'array'
   or jsonb_array_length(p_document->'expenses')<>jsonb_array_length(g.document->'expenses')+1 then raise exception 'NEXO_SHOPPING_FIELDS'; end if;
 select coalesce(jsonb_agg(e order by ord),'[]'::jsonb) into old_expenses from jsonb_array_elements(p_document->'expenses') with ordinality a(e,ord) where e->>'id' is distinct from p_expense_id;
 if old_expenses is distinct from g.document->'expenses' then raise exception 'NEXO_SHOPPING_FIELDS'; end if;
 result:=public.nexo_save_group(p_id,p_version,p_document);
 update public.divzplit_shopping_items set expense_id=p_expense_id,version=version+1 where group_id=p_id and id=any(p_items);
 return result;
end $$;
revoke all on function public.divzplit_shopping_list(uuid),public.divzplit_shopping_action(uuid,text,jsonb),public.divzplit_shopping_checkout(uuid,bigint,jsonb,text,uuid[]) from public,anon;
grant execute on function public.divzplit_shopping_list(uuid),public.divzplit_shopping_action(uuid,text,jsonb),public.divzplit_shopping_checkout(uuid,bigint,jsonb,text,uuid[]) to authenticated;
notify pgrst,'reload schema';
commit;
