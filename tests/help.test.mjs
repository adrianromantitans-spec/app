import test from 'node:test';
import assert from 'node:assert/strict';
import {helpArticles,searchHelp,helpCentreView} from '../help.js';
test('all help articles are available in each app language with stable, unique identifiers',()=>{
 const ids=helpArticles('en').map(a=>a.id);assert.ok(ids.length>=10);assert.equal(new Set(ids).size,ids.length);
 for(const language of ['es','en','ro']){
  const articles=helpArticles(language);assert.deepEqual(articles.map(a=>a.id),ids);
  for(const article of articles)for(const field of ['question','answer','categoryTitle'])assert.ok(typeof article[field]==='string'&&article[field].length>3);
 }
 assert.deepEqual(helpArticles('unknown'),helpArticles('en'));
});
test('help search matches accents, letter case and multiple terms, and handles empty/no matches',()=>{
 assert.ok(searchHelp('CONTRASENA','es').some(a=>a.id==='access'));
 assert.ok(searchHelp('notificari','ro').some(a=>a.id==='push'));
 assert.ok(searchHelp('  currency   bank  ','en').some(a=>a.id==='currency'));
 assert.equal(searchHelp('   ','es').length,helpArticles('es').length);
 assert.deepEqual(searchHelp('xyz-no-match-987','en'),[]);
});
test('search text is escaped in rendered HTML and help retains account return and support links',()=>{
 const input='\"><img src=x onerror=alert(1)>';
 const html=helpCentreView(input,'en');assert.ok(!html.includes(input));assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));assert.ok(html.includes('data-route="profile"'));assert.ok(html.includes('mailto:support@divzplit.com'));
});
