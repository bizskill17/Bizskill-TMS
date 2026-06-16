<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

function app_env(string $name, ?string $default = null): ?string {
    $value = getenv($name);
    if ($value === false || $value === null || $value === '') {
        return $default;
    }
    return (string)$value;
}

function app_get_raw_input(): string {
    static $raw = null;
    if ($raw !== null) {
        return $raw;
    }
    $raw = (string)file_get_contents('php://input');
    return $raw;
}

function app_get_raw_input_data(): array {
    static $decoded = null;
    if ($decoded !== null) {
        return $decoded;
    }
    $decoded = json_decode(app_get_raw_input() ?: '{}', true);
    return is_array($decoded) ? $decoded : [];
}

function db_connect_or_fail(string $host, string $user, string $pass, string $dbName): mysqli {
    mysqli_report(MYSQLI_REPORT_OFF);
    $connection = new mysqli($host, $user, $pass, $dbName);
    if ($connection->connect_error) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Database connection failed.'
        ]);
        exit;
    }
    $connection->set_charset('utf8mb4');
    return $connection;
}

function db_table_exists(mysqli $conn, string $table): bool {
    $safeTable = preg_replace('/[^a-zA-Z0-9_]/', '', $table);
    if ($safeTable === '') {
        return false;
    }
    $result = $conn->query("SHOW TABLES LIKE '{$safeTable}'");
    $exists = $result instanceof mysqli_result && $result->num_rows > 0;
    if ($result instanceof mysqli_result) {
        $result->free();
    }
    return $exists;
}

function db_has_column(mysqli $conn, string $table, string $column): bool {
    static $cache = [];
    $key = strtolower($conn->thread_id . ':' . $table . '.' . $column);
    if (array_key_exists($key, $cache)) {
        return $cache[$key];
    }
    $safeTable = preg_replace('/[^a-zA-Z0-9_]/', '', $table);
    $safeColumn = preg_replace('/[^a-zA-Z0-9_]/', '', $column);
    $result = $conn->query("SHOW COLUMNS FROM `{$safeTable}` LIKE '{$safeColumn}'");
    $exists = $result instanceof mysqli_result && $result->num_rows > 0;
    if ($result instanceof mysqli_result) {
        $result->free();
    }
    $cache[$key] = $exists;
    return $exists;
}

function db_index_exists(mysqli $conn, string $table, string $indexName): bool {
    $safeTable = preg_replace('/[^a-zA-Z0-9_]/', '', $table);
    $safeIndex = preg_replace('/[^a-zA-Z0-9_]/', '', $indexName);
    $result = $conn->query("SHOW INDEX FROM `{$safeTable}` WHERE Key_name = '{$safeIndex}'");
    $exists = $result instanceof mysqli_result && $result->num_rows > 0;
    if ($result instanceof mysqli_result) {
        $result->free();
    }
    return $exists;
}

function db_drop_index_if_exists(mysqli $conn, string $table, string $indexName): void {
    if (!db_table_exists($conn, $table) || !db_index_exists($conn, $table, $indexName)) {
        return;
    }
    $safeTable = preg_replace('/[^a-zA-Z0-9_]/', '', $table);
    $safeIndex = preg_replace('/[^a-zA-Z0-9_]/', '', $indexName);
    $conn->query("ALTER TABLE `{$safeTable}` DROP INDEX `{$safeIndex}`");
}

function app_scoped_tables(): array {
    return [
        'users',
        'designations',
        'departments',
        'categories',
        'status_master',
        'vendor_categories',
        'clients',
        'firms',
        'vendors',
        'projects',
        'main_tasks',
        'vendor_tasks',
        'action_logs',
        'recurring_tasks',
        'recurring_actions',
        'app_settings',
        'notification_queue',
        'notification_logs'
    ];
}

