import test from 'node:test';
import assert from 'node:assert/strict';
import {daysLeft,dscStatus,matchesDscTab,dscRenewalChain} from '../components/dscRules.mjs';
const active={lifecycle:'active',deleted_at:null,expiry_date:'2026-10-29',pending_renewal:0,next_followup_date:null};
test('expiry status uses calendar days and includes today',()=>{
 assert.equal(daysLeft('2026-10-29','2026-10-29'),0);
 assert.equal(daysLeft('2026-10-28','2026-10-29'),-1);
 assert.equal(daysLeft('2028-03-01','2028-02-28'),2);
 assert.equal(dscStatus(active,'2026-10-29'),'Expires Today');
 assert.equal(dscStatus(active,'2026-10-30'),'Expired');
 assert.equal(matchesDscTab(active,'expiring','2026-10-29'),true);
});
test('inactive and Trash certificates never appear in expiry or renewal followup tabs',()=>{
 for(const row of [{...active,lifecycle:'inactive'},{...active,deleted_at:'2026-10-29'}]) {
  for(const tab of ['expiring','expired','pending','followup']) assert.equal(matchesDscTab({...row,pending_renewal:1,next_followup_date:'2026-10-20'},tab,'2026-10-29'),false);
 }
 assert.equal(matchesDscTab({...active,lifecycle:'inactive'},'inactive'),true);
 assert.equal(matchesDscTab({...active,deleted_at:'2026-10-29'},'trash'),true);
 assert.equal(matchesDscTab({...active,deleted_at:'2026-10-29'},'all'),false);
});
test('renewal preserves closed histories outside active tracking',()=>{
 for(const lifecycle of ['renewed','closed']) {
  const row={...active,lifecycle};
  assert.equal(matchesDscTab(row,'renewed'),true);
  assert.equal(matchesDscTab(row,'all'),lifecycle!=='renewed');
  assert.equal(matchesDscTab(row,'expiring','2026-10-29'),false);
 }
});
test('pending renewal and due followup are explicit and independent',()=>{
 assert.equal(matchesDscTab({...active,pending_renewal:'1'},'pending'),true);
 assert.equal(matchesDscTab({...active,next_followup_date:'2026-10-29'},'followup','2026-10-29'),true);
 assert.equal(matchesDscTab({...active,next_followup_date:'2026-10-30'},'followup','2026-10-29'),false);
});

test('All DSCs keeps only the latest renewal and history follows explicit links',()=>{
 const rows=[
  {...active,id:1,holder_name:'Same Holder',lifecycle:'renewed',renewed_to_id:2},
  {...active,id:2,holder_name:'Same Holder',lifecycle:'renewed',previous_certificate_id:1,renewed_to_id:3},
  {...active,id:3,holder_name:'Same Holder',previous_certificate_id:2},
  {...active,id:4,holder_name:'Same Holder'}
 ];
 assert.deepEqual(rows.filter(row=>matchesDscTab(row,'all')).map(row=>row.id),[3,4]);
 assert.deepEqual(rows.filter(row=>matchesDscTab(row,'renewed')).map(row=>row.id),[1,2]);
 for(const id of [1,2,3]) assert.deepEqual(dscRenewalChain(rows,id).map(row=>row.id),[1,2,3]);
 assert.deepEqual(dscRenewalChain(rows,4).map(row=>row.id),[4]);
 assert.equal(matchesDscTab({...rows[2],deleted_at:'2026-10-29'},'all'),false);
 assert.equal(matchesDscTab({...rows[2],lifecycle:'inactive'},'all'),true);
 assert.equal(matchesDscTab({...rows[2],lifecycle:'closed'},'all'),true);
 assert.equal(matchesDscTab({...rows[2],renewed_to_id:'5'},'all'),false);
});
