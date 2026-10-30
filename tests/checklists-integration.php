<?php
declare(strict_types=1);
// Disposable CI database only. Run after DSC and compliance integration.
$db=new mysqli(getenv('DB_HOST'),getenv('DB_USER'),getenv('DB_PASS'),getenv('DB_NAME'));
function note_expect(bool $ok,string $message):void {if(!$ok)throw new RuntimeException($message);}
function note_call(?array $data=null,string $org='test-a',string $jar='a'):array {
 $c=curl_init('http://127.0.0.1:8080/api/checklists.php?tenantCode='.$org);
 $cookie=sys_get_temp_dir().'/dsc-test-'.$jar.'.cookies';
 curl_setopt_array($c,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_COOKIEFILE=>$cookie,CURLOPT_TIMEOUT=>20]);
 if($data!==null){curl_setopt($c,CURLOPT_POST,true);curl_setopt($c,CURLOPT_HTTPHEADER,['Content-Type: application/json']);curl_setopt($c,CURLOPT_POSTFIELDS,json_encode($data));}
 $raw=curl_exec($c);$status=curl_getinfo($c,CURLINFO_HTTP_CODE);curl_close($c);
 $body=json_decode((string)$raw,true);note_expect(is_array($body),'API must return JSON');return [$status,$body];
}
$tenant=(int)$db->query("SELECT id FROM tenants WHERE code='test-a'")->fetch_assoc()['id'];
$db->query("CREATE TABLE checklist_templates (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,tenant_id INT NOT NULL,name VARCHAR(190) NOT NULL,category VARCHAR(190) NOT NULL DEFAULT '',introduction TEXT NOT NULL,items MEDIUMTEXT NOT NULL,closing_note TEXT NOT NULL,active TINYINT NOT NULL DEFAULT 1,version INT NOT NULL DEFAULT 1)");
$db->query("INSERT INTO checklist_templates (tenant_id,name,introduction,items,closing_note,active) VALUES ({$tenant},'Legacy requirements','PAN and Aadhaar','[\"Photo\",\"Mobile\"]','Do not migrate closing',1),({$tenant},'Inactive legacy','Old','[\"Old item\"]','',0)");
$legacyId=(int)$db->query("SELECT id FROM checklist_templates WHERE name='Legacy requirements'")->fetch_assoc()['id'];
[$status]=note_call(null,'test-a','anonymous');note_expect($status===401,'Anonymous denied');
[$status,$data]=note_call();note_expect($status===200,'Admin load and schema upgrade');
$csrf=$data['csrf'];$legacy=array_values(array_filter($data['templates'],fn($n)=>(int)$n['id']===$legacyId))[0];
note_expect(str_contains($legacy['note_html'],'PAN and Aadhaar')&&str_contains($legacy['note_html'],'<li>Photo</li>'),'Legacy content displayed as one note');
note_expect(!str_contains($legacy['note_html'],'Do not migrate closing')&&!isset($legacy['introduction']),'Removed fields not returned');
[$status]=note_call(['csrf'=>'bad','name'=>'Bad','note_html'=>'<p>Note</p>']);note_expect($status===403,'CSRF required');
[$status,$created]=note_call(['csrf'=>$csrf,'name'=>'Rich note','note_html'=>'<p><strong>Bold</strong> <em>Italic</em></p><ol><li>First</li><li>Second</li></ol><script>alert(1)</script>']);
note_expect($status===200,'Create rich note');$id=(int)$created['id'];
[$status,$data]=note_call();$row=array_values(array_filter($data['templates'],fn($n)=>(int)$n['id']===$id))[0];
note_expect(str_contains($row['note_html'],'<strong>Bold</strong>')&&!str_contains($row['note_html'],'script'),'Saved markup sanitized');
[$status,$ordinary]=note_call(null,'test-a','ordinary');note_expect($status===200&&!$ordinary['admin'],'User can read notes');
note_expect(!in_array('Inactive legacy',array_column($ordinary['templates'],'name'),true),'Inactive notes stay hidden from Users');
[$status]=note_call(['csrf'=>$ordinary['csrf'],'id'=>$id,'version'=>1,'name'=>'Denied','note_html'=>'<p>Denied</p>'],'test-a','ordinary');note_expect($status===403,'Only Admin can edit');
[$status,$other]=note_call(null,'test-b','b');note_expect($status===200&&!$other['templates'],'Tenant isolation on read');
[$status]=note_call(['csrf'=>$other['csrf'],'id'=>$id,'version'=>1,'name'=>'Denied','note_html'=>'<p>Denied</p>'],'test-b','b');note_expect($status===400,'Cross-tenant edit denied');
[$status]=note_call(['csrf'=>$csrf,'id'=>$legacyId,'version'=>1,'name'=>'Legacy requirements','note_html'=>'<p>Edited note</p>']);note_expect($status===200,'Legacy note editable');
$old=$db->query("SELECT introduction,closing_note,note_html FROM checklist_templates WHERE id={$legacyId}")->fetch_assoc();
note_expect($old['introduction']==='PAN and Aadhaar'&&$old['closing_note']==='Do not migrate closing'&&$old['note_html']==='<p>Edited note</p>','Original fields preserved while Note is updated');
[$status]=note_call(['csrf'=>$csrf,'id'=>$legacyId,'version'=>1,'name'=>'Stale','note_html'=>'<p>Old</p>']);note_expect($status===400,'Stale edits denied');
foreach(['<p><br></p>','<p>&nbsp;</p>','<script>bad()</script>'] as $empty){[$status]=note_call(['csrf'=>$csrf,'name'=>'Empty','note_html'=>$empty]);note_expect($status===400,'Empty note rejected');}
[$status,$dedicated]=note_call(null,'test-c','c');note_expect($status===200&&!$dedicated['templates'],'Dedicated database isolated');
$master=$data['categories'][0]['name'];
[$status,$categoryNote]=note_call(['csrf'=>$csrf,'name'=>'Category test','category'=>$master,'note_html'=>'<p>Category note</p>']);note_expect($status===200,'Master category accepted');
$categoryId=(int)$categoryNote['id'];
[$status,$loaded]=note_call();$found=array_values(array_filter($loaded['templates'],fn($n)=>(int)$n['id']===$categoryId))[0];note_expect($found['category']===$master,'Category saved and returned');
[$status]=note_call(['csrf'=>$csrf,'name'=>'Invalid category','category'=>'Unknown category not in master','note_html'=>'<p>Note</p>']);note_expect($status===400,'Unknown category rejected');
[$status]=note_call(['csrf'=>$ordinary['csrf'],'action'=>'delete','id'=>$categoryId,'version'=>1],'test-a','ordinary');note_expect($status===403,'Only Admin can delete');
[$status]=note_call(['csrf'=>$other['csrf'],'action'=>'delete','id'=>$categoryId,'version'=>1],'test-b','b');note_expect($status===400,'Cross tenant deletion denied');
[$status]=note_call(['csrf'=>$csrf,'action'=>'delete','id'=>$categoryId,'version'=>999]);note_expect($status===400,'Stale deletion denied');
[$status]=note_call(['csrf'=>$csrf,'action'=>'delete','id'=>$categoryId,'version'=>1]);note_expect($status===200,'Admin can delete checklist');
[$status,$loaded]=note_call();note_expect(!in_array($categoryId,array_map('intval',array_column($loaded['templates'],'id')),true),'Deleted checklist no longer listed');
echo "Checklist API passed: legacy migration, rich notes, CSRF, permissions, concurrency and tenant isolation.\n";
