import test from 'node:test';
import assert from 'node:assert/strict';
import {optionalBudget,planningFields,localDateTime,planClosed} from '../planning.js';
test('a blank budget means no limit; invalid and fractional monetary amounts fail',()=>{
 assert.equal(optionalBudget(''),0);assert.equal(optionalBudget(null),0);assert.equal(optionalBudget('100.25'),10025);
 for(const x of ['-1','0','0.99','1.001','Infinity','10000001'])assert.throws(()=>optionalBudget(x));
});
test('device-local dates round-trip to UTC, preserve existing seconds, and require a reminder before the deadline',()=>{
 const due='2030-12-01T18:00:12.345Z',remind='2030-12-01T17:00:00.000Z',now=Date.parse('2028-01-01');
 const fields=planningFields({dueAt:localDateTime(due),remindAt:localDateTime(remind),important:true},{dueAt:due,remindAt:remind},now);
 assert.deepEqual(fields,{dueAt:due,remindAt:remind,important:true});
 assert.throws(()=>planningFields({dueAt:'2030-02-30T12:00'}, {},now));
 assert.throws(()=>planningFields({dueAt:localDateTime(due),remindAt:localDateTime(due)}, {},now));
 assert.throws(()=>planningFields({remindAt:localDateTime(remind)}, {},now));
 assert.throws(()=>planningFields({dueAt:'2020-01-01T10:00'}, {},now));
 assert.equal(planClosed({dueAt:due},Date.parse(due)),true);assert.equal(planClosed({},Date.parse(due)),false);
 const past='2020-01-01T10:00:00.000Z';assert.equal(planningFields({dueAt:localDateTime(past)},{dueAt:past},now).dueAt,past);
});
