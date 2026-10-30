import test from 'node:test';
import assert from 'node:assert/strict';
import {dashboardToday,dashboardDate,isDelayedTask,taskAssignees} from '../components/dashboardRules.mjs';
test('dashboard days follow Indian midnight even while UTC is yesterday',()=>{
 assert.equal(dashboardToday(new Date('2026-10-29T18:29:59Z')),'2026-10-29');
 assert.equal(dashboardToday(new Date('2026-10-29T18:30:00Z')),'2026-10-30');
});
test('delayed tasks exclude today, missing dates, completed and vendor tasks',()=>{
 const task={status:'In Progress',dueDate:'29/10/2026'};
 assert.equal(isDelayedTask(task,'2026-10-30'),true);
 assert.equal(isDelayedTask({...task,dueDate:'30/10/2026'},'2026-10-30'),false);
 assert.equal(isDelayedTask({...task,dueDate:'31/10/2026'},'2026-10-30'),false);
 for(const dueDate of ['',null,'bad','31/02/2026'])assert.equal(isDelayedTask({...task,dueDate},'2026-10-30'),false);
 assert.equal(isDelayedTask({...task,status:' completed '},'2026-10-30'),false);
 assert.equal(isDelayedTask({...task,vendor:'Vendor'},'2026-10-30'),false);
 assert.equal(dashboardDate('2026-10-29'),'2026-10-29');
 assert.equal(dashboardDate('29/10/2026'),'2026-10-29');
});
test('assignees are distinct whole names with a consistent unassigned group',()=>{
 assert.deepEqual(taskAssignees(' Pankaj, Pankaj Jain, Pankaj , '),['Pankaj','Pankaj Jain']);
 assert.deepEqual(taskAssignees(' , '),['Unassigned']);
});
