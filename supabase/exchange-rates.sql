-- European currencies and USD; final settlement conversion to EUR.
-- Run after the existing migrations. No keys or secrets.
begin;
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
