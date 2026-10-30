<?php
declare(strict_types=1);
require_once __DIR__.'/config.php';
require_once __DIR__.'/compliance_module.php';
function cp_reply(array $p,int $status=200):void {http_response_code($status);echo json_encode($p);exit;}
session_start(['cookie_httponly'=>true,'cookie_secure'=>!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off','cookie_samesite'=>'Lax']);
if(empty($_SESSION['documents_tenant'])||(int)$_SESSION['documents_tenant']!==app_tenant_id())cp_reply(['success'=>false,'error'=>'Please sign out and sign in again.'],401);
if(strtolower($currentTenant['status']??'')!=='active'||(app_requested_tenant_code()!==''&&app_requested_tenant_code()!==app_tenant_code()))cp_reply(['success'=>false,'error'=>'Organisation unavailable.'],403);
if(($currentTenant['db_mode']??'')==='dedicated'&&$conn===$platformConn)cp_reply(['success'=>false,'error'=>'Organisation database unavailable.'],503);
$actor=(int)($_SESSION['documents_user']??0);$actorName='Platform Admin';$admin=!empty($_SESSION['documents_platform_admin']);$csrf=(string)($_SESSION['documents_csrf']??'');session_write_close();$tenant=app_tenant_id();
try{
    if(!$admin){$user=dsc_active_user($conn,$actor,$tenant);$actorName=$user['name'];$scope=app_table_is_scoped($conn,'users')?' AND tenant_id=?':'';$u=dsc_all($conn,'SELECT role FROM users WHERE id=?'.$scope,$scope?[$actor,$tenant]:[$actor]);$admin=($u[0]['role']??'')==='Admin';}
    cp_schema($conn);
    if($_SERVER['REQUEST_METHOD']==='GET'){
        if(isset($_GET['session']))cp_reply(['success'=>true,'csrf'=>$csrf]);
        $id=(int)($_GET['id']??0);
        if($id){$row=cp_find($conn,'compliance_entries',$id);if(!$admin&&!in_array($actorName,array_map('trim',explode(',',$row['assigned_user_name'])),true))cp_reply(['success'=>false,'error'=>'Access denied.'],403);$events=dsc_all($conn,'SELECT * FROM compliance_history WHERE tenant_id=? AND entry_id=? ORDER BY id DESC',[$tenant,$id]);if(!$admin){$events=array_values(array_filter($events,fn($e)=>in_array($e['action'],['Generated','updateEntry','extend','cancel'],true)));foreach($events as &$event){$details=json_decode($event['details'],true);$event['details']=json_encode(['stage'=>$details['changes']['current_stage']??null,'remarks'=>$details['changes']['remarks']??'','reason'=>$details['reason']??'']);}unset($event);}cp_reply(['success'=>true,'history'=>$events]);}
        if($admin){cp_sync_work($conn);cp_generate($conn);}
        $entries=dsc_all($conn,'SELECT * FROM compliance_entries WHERE tenant_id=? ORDER BY due_date,id DESC',[$tenant]);
        if(!$admin){$entries=array_values(array_filter($entries,fn($r)=>in_array($actorName,array_map('trim',explode(',',$r['assigned_user_name'])),true)));foreach($entries as &$entry){unset($entry['fee'],$entry['billing_type'],$entry['billing_status']);}unset($entry);}
        $templates=dsc_all($conn,'SELECT * FROM compliance_templates WHERE tenant_id=? ORDER BY name',[$tenant]);
        foreach($templates as &$t){$t['stages']=dsc_all($conn,'SELECT name,is_completion FROM compliance_stages WHERE tenant_id=? AND template_id=? AND active=1 ORDER BY sequence_no,id',[$tenant,$t['id']]);$t['schedules']=array_map(fn($s)=>json_decode($s['definition'],true),dsc_all($conn,'SELECT definition FROM compliance_schedules WHERE tenant_id=? AND template_id=? AND active=1 ORDER BY id LIMIT 1',[$tenant,$t['id']]));}unset($t);
        $categories=array_map(fn($c)=>['id'=>$c['id'],'name'=>$c['name']],cp_rows($conn,'categories'));
        $users=array_map(fn($u)=>['id'=>$u['id'],'name'=>$u['name'],'isActive'=>$u['isActive']],cp_rows($conn,'users'));
        $clients=array_map(fn($f)=>['id'=>$f['id'],'name'=>$f['name']],cp_rows($conn,'firms'));
        cp_reply(['success'=>true,'entries'=>$entries,'templates'=>$templates,'assignments'=>$admin?dsc_all($conn,'SELECT * FROM client_compliances WHERE tenant_id=?',[$tenant]):[],'users'=>$users,'clients'=>$clients,'categories'=>$categories,'bills'=>$admin?dsc_all($conn,'SELECT * FROM billing_records WHERE tenant_id=? ORDER BY id DESC',[$tenant]):[],'billItems'=>$admin?dsc_all($conn,'SELECT * FROM billing_record_items WHERE tenant_id=?',[$tenant]):[],'admin'=>$admin,'csrf'=>$csrf]);
    }
    if($_SERVER['REQUEST_METHOD']!=='POST')cp_reply(['success'=>false,'error'=>'Method not allowed.'],405);
    $data=app_get_raw_input_data();if($csrf===''||!hash_equals($csrf,(string)($data['csrf']??'')))cp_reply(['success'=>false,'error'=>'Session expired. Reload and try again.'],403);
    $action=(string)($data['action']??'');
    if(!$admin && !in_array($action,['updateEntry','taskDefaults'],true))cp_reply(['success'=>false,'error'=>'Only an Admin can change setup or billing.'],403);
    if($action==='generate'){cp_sync_work($conn);$count=cp_generate($conn,(string)($data['through']??''));cp_reply(['success'=>true,'generated'=>$count]);}
    $conn->begin_transaction();
    if($action==='taskDefaults'){
        $source=(string)($data['source_type']??'');$sourceId=(int)($data['source_id']??0);
        if(!in_array($source,['Simple','Recurring Master'],true))throw new InvalidArgumentException('Invalid source.');
        $table=$source==='Simple'?'main_tasks':'recurring_tasks';$scope=app_table_is_scoped($conn,$table)?' AND tenant_id=?':'';
        $found=dsc_all($conn,'SELECT * FROM '.$table.' WHERE id=?'.$scope,$scope?[$sourceId,$tenant]:[$sourceId]);if(!$found)throw new InvalidArgumentException('Task unavailable.');
        $sourceRow=$found[0];$prior=dsc_all($conn,'SELECT id FROM task_billing_defaults WHERE tenant_id=? AND source_type=? AND source_id=?',[$tenant,$source,$sourceId]);
        if($prior)throw new InvalidArgumentException('Use Billing Type / Fee to update existing defaults.');
        if(!$admin&&($prior||!in_array($actorName,array_map('trim',explode(',',($sourceRow['owner']??'').','.($sourceRow['assignees']??$sourceRow['assignee']??''))),true)))throw new InvalidArgumentException('Only an Admin can change existing Billing Type.');
        $type=cp_billing($data['billing_type']??'');$fee=$type==='Billable'?cp_money($data['fee']??null):null;
        dsc_query($conn,'INSERT INTO task_billing_defaults (tenant_id,source_type,source_id,billing_type,fee) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE billing_type=VALUES(billing_type),fee=VALUES(fee)',[$tenant,$source,$sourceId,$type,$fee]);
        $entry=dsc_all($conn,'SELECT * FROM compliance_entries WHERE tenant_id=? AND source_type=? AND source_key=? FOR UPDATE',[$tenant,$source,(string)$sourceId]);
        if($entry){if($entry[0]['billing_status']==='Billed')throw new InvalidArgumentException('Reverse billing before changing fee.');cp_patch($conn,'compliance_entries',$entry[0],['billing_type'=>$type,'fee'=>$fee]);}
        cp_history($conn,(int)($entry[0]['id']??0),'Task Billing Type',['source'=>$source,'source_id'=>$sourceId,'billing_type'=>$type,'fee'=>$fee],$actor,$actorName);
    }elseif($action==='template'){
        $id=(int)($data['id']??0);$row=$id?cp_find($conn,'compliance_templates',$id,true):null;
        if($row&&(int)$data['version']!==(int)$row['version'])throw new InvalidArgumentException('Record changed. Refresh and try again.');
        $values=['name'=>dsc_text($data,'name',190,true),'category'=>dsc_text($data,'category',190),'kind'=>(string)($data['kind']??''),'active'=>!empty($data['active'])?1:0];
        if($values['category']!=='' && !in_array($values['category'],array_column(cp_rows($conn,'categories'),'name'),true))throw new InvalidArgumentException('Select a task category from this organisation.');
        if(!in_array($values['kind'],['Filing','Payment','Combined'],true))throw new InvalidArgumentException('Select compliance type.');
        $stages=$data['stages']??[];$schedules=$data['schedules']??[];
        if(!is_array($stages)||count($stages)<2||count($stages)>30||!is_array($schedules)||!$schedules||count($schedules)!==1)throw new InvalidArgumentException('Enter 2–30 stages and exactly one schedule.');
        $names=[];$complete=0;foreach($stages as $stage){$name=dsc_text($stage,'name',190,true);if(in_array(strtolower($name),$names,true))throw new InvalidArgumentException('Stage names must be unique.');$names[]=strtolower($name);$complete+=!empty($stage['is_completion'])?1:0;}
        if(!$complete||!empty($stages[0]['is_completion']))throw new InvalidArgumentException('Choose a completion stage after the initial stage.');
        $schedules=array_map('cp_schedule',$schedules);
        if($row){cp_patch($conn,'compliance_templates',$row,$values);dsc_query($conn,'UPDATE compliance_stages SET active=0 WHERE tenant_id=? AND template_id=?',[$tenant,$id]);}else $id=dsc_insert($conn,'compliance_templates',['tenant_id'=>$tenant]+$values);
        foreach($stages as $i=>$s)dsc_insert($conn,'compliance_stages',['tenant_id'=>$tenant,'template_id'=>$id,'name'=>trim($s['name']),'sequence_no'=>$i,'is_completion'=>!empty($s['is_completion'])?1:0]);
        // Keep schedule IDs stable by position: edited schedules must not regenerate the same period.
        $old=dsc_all($conn,'SELECT * FROM compliance_schedules WHERE tenant_id=? AND template_id=? AND active=1 ORDER BY id',[$tenant,$id]);
        foreach($schedules as $i=>$s){if(isset($old[$i]))dsc_query($conn,'UPDATE compliance_schedules SET definition=? WHERE id=? AND tenant_id=?',[json_encode($s),$old[$i]['id'],$tenant]);else dsc_insert($conn,'compliance_schedules',['tenant_id'=>$tenant,'template_id'=>$id,'definition'=>json_encode($s)]);}
        foreach(array_slice($old,count($schedules)) as $o)dsc_query($conn,'UPDATE compliance_schedules SET active=0 WHERE id=? AND tenant_id=?',[$o['id'],$tenant]);
        cp_history($conn,0,'Compliance setup',['template_id'=>$id,'before'=>$row,'after'=>$values,'stages'=>$stages,'schedules'=>$schedules],$actor,$actorName);
    }elseif($action==='assign'){
        $t=cp_find($conn,'compliance_templates',(int)$data['template_id']);$ids=$data['client_ids']??[];if(!is_array($ids)||!$ids||count($ids)>300)throw new InvalidArgumentException('Select 1–300 clients.');
        $u=dsc_active_user($conn,(int)$data['assigned_user_id'],$tenant);$start=(string)($data['start_date']??'');$end=($data['end_date']??'')?:null;if(!cp_date($start)||($end&&(!cp_date($end)||$end<$start)))throw new InvalidArgumentException('Enter valid assignment dates.');
        $day=($data['due_day']??'')===''?null:(int)$data['due_day'];if($day!==null&&($day<1||$day>31))throw new InvalidArgumentException('Due day must be 1–31.');
        foreach(array_unique(array_map('intval',$ids)) as $clientId){$scope=app_table_is_scoped($conn,'firms')?' AND tenant_id=?':'';$f=dsc_all($conn,'SELECT id,name FROM firms WHERE id=?'.$scope,$scope?[$clientId,$tenant]:[$clientId]);if(!$f)throw new InvalidArgumentException('Client unavailable.');
            $existing=dsc_all($conn,'SELECT * FROM client_compliances WHERE tenant_id=? AND template_id=? AND client_id=? FOR UPDATE',[$tenant,$t['id'],$clientId]);
            $v=['assigned_user_id'=>$u['id'],'assigned_user_name'=>$u['name'],'start_date'=>$start,'end_date'=>$end,'billing_type'=>cp_billing($data['billing_type']??''),'fee'=>($data['billing_type']??'')==='Billable'?cp_money($data['fee']??null):null,'due_day'=>$day,'active'=>!empty($data['active'])?1:0];
            if($existing)cp_patch($conn,'client_compliances',$existing[0],$v);else dsc_insert($conn,'client_compliances',['tenant_id'=>$tenant,'template_id'=>$t['id'],'client_id'=>$clientId,'client_name'=>$f[0]['name']]+$v);
            cp_history($conn,0,'Client assignment',['template_id'=>$t['id'],'client_id'=>$clientId,'before'=>$existing[0]??null,'after'=>$v],$actor,$actorName);
        }
    }elseif($action==='assignmentActive'){
        $r=cp_find($conn,'client_compliances',(int)$data['id'],true);cp_patch($conn,'client_compliances',$r,['active'=>!empty($data['active'])?1:0]);cp_history($conn,0,'Assignment active changed',['id'=>$r['id'],'active'=>$data['active']],$actor,$actorName);
    }elseif(in_array($action,['updateEntry','classify','extend','cancel'],true)){
        $ids=$data['ids']??[$data['id']??0];if(!is_array($ids)||!$ids||count($ids)>300)throw new InvalidArgumentException('Select 1–300 entries.');
        $ids=array_values(array_unique(array_map('intval',$ids)));sort($ids);
        foreach($ids as $id){$r=cp_find($conn,'compliance_entries',$id,true);$v=[];
            if(isset($data['version'])&&(int)$data['version']!==(int)$r['version'])throw new InvalidArgumentException('Record changed. Refresh and try again.');
            if($action==='classify'){
                if($r['billing_status']==='Billed')throw new InvalidArgumentException('Reverse billing before changing billing details.');
                $type=cp_billing($data['billing_type']??'');
                $v=['billing_type'=>$type,'fee'=>$type==='Billable'?cp_money($data['fee']??null):null];
                if(in_array($r['source_type'],['Simple','Recurring Master'],true))dsc_query($conn,'INSERT INTO task_billing_defaults (tenant_id,source_type,source_id,billing_type,fee) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE billing_type=VALUES(billing_type),fee=VALUES(fee)',[$tenant,$r['source_type'],$r['source_id'],$type,$v['fee']]);
            }elseif($action==='extend'){
                if($r['source_type']!=='Compliance'||$r['work_status']==='Cancelled')throw new InvalidArgumentException('Only active compliance entries can be extended.');$due=(string)($data['due_date']??'');if(!cp_date($due)||$due<$r['due_date'])throw new InvalidArgumentException('Choose an extended due date.');$v=['due_date'=>$due];dsc_text($data,'reason',1000,true);
            }elseif($action==='cancel'){
                if($r['source_type']!=='Compliance'||$r['billing_status']==='Billed')throw new InvalidArgumentException('Only unbilled compliance entries can be cancelled.');$v=['work_status'=>'Cancelled','cancellation_reason'=>dsc_text($data,'reason',1000,true)];
            }else{
                if($r['source_type']!=='Compliance'||$r['work_status']==='Cancelled')throw new InvalidArgumentException('Update this work through its task section.');
                if(!$admin&&!in_array($actorName,array_map('trim',explode(',',$r['assigned_user_name'])),true))cp_reply(['success'=>false,'error'=>'Access denied.'],403);
                $stage=dsc_text($data,'current_stage',190,true);$found=null;foreach(json_decode($r['stages_json'],true) as $st)if($st['name']===$stage)$found=$st;
                if(!$found)throw new InvalidArgumentException('Choose a stage from this entry’s workflow.');
                $v=['current_stage'=>$stage,'work_status'=>!empty($found['is_completion'])?'Completed':'Pending','completed_on'=>!empty($found['is_completion'])?(new DateTimeImmutable('today',new DateTimeZone('Asia/Kolkata')))->format('Y-m-d'):null,'remarks'=>dsc_text($data,'remarks',10000),'acknowledgement'=>dsc_text($data,'acknowledgement',190),'challan_reference'=>dsc_text($data,'challan_reference',190),'amount_due'=>cp_money($data['amount_due']??null),'amount_paid'=>cp_money($data['amount_paid']??null)];
                foreach(['paid_on','filed_on'] as $key){$v[$key]=($data[$key]??'')?:null;if($v[$key]&&!cp_date($v[$key]))throw new InvalidArgumentException('Enter valid filing/payment dates.');}
                $attachment=dsc_text($data,'attachment',2000000);if($attachment!==''&&!preg_match('~^(https://|data:(application/pdf|image/(png|jpeg));base64,)~',$attachment))throw new InvalidArgumentException('Use an HTTPS attachment link, PDF or image.');$v['attachment']=$attachment;
                if($admin){$u=dsc_active_user($conn,(int)($data['assigned_user_id']??$r['assigned_user_id']),$tenant);$v['assigned_user_id']=$u['id'];$v['assigned_user_name']=$u['name'];$due=(string)($data['due_date']??$r['due_date']);if(!cp_date($due))throw new InvalidArgumentException('Enter a valid due date.');$v['due_date']=$due;}
            }
            cp_patch($conn,'compliance_entries',$r,$v);cp_history($conn,$id,$action,['before'=>$r,'changes'=>$v,'reason'=>$data['reason']??''],$actor,$actorName);
        }
    }elseif($action==='bill'){
        $ids=array_values(array_unique(array_map('intval',$data['ids']??[])));sort($ids);if(!$ids||count($ids)>300)throw new InvalidArgumentException('Select 1–300 billable entries.');$invoice=dsc_text($data,'invoice_number',190,true);$date=(string)($data['invoice_date']??'');if(!cp_date($date))throw new InvalidArgumentException('Enter invoice date.');$rows=[];$client=null;
        foreach($ids as $id){$r=cp_find($conn,'compliance_entries',$id,true);if($r['source_type']==='Recurring Master'||$r['work_status']==='Cancelled'||$r['billing_type']!=='Billable'||$r['billing_status']==='Billed')throw new InvalidArgumentException('Selection includes non-billable, cancelled or already billed work.');if($r['fee']===null)throw new InvalidArgumentException('Enter a fee before billing.');if($r['client_name']===''||($client!==null&&$client!==$r['client_name']))throw new InvalidArgumentException('Select entries for the same client.');$client=$r['client_name'];$rows[]=$r;}
        $bill=dsc_insert($conn,'billing_records',['tenant_id'=>$tenant,'client_name'=>$client,'invoice_number'=>$invoice,'invoice_date'=>$date,'remarks'=>dsc_text($data,'remarks',10000),'actor_id'=>$actor,'actor_name'=>$actorName]);
        foreach($rows as $r){dsc_insert($conn,'billing_record_items',['tenant_id'=>$tenant,'billing_id'=>$bill,'entry_id'=>$r['id'],'fee'=>$r['fee']]);cp_patch($conn,'compliance_entries',$r,['billing_status'=>'Billed']);cp_history($conn,(int)$r['id'],'Billed',['billing_id'=>$bill,'invoice'=>$invoice,'date'=>$date,'fee'=>$r['fee']],$actor,$actorName);}
    }elseif($action==='reverseBill'){
        $r=cp_find($conn,'compliance_entries',(int)$data['id'],true);if($r['billing_status']!=='Billed')throw new InvalidArgumentException('Entry is not billed.');$reason=dsc_text($data,'reason',1000,true);dsc_query($conn,'UPDATE billing_record_items SET active=0,reversal_reason=? WHERE tenant_id=? AND entry_id=? AND active=1',[$reason,$tenant,$r['id']]);cp_patch($conn,'compliance_entries',$r,['billing_status'=>'Not Billed']);cp_history($conn,(int)$r['id'],'Billing reversed',['reason'=>$reason],$actor,$actorName);
    }else throw new InvalidArgumentException('Unknown action.');
    $conn->commit();cp_reply(['success'=>true]);
}catch(InvalidArgumentException $e){$conn->rollback();cp_reply(['success'=>false,'error'=>$e->getMessage()],422);}catch(Throwable $e){$conn->rollback();error_log('Compliance: '.$e->getMessage());cp_reply(['success'=>false,'error'=>'Unable to complete the operation. Please refresh and try again.'],409);}
