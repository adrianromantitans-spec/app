import test from 'node:test';
import assert from 'node:assert/strict';
import {invitationMessage,invitationResult} from '../src/invitation-view.mjs';
import {fxPresentation,currencyOption} from '../src/fx-view.mjs';
import {nativeTemplate,nativeText} from '../src/localization.mjs';
import * as fxTools from '../../fx.js';
const quote=(currency,rate,date='2026-11-17',source='ECB')=>({id:'11111111-1111-4111-8111-111111111111',currency,rate,rate_date:date,source,expires_at:'2099-01-01T00:00:00Z'});
test('WhatsApp copy localizes UI, keeps names/tokens opaque and uses the exact generated URL',()=>{
 const url=invitationResult({token:'a'.repeat(64),expires_at:'2099-01-01T00:00:00Z'},'g').url;
 for(const language of ['es','en','ro']){const c={ui:(strings,...values)=>nativeTemplate(language,strings,...values)},message=invitationMessage(c,'Guardar {0} & Familia 👩',url);assert.ok(message.includes('Guardar {0} & Familia 👩'));assert.ok(message.endsWith(url));assert.ok(language==='es'||!message.includes('Únete a'));assert.notEqual(nativeText('Moneda original',language),language==='es'?'not a key':'Moneda original');}
});
test('FX display matches 1 target = rate base, with quote date and source, without changing values',()=>{
 const group={id:'g',currency:'RON'},fx={groupId:'g',target:'USD',baseQuote:quote('RON','5','2026-11-16'),targetQuote:quote('USD','1.25','2026-11-17','ExchangeRate-API')};const before=JSON.stringify(fx);
 const detail=fxPresentation(fx,group,fxTools,'en-GB');assert.equal(detail.rate,'4');assert.equal(detail.base,'RON');assert.equal(detail.target,'USD');assert.equal(detail.dates,'RON: 2026-11-16 · USD: 2026-11-17');assert.equal(detail.source,'ECB + ExchangeRate-API');assert.equal(JSON.stringify(fx),before);
 assert.equal(fxTools.convertedAmount(10000,'RON','USD','5','1.25'),2500);
 const euro=fxPresentation({groupId:'g',target:'USD',baseQuote:null,targetQuote:quote('USD','1.25')},{id:'g',currency:'EUR'},fxTools,'en-GB');assert.equal(euro.rate,'0.8');assert.equal(euro.source,'BCE / ECB');
});
test('FX details never display another group, pending, invalid or expired conversion',()=>{
 const group={id:'g',currency:'EUR'},fx={groupId:'g',target:'USD',baseQuote:null,targetQuote:quote('USD','1.25')};
 for(const value of [null,{...fx,groupId:'other'},{...fx,loading:true},{...fx,error:'offline'},{...fx,targetQuote:{...fx.targetQuote,expires_at:'2000-01-01T00:00:00Z'}}])assert.equal(fxPresentation(value,group,fxTools,'es-ES'),null);
 assert.ok(currencyOption('USD','ro-RO').startsWith('USD · '));
});
