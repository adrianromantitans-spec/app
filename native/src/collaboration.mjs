// Match the existing server's creator/owner policy; it remains authoritative.
export function canManage(group,user,item){return !!user&&(group?.remote?.ownerId===user.id||item?.createdBy===user.id||item?.created_by===user.id);}
export function planFields(kind,values,previous,group,planning,uid){
 if(!['tasks','polls'].includes(kind))throw new Error('Revisa la operación.');
 const title=String(values.title||'').trim();if(!title||title.length>120)throw new Error('Escribe un título de hasta 120 caracteres.');
 const item={id:values.id,title,...planning.planningFields(values,previous||{})};
 if(kind==='tasks'){
  if(!group.members.some(m=>m.id===values.assignee))throw new Error('Elige una persona del grupo.');
  item.assignee=values.assignee;
 }else{
  item.description=String(values.description||'').trim();if(item.description.length>160)throw new Error('La descripción admite hasta 160 caracteres.');
  if(previous)item.options=structuredClone(previous.options);
  else{
   if(!Array.isArray(values.options))throw new Error('Escribe al menos dos opciones diferentes.');
   const labels=values.options.map(o=>String(typeof o==='string'?o:o.label).trim()).filter(Boolean);
   if(labels.length<2||labels.length>6||labels.some(l=>l.length>100)||new Set(labels.map(l=>l.toLowerCase())).size!==labels.length)throw new Error('Escribe entre dos y seis opciones diferentes, de hasta 100 caracteres.');
   item.options=labels.map(label=>({id:uid(),label,emoji:''}));
  }
 }
 return item;
}
export function checkoutFields(items,selected,expenseId){
 if(!expenseId||!Array.isArray(selected)||!selected.length||selected.length>200||new Set(selected).size!==selected.length)throw new Error('Revisa los productos de la compra.');
 for(const id of selected){const row=items.find(i=>i.id===id);if(!row||!row.bought||(row.expense_id&&row.expense_id!==expenseId))throw new Error('La compra ha cambiado. Actualiza la lista antes de crear el gasto.');}
 return {expenseId,items:[...selected]};
}
// Native-only copy supplements the shared catalog without changing browser UI.
export const nativeCopy={
 'Escribe un título de hasta 120 caracteres.':{en:'Enter a title of up to 120 characters.',ro:'Introdu un titlu de cel mult 120 de caractere.'},
 'Elige una persona del grupo.':{en:'Choose a group member.',ro:'Alege un membru al grupului.'},
 'La descripción admite hasta 160 caracteres.':{en:'The description can contain up to 160 characters.',ro:'Descrierea poate conține cel mult 160 de caractere.'},
 'Escribe al menos dos opciones diferentes.':{en:'Enter at least two different options.',ro:'Introdu cel puțin două opțiuni diferite.'},
 'Escribe entre dos y seis opciones diferentes, de hasta 100 caracteres.':{en:'Enter two to six different options, each up to 100 characters.',ro:'Introdu între două și șase opțiuni diferite, fiecare de cel mult 100 de caractere.'},
 'Revisa los productos de la compra.':{en:'Review the shopping items.',ro:'Verifică produsele de pe listă.'},
 'La compra ha cambiado. Actualiza la lista antes de crear el gasto.':{en:'The shopping list has changed. Refresh it before creating the expense.',ro:'Lista de cumpărături s-a schimbat. Actualizeaz-o înainte de a crea cheltuiala.'},
 'Actualiza la lista de la compra.':{en:'Refresh the shopping list.',ro:'Actualizează lista de cumpărături.'},
 'El gasto se ha guardado. Actualiza la lista de la compra.':{en:'The expense was saved. Refresh the shopping list.',ro:'Cheltuiala a fost salvată. Actualizează lista de cumpărături.'},
 'La compra ha cambiado. Actualiza la lista antes de continuar.':{en:'The shopping list has changed. Refresh it before continuing.',ro:'Lista de cumpărături s-a schimbat. Actualizeaz-o înainte de a continua.'},
 'No tienes permiso para editar este producto.':{en:'You do not have permission to edit this item.',ro:'Nu ai permisiunea de a edita acest produs.'},
 'Este producto ya está vinculado a un gasto.':{en:'This item is already linked to an expense.',ro:'Acest produs este deja asociat unei cheltuieli.'},
 'Revisa el producto y la cantidad.':{en:'Check the product and quantity.',ro:'Verifică produsul și cantitatea.'},
 'No hay productos pendientes.':{en:'There are no pending items.',ro:'Nu există produse de cumpărat.'},
 'No tienes permiso para enviar este recordatorio.':{en:'You do not have permission to send this reminder.',ro:'Nu ai permisiunea de a trimite acest memento.'},
 'Este plan ya ha terminado.':{en:'This plan has already finished.',ro:'Acest plan s-a încheiat deja.'},
 'Este plan ya no existe. Actualiza el grupo.':{en:'This plan no longer exists. Refresh the group.',ro:'Acest plan nu mai există. Actualizează grupul.'},
 'No tienes permiso para editar este plan.':{en:'You do not have permission to edit this plan.',ro:'Nu ai permisiunea de a edita acest plan.'},
 'Se enviará un aviso a las personas con estos avisos activados.':{en:'A notification will be sent to members who have these alerts enabled.',ro:'Se va trimite o notificare membrilor care au activat aceste alerte.'},
 'La lista está vacía':{en:'The list is empty',ro:'Lista este goală'},
 'Vinculado a un gasto':{en:'Linked to an expense',ro:'Asociat unei cheltuieli'},
 '¿Borrar toda la lista?':{en:'Delete the entire list?',ro:'Ștergi întreaga listă?'},
 '¿Borrar este plan?':{en:'Delete this plan?',ro:'Ștergi acest plan?'},
 '¿Enviar recordatorio?':{en:'Send a reminder?',ro:'Trimiți un memento?'},
 'Elegir fecha y hora':{en:'Choose date and time',ro:'Alege data și ora'},
 'Quitar fecha':{en:'Remove date',ro:'Elimină data'}
};
