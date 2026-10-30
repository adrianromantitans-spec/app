import test from 'node:test';
import assert from 'node:assert/strict';
import {detectLanguage} from '../i18n.js';
import {translations} from '../translations.js';
test('language preferences select the first supported language, with regional variants and English fallback',()=>{
 for(const [preferences,expected]of [[['es-MX'],'es'],[['ro-RO'],'ro'],[['en-US'],'en'],[['fr-FR','ro-RO','es-ES'],'ro'],[['fr-FR','es'],'es'],[['en-GB','es'],'en'],[['fr','ja'],'en'],[[],'en'],[[null,42,'RO_ro'],'ro']])assert.equal(detectLanguage(preferences),expected);
});
test('every translation has English and Romanian copy with identical dynamic slots',()=>{
 const slots=s=>(s.match(/\{\d+\}/g)||[]).sort();
 for(const [source,languages]of Object.entries(translations))for(const lang of ['en','ro']){assert.ok(languages[lang]?.trim(),source+' / '+lang);assert.deepEqual(slots(languages[lang]),slots(source),source+' / '+lang);}
});
