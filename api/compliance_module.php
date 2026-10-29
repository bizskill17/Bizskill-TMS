<?php
declare(strict_types=1);
require_once __DIR__.'/dsc_module.php';
require_once __DIR__.'/compliance_rules.php';
function cp_schema(mysqli $db): void {
    $defs=[
    "compliance_templates (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,tenant_id INT NOT NULL,name VARCHAR(190) NOT NULL,category VARCHAR(190) NOT NULL DEFAULT '',kind VARCHAR(20) NOT NULL,active TINYINT NOT NULL DEFAULT 1,version INT NOT NULL DEFAULT 1,KEY idx_ct(tenant_id,active))",
    "compliance_schedules (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,tenant_id INT NOT NULL,template_id BIGINT NOT NULL,definition TEXT NOT NULL,active TINYINT NOT NULL DEFAULT 1,KEY idx_cs(tenant_id,template_id))",
    "compliance_stages (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,tenant_id INT NOT NULL,template_id BIGINT NOT NULL,name VARCHAR(190) NOT NULL,sequence_no INT NOT NULL,is_completion TINYINT NOT NULL DEFAULT 0,active TINYINT NOT NULL DEFAULT 1,KEY idx_cstage(tenant_id,template_id))",
    "client_compliances (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,tenant_id INT NOT NULL,template_id BIGINT NOT NULL,client_id BIGINT NOT NULL,client_name VARCHAR(190) NOT NULL,assigned_user_id BIGINT NOT NULL,assigned_user_name VARCHAR(190) NOT NULL,start_date DATE NOT NULL,end_date DATE NULL,billing_type VARCHAR(20) NOT NULL,fee DECIMAL(12,2) NULL,due_day INT NULL,active TINYINT NOT NULL DEFAULT 1,version INT NOT NULL DEFAULT 1,UNIQUE KEY uq_cc(tenant_id,template_id,client_id))",
    "compliance_entries (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,tenant_id INT NOT NULL,source_type VARCHAR(20) NOT NULL,source_key VARCHAR(190) NOT NULL,source_id BIGINT NULL,assignment_id BIGINT NULL,schedule_id BIGINT NULL,template_id BIGINT NULL,client_name VARCHAR(190) NOT NULL DEFAULT '',title VARCHAR(255) NOT NULL,category VARCHAR(190) NOT NULL DEFAULT '',period_start DATE NULL,period_end DATE NULL,period_label VARCHAR(190) NOT NULL DEFAULT '',financial_year VARCHAR(10) NOT NULL DEFAULT '',stages_json TEXT NULL,current_stage VARCHAR(190) NOT NULL DEFAULT '',assigned_user_id BIGINT NULL,assigned_user_name VARCHAR(190) NOT NULL DEFAULT '',original_due_date DATE NULL,due_date DATE NULL,work_status VARCHAR(20) NOT NULL DEFAULT 'Pending',completed_on DATE NULL,billing_type VARCHAR(20) NULL,fee DECIMAL(12,2) NULL,billing_status VARCHAR(20) NOT NULL DEFAULT 'Not Billed',filed_on DATE NULL,acknowledgement VARCHAR(190) NOT NULL DEFAULT '',paid_on DATE NULL,amount_due DECIMAL(12,2) NULL,amount_paid DECIMAL(12,2) NULL,challan_reference VARCHAR(190) NOT NULL DEFAULT '',remarks TEXT NULL,attachment TEXT NULL,cancellation_reason TEXT NULL,version INT NOT NULL DEFAULT 1,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,UNIQUE KEY uq_ce(tenant_id,source_type,source_key),KEY idx_ce_due(tenant_id,work_status,due_date),KEY idx_ce_bill(tenant_id,billing_type,billing_status))",
    "task_billing_defaults (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,tenant_id INT NOT NULL,source_type VARCHAR(20) NOT NULL,source_id BIGINT NOT NULL,billing_type VARCHAR(20) NOT NULL,fee DECIMAL(12,2) NULL,UNIQUE KEY uq_tbd(tenant_id,source_type,source_id))",
    "compliance_history (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,tenant_id INT NOT NULL,entry_id BIGINT NOT NULL DEFAULT 0,action VARCHAR(80) NOT NULL,actor_id BIGINT NOT NULL,actor_name VARCHAR(190) NOT NULL,details LONGTEXT NOT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,KEY idx_ch(tenant_id,entry_id,id))",
    "billing_records (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,tenant_id INT NOT NULL,client_name VARCHAR(190) NOT NULL,invoice_number VARCHAR(190) NOT NULL,invoice_date DATE NOT NULL,remarks TEXT NULL,actor_id BIGINT NOT NULL,actor_name VARCHAR(190) NOT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "billing_record_items (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,tenant_id INT NOT NULL,billing_id BIGINT NOT NULL,entry_id BIGINT NOT NULL,fee DECIMAL(12,2) NOT NULL,active TINYINT NOT NULL DEFAULT 1,reversal_reason TEXT NULL,KEY idx_bri(tenant_id,entry_id,active))"
    ];
    foreach($defs as $def) if(!$db->query('CREATE TABLE IF NOT EXISTS '.$def.' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4')) throw new RuntimeException('Unable to prepare Compliance tables.');
}
function cp_history(mysqli $db,int $entry,string $action,array $details,int $actor=0,string $name='System'):void {
    dsc_insert($db,'compliance_history',['tenant_id'=>app_tenant_id(),'entry_id'=>$entry,'action'=>$action,'actor_id'=>$actor,'actor_name'=>$name,'details'=>json_encode($details,JSON_UNESCAPED_UNICODE)]);
}
function cp_rows(mysqli $db,string $table):array {return dsc_all($db,'SELECT * FROM `'.$table.'`'.(app_table_is_scoped($db,$table)?' WHERE tenant_id=?':''),app_table_is_scoped($db,$table)?[app_tenant_id()]:[]);}
function cp_find(mysqli $db,string $table,int $id,bool $lock=false):array {
    $r=dsc_all($db,'SELECT * FROM '.$table.' WHERE id=? AND tenant_id=?'.($lock?' FOR UPDATE':''),[$id,app_tenant_id()]);
    if(!$r)throw new InvalidArgumentException('Record unavailable in this organisation.');return $r[0];
}
function cp_patch(mysqli $db,string $table,array $row,array $values):void {
    $sets=implode(',',array_map(fn($key)=>'`'.$key.'`=?',array_keys($values)));
    $st=dsc_query($db,'UPDATE '.$table.' SET '.$sets.',version=version+1 WHERE id=? AND tenant_id=? AND version=?',array_merge(array_values($values),[$row['id'],app_tenant_id(),$row['version']]));
    if($st->affected_rows!==1)throw new InvalidArgumentException('Record changed. Refresh and try again.');$st->close();
}
function cp_schedule(array $s):array {
    $f=(string)($s['frequency']??'');$months=array_values(array_unique(array_map('intval',$s['months']??[])));sort($months);
    if(!in_array($f,['Monthly','Quarterly','Annual','Custom'],true))throw new InvalidArgumentException('Choose a frequency.');
    if($f==='Custom' && (!$months || min($months)<1 || max($months)>12))throw new InvalidArgumentException('Choose custom months from 1 to 12.');
    $day=(int)($s['due_day']??0);$offset=(int)($s['month_offset']??-1);$lead=(int)($s['lead_days']??-1);
    if($day<1||$day>31||$offset<0||$offset>24||$lead<0||$lead>366)throw new InvalidArgumentException('Check due day, month offset and generation lead days.');
    return ['frequency'=>$f,'name'=>dsc_text($s,'name',190,true),'months'=>$months,'due_day'=>$day,'month_offset'=>$offset,'lead_days'=>$lead];
}
function cp_generate(mysqli $db,?string $through=null,?int $onlyAssignment=null):int {
    $tenant=app_tenant_id();$today=(new DateTimeImmutable('today',new DateTimeZone('Asia/Kolkata')))->format('Y-m-d');
    if($through!==null && (!cp_date($through)||$through>(new DateTimeImmutable($today))->modify('+5 years')->format('Y-m-d')))throw new InvalidArgumentException('Choose a generation date within five years.');
    $assignments=dsc_all($db,'SELECT a.*,t.name title,t.category FROM client_compliances a JOIN compliance_templates t ON t.id=a.template_id AND t.tenant_id=a.tenant_id WHERE a.tenant_id=? AND a.active=1 AND t.active=1'.($onlyAssignment?' AND a.id=?':''),$onlyAssignment?[$tenant,$onlyAssignment]:[$tenant]);$count=0;
    foreach($assignments as $a){
        $stages=dsc_all($db,'SELECT name,is_completion FROM compliance_stages WHERE tenant_id=? AND template_id=? AND active=1 ORDER BY sequence_no,id',[$tenant,$a['template_id']]);if(!$stages)continue;
        $schedules=dsc_all($db,'SELECT * FROM compliance_schedules WHERE tenant_id=? AND template_id=? AND active=1',[$tenant,$a['template_id']]);
        foreach($schedules as $s){$rule=json_decode($s['definition'],true);$end=$through??(new DateTimeImmutable($today))->modify('+'.$rule['lead_days'].' days')->format('Y-m-d');$rangeEnd=$a['end_date']?min($end,$a['end_date']):$end;if($rangeEnd<$a['start_date'])continue;
            foreach(cp_periods($rule,$a['start_date'],$rangeEnd) as $p){
                if($a['due_day']){$dm=new DateTimeImmutable(substr($p['due'],0,7).'-01');$p['due']=$dm->format('Y-m-').str_pad((string)min((int)$a['due_day'],(int)$dm->format('t')),2,'0',STR_PAD_LEFT);}
                if($p['due']>$end || $p['due']<$a['start_date'] || ($a['end_date'] && $p['start']>$a['end_date']))continue;
                $key=$a['id'].':'.$s['id'].':'.$p['start'];$db->begin_transaction();
                try{
                    $existing=dsc_all($db,'SELECT id FROM compliance_entries WHERE tenant_id=? AND source_type=? AND source_key=? FOR UPDATE',[$tenant,'Compliance',$key]);if($existing){$db->commit();continue;}
                    $year=(int)substr($p['start'],0,4)-((int)substr($p['start'],5,2)<4?1:0);
                    $id=dsc_insert($db,'compliance_entries',['tenant_id'=>$tenant,'source_type'=>'Compliance','source_key'=>$key,'assignment_id'=>$a['id'],'schedule_id'=>$s['id'],'template_id'=>$a['template_id'],'client_name'=>$a['client_name'],'title'=>$a['title'],'category'=>$a['category'],'period_start'=>$p['start'],'period_end'=>$p['end'],'period_label'=>$p['label'],'financial_year'=>substr((string)$year,2).'-'.substr((string)($year+1),2),'stages_json'=>json_encode($stages),'current_stage'=>$stages[0]['name'],'assigned_user_id'=>$a['assigned_user_id'],'assigned_user_name'=>$a['assigned_user_name'],'original_due_date'=>$p['due'],'due_date'=>$p['due'],'billing_type'=>$a['billing_type'],'fee'=>$a['fee']]);
                    cp_history($db,$id,'Generated',['period'=>$p]);$db->commit();$count++;
                }catch(Throwable $e){$db->rollback();if($db->errno===1062 || $e->getCode()===1062)continue;throw $e;}
            }
        }
    }return $count;
}
function cp_source_date(string $value):?string {
    $v=substr(trim($value),0,10);if(cp_date($v))return $v;
    if(preg_match('/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/',$v,$m)){ $v=$m[3].'-'.$m[2].'-'.$m[1];if(cp_date($v))return $v; }return null;
}
function cp_sync_work(mysqli $db):void {
    $tenant=app_tenant_id();$defaults=[];foreach(dsc_all($db,'SELECT * FROM task_billing_defaults WHERE tenant_id=?',[$tenant]) as $d)$defaults[$d['source_type'].':'.$d['source_id']]=$d;
    foreach(['main_tasks'=>'Simple','recurring_tasks'=>'Recurring Master'] as $table=>$type){if(!db_table_exists($db,$table))continue;
        foreach(cp_rows($db,$table) as $r){$key=(string)$r['id'];$d=$defaults[$type.':'.$key]??null;
            $values=['client_name'=>$r['firm']??'','title'=>$r['title'],'category'=>$r['category']??'','assigned_user_name'=>$r['assignees']??$r['assignee']??'','due_date'=>cp_source_date($r['dueDate']??''),'work_status'=>$type==='Simple'&&strtolower($r['status'])==='completed'?'Completed':'Pending','completed_on'=>$type==='Simple'&&strtolower($r['status'])==='completed'?cp_source_date($r['lastUpdateDate']??''):null];
            $existing=dsc_all($db,'SELECT * FROM compliance_entries WHERE tenant_id=? AND source_type=? AND source_key=?',[$tenant,$type,$key]);
            if(!$existing)dsc_insert($db,'compliance_entries',['tenant_id'=>$tenant,'source_type'=>$type,'source_key'=>$key,'source_id'=>$r['id'],'billing_type'=>$d['billing_type']??null,'fee'=>$d['fee']??null]+$values);
            elseif($type==='Simple'){
                $sets=implode(',',array_map(fn($k)=>'`'.$k.'`=?',array_keys($values)));dsc_query($db,'UPDATE compliance_entries SET '.$sets.' WHERE id=? AND tenant_id=?',array_merge(array_values($values),[$existing[0]['id'],$tenant]));
            }
        }
    }
    if(!db_table_exists($db,'recurring_actions'))return;
    // A completed activity log is an immutable occurrence, never the rolling master status.
    foreach(cp_rows($db,'recurring_actions') as $r){if(strtolower(trim($r['status']))!=='completed')continue;$key=(string)$r['taskId'].':'.(cp_source_date($r['updatedOn']??'')??('log:'.$r['id']));$d=$defaults['Recurring Master:'.$r['taskId']]??null;
        if(dsc_all($db,'SELECT id FROM compliance_entries WHERE tenant_id=? AND source_type=? AND source_key=?',[$tenant,'Recurring',$key]))continue;
        dsc_insert($db,'compliance_entries',['tenant_id'=>$tenant,'source_type'=>'Recurring','source_key'=>$key,'source_id'=>$r['taskId'],'client_name'=>$r['firm']??'','title'=>$r['taskTitle'],'category'=>$r['category']??'','period_label'=>$r['updatedOn']??'','assigned_user_name'=>$r['assignee']??'','work_status'=>'Completed','completed_on'=>cp_source_date($r['updatedOn']??''),'billing_type'=>$d['billing_type']??null,'fee'=>$d['fee']??null]);
    }
}
