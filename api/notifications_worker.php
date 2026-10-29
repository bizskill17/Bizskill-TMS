<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/notifications.php';
require_once __DIR__ . '/dsc_reminders.php';

header('Content-Type: application/json; charset=utf-8');

$token = (string)($_GET['token'] ?? '');
$expected = notifications_worker_token();
if ($expected === '' || !hash_equals($expected, $token)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Forbidden']);
    exit;
}
if (!notifications_enabled()) {
    echo json_encode(['success' => true, 'processed' => 0, 'sent' => 0, 'failed' => 0, 'message' => 'Notifications disabled']);
    exit;
}

// Limit is per organisation. No Org ID means all active organisations.
$limit = max(1, min(200, (int)($_GET['limit'] ?? 50)));
$requestedCode = app_requested_tenant_code();
$tenantSql = "SELECT * FROM tenants WHERE status = 'active' ORDER BY id";
$tenantResult = $platformConn->query($tenantSql);
if (!$tenantResult) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to read organisations']);
    exit;
}
$tenantsToProcess = [];
while ($tenantRow = $tenantResult->fetch_assoc()) {
    if ($requestedCode === '' || (string)$tenantRow['code'] === $requestedCode) {
        $tenantsToProcess[] = $tenantRow;
    }
}
$tenantResult->free();
if ($requestedCode !== '' && !$tenantsToProcess) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Organisation not found or inactive']);
    exit;
}

function worker_open_connection(mysqli $platformConn, array $tenant): mysqli {
    if (strtolower((string)($tenant['db_mode'] ?? 'shared')) !== 'dedicated') {
        // Never process an unscoped shared queue.
        foreach (['notification_queue', 'app_settings'] as $table) {
            if (!db_has_column($platformConn, $table, 'tenant_id')) {
                throw new RuntimeException('Shared notification tables require tenant_id');
            }
        }
        return $platformConn;
    }
    $tenantId = (int)$tenant['id'];
    $stmt = $platformConn->prepare("SELECT db_host, db_name, db_user, db_pass FROM tenant_db_connections WHERE tenant_id = ? AND is_active = 1 ORDER BY id DESC LIMIT 1");
    if (!$stmt) throw new RuntimeException('Cannot read dedicated database configuration');
    $stmt->bind_param('i', $tenantId);
    $stmt->execute();
    $row = $stmt->get_result()?->fetch_assoc();
    $stmt->close();
    if (!$row) throw new RuntimeException('Dedicated database connection is missing');
    // Do not use db_connect_or_fail: one failed tenant must not exit the run.
    $connection = @new mysqli((string)$row['db_host'], (string)$row['db_user'], (string)$row['db_pass'], (string)$row['db_name']);
    if ($connection->connect_errno) throw new RuntimeException('Dedicated database connection failed');
    $connection->set_charset('utf8mb4');
    return $connection;
}

