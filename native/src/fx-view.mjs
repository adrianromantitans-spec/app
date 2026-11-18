// Presentation only. Monetary conversion and confirmation remain in paymentQuote.
export function currencyOption(code,locale){try{return code+' · '+new Intl.DisplayNames([locale],{type:'currency'}).of(code);}catch{return code;}}
export function fxPresentation(fx,group,fxTools,locale,now=Date.now()){
 if(!fx||fx.groupId!==group.id||fx.loading||fx.error||!fxTools.validConversion(fx.baseQuote,fx.targetQuote,group.currency,fx.target,now))return null;
 const baseDate=fx.baseQuote?.rate_date||fx.targetQuote?.rate_date,targetDate=fx.targetQuote?.rate_date||baseDate;
 const source=!fx.baseQuote?fx.targetQuote?.source:!fx.targetQuote||fx.baseQuote.source===fx.targetQuote.source?fx.baseQuote.source:'ECB + ExchangeRate-API';
 return {rate:new Intl.NumberFormat(locale,{maximumFractionDigits:10}).format(Number(fx.baseQuote?.rate||'1')/Number(fx.targetQuote?.rate||'1')),target:fx.target,base:group.currency,dates:baseDate!==targetDate?group.currency+': '+baseDate+' · '+fx.target+': '+targetDate:baseDate,source:source==='ECB'?'BCE / ECB':source};
}
