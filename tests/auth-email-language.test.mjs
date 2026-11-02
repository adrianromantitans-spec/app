import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

// Isolated browser locales exercise the actual outgoing signup request.
for(const [preferences,expected] of [[['es-ES'],'es'],[['ro-RO'],'ro'],[['en-US'],'en'],[['fr-FR'],'en'],[['fr-FR','ro-RO'],'ro']]){
 test('confirmation email metadata follows app locale: '+preferences.join(', '),()=>{
  const script=`
   globalThis.window={};
   Object.defineProperty(globalThis,'navigator',{value:{languages:${JSON.stringify(preferences)}}});
   const {Cloud}=await import('./cloud.js');
   let calls=0;
   const client=new Cloud({url:'https://fixture.supabase.co',publishableKey:'sb_publishable_fixture'},{storage:{getItem:()=>null},fetcher:async(url,options)=>{
    calls++;console.log(JSON.stringify({url,body:JSON.parse(options.body)}));
    return new Response(JSON.stringify({user:{id:'fixture'}}),{status:200});
   }});
   if(await client.signUp('fixture@example.test','fixture-password','Ana','https://example.test/app/'))throw new Error('Invented session');
   if(calls!==1||client.session||client.user)throw new Error('Unexpected signup side effects');
  `;
  const sent=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',script],{cwd:new URL('../',import.meta.url),encoding:'utf8'}));
  assert.deepEqual(sent.body.data,{display_name:'Ana',notification_intro_pending:true,language:expected});
  assert.equal(new URL(sent.url).searchParams.get('redirect_to'),'https://example.test/app/');
 });
}
