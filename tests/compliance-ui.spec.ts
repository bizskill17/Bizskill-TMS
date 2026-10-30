import {test,expect} from '@playwright/test';
test('Billing navigation and simple task fields',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const response=await page.request.post('/api/login.php',{data:{orgId:'test-a',email:'test-admin@example.com',password:'test-admin-password'}});
 const auth=await response.json();expect(auth.success).toBeTruthy();
 await page.addInitScript((user)=>{localStorage.setItem('taskpro_user',JSON.stringify(user));localStorage.setItem('taskpro_tenant_code','test-a');localStorage.setItem('taskpro_api_url','/api/init.php');},auth.user);
 await page.goto('/');
 await page.getByRole('button',{name:'Billing',exact:true}).click();
 const billingTabs=page.getByRole('tablist',{name:'Billing views',exact:true});
 await expect(billingTabs.getByRole('tab')).toHaveCount(2);
 await expect(billingTabs.getByRole('tab').nth(0)).toHaveText(/^Pending Billing/);
 await expect(billingTabs.getByRole('tab').nth(1)).toHaveText(/^Billed/);
 await billingTabs.getByRole('tab',{name:/^Billed/}).click();
 await expect(billingTabs.getByRole('tab',{name:/^Billed/})).toHaveAttribute('aria-selected','true');
 await page.getByRole('button',{name:'Show menu',exact:true}).click();
 await page.getByRole('button',{name:'Simple Tasks',exact:true}).click();
 await page.getByRole('button',{name:'Add Task',exact:true}).click();
 await expect(page.getByLabel('Billing Type')).toBeVisible();
 await page.getByLabel('Billing Type').selectOption('Non Billable');
 await expect(page.getByLabel('Fee',{exact:true})).toHaveCount(0);
 await page.getByLabel('Billing Type').selectOption('Billable');
 await expect(page.getByLabel('Fee',{exact:true})).toBeVisible();
 await expect(page.getByLabel('Fee',{exact:true})).toHaveAttribute('required','');
 expect(await page.getByLabel('Fee',{exact:true}).evaluate(input=>(input as HTMLInputElement).checkValidity())).toBeFalsy();
 expect(await page.getByLabel('Fee',{exact:true}).evaluate(input=>{
  const form=input.closest('form')!;const fields=Array.from(form.querySelectorAll('input,select,textarea'));
  return fields[fields.length-1]===input && fields[fields.length-2]?.closest('label')?.textContent?.includes('Billing Type');
 })).toBeTruthy();
 expect(errors).toEqual([]);
});

test('Checklists copy saved text directly without a composer',async({page})=>{
 const response=await page.request.post('/api/login.php',{data:{orgId:'test-a',email:'test-admin@example.com',password:'test-admin-password'}});
 const auth=await response.json();expect(auth.success).toBeTruthy();
 const list=await page.request.get('/api/checklists.php?tenantCode=test-a');const session=await list.json();
 const saved=await page.request.post('/api/checklists.php?tenantCode=test-a',{data:{csrf:session.csrf,name:'Direct Copy Test',category:'',introduction:'Please share:',items:['Sales register','Bank statement'],closing_note:'Thank you.',active:1}});
 expect(saved.ok()).toBeTruthy();
 await page.addInitScript((user)=>{localStorage.setItem('taskpro_user',JSON.stringify(user));localStorage.setItem('taskpro_tenant_code','test-a');localStorage.setItem('taskpro_api_url','/api/init.php');},auth.user);
 await page.goto('/');
 await page.getByRole('button',{name:'Checklists',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Checklists',exact:true})).toBeVisible();
 await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{(window as any).__copiedChecklist=text;}}});});
 await page.getByRole('button',{name:'Copy Direct Copy Test',exact:true}).click();
 await expect(page.getByRole('status')).toHaveText('Note copied.');
 expect(await page.evaluate(()=>(window as any).__copiedChecklist)).toBe('Please share:\n\n1. Sales register\n2. Bank statement');
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(page.getByText('Message Preview',{exact:true})).toHaveCount(0);
});

test('Mobile pending tables share width and keep heading words intact',async({page})=>{
 await page.setViewportSize({width:360,height:800});
 const response=await page.request.post('/api/login.php',{data:{orgId:'test-a',email:'test-admin@example.com',password:'test-admin-password'}});
 const auth=await response.json();expect(auth.success).toBeTruthy();
 await page.addInitScript((user)=>{localStorage.setItem('taskpro_user',JSON.stringify(user));localStorage.setItem('taskpro_tenant_code','test-a');localStorage.setItem('taskpro_api_url','/api/init.php');},auth.user);
 await page.goto('/');
 for(const width of [360,393,430]){
  await page.setViewportSize({width,height:800});
  for(const name of ['Pending by Assignee','Pending by Priority','Pending by Category']){
   const table=page.getByRole('heading',{name,exact:true}).locator('../..').getByRole('table');
   await expect(table).toBeVisible();
   await expect(table.getByRole('columnheader')).toHaveCount(4);
   const sizes=await table.evaluate((node)=>{
    const table=node as HTMLTableElement;const parent=table.parentElement!;
    const headers=Array.from(table.querySelectorAll('th'));
    return {overflow:parent.scrollWidth-parent.clientWidth,ratio:headers[0].getBoundingClientRect().width/table.getBoundingClientRect().width,splitWords:headers.flatMap(header=>{
     const text=header.firstChild;if(!text||text.nodeType!==Node.TEXT_NODE)return [];
     return Array.from((text.textContent||'').matchAll(/\S+/g)).filter(word=>{
      const range=document.createRange();range.setStart(text,word.index!);range.setEnd(text,word.index!+word[0].length);
      return range.getClientRects().length>1;
     }).map(word=>word[0]);
    })};
   });
   expect(sizes.overflow).toBeLessThanOrEqual(1);
   expect(sizes.ratio).toBeGreaterThan(0.38);
   expect(sizes.ratio).toBeLessThan(0.42);
   expect(sizes.splitWords).toEqual([]);
  }
 }
});

