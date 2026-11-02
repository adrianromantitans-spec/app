import test from 'node:test';
import assert from 'node:assert/strict';
import {settlementPlan} from '../settlement-plan.js';
import {balances} from '../model.js';
function groupFor(values){
 const members=values.map((_,i)=>({id:'m'+i})),debt=values.map(v=>Math.max(0,-v)),credit=values.map(v=>Math.max(0,v)),expenses=[];
 for(let d=0;d<values.length;d++)for(let c=0;c<values.length;c++){
  const amount=Math.min(debt[d],credit[c]);if(!amount)continue;
  expenses.push({id:'e'+expenses.length,title:'Gasto',amount,payer:members[c].id,participants:[members[d].id],date:'2026-11-02',category:'Otros'});
  debt[d]-=amount;credit[c]-=amount;
 }
 return {id:'test',currency:'RON',members,expenses,payments:[]};
}
function assertPreserved(g,plan){
 const before=balances(g),after={...before};
 for(const t of plan.transfers){
  assert.ok(Number.isSafeInteger(t.amount)&&t.amount>0);
  assert.ok(before[t.from]<0&&before[t.to]>0,'no intermediary');
  after[t.from]+=t.amount;after[t.to]-=t.amount;
 }
 assert.ok(Object.values(after).every(v=>v===0));
 assert.ok(plan.transfers.length<=plan.basicTransfers.length);
}
function bruteMinimum(values){
 const pending=values.filter(Boolean);
 function solve(start){
  while(start<pending.length&&!pending[start])start++;
  if(start===pending.length)return 0;
  let best=Infinity;const original=pending[start],seen=new Set();
  for(let i=start+1;i<pending.length;i++)if(original*pending[i]<0&&!seen.has(pending[i])){
   seen.add(pending[i]);const old=pending[i];pending[i]+=original;best=Math.min(best,1+solve(start+1));pending[i]=old;
  }
  return best;
 }
 return solve(0);
}
test('eight members settle with four direct payments instead of seven',()=>{
 const g=groupFor([-800,-700,-500,-400,400,500,700,800]),saved=JSON.stringify(g),plan=settlementPlan(g);
 assert.equal(plan.basicTransfers.length,7);assert.equal(plan.transfers.length,4);assert.equal(plan.exact,true);
 assertPreserved(g,plan);assert.equal(JSON.stringify(g),saved);
 assert.deepEqual(settlementPlan(g),plan);
});
test('zero-sum partitions find the true minimum, verified against independent exhaustive search',()=>{
 let state=71;const random=()=>{state=(state*48271)%2147483647;return state;};
 for(let trial=0;trial<100;trial++){
  const n=3+random()%6,values=Array.from({length:n-1},()=>random()%19-9);values.push(-values.reduce((a,b)=>a+b,0));
  const g=groupFor(values),plan=settlementPlan(g);assertPreserved(g,plan);
  assert.equal(plan.transfers.length,bruteMinimum(values),values.join(','));
 }
});
test('pending payments are reserved without changing the confirmed ledger',()=>{
 const g=groupFor([-800,-700,-500,-400,400,500,700,800]),baseline=JSON.stringify(g);
 const pending={from:'m0',to:'m7',amount:800};
 const reserved={...g,payments:[pending]},plan=settlementPlan(reserved);
 assert.equal(plan.transfers.length,3);
 assert.ok(plan.transfers.every(t=>t.from!=='m0'&&t.to!=='m7'));assertPreserved(reserved,plan);
 assert.equal(JSON.stringify(g),baseline);
});
test('zero balances disappear and one debtor may need more than one recipient',()=>{
 assert.deepEqual(settlementPlan(groupFor([0,0])).transfers,[]);
 const g=groupFor([-200,50,150,0]),plan=settlementPlan(g);assert.equal(plan.transfers.length,2);assertPreserved(g,plan);
});
test('larger groups use bounded work while preserving cents and never increasing transfer count',()=>{
 const values=[...Array(24).fill(-101),...Array(24).fill(101)],g=groupFor(values),plan=settlementPlan(g);
 assert.equal(plan.exact,false);assert.equal(plan.transfers.length,24);assertPreserved(g,plan);
});
