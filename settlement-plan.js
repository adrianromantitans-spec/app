import {balances,settlements} from './model.js?v=expenses-83';

// A zero-sum component with k members can settle in at most k-1 direct
// transfers. Maximizing disjoint zero-sum components minimizes transfers.
const EXACT_LIMIT=18;
function match(entries){
 const debtors=entries.filter(([,v])=>v<0).map(([id,v])=>({id,left:-v}));
 const creditors=entries.filter(([,v])=>v>0).map(([id,v])=>({id,left:v}));
 const result=[];let cursor=0;
 for(const debtor of debtors)while(debtor.left){
  const creditor=creditors[cursor],amount=Math.min(debtor.left,creditor.left);
  result.push({from:debtor.id,to:creditor.id,amount});
  debtor.left-=amount;creditor.left-=amount;if(!creditor.left)cursor++;
 }
 return result;
}
function exactPlan(entries){
 const n=entries.length,size=2**n,sums=new Float64Array(size),groups=new Uint8Array(size),last=new Int8Array(size);
 for(let mask=1;mask<size;mask++){
  const bit=mask&-mask,index=31-Math.clz32(bit);
  sums[mask]=sums[mask^bit]+entries[index][1];
  let best=-1,chosen=0;
  for(let remaining=mask;remaining;remaining&=remaining-1){
   const single=remaining&-remaining,candidate=groups[mask^single];
   if(candidate>best){best=candidate;chosen=31-Math.clz32(single);}
  }
  groups[mask]=best+(sums[mask]===0?1:0);last[mask]=chosen;
 }
 const order=[];for(let mask=size-1;mask;){const i=last[mask];order.push(entries[i]);mask^=1<<i;}order.reverse();
 const transfers=[];let component=[],sum=0;
 for(const entry of order){component.push(entry);sum+=entry[1];if(sum===0){transfers.push(...match(component));component=[];}}
 return transfers;
}
function largePlan(entries){
 const left=entries.map(([id,amount],index)=>({id,amount,index})),paired=[];
 const creditors=new Map();
 for(const e of left)if(e.amount>0){const list=creditors.get(e.amount)||[];list.push(e);creditors.set(e.amount,list);}
 for(const d of left)if(d.amount<0){
  const c=creditors.get(-d.amount)?.shift();
  if(c){paired.push({from:d.id,to:c.id,amount:c.amount});d.amount=0;c.amount=0;}
 }
 const rest=left.filter(e=>e.amount).sort((a,b)=>Math.abs(b.amount)-Math.abs(a.amount)||a.index-b.index).map(e=>[e.id,e.amount]);
 return [...paired,...match(rest)];
}
export function settlementPlan(group){
 const basicTransfers=settlements(group),entries=Object.entries(balances(group)).filter(([,v])=>v!==0);
 if(entries.some(([,v])=>!Number.isSafeInteger(v))||entries.reduce((sum,[,v])=>sum+v,0)!==0)throw new Error('Invalid settlement balances');
 if(!entries.length)return {basicTransfers,transfers:[],exact:true};
 const exact=entries.length<=EXACT_LIMIT;
 const candidate=exact?exactPlan(entries):largePlan(entries);
 return {basicTransfers,transfers:candidate.length<=basicTransfers.length?candidate:basicTransfers,exact};
}
