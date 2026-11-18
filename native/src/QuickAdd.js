import React from 'react';
import {Pressable,StyleSheet,View} from 'react-native';
import {Icon} from './icons';
import {palette} from './design.mjs';
// Same actions, copy and visual hierarchy as the mobile web quick-add sheet.
export default function QuickAdd({c,ui,onExpense,onTask,onPoll,onShopping,onGroup,onJoin}){
 const {Label,Select}=ui,g=c.group,t=v=>c.t(v);
 const action=(id,icon,title,description,onPress,primary=false)=><Pressable key={id} testID={'quick-'+id} accessibilityRole="button" accessibilityLabel={t(title)} onPress={onPress} style={({pressed})=>[s.action,id==='group'&&s.group,primary&&s.primary,pressed&&{opacity:.8}]}><View style={[s.icon,id==='group'&&{backgroundColor:'#EEF5EB'},primary&&{backgroundColor:'#FFFFFF21'}]}><Icon name={icon} size={21} color={primary?'#FFF':id==='group'?'#9BAB89':palette.purple}/></View><View style={{flex:1,gap:5}}><Label style={{fontSize:13,fontWeight:'800',color:primary?'#FFF':palette.ink}}>{t(title)}</Label><Label style={{fontSize:10,lineHeight:16,color:primary?'#FFFFFFE6':palette.muted}}>{t(description)}</Label></View><Icon name={id==='group'?'plus':'chevron'} size={16} color={primary?'#FFF':'#A58AB8'}/></Pressable>;
 return <View style={{gap:10}}>
  {g?<><Label style={{fontSize:12,lineHeight:20,color:palette.muted,marginBottom:8}}>{t('En el grupo:')} <Label style={{fontWeight:'700'}}>{g.emoji} {g.name}</Label></Label>{c.state.groups.length>1&&<Select c={c} label={t('Seleccionar grupo')} value={g.id} options={c.state.groups.map(group=>({value:group.id,label:(group.emoji||'')+' '+group.name,onSelect:()=>c.select(group.id)}))}/>}
   {action('expense','receipt','Añadir gasto','Reparte una cuenta con tu grupo.',onExpense,true)}
   {action('task','task','Añadir tarea','Que no se os quede nada pendiente.',onTask)}
   {action('poll','vote','Crear votación','Decidid juntos el próximo plan.',onPoll)}
   {action('shopping','receipt','Lista de la compra','Lo que falta, en un mismo lugar.',onShopping)}
  </>:<Label style={{fontSize:12,lineHeight:20,color:palette.muted}}>{t('Crea un grupo para empezar a compartir gastos y planes.')}</Label>}
  <View style={{marginTop:4}}>{action('group','groups','Crear grupo','Todo empieza con tu gente.',onGroup)}</View>
  <Pressable accessibilityRole="button" onPress={onJoin} style={s.extra}><Icon name="link" size={17} color={palette.purple}/><Label style={s.extraText}>{t('Unirme al grupo')}</Label></Pressable>
  {g&&<Pressable accessibilityRole="button" onPress={()=>Promise.resolve(c.invite()).catch(error=>c.update({error:error.message}))} style={s.extra}><Icon name="share" size={17} color={palette.purple}/><Label style={s.extraText}>{t('Invitar al grupo')}</Label></Pressable>}
 </View>;
}
const s=StyleSheet.create({action:{minHeight:78,paddingVertical:14,paddingHorizontal:12,gap:12,flexDirection:'row',alignItems:'center',borderRadius:15,backgroundColor:'#F5F0FC',borderWidth:1,borderColor:'#EEE5F7'},group:{backgroundColor:'#FFF'},primary:{backgroundColor:palette.purple,borderColor:palette.purple},icon:{width:41,height:41,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:'#EDE1FB'},extra:{minHeight:44,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},extraText:{fontSize:12,fontWeight:'600',color:palette.purple}});
