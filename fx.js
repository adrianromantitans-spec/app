import {currencyScale,currencies} from './currencies.js?v=landing-51';
import {tr} from './i18n.js?v=language-90';
export function euroAmount(amount,currency,rate) {
 if(!Number.isSafeInteger(amount)||amount<1||!currencies.includes(currency)||currency==='EUR'||!/^\d+(?:\.\d{1,10})?$/.test(String(rate)))throw new Error(tr('No se ha podido calcular la conversión.'));
 const [whole,fraction='']=String(rate).split('.'),denominator=BigInt(whole+fraction),factor=10n**BigInt(fraction.length);
 if(denominator<=0n||Number(rate)>100000000)throw new Error(tr('No se ha podido calcular la conversión.'));
 const divisor=BigInt(currencyScale(currency))*denominator,numerator=BigInt(amount)*100n*factor;
 const result=Number((numerator*2n+divisor)/(divisor*2n));
 if(!Number.isSafeInteger(result))throw new Error(tr('No se ha podido calcular la conversión.'));
 return result;
}
export function validQuote(quote,currency,now=Date.now()) {
 return !!quote&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(quote.id)&&quote.currency===currency&&['ECB','ExchangeRate-API'].includes(quote.source)&&/^\d{4}-\d{2}-\d{2}$/.test(quote.rate_date||'')&&Number.isFinite(Date.parse(quote.expires_at))&&Date.parse(quote.expires_at)>now&&/^\d+(?:\.\d{1,10})?$/.test(String(quote.rate))&&Number(quote.rate)>0&&Number(quote.rate)<=100000000;
}

// EUR is the common anchor of the existing server-issued quotes. Work entirely
// with integer fractions so conversion rounds once, in the target minor unit.
export function convertedAmount(amount,base,target,baseRate='1',targetRate='1'){
 if(!Number.isSafeInteger(amount)||amount<1||!currencies.includes(base)||!currencies.includes(target)||base===target)throw new Error(tr('No se ha podido calcular la conversión.'));
 const fraction=value=>{
  if(!/^\d+(?:\.\d{1,10})?$/.test(String(value))||Number(value)<=0||Number(value)>100000000)throw new Error(tr('No se ha podido calcular la conversión.'));
  const [whole,part='']=String(value).split('.');return [BigInt(whole+part),10n**BigInt(part.length)];
 };
 const [bn,bd]=fraction(baseRate),[tn,td]=fraction(targetRate);
 const numerator=BigInt(amount)*BigInt(currencyScale(target))*tn*bd,denominator=BigInt(currencyScale(base))*bn*td;
 const result=Number((numerator*2n+denominator)/(2n*denominator));
 if(!Number.isSafeInteger(result))throw new Error(tr('No se ha podido calcular la conversión.'));
 return result;
}
export function validConversion(baseQuote,targetQuote,base,target,now=Date.now()){
 return currencies.includes(base)&&currencies.includes(target)&&base!==target&&(base==='EUR'?baseQuote===null:validQuote(baseQuote,base,now))&&(target==='EUR'?targetQuote===null:validQuote(targetQuote,target,now));
}
