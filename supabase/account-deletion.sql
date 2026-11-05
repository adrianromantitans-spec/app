-- Self-serve account deletion for Google Play and GDPR-style erasure.
-- Run once in the Supabase SQL editor after the current migrations.
-- Safe to run again. It does not delete other members' expenses or balances.
--
-- The auth user row is kept as an anonymized, banned key so shared ledgers
-- (payments, shopping authorship, membership) stay valid. Sign-in, email,
-- name, sessions and push data are removed. Groups with no other member are
-- deleted. Shared groups keep the person as "Cuenta eliminada".
begin;

create or replace function public.divzplit_delete_account() returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=auth.uid();
  rec record;
  members jsonb;
  successor uuid;
  solo uuid[]:='{}';
  gid uuid;
  shared_count integer:=0;
  removed_count integer:=0;
begin
  if actor is null then raise exception 'NEXO_FORBIDDEN'; end if;

  for rec in
    select g.id,g.owner_id,g.document
    from public.nexo_groups g
    where exists(select 1 from public.nexo_members m where m.group_id=g.id and m.user_id=actor)
    for update
  loop
    if not exists(select 1 from public.nexo_members m where m.group_id=rec.id and m.user_id<>actor) then
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
      from public.nexo_members m
      where m.group_id=rec.id and m.user_id<>actor
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
  if to_regclass('storage.objects') is not null then
    foreach gid in array solo loop
      delete from storage.objects
      where bucket_id='divzplit-receipts' and name like gid::text||'/%';
    end loop;
    if to_regclass('public.nexo_deleted_groups') is not null then
      update public.nexo_deleted_groups set cleaned_at=clock_timestamp()
      where owner_id=actor and id=any(solo) and cleaned_at is null;
    end if;
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

  return jsonb_build_object('deleted',true,'shared_groups',shared_count,'removed_groups',removed_count);
end;
$$;

revoke all on function public.divzplit_delete_account() from public,anon;
grant execute on function public.divzplit_delete_account() to authenticated;
notify pgrst, 'reload schema';
commit;
