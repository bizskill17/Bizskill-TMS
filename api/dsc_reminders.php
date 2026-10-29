<?php
declare(strict_types=1);
require_once __DIR__ . '/dsc_module.php';

function dsc_phone(string $raw,string $provider): string {
    $number=preg_replace('/[^0-9]/','',$raw);
    if ($provider==='mas') {
        if (strlen($number)===12 && substr($number,0,2)==='91') $number=substr($number,2);
        return strlen($number)===10 ? $number : '';
    }
    if (strlen($number)===10) $number='91'.$number;
    return strlen($number)>=11 && strlen($number)<=15 ? $number : '';
}
function dsc_reminder_message(array $row,string $today,string $audience): string {
    $days=dsc_days_left((string)$row['expiry_date'],$today);
    $date=DateTimeImmutable::createFromFormat('!Y-m-d',(string)$row['expiry_date'])->format('d/m/Y');
    $heading=$days<0?'DSC Expired':'DSC Expiry Reminder';
    $lines=[$heading,'Client: '.$row['client_name'],'Certificate Holder: '.$row['holder_name'],'Expiry Date: '.$date];
    $lines[]=$days<0?'Expired '.abs($days).' day(s) ago':'Days Left: '.$days;
    if ($audience==='office') $lines[]='Responsible User: '.$row['responsible_user_name'];
    $lines[]='Please arrange renewal.';
    $lines[]=(string)app_tenant_name();
    return implode("\n",$lines);
}
function dsc_queue_reminder(mysqli $db,array $row,int $stage,string $audience,string $targetName,string $target,string $provider,string $today,string $batch=''): int {
    $tenant=app_tenant_id();
    $key=hash('sha256',$batch.'|'.implode('|',[$tenant,$row['id'],$row['expiry_date'],$stage,$audience,$target]));
    $db->begin_transaction();
    try {
        $stmt=dsc_query($db,"INSERT IGNORE INTO dsc_reminder_events (tenant_id,certificate_id,event_key,expiry_date,stage,audience,target_name,target) VALUES (?,?,?,?,?,?,?,?)",[$tenant,$row['id'],$key,$row['expiry_date'],$stage,$audience,$targetName,$target]);
        $inserted=$stmt->affected_rows;
        $eventId=(int)$stmt->insert_id; $stmt->close();
        if (!$inserted) { $db->commit(); return 0; }
        $meta=json_encode(['event'=>$batch!==''?'dsc_client_manual':'dsc_expiry','tenant_id'=>$tenant,'certificate_id'=>(int)$row['id'],'expiry_date'=>$row['expiry_date'],'stage'=>$stage,'audience'=>$audience,'responsible_user_id'=>(int)$row['responsible_user_id']]);
        $values=['channel'=>'whatsapp','provider'=>$provider,'targetType'=>'personal','target'=>$target,'message'=>dsc_reminder_message($row,$today,$audience),'meta'=>$meta,'status'=>'pending','attempts'=>0,'createdAt'=>gmdate('Y-m-d H:i:s'),'updatedAt'=>gmdate('Y-m-d H:i:s')];
        if (app_table_is_scoped($db,'notification_queue')) $values=['tenant_id'=>$tenant]+$values;
        $queue=dsc_insert($db,'notification_queue',$values);
        dsc_query($db,'UPDATE dsc_reminder_events SET queue_id=? WHERE id=? AND tenant_id=?',[$queue,$eventId,$tenant]);
        $db->commit();
        return 1;
    } catch (Throwable $error) { $db->rollback(); throw $error; }
}
function dsc_schedule_reminders(mysqli $db): int {
    if (!db_table_exists($db,'dsc_certificates') || !db_table_exists($db,'dsc_settings') || !db_table_exists($db,'dsc_reminder_events') || !db_table_exists($db,'notification_queue')) return 0;
    $settings=dsc_settings($db,app_tenant_id());
    if (!(int)$settings['enabled']) return 0;
    $provider=notifications_pick_whatsapp_provider(notifications_get_settings($db));
    if ($provider==='') return 0;
    $today=(new DateTimeImmutable('today',new DateTimeZone('Asia/Kolkata')))->format('Y-m-d');
    $max=max($settings['intervals']);
    $latest=(new DateTimeImmutable($today))->modify('+'.$max.' days')->format('Y-m-d');
    $rows=dsc_all($db,"SELECT * FROM dsc_certificates WHERE tenant_id=? AND lifecycle='active' AND deleted_at IS NULL AND expiry_date<=?",[app_tenant_id(),$latest]);
    $count=0;
    foreach ($rows as $row) {
        $row['responsible_user_id']=(int)($settings['responsible_user_id'] ?? 0);
        $row['responsible_user_name']=(string)($settings['responsible_user_name'] ?? '');
        $stage=dsc_reminder_stage($row,$settings['intervals'],$today,(bool)$settings['expired_reminder']);
        if ($stage===null) continue;
        if ((int)$settings['office_reminders']) {
            try {
                $user=dsc_active_user($db,(int)$row['responsible_user_id'],app_tenant_id());
                $phone=dsc_phone((string)$user['mobile'],$provider);
                if ($phone!=='') $count+=dsc_queue_reminder($db,$row,$stage,'office',(string)$user['name'],$phone,$provider,$today);
            } catch (InvalidArgumentException $error) { /* Inactive user: no reminder. */ }
        }

    }
    return $count;
}
// Recheck pending reminders immediately before sending, including changed contacts.
function dsc_reminder_current(mysqli $db,array $queue): bool {
    $meta=json_decode((string)($queue['meta'] ?? ''),true) ?: [];
    $manual=($meta['event'] ?? '')==='dsc_client_manual';
    if (!$manual && ($meta['event'] ?? '')!=='dsc_expiry') return true;
    if ((int)($meta['tenant_id'] ?? 0)!==app_tenant_id() || !db_table_exists($db,'dsc_certificates')) return false;
    $found=dsc_all($db,'SELECT * FROM dsc_certificates WHERE id=? AND tenant_id=?',[(int)($meta['certificate_id'] ?? 0),app_tenant_id()]);
    if (!$found) return false;
    $row=$found[0];
    if ($row['expiry_date']!==($meta['expiry_date'] ?? '')) return false;
    if ($manual) return $row['lifecycle']==='active' && !$row['deleted_at'] && dsc_phone((string)$row['mobile'],(string)$queue['provider'])===(string)$queue['target'];
    if (($meta['audience'] ?? '')==='client') return false;
    $settings=dsc_settings($db,app_tenant_id());
    if (!(int)$settings['enabled']) return false;
    $today=(new DateTimeImmutable('today',new DateTimeZone('Asia/Kolkata')))->format('Y-m-d');
    $stage=dsc_reminder_stage($row,$settings['intervals'],$today,(bool)$settings['expired_reminder']);
    if ($stage===null || $stage!==(int)($meta['stage'] ?? -999)) return false;
    if (($meta['audience'] ?? '')==='client') {
        return (int)$settings['client_reminders']===1 && dsc_phone((string)$row['mobile'],(string)$queue['provider'])===(string)$queue['target'];
    }
    if (!(int)$settings['office_reminders']) return false;
    $row['responsible_user_id']=(int)($settings['responsible_user_id'] ?? 0);
    if ((int)$row['responsible_user_id']!==(int)($meta['responsible_user_id'] ?? 0)) return false;
    try { $user=dsc_active_user($db,(int)$row['responsible_user_id'],app_tenant_id()); }
    catch (InvalidArgumentException $error) { return false; }
    return dsc_phone((string)$user['mobile'],(string)$queue['provider'])===(string)$queue['target'];
}
