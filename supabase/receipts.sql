-- Run once in the Supabase SQL editor. Does not modify existing group data.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('divzplit-receipts','divzplit-receipts',false,1048576,array['image/jpeg'])
on conflict(id) do update set public=false,file_size_limit=1048576,allowed_mime_types=array['image/jpeg'];

create or replace function public.divzplit_receipt_access(object_name text,write_access boolean default false)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.nexo_groups g join public.nexo_members m on m.group_id=g.id
 where m.user_id=auth.uid() and g.id::text=split_part(object_name,'/',1)
 and (not write_access or split_part(object_name,'/',2)=auth.uid()::text));
$$;
revoke all on function public.divzplit_receipt_access(text,boolean) from public,anon;
grant execute on function public.divzplit_receipt_access(text,boolean) to authenticated;
drop policy if exists divzplit_receipt_read on storage.objects;
create policy divzplit_receipt_read on storage.objects for select to authenticated
 using(bucket_id='divzplit-receipts' and public.divzplit_receipt_access(name,false));
drop policy if exists divzplit_receipt_upload on storage.objects;
create policy divzplit_receipt_upload on storage.objects for insert to authenticated
 with check(bucket_id='divzplit-receipts' and public.divzplit_receipt_access(name,true)
 and name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}/[a-f0-9-]{36}\.jpg$');
drop policy if exists divzplit_receipt_delete on storage.objects;
create policy divzplit_receipt_delete on storage.objects for delete to authenticated
 using(bucket_id='divzplit-receipts' and public.divzplit_receipt_access(name,false)
 and (split_part(name,'/',2)=auth.uid()::text or exists(select 1 from public.nexo_groups g where g.id::text=split_part(name,'/',1) and g.owner_id=auth.uid())));
commit;
