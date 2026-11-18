import React,{useEffect,useState} from 'react';
import {AppState,View} from 'react-native';

// Offer only on an idle, foreground, authenticated screen after the opening.
export function useNotificationOffer(c,state,opening,sheet,setSheet){
 const [active,setActive]=useState(AppState.currentState==='active');
 useEffect(()=>{const listener=AppState.addEventListener('change',value=>setActive(value==='active'));return()=>listener.remove();},[]);
 useEffect(()=>{
  if(!active||opening||sheet||!state.ready||!state.user||state.busy||!state.pushReady||state.pushEnabled)return;
  let live=true;
  c.shouldOfferPush().then(offer=>{if(live&&offer){c.markPushOfferSeen();setSheet({kind:'deviceNotifications',offer:true});}}).catch(()=>{});
  return()=>{live=false;};
 },[c,active,opening,sheet,state.ready,state.user?.id,state.busy,state.pushReady,state.pushEnabled,setSheet]);
}
export function NotificationSettings({c,ui,offer=false,onClose}){
 const {Label,Button,s}=ui,state=c.state,t=value=>c.t(value),blocked=state.pushPermission==='denied';
 const attempt=action=>Promise.resolve().then(action).catch(error=>c.update({error:error.message}));
 return <View style={{gap:15}}>
  <Label style={s.muted}>{t(state.pushEnabled?'Los avisos están activados en este dispositivo.':blocked?'Las notificaciones están bloqueadas. Puedes permitirlas desde los ajustes del teléfono.':offer?'Recibe avisos cuando tu grupo añada gastos, cree votaciones o te asigne tareas.':'Activa los avisos para recibir novedades aunque DivZplit esté cerrada.')}</Label>
  {state.pushReady&&(!blocked||state.pushEnabled)&&<Button secondary={!offer} disabled={state.busy} onPress={()=>attempt(async()=>{if(state.pushEnabled)await c.disablePush();else if(await c.enablePush()&&offer)onClose();})}>{t(state.pushEnabled?'Desactivar en este dispositivo':'Activar notificaciones')}</Button>}
  {(!offer||blocked)&&<Button secondary disabled={state.busy} onPress={()=>attempt(()=>c.native.notificationSettings())}>{t('Ajustes del dispositivo')}</Button>}
  {!offer&&<Button secondary disabled={state.busy} onPress={()=>onClose('preferences')}>{t('Ajustes de notificaciones')}</Button>}
  {offer&&<Button secondary disabled={state.busy} onPress={()=>onClose()}>{t('Ahora no')}</Button>}
 </View>;
}
