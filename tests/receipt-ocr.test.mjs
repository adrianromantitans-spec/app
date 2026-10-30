import test from 'node:test';
import assert from 'node:assert/strict';
import {parseReceipt} from '../receipt-ocr.js';
test('Spanish totals beat subtotals, taxes, cash and change; merchant and valid date are extracted',()=>{
 const result=parseReceipt('CAFÉ ROMA\nTICKET SIMPLIFICADO\nFecha 30/10/2026 14:32\nSubtotal 20,00\nIVA 2,00\nTOTAL A PAGAR 22,00 EUR\nEFECTIVO 30,00\nCAMBIO 8,00');
 assert.deepEqual(result,{title:'CAFÉ ROMA',amount:2200,date:'2026-10-30',currency:'EUR',currencyAmbiguous:false});
});
test('Romanian fiscal receipt and English receipt use labeled totals with local separators',()=>{
 assert.deepEqual(parseReceipt('BON FISCAL\nMAGAZIN BUCUREȘTI SRL\n30.10.2026\nSUBTOTAL 1.000,00\nTOTAL DE PLATA 1.190,50 LEI\nTOTAL TVA 190,50\nNUMERAR 1.200,00\nREST 9,50'),{title:'MAGAZIN BUCUREȘTI SRL',amount:119050,date:'2026-10-30',currency:'RON',currencyAmbiguous:false});
 const en=parseReceipt('THE CORNER SHOP\n2026-10-30\nSUB TOTAL 1,000.00\nGRAND TOTAL EUR 1,200.75\nTOTAL VAT 200.75\nTOTAL CASH 1,500.00');
 assert.equal(en.amount,120075);assert.equal(en.date,'2026-10-30');assert.equal(en.title,'THE CORNER SHOP');
});
test('a total on the next line is supported, including integer totals',()=>{
 assert.equal(parseReceipt('TOTAL RON\n42,99').amount,4299);
 assert.equal(parseReceipt('TOTAL\n42 LEI').amount,4200);
 assert.equal(parseReceipt('TOTAL 1.234 RON').amount,123400);
 assert.equal(parseReceipt('TOTAL\nCARD 20,00').amount,null);
});
test('unknown totals, impossible dates and unbounded values stay empty',()=>{
 for(const text of ['', 'CAFE\nCoffee 2,50\nIVA 0,50\nCAMBIO 5,00','TOTAL ARTICOLE 12','TOTAL IVA 12,00','TOTAL 1000001,00','TOTAL 10%','TOTAL -12,00 EUR','TOTAL REFUND 12,00 EUR'])assert.equal(parseReceipt(text).amount,null,text);
 assert.equal(parseReceipt('Fecha 31/02/2026').date,null);
 assert.equal(parseReceipt('Fecha 29/02/2024').date,'2024-02-29');
 assert.equal(parseReceipt('Fecha 30/10/26').date,'2026-10-30');
});
test('currency mismatch and multiple currencies remain explicit for the UI to handle',()=>{
 assert.equal(parseReceipt('TOTAL 50,00 RON').currency,'RON');
 assert.equal(parseReceipt('TOTAL 50,00').currency,null);
 assert.equal(parseReceipt('TOTAL EUR 20,00\nECHIVALENT LEI 100,00').currencyAmbiguous,true);
});

test('symbol noise is not a merchant, while OCR total labels and spaced decimals are supported',()=>{
 assert.equal(parseReceipt('e+e=$=AE').title,null);
 assert.equal(parseReceipt('T0TAL A PAGAR 24 , 90 EUR').amount,2490);
 assert.equal(parseReceipt('TOTA1\n24. 90 RON').amount,2490);
 assert.equal(parseReceipt('T0TAL\n24,90').title,null);
});

test('item counts, units and loyalty points never replace the actual total',()=>{
 for(const label of ['ARTICULOS','UNIDADES','PRODUCTOS','UNITATI','BUCATI','PUNTOS','POINTS']){
  assert.equal(parseReceipt('TOTAL 24,90 EUR\nTOTAL '+label+' 8').amount,2490,label);
 }
});
