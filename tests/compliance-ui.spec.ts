import {test,expect} from '@playwright/test';
test('Billing navigation and simple task fields',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const response=await page.request.post('/api/login.php',{data:{orgId:'test-a',email:'test-admin@example.com',password:'test-admin-password'}});
 const auth=await response.json();expect(auth.success).toBeTruthy();
 await page.addInitScript((user)=>{localStorage.setItem('taskpro_user',JSON.stringify(user));localStorage.setItem('taskpro_tenant_code','test-a');localStorage.setItem('taskpro_api_url','/api/init.php');},auth.user);
 await page.goto('/');
 await page.getByRole('button',{name:'Billing',exact:true}).click();
 await expect(page.getByRole('tab',{name:/Billing Type Review/})).toBeVisible();
 await page.getByRole('tab',{name:/Recurring Defaults/}).click();
 await expect(page.getByText('Bookkeeping',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Show menu',exact:true}).click();
 await page.getByRole('button',{name:'Simple Tasks',exact:true}).click();
 await page.getByRole('button',{name:'Add Task',exact:true}).click();
 await expect(page.getByLabel('Billing Type')).toBeVisible();
 await page.getByLabel('Billing Type').selectOption('Non Billable');
 await expect(page.getByLabel('Professional fee',{exact:true})).toBeVisible();
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
 for(const label of ['Introduction','Closing Note','Category','Checklist Items'])await expect(dialog.getByText(label,{exact:true})).toHaveCount(0);
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
 await expect(page.getByRole('button',{name:'Checklists',exact:true})).toHaveCount(0);
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
