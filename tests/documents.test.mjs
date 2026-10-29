import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesTab,documentStatus,localDate} from '../components/documentRules.mjs';
test('return obligations follow the direction',()=>{
 const incoming={direction:'In',returnable:'1',returned_on:null,return_due_date:'2026-10-29'};
 const outgoing={...incoming,direction:'Out'};
 assert.equal(matchesTab(incoming,'sending'),true);
 assert.equal(matchesTab(incoming,'receipt'),false);
 assert.equal(matchesTab(outgoing,'receipt'),true);
 assert.equal(matchesTab(outgoing,'sending'),false);
});
test('completed returns leave both pending tabs',()=>{
 const row={direction:'In',returnable:1,returned_on:'2026-10-29'};
 assert.equal(matchesTab(row,'sending'),false);
 assert.equal(matchesTab(row,'returned'),true);
 assert.equal(documentStatus(row,'2026-10-30'),'Returned');
});
test('non returnable documents never appear as pending',()=>{
 for(const direction of ['In','Out']) {
 const row={direction,returnable:'0',returned_on:null};
 assert.equal(matchesTab(row,'sending'),false);
 assert.equal(matchesTab(row,'receipt'),false);
 assert.equal(documentStatus(row),'Not Returnable');
 }
});
test('due today is due; only earlier dates are overdue',()=>{
 const row={returnable:1,returned_on:null,return_due_date:'2026-10-29'};
 assert.equal(documentStatus(row,'2026-10-29'),'Due');
 assert.equal(documentStatus(row,'2026-10-30'),'Overdue');
 assert.equal(localDate(new Date(2026,9,29,0,1)),'2026-10-29');
});
