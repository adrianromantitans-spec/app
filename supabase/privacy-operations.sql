-- Privacy tools for an existing DivZplit installation. Run after all current
-- migrations. No account, shared expense or confirmed payment is deleted.
begin;
create or replace function public.divzplit_privacy_export() returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); account_data jsonb; result jsonb;
begin
 if actor is null then raise exception 'NEXO_FORBIDDEN';end if;
 select jsonb_build_object('id',u.id,'email',to_jsonb(u)->'email','created_at',to_jsonb(u)->'created_at',
  'metadata',u.raw_user_meta_data) into account_data from auth.users u where u.id=actor;
 if account_data is null then raise exception 'NEXO_FORBIDDEN';end if;
 result:=jsonb_build_object('format','divzplit-account-export-v1','generated_at',clock_timestamp(),
  'account',account_data,
  'groups',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'owner_id',g.owner_id,'version',g.version,'document',g.document) order by g.id)
    from public.nexo_groups g where exists(select 1 from public.nexo_members m where m.group_id=g.id and m.user_id=actor)),'[]'::jsonb),
  'history',coalesce((select jsonb_agg(to_jsonb(h) order by h.created_at,h.id) from public.divzplit_history h
    where exists(select 1 from public.nexo_members m where m.group_id=h.group_id and m.user_id=actor)),'[]'::jsonb),
  'payment_requests',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at,p.id) from public.divzplit_payment_requests p
    where exists(select 1 from public.nexo_members m where m.group_id=p.group_id and m.user_id=actor)),'[]'::jsonb),
  'shopping',coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at,s.id) from public.divzplit_shopping_items s
    where exists(select 1 from public.nexo_members m where m.group_id=s.group_id and m.user_id=actor)),'[]'::jsonb),
  'notifications',coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at,n.id) from public.divzplit_notifications n where n.user_id=actor),'[]'::jsonb),
  'notification_settings',(select to_jsonb(s)-'user_id' from public.divzplit_notification_settings s where s.user_id=actor),
  'muted_groups',coalesce((select jsonb_agg(m.group_id order by m.group_id) from public.divzplit_muted_groups m where m.user_id=actor),'[]'::jsonb),
  'push_subscriptions',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'language',p.language,'enabled',p.enabled,'updated_at',p.updated_at) order by p.id)
    from public.divzplit_push_subscriptions p where p.user_id=actor),'[]'::jsonb),
  'scope',jsonb_build_object('shared_group_data',true,'receipt_images','References included; request the image files from support.',
   'provider_logs_and_backups','Not included; contact support for a full access request.'));
 return result;
end;
$$;
create or replace function public.divzplit_privacy_retention() returns jsonb
language plpgsql security definer set search_path='' as $$
declare notices bigint; jobs bigint; subscriptions bigint; quotes bigint; invites bigint;
begin
 -- Internal-only, scheduled below. No user-controlled identifiers or SQL.
 delete from public.divzplit_push_jobs where status in ('sent','discarded') and next_attempt_at<clock_timestamp()-interval '7 days';get diagnostics jobs=row_count;
 delete from public.divzplit_notifications where created_at<clock_timestamp()-interval '90 days';get diagnostics notices=row_count;
 delete from public.divzplit_push_subscriptions where not enabled and updated_at<clock_timestamp()-interval '30 days';get diagnostics subscriptions=row_count;
 delete from public.divzplit_fx_quotes where checked_at<clock_timestamp()-interval '2 days';get diagnostics quotes=row_count;
 delete from public.nexo_invites where expires_at<clock_timestamp()-interval '30 days';get diagnostics invites=row_count;
 return jsonb_build_object('notifications',notices,'terminal_push_jobs',jobs,'disabled_subscriptions',subscriptions,'expired_fx_quotes',quotes,'expired_invites',invites);
end;
$$;
revoke all on function public.divzplit_privacy_export(),public.divzplit_privacy_retention() from public,anon,authenticated;
grant execute on function public.divzplit_privacy_export() to authenticated;
grant execute on function public.divzplit_privacy_retention() to service_role;
do $$
begin
 if exists(select 1 from pg_available_extensions where name='pg_cron') then
  execute 'create extension if not exists pg_cron with schema pg_catalog';
  if not exists(select 1 from cron.job where jobname='divzplit-privacy-retention') then
   perform cron.schedule('divzplit-privacy-retention','17 3 * * *','select public.divzplit_privacy_retention();');
  end if;
 end if;
end;
$$;
notify pgrst, 'reload schema';
commit;
-- If pg_cron is unavailable, arrange a trusted daily execution manually.
-- Verify on Supabase: select jobname,active from cron.job where jobname='divzplit-privacy-retention';
