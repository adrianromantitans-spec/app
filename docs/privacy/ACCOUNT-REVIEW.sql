-- Read-only inventory for a VERIFIED privacy request. Administrator only.
-- Replace the sample UUID with the verified account UUID; never use a name match.
-- This does not execute erasure. Review the operational procedure first.
begin read only;
set local divzplit.review_user = '00000000-0000-0000-0000-000000000000';
select id,created_at from auth.users where id=current_setting('divzplit.review_user')::uuid;
select g.id,g.owner_id,g.version,jsonb_array_length(g.document->'members') as member_count
 from public.nexo_groups g where g.owner_id=current_setting('divzplit.review_user')::uuid
 or exists(select 1 from public.nexo_members m where m.group_id=g.id and m.user_id=current_setting('divzplit.review_user')::uuid);
select 'memberships' as kind,count(*) from public.nexo_members where user_id=current_setting('divzplit.review_user')::uuid
union all select 'shopping_authorship',count(*) from public.divzplit_shopping_items where created_by=current_setting('divzplit.review_user')::uuid
union all select 'payment_participation',count(*) from public.divzplit_payment_requests where from_id=current_setting('divzplit.review_user')::uuid or to_id=current_setting('divzplit.review_user')::uuid
union all select 'notifications',count(*) from public.divzplit_notifications where user_id=current_setting('divzplit.review_user')::uuid
union all select 'push_subscriptions',count(*) from public.divzplit_push_subscriptions where user_id=current_setting('divzplit.review_user')::uuid;
rollback;
