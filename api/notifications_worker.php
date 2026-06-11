<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/notifications.php';

header('Content-Type: application/json; charset=utf-8');

// Simple token gate to prevent arbitrary execution over the web.
$token = isset($_GET['token']) ? (string)$_GET['token'] : '';
$expected = notifications_worker_token();
if ($expected !== '' && !hash_equals($expected, $token)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Forbidden']);
    exit;
}

if (!notifications_enabled()) {
    echo json_encode(['success' => true, 'processed' => 0, 'message' => 'Notifications disabled']);
    exit;
}

if (!notifications_table_exists($conn, 'notification_queue')) {
    echo json_encode(['success' => true, 'processed' => 0, 'message' => 'Queue table missing']);
    exit;
}

$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
$limit = max(1, min(200, $limit));

$result = $conn->query(app_scope_sql($conn, 'notification_queue', "SELECT * FROM notification_queue WHERE status='pending' ORDER BY id ASC LIMIT {$limit}"));
if (!$result) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to read queue']);
    exit;
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

echo json_encode([
    'success' => true,
    'processed' => $processed,
    'sent' => $sent,
    'failed' => $failed
]);
