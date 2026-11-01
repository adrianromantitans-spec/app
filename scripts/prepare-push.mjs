// Creates local deployment secrets, never prints them and never calls a service.
import {createECDH,randomBytes} from 'node:crypto';
import {mkdir,writeFile,access} from 'node:fs/promises';
import path from 'node:path';
const project=process.argv[2],directory=path.resolve(process.argv[3]||'.push-setup');
if(!/^[a-z0-9]{20}$/.test(project||'')){process.stderr.write('Uso: node scripts/prepare-push.mjs REFERENCIA_SUPABASE [carpeta]\n');process.exit(1);}
try{await access(directory);process.stderr.write('La carpeta ya existe. Se conservan las claves anteriores.\n');process.exit(1);}catch{}
await mkdir(directory,{mode:0o700});
const key=createECDH('prime256v1');key.generateKeys();
const publicKey=key.getPublicKey().toString('base64url'),privateKey=key.getPrivateKey().toString('base64url'),dispatchKey=randomBytes(32).toString('base64url');
await writeFile(path.join(directory,'push.env'),`VAPID_PUBLIC_KEY=${publicKey}\nVAPID_PRIVATE_KEY=${privateKey}\nVAPID_SUBJECT=https://adrianromantitans-spec.github.io/app/\nPUSH_DISPATCH_SECRET=${dispatchKey}\n`,{mode:0o600});
const sql=`-- PRIVATE: contains the dispatch credential. Keep out of GitHub and chat.
-- Deploy the Edge Function and set its secrets BEFORE running this file.
begin;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;
do $$
declare secret_id uuid; job record;
begin
 select id into secret_id from vault.secrets where name='divzplit_push_dispatch';
 if secret_id is null then perform vault.create_secret('${dispatchKey}','divzplit_push_dispatch');
 else perform vault.update_secret(secret_id,'${dispatchKey}');end if;
 for job in select jobid from cron.job where jobname='divzplit-push-dispatch' loop perform cron.unschedule(job.jobid);end loop;
end;
$$;
select cron.schedule('divzplit-push-dispatch','* * * * *',$cron$
 select net.http_post(
  url:='https://${project}.supabase.co/functions/v1/push-dispatch',
  headers:=jsonb_build_object('Content-Type','application/json','x-dispatch-key',(select decrypted_secret from vault.decrypted_secrets where name='divzplit_push_dispatch')),
  body:='{}'::jsonb,timeout_milliseconds:=120000
 );
$cron$);
update public.divzplit_push_config set public_key='${publicKey}',enabled=true where id;
commit;
`;
await writeFile(path.join(directory,'activate-push.sql'),sql,{mode:0o600});
process.stdout.write('Preparación creada. Los archivos privados están en '+directory+'; las claves no se muestran.\n');
