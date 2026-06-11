<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

function setup_token_is_valid(string $providedToken): bool {
    $expected = app_env('SETUP_TOKEN', 'OfficeSetup2026');
    return $expected !== '' && hash_equals($expected, $providedToken);
}

function setup_json(array $payload, int $statusCode = 200): void {
    http_response_code($statusCode);
    echo json_encode($payload);
    exit;
}

function setup_create_tenant(mysqli $platformConn, string $code, string $name, string $dbMode): int {
    $stmt = $platformConn->prepare("INSERT INTO tenants (code, name, db_mode, status, is_legacy_default) VALUES (?, ?, ?, 'active', 0)");
    if (!$stmt) {
        setup_json(['success' => false, 'error' => 'Failed to prepare tenant insert.'], 500);
    }
    $stmt->bind_param('sss', $code, $name, $dbMode);
    $ok = $stmt->execute();
    $tenantId = (int)$stmt->insert_id;
    $error = $stmt->error;
    $stmt->close();
    if (!$ok) {
        setup_json(['success' => false, 'error' => 'Failed to create tenant: ' . $error], 400);
    }
    return $tenantId;
}

function setup_map_domain(mysqli $platformConn, int $tenantId, string $domain): void {
    if ($domain === '') {
        return;
    }
    $stmt = $platformConn->prepare("INSERT IGNORE INTO tenant_domains (tenant_id, domain, is_primary) VALUES (?, ?, 1)");
    if ($stmt) {
        $stmt->bind_param('is', $tenantId, $domain);
        $stmt->execute();
        $stmt->close();
    }
}

function setup_insert_connection(mysqli $platformConn, int $tenantId, string $dbHost, string $dbName, string $dbUser, string $dbPass): void {
    $stmt = $platformConn->prepare("INSERT INTO tenant_db_connections (tenant_id, db_host, db_name, db_user, db_pass, is_active) VALUES (?, ?, ?, ?, ?, 1)");
    if (!$stmt) {
        setup_json(['success' => false, 'error' => 'Failed to prepare tenant DB connection insert.'], 500);
    }
    $stmt->bind_param('issss', $tenantId, $dbHost, $dbName, $dbUser, $dbPass);
    $ok = $stmt->execute();
    $error = $stmt->error;
    $stmt->close();
    if (!$ok) {
        setup_json(['success' => false, 'error' => 'Failed to save tenant DB connection: ' . $error], 400);
    }
}

function setup_create_shared_admin(mysqli $platformConn, int $tenantId, string $name, string $email, string $passwordHash): void {
    $stmt = $platformConn->prepare("INSERT INTO users (tenant_id, name, email, role, designation, department, telegram_user_name, password, isActive) VALUES (?, ?, ?, 'Admin', '', '', '', ?, 1)");
    if (!$stmt) {
        setup_json(['success' => false, 'error' => 'Failed to prepare shared admin insert.'], 500);
    }
    $stmt->bind_param('isss', $tenantId, $name, $email, $passwordHash);
    $ok = $stmt->execute();
    $error = $stmt->error;
    $stmt->close();
    if (!$ok) {
        setup_json(['success' => false, 'error' => 'Failed to create tenant admin: ' . $error], 400);
    }
}

function setup_create_dedicated_admin(mysqli $tenantConn, string $name, string $email, string $passwordHash): void {
    $stmt = $tenantConn->prepare("INSERT INTO users (name, email, role, designation, department, telegram_user_name, password, isActive) VALUES (?, ?, 'Admin', '', '', '', ?, 1)");
    if (!$stmt) {
        setup_json(['success' => false, 'error' => 'Failed to prepare dedicated admin insert.'], 500);
    }
    $stmt->bind_param('sss', $name, $email, $passwordHash);
    $ok = $stmt->execute();
    $error = $stmt->error;
    $stmt->close();
    if (!$ok) {
        setup_json(['success' => false, 'error' => 'Failed to create dedicated tenant admin: ' . $error], 400);
    }
}

