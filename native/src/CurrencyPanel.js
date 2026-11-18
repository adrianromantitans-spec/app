import React,{useSyncExternalStore} from 'react';
import {ActivityIndicator,Pressable,View} from 'react-native';
import {palette} from './design.mjs';
import {currencyOption,fxPresentation} from './fx-view.mjs';
export default function CurrencyPanel({c,ui}){
 const {Button,Label,Select}=ui,state=useSyncExternalStore(c.subscribe,c.snapshot),g=c.group,fx=state.fx?.groupId===g?.id?state.fx:null,t=v=>c.t(v),detail=g?fxPresentation(fx,g,c.fxTools,c.i18n.locale):null;
 const load=target=>{
  const actor=c.cloud.user?.id;c.update({error:''});const pending=c.loadFx(target),request=c.fxRequest;
  return pending.catch(error=>{if(c.fxRequest===request&&c.activeReply(g.id,actor)&&!c.state.fx?.error)c.update({error:c.t(error.message)});});
 };
 if(!g)return null;
 return <View testID="currency-panel" style={{backgroundColor:'#FAF8FD',borderWidth:1,borderColor:'#E5DCF1',borderRadius:16,padding:16,gap:12}}>
  <View style={{flexDirection:'row',gap:12,alignItems:'flex-end'}}><Button secondary={!!fx} accessibilityLabel={t('Moneda original')+' '+g.currency} disabled={state.busy} style={{minHeight:44,paddingVertical:9}} onPress={()=>load(null)}>{g.currency}</Button><View style={{flex:1,minWidth:0,gap:5}}><Label style={{fontSize:11,color:palette.muted}}>{t('Convertir a')}</Label><Select c={c} inline label={t('Moneda de destino')} value={fx?.target||''} disabled={state.busy} style={{backgroundColor:'#FFF',color:palette.purple,minHeight:44,paddingVertical:9}} options={[{value:'',label:t('Elegir moneda'),onSelect:()=>load(null)},...c.model.currencies.filter(code=>code!==g.currency).map(code=>({value:code,label:currencyOption(code,c.i18n.locale),onSelect:()=>load(code)}))]}/></View></View>
  {fx?.loading&&<View style={{flexDirection:'row',gap:9,alignItems:'center'}}><ActivityIndicator color={palette.purple}/><Label style={{fontSize:11,color:palette.muted,flex:1}}>{t('Consultando el cambio más reciente…')}</Label></View>}
  {!!fx?.error&&<Label accessibilityRole="alert" style={{fontSize:11,lineHeight:19,color:palette.danger}}>{c.t(fx.error)}</Label>}
  {fx&&!fx.loading&&!fx.error&&!detail&&<Label accessibilityRole="alert" style={{fontSize:11,lineHeight:19,color:palette.danger}}>{t('El cambio ha caducado. Actualízalo antes de continuar.')}</Label>}
  {detail&&<Label testID="fx-detail" style={{fontSize:11,lineHeight:19,color:palette.muted}}>{t('Cambio aplicado')}: 1 {detail.target} = {detail.rate} {detail.base}{'\n'}{detail.dates} · {detail.source}</Label>}
  {fx&&!fx.loading&&<Pressable accessibilityRole="button" disabled={state.busy} onPress={()=>load(fx.target)} style={{minHeight:36,justifyContent:'center'}}><Label style={{fontSize:11,fontWeight:'600',color:palette.purple}}>{t(fx.error?'Volver a intentar':'Actualizar cambio')}</Label></Pressable>}
  <View style={{backgroundColor:'#F4EFF9',padding:12,borderRadius:10}}><Label style={{fontSize:10,lineHeight:18,color:palette.muted}}>{t('Cambio de referencia: el banco puede aplicar otro cambio o comisiones. Los gastos y saldos se mantienen en la moneda original.')}</Label></View>
 </View>;
}
