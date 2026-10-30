import test from 'node:test';
import assert from 'node:assert/strict';
import {splitAmount, balances, settlements, addExpense, vote, seed, totalSpent} from '../model.js';

test('equal splits preserve every cent, including amounts smaller than the group size', () => {
  assert.deepEqual(splitAmount(100, ['a','b','c']), {a:34,b:33,c:33});
  assert.deepEqual(splitAmount(1, ['a','b','c']), {a:1,b:0,c:0});
  for (let amount=1; amount<1000; amount++) assert.equal(Object.values(splitAmount(amount,['a','b','c'])).reduce((a,b)=>a+b,0),amount);
});
test('invalid amounts, empty selections and duplicate participants are rejected', () => {
  for (const amount of [0,-1,NaN,Infinity,1.5]) assert.throws(()=>splitAmount(amount,['you']));
  assert.throws(()=>splitAmount(100,[]));
  assert.throws(()=>splitAmount(100,['you','you']));
});
test('demo balances are zero-sum and exclude other groups', () => {
  const state=seed();const g=state.groups[0];
  assert.equal(totalSpent(g),85600);
  assert.deepEqual(balances(g),{you:26600,marta:-15000,pablo:9800,lucia:-21400});
  assert.equal(Object.values(balances(g)).reduce((a,b)=>a+b,0),0);
  assert.deepEqual(balances(state.groups[1]),{you:0,marta:0});
});
test('suggested payments completely settle the group without changing its spend', () => {
  const g=seed().groups[0];const spent=totalSpent(g);
  const payments=settlements(g);
  assert.equal(payments.length,3);
  assert.ok(payments.every(p=>p.amount>0&&p.from!==p.to));
  g.payments.push(...payments);
  assert.deepEqual(balances(g),{you:0,marta:0,pablo:0,lucia:0});
  assert.deepEqual(settlements(g),[]);
  assert.equal(totalSpent(g),spent);
});
test('partial returns reduce a debt by their exact amount', () => {
  const g=seed().groups[0];g.payments.push({from:'marta',to:'you',amount:1000});
  assert.equal(balances(g).marta,-14000);
  assert.equal(balances(g).you,25600);
});
test('an expense can be shared by a subset excluding the payer', () => {
  const g=seed().groups[0];g.expenses=[];
  addExpense(g,{title:'Taxi',amount:1001,payer:'you',participants:['marta','pablo'],category:'Transporte',date:'2026-10-30'});
  assert.deepEqual(balances(g),{you:1001,marta:-501,pablo:-500,lucia:0});
});
test('invalid expenses do not mutate the group', () => {
  const g=seed().groups[0];const initial=g.expenses.length;
  const valid={title:'Cena',amount:1000,payer:'you',participants:['you','marta'],category:'Comida',date:'2026-10-30'};
  for (const invalid of [{title:' '},{participants:[]},{payer:'outsider'},{participants:['outsider']},{amount:0},{date:'invalid'}]) assert.throws(()=>addExpense(g,{...valid,...invalid}));
  assert.equal(g.expenses.length,initial);
});
test('voting, changing and withdrawing a vote never duplicates it', () => {
  const poll=seed().groups[0].polls[0];
  vote(poll,'o1','you');assert.equal(Object.keys(poll.votes).length,4);
  vote(poll,'o2','you');assert.equal(poll.votes.you,'o2');assert.equal(Object.keys(poll.votes).length,4);
  vote(poll,'o2','you');assert.equal(poll.votes.you,undefined);
  vote(poll,'invalid','you');assert.equal(poll.votes.you,undefined);
});

test('currency defaults to EUR and supports RON without changing minor-unit calculations',async()=>{
 const {currencyOf,money,checkCurrencyChange}=await import('../model.js');
 const g=seed().groups[0];assert.equal(currencyOf(g),'EUR');
 const before=balances(g);g.currency='RON';assert.deepEqual(balances(g),before);
 assert.equal(money(1001,'RON'),new Intl.NumberFormat('es-ES',{style:'currency',currency:'RON',maximumFractionDigits:2}).format(10.01));
 assert.throws(()=>checkCurrencyChange(g,'EUR'));
 assert.throws(()=>checkCurrencyChange({expenses:[],payments:[{}]},'RON'));
 assert.doesNotThrow(()=>checkCurrencyChange({expenses:[],payments:[]},'RON'));
 assert.throws(()=>checkCurrencyChange(null,'USD'));
});
