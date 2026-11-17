// Public single-file Edge Function bundle; never reads private deployment secrets.
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),destination=process.argv[2];
if(!destination)throw new Error('Usage: node scripts/bundle-native-push.mjs OUTPUT.ts');
const names=['supabase/functions/push-dispatch/dispatch.mjs','supabase/functions/native-push-dispatch/fcm.mjs','supabase/functions/native-push-dispatch/dispatch.mjs','supabase/functions/native-push-dispatch/index.ts'];
if(names.some(name=>path.resolve(destination)===path.join(root,name)))throw new Error('Choose a separate output file');
const sources=await Promise.all(names.map(name=>readFile(path.join(root,name),'utf8')));
const bundled=sources.map(source=>source.replace(/^import .*?;\n/gm,'').replace(/^export /gm,'')).join('\n');
await writeFile(destination,'// DivZplit native FCM dispatcher. Set secrets only in Supabase.\n'+bundled);
