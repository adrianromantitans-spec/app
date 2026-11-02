import {balances,expenseShares} from './model.js?v=simplify-42';
export const groupMode=g=>g?.type==='Viaje'?'travel':'home';
export function dayOffset(iso,now=new Date()) {
 const date=new Date(iso);if(!Number.isFinite(date.getTime()))return null;
 return Math.round((Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())-Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()))/86400000);
}
export function homeSummary(g,now=new Date()) {
 const month=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
 const travel=groupMode(g)==='travel';
 const ownShare=g.expenses.filter(e=>travel||e.date.startsWith(month)).reduce((sum,e)=>sum+(expenseShares(e).you||0),0);
 const candidates=[...g.tasks.filter(t=>!t.done).map(item=>({kind:'tasks',item})),...(travel?g.polls.filter(p=>!p.dueAt||Date.parse(p.dueAt)>now.getTime()).map(item=>({kind:'polls',item})):[])];
 const priority=({item,kind})=>{
  const day=item.dueAt?dayOffset(item.dueAt,now):null;
  return [day!==null&&day<0?0:day===0?1:day===1?2:day!==null?3:4,item.important?0:1,kind==='tasks'?(item.assignee==='you'?0:1):(!item.votes.you?0:1),item.dueAt?Date.parse(item.dueAt):Infinity];
 };
 const highlights=candidates.map((entry,index)=>({...entry,index})).sort((a,b)=>{const left=priority(a),right=priority(b);for(let i=0;i<left.length;i++){if(left[i]!==right[i])return left[i]<right[i]?-1:1;}return a.index-b.index;});
 return {travel,ownBalance:balances(g).you||0,ownShare,highlight:highlights[0]||null};
}
export function groupForMode(groups,mode,rememberedId) {
 return groups.find(g=>g.id===rememberedId&&groupMode(g)===mode)||groups.find(g=>groupMode(g)===mode)||null;
}
