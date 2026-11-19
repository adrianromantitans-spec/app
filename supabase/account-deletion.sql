-- Self-serve account deletion for Google Play and GDPR-style erasure.
-- Run once in the Supabase SQL editor after the current migrations.
-- Safe to run again. It does not delete other members' expenses or balances.
--
-- The auth user row is kept as an anonymized, banned key so shared ledgers
-- (payments, shopping authorship, membership) stay valid. Sign-in, email,
-- name, active memberships, sessions and push data are removed. Receipt files
-- remain pending until removed through the Storage API. Groups with no other member are
-- deleted. Shared groups keep the person as "Cuenta eliminada".
begin;

-- Cached JWTs must not recover group access or create a new membership after deletion.
create or replace function public.nexo_is_member(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.nexo_members m join auth.users u on u.id=m.user_id
  where m.group_id=p_id and m.user_id=auth.uid()
    and coalesce(to_jsonb(u)->'raw_app_meta_data'->>'deleted','false')<>'true');
$$;
revoke all on function public.nexo_is_member(uuid) from public,anon;
grant execute on function public.nexo_is_member(uuid) to authenticated;

create or replace function public.divzplit_reject_deleted_membership() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from auth.users u where u.id=new.user_id
   and to_jsonb(u)->'raw_app_meta_data'->>'deleted'='true') then
   raise exception 'NEXO_FORBIDDEN';
 end if;
 return new;
end;
$$;
revoke all on function public.divzplit_reject_deleted_membership() from public,anon,authenticated;
drop trigger if exists divzplit_reject_deleted_membership on public.nexo_members;
create trigger divzplit_reject_deleted_membership before insert or update on public.nexo_members
 for each row execute function public.divzplit_reject_deleted_membership();

create or replace function public.divzplit_delete_account() returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=auth.uid();
  rec record;
  members jsonb;
  successor uuid;
  solo uuid[]:='{}';
  shared_count integer:=0;
  removed_count integer:=0;
  pending_cleanup integer:=0;
