-- Convert final payments to any supported currency. Existing debts stay in the group currency.
-- Uses the existing exchange-rates function; no new function deployment or secrets.
begin;
create or replace function public.divzplit_request_payment_fx(p_id uuid,p_version bigint,p_request_id uuid,p_to uuid,p_amount bigint,p_currency text,p_quote uuid,p_target_currency text,p_target_quote uuid,p_target_amount bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g public.nexo_groups; r public.divzplit_payment_requests; q public.divzplit_fx_quotes; tq public.divzplit_fx_quotes; br numeric:=1; tr numeric:=1; actor uuid:=auth.uid();
 reserved_from bigint; reserved_to bigint; converted bigint; snapshot jsonb;
begin
 if not public.nexo_is_member(p_id) then raise exception 'NEXO_FORBIDDEN';end if;
 select * into g from public.nexo_groups where id=p_id for update;
 select * into r from public.divzplit_payment_requests where id=p_request_id;
 if found then
  if r.group_id is distinct from p_id or r.from_id is distinct from actor or r.to_id is distinct from p_to or r.amount is distinct from p_amount or r.currency is distinct from p_currency
   or r.fx is null or r.fx->>'baseQuoteId' is distinct from p_quote::text or r.fx->>'targetQuoteId' is distinct from p_target_quote::text or r.fx->>'currency' is distinct from p_target_currency or (r.fx->>'amount')::bigint is distinct from p_target_amount then raise exception 'NEXO_FORBIDDEN';end if;
  return to_jsonb(r);
 end if;
 if g.version is distinct from p_version then raise exception 'NEXO_CONFLICT';end if;
 if p_request_id is null or p_to is null or p_to=actor or p_amount is null or p_amount not between 1 and 1000000000 or p_currency is distinct from coalesce(g.document->>'currency','EUR') then raise exception 'NEXO_PAYMENT_CHANGED';end if;
 if not exists(select 1 from public.nexo_members where group_id=p_id and user_id=p_to) then raise exception 'NEXO_FORBIDDEN';end if;
 if p_target_currency is null or p_target_currency=p_currency or p_target_currency not in ('EUR','RON','USD','GBP','CHF','PLN','CZK','HUF','SEK','DKK','NOK','ISK','ALL','BAM','MKD','RSD','MDL','UAH','RUB','BYN','TRY','GEL','AMD','AZN','GIP') then raise exception 'NEXO_CURRENCY';end if;
 if p_currency='EUR' then
  if p_quote is not null then raise exception 'NEXO_FX_EXPIRED';end if;
 else
  select * into q from public.divzplit_fx_quotes where id=p_quote and user_id=actor and currency=p_currency;
  if not found or q.expires_at<=clock_timestamp() then raise exception 'NEXO_FX_EXPIRED';end if;
  br:=q.rate;
 end if;
 if p_target_currency='EUR' then
  if p_target_quote is not null then raise exception 'NEXO_FX_EXPIRED';end if;
 else
  select * into tq from public.divzplit_fx_quotes where id=p_target_quote and user_id=actor and currency=p_target_currency;
  if not found or tq.expires_at<=clock_timestamp() then raise exception 'NEXO_FX_EXPIRED';end if;
  tr:=tq.rate;
 end if;
 converted:=round(p_amount::numeric*(case when p_target_currency='ISK' then 1 else 100 end)*tr/((case when p_currency='ISK' then 1 else 100 end)*br))::bigint;
 if converted<1 or converted>1000000000 or converted is distinct from p_target_amount then raise exception 'NEXO_FX_AMOUNT';end if;
 select coalesce(sum(amount) filter(where from_id=actor),0),coalesce(sum(amount) filter(where to_id=p_to),0)
 into reserved_from,reserved_to from public.divzplit_payment_requests where group_id=p_id and status='pending';
 if (select count(*) from public.divzplit_payment_requests where group_id=p_id and status='pending')>=100
  or p_amount>least(-public.divzplit_member_balance(g.document,actor::text)-reserved_from,public.divzplit_member_balance(g.document,p_to::text)-reserved_to) then raise exception 'NEXO_PAYMENT_CHANGED';end if;
 snapshot:=jsonb_build_object('baseQuoteId',q.id,'targetQuoteId',tq.id,'currency',p_target_currency,'amount',converted,'rate',round(br/tr,10)::text,
  'date',least(coalesce(q.rate_date,tq.rate_date),coalesce(tq.rate_date,q.rate_date)),
  'source',case when q.source is null then tq.source when tq.source is null or q.source=tq.source then q.source else 'ECB + ExchangeRate-API' end,
  'baseRate',br::text,'targetRate',tr::text,'baseDate',coalesce(q.rate_date,tq.rate_date),'targetDate',coalesce(tq.rate_date,q.rate_date),'checkedAt',greatest(q.checked_at,tq.checked_at));

 insert into public.divzplit_payment_requests(id,group_id,from_id,to_id,amount,currency,fx)
 values(p_request_id,p_id,actor,p_to,p_amount,p_currency,snapshot) returning * into r;
 perform public.divzplit_log(p_id,'payment.requested',r.id::text,null,to_jsonb(r));
 return to_jsonb(r);
end;
$$;

revoke all on function public.divzplit_request_payment_fx(uuid,bigint,uuid,uuid,bigint,text,uuid,text,uuid,bigint) from public,anon;
grant execute on function public.divzplit_request_payment_fx(uuid,bigint,uuid,uuid,bigint,text,uuid,text,uuid,bigint) to authenticated;
notify pgrst,'reload schema';
commit;
