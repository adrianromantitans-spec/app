import {NativeModules} from 'react-native';
import {installPlatform} from './platform.mjs';
import {NativeController} from './session.mjs';
import {receiptFetcher} from './receipt-transport.mjs';
export async function createRuntime(){
 const native=NativeModules.DivZplit;
 if(!native)throw new Error('DivZplit Android module is unavailable');
 const platform=installPlatform(native,await native.initial());
 // Load the existing domain modules AFTER Android storage/crypto/locale exist.
 const {Cloud}=require('../../cloud.js');const model=require('../../model.js');
 const home=require('../../home.js'),settlement=require('../../settlement-plan.js'),i18n=require('../../i18n.js');
 const {cloudConfig}=require('../../config.js');
 const cloud=new Cloud(cloudConfig,{storage:platform.storage,temporaryStorage:platform.temporaryStorage,fetcher:receiptFetcher(globalThis.fetch.bind(globalThis))});
 const extras=require('../../extras.js'),receipt=require('../../receipt-ocr.js'),planning=require('../../planning.js'),helpTools=require('../../help.js'),fxTools=require('../../fx.js'),activityTools={...require('../../activity-overview.js'),...require('../../activity-ui.js')};
 return new NativeController({cloud,model,home,settlement,i18n,native,platform,extras,receipt,planning,fxTools,activityTools,helpTools,photos:NativeModules.DivZplitReceipts});
}