begin
  if actor is null then raise exception 'NEXO_FORBIDDEN'; end if;

  for rec in
    select g.id,g.owner_id,g.document
    from public.nexo_groups g
    where exists(select 1 from public.nexo_members m where m.group_id=g.id and m.user_id=actor)
    for update
  loop
    if not exists(select 1 from public.nexo_members m join auth.users u on u.id=m.user_id
      where m.group_id=rec.id and m.user_id<>actor
        and coalesce(to_jsonb(u)->'raw_app_meta_data'->>'deleted','false')<>'true') then
      solo:=solo||rec.id;
      continue;
    end if;
    select coalesce(jsonb_agg(
      case when elem->>'id'=actor::text
        then (elem-'email')||jsonb_build_object('name','Cuenta eliminada','initials','·')
        else elem end
      order by ord), '[]'::jsonb)
    into members
    from jsonb_array_elements(rec.document->'members') with ordinality as t(elem,ord);
    update public.nexo_groups
      set document=jsonb_set(rec.document,'{members}',members), version=version+1
      where id=rec.id;
    if rec.owner_id=actor then
      select m.user_id into successor
      from public.nexo_members m join auth.users u on u.id=m.user_id
      where m.group_id=rec.id and m.user_id<>actor
        and coalesce(to_jsonb(u)->'raw_app_meta_data'->>'deleted','false')<>'true'
      order by m.user_id
      limit 1;
      if successor is null then raise exception 'NEXO_DELETE_OWNER'; end if;
      update public.nexo_groups set owner_id=successor where id=rec.id;
    end if;
    shared_count:=shared_count+1;
  end loop;

  if to_regclass('public.nexo_deleted_groups') is not null then
    insert into public.nexo_deleted_groups(id,owner_id)
    select s.id,actor from unnest(solo) as s(id)
    on conflict(id) do nothing;
  end if;
  delete from public.nexo_groups where id=any(solo);
  get diagnostics removed_count=row_count;
  -- Managed Storage rejects direct DELETE; metadata deletion would not remove
  -- the underlying file either. Keep pending tombstones for Storage API cleanup.
  if to_regclass('storage.objects') is not null and to_regclass('public.nexo_deleted_groups') is not null then
    update public.nexo_deleted_groups d set cleaned_at=clock_timestamp()
    where d.owner_id=actor and d.id=any(solo) and d.cleaned_at is null
      and not exists(select 1 from storage.objects o where o.bucket_id='divzplit-receipts' and o.name like d.id::text||'/%');
  end if;
  -- Pending requests are not confirmed payments; close them without editing the ledger.
  if to_regclass('public.divzplit_payment_requests') is not null then
    update public.divzplit_payment_requests set status='cancelled',resolved_at=clock_timestamp()
    where status='pending' and (from_id=actor or to_id=actor);
  end if;
  -- Historical document members retain their ledger identifiers, not active access.
  delete from public.nexo_members where user_id=actor;

  if to_regclass('public.divzplit_native_subscriptions') is not null then
    delete from public.divzplit_native_subscriptions where user_id=actor;
  end if;
  if to_regclass('public.divzplit_push_subscriptions') is not null then
    delete from public.divzplit_push_subscriptions where user_id=actor;
  end if;
  if to_regclass('public.divzplit_notifications') is not null then
    delete from public.divzplit_notifications where user_id=actor;
  end if;
  if to_regclass('public.divzplit_notification_settings') is not null then
    delete from public.divzplit_notification_settings where user_id=actor;
  end if;
  if to_regclass('public.divzplit_muted_groups') is not null then
    delete from public.divzplit_muted_groups where user_id=actor;
  end if;
  if to_regclass('public.divzplit_fx_quotes') is not null then
    delete from public.divzplit_fx_quotes where user_id=actor;
  end if;
  if to_regclass('public.divzplit_shopping_notice_throttle') is not null then
    delete from public.divzplit_shopping_notice_throttle where user_id=actor;
  end if;
  if to_regclass('public.divzplit_history') is not null then
    update public.divzplit_history set actor_id=null, actor_name='Cuenta eliminada' where actor_id=actor;
  end if;

  if to_regclass('auth.mfa_challenges') is not null and to_regclass('auth.mfa_factors') is not null then
    delete from auth.mfa_challenges where factor_id in (select id from auth.mfa_factors where user_id=actor);
  end if;
  if to_regclass('auth.mfa_factors') is not null then
    delete from auth.mfa_factors where user_id=actor;
  end if;
  if to_regclass('auth.sessions') is not null then
    delete from auth.sessions where user_id=actor;
  end if;
  if to_regclass('auth.refresh_tokens') is not null then
    delete from auth.refresh_tokens where user_id::text=actor::text;
  end if;
  if to_regclass('auth.identities') is not null then
    delete from auth.identities where user_id=actor;
  end if;
  if to_regclass('auth.one_time_tokens') is not null then
    delete from auth.one_time_tokens where user_id=actor;
  end if;

  update auth.users set
    email='deleted+'||id::text||'@users.divzplit.invalid',
    phone=null,
    encrypted_password='',
    email_confirmed_at=null,
    raw_user_meta_data='{}'::jsonb,
    raw_app_meta_data=coalesce(raw_app_meta_data,'{}'::jsonb)||jsonb_build_object('deleted',true),
    banned_until='infinity',
    confirmation_token='',
    recovery_token='',
    email_change='',
    email_change_token_new='',
    email_change_token_current=''
  where id=actor;

  if to_regclass('public.nexo_deleted_groups') is not null then
    select count(*) into pending_cleanup from public.nexo_deleted_groups where owner_id=actor and cleaned_at is null;
  end if;
  return jsonb_build_object('deleted',true,'shared_groups',shared_count,'removed_groups',removed_count,'receipt_cleanup_pending_groups',pending_cleanup);
end;
$$;

revoke all on function public.divzplit_delete_account() from public,anon;
grant execute on function public.divzplit_delete_account() to authenticated;
notify pgrst, 'reload schema';
commit;
