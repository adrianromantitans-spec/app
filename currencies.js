// European national currencies, Gibraltar pound, and US dollar.
// Amounts are integer ISO minor units; ISK has no fractional unit.
export const currencies=['EUR','RON','USD','GBP','CHF','PLN','CZK','HUF','SEK','DKK','NOK','ISK','ALL','BAM','MKD','RSD','MDL','UAH','RUB','BYN','TRY','GEL','AMD','AZN','GIP'];
export const currencyDigits=currency=>currency==='ISK'?0:2;
export const currencyScale=currency=>10**currencyDigits(currency);
export const currencyStep=currency=>currency==='ISK'?'1':'0.01';
