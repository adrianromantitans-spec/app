import {NativeModules} from 'react-native';
import {installPlatform} from './platform.mjs';
import {NativeController} from './session.mjs';
export async function createRuntime(){
 const native=NativeModules.DivZplit;
 if(!native)throw new Error('DivZplit Android module is unavailable');
 const platform=installPlatform(native,await native.initial());
 // Load the existing domain modules AFTER Android storage/crypto/locale exist.
 const {Cloud}=require('../../cloud.js');const model=require('../../model.js');
 const home=require('../../home.js'),settlement=require('../../settlement-plan.js'),i18n=require('../../i18n.js');
 const {cloudConfig}=require('../../config.js');
 const cloud=new Cloud(cloudConfig,{storage:platform.storage,temporaryStorage:platform.temporaryStorage});
 return new NativeController({cloud,model,home,settlement,i18n,native,platform});
}
