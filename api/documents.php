<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';
session_start(['cookie_httponly' => true, 'cookie_secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off', 'cookie_samesite' => 'Lax']);
function documents_reply(array $data, int $status = 200): void {
    http_response_code($status);
    echo json_encode($data);
    exit;
}
if (empty($_SESSION['documents_tenant']) || (int)$_SESSION['documents_tenant'] !== app_tenant_id() || strtolower((string)($currentTenant['status'] ?? '')) !== 'active') {
    documents_reply(['success' => false, 'error' => 'Please sign out and sign in again to access Documents.'], 401);
}
if (strtolower((string)($currentTenant['db_mode'] ?? 'shared')) === 'dedicated' && $conn === $platformConn) {
    documents_reply(['success'=>false,'error'=>'Organisation database connection is missing.'],503);
}
$actorId = (int)($_SESSION['documents_user'] ?? 0);
if (empty($_SESSION['documents_platform_admin'])) {
    $actorSql = "SELECT isActive FROM users WHERE id=?" . (app_table_is_scoped($conn, 'users') ? " AND tenant_id=" . app_tenant_id() : '');
    $check = $conn->prepare($actorSql);
    if (!$check) documents_reply(['success'=>false,'error'=>'Unable to verify user.'],500);
    $check->bind_param('i', $actorId);
    $check->execute();
    $actor = $check->get_result()->fetch_assoc();
    $check->close();
    if (!$actor || !in_array(strtolower((string)$actor['isActive']), ['1','true','yes'], true)) documents_reply(['success'=>false,'error'=>'User is inactive.'],403);
}
$csrf = (string)($_SESSION['documents_csrf'] ?? '');
session_write_close();
$schema = "CREATE TABLE IF NOT EXISTS document_movements (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 tenant_id INT NOT NULL,
 movement_date DATE NOT NULL,
 direction ENUM('In','Out') NOT NULL,
 document_name VARCHAR(255) NOT NULL,
 client_name VARCHAR(190) NOT NULL DEFAULT '',
 external_person VARCHAR(190) NOT NULL,
 office_user_id BIGINT NOT NULL,
 office_user_name VARCHAR(190) NOT NULL,
 returnable TINYINT(1) NOT NULL DEFAULT 0,
 return_due_date DATE NULL,
 returned_on DATE NULL,
 remarks TEXT NULL,
 created_by BIGINT NOT NULL,
 returned_by BIGINT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 KEY idx_documents_tenant_date (tenant_id, movement_date, id),
 KEY idx_documents_returns (tenant_id, direction, returnable, returned_on, return_due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
if (!$conn->query($schema)) documents_reply(['success'=>false,'error'=>'Unable to prepare Documents table.'],500);
// Keep historical returns intact while adding the selected handover user.
foreach (['return_person'=>"VARCHAR(190) NOT NULL DEFAULT ''", 'return_user_id'=>'BIGINT NULL', 'return_user_name'=>"VARCHAR(190) NOT NULL DEFAULT ''"] as $column=>$definition) {
    if (!db_has_column($conn, 'document_movements', $column)) {
        if (!$conn->query("ALTER TABLE document_movements ADD COLUMN `{$column}` {$definition}") && !db_has_column($conn, 'document_movements', $column)) {
            documents_reply(['success'=>false,'error'=>'Unable to update Documents table.'],500);
        }
    }
}
$tenantId = app_tenant_id();
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $conn->prepare("SELECT * FROM document_movements WHERE tenant_id=? ORDER BY movement_date DESC, id DESC");
    $stmt->bind_param('i', $tenantId);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    documents_reply(['success'=>true,'documents'=>$rows,'csrf'=>$csrf]);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') documents_reply(['success'=>false,'error'=>'Method not allowed.'],405);
$data = app_get_raw_input_data();
if ($csrf === '' || !hash_equals($csrf, (string)($data['csrf'] ?? ''))) documents_reply(['success'=>false,'error'=>'Session expired. Reload Documents and try again.'],403);
function documents_date(string $value): bool {
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
    return $date !== false && $date->format('Y-m-d') === $value;
}
$action = (string)($data['action'] ?? '');
if ($action === 'create') {
    $date = trim((string)($data['movement_date'] ?? ''));
    $direction = (string)($data['direction'] ?? '');
    $name = trim((string)($data['document_name'] ?? ''));
    $client = trim((string)($data['client_name'] ?? ''));
    $person = trim((string)($data['external_person'] ?? ''));
    $userId = (int)($data['office_user_id'] ?? 0);
    $returnable = !empty($data['returnable']) ? 1 : 0;
    $due = $returnable ? trim((string)($data['return_due_date'] ?? '')) : null;
    $remarks = trim((string)($data['remarks'] ?? ''));
    if (!documents_date($date) || !in_array($direction,['In','Out'],true) || $name === '' || strlen($name)>255 || $person === '' || strlen($person)>190 || strlen($client)>190 || strlen($remarks)>10000 || ($returnable && (!documents_date((string)$due) || $due < $date))) documents_reply(['success'=>false,'error'=>'Enter the document name, person, valid movement date and a return due date on or after the movement date.'],422);
    $userSql = "SELECT name, isActive FROM users WHERE id=?" . (app_table_is_scoped($conn,'users') ? " AND tenant_id=".$tenantId : '');
    $stmt=$conn->prepare($userSql);
    $stmt->bind_param('i',$userId);
    $stmt->execute();
    $office=$stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$office || !in_array(strtolower((string)$office['isActive']),['1','true','yes'],true)) documents_reply(['success'=>false,'error'=>'Select an active Office User.'],422);
    $officeName=(string)$office['name'];
    $stmt=$conn->prepare("INSERT INTO document_movements (tenant_id,movement_date,direction,document_name,client_name,external_person,office_user_id,office_user_name,returnable,return_due_date,remarks,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)");
    $stmt->bind_param('isssssisissi', $tenantId,$date,$direction,$name,$client,$person,$userId,$officeName,$returnable,$due,$remarks,$actorId);
    if (!$stmt->execute()) documents_reply(['success'=>false,'error'=>'Unable to save document.'],500);
    documents_reply(['success'=>true]);
}
if ($action === 'return') {
    $id=(int)($data['id'] ?? 0);
    $returned=trim((string)($data['returned_on'] ?? ''));
    if (!documents_date($returned)) documents_reply(['success'=>false,'error'=>'Enter a valid return date.'],422);
    $returnPerson=trim((string)($data['return_person'] ?? ''));
    if ($returnPerson === '' || strlen($returnPerson)>190) documents_reply(['success'=>false,'error'=>'Enter the name of the person giving or receiving the document.'],422);
    $returnUserId=(int)($data['return_user_id'] ?? 0);
    $userSql="SELECT name, isActive FROM users WHERE id=?" . (app_table_is_scoped($conn,'users') ? " AND tenant_id=".$tenantId : '');
    $check=$conn->prepare($userSql);
    $check->bind_param('i',$returnUserId);
    $check->execute();
    $returnUser=$check->get_result()->fetch_assoc();
    $check->close();
    if (!$returnUser || !in_array(strtolower((string)$returnUser['isActive']),['1','true','yes'],true)) documents_reply(['success'=>false,'error'=>'Select an active user for the return.'],422);
    $returnUserName=(string)$returnUser['name'];
    $stmt=$conn->prepare("UPDATE document_movements SET returned_on=?,returned_by=?,return_user_id=?,return_user_name=?,return_person=? WHERE id=? AND tenant_id=? AND returnable=1 AND returned_on IS NULL AND movement_date<=?");
    $stmt->bind_param('siissiis',$returned,$actorId,$returnUserId,$returnUserName,$returnPerson,$id,$tenantId,$returned);
    if (!$stmt->execute()) documents_reply(['success'=>false,'error'=>'Unable to record return.'],500);
    if ($stmt->affected_rows !== 1) documents_reply(['success'=>false,'error'=>'This document is already returned or the return date precedes its movement date. Refresh and check the entry.'],409);
    documents_reply(['success'=>true]);
}
documents_reply(['success'=>false,'error'=>'Unknown action.'],400);