function setup_ensure_shared_settings(mysqli $platformConn, int $tenantId): void {
    $stmt = $platformConn->prepare("INSERT IGNORE INTO app_settings (tenant_id, officeTokenId, officeTelegramGroupId, whatsappGroupId, masId, masPassword, metaAccessToken, metaPhoneNumberId, metaWabaId, metaVerifyToken, viewLabelOverrides, fieldLabelOverrides, updated_at) VALUES (?, '', '', '', '', '', '', '', '', '', '{}', '{}', NOW())");
    if ($stmt) {
        $stmt->bind_param('i', $tenantId);
        $stmt->execute();
        $stmt->close();
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $providedToken = (string)($_GET['key'] ?? $_GET['token'] ?? '');
    if (!setup_token_is_valid($providedToken)) {
        setup_json(['success' => false, 'error' => 'Invalid setup token.'], 403);
    }

    setup_json([
        'success' => true,
        'message' => 'Setup endpoint ready.',
        'defaultTenantCode' => app_default_tenant_code(),
        'currentTenant' => [
            'id' => app_tenant_id(),
            'code' => app_tenant_code(),
            'name' => app_tenant_name(),
        ],
    ]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    setup_json(['success' => false, 'error' => 'Method not allowed.'], 405);
}

$payload = app_get_raw_input_data();
$setupToken = trim((string)($payload['setupToken'] ?? $payload['token'] ?? ''));
if (!setup_token_is_valid($setupToken)) {
    setup_json(['success' => false, 'error' => 'Invalid setup token.'], 403);
}

$action = trim((string)($payload['action'] ?? 'provisionTenant'));
app_ensure_foundation_migration($platformConn);

if ($action === 'status') {
    $tenants = [];
    if (db_table_exists($platformConn, 'tenants')) {
        $result = $platformConn->query("SELECT id, code, name, db_mode, status FROM tenants ORDER BY id ASC");
        if ($result instanceof mysqli_result) {
            $tenants = $result->fetch_all(MYSQLI_ASSOC);
            $result->free();
        }
    }
    setup_json([
        'success' => true,
        'tenants' => $tenants,
    ]);
}

if ($action !== 'provisionTenant') {
    setup_json(['success' => false, 'error' => 'Unsupported setup action.'], 400);
}

$tenantName = trim((string)($payload['tenantName'] ?? ''));
$tenantCode = strtolower(trim((string)($payload['tenantCode'] ?? '')));
$tenantCode = preg_replace('/[^a-z0-9_-]+/', '-', $tenantCode);
$domain = strtolower(trim((string)($payload['domain'] ?? '')));
$dbMode = strtolower(trim((string)($payload['dbMode'] ?? 'shared')));
$adminName = trim((string)($payload['adminName'] ?? 'Admin'));
$adminEmail = trim((string)($payload['adminEmail'] ?? ''));
$adminPassword = trim((string)($payload['adminPassword'] ?? ''));

if ($tenantName === '' || $tenantCode === '' || $adminEmail === '' || $adminPassword === '') {
    setup_json(['success' => false, 'error' => 'tenantName, tenantCode, adminEmail and adminPassword are required.'], 400);
}
if (!in_array($dbMode, ['shared', 'dedicated'], true)) {
    setup_json(['success' => false, 'error' => 'dbMode must be shared or dedicated.'], 400);
}
if (app_find_tenant_by_code($platformConn, $tenantCode)) {
    setup_json(['success' => false, 'error' => 'Tenant code already exists.'], 400);
}

$passwordHash = app_normalize_password_for_storage($adminPassword);
$tenantId = setup_create_tenant($platformConn, $tenantCode, $tenantName, $dbMode);
setup_map_domain($platformConn, $tenantId, $domain);

if ($dbMode === 'shared') {
    setup_ensure_shared_settings($platformConn, $tenantId);
    setup_create_shared_admin($platformConn, $tenantId, $adminName, $adminEmail, $passwordHash);
    setup_json([
        'success' => true,
        'message' => 'Shared tenant provisioned successfully.',
        'tenant' => [
            'id' => $tenantId,
            'code' => $tenantCode,
            'name' => $tenantName,
            'dbMode' => $dbMode,
        ]
    ]);
}

$dbHost = trim((string)($payload['dbHost'] ?? ''));
$dbName = trim((string)($payload['dbName'] ?? ''));
$dbUser = trim((string)($payload['dbUser'] ?? ''));
$dbPass = (string)($payload['dbPass'] ?? '');
if ($dbHost === '' || $dbName === '' || $dbUser === '' || $dbPass === '') {
    setup_json(['success' => false, 'error' => 'dbHost, dbName, dbUser and dbPass are required for dedicated tenants.'], 400);
}

setup_insert_connection($platformConn, $tenantId, $dbHost, $dbName, $dbUser, $dbPass);
$tenantConn = db_connect_or_fail($dbHost, $dbUser, $dbPass, $dbName);
app_run_sql_script($tenantConn, dirname(__DIR__) . '/hostinger_full_schema.sql');
setup_create_dedicated_admin($tenantConn, $adminName, $adminEmail, $passwordHash);

setup_json([
    'success' => true,
    'message' => 'Dedicated tenant provisioned successfully.',
    'tenant' => [
        'id' => $tenantId,
        'code' => $tenantCode,
        'name' => $tenantName,
        'dbMode' => $dbMode,
    ]
]);
