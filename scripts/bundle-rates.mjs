// Builds public source only; credentials remain in Supabase's environment.
import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url),output=process.argv[2];
if(!output)throw new Error('Usage: node scripts/bundle-rates.mjs OUTPUT.ts');
const registry=(await readFile(new URL('currencies.js',root),'utf8')).replace(/^export /gm,'');
const rates=(await readFile(new URL('supabase/functions/exchange-rates/rates.mjs',root),'utf8')).replace("import {currencies} from '../../../currencies.js';\n",'').replace(/^export /gm,'');
const entry=(await readFile(new URL('supabase/functions/exchange-rates/index.ts',root),'utf8')).replace("import {createRateHandler} from './rates.mjs';\n",'');
await writeFile(output,'// DivZplit exchange-rates: paste into the new Edge Function index.ts.\nexport {};\n'+registry+'\n'+rates+'\n'+entry);
