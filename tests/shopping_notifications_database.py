"""Real PostgreSQL: optional shopping reminders, low-noise delivery and preferences."""
from pathlib import Path
exec(Path('tests/fx_database.py').read_text().split("sql((ROOT/'supabase/exchange-rates.sql')")[0])
sql((ROOT/'supabase/shopping-notifications.sql').read_text(),role=None)
OWNER,FRIEND,QUIET,MUTED,OUTSIDER=[str(uuid.uuid4()) for _ in range(5)]
for actor in [OWNER,FRIEND,QUIET,MUTED,OUTSIDER]:sql('insert into auth.users values ('+literal(actor)+",'{}')",role=None)
row=json.loads(rpc('nexo_create_group',[document({'name':'Compra tranquila','type':'Convivencia','emoji':'🏠','requestId':str(uuid.uuid4())})],OWNER));gid=row['id']
for actor in [FRIEND,QUIET,MUTED]:
 invite=json.loads(rpc('nexo_create_invite',[literal(gid)],OWNER));rpc('nexo_join_group',[literal(invite['token'])],actor)
def settings(actor=FRIEND):return json.loads(rpc('divzplit_get_notification_settings',[],actor))
def setpref(actor,shopping):return rpc('divzplit_set_notification_settings_v2',['true','true','true','true',str(shopping).lower(),'array[]::uuid[]'],actor)
def snapshot():return sql('select document from public.nexo_groups where id='+literal(gid),OWNER)
def count(actor,kind=None):
 return int(sql('select count(*) from public.divzplit_notifications where group_id='+literal(gid)+' and user_id='+literal(actor)+((' and kind='+literal(kind)) if kind else ''),role=None))
def add(title='Leche',actor=OWNER):
 i={'id':str(uuid.uuid4()),'title':title,'quantity':''};rpc('divzplit_shopping_action',[literal(gid),literal('add'),document(i)],actor);return i
def remind(actor=OWNER,request=None,fail=None):return rpc('divzplit_remind_shopping',[literal(gid),literal(request or str(uuid.uuid4()))],actor,fail)
assert settings()['shopping'] and settings()['shopping_ready']
setpref(QUIET,False)
sql('insert into public.divzplit_muted_groups values('+literal(MUTED)+','+literal(gid)+')',role=None)
sql("update public.divzplit_push_config set enabled=true,shopping_sender_ready=false,public_key="+literal('B'+'A'*86),role=None)
sub=str(uuid.uuid4())
sql('insert into public.divzplit_push_subscriptions(id,user_id,endpoint,p256dh,auth,language) values('+','.join(map(literal,[sub,FRIEND,'https://fcm.googleapis.com/fcm/send/'+sub,'A'*87,'B'*22,'es']))+')',role=None)
before=snapshot();i=add();assert snapshot()==before
assert count(FRIEND,'shopping.added')==1 and count(OWNER)==count(QUIET)==count(MUTED)==0
assert sql('select count(*) from public.divzplit_push_jobs where subscription_id='+literal(sub),role=None)=='0'
add('Pan');assert count(FRIEND,'shopping.added')==1
items=json.loads(rpc('divzplit_shopping_list',[literal(gid)],OWNER));item=next(x for x in items if x['id']==i['id'])
rpc('divzplit_shopping_action',[literal(gid),literal('check'),document(dict(item,bought=True))],FRIEND);assert count(FRIEND)==1
request=str(uuid.uuid4());assert remind(request=request)=='1' and count(FRIEND,'shopping.reminder')==1
assert remind(request=request)=='1' and count(FRIEND,'shopping.reminder')==1
remind(FRIEND,fail='NEXO_SHOPPING_REMINDER_WAIT');remind(OUTSIDER,fail='NEXO_FORBIDDEN')
sql('select public.divzplit_shopping_sender_ready()',FRIEND,fail='permission denied')
sql('select public.divzplit_shopping_sender_ready()',role='service_role')
sql('update public.divzplit_shopping_notice_throttle set last_added_at=clock_timestamp()-interval '+literal('6 minutes')+' where group_id='+literal(gid),role=None)
add('Café');assert count(FRIEND,'shopping.added')==2
assert sql('select count(*) from public.divzplit_push_jobs where subscription_id='+literal(sub),role=None)=='1'
setpref(FRIEND,False);assert not settings()['shopping'] and settings()['expenses']
assert sql("select count(*) from public.divzplit_push_jobs where subscription_id="+literal(sub)+" and status='pending'",role=None)=='0'
# Clearing the inbox does not reset the automatic notification throttle.
setpref(FRIEND,True)
sql('delete from public.divzplit_notifications where group_id='+literal(gid)+' and user_id='+literal(FRIEND)+' and kind='+literal('shopping.added'),role=None)
add('Arroz');assert count(FRIEND,'shopping.added')==0
setpref(FRIEND,False)
# A group member can remind manually after the shared cooldown. No self-alert.
sql('update public.divzplit_shopping_reminders set last_sent=clock_timestamp()-interval '+literal('16 minutes')+' where group_id='+literal(gid),role=None)
assert remind(FRIEND)=='1' and count(OWNER,'shopping.reminder')==1
assert snapshot()==before
sql('update public.divzplit_shopping_items set bought=true where group_id='+literal(gid),role=None)
remind(fail='NEXO_SHOPPING_EMPTY')
old=sum(count(u) for u in [OWNER,FRIEND,QUIET,MUTED])
sql((ROOT/'supabase/shopping-notifications.sql').read_text(),role=None)
assert sum(count(u) for u in [OWNER,FRIEND,QUIET,MUTED])==old and snapshot()==before
sql('delete from public.nexo_groups where id='+literal(gid),role=None)
print('PASS: no self-notices, preferences/mutes, 5-minute product throttle, explicit idempotent reminders, shared 15-minute cooldown, push readiness, queue opt-out, empty lists and zero financial mutation')
