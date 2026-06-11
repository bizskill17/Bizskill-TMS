<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$DB_HOST = 'srv2057.hstgr.io';
$DB_NAME = 'u380752258_bizskillTMSCA';
$DB_USER = 'u380752258_bizskillTMSCA';
$DB_PASS = '!Office1@';

// Notifications feature flag (safe default: off).
// Set to true after queue tables + settings are configured.
$NOTIFICATIONS_ENABLED = true;

// Optional: shared secret for the worker endpoint (set a strong random string in production).
$NOTIFICATIONS_WORKER_TOKEN = 'tms_notify_2026_05_21__9f3c2a7b6d4e1c8a0b5d7e2f9a1c3e7b';

mysqli_report(MYSQLI_REPORT_OFF);
$conn = new mysqli($DB_HOST, $DB_USER, $DB_PASS, $DB_NAME);

if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Database connection failed.'
    ]);
    exit;
}

$conn->set_charset('utf8mb4');
