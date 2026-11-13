import test from 'node:test';
import assert from 'node:assert/strict';
import {activitySummary,activityChartView,activityTimelineView} from '../activity-overview.js';
const group=()=>({currency:'EUR',members:[{id:'you',name:'Tú'},{id:'a',name:'Ana'}],expenses:[
 {id:'one',title:'Dinner',amount:101,payer:'you',category:'Comida',date:'2026-11-01',participants:['you','a']},
 {id:'two',title:'Stay',amount:901,payer:'a',category:'Alojamiento',date:'2026-11-02',participants:['you','a'],split:{mode:'amounts',values:{you:201,a:700}}},
 {id:'three',title:'Taxi',amount:50,payer:'a',category:'Comida',date:'2026-11-03',participants:['a']}
],payments:[]});
test('overview preserves cents and real custom shares; repayments do not inflate spending',()=>{
 const g=group(),before=structuredClone(g);const result=activitySummary(g);
 assert.equal(result.total,1052);assert.equal(result.ownShare,252);assert.equal(result.count,3);
 assert.deepEqual(result.categories,[{key:'Alojamiento',amount:901},{key:'Comida',amount:151}]);
 assert.deepEqual(result.payers,[{key:'a',amount:951},{key:'you',amount:101}]);
 assert.deepEqual(g,before);g.payments=[{from:'a',to:'you',amount:5000}];assert.deepEqual(activitySummary(g),result);
 for(const mode of ['percent','shares']){
  g.expenses=[{...g.expenses[0],amount:1001,split:{mode,values:mode==='percent'?{you:5000,a:5000}:{you:1,a:1}}}];
  assert.equal(activitySummary(g).ownShare,501);
 }
});
test('an empty group has no invented activity or non-finite chart segments',()=>{
 const g={...group(),expenses:[]};assert.deepEqual(activitySummary(g),{total:0,ownShare:0,count:0,categories:[],payers:[]});
 for(const mode of ['categories','people']){const html=activityChartView(g,{mode});assert.doesNotMatch(html,/NaN|Infinity|conic-gradient/);assert.match(html,/Todavía no hay gastos/);}
});
test('charts use the group currency, distinguish payer from viewer share and safely ignore stale selections',()=>{
 const g=group();g.currency='ISK';
 const html=activityChartView(g,{mode:'people',selection:'you'});assert.match(html,/Pagado por ti/);assert.match(html,/101/);assert.match(html,/#187552/);assert.doesNotMatch(html,/252/);
 assert.match(activityChartView(g,{mode:'people',selection:'absent'}),/Total del grupo/);
 assert.doesNotMatch(activityChartView(g,{mode:'categories'}),/#187552/);
});
test('user names, categories and audit snapshots remain escaped in chart and timeline markup',()=>{
 const g=group();g.members[1].name='<img src=x onerror=alert(1)>';g.expenses[0].category='Food"<script>x</script>';
 const chart=activityChartView(g,{mode:'people'});assert.doesNotMatch(chart,/<img src=x/);assert.match(chart,/&lt;img/);
 assert.doesNotMatch(activityChartView(g),/<script>/);
 const events=[{id:'old',kind:'expenses.deleted',actor_name:'<b>Ana</b>',created_at:'2026-11-01T10:00:00Z',currency:'USD',before_data:{title:'<script>x</script>',amount:99,payer:'viewer'}},
 {id:'new',kind:'expenses.added',actor_name:'Ana',created_at:'2026-11-02T10:00:00Z',currency:'EUR',after_data:{title:'Latest',amount:120,payer:'a'}}];
 const html=activityTimelineView(g,events,{name:id=>id,viewerId:'viewer'});
 assert.ok(html.indexOf('Latest')<html.indexOf('&lt;script&gt;'));assert.doesNotMatch(html,/<script>|<b>Ana/);assert.match(html,/self/);assert.match(html,/US\$|USD|\$/);
 assert.match(activityTimelineView(g,[],{name:id=>id}),/Pagado por/);
});
