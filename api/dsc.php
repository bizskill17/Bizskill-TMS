<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/dsc_module.php';
require_once __DIR__ . '/notifications.php';
require_once __DIR__ . '/dsc_reminders.php';
function dsc_reply(array $payload,int $status=200): void { http_response_code($status); echo json_encode($payload); exit; }
session_start(['cookie_httponly'=>true,'cookie_secure'=>!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS']!=='off','cookie_samesite'=>'Lax']);
if (empty($_SESSION['documents_tenant']) || (int)$_SESSION['documents_tenant']!==app_tenant_id()) dsc_reply(['success'=>false,'error'=>'Please sign out and sign in again to access the DSC Register.'],401);
if (strtolower((string)($currentTenant['status'] ?? ''))!=='active' || (app_requested_tenant_code()!=='' && app_requested_tenant_code()!==app_tenant_code())) dsc_reply(['success'=>false,'error'=>'Organisation is unavailable.'],403);
if (strtolower((string)($currentTenant['db_mode'] ?? 'shared'))==='dedicated' && $conn===$platformConn) dsc_reply(['success'=>false,'error'=>'Organisation database connection is missing.'],503);
$tenant=app_tenant_id();
$actor=(int)($_SESSION['documents_user'] ?? 0);
$actorName='Platform Admin';
$canConfigure=!empty($_SESSION['documents_platform_admin']);
try {
    if (!$canConfigure) {
        $sql='SELECT id,name,role,isActive FROM users WHERE id=?'.(app_table_is_scoped($conn,'users')?' AND tenant_id=?':'');
        $found=dsc_all($conn,$sql,app_table_is_scoped($conn,'users')?[$actor,$tenant]:[$actor]);
        $user=$found[0] ?? null;
        if (!$user || !in_array(strtolower((string)$user['isActive']),['1','true','yes'],true)) dsc_reply(['success'=>false,'error'=>'User is inactive.'],403);
        $actorName=(string)$user['name'];
        $canConfigure=(string)$user['role']==='Admin';
    }
    $csrf=(string)($_SESSION['documents_csrf'] ?? '');
    session_write_close();
    dsc_schema($conn);
    if ($_SERVER['REQUEST_METHOD']==='GET') {
        $id=(int)($_GET['id'] ?? 0);
        if ($id) {
            if (!dsc_all($conn,'SELECT id FROM dsc_certificates WHERE id=? AND tenant_id=?',[$id,$tenant])) dsc_reply(['success'=>false,'error'=>'Certificate not found.'],404);
            $history=dsc_all($conn,'SELECT action,actor_name,notes,snapshot,created_at FROM dsc_events WHERE certificate_id=? AND tenant_id=? ORDER BY id DESC',[$id,$tenant]);
            $reminders=[];
            if (db_table_exists($conn,'notification_queue')) {
                $scope=app_table_is_scoped($conn,'notification_queue')?' AND q.tenant_id=e.tenant_id':'';
                $reminders=dsc_all($conn,"SELECT e.audience,e.target_name,e.target,e.stage,e.expiry_date,e.created_at,q.status,q.lastError FROM dsc_reminder_events e LEFT JOIN notification_queue q ON q.id=e.queue_id {$scope} WHERE e.certificate_id=? AND e.tenant_id=? ORDER BY e.id DESC",[$id,$tenant]);
            }
            dsc_reply(['success'=>true,'history'=>$history,'reminders'=>$reminders]);
        }
        $rows=dsc_all($conn,'SELECT * FROM dsc_certificates WHERE tenant_id=? ORDER BY expiry_date,id DESC',[$tenant]);
        $globalSettings=dsc_settings($conn,$tenant);
        foreach ($rows as &$certificate) {
            $certificate['responsible_user_id']=(int)($globalSettings['responsible_user_id'] ?? 0);
            $certificate['responsible_user_name']=(string)($globalSettings['responsible_user_name'] ?? '');
        }
        unset($certificate);
        $userScope=app_table_is_scoped($conn,'users')?' WHERE tenant_id=?':'';
        $users=dsc_all($conn,'SELECT id,name,isActive FROM users'.$userScope.' ORDER BY name', $userScope?[$tenant]:[]);
        $firmScope=app_table_is_scoped($conn,'firms')?' WHERE tenant_id=?':'';
        $clients=dsc_all($conn,'SELECT id,name FROM firms'.$firmScope.' ORDER BY name',$firmScope?[$tenant]:[]);
        $documents=db_table_exists($conn,'document_movements')?dsc_all($conn,'SELECT id,document_name,movement_date,direction,external_person,office_user_name,returned_on,client_name FROM document_movements WHERE tenant_id=? ORDER BY movement_date DESC,id DESC',[$tenant]):[];
        dsc_reply(['success'=>true,'certificates'=>$rows,'settings'=>dsc_settings($conn,$tenant),'users'=>$users,'clients'=>$clients,'documents'=>$documents,'canConfigure'=>$canConfigure,'csrf'=>$csrf]);
    }
    if ($_SERVER['REQUEST_METHOD']!=='POST') dsc_reply(['success'=>false,'error'=>'Method not allowed.'],405);
    $data=app_get_raw_input_data();
    if ($csrf==='' || !hash_equals($csrf,(string)($data['csrf'] ?? ''))) dsc_reply(['success'=>false,'error'=>'Session expired. Reload the DSC Register and try again.'],403);
    $action=(string)($data['action'] ?? '');

    if (in_array($action,['previewClientReminders','sendClientReminders'],true)) {
        $ids=$data['ids'] ?? [];
        if (!is_array($ids) || !$ids || count($ids)>100) throw new InvalidArgumentException('Select between 1 and 100 DSC entries.');
        foreach ($ids as $value) if (!ctype_digit((string)$value) || (int)$value<1) throw new InvalidArgumentException('Invalid selection.');
        $ids=array_values(array_unique(array_map('intval',$ids))); sort($ids);
        $provider=notifications_pick_whatsapp_provider(notifications_get_settings($conn));
        if ($provider==='' || !db_table_exists($conn,'notification_queue')) throw new InvalidArgumentException('Configure WhatsApp messaging first.');
        $rows=dsc_all($conn,'SELECT * FROM dsc_certificates WHERE tenant_id=? AND id IN ('.implode(',',array_fill(0,count($ids),'?')).') ORDER BY id',array_merge([$tenant],$ids));
        if (count($rows)!==count($ids)) throw new InvalidArgumentException('A selected certificate is unavailable.');
        $today=(new DateTimeImmutable('today',new DateTimeZone('Asia/Kolkata')))->format('Y-m-d');
        $preview=[];
        foreach ($rows as $row) {
            $phone=dsc_phone((string)$row['mobile'],$provider);
            if ($row['lifecycle']!=='active' || $row['deleted_at'] || $phone==='') throw new InvalidArgumentException('Select active DSC entries with valid client mobile numbers.');
            $preview[]=['id'=>(int)$row['id'],'version'=>(int)$row['version'],'client_name'=>$row['client_name'],'holder_name'=>$row['holder_name'],'mobile'=>$phone,'message'=>dsc_reminder_message($row,$today,'client')];
        }
        $batch=$action==='previewClientReminders'?bin2hex(random_bytes(16)):(string)($data['batch'] ?? '');
        $token=hash_hmac('sha256',$batch.'|'.$provider.'|'.json_encode($preview),$csrf);
        if ($action==='previewClientReminders') dsc_reply(['success'=>true,'recipients'=>$preview,'batch'=>$batch,'token'=>$token]);
        if (!preg_match('/^[a-f0-9]{32}$/',$batch) || !hash_equals($token,(string)($data['token'] ?? ''))) throw new InvalidArgumentException('Selection changed. Preview the messages again.');
        $queued=0;
        foreach ($rows as $i=>$row) $queued+=dsc_queue_reminder($conn,$row,-2,'client',(string)$row['holder_name'],$preview[$i]['mobile'],$provider,$today,$batch);
        dsc_reply(['success'=>true,'queued'=>$queued]);
    }

    if ($action==='settings') {
        if (!$canConfigure) dsc_reply(['success'=>false,'error'=>'Only an Admin can configure reminders.'],403);
        $intervals=dsc_intervals($data['intervals'] ?? []);
        $enabled=!empty($data['enabled'])?1:0;
        $office=!empty($data['office_reminders'])?1:0;
        $client=0;
        $expired=!empty($data['expired_reminder'])?1:0;
        if ($enabled && !$office && !$client) throw new InvalidArgumentException('Choose at least one reminder recipient.');
        $responsibleId=(int)($data['responsible_user_id'] ?? 0);
        $responsibleName='';
        if ($responsibleId) $responsibleName=(string)dsc_active_user($conn,$responsibleId,$tenant)['name'];
        if ($enabled && $office && !$responsibleId) throw new InvalidArgumentException('Select the Responsible User in DSC Settings.');
        $conn->begin_transaction();
        dsc_query($conn,'INSERT INTO dsc_settings (tenant_id,enabled,office_reminders,client_reminders,expired_reminder,intervals_json,responsible_user_id,responsible_user_name) VALUES (?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE enabled=VALUES(enabled),office_reminders=VALUES(office_reminders),client_reminders=VALUES(client_reminders),expired_reminder=VALUES(expired_reminder),intervals_json=VALUES(intervals_json),responsible_user_id=VALUES(responsible_user_id),responsible_user_name=VALUES(responsible_user_name)',[$tenant,$enabled,$office,$client,$expired,json_encode($intervals),$responsibleId?:null,$responsibleName]);
        dsc_event($conn,$tenant,0,'Settings Updated',$actor,$actorName,'Organisation Responsible User updated',['responsible_user_name'=>$responsibleName]);
        $conn->commit();
        dsc_reply(['success'=>true]);
    }
    $conn->begin_transaction();
    if ($action==='create') {
        $fields=dsc_fields($conn,$data,$tenant);
        $id=dsc_insert($conn,'dsc_certificates',array_merge(['tenant_id'=>$tenant,'created_by'=>$actor],$fields));
        dsc_event($conn,$tenant,$id,'Created',$actor,$actorName,'', $fields);
        $conn->commit();
        dsc_reply(['success'=>true,'id'=>$id]);
    }
    $id=(int)($data['id'] ?? 0);
    $found=dsc_all($conn,'SELECT * FROM dsc_certificates WHERE id=? AND tenant_id=? FOR UPDATE',[$id,$tenant]);
    $row=$found[0] ?? null;
    if (!$row) { $conn->rollback(); dsc_reply(['success'=>false,'error'=>'Certificate not found.'],404); }
    if ((int)($data['version'] ?? 0)!==(int)$row['version']) throw new RuntimeException('This record changed. Refresh and try again.');
    $notes=dsc_text($data,'notes',10000);
    $values=[]; $event=''; $newId=null;
    if ($action==='restore') {
        if (!$row['deleted_at']) throw new InvalidArgumentException('This record is not in Trash.');
        $values=['deleted_at'=>null,'deleted_by'=>null]; $event='Restored';
    } else {
        if ($row['deleted_at']) throw new InvalidArgumentException('Restore this record from Trash first.');
        if ($action==='trash') {
            $values=['deleted_at'=>gmdate('Y-m-d H:i:s'),'deleted_by'=>$actor]; $event='Moved to Trash';
        } elseif ($action==='edit') {
            if (!in_array($row['lifecycle'],['active','inactive'],true)) throw new InvalidArgumentException('Completed certificate records are read-only.');
            $values=dsc_fields($conn,$data,$tenant); $event='Edited';
        } elseif ($action==='deactivate') {
            if ($row['lifecycle']!=='active') throw new InvalidArgumentException('Only active entries can be deactivated.');
            $reason=dsc_text($data,'reason',1000,true);
            $values=['lifecycle'=>'inactive','inactive_reason'=>$reason,'inactive_on'=>gmdate('Y-m-d H:i:s'),'inactive_by'=>$actor,'inactive_by_name'=>$actorName]; $notes=$reason; $event='Deactivated';
        } elseif ($action==='reactivate') {
            if ($row['lifecycle']!=='inactive') throw new InvalidArgumentException('This entry is not inactive.');
            $values=['lifecycle'=>'active']; $event='Reactivated';
        } else {
            if ($row['lifecycle']!=='active') throw new InvalidArgumentException('This action requires an active entry.');
            if ($action==='startRenewal') { $values=['pending_renewal'=>1]; $event='Renewal Started'; }
            elseif ($action==='followup') {
                $last=trim((string)($data['last_followup_date'] ?? ''));
                $next=trim((string)($data['next_followup_date'] ?? '')) ?: null;
                if (!dsc_valid_date($last) || ($next && (!dsc_valid_date($next) || $next<$last))) throw new InvalidArgumentException('Enter valid follow-up dates.');
                if ($notes==='') throw new InvalidArgumentException('Enter follow-up remarks.');
                $values=['last_followup_date'=>$last,'next_followup_date'=>$next]; $event='Follow-up';
            } elseif ($action==='close') {
                if ($notes==='') throw new InvalidArgumentException('Enter a reason for closing this entry.');
                $values=['lifecycle'=>'closed','pending_renewal'=>0]; $event='Closed';
            } elseif ($action==='renew') {
                $issue=trim((string)($data['issue_date'] ?? ''));
                $expiry=trim((string)($data['expiry_date'] ?? ''));
                if (!dsc_valid_date($issue)) throw new InvalidArgumentException('Enter the new issue date.');
                dsc_check_dates($issue,$expiry);
                if ($expiry <= $row['expiry_date']) throw new InvalidArgumentException('New expiry must be later than the previous expiry.');
                $renewSettings=dsc_settings($conn,$tenant);
                $new=[];
                foreach (['client_name','holder_name','organisation','designation','mobile','email','responsible_user_id','responsible_user_name','token_location','token_details','document_movement_id','remarks'] as $field) $new[$field]=$row[$field];
                $new['responsible_user_id']=(int)($renewSettings['responsible_user_id'] ?? 0);
                $new['responsible_user_name']=(string)($renewSettings['responsible_user_name'] ?? '');
                $new=array_merge($new,['tenant_id'=>$tenant,'created_by'=>$actor,'issue_date'=>$issue,'expiry_date'=>$expiry,'previous_certificate_id'=>$id]);
                $newId=dsc_insert($conn,'dsc_certificates',$new);
                $values=['lifecycle'=>'renewed','pending_renewal'=>0,'renewed_to_id'=>$newId];
                $event='Renewed';
                dsc_event($conn,$tenant,$newId,'Renewal Created',$actor,$actorName,$notes,['previous_certificate_id'=>$id,'new_certificate'=>$new]);
            } else throw new InvalidArgumentException('Unknown action.');
        }
    }
    dsc_patch($conn,$row,$values);
    dsc_event($conn,$tenant,$id,$event,$actor,$actorName,$notes,['before'=>$row,'changes'=>$values]);
    // Remove pending reminders as soon as an entry stops being tracked.
    if (in_array($action,['deactivate','trash','renew','close'],true) && db_table_exists($conn,'notification_queue')) {
        $scope=app_table_is_scoped($conn,'notification_queue')?' AND q.tenant_id=e.tenant_id':'';
        dsc_query($conn,"UPDATE notification_queue q INNER JOIN dsc_reminder_events e ON e.queue_id=q.id {$scope} SET q.status='cancelled',q.updatedAt=NOW() WHERE e.tenant_id=? AND e.certificate_id=? AND q.status='pending'",[$tenant,$id]);
    }
    $conn->commit();
    dsc_reply(['success'=>true,'id'=>$newId ?? $id]);
} catch (InvalidArgumentException $error) {
    $conn->rollback();
    dsc_reply(['success'=>false,'error'=>$error->getMessage()],422);
} catch (Throwable $error) {
    $conn->rollback();
    error_log('DSC Register: '.$error->getMessage());
    $safe=in_array($error->getMessage(),['This record changed. Refresh and try again.','Database operation failed.','Unable to prepare DSC Register tables.'],true)?$error->getMessage():'Unable to complete the DSC action. Please try again.';
    dsc_reply(['success'=>false,'error'=>$safe],409);
}
