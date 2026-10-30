import test from 'node:test';
import assert from 'node:assert/strict';
import {seed,expenseShares,balances,settlements,addExpense,updateExpense,decimalUnits} from '../model.js';
import {materializeRecurring} from '../extras.js';
const expense=(mode,values,amount=1001)=>({amount,participants:['you','marta','pablo'],split:{mode,values}});
test('custom amounts and weighted splits preserve all cents, including tiny amounts',()=>{
 assert.deepEqual(expenseShares(expense('amounts',{you:501,marta:400,pablo:100})),{you:501,marta:400,pablo:100});
 assert.deepEqual(expenseShares(expense('percent',{you:5000,marta:2500,pablo:2500})),{you:501,marta:250,pablo:250});
 assert.deepEqual(expenseShares(expense('shares',{you:2,marta:1,pablo:1})),{you:501,marta:250,pablo:250});
 assert.deepEqual(expenseShares(expense('shares',{you:1,marta:1,pablo:1},2)),{you:1,marta:1,pablo:0});
 for(let amount=1;amount<1000;amount++)assert.equal(Object.values(expenseShares(expense('percent',{you:3334,marta:3333,pablo:3333},amount))).reduce((a,b)=>a+b,0),amount);
});
test('invalid totals, foreign IDs and fractional or negative parts are rejected',()=>{
 for(const [mode,values]of [['amounts',{you:1000,marta:0,pablo:0}],['percent',{you:3333,marta:3333,pablo:3333}],['shares',{you:0,marta:1,pablo:1}],['shares',{you:1.5,marta:1,pablo:1}],['amounts',{you:-1,marta:1000,pablo:2}],['percent',{you:5000,marta:5000,foreign:0}]])assert.throws(()=>expenseShares(expense(mode,values)));
 assert.equal(decimalUnits('12,34'),1234);assert.equal(decimalUnits('0.01'),1);
 for(const value of ['1.001','1e3','-1','',NaN])assert.throws(()=>decimalUnits(value));
});
test('edits keep identity and receipt metadata; invalid edits leave the expense unchanged',()=>{
 const g=seed().groups[0];const old=g.expenses[0];old.createdBy='author';old.receipt={path:'private/path'};
 const updated=updateExpense(g,old.id,{...old,title:'New title',amount:1001,participants:['you','marta','pablo'],split:{mode:'percent',values:{you:5000,marta:2500,pablo:2500}}});
 assert.equal(updated.id,old.id);assert.equal(updated.createdBy,'author');assert.deepEqual(updated.receipt,old.receipt);
 const before=structuredClone(g);
 assert.throws(()=>updateExpense(g,old.id,{...updated,amount:1,split:{mode:'amounts',values:{you:1,marta:1,pablo:1}}}));assert.deepEqual(g,before);
 const equal=updateExpense(g,old.id,{...updated,split:{mode:'equal'}});assert.equal(equal.split,undefined);
 assert.equal(Object.values(balances(g)).reduce((a,b)=>a+b,0),0);
 assert.ok(settlements(g).length>0);
});
test('recurring charges snapshot custom splits; editing the original does not change existing repeats',()=>{
 const g=seed().groups[1];const first=addExpense(g,{title:'Rent',amount:1001,payer:'you',participants:['you','marta'],category:'Alojamiento',date:'2026-01-31',split:{mode:'shares',values:{you:2,marta:1}}});
 first.recurrence={frequency:'monthly',nextDate:'2026-02-28',anchorDay:31,active:true};
 assert.equal(materializeRecurring(g,'2026-02-28'),1);
 const repeat=g.expenses[0];assert.deepEqual(repeat.split,first.split);assert.notEqual(repeat.split,first.split);
 updateExpense(g,first.id,{...first,amount:2000,split:{mode:'equal'}});assert.equal(repeat.amount,1001);assert.deepEqual(repeat.split.values,{you:2,marta:1});
 assert.throws(()=>updateExpense(g,first.id,{...first,date:'2026-02-01'}));
});
