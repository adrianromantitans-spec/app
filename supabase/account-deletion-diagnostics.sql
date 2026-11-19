-- READ ONLY: run in SQL Editor to inspect deployment, without deleting any account.
select current_user as sql_editor_role,
 to_regprocedure('public.divzplit_delete_account()') is not null as deletion_function_installed;
select pg_get_userbyid(p.proowner) as routine_owner,p.prosecdef as security_definer,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_can_execute,
 has_table_privilege(pg_get_userbyid(p.proowner),'auth.users','SELECT') as owner_can_read_auth_users,
 has_table_privilege(pg_get_userbyid(p.proowner),'auth.users','UPDATE') as owner_can_update_auth_users,
 position('delete from storage.objects' in lower(pg_get_functiondef(p.oid)))>0 as contains_blocked_storage_delete,
 position('receipt_cleanup_pending_groups' in pg_get_functiondef(p.oid))>0 as updated_cleanup_behavior
from pg_proc p where p.oid=to_regprocedure('public.divzplit_delete_account()');
select c.conrelid::regclass as referencing_table,c.conname as foreign_key
from pg_constraint c where c.contype='f' and c.confrelid='auth.users'::regclass
order by 1,2;
select t.tgrelid::regclass as guarded_table,t.tgname as trigger_name
from pg_trigger t where not t.tgisinternal
 and t.tgrelid in (to_regclass('storage.objects'),to_regclass('public.nexo_members'))
order by 1,2;
