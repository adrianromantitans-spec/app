// Build a single public Edge Function source file for Supabase's dashboard editor.
// This reads source code only: existing deployment secrets stay in Supabase.
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const destination=process.argv[2];
if(!destination)throw new Error('Usage: node scripts/bundle-push.mjs OUTPUT.ts');
if(path.resolve(destination)===path.join(root,'supabase/functions/push-dispatch/index.ts')||path.resolve(destination)===path.join(root,'supabase/functions/push-dispatch/dispatch.mjs'))throw new Error('Choose a separate output file.');
const dispatcher=(await readFile(path.join(root,'supabase/functions/push-dispatch/dispatch.mjs'),'utf8')).replace(/^export /gm,'');
const entry=(await readFile(path.join(root,'supabase/functions/push-dispatch/index.ts'),'utf8')).replace("import {createDispatcher} from './dispatch.mjs';\n",'');
await writeFile(destination,'// DivZplit: dashboard bundle. Uses existing Supabase function secrets.\n'+dispatcher+'\n'+entry);