function worker_process_queue(mysqli $conn, int $limit): array {
    if (!notifications_table_exists($conn, 'notification_queue')) {
        throw new RuntimeException('Notification queue table is missing');
    }
$result = $conn->query(app_scope_sql($conn, 'notification_queue', "SELECT * FROM notification_queue WHERE status='pending' ORDER BY id ASC LIMIT {$limit}"));
if (!$result) {
    throw new RuntimeException('Failed to read queue');
}

$rows = [];
while ($row = $result->fetch_assoc()) {
    $rows[] = $row;
}
$result->free();

$processed = 0;
$sent = 0;
$failed = 0;

foreach ($rows as $row) {
    $processed++;
    $id = (int)($row['id'] ?? 0);
    if ($id <= 0) continue;

    if (!dsc_reminder_current($conn,$row)) {
        $cancelSql="UPDATE notification_queue SET status='cancelled',updatedAt=NOW() WHERE id=? AND status='pending'";
        if (app_table_is_scoped($conn,'notification_queue')) $cancelSql.=" AND tenant_id=".app_tenant_id();
        dsc_query($conn,$cancelSql,[$id]);
        continue;
    }
    $dispatch = notifications_dispatch($conn, $row);
    $ok = (bool)($dispatch['ok'] ?? false);
    $err = (string)($dispatch['error'] ?? '');

    if ($ok) {
        $sql = "UPDATE notification_queue SET status='sent', updatedAt=NOW(), attempts=attempts+1, lastError=NULL WHERE id=?";
        if (app_table_is_scoped($conn, 'notification_queue')) {
            $sql .= " AND tenant_id = " . app_tenant_id();
        }
        $stmt = $conn->prepare($sql);
        if ($stmt) {
            $stmt->bind_param('i', $id);
            $stmt->execute();
            $stmt->close();
        }
        $sent++;
        notifications_log($conn, '', (string)$row['channel'], (string)$row['provider'], (string)$row['target'], 'sent', '');
    } else {
        $sql = "UPDATE notification_queue SET status='failed', updatedAt=NOW(), attempts=attempts+1, lastError=? WHERE id=?";
        if (app_table_is_scoped($conn, 'notification_queue')) {
            $sql .= " AND tenant_id = " . app_tenant_id();
        }
        $stmt = $conn->prepare($sql);
        if ($stmt) {
            $stmt->bind_param('si', $err, $id);
            $stmt->execute();
            $stmt->close();
        }
        $failed++;
        notifications_log($conn, '', (string)$row['channel'], (string)$row['provider'], (string)$row['target'], 'failed', $err);
    }
}

    return ['processed' => $processed, 'sent' => $sent, 'failed' => $failed];
}

$summary = ['success' => true, 'processed' => 0, 'sent' => 0, 'failed' => 0, 'organisations' => []];
$originalTenant = $GLOBALS['currentTenant'];
$originalConnection = $GLOBALS['conn'];
foreach ($tenantsToProcess as $tenant) {
    $tenantConnection = null;
    $locked = false;
    $lockName = 'tms_notifications_' . (int)$tenant['id'];
    $entry = ['orgId' => (string)$tenant['code'], 'processed' => 0, 'sent' => 0, 'failed' => 0];
    try {
        // Same platform DB lock protects all cron URLs, including single-org runs.
        $lockStmt = $platformConn->prepare("SELECT GET_LOCK(?, 0) AS acquired");
        if (!$lockStmt) throw new RuntimeException('Cannot acquire worker lock');
        $lockStmt->bind_param('s', $lockName);
        $lockStmt->execute();
        $lockRow = $lockStmt->get_result()?->fetch_assoc();
        $lockStmt->close();
        $locked = (int)($lockRow['acquired'] ?? 0) === 1;
        if (!$locked) {
            $entry['status'] = 'busy';
        } else {
            $GLOBALS['currentTenant'] = $tenant;
            $tenantConnection = worker_open_connection($platformConn, $tenant);
            $GLOBALS['conn'] = $tenantConnection;
            try { $entry['dscQueued']=dsc_schedule_reminders($tenantConnection); }
            catch (Throwable $error) {
                $entry['dscReminderError']='DSC reminder scheduling failed; check server log';
                $summary['success']=false;
                error_log('DSC reminders tenant '.(int)$tenant['id'].': '.$error->getMessage());
            }
            $entry = array_merge($entry, worker_process_queue($tenantConnection, $limit));
            $entry['status'] = 'processed';
            foreach (['processed', 'sent', 'failed'] as $key) $summary[$key] += $entry[$key];
        }
    } catch (Throwable $error) {
        $summary['success'] = false;
        $entry['status'] = 'error';
        // Keep connection credentials and provider payloads out of cron output.
        $entry['error'] = 'Organisation processing failed; check server error log';
        error_log('Notification worker tenant ' . (int)$tenant['id'] . ': ' . $error->getMessage());
    } finally {
        if ($tenantConnection instanceof mysqli && $tenantConnection !== $platformConn) {
            $tenantConnection->close();
        }
        if ($locked) {
            $releaseStmt = $platformConn->prepare("SELECT RELEASE_LOCK(?)");
            if ($releaseStmt) {
                $releaseStmt->bind_param('s', $lockName);
                $releaseStmt->execute();
                $releaseStmt->close();
            }
        }
        $GLOBALS['currentTenant'] = $originalTenant;
        $GLOBALS['conn'] = $originalConnection;
    }
    $summary['organisations'][] = $entry;
}
echo json_encode($summary);
