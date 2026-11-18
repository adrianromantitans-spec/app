import test from 'node:test';
import assert from 'node:assert/strict';
import {sheetHeight} from '../src/sheet-layout.mjs';
test('long forms are bounded above the top safe area on short, tall and keyboard-resized screens',()=>{
 for(const available of [280,360,568,780,852])for(const top of [0,24,44]){
  const h=sheetHeight(available,top,86,1200);assert.ok(h>0);assert.ok(h<=available-top-12);
  const scrollViewport=h-86;assert.ok(scrollViewport>0&&scrollViewport<1200);
 }
});
test('short sheets fit their measured content and resize for options, error text and safe bottom padding',()=>{
 assert.equal(sheetHeight(852,24,86,300),386);
 assert.equal(sheetHeight(852,24,86,334),420);
 assert.equal(sheetHeight(852,24,86,900),816);
 assert.equal(sheetHeight(360,24,86,334),324);
 assert.equal(sheetHeight(852,24,86,null),816);
 assert.equal(sheetHeight(0,44,86,900),1);
});
