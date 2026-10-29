<?php
declare(strict_types=1);
require_once __DIR__ . '/dsc_rules.php';

function dsc_query(mysqli $db, string $sql, array $params = []): mysqli_stmt {
    $stmt = $db->prepare($sql);
    if (!$stmt) throw new RuntimeException('Database operation failed.');
    if ($params) $stmt->bind_param(str_repeat('s', count($params)), ...$params);
    if (!$stmt->execute()) throw new RuntimeException('Database operation failed.');
    return $stmt;
}
function dsc_all(mysqli $db, string $sql, array $params = []): array {
    $stmt = dsc_query($db, $sql, $params);
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    return $rows;
}
function dsc_insert(mysqli $db, string $table, array $values): int {
    $columns = implode(',', array_map(fn($key) => "`{$key}`", array_keys($values)));
    $marks = implode(',', array_fill(0, count($values), '?'));
    $stmt = dsc_query($db, "INSERT INTO `{$table}` ({$columns}) VALUES ({$marks})", array_values($values));
    $id = (int)$stmt->insert_id;
    $stmt->close();
    return $id;
}
function dsc_schema(mysqli $db): void {
    $definitions = [
    "CREATE TABLE IF NOT EXISTS dsc_certificates (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        client_name VARCHAR(190) NOT NULL,
        holder_name VARCHAR(190) NOT NULL,
        organisation VARCHAR(190) NOT NULL DEFAULT '',
        designation VARCHAR(120) NOT NULL DEFAULT '',
        mobile VARCHAR(30) NOT NULL DEFAULT '',
        email VARCHAR(190) NOT NULL DEFAULT '',
        issue_date DATE NULL,
        expiry_date DATE NOT NULL,
        responsible_user_id BIGINT NOT NULL,
        responsible_user_name VARCHAR(190) NOT NULL,
        token_location VARCHAR(20) NOT NULL DEFAULT 'Client',
        token_details VARCHAR(255) NOT NULL DEFAULT '',
        document_movement_id BIGINT NULL,
        last_followup_date DATE NULL,
        next_followup_date DATE NULL,
        remarks TEXT NULL,
        pending_renewal TINYINT(1) NOT NULL DEFAULT 0,
        lifecycle VARCHAR(20) NOT NULL DEFAULT 'active',
        inactive_reason VARCHAR(1000) NOT NULL DEFAULT '',
        inactive_on DATETIME NULL,
        inactive_by BIGINT NULL,
        inactive_by_name VARCHAR(190) NOT NULL DEFAULT '',
        deleted_at DATETIME NULL,
        deleted_by BIGINT NULL,
        previous_certificate_id BIGINT NULL,
        renewed_to_id BIGINT NULL,
        version INT NOT NULL DEFAULT 1,
        created_by BIGINT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_dsc_tenant_expiry (tenant_id, lifecycle, deleted_at, expiry_date),
        KEY idx_dsc_owner (tenant_id, responsible_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    "CREATE TABLE IF NOT EXISTS dsc_events (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        certificate_id BIGINT NOT NULL,
        action VARCHAR(50) NOT NULL,
        actor_id BIGINT NOT NULL,
        actor_name VARCHAR(190) NOT NULL,
        notes TEXT NULL,
        snapshot LONGTEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_dsc_history (tenant_id, certificate_id, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    "CREATE TABLE IF NOT EXISTS dsc_settings (
        tenant_id INT PRIMARY KEY,
        enabled TINYINT(1) NOT NULL DEFAULT 0,
        office_reminders TINYINT(1) NOT NULL DEFAULT 1,
        client_reminders TINYINT(1) NOT NULL DEFAULT 0,
        expired_reminder TINYINT(1) NOT NULL DEFAULT 1,
        responsible_user_id BIGINT NULL,
        responsible_user_name VARCHAR(190) NOT NULL DEFAULT '',
        intervals_json VARCHAR(255) NOT NULL DEFAULT '[60,30,15,7,1]',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    "CREATE TABLE IF NOT EXISTS dsc_reminder_events (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        certificate_id BIGINT NOT NULL,
        event_key CHAR(64) NOT NULL,
        expiry_date DATE NOT NULL,
        stage INT NOT NULL,
        audience VARCHAR(20) NOT NULL,
        target_name VARCHAR(190) NOT NULL,
        target VARCHAR(50) NOT NULL,
        queue_id BIGINT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_dsc_reminder (event_key),
        KEY idx_dsc_reminders (tenant_id, certificate_id, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    ];
    foreach ($definitions as $sql) if (!$db->query($sql)) throw new RuntimeException('Unable to prepare DSC Register tables.');
    foreach (['responsible_user_id'=>'BIGINT NULL','responsible_user_name'=>"VARCHAR(190) NOT NULL DEFAULT ''"] as $column=>$definition) {
        $check=$db->query("SHOW COLUMNS FROM dsc_settings LIKE '{$column}'");
        $exists=$check && $check->num_rows>0;
        if ($check) $check->free();
        if (!$exists && !$db->query("ALTER TABLE dsc_settings ADD COLUMN `{$column}` {$definition}")) throw new RuntimeException('Unable to prepare DSC Register tables.');
    }
}
function dsc_settings(mysqli $db, int $tenant): array {
    $rows = dsc_all($db, 'SELECT * FROM dsc_settings WHERE tenant_id=?', [$tenant]);
    $data = $rows[0] ?? ['enabled'=>0,'office_reminders'=>1,'client_reminders'=>0,'expired_reminder'=>1,'responsible_user_id'=>null,'responsible_user_name'=>'','intervals_json'=>'[60,30,15,7,1]'];
    $data['intervals'] = dsc_intervals(json_decode((string)$data['intervals_json'],true) ?? [60,30,15,7,1]);
    return $data;
}
function dsc_active_user(mysqli $db, int $id, int $tenant): array {
    $sql = 'SELECT id,name,mobile,isActive FROM users WHERE id=?' . (app_table_is_scoped($db,'users') ? ' AND tenant_id=?' : '');
    $rows = dsc_all($db,$sql,app_table_is_scoped($db,'users') ? [$id,$tenant] : [$id]);
    $user = $rows[0] ?? null;
    if (!$user || !in_array(strtolower((string)$user['isActive']),['1','true','yes'],true)) throw new InvalidArgumentException('Select an active Responsible User.');
    return $user;
}
function dsc_text(array $data, string $key, int $max, bool $required = false): string {
    $value = trim((string)($data[$key] ?? ''));
    if (($required && $value === '') || strlen($value)>$max) throw new InvalidArgumentException('Check the ' . str_replace('_',' ',$key) . ' field.');
    return $value;
}
function dsc_fields(mysqli $db, array $data, int $tenant): array {
    $fields = [];
    foreach (['client_name'=>190,'holder_name'=>190,'organisation'=>190,'designation'=>120,'mobile'=>30,'email'=>190,'token_details'=>255,'remarks'=>10000] as $key=>$max) {
        $fields[$key] = dsc_text($data,$key,$max,in_array($key,['client_name','holder_name'],true));
    }
    if ($fields['email'] !== '' && !filter_var($fields['email'],FILTER_VALIDATE_EMAIL)) throw new InvalidArgumentException('Enter a valid email address.');
    if ($fields['mobile'] !== '' && !preg_match('/^[+0-9 ()-]{7,30}$/',$fields['mobile'])) throw new InvalidArgumentException('Enter a valid mobile number.');
    $fields['issue_date'] = trim((string)($data['issue_date'] ?? '')) ?: null;
    $fields['expiry_date'] = trim((string)($data['expiry_date'] ?? ''));
    dsc_check_dates($fields['issue_date'],$fields['expiry_date']);
    foreach (['last_followup_date','next_followup_date'] as $key) {
        $fields[$key] = trim((string)($data[$key] ?? '')) ?: null;
        if ($fields[$key] && !dsc_valid_date($fields[$key])) throw new InvalidArgumentException('Enter valid follow-up dates.');
    }
    if ($fields['last_followup_date'] && $fields['next_followup_date'] && $fields['next_followup_date']<$fields['last_followup_date']) throw new InvalidArgumentException('Next follow-up cannot precede the last follow-up.');
    $settings=dsc_settings($db,$tenant);
    $fields['responsible_user_id'] = (int)($settings['responsible_user_id'] ?? 0);
    $fields['responsible_user_name'] = (string)($settings['responsible_user_name'] ?? '');
    $fields['token_location'] = (string)($data['token_location'] ?? 'Client');
    if (!in_array($fields['token_location'],['Office','Client','Other'],true)) throw new InvalidArgumentException('Select a token location.');
    $fields['document_movement_id'] = (int)($data['document_movement_id'] ?? 0) ?: null;
    if ($fields['document_movement_id']) {
        if (!db_table_exists($db,'document_movements') || !dsc_all($db,'SELECT id FROM document_movements WHERE id=? AND tenant_id=?',[$fields['document_movement_id'],$tenant])) throw new InvalidArgumentException('Select a document entry from this organisation.');
    }
    return $fields;
}
function dsc_event(mysqli $db,int $tenant,int $certificate,string $action,int $actor,string $actorName,string $notes,array $snapshot): void {
    dsc_insert($db,'dsc_events',['tenant_id'=>$tenant,'certificate_id'=>$certificate,'action'=>$action,'actor_id'=>$actor,'actor_name'=>$actorName,'notes'=>$notes,'snapshot'=>json_encode($snapshot,JSON_UNESCAPED_UNICODE)]);
}
function dsc_patch(mysqli $db,array $row,array $values): void {
    $sets = implode(',',array_map(fn($key)=>"`{$key}`=?",array_keys($values)));
    $stmt=dsc_query($db,"UPDATE dsc_certificates SET {$sets},version=version+1 WHERE id=? AND tenant_id=? AND version=?",array_merge(array_values($values),[$row['id'],$row['tenant_id'],$row['version']]));
    if ($stmt->affected_rows!==1) throw new RuntimeException('This record changed. Refresh and try again.');
    $stmt->close();
}
