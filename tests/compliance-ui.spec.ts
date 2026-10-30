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
 await page.getByRole('button',{name:'Master',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Checklists',exact:true})).toBeVisible();
 await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{(window as any).__copiedChecklist=text;}}});});
 await page.getByRole('button',{name:'Copy Direct Copy Test',exact:true}).click();
 await expect(page.getByRole('status')).toHaveText('Checklist copied.');
 expect(await page.evaluate(()=>(window as any).__copiedChecklist)).toBe('Direct Copy Test\n\nPlease share:\n\n1. Sales register\n2. Bank statement\n\nThank you.');
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
