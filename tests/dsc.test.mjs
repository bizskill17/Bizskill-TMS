import test from 'node:test';
import assert from 'node:assert/strict';
import {daysLeft,dscStatus,matchesDscTab} from '../components/dscRules.mjs';
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
  assert.equal(matchesDscTab(row,'all'),true);
  assert.equal(matchesDscTab(row,'expiring','2026-10-29'),false);
 }
});
test('pending renewal and due followup are explicit and independent',()=>{
 assert.equal(matchesDscTab({...active,pending_renewal:'1'},'pending'),true);
 assert.equal(matchesDscTab({...active,next_followup_date:'2026-10-29'},'followup','2026-10-29'),true);
 assert.equal(matchesDscTab({...active,next_followup_date:'2026-10-30'},'followup','2026-10-29'),false);
});
