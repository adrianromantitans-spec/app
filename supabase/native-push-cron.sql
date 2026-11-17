-- Review/run only AFTER deploying native-push-dispatch and configuring its secrets.
-- Reuses the existing Web Push dispatch secret; does not rotate it or alter its cron.
begin;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;
do $$
declare job record;
begin
 if not exists(select 1 from vault.decrypted_secrets where name='divzplit_push_dispatch' and length(decrypted_secret)>=32) then
  raise exception 'Configure Vault divzplit_push_dispatch and the identical Edge secret PUSH_DISPATCH_SECRET first';
 end if;
 for job in select jobid from cron.job where jobname='divzplit-native-push-dispatch' loop perform cron.unschedule(job.jobid);end loop;
end;
$$;
select cron.schedule('divzplit-native-push-dispatch','* * * * *',$cron$
 select net.http_post(
  url:='https://xvtqmmpufvmyuokpmjvf.supabase.co/functions/v1/native-push-dispatch',
  headers:=jsonb_build_object('Content-Type','application/json','x-dispatch-key',(select decrypted_secret from vault.decrypted_secrets where name='divzplit_push_dispatch')),
  body:='{}'::jsonb,timeout_milliseconds:=120000
 );
$cron$);
update public.divzplit_native_push_config set enabled=true where id;
commit;
