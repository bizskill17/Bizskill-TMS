<?php
declare(strict_types=1);
// Run after dsc-integration.php against its disposable test database and cookies.
$base='http://127.0.0.1:8080';
$db=new mysqli(getenv('DB_HOST'),getenv('DB_USER'),getenv('DB_PASS'),getenv('DB_NAME'));
function ck(bool $ok,string $message):void {if(!$ok)throw new RuntimeException($message);}
function call_cp(?array $data=null,string $org='test-a',string $jar='a',string $query=''):array {
 global $base;$c=curl_init($base.'/api/compliance.php?tenantCode='.$org.$query);$cookie=sys_get_temp_dir().'/dsc-test-'.$jar.'.cookies';
 curl_setopt_array($c,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_COOKIEFILE=>$cookie,CURLOPT_COOKIEJAR=>$cookie,CURLOPT_TIMEOUT=>40]);
 if($data!==null){curl_setopt($c,CURLOPT_POST,true);curl_setopt($c,CURLOPT_HTTPHEADER,['Content-Type: application/json']);curl_setopt($c,CURLOPT_POSTFIELDS,json_encode($data));}
 $raw=curl_exec($c);$code=curl_getinfo($c,CURLINFO_HTTP_CODE);curl_close($c);$p=json_decode((string)$raw,true);ck(is_array($p),'Invalid JSON: '.substr((string)$raw,0,400));return [$code,$p];
}
[$code]=call_cp(null,'test-a','anonymous');ck($code===401,'Anonymous rejected');
[$code,$data]=call_cp();ck($code===200&&$data['admin'],'Admin load');$csrf=$data['csrf'];
function post_cp(string $action,array $data=[]):array {global $csrf;[$code,$p]=call_cp(['csrf'=>$csrf,'action'=>$action]+$data);ck($code===200,'Action '.$action.': '.json_encode($p));return $p;}
$tenant=(int)$db->query("SELECT id FROM tenants WHERE code='test-a'")->fetch_assoc()['id'];$other=(int)$db->query("SELECT id FROM tenants WHERE code='test-b'")->fetch_assoc()['id'];
$user=(int)$db->query("SELECT id FROM users WHERE tenant_id={$tenant} AND name='User A'")->fetch_assoc()['id'];$otherUser=(int)$db->query("SELECT id FROM users WHERE tenant_id={$other} AND name='User B'")->fetch_assoc()['id'];$client=(int)$db->query("SELECT id FROM firms WHERE tenant_id={$tenant} AND name='Client A'")->fetch_assoc()['id'];$otherClient=(int)$db->query("SELECT id FROM firms WHERE tenant_id={$other} LIMIT 1")->fetch_assoc()['id'];
$db->query("INSERT INTO categories (name,tenant_id) VALUES ('GST',{$tenant}),('Other Tenant Category',{$other})");
[$code,$categoryData]=call_cp();ck(in_array('GST',array_column($categoryData['categories'],'name'),true),'Task categories returned');ck(!in_array('Other Tenant Category',array_column($categoryData['categories'],'name'),true),'Categories tenant isolated');
[$code]=call_cp(['action'=>'template','csrf'=>'bad']);ck($code===403,'CSRF rejected');
$stages=[['name'=>'Pending Documents','is_completion'=>false],['name'=>'Filed','is_completion'=>true]];
$template=['name'=>'Test GST','category'=>'GST','kind'=>'Combined','active'=>true,'stages'=>$stages,'schedules'=>[['name'=>'Monthly','frequency'=>'Monthly','months'=>[],'due_day'=>20,'month_offset'=>1,'lead_days'=>30]]];
[$code]=call_cp(['action'=>'template','csrf'=>$csrf]+array_replace($template,['schedules'=>[$template['schedules'][0],$template['schedules'][0]]]));ck($code===422,'Multiple schedules rejected');
[$code]=call_cp(['action'=>'template','csrf'=>$csrf]+array_replace($template,['category'=>'Other Tenant Category']));ck($code===422,'Cross tenant category rejected');
post_cp('template',$template);[$code,$data]=call_cp();$t=$data['templates'][0];$tid=(int)$t['id'];
[$code]=call_cp(['action'=>'assign','csrf'=>$csrf,'template_id'=>$tid,'client_ids'=>[$otherClient],'assigned_user_id'=>$user,'start_date'=>'2026-04-01','billing_type'=>'Billable','active'=>true]);ck($code===422,'Cross tenant client rejected');
[$code]=call_cp(['action'=>'assign','csrf'=>$csrf,'template_id'=>$tid,'client_ids'=>[$client],'assigned_user_id'=>$otherUser,'start_date'=>'2026-04-01','billing_type'=>'Billable','active'=>true]);ck($code===422,'Cross tenant user rejected');
post_cp('assign',['template_id'=>$tid,'client_ids'=>[$client],'assigned_user_id'=>$user,'start_date'=>'2026-04-01','billing_type'=>'Billable','fee'=>'1500','active'=>true]);
// Older multi-schedule setups must not keep generating duplicate work.
$definition=$db->real_escape_string(json_encode($template['schedules'][0]));
$db->query("INSERT INTO compliance_schedules (tenant_id,template_id,definition,active) VALUES ({$tenant},{$tid},'{$definition}',1)");
post_cp('generate',['through'=>'2026-12-31']);[$code,$data]=call_cp();$entries=array_values(array_filter($data['entries'],fn($r)=>$r['source_type']==='Compliance'));$count=count($entries);ck($count>1,'Multiple periods generated');ck(count(array_unique(array_column($entries,'period_start')))===$count,'Legacy extra schedules must not generate duplicate periods');ck(count($data['templates'][0]['schedules'])===1,'Setup exposes exactly one schedule');
post_cp('template',['id'=>$tid,'version'=>$t['version']]+$template);ck((int)$db->query("SELECT COUNT(*) AS n FROM compliance_schedules WHERE tenant_id={$tenant} AND template_id={$tid} AND active=1")->fetch_assoc()['n']===1,'Saving setup deactivates legacy extra schedules');
$p=post_cp('generate',['through'=>'2026-12-31']);ck($p['generated']===0,'Generation deduplicated');
$entry=$entries[0];$id=(int)$entry['id'];
[$code]=call_cp(['csrf'=>$csrf,'action'=>'updateEntry','id'=>$id,'version'=>$entry['version'],'current_stage'=>'Injected']);ck($code===422,'Invalid stage rejected');
post_cp('updateEntry',['id'=>$id,'version'=>$entry['version'],'current_stage'=>'Filed','assigned_user_id'=>$user,'due_date'=>$entry['due_date'],'remarks'=>'Completed','attachment'=>'','acknowledgement'=>'ACK-1','challan_reference'=>'CH-1','amount_due'=>'50000','amount_paid'=>'50000','paid_on'=>'2026-10-29','filed_on'=>'2026-10-29']);
[$code,$data]=call_cp();$r=array_values(array_filter($data['entries'],fn($r)=>(int)$r['id']===$id))[0];ck($r['work_status']==='Completed'&&$r['billing_status']==='Not Billed','Completion independent of billing');
post_cp('classify',['ids'=>[$id],'billing_type'=>'Non Billable','fee'=>'999']);
[$code,$changed]=call_cp();$classified=array_values(array_filter($changed['entries'],fn($r)=>(int)$r['id']===$id))[0];ck($classified['billing_type']==='Non Billable'&&$classified['fee']===null,'Non billable conversion needs no reason and ignores hidden fees');
post_cp('classify',['ids'=>[$id],'billing_type'=>'Billable','fee'=>'1500']);
post_cp('bill',['ids'=>[$id],'invoice_number'=>'INV-1','invoice_date'=>'2026-10-29']);
[$code]=call_cp(['csrf'=>$csrf,'action'=>'bill','ids'=>[$id],'invoice_number'=>'INV-2','invoice_date'=>'2026-10-29']);ck($code===422,'Duplicate billing rejected');
[$code]=call_cp(['csrf'=>$csrf,'action'=>'reverseBill','id'=>$id]);ck($code===422,'Reversal requires reason');post_cp('reverseBill',['id'=>$id,'reason'=>'Invoice cancelled']);
post_cp('bill',['ids'=>[$id],'invoice_number'=>'INV-3','invoice_date'=>'2026-10-29']);
// Bulk invoice must roll back if a later item is already billed.
$second=$entries[1];[$code]=call_cp(['csrf'=>$csrf,'action'=>'bill','ids'=>[$second['id'],$id],'invoice_number'=>'BAD','invoice_date'=>'2026-10-29']);ck($code===422,'Invalid bulk invoice rejected');
$n=$db->query("SELECT billing_status FROM compliance_entries WHERE id=".(int)$second['id'])->fetch_assoc()['billing_status'];ck($n==='Not Billed','Bulk failure atomic');
[$code,$b]=call_cp(null,'test-b','b');ck($code===200&&count($b['entries'])===0,'Tenant isolation');[$code]=call_cp(['csrf'=>$b['csrf'],'action'=>'cancel','ids'=>[$id],'reason'=>'Cross tenant'],'test-b','b');ck($code===422,'Cross tenant entry mutation rejected');
[$code,$ordinary]=call_cp(null,'test-a','ordinary');ck($code===200&&!$ordinary['admin'],'Ordinary user load');ck(!isset($ordinary['entries'][0]['fee']),'Billing fee hidden from ordinary Users');[$code]=call_cp(['csrf'=>$ordinary['csrf'],'action'=>'bill','ids'=>[$second['id']],'invoice_number'=>'BAD','invoice_date'=>'2026-10-29'],'test-a','ordinary');ck($code===403,'Billing Admin only');
[$code,$h]=call_cp(null,'test-a','a','&id='.$id);ck(count($h['history'])>=5,'Full audit history retained');
$assignment=$data['assignments'][0];post_cp('assignmentActive',['id'=>$assignment['id'],'active'=>false]);$p=post_cp('generate',['through'=>'2027-12-31']);ck($p['generated']===0,'Deactivation stops generation');
post_cp('extend',['ids'=>[$second['id']],'due_date'=>'2028-12-31','reason'=>'Extension']);post_cp('cancel',['ids'=>[$second['id']],'reason'=>'Not applicable']);
// New task defaults, old task review, and immutable recurring occurrences.
$db->query("INSERT INTO main_tasks(id,title,firm,status,tenant_id) VALUES (90001,'Report','Client A','Completed',{$tenant})");
post_cp('taskDefaults',['source_type'=>'Simple','source_id'=>90001,'billing_type'=>'Billable','fee'=>'2000']);
$db->query("INSERT INTO recurring_tasks(id,title,firm,tenant_id) VALUES (90002,'Bookkeeping','Client A',{$tenant})");post_cp('taskDefaults',['source_type'=>'Recurring Master','source_id'=>90002,'billing_type'=>'Non Billable','fee'=>'']);
$db->query("INSERT INTO recurring_actions(id,taskId,taskTitle,firm,status,updatedOn,tenant_id) VALUES (90003,90002,'Bookkeeping','Client A','Completed','29/10/2026',{$tenant}),(90004,90002,'Bookkeeping','Client A','Completed','29/10/2026',{$tenant})");
[$code,$data]=call_cp();$rec=array_values(array_filter($data['entries'],fn($r)=>$r['source_type']==='Recurring'&&(int)$r['source_id']===90002));ck(count($rec)===1&&$rec[0]['billing_type']==='Non Billable','Recurring completion duplicate logs deduplicated and defaults inherited');
$simple=array_values(array_filter($data['entries'],fn($r)=>$r['source_type']==='Simple'&&(int)$r['source_id']===90001))[0];ck($simple['billing_type']==='Billable'&&$simple['billing_status']==='Not Billed','Simple task defaults inherited');
[$code,$dedicated]=call_cp(null,'test-c','c');ck($code===200&&count($dedicated['entries'])===0,'Dedicated database isolated');
echo "Compliance integration passed: stages, generation, isolation, billing, reversal, defaults and occurrences. No real messages sent.\n";
