import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import {invitationURL,invitationCopy,shareHref,shareChannels,sharePaths} from '../../invitation-share.js';
import {NativeController} from '../src/session.mjs';
import {invitationMessage} from '../src/invitation-view.mjs';
import {nativeTemplate} from '../src/localization.mjs';
test('neutral share URLs keep secret tokens exclusively in the fragment and reject malformed tokens',()=>{
 const url=new URL(invitationURL('a'.repeat(64)));assert.equal(url.pathname,'/share/');assert.equal(url.search,'');assert.equal(url.hash,'#invite='+'a'.repeat(64));assert.throws(()=>invitationURL('not-a-token'));
});
test('native and web use the sender language and preserve opaque group names in all social messages',()=>{
 const name='Guardar {0} & <Family> 👩',url=invitationURL('a'.repeat(64));
 for(const language of ['es','en','ro']){const message=invitationCopy(language,name,url),c={ui:(s,...v)=>nativeTemplate(language,s,...v)};assert.equal(invitationMessage(c,name,url),message);assert.ok(message.includes(name));assert.ok(message.endsWith(url));assert.ok(!message.includes('Lo mejor pasa juntos'));
  const wa=new URL(shareHref('whatsapp',message,url));assert.equal(wa.searchParams.get('text'),message);
  const tg=new URL(shareHref('telegram',message,url));assert.equal(tg.searchParams.get('url'),url);assert.equal(tg.searchParams.get('text')+' '+url,message);
 }
 assert.equal(shareHref('instagram','message',url),null);assert.equal(shareHref('snapchat','message',url),null);assert.equal(shareChannels.length,4);for(const channel of shareChannels)assert.ok(sharePaths[channel]);
});
test('native accepts new neutral links and existing app/root invitations without changing the token',async()=>{
 for(const path of ['/share/','/app/','/']){const values=new Map(),cloud={user:null};const c=new NativeController({cloud,native:{},i18n:{language:'en'},platform:{storage:{getItem:()=>null},temporaryStorage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)},flush:async()=>{}}});assert.equal(await c.handleURL('https://divzplit.com'+path+'#invite='+'b'.repeat(64),false),true);assert.equal(values.get('native-invite'),'b'.repeat(64));assert.equal(cloud.user,null);}
});

test('share preview is brand-only and redirects only a validated token to the fixed app path',()=>{
 const html=readFileSync(new URL('../../share/index.html',import.meta.url),'utf8');assert.ok(html.includes('<title>DivZplit</title>'));assert.ok(html.includes('property="og:title" content="DivZplit"'));assert.ok(html.includes('property="og:description" content=""'));assert.ok(!html.includes('Lo mejor'));assert.equal(html.match(/<body>(.*?)<\/body>/s)[1],'<a href="/app/">DivZplit</a>');
 const source=readFileSync(new URL('../../share/redirect.js',import.meta.url),'utf8');for(const hash of ['#invite='+'a'.repeat(64),'#invite=https://evil.example','#invite=invalid','']){const calls=[];runInNewContext(source,{URLSearchParams,location:{hash,replace:value=>calls.push(value)}});assert.deepEqual(calls,hash==='#invite='+'a'.repeat(64)?['/app/#invite='+'a'.repeat(64)]:[]);}
});
