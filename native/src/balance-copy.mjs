// Display copy only; never change balances or payment suggestions.
export function homeBalanceLabel(c,group,balances){
 const balance=balances.you||0;
 if(balance===0)return c.t('Todo al día');
 if(group.members.length===2){
  const other=group.members.find(member=>member.id!=='you');
  if(other){const name=c.memberName(other);return balance>0?c.ui`${name} te debe`:c.ui`Debes a ${name}`;}
 }
 const people=Object.entries(balances).filter(([id,value])=>id!=='you'&&(balance>0?value<0:value>0)).length;
 return balance>0?(people===1?c.t('Te debe 1 persona'):c.ui`Te deben ${people} personas`):(people===1?c.t('Debes a 1 persona'):c.ui`Debes a ${people} personas`);
}