function app_base_platform_tables(): array {
    return [
        "CREATE TABLE IF NOT EXISTS organizations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            org_id VARCHAR(100) NOT NULL UNIQUE,
            org_name VARCHAR(190) NOT NULL,
            db_mode ENUM('shared','dedicated') NOT NULL DEFAULT 'shared',
            status ENUM('active','inactive') NOT NULL DEFAULT 'active',
            domain VARCHAR(255) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
        "CREATE TABLE IF NOT EXISTS organization_db_connections (
            id INT AUTO_INCREMENT PRIMARY KEY,
            organization_id INT NOT NULL,
            db_host VARCHAR(255) NOT NULL,
            db_name VARCHAR(255) NOT NULL,
            db_user VARCHAR(255) NOT NULL,
            db_password TEXT NOT NULL,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_org_db_org_id (organization_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
        "CREATE TABLE IF NOT EXISTS tenants (
            id INT AUTO_INCREMENT PRIMARY KEY,
            code VARCHAR(100) NOT NULL UNIQUE,
            name VARCHAR(190) NOT NULL,
            db_mode VARCHAR(20) NOT NULL DEFAULT 'shared',
            status VARCHAR(20) NOT NULL DEFAULT 'active',
            is_legacy_default TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
        "CREATE TABLE IF NOT EXISTS tenant_domains (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tenant_id INT NOT NULL,
            domain VARCHAR(255) NOT NULL UNIQUE,
            is_primary TINYINT(1) NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY idx_tenant_domains_tenant (tenant_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
        "CREATE TABLE IF NOT EXISTS tenant_db_connections (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tenant_id INT NOT NULL,
            db_host VARCHAR(255) NOT NULL,
            db_name VARCHAR(255) NOT NULL,
            db_user VARCHAR(255) NOT NULL,
            db_pass TEXT NOT NULL,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY idx_tenant_db_connections_tenant (tenant_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
        "CREATE TABLE IF NOT EXISTS tenant_features (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tenant_id INT NOT NULL,
            feature_key VARCHAR(120) NOT NULL,
            feature_value VARCHAR(255) DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_tenant_feature (tenant_id, feature_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
        "CREATE TABLE IF NOT EXISTS platform_admins (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(190) NOT NULL UNIQUE,
            name VARCHAR(120) NOT NULL,
            password VARCHAR(255) NOT NULL,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
        "CREATE TABLE IF NOT EXISTS platform_migrations (
            migration_key VARCHAR(120) PRIMARY KEY,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    ];
}

function app_default_tenant_code(): string {
    $raw = app_env('APP_DEFAULT_TENANT_CODE', 'default');
    $slug = strtolower(trim((string)$raw));
    $slug = preg_replace('/[^a-z0-9_-]+/', '-', $slug);
    $slug = trim((string)$slug, '-');
    return $slug !== '' ? $slug : 'default';
}

function app_current_host(): string {
    $host = strtolower(trim((string)($_SERVER['HTTP_HOST'] ?? '')));
    if ($host === '') {
        return '';
    }
    $parts = explode(':', $host);
    return trim((string)($parts[0] ?? ''));
}

function app_requested_tenant_code(): string {
    $payload = app_get_raw_input_data();
    $candidates = [
        $_GET['orgId'] ?? null,
        $_GET['tenantCode'] ?? null,
        $_SERVER['HTTP_X_ORG_ID'] ?? null,
        $_SERVER['HTTP_X_TENANT_CODE'] ?? null,
        $payload['orgId'] ?? null,
        $payload['tenantCode'] ?? null,
        $payload['data']['orgId'] ?? null,
        $payload['data']['tenantCode'] ?? null,
    ];
    foreach ($candidates as $candidate) {
        $value = strtolower(trim((string)$candidate));
        if ($value !== '') {
            return preg_replace('/[^a-z0-9_-]+/', '-', $value);
        }
    }
    return '';
}

function app_requested_org_id(): string {
    return app_requested_tenant_code();
}

function app_platform_admin_default_email(): string {
    return strtolower(trim((string)app_env('PLATFORM_ADMIN_EMAIL', 'bizskill17@gmail.com')));
}

function app_platform_admin_default_password(): string {
    return (string)app_env('PLATFORM_ADMIN_PASSWORD', '!Office1@');
}

function app_platform_admin_access_key(): string {
    return (string)app_env('PLATFORM_ADMIN_ACCESS_KEY', (string)app_env('SETUP_TOKEN', 'OfficeSetup2026'));
}

function app_find_platform_admin(mysqli $platformConn, string $email): ?array {
    $email = strtolower(trim($email));
    if ($email === '') {
        return null;
    }
    $stmt = $platformConn->prepare("SELECT * FROM platform_admins WHERE LOWER(email) = LOWER(?) AND is_active = 1 LIMIT 1");
    if (!$stmt) {
        return null;
    }
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $row = $stmt->get_result()?->fetch_assoc();
    $stmt->close();
    return $row ?: null;
}

function app_platform_admin_password_matches(string $storedPassword, string $password): bool {
    return $storedPassword !== '' && ($storedPassword === $password || password_verify($password, $storedPassword));
}

function app_is_platform_admin_credentials(mysqli $platformConn, string $email, string $password): bool {
    $email = strtolower(trim($email));
    if ($email === '' || $password === '') {
        return false;
    }

    if ($email === app_platform_admin_default_email() && app_platform_admin_default_password() === $password) {
        return true;
    }

    $admin = app_find_platform_admin($platformConn, $email);
    if (!$admin) {
        return false;
    }

    return app_platform_admin_password_matches((string)($admin['password'] ?? ''), $password);
}

function app_issue_platform_admin_token(string $email): string {
    $normalizedEmail = strtolower(trim($email));
    return hash_hmac('sha256', $normalizedEmail, app_platform_admin_access_key());
}

function app_request_value(array $payload, string $key): string {
    $candidates = [
        $_GET[$key] ?? null,
        $_SERVER['HTTP_' . strtoupper(str_replace('-', '_', $key))] ?? null,
        $payload[$key] ?? null,
        $payload['data'][$key] ?? null,
    ];
    foreach ($candidates as $candidate) {
        $value = trim((string)$candidate);
        if ($value !== '') {
            return $value;
        }
    }
    return '';
}

function app_platform_admin_request_authorized(mysqli $platformConn, ?array $payload = null): bool {
    $payload = $payload ?? app_get_raw_input_data();
    $email = strtolower(app_request_value($payload, 'platformAdminEmail'));
    $token = app_request_value($payload, 'platformAdminToken');
    if ($email === '' || $token === '') {
        return false;
    }

    $isKnownAdmin = $email === app_platform_admin_default_email() || app_find_platform_admin($platformConn, $email) !== null;
    if (!$isKnownAdmin) {
        return false;
    }

    return hash_equals(app_issue_platform_admin_token($email), $token);
}

function app_normalize_password_for_storage(string $password): string {
    $password = trim($password);
    if ($password === '') {
        return '';
    }
    $info = password_get_info($password);
    if (!empty($info['algo'])) {
        return $password;
    }
    return password_hash($password, PASSWORD_DEFAULT);
}

function app_ensure_business_table_has_tenant_column(mysqli $conn, string $table): void {
    if (!db_table_exists($conn, $table) || db_has_column($conn, $table, 'tenant_id')) {
        return;
    }
    $afterColumn = $table === 'app_settings' ? 'id' : 'created_at';
    if (!db_has_column($conn, $table, $afterColumn)) {
        $afterColumn = 'id';
    }
    $conn->query("ALTER TABLE `{$table}` ADD COLUMN `tenant_id` INT NULL AFTER `{$afterColumn}`");
    if (!db_index_exists($conn, $table, "idx_{$table}_tenant_id")) {
        $conn->query("ALTER TABLE `{$table}` ADD INDEX `idx_{$table}_tenant_id` (`tenant_id`)");
    }
}

function app_ensure_composite_unique(mysqli $conn, string $table, string $column, string $indexName): void {
    if (!db_table_exists($conn, $table) || !db_has_column($conn, $table, 'tenant_id') || !db_has_column($conn, $table, $column)) {
        return;
    }

    $safeTable = preg_replace('/[^a-zA-Z0-9_]/', '', $table);
    $safeColumn = preg_replace('/[^a-zA-Z0-9_]/', '', $column);
    $safeIndex = preg_replace('/[^a-zA-Z0-9_]/', '', $indexName);

    $result = $conn->query("SHOW INDEX FROM `{$safeTable}`");
    if ($result instanceof mysqli_result) {
        $drop = [];
        while ($row = $result->fetch_assoc()) {
            $keyName = (string)($row['Key_name'] ?? '');
            $columnName = (string)($row['Column_name'] ?? '');
            $nonUnique = (int)($row['Non_unique'] ?? 1);
            $seqInIndex = (int)($row['Seq_in_index'] ?? 1);
            if ($keyName !== 'PRIMARY' && $nonUnique === 0 && $columnName === $safeColumn && $seqInIndex === 1) {
                $drop[$keyName] = true;
            }
        }
        $result->free();
        foreach (array_keys($drop) as $keyName) {
            if ($keyName !== $safeIndex) {
                $conn->query("ALTER TABLE `{$safeTable}` DROP INDEX `{$keyName}`");
            }
        }
    }

    if (!db_index_exists($conn, $safeTable, $safeIndex)) {
        $conn->query("ALTER TABLE `{$safeTable}` ADD UNIQUE KEY `{$safeIndex}` (`tenant_id`, `{$safeColumn}`)");
    }
}

function app_ensure_shared_business_schema(mysqli $platformConn): void {
    foreach (app_scoped_tables() as $table) {
        app_ensure_business_table_has_tenant_column($platformConn, $table);
    }

    if (db_table_exists($platformConn, 'app_settings')) {
        $platformConn->query("ALTER TABLE `app_settings` MODIFY `id` INT NOT NULL AUTO_INCREMENT");
    }

    app_ensure_composite_unique($platformConn, 'users', 'email', 'uq_users_tenant_email');
    app_ensure_composite_unique($platformConn, 'designations', 'name', 'uq_designations_tenant_name');
    app_ensure_composite_unique($platformConn, 'departments', 'name', 'uq_departments_tenant_name');
    app_ensure_composite_unique($platformConn, 'categories', 'name', 'uq_categories_tenant_name');
    app_ensure_composite_unique($platformConn, 'status_master', 'name', 'uq_status_master_tenant_name');
    app_ensure_composite_unique($platformConn, 'vendor_categories', 'name', 'uq_vendor_categories_tenant_name');
    app_ensure_composite_unique($platformConn, 'firms', 'name', 'uq_firms_tenant_name');
    app_ensure_composite_unique($platformConn, 'projects', 'name', 'uq_projects_tenant_name');

    if (db_table_exists($platformConn, 'app_settings') && db_has_column($platformConn, 'app_settings', 'tenant_id') && !db_index_exists($platformConn, 'app_settings', 'uq_app_settings_tenant_id')) {
        $platformConn->query("ALTER TABLE `app_settings` ADD UNIQUE KEY `uq_app_settings_tenant_id` (`tenant_id`)");
    }
}

function app_ensure_platform_schema(mysqli $platformConn): void {
    foreach (app_base_platform_tables() as $sql) {
        $platformConn->query($sql);
    }
}

function app_ensure_foundation_migration(mysqli $platformConn): void {
    app_ensure_platform_schema($platformConn);
    $migrationKey = 'tenant_foundation_v1';
    $check = $platformConn->prepare("SELECT migration_key FROM platform_migrations WHERE migration_key = ? LIMIT 1");
    if (!$check) {
        return;
    }
    $check->bind_param('s', $migrationKey);
    $check->execute();
    $exists = $check->get_result()?->fetch_assoc();
    $check->close();
    if ($exists) {
        return;
    }

    app_ensure_shared_business_schema($platformConn);

    $insert = $platformConn->prepare("INSERT INTO platform_migrations (migration_key) VALUES (?)");
    if ($insert) {
        $insert->bind_param('s', $migrationKey);
        $insert->execute();
        $insert->close();
    }
}

function app_find_tenant_by_code(mysqli $platformConn, string $code): ?array {
    if ($code === '') {
        return null;
    }
    $stmt = $platformConn->prepare("SELECT * FROM tenants WHERE code = ? LIMIT 1");
    if (!$stmt) {
        return null;
    }
    $stmt->bind_param('s', $code);
    $stmt->execute();
    $row = $stmt->get_result()?->fetch_assoc();
    $stmt->close();
    return $row ?: null;
}

function app_find_tenant_by_domain(mysqli $platformConn, string $domain): ?array {
    if ($domain === '') {
        return null;
    }
    $stmt = $platformConn->prepare("SELECT t.* FROM tenant_domains d INNER JOIN tenants t ON t.id = d.tenant_id WHERE d.domain = ? LIMIT 1");
    if (!$stmt) {
        return null;
    }
    $stmt->bind_param('s', $domain);
    $stmt->execute();
    $row = $stmt->get_result()?->fetch_assoc();
    $stmt->close();
    return $row ?: null;
}

function app_seed_default_tenant(mysqli $platformConn): array {
    $tenant = app_find_tenant_by_code($platformConn, app_default_tenant_code());
    if (!$tenant) {
        $code = app_default_tenant_code();
        $name = app_env('APP_DEFAULT_TENANT_NAME', 'Default Tenant');
        $stmt = $platformConn->prepare("INSERT INTO tenants (code, name, db_mode, status, is_legacy_default) VALUES (?, ?, 'shared', 'active', 1)");
        if ($stmt) {
            $stmt->bind_param('ss', $code, $name);
            $stmt->execute();
            $tenantId = (int)$stmt->insert_id;
            $stmt->close();
            $tenant = ['id' => $tenantId, 'code' => $code, 'name' => $name, 'db_mode' => 'shared', 'status' => 'active'];
        }
    }
    if (!$tenant) {
        $tenant = app_find_tenant_by_code($platformConn, app_default_tenant_code()) ?? ['id' => 0, 'code' => app_default_tenant_code(), 'name' => 'Default Tenant', 'db_mode' => 'shared', 'status' => 'active'];
    }

    $tenantId = (int)($tenant['id'] ?? 0);
    $domains = array_filter(array_unique([
        app_current_host(),
        app_env('APP_DEFAULT_TENANT_DOMAIN', ''),
        'localhost',
        '127.0.0.1'
    ]));
    foreach ($domains as $domain) {
        $stmt = $platformConn->prepare("INSERT IGNORE INTO tenant_domains (tenant_id, domain, is_primary) VALUES (?, ?, 1)");
        if ($stmt) {
            $stmt->bind_param('is', $tenantId, $domain);
            $stmt->execute();
            $stmt->close();
        }
    }

    return $tenant;
}

function app_backfill_shared_tenant_data(mysqli $platformConn, int $tenantId): void {
    foreach (app_scoped_tables() as $table) {
        if (!db_table_exists($platformConn, $table) || !db_has_column($platformConn, $table, 'tenant_id')) {
            continue;
        }
        $platformConn->query("UPDATE `{$table}` SET tenant_id = {$tenantId} WHERE tenant_id IS NULL OR tenant_id = 0");
    }
}

function app_resolve_tenant(mysqli $platformConn): array {
    app_ensure_foundation_migration($platformConn);
    app_ensure_shared_business_schema($platformConn);
    $defaultTenant = app_seed_default_tenant($platformConn);
    $defaultTenantId = (int)($defaultTenant['id'] ?? 0);
    if ($defaultTenantId > 0) {
        app_backfill_shared_tenant_data($platformConn, $defaultTenantId);
    }

    $tenant = null;
    $requestedCode = app_requested_tenant_code();
    if ($requestedCode !== '') {
        $tenant = app_find_tenant_by_code($platformConn, $requestedCode);
    }
    if (!$tenant) {
        $host = app_current_host();
        if ($host !== '') {
            $tenant = app_find_tenant_by_domain($platformConn, $host);
        }
    }
    if (!$tenant) {
        $tenant = $defaultTenant;
    }
    return $tenant;
}

function app_open_tenant_connection(mysqli $platformConn, array $tenant): mysqli {
    $dbMode = strtolower(trim((string)($tenant['db_mode'] ?? 'shared')));
    if ($dbMode !== 'dedicated') {
        return $platformConn;
    }
    $tenantId = (int)($tenant['id'] ?? 0);
    $stmt = $platformConn->prepare("SELECT db_host, db_name, db_user, db_pass FROM tenant_db_connections WHERE tenant_id = ? AND is_active = 1 ORDER BY id DESC LIMIT 1");
    if (!$stmt) {
        return $platformConn;
    }
    $stmt->bind_param('i', $tenantId);
    $stmt->execute();
    $row = $stmt->get_result()?->fetch_assoc();
    $stmt->close();
    if (!$row) {
        return $platformConn;
    }
    return db_connect_or_fail((string)$row['db_host'], (string)$row['db_user'], (string)$row['db_pass'], (string)$row['db_name']);
}

function app_tenant_id(): int {
    return (int)($GLOBALS['currentTenant']['id'] ?? 0);
}

function app_tenant_code(): string {
    return (string)($GLOBALS['currentTenant']['code'] ?? app_default_tenant_code());
}

function app_tenant_name(): string {
    return (string)($GLOBALS['currentTenant']['name'] ?? 'Default Tenant');
}

function app_is_shared_tenant_mode(): bool {
    return strtolower(trim((string)($GLOBALS['currentTenant']['db_mode'] ?? 'shared'))) === 'shared';
}

function app_table_is_scoped(mysqli $conn, string $table): bool {
    return app_is_shared_tenant_mode() && in_array($table, app_scoped_tables(), true) && db_has_column($conn, $table, 'tenant_id');
}

function app_scope_sql(mysqli $conn, string $table, string $sql, string $alias = ''): string {
    if (!app_table_is_scoped($conn, $table)) {
        return $sql;
    }
    $column = $alias !== '' ? "{$alias}.tenant_id" : 'tenant_id';
    $clause = $column . ' = ' . app_tenant_id();
    if (preg_match('/\b(ORDER\s+BY|GROUP\s+BY|LIMIT)\b/i', $sql, $matches, PREG_OFFSET_CAPTURE)) {
        $keywordPos = (int)$matches[0][1];
        $before = rtrim(substr($sql, 0, $keywordPos));
        $after = substr($sql, $keywordPos);
        if (preg_match('/\bWHERE\b/i', $before)) {
            return $before . ' AND ' . $clause . ' ' . $after;
        }
        return $before . ' WHERE ' . $clause . ' ' . $after;
    }
    if (preg_match('/\bWHERE\b/i', $sql)) {
        return $sql . ' AND ' . $clause;
    }
    return $sql . ' WHERE ' . $clause;
}

function app_run_sql_script(mysqli $conn, string $path): bool {
    if (!is_file($path)) {
        return false;
    }
    $sql = (string)file_get_contents($path);
    if (trim($sql) === '') {
        return false;
    }
    if (!$conn->multi_query($sql)) {
        return false;
    }
    do {
        $result = $conn->store_result();
        if ($result instanceof mysqli_result) {
            $result->free();
        }
    } while ($conn->more_results() && $conn->next_result());
    return true;
}

$DB_HOST = app_env('DB_HOST', 'srv2057.hstgr.io');
$DB_NAME = app_env('DB_NAME', 'u380752258_bizskillTMSCA');
$DB_USER = app_env('DB_USER', 'u380752258_bizskillTMSCA');
$DB_PASS = app_env('DB_PASS', '!Office1@');

$NOTIFICATIONS_ENABLED = strtolower((string)app_env('NOTIFICATIONS_ENABLED', 'true')) === 'true';
$NOTIFICATIONS_WORKER_TOKEN = (string)app_env('NOTIFICATIONS_WORKER_TOKEN', 'tms_notify_2026_05_21__9f3c2a7b6d4e1c8a0b5d7e2f9a1c3e7b');

$platformConn = db_connect_or_fail((string)$DB_HOST, (string)$DB_USER, (string)$DB_PASS, (string)$DB_NAME);
$currentTenant = app_resolve_tenant($platformConn);
$conn = app_open_tenant_connection($platformConn, $currentTenant);

$GLOBALS['platformConn'] = $platformConn;
$GLOBALS['currentTenant'] = $currentTenant;
$GLOBALS['conn'] = $conn;