test('Mobile dashboard prioritises delayed work and has compact activity and quick actions',async({page})=>{
 await page.setViewportSize({width:393,height:850});
 await page.clock.install({time:new Date('2026-10-29T18:35:00Z')});
 const response=await page.request.post('/api/login.php',{data:{orgId:'test-a',email:'test-admin@example.com',password:'test-admin-password'}});
 const auth=await response.json();expect(auth.success).toBeTruthy();
 await page.addInitScript(user=>{localStorage.setItem('taskpro_user',JSON.stringify(user));localStorage.setItem('taskpro_tenant_code','test-a');localStorage.setItem('taskpro_api_url','/api/init.php');},auth.user);
 const task=(id:number,title:string,assignees:string,dueDate:string,status='In Progress')=>({id,title,assignees,dueDate,status,priority:'Medium',category:'GST',firm:'Client A',date:'29/10/2026',notes:''});
 await page.route('**/api/init.php?**',async route=>{
  const response=await route.fetch();const payload=await response.json();
  payload.data.mainTasks=[task(91001,'Late A','User A','29/10/2026'),task(91002,'Late B','User B','28/10/2026'),task(91003,'Today A','User A','30/10/2026'),task(91004,'Future A','User A','01/11/2026'),task(91005,'Completed old','User A','28/10/2026','Completed'),task(91006,'Missing due','User A',''),task(91007,'Shared late','User A, User B, User A','29/10/2026'),task(91008,'Another B','User B','29/10/2026')];
  payload.data.vendorTasks=[];
  payload.data.actionLogs=[{id:92001,taskId:91001,task:'Late A',assignees:'User A',updateDate:'30/10/2026',status:'In Progress'},{id:92002,taskId:91001,task:'Old activity',assignees:'User A',updateDate:'29/10/2026',status:'In Progress'}];
  payload.data.recurringActions=[{id:93001,assignee:'User A',updatedOn:'30/10/2026'},{id:93002,assignee:'User B',updatedOn:'30/10/2026'}];
  await route.fulfill({response,json:payload});
 });
 await page.goto('/');
 const delayed=page.getByRole('heading',{name:'Delayed Pending Tasks by Assignee',exact:true}).locator('../..');
 await expect(delayed).toBeVisible();
 await expect(page.getByRole('heading',{name:'Live Statistics',exact:true})).toBeHidden();
 await expect(page.getByRole('heading',{name:'Quick Control',exact:true})).toBeHidden();
 await expect(page.locator('main').getByRole('heading').first()).toHaveText('Delayed Pending Tasks by Assignee');
 const delayedRows=delayed.locator('tbody tr');
 await expect(delayedRows.nth(0).locator('td').first()).toHaveText('User B');
 await expect(delayedRows.nth(0).locator('td').nth(1)).toHaveText('3');
 await expect(delayedRows.nth(1).locator('td').first()).toHaveText('User A');
 await expect(delayedRows.nth(1).locator('td').nth(1)).toHaveText('2');
 const activity=page.getByRole('region',{name:"Today's Activity",exact:true});
 await expect(activity.getByRole('table')).toBeVisible();
 await expect(activity.locator('tbody tr').filter({hasText:'User A'}).locator('td').last()).toHaveText('2');
 await expect(activity.locator('tbody tr')).toHaveCount(2);
 const bar=page.getByRole('navigation',{name:'Quick Control',exact:true});
 await expect(bar).toBeVisible();await expect(bar.getByRole('button')).toHaveCount(4);
 await expect(bar).toHaveCSS('position','fixed');
 await bar.getByRole('button',{name:'Add Simple Task',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Add Task',exact:true})).toBeVisible();
 await expect(bar).toHaveCount(0);
 await page.getByRole('button',{name:'Cancel',exact:true}).last().click();
 await expect(bar).toBeVisible();
 await delayedRows.filter({hasText:'User A'}).click();
 await expect(page.getByRole('heading',{name:'Late A',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Shared late',exact:true})).toBeVisible();
 await expect(page.getByText('Today A',{exact:true})).toHaveCount(0);
 await expect(page.getByText('Late B',{exact:true})).toHaveCount(0);
});

test('Empty mobile activity remains small and ordinary Users have only task quick actions',async({page})=>{
 await page.setViewportSize({width:360,height:800});
 const response=await page.request.post('/api/login.php',{data:{orgId:'test-a',email:'user-a@example.com',password:'user-password'}});
 const auth=await response.json();expect(auth.success).toBeTruthy();
 await page.addInitScript(user=>{localStorage.setItem('taskpro_user',JSON.stringify(user));localStorage.setItem('taskpro_tenant_code','test-a');localStorage.setItem('taskpro_api_url','/api/init.php');},auth.user);
 await page.route('**/api/init.php?**',async route=>{const response=await route.fetch();const payload=await response.json();payload.data.actionLogs=[];payload.data.recurringActions=[];await route.fulfill({response,json:payload});});
 await page.goto('/');
 const activity=page.getByRole('region',{name:"Today's Activity",exact:true});
 await expect(activity.getByRole('cell',{name:'No activity today.',exact:true})).toBeVisible();
 expect((await activity.boundingBox())!.height).toBeLessThan(150);
 const bar=page.getByRole('navigation',{name:'Quick Control',exact:true});
 await expect(bar.getByRole('button')).toHaveCount(2);
 await expect(bar.getByRole('button',{name:'Add User',exact:true})).toHaveCount(0);
 await page.setViewportSize({width:1280,height:900});
 await expect(page.getByRole('heading',{name:'Live Statistics',exact:true})).toBeVisible();
 await expect(bar).toBeHidden();
});


test('Mobile checklist is a separate section with a growing rich note editor',async({page})=>{
 await page.setViewportSize({width:393,height:850});
 const response=await page.request.post('/api/login.php',{data:{orgId:'test-a',email:'test-admin@example.com',password:'test-admin-password'}});
 const auth=await response.json();expect(auth.success).toBeTruthy();
 await page.addInitScript(user=>{localStorage.setItem('taskpro_user',JSON.stringify(user));localStorage.setItem('taskpro_tenant_code','test-a');localStorage.setItem('taskpro_api_url','/api/init.php');},auth.user);
 await page.goto('/');
 await page.getByRole('button',{name:'Open menu',exact:true}).click();
 await page.getByRole('button',{name:'Checklists',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Checklists',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Refresh',exact:true})).toHaveCount(0);
 const add=page.getByRole('button',{name:'Add Checklist',exact:true});
 await expect(add).toHaveText('');
 await add.click();
 const dialog=page.getByRole('dialog',{name:'Add Checklist',exact:true});
 await expect(dialog).toBeVisible();
 await expect(dialog.getByLabel('Name',{exact:true})).toBeVisible();
 for(const label of ['Introduction','Closing Note','Checklist Items'])await expect(dialog.getByText(label,{exact:true})).toHaveCount(0);
 await dialog.getByLabel('Name',{exact:true}).fill('Mobile Rich Note');
 const editor=dialog.getByRole('textbox',{name:'Note',exact:true});
 await editor.fill('PAN requirements');
 await editor.evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range);el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));});
 await dialog.getByRole('button',{name:'Bold',exact:true}).click();
 await expect(editor.locator('b,strong')).toHaveText('PAN requirements');
 await dialog.getByRole('button',{name:'Add link',exact:true}).click();
 await dialog.getByLabel('Link URL').fill('https://example.com/requirements');
 await dialog.getByRole('button',{name:'Apply',exact:true}).click();
 await expect(editor.locator('a')).toHaveAttribute('href','https://example.com/requirements');
 await editor.evaluate(el=>{el.innerHTML='<p><strong>DSC requirements</strong></p><ol><li>PAN</li><li>Aadhaar</li></ol>'+Array.from({length:60},(_,i)=>'<p>Requirement '+(i+1)+'</p>').join('');el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText'}));});
 await expect(editor).toHaveCSS('overflow-y','visible');
 const dimensions=await editor.evaluate(el=>({height:el.getBoundingClientRect().height,overflow:el.scrollHeight-el.clientHeight}));
 expect(dimensions.height).toBeGreaterThan(850);expect(dimensions.overflow).toBeLessThanOrEqual(1);
 await dialog.getByRole('button',{name:'Save',exact:true}).click();
 await expect(dialog).toHaveCount(0);
 const article=page.getByRole('article',{name:'Mobile Rich Note',exact:true});
 await expect(article.locator('strong')).toHaveText('DSC requirements');
 await expect(article.locator('ol li')).toHaveText(['PAN','Aadhaar']);
 await expect(article.getByText('Requirement 60',{exact:true})).toBeVisible();
 const note=article.locator('.checklist-note');
 expect(await note.evaluate(el=>el.scrollHeight-el.clientHeight)).toBeLessThanOrEqual(1);
 expect(await page.locator('main').evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
 await page.reload();
 await page.getByRole('button',{name:'Open menu',exact:true}).click();
 await page.getByRole('button',{name:'Checklists',exact:true}).click();
 await expect(page.getByRole('article',{name:'Mobile Rich Note',exact:true})).toBeVisible();
});

test('Ordinary Users can open checklist notes but cannot add or edit them',async({page})=>{
 const response=await page.request.post('/api/login.php',{data:{orgId:'test-a',email:'user-a@example.com',password:'user-password'}});
 const auth=await response.json();expect(auth.success).toBeTruthy();
 await page.addInitScript(user=>{localStorage.setItem('taskpro_user',JSON.stringify(user));localStorage.setItem('taskpro_tenant_code','test-a');localStorage.setItem('taskpro_api_url','/api/init.php');},auth.user);
 await page.goto('/');
 await page.getByRole('button',{name:'Checklists',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Checklists',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Add Checklist',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:/^Edit /})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Copy Mobile Rich Note',exact:true})).toBeVisible();
});


test('Categories and designations are tables on mobile and system statuses show a lock icon',async({page})=>{
 await page.setViewportSize({width:393,height:850});
 const response=await page.request.post('/api/login.php',{data:{orgId:'test-a',email:'test-admin@example.com',password:'test-admin-password'}});
 const auth=await response.json();expect(auth.success).toBeTruthy();
 await page.addInitScript(user=>{localStorage.setItem('taskpro_user',JSON.stringify(user));localStorage.setItem('taskpro_tenant_code','test-a');localStorage.setItem('taskpro_api_url','/api/init.php');},auth.user);
 await page.goto('/');
 await page.getByRole('button',{name:'Open menu',exact:true}).click();
 await page.getByRole('button',{name:'Master',exact:true}).click();
 await expect(page.getByRole('navigation',{name:'Section views'}).getByRole('button',{name:'Checklists',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Categories',exact:true}).click();
 await expect(page.getByRole('table')).toBeVisible();
 await expect(page.getByRole('button',{name:'Card view',exact:true})).toHaveCount(0);
 await page.getByRole('textbox',{name:'Search categories',exact:true}).fill('GST');
 await expect(page.getByRole('cell',{name:'GST',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Designation',exact:true}).click();
 await expect(page.getByRole('table')).toBeVisible();
 await expect(page.getByRole('button',{name:'Card view',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Table view',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Status',exact:true}).click();
 const locked=page.getByRole('row').filter({has:page.getByRole('cell',{name:'Completed',exact:true})});
 await expect(locked.getByRole('img',{name:'Locked',exact:true})).toBeVisible();
 await expect(locked.getByText('Locked',{exact:true})).toHaveCount(0);
});

test('Mobile task cards align labels and values and keep table mode available',async({page})=>{
 await page.setViewportSize({width:360,height:800});
 const response=await page.request.post('/api/login.php',{data:{orgId:'test-a',email:'test-admin@example.com',password:'test-admin-password'}});
 const auth=await response.json();expect(auth.success).toBeTruthy();
 await page.addInitScript(user=>{localStorage.setItem('taskpro_user',JSON.stringify(user));localStorage.setItem('taskpro_tenant_code','test-a');localStorage.setItem('taskpro_api_url','/api/init.php');},auth.user);
 const longClient='A very long client name '+ 'ExampleCompany'.repeat(8);
 await page.route('**/api/init.php?**',async route=>{
  const response=await route.fetch();const payload=await response.json();
  payload.data.mainTasks=[{id:94001,title:'File GST return',firm:longClient,assignees:'Manash Deka, Pankaj Jain',owner:'Pankaj Jain',category:'GST',status:'In Progress',priority:'High',date:'30/10/2026',dueDate:'20/11/2026',remarks:'Collect documents\nCheck ITC',lastUpdateDate:'30/10/2026',lastUpdateRemarks:'Waiting for client',hours:25,time:'10:30',photos:'[]'}, {id:94003,title:'Minimal task',firm:'',assignees:'',owner:' ',category:'—',status:'Not Yet Started',priority:'Medium',date:'',dueDate:'',remarks:'  ',hours:'0.00',time:'-',photos:'[]'}];
  payload.data.vendorTasks=[];
  payload.data.recurringTasks=[{id:94002,title:'Monthly challan',firm:longClient,assignee:'Manash Deka',owner:'Pankaj Jain',category:'GST',status:'Not Yet Started',periodicity:'Monthly',recurrenceDay:20,frequencyDays:30,startDate:'01/10/2026',lastUpdatedOn:'30/10/2026',lastUpdateRemarks:'Waiting for payment',notes:'Review payment\nConfirm challan'}];
  payload.data.recurringActions=[];
  await route.fulfill({response,json:payload});
 });
 await page.goto('/');
 await page.getByRole('button',{name:'Open menu',exact:true}).click();
 await page.getByRole('button',{name:'Simple Tasks',exact:true}).click();
 const card=page.getByRole('article',{name:'File GST return',exact:true});
 await expect(card).toBeVisible();
 const minimal=page.getByRole('article',{name:'Minimal task',exact:true});
 await minimal.getByRole('button',{name:'Show details',exact:true}).click();
 await expect(minimal.locator('dt')).toHaveText(['Task','Status','Priority']);
 await expect(minimal.locator('dl')).toHaveCount(1);
 await expect(card.locator('dt')).toHaveText(['Task','Client','Assignee','Status','Update Date','Remarks','Due Date','Priority','Total Minutes']);
 await expect(card.locator('dd').nth(1)).toHaveText(longClient);
 await expect(card.locator('dd').nth(6)).toHaveText('20/11/2026');
 await card.getByRole('button',{name:'Show details',exact:true}).click();
 await expect(card.locator('dt')).toContainText(['Owner','Category','Task Date','Time','Notes']);
 for (const label of ['Photo','PDF']) await expect(card.locator('dt').filter({hasText:new RegExp('^'+label+'$')})).toHaveCount(0);
 await expect(card.locator('dd').filter({hasText:'Collect documents'})).toHaveText('Collect documents\nCheck ITC');
 for(const width of [320,360,393,430]){
  await page.setViewportSize({width,height:800});
  const rows=await card.locator('dl > div').evaluateAll(nodes=>nodes.map(node=>{
   const label=node.querySelector('dt')!.getBoundingClientRect(),value=node.querySelector('dd')!.getBoundingClientRect();
   return {sameTop:Math.abs(label.top-value.top)<1,right:value.left>=label.right,overflow:node.scrollWidth-node.clientWidth};
  }));
  expect(rows.every(row=>row.sameTop&&row.right&&row.overflow<=1)).toBeTruthy();
  expect(await card.evaluate(node=>node.scrollWidth-node.clientWidth)).toBeLessThanOrEqual(1);
 }
 await expect(card.getByRole('button',{name:'Update',exact:true})).toBeVisible();
 await expect(card.getByRole('button',{name:'Edit task',exact:true})).toBeVisible();
 await expect(card.getByRole('button',{name:'View history',exact:true})).toBeVisible();
 await card.getByRole('button',{name:'Hide details',exact:true}).click();
 await expect(card.getByText('Collect documents',{exact:false})).toHaveCount(0);
 await page.getByRole('button',{name:'Table View',exact:true}).click();
 await expect(card).toBeHidden();await expect(page.getByRole('table')).toBeVisible();
 await page.getByRole('button',{name:'Open menu',exact:true}).click();
 await page.getByRole('button',{name:'Recurring Tasks',exact:true}).click();
 const recurring=page.getByRole('article',{name:'Monthly challan',exact:true});
 await expect(recurring).toBeVisible();
 await expect(recurring.locator('dt')).toHaveText(['Task','Client','Assignee','Status','Update Date','Remarks','Next Due','Owner','Category','Period','Notes']);
 await expect(recurring.locator('dd').nth(1)).toHaveText(longClient);
 await expect(recurring.locator('dd').nth(10)).toHaveText('Review payment\nConfirm challan');
 for(const width of [320,393]){
  await page.setViewportSize({width,height:800});
  expect(await recurring.evaluate(node=>node.scrollWidth-node.clientWidth)).toBeLessThanOrEqual(1);
 }
 await page.getByRole('button',{name:'Table View',exact:true}).click();
 await expect(recurring).toBeHidden();await expect(page.getByRole('table')).toBeVisible();
});

test('Task navigation starts with Pending and activity is inside the main Dashboard',async({page})=>{
 await page.setViewportSize({width:1280,height:900});
 await page.clock.install({time:new Date('2026-10-30T06:00:00Z')});
 const response=await page.request.post('/api/login.php',{data:{orgId:'test-a',email:'test-admin@example.com',password:'test-admin-password'}});
 const auth=await response.json();expect(auth.success).toBeTruthy();
 await page.addInitScript(user=>{localStorage.setItem('taskpro_user',JSON.stringify(user));localStorage.setItem('taskpro_tenant_code','test-a');localStorage.setItem('taskpro_api_url','/api/init.php');},auth.user);
 await page.route('**/api/init.php?**',async route=>{
  const response=await route.fetch();const payload=await response.json();
  payload.data.actionLogs=[{id:95001,taskId:95002,task:'Activity example',assignees:'Activity User',owner:'Activity User',updateDate:'30/10/2026',status:'In Progress',hours:120}];
  await route.fulfill({response,json:payload});
 });
 await page.goto('/');
 const activity=page.getByRole('region',{name:'Activity Dashboard',exact:true});
 await expect(activity.getByRole('table')).toBeVisible();
 await expect(activity.getByRole('columnheader',{name:'User',exact:true})).toBeVisible();
 await expect(activity.getByRole('cell',{name:'02:00',exact:true}).first()).toBeVisible();
 await activity.getByLabel('Activity period',{exact:true}).selectOption('custom');
 await activity.getByLabel('Activity from',{exact:true}).fill('2026-10-31');
 await expect(activity.getByRole('alert')).toHaveText('From date must be on or before To date.');
 await expect(activity.getByText('No activity for this period.',{exact:true})).toBeVisible();
 await activity.getByLabel('Activity from',{exact:true}).fill('2026-10-01');
 await activity.getByRole('textbox',{name:'Search activity by user',exact:true}).fill('Activity User');
 await expect(activity.getByRole('cell',{name:'02:00',exact:true}).first()).toBeVisible();
 await page.getByRole('button',{name:'Simple Tasks',exact:true}).click();
 const tabs=page.getByRole('navigation',{name:'Section views',exact:true});
 for(const [index,label] of ['Pending Tasks','Action Log','Completed Tasks','All Tasks'].entries()){
  await expect(tabs.getByRole('button').nth(index)).toHaveText(new RegExp('^'+label));
 }
 await expect(tabs.getByRole('button',{name:/^Pending Tasks/})).toHaveAttribute('aria-current','page');
 await expect(tabs.getByRole('button',{name:'Activity Dashboard',exact:true})).toHaveCount(0);
 await tabs.getByRole('button',{name:/^Action Log/}).click();
 await expect(tabs.getByRole('button',{name:/^Action Log/})).toHaveAttribute('aria-current','page');
 await tabs.getByRole('button',{name:/^Completed Tasks/}).click();
 await expect(tabs.getByRole('button',{name:/^Completed Tasks/})).toHaveAttribute('aria-current','page');
 await tabs.getByRole('button',{name:/^All Tasks/}).click();
 await expect(tabs.getByRole('button',{name:/^All Tasks/})).toHaveAttribute('aria-current','page');
 await page.setViewportSize({width:360,height:800});
 await page.getByRole('button',{name:'Open menu',exact:true}).click();
 await page.getByRole('button',{name:'Dashboard',exact:true}).click();
 await expect(activity.getByRole('table')).toBeVisible();
});

test('Action Log defaults to all dates while Dashboard drill-down keeps its date filter',async({page})=>{
 await page.setViewportSize({width:393,height:850});
 await page.clock.install({time:new Date('2026-10-30T06:00:00Z')});
 const response=await page.request.post('/api/login.php',{data:{orgId:'test-a',email:'test-admin@example.com',password:'test-admin-password'}});
 const auth=await response.json();expect(auth.success).toBeTruthy();
 await page.addInitScript(user=>{localStorage.setItem('taskpro_user',JSON.stringify(user));localStorage.setItem('taskpro_tenant_code','test-a');localStorage.setItem('taskpro_api_url','/api/init.php');},auth.user);
 await page.route('**/api/init.php?**',async route=>{
  const response=await route.fetch();const payload=await response.json();
  payload.data.actionLogs=[30,29,28,27].map((day,index)=>({id:96001+index,taskId:97001+index,task:'Log day '+day,taskDate:'01/10/2026',updateDate:day+'/10/2026',status:'In Progress',owner:'Log User',assignees:'Log User',hours:10,remarks:'Updated',project:'',firm:'Client A'}));
  await route.fulfill({response,json:payload});
 });
 await page.goto('/');
 await page.getByRole('button',{name:'Open menu',exact:true}).click();
 await page.getByRole('button',{name:'Simple Tasks',exact:true}).click();
 const tabs=page.getByRole('navigation',{name:'Section views',exact:true});
 await tabs.getByRole('button',{name:/^Action Log/}).click();
 await expect(tabs.getByRole('button',{name:/^Action Log/})).toHaveText(/^Action Log\s*4$/);
 await expect(page.getByText('No filters applied',{exact:true})).toBeVisible();
 for(const day of [30,29,28,27]) await expect(page.getByRole('heading',{name:'Log day '+day,exact:true})).toBeVisible();
 await expect(page.getByText('Showing 1 to 4 of 4 entries',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Open menu',exact:true}).click();
 await page.getByRole('button',{name:'Dashboard',exact:true}).click();
 await page.getByRole('region',{name:"Today's Activity",exact:true}).getByRole('button',{name:'Simple updates by Log User',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Log day 30',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Log day 29',exact:true})).toHaveCount(0);
 await expect(page.getByText(/Update Date: 30\/10\/2026 to 30\/10\/2026/)).toBeVisible();
 await tabs.getByRole('button',{name:/^Pending Tasks/}).click();
 await tabs.getByRole('button',{name:/^Action Log/}).click();
 await expect(page.getByText('No filters applied',{exact:true})).toBeVisible();
 await expect(page.getByText('Showing 1 to 4 of 4 entries',{exact:true})).toBeVisible();
});

test('Mobile Users cards use label and value columns with Name and Mobile first',async({page})=>{
 await page.setViewportSize({width:393,height:850});
 const response=await page.request.post('/api/login.php',{data:{orgId:'test-a',email:'test-admin@example.com',password:'test-admin-password'}});
 const auth=await response.json();expect(auth.success).toBeTruthy();
 await page.addInitScript(user=>{localStorage.setItem('taskpro_user',JSON.stringify(user));localStorage.setItem('taskpro_tenant_code','test-a');localStorage.setItem('taskpro_api_url','/api/init.php');},auth.user);
 const longEmail='a'.repeat(75)+'@example.com';
 await page.route('**/api/init.php?**',async route=>{
  const response=await route.fetch();const payload=await response.json();
  payload.data.users=[
   {id:98001,name:'Mobile Test User',mobile:'9864023964',email:longEmail,employeeId:'MTU',designation:'Senior Accountant',role:'Employee',telegramUserName:'mobiletest',isActive:true},
   {id:98002,name:'Minimal User',mobile:'',email:'',employeeId:'',designation:'',role:'Employee',telegramUserName:'',isActive:false}
  ];
  await route.fulfill({response,json:payload});
 });
 await page.goto('/');
 await page.getByRole('button',{name:'Open menu',exact:true}).click();
 await page.getByRole('button',{name:'Master',exact:true}).click();
 const card=page.getByRole('article',{name:'Mobile Test User',exact:true});
 await expect(card).toBeVisible();
 await expect(card.locator('dt')).toHaveText(['Name','Mobile','Email','Employee ID','Designation','Role','Telegram','Status']);
 await expect(card.getByRole('link',{name:'9864023964',exact:true})).toHaveAttribute('href','tel:9864023964');
 await expect(card.getByRole('switch',{name:'Active status for Mobile Test User',exact:true})).toHaveAttribute('aria-checked','true');
 await expect(card.getByRole('button',{name:'Edit Mobile Test User',exact:true})).toBeVisible();
 await expect(card.getByRole('button',{name:'Delete Mobile Test User',exact:true})).toBeVisible();
 const minimal=page.getByRole('article',{name:'Minimal User',exact:true});
 await expect(minimal.locator('dt')).toHaveText(['Name','Role','Status']);
 await expect(minimal.getByRole('switch')).toHaveAttribute('aria-checked','false');
 for(const width of [320,360,393,430]){
  await page.setViewportSize({width,height:850});
  const rows=await card.locator('dl > div').evaluateAll(nodes=>nodes.map(node=>{
   const label=node.querySelector('dt')!.getBoundingClientRect(),value=node.querySelector('dd')!.getBoundingClientRect();
   return Math.abs(label.top-value.top)<1 && value.left>=label.right && node.scrollWidth-node.clientWidth<=1;
  }));
  expect(rows.every(Boolean)).toBeTruthy();
  expect(await card.evaluate(node=>node.scrollWidth-node.clientWidth)).toBeLessThanOrEqual(1);
 }
 await page.getByPlaceholder('Search users...',{exact:true}).fill('Minimal User');
 await expect(card).toHaveCount(0);await expect(minimal).toBeVisible();
 await page.getByPlaceholder('Search users...',{exact:true}).fill('');
 await page.setViewportSize({width:1280,height:900});
 await expect(card).toBeHidden();
 await expect(page.getByRole('table')).toBeVisible();
 await expect(page.getByRole('table').getByRole('cell',{name:'Mobile Test User',exact:true})).toBeVisible();
});

test('Compact Activity Dashboard has period totals, exports and filtered Action Log links',async({page})=>{
 await page.setViewportSize({width:393,height:850});
 await page.clock.install({time:new Date('2026-10-30T06:00:00Z')});
 const response=await page.request.post('/api/login.php',{data:{orgId:'test-a',email:'test-admin@example.com',password:'test-admin-password'}});
 const auth=await response.json();expect(auth.success).toBeTruthy();
 await page.addInitScript(user=>{localStorage.setItem('taskpro_user',JSON.stringify(user));localStorage.setItem('taskpro_tenant_code','test-a');localStorage.setItem('taskpro_api_url','/api/init.php');},auth.user);
 await page.route('**/api/init.php?**',async route=>{
  const response=await route.fetch();const payload=await response.json();
  payload.data.actionLogs=[
   {id:99101,taskId:99201,task:'Today one',assignees:'Alice, Alice',updateDate:'30/10/2026',hours:60},
   {id:99102,taskId:99202,task:'Today two',assignees:'Alice',updateDate:'30/10/2026',hours:'30'},
   {id:99103,taskId:99203,task:'Bob update',assignees:'Bob',updateDate:'30/10/2026',hours:15},
   {id:99104,taskId:99204,task:'Yesterday update',assignees:'Alice',updateDate:'29/10/2026',hours:45},
   {id:99105,taskId:99205,task:'Earlier this month',assignees:'Alice',updateDate:'01/10/2026',hours:120}
  ].map(log=>({...log,status:'In Progress',taskDate:'01/10/2026',owner:'Alice',remarks:'Updated'}));
  await route.fulfill({response,json:payload});
 });
 await page.goto('/');
 const activity=page.getByRole('region',{name:'Activity Dashboard',exact:true});
 await expect(activity.getByLabel('Activity period',{exact:true})).toHaveValue('today');
 await expect(activity.getByRole('columnheader')).toHaveText(['User','Updates','Time Spent']);
 const alice=activity.locator('tbody tr').filter({has:page.getByRole('button',{name:'View activity for Alice',exact:true})});
 await expect(alice.locator('td')).toHaveText(['Alice','2','01:30']);
 await expect(activity.locator('tfoot td')).toHaveText(['Total','3','01:45']);
 for(const width of [320,360,430]){
  await page.setViewportSize({width,height:850});
  expect(await activity.evaluate(node=>node.scrollWidth-node.clientWidth)).toBeLessThanOrEqual(1);
 }
 await activity.getByLabel('Activity period',{exact:true}).selectOption('yesterday');
 await expect(alice.locator('td')).toHaveText(['Alice','1','00:45']);
 await activity.getByLabel('Activity period',{exact:true}).selectOption('week');
 await expect(alice.locator('td')).toHaveText(['Alice','3','02:15']);
 await activity.getByLabel('Activity period',{exact:true}).selectOption('month');
 await expect(alice.locator('td')).toHaveText(['Alice','4','04:15']);
 const download=page.waitForEvent('download');
 await activity.getByRole('button',{name:'Export activity Excel',exact:true}).click();
 expect((await download).suggestedFilename()).toBe('Activity_2026-10-30.csv');
 await activity.getByLabel('Activity period',{exact:true}).selectOption('custom');
 await activity.getByLabel('Activity from',{exact:true}).fill('2026-10-01');
 await activity.getByLabel('Activity to',{exact:true}).fill('2026-10-01');
 await expect(alice.locator('td')).toHaveText(['Alice','1','02:00']);
 await activity.getByRole('button',{name:'View activity for Alice',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Earlier this month',exact:true})).toBeVisible();
 const logCard=page.getByRole('article',{name:'Earlier this month',exact:true});
 await expect(logCard.locator('dt')).toHaveText(['Task','Update Date','Assignee','Status','Owner','Task Date','Minutes','Remarks']);
 for(const width of [320,393]){
  await page.setViewportSize({width,height:850});
  expect(await logCard.evaluate(node=>node.scrollWidth-node.clientWidth)).toBeLessThanOrEqual(1);
 }
 await expect(logCard.getByRole('button',{name:'Delete log for Earlier this month',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Today one',exact:true})).toHaveCount(0);
});

test('Action Log cards hide zero minutes and blank details',async({page})=>{
 await page.setViewportSize({width:360,height:800});
 const response=await page.request.post('/api/login.php',{data:{orgId:'test-a',email:'test-admin@example.com',password:'test-admin-password'}});
 const auth=await response.json();expect(auth.success).toBeTruthy();
 await page.addInitScript(user=>{localStorage.setItem('taskpro_user',JSON.stringify(user));localStorage.setItem('taskpro_tenant_code','test-a');localStorage.setItem('taskpro_api_url','/api/init.php');},auth.user);
 await page.route('**/api/init.php?**',async route=>{
  const response=await route.fetch();const payload=await response.json();
  payload.data.actionLogs=[{id:99301,taskId:99401,task:'Minimal log',taskDate:'',updateDate:'30/10/2026',status:'Not Yet Started',hours:0,owner:'',assignees:'',remarks:'',photos:'[]',pdf:''}];
  await route.fulfill({response,json:payload});
 });
 await page.goto('/');
 await page.getByRole('button',{name:'Open menu',exact:true}).click();
 await page.getByRole('button',{name:'Simple Tasks',exact:true}).click();
 await page.getByRole('navigation',{name:'Section views',exact:true}).getByRole('button',{name:/^Action Log/}).click();
 const card=page.getByRole('article',{name:'Minimal log',exact:true});
 await expect(card.locator('dt')).toHaveText(['Task','Update Date','Status']);
 await page.getByRole('button',{name:'Table View',exact:true}).click();
 await expect(card).toBeHidden();await expect(page.getByRole('table')).toBeVisible();
});

test('Recurring task form ends with Billing Type and Fee',async({page})=>{
 await page.setViewportSize({width:393,height:850});
 const response=await page.request.post('/api/login.php',{data:{orgId:'test-a',email:'test-admin@example.com',password:'test-admin-password'}});
 const auth=await response.json();expect(auth.success).toBeTruthy();
 await page.addInitScript(user=>{localStorage.setItem('taskpro_user',JSON.stringify(user));localStorage.setItem('taskpro_tenant_code','test-a');localStorage.setItem('taskpro_api_url','/api/init.php');},auth.user);
 await page.goto('/');
 await page.getByRole('navigation',{name:'Quick Control',exact:true}).getByRole('button',{name:'Add Recurring Task',exact:true}).click();
 await expect(page.getByLabel('Fee',{exact:true})).toHaveCount(0);
 await page.getByLabel('Billing Type').selectOption('Billable');
 await expect(page.getByLabel('Fee',{exact:true})).toBeVisible();
 expect(await page.getByLabel('Fee',{exact:true}).evaluate(input=>{
  const fields=Array.from(input.closest('form')!.querySelectorAll('input,select,textarea'));
  return fields[fields.length-1]===input && fields[fields.length-2]?.closest('label')?.textContent?.includes('Billing Type');
 })).toBeTruthy();
 await expect(page.getByText('Professional Fee (optional)',{exact:true})).toHaveCount(0);
});

test('Office Tasks groups existing tasks without clients',async({page})=>{
 await page.setViewportSize({width:393,height:850});
 const response=await page.request.post('/api/login.php',{data:{orgId:'test-a',email:'test-admin@example.com',password:'test-admin-password'}});
 const auth=await response.json();expect(auth.success).toBeTruthy();
 await page.addInitScript(user=>{localStorage.setItem('taskpro_user',JSON.stringify(user));localStorage.setItem('taskpro_tenant_code','test-a');localStorage.setItem('taskpro_api_url','/api/init.php');},auth.user);
 await page.route('**/api/init.php?**',async route=>{
  const response=await route.fetch();const payload=await response.json();
  const task={date:'30/10/2026',dueDate:'20/11/2026',owner:'Office User',assignees:'Office User',category:'Office Category',priority:'Medium',status:'Not Yet Started',firm:'',clientName:'',project:''};
  payload.data.mainTasks=[{...task,id:99501,title:'Internal review'},{...task,id:99502,title:'Internal completed',status:'Completed'},{...task,id:99503,title:'Client work',firm:'Client A'},{...task,id:99504,title:'Project work',project:'Project A (Client A)'}];
  payload.data.vendorTasks=[];
  payload.data.users=[{id:99510,name:'Office User',email:'office@example.com',mobile:'9864023964',role:'Employee',isActive:true}];
  payload.data.categories=[{id:99511,name:'Office Category',type:'Task'}];
  await route.fulfill({response,json:payload});
 });
 await page.goto('/');
 await page.getByRole('button',{name:'Open menu',exact:true}).click();
 await page.getByRole('button',{name:'Simple Tasks',exact:true}).click();
 const office=page.getByRole('navigation',{name:'Section views',exact:true}).getByRole('button',{name:/^Office Tasks/});
 await expect(office).toHaveText(/^Office Tasks\s*2$/);
 await office.click();
 await expect(page.getByRole('heading',{name:'Internal review',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Internal completed',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Client work',exact:true})).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Project work',exact:true})).toHaveCount(0);

});

test('Billing mobile cards hide filters until the filter icon is tapped',async({page})=>{
 await page.setViewportSize({width:393,height:850});
 const response=await page.request.post('/api/login.php',{data:{orgId:'test-a',email:'test-admin@example.com',password:'test-admin-password'}});
 const auth=await response.json();expect(auth.success).toBeTruthy();
 await page.addInitScript(user=>{localStorage.setItem('taskpro_user',JSON.stringify(user));localStorage.setItem('taskpro_tenant_code','test-a');localStorage.setItem('taskpro_api_url','/api/init.php');},auth.user);
 await page.route('**/api/compliance.php?**',async route=>{
  const response=await route.fetch();const payload=await response.json();
  payload.entries=[{id:99601,title:'Billing card example',client_name:'Client A',source_type:'Simple',assigned_user_name:'Office User',work_status:'Completed',billing_type:'Billable',billing_status:'Pending',fee:500,current_stage:'',due_date:'2026-11-20',completed_on:'2026-10-30',remarks:''}];
  payload.bills=[];payload.billItems=[];
  await route.fulfill({response,json:payload});
 });
 await page.goto('/');
 await page.getByRole('button',{name:'Open menu',exact:true}).click();
 await page.getByRole('button',{name:'Billing',exact:true}).click();
 await expect(page.getByRole('button',{name:'Billing filters',exact:true})).toHaveAttribute('aria-expanded','false');
 await expect(page.getByLabel('From date',{exact:true})).toBeHidden();
 const card=page.getByRole('article',{name:'Billing card example',exact:true});
 await expect(card.locator('dt')).toHaveText(['Task','Client','Assignee','Status','Due Date','Task Type','Billing Type','Fee','Billing Status']);
 await card.getByRole('checkbox',{name:'Select Billing card example',exact:true}).check();
 await expect(page.getByText('1 selected',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Clear Selection',exact:true}).click();
 await page.getByRole('button',{name:'Billing filters',exact:true}).click();
 await expect(page.getByLabel('From date',{exact:true})).toBeVisible();
 await page.getByLabel('From date',{exact:true}).fill('2026-11-01');
 await expect(card).toHaveCount(0);
 await page.getByRole('button',{name:'Clear Filters',exact:true}).click();
 await expect(card).toBeVisible();
 await page.getByRole('button',{name:'Billing filters',exact:true}).click();
 await expect(page.getByLabel('From date',{exact:true})).toBeHidden();
 for(const width of [320,393]){
  await page.setViewportSize({width,height:850});
  expect(await card.evaluate(node=>node.scrollWidth-node.clientWidth)).toBeLessThanOrEqual(1);
 }
 await page.setViewportSize({width:1280,height:900});
 await expect(card).toBeHidden();await expect(page.getByRole('table')).toBeVisible();
});

test('Billing Type changes need no Reason and Fee appears only for Billable work',async({page})=>{
 await page.setViewportSize({width:393,height:850});
 const response=await page.request.post('/api/login.php',{data:{orgId:'test-a',email:'test-admin@example.com',password:'test-admin-password'}});
 const auth=await response.json();expect(auth.success).toBeTruthy();
 await page.addInitScript(user=>{localStorage.setItem('taskpro_user',JSON.stringify(user));localStorage.setItem('taskpro_tenant_code','test-a');localStorage.setItem('taskpro_api_url','/api/init.php');},auth.user);
 let billingType='Billable';let submitted:any=null;
 await page.route('**/api/compliance.php?**',async route=>{
  if(route.request().method()==='POST'){
   submitted=route.request().postDataJSON();billingType=submitted.billing_type;
   await route.fulfill({json:{success:true}});return;
  }
  const response=await route.fetch();const payload=await response.json();
  payload.entries=[{id:99701,title:'Fee visibility test',client_name:'Client A',source_type:'Simple',work_status:'Completed',billing_type:billingType,billing_status:'Not Billed',fee:billingType==='Billable'?500:null,version:1}];
  payload.bills=[];payload.billItems=[];
  await route.fulfill({response,json:payload});
 });
 await page.goto('/');
 await page.getByRole('button',{name:'Open menu',exact:true}).click();
 await page.getByRole('button',{name:'Billing',exact:true}).click();
 const card=page.getByRole('article',{name:'Fee visibility test',exact:true});
 await expect(card.locator('dt').filter({hasText:/^Fee$/})).toHaveCount(1);
 await card.getByRole('button',{name:'Billing Type / Fee',exact:true}).click();
 const dialog=page.getByRole('dialog');
 await expect(dialog.getByLabel('Fee',{exact:true})).toBeVisible();
 await expect(dialog.getByText(/Reason/)).toHaveCount(0);
 await dialog.getByLabel('Billing Type').selectOption('Non Billable');
 await expect(dialog.getByLabel('Fee',{exact:true})).toHaveCount(0);
 await dialog.getByLabel('Billing Type').selectOption('Billable');
 await expect(dialog.getByLabel('Fee',{exact:true})).toBeVisible();
 await dialog.getByLabel('Billing Type').selectOption('Non Billable');
 await dialog.getByRole('button',{name:'Save',exact:true}).click();
 await expect(dialog).toHaveCount(0);
 expect(submitted.billing_type).toBe('Non Billable');
 expect(submitted.reason).toBeUndefined();
 await expect(card).toHaveCount(0);
});

test('Checklist category comes from the master and deletion asks for confirmation',async({page})=>{
 await page.setViewportSize({width:393,height:850});
 const response=await page.request.post('/api/login.php',{data:{orgId:'test-a',email:'test-admin@example.com',password:'test-admin-password'}});
 const auth=await response.json();expect(auth.success).toBeTruthy();
 const notes=await (await page.request.get('/api/checklists.php?tenantCode=test-a')).json();
 expect(notes.categories.length).toBeGreaterThan(0);
 const category=notes.categories[0].name;
 await page.addInitScript(user=>{localStorage.setItem('taskpro_user',JSON.stringify(user));localStorage.setItem('taskpro_tenant_code','test-a');localStorage.setItem('taskpro_api_url','/api/init.php');},auth.user);
 await page.goto('/');
 await page.getByRole('button',{name:'Open menu',exact:true}).click();
 await page.getByRole('button',{name:'Checklists',exact:true}).click();
 await page.getByRole('button',{name:'Add Checklist',exact:true}).click();
 let dialog=page.getByRole('dialog');
 await dialog.getByLabel('Name',{exact:true}).fill('Categorised Checklist');
 await dialog.getByLabel('Checklist Category',{exact:true}).selectOption(category);
 await dialog.getByRole('textbox',{name:'Note',exact:true}).fill('Documents required for filing.');
 await dialog.getByRole('button',{name:'Save',exact:true}).click();
 const card=page.getByRole('article',{name:'Categorised Checklist',exact:true});
 await expect(card.getByText(category,{exact:true})).toBeVisible();
 await page.getByLabel('Filter checklist category',{exact:true}).selectOption(category);
 await expect(card).toBeVisible();
 await card.getByRole('button',{name:'Delete Categorised Checklist',exact:true}).click();
 await page.getByRole('dialog',{name:'Delete Checklist',exact:true}).getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(card).toBeVisible();
 await card.getByRole('button',{name:'Delete Categorised Checklist',exact:true}).click();
 await page.getByRole('dialog',{name:'Delete Checklist',exact:true}).getByRole('button',{name:'Delete',exact:true}).click();
 await expect(card).toHaveCount(0);
 await expect(page.getByRole('status')).toHaveText('Checklist deleted.');
});

test('Simple and recurring task Edit forms load billing settings and require Billable Fees',async({page})=>{
 await page.setViewportSize({width:393,height:850});
 const response=await page.request.post('/api/login.php',{data:{orgId:'test-a',email:'test-admin@example.com',password:'test-admin-password'}});
 const auth=await response.json();expect(auth.success).toBeTruthy();
 await page.addInitScript(user=>{localStorage.setItem('taskpro_user',JSON.stringify(user));localStorage.setItem('taskpro_tenant_code','test-a');localStorage.setItem('taskpro_api_url','/api/init.php');},auth.user);
 const billingSaves:any[]=[];
 await page.route('**/api/compliance.php?**',async route=>{
  if(route.request().method()==='POST'){billingSaves.push(route.request().postDataJSON());await route.fulfill({json:{success:true}});return;}
  const recurring=new URL(route.request().url()).searchParams.get('source_type')==='Recurring Master';
  await route.fulfill({json:{success:true,editable:true,billing_type:recurring?'Non Billable':'Billable',fee:recurring?null:1250,csrf:'test-billing'}});
 });
 await page.route('**/api/init.php**',async route=>{
  if(route.request().method()==='POST'){await route.fulfill({json:{success:true,data:{id:99903}}});return;}
  const response=await route.fetch();const payload=await response.json();
  payload.data.mainTasks=[{id:99903,title:'Edit Fee task',firm:'Client A',owner:auth.user.name,assignees:auth.user.name,category:'GST',status:'In Progress',priority:'Medium',dueDate:'20/11/2026',date:'30/10/2026',hours:0}];
  payload.data.recurringTasks=[{id:99904,title:'Edit recurring Fee',firm:'Client A',owner:auth.user.name,assignee:auth.user.name,category:'GST',status:'Not Yet Started',frequencyDays:30,periodicity:'Fixed Days',startDate:'30/10/2026'}];
  payload.data.recurringActions=[];
  await route.fulfill({response,json:payload});
 });
 await page.goto('/');
 await page.getByRole('button',{name:'Open menu',exact:true}).click();
 await page.getByRole('button',{name:'Simple Tasks',exact:true}).click();
 await page.getByRole('article',{name:'Edit Fee task',exact:true}).getByRole('button',{name:'Edit task',exact:true}).click();
 let fee=page.getByLabel('Fee',{exact:true});
 await expect(fee).toHaveValue('1250');
 await expect(fee).toHaveAttribute('required','');
 await fee.fill('');
 expect(await fee.evaluate(node=>(node as HTMLInputElement).checkValidity())).toBeFalsy();
 await expect(page.getByRole('button',{name:'Save Changes',exact:true})).toHaveCount(0);
 await fee.fill('2500');
 await page.getByRole('button',{name:'Save Changes',exact:true}).click();
 await page.getByRole('heading',{name:'Confirm Changes',exact:true}).waitFor();
 await page.getByRole('button',{name:'Save Changes',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Confirm Changes',exact:true})).toHaveCount(0);
 expect(billingSaves[0].fee).toBe('2500');
 await page.getByRole('button',{name:'Open menu',exact:true}).click();
 await page.getByRole('button',{name:'Recurring Tasks',exact:true}).click();
 await page.getByRole('article',{name:'Edit recurring Fee',exact:true}).getByRole('button',{name:'Edit recurring task',exact:true}).click();
 await expect(page.getByLabel('Billing Type')).toHaveValue('Non Billable');
 await expect(page.getByLabel('Fee',{exact:true})).toHaveCount(0);
 await page.getByLabel('Billing Type').selectOption('Billable');
 fee=page.getByLabel('Fee',{exact:true});
 await expect(fee).toHaveAttribute('required','');
 await expect(page.getByRole('button',{name:'Save Changes',exact:true})).toBeDisabled();
 await fee.fill('50');
 await page.getByRole('button',{name:'Save Changes',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Edit Recurring Task',exact:true})).toHaveCount(0);
 expect(billingSaves[1].source_type).toBe('Recurring Master');
 expect(billingSaves[1].fee).toBe('50');
 await page.getByRole('button',{name:'Open menu',exact:true}).click();
 await page.getByRole('button',{name:'DSC Register',exact:true}).click();
 await expect(page.getByRole('button',{name:/Client Reminder/})).toHaveCount(0);
 await expect(page.getByRole('checkbox',{name:'Select visible active DSCs',exact:true})).toHaveCount(0);
});

test('Documents, DSC and Billing filters toggle from icons on desktop and mobile',async({page})=>{
 const response=await page.request.post('/api/login.php',{data:{orgId:'test-a',email:'test-admin@example.com',password:'test-admin-password'}});
 const auth=await response.json();expect(auth.success).toBeTruthy();
 await page.addInitScript(user=>{localStorage.setItem('taskpro_user',JSON.stringify(user));localStorage.setItem('taskpro_tenant_code','test-a');localStorage.setItem('taskpro_api_url','/api/init.php');},auth.user);
 for(const width of [1280,393]){
  await page.setViewportSize({width,height:900});
  for(const [section,toggle,date] of [['Documents','Document filters','From date'],['DSC Register','DSC filters','Expiry from'],['Billing','Billing filters','From date']]){
   await page.goto('/');
   if(width<768)await page.getByRole('button',{name:'Open menu',exact:true}).click();
   const nav=page.getByRole('button',{name:section,exact:true});
   if(width>=768&&!await nav.isVisible())await page.getByRole('button',{name:'Show menu',exact:true}).click();
   await nav.click();
   const icon=page.getByRole('button',{name:toggle,exact:true}),field=page.getByLabel(date,{exact:true});
   await expect(icon).toBeVisible();await expect(icon).toHaveAttribute('aria-expanded','false');
   await expect(field).toBeHidden();
   await icon.click();await expect(field).toBeVisible();
   await field.fill('2030-01-01');
   await icon.click();await expect(field).toBeHidden();
   await icon.click();await expect(field).toHaveValue('2030-01-01');
   await page.getByRole('button',{name:'Clear Filters',exact:true}).click();
   await expect(field).toHaveValue('');
   await icon.click();await expect(field).toBeHidden();
  }
 }
});

test('Checklist order persists after desktop drag, mobile touch and keyboard movement',async({page})=>{
 const response=await page.request.post('/api/login.php',{data:{orgId:'test-a',email:'test-admin@example.com',password:'test-admin-password'}});
 const auth=await response.json();expect(auth.success).toBeTruthy();
 const session=await (await page.request.get('/api/checklists.php?tenantCode=test-a')).json();
 for(const name of ['Reorder first','Reorder second']){
  const created=await page.request.post('/api/checklists.php?tenantCode=test-a',{data:{csrf:session.csrf,name,note_html:'<p>Short note</p>'}});
  expect(created.ok()).toBeTruthy();
 }
 await page.addInitScript(user=>{localStorage.setItem('taskpro_user',JSON.stringify(user));localStorage.setItem('taskpro_tenant_code','test-a');localStorage.setItem('taskpro_api_url','/api/init.php');},auth.user);
 for(const width of [1280,393]){
  await page.setViewportSize({width,height:900});await page.goto('/');
  if(width<768)await page.getByRole('button',{name:'Open menu',exact:true}).click();
  const nav=page.getByRole('button',{name:'Checklists',exact:true});
  if(width>=768&&!await nav.isVisible())await page.getByRole('button',{name:'Show menu',exact:true}).click();
  await nav.click();await page.getByRole('textbox',{name:'Search checklists'}).fill('Reorder ');
  const first=page.getByRole('article',{name:'Reorder first',exact:true}),second=page.getByRole('article',{name:'Reorder second',exact:true});
  const color=await first.evaluate(node=>getComputedStyle(node).backgroundColor);
  const handle=first.getByRole('button',{name:'Move Reorder first',exact:true});
  await handle.scrollIntoViewIfNeeded();
  const start=(await handle.boundingBox())!,end=(await second.getByRole('heading').boundingBox())!;
  if(width>=768){
   await page.mouse.move(start.x+start.width/2,start.y+start.height/2);await page.mouse.down();
   await page.mouse.move(end.x+end.width/2,end.y+end.height/2,{steps:10});await page.mouse.up();
  }else{
   const client=await page.context().newCDPSession(page);
   await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start.x+start.width/2,y:start.y+start.height/2}]});
   await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:end.x+end.width/2,y:end.y+end.height/2}]});
   await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await client.detach();
  }
  await expect(page.getByRole('status')).toHaveText('Order saved automatically.');
  await expect(page.locator('article').first()).toHaveAttribute('aria-label',width>=768?'Reorder second':'Reorder first');
  expect(await first.evaluate(node=>getComputedStyle(node).backgroundColor)).toBe(color);
  await page.reload();
  if(width<768)await page.getByRole('button',{name:'Open menu',exact:true}).click();
  const again=page.getByRole('button',{name:'Checklists',exact:true});
  if(width>=768&&!await again.isVisible())await page.getByRole('button',{name:'Show menu',exact:true}).click();
  await again.click();await page.getByRole('textbox',{name:'Search checklists'}).fill('Reorder ');
  await expect(page.locator('article').first()).toHaveAttribute('aria-label',width>=768?'Reorder second':'Reorder first');
  if(width<768){
   await page.getByRole('button',{name:'Move Reorder first',exact:true}).press('ArrowDown');
   await expect(page.getByRole('status')).toHaveText('Order saved automatically.');
   await expect(page.locator('article').first()).toHaveAttribute('aria-label','Reorder second');
  }
 }
});
