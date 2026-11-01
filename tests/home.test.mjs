import test from 'node:test';
import assert from 'node:assert/strict';
import {homeSummary,groupMode,groupForMode,dayOffset} from '../home.js';
import {seed,balances} from '../model.js';
test('the home balance is the real ledger balance and the household share uses only the current month',()=>{
 const g=seed().groups[0];g.type='Convivencia';g.payments=[];g.expenses=[{id:'a',title:'A',amount:101,payer:'you',participants:['you','marta'],date:'2030-02-01'},{id:'b',title:'B',amount:200,payer:'marta',participants:['you','marta'],date:'2030-01-31'}];
 const original=structuredClone(g);const now=new Date('2030-02-15T12:00:00Z');
 const home=homeSummary(g,now);assert.equal(home.ownBalance,balances(g).you);assert.equal(home.ownShare,51);assert.deepEqual(g,original);
 g.type='Viaje';assert.equal(homeSummary(g,now).ownShare,151);
});
test('completed tasks and closed polls are excluded while actionable deadlines and personal tasks come first',()=>{
 const g=seed().groups[0];g.type='Viaje';g.tasks=[{id:'done',title:'Completed',assignee:'you',done:true,dueAt:'2030-02-01T10:00:00Z'},{id:'other',title:'Other',assignee:'marta',done:false,dueAt:'2030-02-15T14:00:00Z'},{id:'mine',title:'Mine',assignee:'you',done:false,dueAt:'2030-02-15T15:00:00Z'}];g.polls=[{id:'closed',title:'Closed',votes:{},dueAt:'2030-02-14T12:00:00Z'},{id:'later',title:'Later',votes:{},dueAt:'2030-02-17T12:00:00Z'}];
 const now=new Date('2030-02-15T12:00:00Z');assert.equal(homeSummary(g,now).highlight.item.id,'mine');
 g.tasks[1].important=true;assert.equal(homeSummary(g,now).highlight.item.id,'other');
 g.tasks.forEach(t=>t.done=true);assert.equal(homeSummary(g,now).highlight.item.id,'later');
 g.type='Convivencia';assert.equal(homeSummary(g,now).highlight,null);
});
test('Casa and Viaje select an existing remembered group without changing documents or trusting an unknown ID',()=>{
 const groups=seed().groups;const original=structuredClone(groups);assert.equal(groupMode(groups[0]),'travel');assert.equal(groupMode(groups[1]),'home');
 assert.equal(groupForMode(groups,'home','missing').id,groups[1].id);assert.equal(groupForMode(groups,'travel',groups[2].id).id,groups[2].id);
 assert.equal(groupForMode([groups[1]],'travel',groups[0].id),null);assert.deepEqual(groups,original);
});
test('deadline day labels use the device calendar across month and DST boundaries',()=>{
 const now=new Date(2030,2,30,12);const tomorrow=new Date(2030,2,31,12);const later=new Date(2030,3,1,12);
 assert.equal(dayOffset(tomorrow.toISOString(),now),1);assert.equal(dayOffset(later.toISOString(),now),2);assert.equal(dayOffset('not-a-date',now),null);
});
