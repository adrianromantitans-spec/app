import test from 'node:test';
import assert from 'node:assert/strict';
import {nextOccurrence,materializeRecurring,receiptPath} from '../extras.js';
import {seed,totalSpent} from '../model.js';
test('month ends and leap years retain the original calendar anchor',()=>{
 assert.equal(nextOccurrence('2027-01-31','monthly'),'2027-02-28');
 assert.equal(nextOccurrence('2027-02-28','monthly',31),'2027-03-31');
 assert.equal(nextOccurrence('2028-02-29','yearly'),'2029-02-28');
 assert.equal(nextOccurrence('2027-12-29','weekly'),'2028-01-05');
 assert.throws(()=>nextOccurrence('2027-02-30','monthly'));
});
function fixture(){const g=seed().groups[0];g.expenses=[{...g.expenses[0],date:'2027-01-31',receipt:{path:'private/receipt'},recurrence:{frequency:'monthly',nextDate:'2027-02-28',anchorDay:31,active:true}}];return g;}
test('catch-up creates each due charge exactly once, never future charges or copied receipts',()=>{
 const g=fixture();assert.equal(materializeRecurring(g,'2027-03-30'),1);
 assert.equal(g.expenses[0].date,'2027-02-28');assert.equal(g.expenses[0].receipt,undefined);assert.equal(g.expenses[0].recurrence,undefined);
 assert.equal(materializeRecurring(g,'2027-03-30'),0);
 assert.equal(materializeRecurring(g,'2027-03-31'),1);
 assert.equal(totalSpent(g),48000*3);
});
test('unauthorized viewers and stopped series cannot generate charges; owner is recorded as author',()=>{
 const g=fixture();assert.equal(materializeRecurring(g,'2027-04-30',()=>false),0);
 assert.equal(materializeRecurring(g,'2027-04-30',()=>true,'owner-id'),3);assert.equal(g.expenses[0].createdBy,'owner-id');
 g.expenses.find(e=>e.recurrence).recurrence.active=false;
 assert.equal(materializeRecurring(g,'2028-01-01'),0);
});
test('receipt paths cannot escape a group or address arbitrary storage objects',()=>{
 const g='11111111-1111-4111-8111-111111111111',u='22222222-2222-4222-8222-222222222222',e='33333333-3333-4333-8333-333333333333';
 assert.equal(receiptPath(`${g}/${u}/${e}.jpg`,g),true);
 for(const p of [`${g}/../private.jpg`,`${u}/${g}/${e}.jpg`,'https://example.test/image.jpg',`${g}/${u}/${e}.svg`])assert.equal(receiptPath(p,g),false);
});
