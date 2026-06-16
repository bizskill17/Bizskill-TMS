<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/notifications.php';

// Optional gzip compression for large JSON responses (init payload can be multiple MB).
// This greatly reduces transfer time on slow networks and improves page load.
if (!headers_sent()) {
    header('Vary: Accept-Encoding');
}
if (!ini_get('zlib.output_compression') && isset($_SERVER['HTTP_ACCEPT_ENCODING']) && strpos((string)$_SERVER['HTTP_ACCEPT_ENCODING'], 'gzip') !== false) {
    // phpcs:ignore
    @ob_start('ob_gzhandler');
}

function fetchAllRows(mysqli $conn, string $table, ?string $orderBy = null): array {
    $safe = preg_replace('/[^a-zA-Z0-9_]/', '', $table);
    $sql = app_scope_sql($conn, $safe, "SELECT * FROM `{$safe}`");
    if ($orderBy) {
        $safeOrder = preg_replace('/[^a-zA-Z0-9_]/', '', $orderBy);
        $sql .= " ORDER BY `{$safeOrder}` ASC";
    }
    $result = $conn->query($sql);
    if (!$result) {
        return [];
    }
    $rows = [];
    while ($row = $result->fetch_assoc()) {
        $rows[] = $row;
    }
    return $rows;
}

function fetchRecentRows(mysqli $conn, string $table, int $limit): array {
    $safe = preg_replace('/[^a-zA-Z0-9_]/', '', $table);
    $limit = max(1, min(5000, $limit));
    $sql = app_scope_sql($conn, $safe, "SELECT * FROM `{$safe}` ORDER BY id DESC LIMIT {$limit}");
    $result = $conn->query($sql);
    if (!$result) {
        return [];
    }
    $rows = [];
    while ($row = $result->fetch_assoc()) {
        $rows[] = $row;
    }
    return $rows;
}

function hasColumn(mysqli $conn, string $table, string $column): bool {
    return db_has_column($conn, $table, $column);
}

function add_employee_id_column_if_missing(mysqli $conn): void {
    if (!hasColumn($conn, 'users', 'employee_id')) {
        $conn->query("ALTER TABLE `users` ADD COLUMN `employee_id` VARCHAR(50) DEFAULT NULL AFTER `id`");
    }
}

function add_department_column_if_missing(mysqli $conn): void {
    if (!hasColumn($conn, 'users', 'department')) {
        $conn->query("ALTER TABLE `users` ADD COLUMN `department` VARCHAR(100) DEFAULT NULL AFTER `designation`");
    }
}

function ensure_departments_table(mysqli $conn): void {
    $conn->query("CREATE TABLE IF NOT EXISTS `departments` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `name` VARCHAR(100) NOT NULL UNIQUE
    )");
}

function add_telegram_user_name_column_if_missing(mysqli $conn): void {
    if (!hasColumn($conn, 'users', 'telegram_user_name')) {
        $conn->query("ALTER TABLE `users` ADD COLUMN `telegram_user_name` VARCHAR(120) DEFAULT NULL AFTER `department`");
    }
}

function add_notes_column_if_missing(mysqli $conn): void {
    if (!hasColumn($conn, 'recurring_tasks', 'notes')) {
        $conn->query("ALTER TABLE `recurring_tasks` ADD COLUMN `notes` LONGTEXT DEFAULT NULL AFTER `title`");
    }
}

function ensure_default_statuses(mysqli $conn): void {
    $defaults = ['In Progress', 'Completed'];
    $isScoped = app_table_is_scoped($conn, 'status_master');
    $tenantId = $isScoped ? app_tenant_id() : 0;

    foreach ($defaults as $statusName) {
        $normalized = strtolower(trim($statusName));

        if ($isScoped) {
            $check = $conn->prepare("SELECT id FROM status_master WHERE tenant_id = ? AND LOWER(TRIM(name)) = ? LIMIT 1");
            if (!$check) continue;
            $check->bind_param('is', $tenantId, $normalized);
        } else {
            $check = $conn->prepare("SELECT id FROM status_master WHERE LOWER(TRIM(name)) = ? LIMIT 1");
            if (!$check) continue;
            $check->bind_param('s', $normalized);
        }

        $check->execute();
        $existing = $check->get_result()?->fetch_assoc();
        $check->close();

        if ($existing) {
            $statusId = (int)($existing['id'] ?? 0);
            if ($statusId > 0) {
                $markSystem = $conn->prepare("UPDATE status_master SET is_system = 1 WHERE id = ?" . ($isScoped ? " AND tenant_id = " . $tenantId : ''));
                if ($markSystem) {
                    $markSystem->bind_param('i', $statusId);
                    $markSystem->execute();
                    $markSystem->close();
                }
            }
            continue;
        }

        if ($isScoped) {
            $insert = $conn->prepare("INSERT INTO status_master (tenant_id, name, is_system) VALUES (?, ?, 1)");
            if (!$insert) continue;
            $insert->bind_param('is', $tenantId, $statusName);
        } else {
            $insert = $conn->prepare("INSERT INTO status_master (name, is_system) VALUES (?, 1)");
            if (!$insert) continue;
            $insert->bind_param('s', $statusName);
        }

        $insert->execute();
        $insert->close();
    }
}

function scoped_name_exists(mysqli $conn, string $table, string $name, int $excludeId = 0): bool {
    $safeTable = preg_replace('/[^a-zA-Z0-9_]/', '', $table);
    $trimmedName = trim($name);
    if ($safeTable === '' || $trimmedName === '') {
        return false;
    }

    $isScoped = app_table_is_scoped($conn, $safeTable);
    if ($isScoped && $excludeId > 0) {
        $tenantId = app_tenant_id();
        $stmt = $conn->prepare("SELECT id FROM `{$safeTable}` WHERE tenant_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?)) AND id <> ? LIMIT 1");
        if (!$stmt) return false;
        $stmt->bind_param('isi', $tenantId, $trimmedName, $excludeId);
    } elseif ($isScoped) {
        $tenantId = app_tenant_id();
        $stmt = $conn->prepare("SELECT id FROM `{$safeTable}` WHERE tenant_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1");
        if (!$stmt) return false;
        $stmt->bind_param('is', $tenantId, $trimmedName);
    } elseif ($excludeId > 0) {
        $stmt = $conn->prepare("SELECT id FROM `{$safeTable}` WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND id <> ? LIMIT 1");
        if (!$stmt) return false;
        $stmt->bind_param('si', $trimmedName, $excludeId);
    } else {
        $stmt = $conn->prepare("SELECT id FROM `{$safeTable}` WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1");
        if (!$stmt) return false;
        $stmt->bind_param('s', $trimmedName);
    }

    $stmt->execute();
    $existing = $stmt->get_result()?->fetch_assoc();
    $stmt->close();
    return !!$existing;
}

function fetchOrganizationsWithConnections(mysqli $platformConn): array {
    $sql = "SELECT
                o.id,
                o.org_id,
                o.org_name,
                o.db_mode,
                o.status,
                o.domain,
                c.db_host,
                c.db_name,
                c.db_user
            FROM organizations o
            LEFT JOIN organization_db_connections c
                ON c.organization_id = o.id
                AND c.is_active = 1
            ORDER BY o.id DESC";
    $result = $platformConn->query($sql);
    if (!$result) {
        return [];
    }
    $rows = [];
    while ($row = $result->fetch_assoc()) {
        $row['has_connection'] = !empty($row['db_host']) ? '1' : '0';
        $rows[] = $row;
    }
    return $rows;
}

function sendJson(array $payload, int $statusCode = 200): void {
    http_response_code($statusCode);
    echo json_encode($payload);
    exit;
}

function normalizeNumericGoal($raw): string {
    if ($raw === null) return '';
    $value = trim((string)$raw);
    if ($value === '') return '';
    if (!is_numeric($value)) return '';
    return (string)(0 + $value);
}

function notify_task_created(mysqli $conn, array $taskRow, bool $isVendorTask): void {
    if (!notifications_enabled()) return;
    $settings = notifications_get_settings($conn);

    // WhatsApp provider selection (Meta -> MAS).
    $waProvider = notifications_pick_whatsapp_provider($settings);
    $message = notifications_compose_task_created($taskRow, $isVendorTask);

    // Personal WhatsApp
    if ($waProvider !== '') {
        if ($isVendorTask) {
            $mobile = notifications_get_vendor_mobile($conn, (string)($taskRow['vendor'] ?? ''));
            if ($mobile !== '') {
                notifications_enqueue($conn, 'whatsapp', $waProvider, 'personal', $mobile, $message, ['event' => 'task_created']);
                notifications_log($conn, 'task_created', 'whatsapp', $waProvider, $mobile, 'enqueued', '');
            }
        } else {
            $assignees = (string)($taskRow['assignees'] ?? '');
            foreach (array_filter(array_map('trim', explode(',', $assignees))) as $assignee) {
                $mobile = notifications_get_user_mobile($conn, $assignee);
                if ($mobile === '') continue;
                notifications_enqueue($conn, 'whatsapp', $waProvider, 'personal', $mobile, $message, ['event' => 'task_created']);
                notifications_log($conn, 'task_created', 'whatsapp', $waProvider, $mobile, 'enqueued', '');
            }
        }
    }

    // WhatsApp group (optional): supported via MessageAutoSender only.
    if ($waProvider === 'mas') {
        $defaultGroup = trim((string)($settings['whatsappGroupId'] ?? ''));
        $project = (string)($taskRow['project'] ?? '');
        $groups = notifications_get_project_groups($conn, $project);
        $groupId = trim((string)($groups['whatsappGroupId'] ?? '')) ?: $defaultGroup;
        if ($groupId !== '') {
            notifications_enqueue($conn, 'whatsapp', $waProvider, 'group', $groupId, $message, ['event' => 'task_created']);
            notifications_log($conn, 'task_created', 'whatsapp', $waProvider, $groupId, 'enqueued', '');
        }
    }

    // Telegram (independent): if configured, send to project group if available else office group.
    if (notifications_is_telegram_configured($settings)) {
        $officeChatId = trim((string)($settings['officeTelegramGroupId'] ?? ''));
        $project = (string)($taskRow['project'] ?? '');
        $groups = notifications_get_project_groups($conn, $project);
        $chatId = trim((string)($groups['telegramGroupId'] ?? '')) ?: $officeChatId;
        if ($chatId !== '') {
            notifications_enqueue($conn, 'telegram', 'telegram', 'group', $chatId, $message, ['event' => 'task_created']);
            notifications_log($conn, 'task_created', 'telegram', 'telegram', $chatId, 'enqueued', '');
        }
    }
}

function notify_task_updated(mysqli $conn, array $taskRow, array $logRow, bool $isVendorTask): void {
    if (!notifications_enabled()) return;
    $settings = notifications_get_settings($conn);
    $waProvider = notifications_pick_whatsapp_provider($settings);
    $message = notifications_compose_task_updated($taskRow, $logRow);

    if ($waProvider !== '') {
        // Update message goes to Owner only.
        $owner = (string)($taskRow['owner'] ?? '');
        $mobile = notifications_get_user_mobile($conn, $owner);
        if ($mobile !== '') {
            notifications_enqueue($conn, 'whatsapp', $waProvider, 'personal', $mobile, $message, ['event' => 'task_updated']);
            notifications_log($conn, 'task_updated', 'whatsapp', $waProvider, $mobile, 'enqueued', '');
        }
    }

    if (notifications_is_telegram_configured($settings)) {
        $officeChatId = trim((string)($settings['officeTelegramGroupId'] ?? ''));
        $project = (string)($taskRow['project'] ?? '');
        $groups = notifications_get_project_groups($conn, $project);
        $chatId = trim((string)($groups['telegramGroupId'] ?? '')) ?: $officeChatId;
        if ($chatId !== '') {
            notifications_enqueue($conn, 'telegram', 'telegram', 'group', $chatId, $message, ['event' => 'task_updated']);
            notifications_log($conn, 'task_updated', 'telegram', 'telegram', $chatId, 'enqueued', '');
        }
    }
}

function notify_recurring_created(mysqli $conn, array $taskRow): void {
    if (!notifications_enabled()) return;
    $settings = notifications_get_settings($conn);
    $waProvider = notifications_pick_whatsapp_provider($settings);
    $message = notifications_compose_recurring_created($taskRow);

    if ($waProvider !== '') {
        $assignee = (string)($taskRow['assignee'] ?? '');
        $mobile = notifications_get_user_mobile($conn, $assignee);
        if ($mobile !== '') {
            notifications_enqueue($conn, 'whatsapp', $waProvider, 'personal', $mobile, $message, ['event' => 'recurring_created']);
            notifications_log($conn, 'recurring_created', 'whatsapp', $waProvider, $mobile, 'enqueued', '');
        }
    }

    if (notifications_is_telegram_configured($settings)) {
        $officeChatId = trim((string)($settings['officeTelegramGroupId'] ?? ''));
        if ($officeChatId !== '') {
            notifications_enqueue($conn, 'telegram', 'telegram', 'group', $officeChatId, $message, ['event' => 'recurring_created']);
            notifications_log($conn, 'recurring_created', 'telegram', 'telegram', $officeChatId, 'enqueued', '');
        }
    }
}

function notify_recurring_action(mysqli $conn, array $actionRow): void {
    if (!notifications_enabled()) return;
    $settings = notifications_get_settings($conn);
    $waProvider = notifications_pick_whatsapp_provider($settings);
    $message = notifications_compose_recurring_action($actionRow);

    if ($waProvider !== '') {
        // Recurring update goes to Owner.
        $owner = (string)($actionRow['owner'] ?? '');
        $mobile = notifications_get_user_mobile($conn, $owner);
        if ($mobile !== '') {
            notifications_enqueue($conn, 'whatsapp', $waProvider, 'personal', $mobile, $message, ['event' => 'recurring_action']);
            notifications_log($conn, 'recurring_action', 'whatsapp', $waProvider, $mobile, 'enqueued', '');
        }
    }

    if (notifications_is_telegram_configured($settings)) {
        $officeChatId = trim((string)($settings['officeTelegramGroupId'] ?? ''));
        if ($officeChatId !== '') {
            notifications_enqueue($conn, 'telegram', 'telegram', 'group', $officeChatId, $message, ['event' => 'recurring_action']);
            notifications_log($conn, 'recurring_action', 'telegram', 'telegram', $officeChatId, 'enqueued', '');
        }
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $action = isset($_GET['action']) ? (string)$_GET['action'] : '';
    if ($action !== 'init') {
        sendJson(['success' => false, 'error' => 'Invalid action.'], 400);
    }

    // Limits (optional). Tasks are kept unbounded to avoid changing core behavior.
    // Logs can become very large; limiting them drastically improves init payload size.
    $actionLogsLimit = isset($_GET['actionLogsLimit']) ? (int)$_GET['actionLogsLimit'] : 500;
    $recurringActionsLimit = isset($_GET['recurringActionsLimit']) ? (int)$_GET['recurringActionsLimit'] : 500;

    // Ensure database columns exist
    add_employee_id_column_if_missing($conn);
    add_department_column_if_missing($conn);
    add_telegram_user_name_column_if_missing($conn);
    ensure_departments_table($conn);
    add_notes_column_if_missing($conn);
    ensure_default_statuses($conn);

    $users = array_map(static function(array $u): array {
        $isActiveRaw = strtolower((string)($u['isActive'] ?? '1'));
        $u['isActive'] = in_array($isActiveRaw, ['1', 'true', 'yes'], true) ? 'TRUE' : 'FALSE';
        return $u;
    }, fetchAllRows($conn, 'users', 'name'));

    $settingsRows = fetchAllRows($conn, 'app_settings');
    $settings = $settingsRows[0] ?? [
        'officeTokenId' => '',
        'officeTelegramGroupId' => '',
        'whatsappGroupId' => '',
        'masId' => '',
        'masPassword' => '',
        'metaAccessToken' => '',
        'metaPhoneNumberId' => '',
        'metaWabaId' => '',
        'metaVerifyToken' => '',
        'viewLabelOverrides' => '{}',
        'fieldLabelOverrides' => '{}'
    ];

    if (!isset($settings['viewLabelOverrides']) || trim((string)$settings['viewLabelOverrides']) === '') {
        $settings['viewLabelOverrides'] = '{}';
    }
    if (!isset($settings['fieldLabelOverrides']) || trim((string)$settings['fieldLabelOverrides']) === '') {
        $settings['fieldLabelOverrides'] = '{}';
    }

    $organizations = app_platform_admin_request_authorized($platformConn, $_GET) ? fetchOrganizationsWithConnections($platformConn) : [];

    sendJson([
        'success' => true,
        'data' => [
            'mainTasks' => fetchAllRows($conn, 'main_tasks'),
            'vendorTasks' => fetchAllRows($conn, 'vendor_tasks'),
            'users' => $users,
            'designations' => fetchAllRows($conn, 'designations', 'name'),
            'departments' => fetchAllRows($conn, 'departments', 'name'),
            'categories' => fetchAllRows($conn, 'categories', 'name'),
            'statuses' => fetchAllRows($conn, 'status_master', 'name'),
            'vendorCategories' => fetchAllRows($conn, 'vendor_categories', 'name'),
            'projects' => fetchAllRows($conn, 'projects', 'name'),
            'clients' => fetchAllRows($conn, 'clients', 'name'),
            'firms' => fetchAllRows($conn, 'firms', 'name'),
            'vendors' => fetchAllRows($conn, 'vendors', 'name'),
            'actionLogs' => fetchRecentRows($conn, 'action_logs', $actionLogsLimit),
            'recurringTasks' => fetchAllRows($conn, 'recurring_tasks'),
            'recurringActions' => fetchRecentRows($conn, 'recurring_actions', $recurringActionsLimit),
            'settings' => $settings,
            'organizations' => $organizations,
            'tenant' => [
                'id' => app_tenant_id(),
                'code' => app_tenant_code(),
                'name' => app_tenant_name(),
                'dbMode' => (string)($currentTenant['db_mode'] ?? 'shared'),
            ]
        ]
    ]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $payload = app_get_raw_input_data();
    if (!is_array($payload)) {
        sendJson(['success' => false, 'error' => 'Invalid JSON payload.'], 400);
    }

    $action = isset($payload['action']) ? (string)$payload['action'] : '';
    $target = strtolower((string)($payload['target'] ?? ''));
    $data = isset($payload['data']) && is_array($payload['data']) ? $payload['data'] : [];

    if (in_array($action, ['addOrganization', 'updateOrganization'], true)) {
        if (!app_platform_admin_request_authorized($platformConn, $payload)) {
            sendJson(['success' => false, 'error' => 'Platform admin access required.'], 403);
        }

        $orgId = strtolower(trim((string)($data['orgId'] ?? $data['org_id'] ?? '')));
        $orgId = preg_replace('/[^a-z0-9_-]+/', '-', $orgId);
        $orgName = trim((string)($data['orgName'] ?? $data['org_name'] ?? ''));
        $dbMode = strtolower(trim((string)($data['dbMode'] ?? $data['db_mode'] ?? 'shared')));
        $status = strtolower(trim((string)($data['status'] ?? 'active')));
        $domain = strtolower(trim((string)($data['domain'] ?? '')));
        $dbHost = trim((string)($data['dbHost'] ?? $data['db_host'] ?? ''));
        $dbName = trim((string)($data['dbName'] ?? $data['db_name'] ?? ''));
        $dbUser = trim((string)($data['dbUser'] ?? $data['db_user'] ?? ''));
        $dbPassword = (string)($data['dbPassword'] ?? '');

        if ($orgId === '' || $orgName === '') {
            sendJson(['success' => false, 'error' => 'Org Id and organization name are required.'], 400);
        }
        if (!in_array($dbMode, ['shared', 'dedicated'], true)) {
            sendJson(['success' => false, 'error' => 'Invalid DB mode.'], 400);
        }
        if (!in_array($status, ['active', 'inactive'], true)) {
            sendJson(['success' => false, 'error' => 'Invalid status.'], 400);
        }

        if ($action === 'addOrganization') {
            $check = $platformConn->prepare("SELECT id FROM organizations WHERE org_id = ? LIMIT 1");
            if (!$check) {
                sendJson(['success' => false, 'error' => 'Failed to validate organization.'], 500);
            }
            $check->bind_param('s', $orgId);
            $check->execute();
            $exists = $check->get_result()?->fetch_assoc();
            $check->close();
            if ($exists) {
                sendJson(['success' => false, 'error' => 'Org Id already exists.'], 400);
            }

            $stmt = $platformConn->prepare("INSERT INTO organizations (org_id, org_name, db_mode, status, domain) VALUES (?, ?, ?, ?, ?)");
            if (!$stmt) {
                sendJson(['success' => false, 'error' => 'Failed to prepare organization insert.'], 500);
            }
            $stmt->bind_param('sssss', $orgId, $orgName, $dbMode, $status, $domain);
            $ok = $stmt->execute();
            $organizationId = (int)$stmt->insert_id;
            $stmtError = $stmt->error;
            $stmt->close();
            if (!$ok) {
                sendJson(['success' => false, 'error' => 'Failed to add organization: ' . $stmtError], 400);
            }

            $tenantStmt = $platformConn->prepare("INSERT INTO tenants (code, name, db_mode, status, is_legacy_default) VALUES (?, ?, ?, ?, 0)");
            if ($tenantStmt) {
                $tenantStmt->bind_param('ssss', $orgId, $orgName, $dbMode, $status);
                $tenantStmt->execute();
                $tenantStmt->close();
            }
        } else {
            $organizationId = (int)($data['id'] ?? 0);
            if ($organizationId <= 0) {
                sendJson(['success' => false, 'error' => 'Invalid organization id.'], 400);
            }

            $stmt = $platformConn->prepare("UPDATE organizations SET org_id=?, org_name=?, db_mode=?, status=?, domain=? WHERE id=?");
            if (!$stmt) {
                sendJson(['success' => false, 'error' => 'Failed to prepare organization update.'], 500);
            }
            $stmt->bind_param('sssssi', $orgId, $orgName, $dbMode, $status, $domain, $organizationId);
            $ok = $stmt->execute();
            $stmtError = $stmt->error;
            $stmt->close();
            if (!$ok) {
                sendJson(['success' => false, 'error' => 'Failed to update organization: ' . $stmtError], 400);
            }

            $tenantStmt = $platformConn->prepare("UPDATE tenants SET code=?, name=?, db_mode=?, status=? WHERE code = ?");
            if ($tenantStmt) {
                $previousCode = trim((string)($data['previousOrgId'] ?? $orgId));
                $tenantStmt->bind_param('sssss', $orgId, $orgName, $dbMode, $status, $previousCode);
                $tenantStmt->execute();
                $tenantStmt->close();
            }
        }

        if ($domain !== '') {
            $tenant = app_find_tenant_by_code($platformConn, $orgId);
            $tenantId = (int)($tenant['id'] ?? 0);
            if ($tenantId > 0) {
                $platformConn->query("DELETE FROM tenant_domains WHERE tenant_id = {$tenantId}");
                $domainStmt = $platformConn->prepare("INSERT IGNORE INTO tenant_domains (tenant_id, domain, is_primary) VALUES (?, ?, 1)");
                if ($domainStmt) {
                    $domainStmt->bind_param('is', $tenantId, $domain);
                    $domainStmt->execute();
                    $domainStmt->close();
                }
            }
        }

        if ($dbMode === 'dedicated' && $dbHost !== '' && $dbName !== '' && $dbUser !== '') {
            $deleteOrgConnection = $platformConn->prepare("DELETE FROM organization_db_connections WHERE organization_id = ?");
            if ($deleteOrgConnection) {
                $deleteOrgConnection->bind_param('i', $organizationId);
                $deleteOrgConnection->execute();
                $deleteOrgConnection->close();
            }
            $insertOrgConnection = $platformConn->prepare("INSERT INTO organization_db_connections (organization_id, db_host, db_name, db_user, db_password, is_active) VALUES (?, ?, ?, ?, ?, 1)");
            if ($insertOrgConnection) {
                $insertOrgConnection->bind_param('issss', $organizationId, $dbHost, $dbName, $dbUser, $dbPassword);
                $insertOrgConnection->execute();
                $insertOrgConnection->close();
            }

            $tenant = app_find_tenant_by_code($platformConn, $orgId);
            $tenantId = (int)($tenant['id'] ?? 0);
            if ($tenantId > 0) {
                $deleteTenantConnection = $platformConn->prepare("DELETE FROM tenant_db_connections WHERE tenant_id = ?");
                if ($deleteTenantConnection) {
                    $deleteTenantConnection->bind_param('i', $tenantId);
                    $deleteTenantConnection->execute();
                    $deleteTenantConnection->close();
                }
                $insertTenantConnection = $platformConn->prepare("INSERT INTO tenant_db_connections (tenant_id, db_host, db_name, db_user, db_pass, is_active) VALUES (?, ?, ?, ?, ?, 1)");
                if ($insertTenantConnection) {
                    $insertTenantConnection->bind_param('issss', $tenantId, $dbHost, $dbName, $dbUser, $dbPassword);
                    $insertTenantConnection->execute();
                    $insertTenantConnection->close();
                }
            }
        }

        sendJson(['success' => true]);
    }

    // Map frontend target labels to SQL table names.
    $targetTableMap = [
        'users' => 'users',
        'clients' => 'clients',
        'projects' => 'projects',
        'firms' => 'firms',
        'vendors' => 'vendors',
        'categories' => 'categories',
        'statuses' => 'status_master',
        'vendorcategories' => 'vendor_categories',
        'designations' => 'designations',
        'departments' => 'departments',
        'maintasks' => 'main_tasks',
        'vendortasks' => 'vendor_tasks',
        'maintaskactionlog' => 'action_logs',
        'vendortaskactionlog' => 'action_logs',
        'recurringtasks' => 'recurring_tasks',
        'recurringactions' => 'recurring_actions',
        'appsettings' => 'app_settings'
    ];
    $table = $targetTableMap[$target] ?? '';

    if ($table === '') {
        sendJson(['success' => false, 'error' => 'Unsupported target for SQL write.'], 400);
    }

    if ($action === 'addMaster' && $table === 'users') {
        $name = trim((string)($data['name'] ?? ''));
        $email = trim((string)($data['email'] ?? ''));
        $employee_id = trim((string)($data['employeeId'] ?? $data['employee_id'] ?? ''));
        $mobile = trim((string)($data['mobile'] ?? ''));
        $role = trim((string)($data['role'] ?? 'Employee'));
        $designation = trim((string)($data['designation'] ?? ''));
        $department = trim((string)($data['department'] ?? ''));
        $telegram_user_name = trim((string)($data['telegramUserName'] ?? $data['telegram_user_name'] ?? ''));
        $password = app_normalize_password_for_storage((string)($data['password'] ?? ''));
        $isActiveRaw = strtolower((string)($data['isActive'] ?? 'true'));
        $isActive = in_array($isActiveRaw, ['1', 'true', 'yes'], true) ? 1 : 0;

        if ($name === '' || $email === '' || $password === '') {
            sendJson(['success' => false, 'error' => 'Name, email and password are required.'], 400);
        }

        if (app_table_is_scoped($conn, 'users')) {
            $tenantId = app_tenant_id();
            $stmt = $conn->prepare(
                "INSERT INTO users (tenant_id, name, email, employee_id, mobile, role, designation, department, telegram_user_name, password, isActive) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            );
            if (!$stmt) {
                sendJson(['success' => false, 'error' => 'Failed to prepare insert query.'], 500);
            }
            $stmt->bind_param('isssssssssi', $tenantId, $name, $email, $employee_id, $mobile, $role, $designation, $department, $telegram_user_name, $password, $isActive);
        } else {
            $stmt = $conn->prepare(
                "INSERT INTO users (name, email, employee_id, mobile, role, designation, department, telegram_user_name, password, isActive) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            );
            if (!$stmt) {
                sendJson(['success' => false, 'error' => 'Failed to prepare insert query.'], 500);
            }
            $stmt->bind_param('sssssssssi', $name, $email, $employee_id, $mobile, $role, $designation, $department, $telegram_user_name, $password, $isActive);
        }
        $ok = $stmt->execute();
        $insertId = (int)$stmt->insert_id;
        $stmt->close();

        if (!$ok) {
            sendJson(['success' => false, 'error' => 'Failed to insert user. Email may already exist.'], 400);
        }

        sendJson(['success' => true, 'data' => ['id' => $insertId]]);
    }

    if ($action === 'addTask' && in_array($table, ['main_tasks', 'vendor_tasks'], true)) {
        $id = (int)($data['id'] ?? 0);
        if ($id <= 0) {
            $id = (int)round(microtime(true) * 1000);
        }
        $date = (string)($data['date'] ?? '');
        $title = trim((string)($data['title'] ?? $data['task'] ?? ''));
        $description = (string)($data['notes'] ?? $data['description'] ?? '');
        $project = (string)($data['project'] ?? '');
        $firm = (string)($data['firm'] ?? '');
        $category = (string)($data['category'] ?? '');
        $owner = (string)($data['owner'] ?? '');
        $assignees = (string)($data['assignees'] ?? '');
        $client = (string)($data['clientName'] ?? $data['client'] ?? '');
        $priority = (string)($data['priority'] ?? 'Medium');
        $status = (string)($data['status'] ?? 'Not Yet Started');
        $dueDate = (string)($data['due Date'] ?? $data['dueDate'] ?? '');
        $lastUpdateDate = (string)($data['lastUpdateDate'] ?? $data['last Update'] ?? '');
        $lastUpdateRemarks = (string)($data['remark'] ?? $data['lastUpdateRemarks'] ?? '');
        $hours = (float)($data['hours'] ?? 0);
        $time = (string)($data['time'] ?? '');
        $goal = normalizeNumericGoal($data['goal'] ?? '');
        $photos = (string)($data['photos'] ?? '');
        $pdf = (string)($data['pdf'] ?? '');
        $vendor = (string)($data['vendor'] ?? '');
        $vendorCategory = (string)($data['vendorCategory'] ?? '');

        if ($title === '') {
            sendJson(['success' => false, 'error' => 'Task title is required.'], 400);
        }

        if ($table === 'main_tasks') {
            if (app_table_is_scoped($conn, 'main_tasks')) {
                $tenantId = app_tenant_id();
                $stmt = $conn->prepare("INSERT INTO main_tasks (tenant_id, id, date, title, description, project, firm, category, owner, assignees, client, priority, status, dueDate, lastUpdateDate, lastUpdateRemarks, hours, time, goal, photos, pdf) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare main task insert.'], 500);
                $stmt->bind_param('iissssssssssssssdssss', $tenantId, $id, $date, $title, $description, $project, $firm, $category, $owner, $assignees, $client, $priority, $status, $dueDate, $lastUpdateDate, $lastUpdateRemarks, $hours, $time, $goal, $photos, $pdf);
            } else {
                $stmt = $conn->prepare("INSERT INTO main_tasks (id, date, title, description, project, firm, category, owner, assignees, client, priority, status, dueDate, lastUpdateDate, lastUpdateRemarks, hours, time, goal, photos, pdf) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare main task insert.'], 500);
                $stmt->bind_param('issssssssssssssdssss', $id, $date, $title, $description, $project, $firm, $category, $owner, $assignees, $client, $priority, $status, $dueDate, $lastUpdateDate, $lastUpdateRemarks, $hours, $time, $goal, $photos, $pdf);
            }
        } else {
            if (app_table_is_scoped($conn, 'vendor_tasks')) {
                $tenantId = app_tenant_id();
                $stmt = $conn->prepare("INSERT INTO vendor_tasks (tenant_id, id, date, title, description, project, firm, category, owner, assignees, vendor, vendorCategory, priority, status, dueDate, lastUpdateDate, lastUpdateRemarks, hours, time, goal, photos, pdf) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare vendor task insert.'], 500);
                $stmt->bind_param('iissssssssssssssssdssss', $tenantId, $id, $date, $title, $description, $project, $firm, $category, $owner, $assignees, $vendor, $vendorCategory, $priority, $status, $dueDate, $lastUpdateDate, $lastUpdateRemarks, $hours, $time, $goal, $photos, $pdf);
            } else {
                $stmt = $conn->prepare("INSERT INTO vendor_tasks (id, date, title, description, project, firm, category, owner, assignees, vendor, vendorCategory, priority, status, dueDate, lastUpdateDate, lastUpdateRemarks, hours, time, goal, photos, pdf) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare vendor task insert.'], 500);
                $stmt->bind_param('issssssssssssssssdssss', $id, $date, $title, $description, $project, $firm, $category, $owner, $assignees, $vendor, $vendorCategory, $priority, $status, $dueDate, $lastUpdateDate, $lastUpdateRemarks, $hours, $time, $goal, $photos, $pdf);
            }
        }

	        $ok = $stmt->execute();
	        $stmtError = $stmt->error;
	        $stmt->close();
	        if (!$ok) sendJson(['success' => false, 'error' => 'Failed to add task: ' . $stmtError], 400);

          // Notifications (non-blocking): enqueue after successful write.
          try {
	              $taskRow = [
	                  'title' => $title,
	                  'notes' => $description,
	                  'firm' => $firm,
	                  'project' => $project,
	                  'client' => $client,
	                  'category' => $category,
	                  'owner' => $owner,
	                  'assignees' => $assignees,
	                  'priority' => $priority,
	                  'status' => $status,
	                  'dueDate' => $dueDate,
	                  'time' => $time,
	                  'goal' => $goal,
	                  'vendor' => $vendor,
	              ];
              notify_task_created($conn, $taskRow, $table === 'vendor_tasks' || trim($vendor) !== '');
          } catch (Throwable $e) {
              // Never break the main flow.
          }

	        sendJson(['success' => true, 'data' => ['id' => $id]]);
	    }

    if ($action === 'addMaster' && $table === 'clients') {
        $name = trim((string)($data['name'] ?? ''));
        $email = trim((string)($data['email'] ?? ''));
        $mobile = trim((string)($data['mobile'] ?? ''));
        $address = trim((string)($data['address'] ?? ''));
        $gstNumber = trim((string)($data['gSTNumber'] ?? $data['gstNumber'] ?? ''));
        if ($name === '') sendJson(['success' => false, 'error' => 'Client name is required.'], 400);

        if (app_table_is_scoped($conn, 'clients')) {
            $tenantId = app_tenant_id();
            $stmt = $conn->prepare("INSERT INTO clients (tenant_id, name, email, mobile, address, gstNumber) VALUES (?, ?, ?, ?, ?, ?)");
            if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare client insert.'], 500);
            $stmt->bind_param('isssss', $tenantId, $name, $email, $mobile, $address, $gstNumber);
        } else {
            $stmt = $conn->prepare("INSERT INTO clients (name, email, mobile, address, gstNumber) VALUES (?, ?, ?, ?, ?)");
            if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare client insert.'], 500);
            $stmt->bind_param('sssss', $name, $email, $mobile, $address, $gstNumber);
        }
        $ok = $stmt->execute();
        $insertId = (int)$stmt->insert_id;
        $stmt->close();
        if (!$ok) sendJson(['success' => false, 'error' => 'Failed to add client.'], 400);
        sendJson(['success' => true, 'data' => ['id' => $insertId]]);
    }

    if ($action === 'addMaster' && $table === 'vendors') {
        $name = trim((string)($data['name'] ?? ''));
        $email = trim((string)($data['email'] ?? ''));
        $mobile = trim((string)($data['mobile'] ?? ''));
        $address = trim((string)($data['address'] ?? ''));
        $gstNumber = trim((string)($data['gSTNumber'] ?? $data['gstNumber'] ?? ''));
        if ($name === '') sendJson(['success' => false, 'error' => 'Vendor name is required.'], 400);

        if (app_table_is_scoped($conn, 'vendors')) {
            $tenantId = app_tenant_id();
            $stmt = $conn->prepare("INSERT INTO vendors (tenant_id, name, email, mobile, address, gstNumber) VALUES (?, ?, ?, ?, ?, ?)");
            if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare vendor insert.'], 500);
            $stmt->bind_param('isssss', $tenantId, $name, $email, $mobile, $address, $gstNumber);
        } else {
            $stmt = $conn->prepare("INSERT INTO vendors (name, email, mobile, address, gstNumber) VALUES (?, ?, ?, ?, ?)");
            if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare vendor insert.'], 500);
            $stmt->bind_param('sssss', $name, $email, $mobile, $address, $gstNumber);
        }
        $ok = $stmt->execute();
        $insertId = (int)$stmt->insert_id;
        $stmt->close();
        if (!$ok) sendJson(['success' => false, 'error' => 'Failed to add vendor.'], 400);
        sendJson(['success' => true, 'data' => ['id' => $insertId]]);
    }

    if ($action === 'addMaster' && $table === 'projects') {
        $name = trim((string)($data['name'] ?? ''));
        $client = trim((string)($data['client'] ?? ''));
        $projectType = trim((string)($data['projectType'] ?? ''));
        $status = trim((string)($data['status'] ?? 'Active'));
        if ($name === '') sendJson(['success' => false, 'error' => 'Project name is required.'], 400);

        if (app_table_is_scoped($conn, 'projects')) {
            $tenantId = app_tenant_id();
            $stmt = $conn->prepare("INSERT INTO projects (tenant_id, name, client, projectType, status) VALUES (?, ?, ?, ?, ?)");
            if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare project insert.'], 500);
            $stmt->bind_param('issss', $tenantId, $name, $client, $projectType, $status);
        } else {
            $stmt = $conn->prepare("INSERT INTO projects (name, client, projectType, status) VALUES (?, ?, ?, ?)");
            if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare project insert.'], 500);
            $stmt->bind_param('ssss', $name, $client, $projectType, $status);
        }
        $ok = $stmt->execute();
        $insertId = (int)$stmt->insert_id;
        $stmt->close();
        if (!$ok) sendJson(['success' => false, 'error' => 'Failed to add project.'], 400);
        sendJson(['success' => true, 'data' => ['id' => $insertId]]);
    }

    if ($action === 'addMaster' && $table === 'categories') {
        $name = trim((string)($data['name'] ?? ''));
        $type = trim((string)($data['type'] ?? ''));
        if ($name === '') sendJson(['success' => false, 'error' => 'Category name is required.'], 400);
        if (scoped_name_exists($conn, 'categories', $name)) sendJson(['success' => false, 'error' => 'This category already exists in this organization.'], 400);
        if (app_table_is_scoped($conn, 'categories')) {
            $tenantId = app_tenant_id();
            $stmt = $conn->prepare("INSERT INTO categories (tenant_id, name, type) VALUES (?, ?, ?)");
            if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare category insert.'], 500);
            $stmt->bind_param('iss', $tenantId, $name, $type);
        } else {
            $stmt = $conn->prepare("INSERT INTO categories (name, type) VALUES (?, ?)");
            if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare category insert.'], 500);
            $stmt->bind_param('ss', $name, $type);
        }
        $ok = $stmt->execute();
        $insertId = (int)$stmt->insert_id;
        $stmtError = $stmt->error;
        $stmt->close();
        if (!$ok) sendJson(['success' => false, 'error' => 'Failed to add category: ' . $stmtError], 400);
        sendJson(['success' => true, 'data' => ['id' => $insertId]]);
    }

    if ($action === 'addMaster' && $table === 'status_master') {
        ensure_default_statuses($conn);
        $name = trim((string)($data['name'] ?? ''));
        if ($name === '') sendJson(['success' => false, 'error' => 'Status name is required.'], 400);
        if (in_array(strtolower($name), ['in progress', 'completed'], true)) {
            sendJson(['success' => false, 'error' => 'Default status already exists and is locked.'], 400);
        }
        if (scoped_name_exists($conn, 'status_master', $name)) sendJson(['success' => false, 'error' => 'This status already exists in this organization.'], 400);
        if (app_table_is_scoped($conn, 'status_master')) {
            $tenantId = app_tenant_id();
            $stmt = $conn->prepare("INSERT INTO status_master (tenant_id, name, is_system) VALUES (?, ?, 0)");
            if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare status insert.'], 500);
            $stmt->bind_param('is', $tenantId, $name);
        } else {
            $stmt = $conn->prepare("INSERT INTO status_master (name, is_system) VALUES (?, 0)");
            if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare status insert.'], 500);
            $stmt->bind_param('s', $name);
        }
        $ok = $stmt->execute();
        $insertId = (int)$stmt->insert_id;
        $stmt->close();
        if (!$ok) sendJson(['success' => false, 'error' => 'Failed to add status.'], 400);
        sendJson(['success' => true, 'data' => ['id' => $insertId]]);
    }

    if ($action === 'addMaster' && $table === 'firms') {
        $name = trim((string)($data['name'] ?? ''));
        $sortName = trim((string)($data['sortName'] ?? $data['sortname'] ?? ''));
        if ($name === '') sendJson(['success' => false, 'error' => 'Client name is required.'], 400);
        if (scoped_name_exists($conn, 'firms', $name)) sendJson(['success' => false, 'error' => 'This client already exists in this organization.'], 400);
        if (app_table_is_scoped($conn, 'firms')) {
            $tenantId = app_tenant_id();
            $stmt = $conn->prepare("INSERT INTO firms (tenant_id, name, sortName) VALUES (?, ?, ?)");
            if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare firm insert.'], 500);
            $stmt->bind_param('iss', $tenantId, $name, $sortName);
        } else {
            $stmt = $conn->prepare("INSERT INTO firms (name, sortName) VALUES (?, ?)");
            if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare firm insert.'], 500);
            $stmt->bind_param('ss', $name, $sortName);
        }
        $ok = $stmt->execute();
        $insertId = (int)$stmt->insert_id;
        $stmt->close();
        if (!$ok) sendJson(['success' => false, 'error' => 'Failed to add firm.'], 400);
        sendJson(['success' => true, 'data' => ['id' => $insertId]]);
    }

    if ($action === 'addMaster' && $table === 'vendor_categories') {
        $name = trim((string)($data['name'] ?? ''));
        if ($name === '') sendJson(['success' => false, 'error' => 'Vendor category name is required.'], 400);
        if (scoped_name_exists($conn, 'vendor_categories', $name)) sendJson(['success' => false, 'error' => 'This vendor category already exists in this organization.'], 400);
        if (app_table_is_scoped($conn, 'vendor_categories')) {
            $tenantId = app_tenant_id();
            $stmt = $conn->prepare("INSERT INTO vendor_categories (tenant_id, name) VALUES (?, ?)");
            if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare vendor category insert.'], 500);
            $stmt->bind_param('is', $tenantId, $name);
        } else {
            $stmt = $conn->prepare("INSERT INTO vendor_categories (name) VALUES (?)");
            if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare vendor category insert.'], 500);
            $stmt->bind_param('s', $name);
        }
        $ok = $stmt->execute();
        $insertId = (int)$stmt->insert_id;
        $stmt->close();
        if (!$ok) sendJson(['success' => false, 'error' => 'Failed to add vendor category.'], 400);
        sendJson(['success' => true, 'data' => ['id' => $insertId]]);
    }

    if ($action === 'addMaster' && $table === 'designations') {
        $name = trim((string)($data['name'] ?? ''));
        if ($name === '') sendJson(['success' => false, 'error' => 'Designation name is required.'], 400);
        if (scoped_name_exists($conn, 'designations', $name)) sendJson(['success' => false, 'error' => 'This designation already exists in this organization.'], 400);
        if (app_table_is_scoped($conn, 'designations')) {
            $tenantId = app_tenant_id();
            $stmt = $conn->prepare("INSERT INTO designations (tenant_id, name) VALUES (?, ?)");
            if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare designation insert.'], 500);
            $stmt->bind_param('is', $tenantId, $name);
        } else {
            $stmt = $conn->prepare("INSERT INTO designations (name) VALUES (?)");
            if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare designation insert.'], 500);
            $stmt->bind_param('s', $name);
        }
        $ok = $stmt->execute();
        $stmtError = $stmt->error;
        $insertId = (int)$stmt->insert_id;
        $stmt->close();
        if (!$ok) sendJson(['success' => false, 'error' => $stmtError !== '' ? $stmtError : 'Failed to add designation.'], 400);
        sendJson(['success' => true, 'data' => ['id' => $insertId]]);
    }

    if ($action === 'addMaster' && $table === 'departments') {
        $name = trim((string)($data['name'] ?? ''));
        if ($name === '') sendJson(['success' => false, 'error' => 'Department name is required.'], 400);
        if (scoped_name_exists($conn, 'departments', $name)) sendJson(['success' => false, 'error' => 'This department already exists in this organization.'], 400);
        if (app_table_is_scoped($conn, 'departments')) {
            $tenantId = app_tenant_id();
            $stmt = $conn->prepare("INSERT INTO departments (tenant_id, name) VALUES (?, ?)");
            if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare department insert.'], 500);
            $stmt->bind_param('is', $tenantId, $name);
        } else {
            $stmt = $conn->prepare("INSERT INTO departments (name) VALUES (?)");
            if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare department insert.'], 500);
            $stmt->bind_param('s', $name);
        }
        $ok = $stmt->execute();
        $insertId = (int)$stmt->insert_id;
        $stmt->close();
        if (!$ok) sendJson(['success' => false, 'error' => 'Failed to add department.'], 400);
        sendJson(['success' => true, 'data' => ['id' => $insertId]]);
    }

    if ($action === 'addMaster' && $table === 'recurring_tasks') {
        $id = (int)($data['id'] ?? 0);
        if ($id <= 0) {
            $id = (int)round(microtime(true) * 1000);
        }

        $title = trim((string)($data['title'] ?? ''));
        $notes = trim((string)($data['notes'] ?? ''));
        $firm = trim((string)($data['firm'] ?? ''));
        $owner = trim((string)($data['owner'] ?? ''));
        $category = trim((string)($data['category'] ?? ''));
        $assignee = trim((string)($data['assignee'] ?? ''));
        $frequencyType = trim((string)($data['frequencyType'] ?? $data['periodicity'] ?? 'Fixed Days'));
        $frequencyDays = (int)($data['frequencyDays'] ?? 0);
        $recurrenceDay = (int)($data['recurrenceDay'] ?? 0);
        $recurrenceMonth = trim((string)($data['recurrenceMonth'] ?? ''));
        $startDate = trim((string)($data['startDate'] ?? ''));
        $time = trim((string)($data['time'] ?? ''));
        $goal = normalizeNumericGoal($data['goal'] ?? '');
        $status = trim((string)($data['status'] ?? 'Not Yet Started'));

        if ($title === '') sendJson(['success' => false, 'error' => 'Recurring task title is required.'], 400);

        $supportsRecurrenceExtras = hasColumn($conn, 'recurring_tasks', 'recurrenceDay') && hasColumn($conn, 'recurring_tasks', 'recurrenceMonth');
        $idStr = (string)$id;
        if ($supportsRecurrenceExtras) {
            if (app_table_is_scoped($conn, 'recurring_tasks')) {
                $tenantId = app_tenant_id();
                $stmt = $conn->prepare("INSERT INTO recurring_tasks (tenant_id, id, title, notes, firm, owner, category, assignee, frequencyType, frequencyDays, recurrenceDay, recurrenceMonth, startDate, time, goal, status, lastUpdatedOn, lastUpdateRemarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '')");
                if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare recurring task insert.'], 500);
                $stmt->bind_param('issssssssiisssss', $tenantId, $idStr, $title, $notes, $firm, $owner, $category, $assignee, $frequencyType, $frequencyDays, $recurrenceDay, $recurrenceMonth, $startDate, $time, $goal, $status);
            } else {
                $stmt = $conn->prepare("INSERT INTO recurring_tasks (id, title, notes, firm, owner, category, assignee, frequencyType, frequencyDays, recurrenceDay, recurrenceMonth, startDate, time, goal, status, lastUpdatedOn, lastUpdateRemarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '')");
                if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare recurring task insert.'], 500);
                $stmt->bind_param('ssssssssiisssss', $idStr, $title, $notes, $firm, $owner, $category, $assignee, $frequencyType, $frequencyDays, $recurrenceDay, $recurrenceMonth, $startDate, $time, $goal, $status);
            }
        } else {
            if (in_array($frequencyType, ['Monthly', 'Yearly'], true) && $recurrenceDay > 0) {
                $frequencyDays = $recurrenceDay;
            }
            if (app_table_is_scoped($conn, 'recurring_tasks')) {
                $tenantId = app_tenant_id();
                $stmt = $conn->prepare("INSERT INTO recurring_tasks (tenant_id, id, title, notes, firm, owner, category, assignee, frequencyType, frequencyDays, startDate, time, goal, status, lastUpdatedOn, lastUpdateRemarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '')");
                if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare recurring task insert.'], 500);
                $stmt->bind_param('issssssssissss', $tenantId, $idStr, $title, $notes, $firm, $owner, $category, $assignee, $frequencyType, $frequencyDays, $startDate, $time, $goal, $status);
            } else {
                $stmt = $conn->prepare("INSERT INTO recurring_tasks (id, title, notes, firm, owner, category, assignee, frequencyType, frequencyDays, startDate, time, goal, status, lastUpdatedOn, lastUpdateRemarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '')");
                if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare recurring task insert.'], 500);
                $stmt->bind_param('ssssssssissss', $idStr, $title, $notes, $firm, $owner, $category, $assignee, $frequencyType, $frequencyDays, $startDate, $time, $goal, $status);
            }
        }
	        $ok = $stmt->execute();
	        $stmtError = $stmt->error;
	        $stmt->close();
	        if (!$ok) sendJson(['success' => false, 'error' => 'Failed to add recurring task: ' . $stmtError], 400);

          try {
              notify_recurring_created($conn, [
                  'title' => $title,
                  'firm' => $firm,
                  'owner' => $owner,
                  'category' => $category,
                  'assignee' => $assignee,
                  'frequencyType' => $frequencyType,
                  'frequencyDays' => $frequencyDays,
                  'startDate' => $startDate,
                  'time' => $time,
                  'goal' => $goal,
                  'status' => $status,
              ]);
          } catch (Throwable $e) {
          }

	        sendJson(['success' => true, 'data' => ['id' => $id]]);
	    }

    if ($action === 'addMaster' && $table === 'recurring_actions') {
        $id = (int)($data['id'] ?? 0);
        if ($id <= 0) {
            $id = (int)round(microtime(true) * 1000);
        }

        $taskId = (int)($data['taskId'] ?? $data['taskID'] ?? 0);
        $taskTitle = trim((string)($data['taskTitle'] ?? ''));
        $firm = trim((string)($data['firm'] ?? ''));
        $owner = trim((string)($data['owner'] ?? ''));
        $category = trim((string)($data['category'] ?? ''));
        $assignee = trim((string)($data['assignee'] ?? ''));
        $status = trim((string)($data['status'] ?? ''));
        $remarks = trim((string)($data['remarks'] ?? ''));
        $goal = normalizeNumericGoal($data['goal'] ?? '');
        $photos = (string)($data['photos'] ?? '');
        $pdf = (string)($data['pdf'] ?? '');
        $updatedOn = trim((string)($data['updatedOn'] ?? ''));
        $timestamp = trim((string)($data['timestamp'] ?? ''));

        if ($taskId <= 0) sendJson(['success' => false, 'error' => 'Invalid recurring task id.'], 400);

        $idStr = (string)$id;
        $taskIdStr = (string)$taskId;
        if (app_table_is_scoped($conn, 'recurring_actions')) {
            $tenantId = app_tenant_id();
            $stmt = $conn->prepare("INSERT INTO recurring_actions (tenant_id, id, taskId, taskTitle, firm, owner, category, assignee, status, remarks, goal, photos, pdf, updatedOn, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare recurring action insert.'], 500);
            $stmt->bind_param('issssssssssssss', $tenantId, $idStr, $taskIdStr, $taskTitle, $firm, $owner, $category, $assignee, $status, $remarks, $goal, $photos, $pdf, $updatedOn, $timestamp);
        } else {
            $stmt = $conn->prepare("INSERT INTO recurring_actions (id, taskId, taskTitle, firm, owner, category, assignee, status, remarks, goal, photos, pdf, updatedOn, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare recurring action insert.'], 500);
            $stmt->bind_param('ssssssssssssss', $idStr, $taskIdStr, $taskTitle, $firm, $owner, $category, $assignee, $status, $remarks, $goal, $photos, $pdf, $updatedOn, $timestamp);
        }
	        $ok = $stmt->execute();
	        $stmtError = $stmt->error;
	        $stmt->close();
	        if (!$ok) sendJson(['success' => false, 'error' => 'Failed to add recurring action: ' . $stmtError], 400);

          try {
              notify_recurring_action($conn, [
                  'taskTitle' => $taskTitle,
                  'firm' => $firm,
                  'owner' => $owner,
                  'category' => $category,
                  'assignee' => $assignee,
                  'status' => $status,
                  'remarks' => $remarks,
                  'goal' => $goal,
                  'updatedOn' => $updatedOn,
                  'timestamp' => $timestamp,
              ]);
          } catch (Throwable $e) {
          }

	        sendJson(['success' => true, 'data' => ['id' => $id]]);
	    }

    if ($action === 'deleteMaster') {
        $id = $data['id'] ?? 0;
        $stmt = $conn->prepare("DELETE FROM `{$table}` WHERE id=?" . (app_table_is_scoped($conn, $table) ? " AND tenant_id = " . app_tenant_id() : ''));
        $stmt->bind_param('s', $id);
        $ok = $stmt->execute();
        $stmt->close();
        if (!$ok) sendJson(['success' => false, 'error' => 'Failed to delete.'], 400);
        sendJson(['success' => true]);
    }

    if ($action === 'updateMaster' && $table === 'users') {
        $id = (int)($data['id'] ?? 0);
        if ($id <= 0) {
            sendJson(['success' => false, 'error' => 'Invalid user id.'], 400);
        }

        $name = trim((string)($data['name'] ?? ''));
        $email = trim((string)($data['email'] ?? ''));
        $employee_id = trim((string)($data['employeeId'] ?? $data['employee_id'] ?? ''));
        $mobile = trim((string)($data['mobile'] ?? ''));
        $role = trim((string)($data['role'] ?? 'Employee'));
        $designation = trim((string)($data['designation'] ?? ''));
        $department = trim((string)($data['department'] ?? ''));
        $telegram_user_name = trim((string)($data['telegramUserName'] ?? $data['telegram_user_name'] ?? ''));
        $password = app_normalize_password_for_storage((string)($data['password'] ?? ''));
        $isActiveRaw = strtolower((string)($data['isActive'] ?? 'true'));
        $isActive = in_array($isActiveRaw, ['1', 'true', 'yes'], true) ? 1 : 0;

        if ($password !== '') {
            $stmt = $conn->prepare(
                "UPDATE users SET name=?, email=?, employee_id=?, mobile=?, role=?, designation=?, department=?, telegram_user_name=?, password=?, isActive=? WHERE id=?" . (app_table_is_scoped($conn, 'users') ? " AND tenant_id = " . app_tenant_id() : '')
            );
            if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare update query.'], 500);
            $stmt->bind_param('sssssssssii', $name, $email, $employee_id, $mobile, $role, $designation, $department, $telegram_user_name, $password, $isActive, $id);
        } else {
            $stmt = $conn->prepare(
                "UPDATE users SET name=?, email=?, employee_id=?, mobile=?, role=?, designation=?, department=?, telegram_user_name=?, isActive=? WHERE id=?" . (app_table_is_scoped($conn, 'users') ? " AND tenant_id = " . app_tenant_id() : '')
            );
            if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare update query.'], 500);
            $stmt->bind_param('ssssssssii', $name, $email, $employee_id, $mobile, $role, $designation, $department, $telegram_user_name, $isActive, $id);
        }

        $ok = $stmt->execute();
        $stmt->close();
        if (!$ok) {
            sendJson(['success' => false, 'error' => 'Failed to update user.'], 400);
        }
        sendJson(['success' => true]);
    }

	    if ($action === 'updateMaster' && $table === 'app_settings') {
	        $officeTokenId = trim((string)($data['officeTokenId'] ?? ''));
	        $officeTelegramGroupId = trim((string)($data['officeTelegramGroupId'] ?? ''));
	        $whatsappGroupId = trim((string)($data['whatsappGroupId'] ?? ''));
	        $masId = trim((string)($data['masId'] ?? ''));
	        $masPassword = (string)($data['masPassword'] ?? '');
	        $metaAccessToken = trim((string)($data['metaAccessToken'] ?? ''));
	        $metaPhoneNumberId = trim((string)($data['metaPhoneNumberId'] ?? ''));
	        $metaWabaId = trim((string)($data['metaWabaId'] ?? ''));
	        $metaVerifyToken = trim((string)($data['metaVerifyToken'] ?? ''));

	        $viewLabelOverridesRaw = $data['viewLabelOverrides'] ?? '{}';
	        $fieldLabelOverridesRaw = $data['fieldLabelOverrides'] ?? '{}';
	        $viewLabelOverrides = is_array($viewLabelOverridesRaw) ? json_encode($viewLabelOverridesRaw, JSON_UNESCAPED_UNICODE) : trim((string)$viewLabelOverridesRaw);
	        $fieldLabelOverrides = is_array($fieldLabelOverridesRaw) ? json_encode($fieldLabelOverridesRaw, JSON_UNESCAPED_UNICODE) : trim((string)$fieldLabelOverridesRaw);
	        if ($viewLabelOverrides === '') $viewLabelOverrides = '{}';
	        if ($fieldLabelOverrides === '') $fieldLabelOverrides = '{}';
	        $hasLabelOverrides = trim($viewLabelOverrides) !== '{}' || trim($fieldLabelOverrides) !== '{}';

	        $existing = fetchAllRows($conn, 'app_settings');
	        $existingId = isset($existing[0]['id']) ? (int)$existing[0]['id'] : 0;
            $settingsScoped = app_table_is_scoped($conn, 'app_settings');

	        if ($existingId > 0) {
	            $stmt = $conn->prepare("UPDATE app_settings SET officeTokenId=?, officeTelegramGroupId=?, whatsappGroupId=?, masId=?, masPassword=?, metaAccessToken=?, metaPhoneNumberId=?, metaWabaId=?, metaVerifyToken=?, viewLabelOverrides=?, fieldLabelOverrides=?, updated_at=NOW() WHERE id=?" . ($settingsScoped ? " AND tenant_id = " . app_tenant_id() : ''));
	            if ($stmt) {
	                $stmt->bind_param('sssssssssssi', $officeTokenId, $officeTelegramGroupId, $whatsappGroupId, $masId, $masPassword, $metaAccessToken, $metaPhoneNumberId, $metaWabaId, $metaVerifyToken, $viewLabelOverrides, $fieldLabelOverrides, $existingId);
	            } else {
	                if ($hasLabelOverrides) {
	                    sendJson([
	                        'success' => false,
	                        'error' => 'Display-name overrides could not be saved because the database schema is missing columns. Please run: ALTER TABLE app_settings ADD COLUMN viewLabelOverrides TEXT, ADD COLUMN fieldLabelOverrides TEXT;'
	                    ], 400);
	                }
	                // Backward compatible with older schemas where override columns don't exist.
	                $stmt = $conn->prepare("UPDATE app_settings SET officeTokenId=?, officeTelegramGroupId=?, whatsappGroupId=?, masId=?, masPassword=?, metaAccessToken=?, metaPhoneNumberId=?, metaWabaId=?, metaVerifyToken=?, updated_at=NOW() WHERE id=?" . ($settingsScoped ? " AND tenant_id = " . app_tenant_id() : ''));
	                if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare settings update query.'], 500);
	                $stmt->bind_param('sssssssssi', $officeTokenId, $officeTelegramGroupId, $whatsappGroupId, $masId, $masPassword, $metaAccessToken, $metaPhoneNumberId, $metaWabaId, $metaVerifyToken, $existingId);
	            }
	        } else {
	            if ($settingsScoped) {
                    $tenantId = app_tenant_id();
	                $stmt = $conn->prepare("INSERT INTO app_settings (tenant_id, officeTokenId, officeTelegramGroupId, whatsappGroupId, masId, masPassword, metaAccessToken, metaPhoneNumberId, metaWabaId, metaVerifyToken, viewLabelOverrides, fieldLabelOverrides, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())");
	                if ($stmt) {
	                    $stmt->bind_param('isssssssssss', $tenantId, $officeTokenId, $officeTelegramGroupId, $whatsappGroupId, $masId, $masPassword, $metaAccessToken, $metaPhoneNumberId, $metaWabaId, $metaVerifyToken, $viewLabelOverrides, $fieldLabelOverrides);
	                } else {
	                    if ($hasLabelOverrides) {
	                        sendJson([
	                            'success' => false,
	                            'error' => 'Display-name overrides could not be saved because the database schema is missing columns. Please run: ALTER TABLE app_settings ADD COLUMN viewLabelOverrides TEXT, ADD COLUMN fieldLabelOverrides TEXT;'
	                        ], 400);
	                    }
	                    $stmt = $conn->prepare("INSERT INTO app_settings (tenant_id, officeTokenId, officeTelegramGroupId, whatsappGroupId, masId, masPassword, metaAccessToken, metaPhoneNumberId, metaWabaId, metaVerifyToken, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())");
	                    if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare settings insert query.'], 500);
	                    $stmt->bind_param('issssssssss', $tenantId, $officeTokenId, $officeTelegramGroupId, $whatsappGroupId, $masId, $masPassword, $metaAccessToken, $metaPhoneNumberId, $metaWabaId, $metaVerifyToken);
	                }
                } else {
	                $insertId = 1;
	                $stmt = $conn->prepare("INSERT INTO app_settings (id, officeTokenId, officeTelegramGroupId, whatsappGroupId, masId, masPassword, metaAccessToken, metaPhoneNumberId, metaWabaId, metaVerifyToken, viewLabelOverrides, fieldLabelOverrides, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())");
	                if ($stmt) {
	                    $stmt->bind_param('isssssssssss', $insertId, $officeTokenId, $officeTelegramGroupId, $whatsappGroupId, $masId, $masPassword, $metaAccessToken, $metaPhoneNumberId, $metaWabaId, $metaVerifyToken, $viewLabelOverrides, $fieldLabelOverrides);
	                } else {
	                if ($hasLabelOverrides) {
	                    sendJson([
	                        'success' => false,
	                        'error' => 'Display-name overrides could not be saved because the database schema is missing columns. Please run: ALTER TABLE app_settings ADD COLUMN viewLabelOverrides TEXT, ADD COLUMN fieldLabelOverrides TEXT;'
	                    ], 400);
	                }
	                // Backward compatible with older schemas where override columns don't exist.
	                    $stmt = $conn->prepare("INSERT INTO app_settings (id, officeTokenId, officeTelegramGroupId, whatsappGroupId, masId, masPassword, metaAccessToken, metaPhoneNumberId, metaWabaId, metaVerifyToken, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())");
	                    if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare settings insert query.'], 500);
	                    $stmt->bind_param('isssssssss', $insertId, $officeTokenId, $officeTelegramGroupId, $whatsappGroupId, $masId, $masPassword, $metaAccessToken, $metaPhoneNumberId, $metaWabaId, $metaVerifyToken);
	                }
                }
	        }

        $ok = $stmt->execute();
        $stmtError = $stmt->error;
        $stmt->close();
        if (!$ok) {
            sendJson(['success' => false, 'error' => 'Failed to save settings: ' . $stmtError], 400);
        }
        sendJson(['success' => true]);
    }

	    if ($action === 'updateTask' && in_array($table, ['main_tasks', 'vendor_tasks'], true)) {
	        $id = (int)($data['id'] ?? 0);
	        if ($id <= 0) sendJson(['success' => false, 'error' => 'Invalid task id.'], 400);

	        // Preserve the original (master) attachments on the task record.
	        // Updates to goal/photos/pdf should be stored only in action_logs.
	        $existingStmt = $conn->prepare("SELECT goal, photos, pdf FROM `{$table}` WHERE id=?" . (app_table_is_scoped($conn, $table) ? " AND tenant_id = " . app_tenant_id() : '') . " LIMIT 1");
	        if (!$existingStmt) sendJson(['success' => false, 'error' => 'Failed to prepare task lookup.'], 500);
	        $existingStmt->bind_param('i', $id);
	        $existingStmt->execute();
	        $existingRes = $existingStmt->get_result();
	        $existingRow = $existingRes ? $existingRes->fetch_assoc() : null;
	        $existingStmt->close();
	        if (!$existingRow) sendJson(['success' => false, 'error' => 'Task not found.'], 404);

	        $title = trim((string)($data['title'] ?? $data['task'] ?? ''));
	        $description = (string)($data['notes'] ?? $data['description'] ?? '');
        $project = (string)($data['project'] ?? '');
        $firm = (string)($data['firm'] ?? '');
        $category = (string)($data['category'] ?? '');
	        $owner = (string)($data['owner'] ?? '');
	        $assignees = (string)($data['assignees'] ?? '');
	        $priority = (string)($data['priority'] ?? 'Medium');
	        $status = (string)($data['status'] ?? 'Not Yet Started');
	        $dueDate = (string)($data['due Date'] ?? $data['dueDate'] ?? '');
	        $lastUpdateDate = (string)($data['lastUpdateDate'] ?? $data['last Update'] ?? '');
	        $lastUpdateRemarks = (string)($data['remark'] ?? $data['lastUpdateRemarks'] ?? '');
	        $hours = (float)($data['hours'] ?? 0);
	        $time = (string)($data['time'] ?? '');
	        $logGoal = normalizeNumericGoal($data['goal'] ?? '');
	        $logPhotos = (string)($data['photos'] ?? '');
	        $logPdf = (string)($data['pdf'] ?? '');
	        $goal = normalizeNumericGoal($existingRow['goal'] ?? '');
	        $photos = (string)($existingRow['photos'] ?? '');
	        $pdf = (string)($existingRow['pdf'] ?? '');
	        $taskDate = (string)($data['taskDate'] ?? $data['date'] ?? '');
	        $client = (string)($data['clientName'] ?? $data['client'] ?? '');
	        $vendor = (string)($data['vendor'] ?? '');
	        $vendorCategory = (string)($data['vendorCategory'] ?? '');
	        $skipLogRaw = strtolower((string)($data['skipLog'] ?? 'false'));
	        $skipLog = in_array($skipLogRaw, ['1', 'true', 'yes'], true);

        if ($table === 'main_tasks') {
            $stmt = $conn->prepare("UPDATE main_tasks SET title=?, description=?, project=?, firm=?, category=?, owner=?, assignees=?, client=?, priority=?, status=?, dueDate=?, lastUpdateDate=?, lastUpdateRemarks=?, hours=?, time=?, goal=?, photos=?, pdf=? WHERE id=?" . (app_table_is_scoped($conn, 'main_tasks') ? " AND tenant_id = " . app_tenant_id() : ''));
            if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare main task update.'], 500);
            $stmt->bind_param('sssssssssssssdssssi', $title, $description, $project, $firm, $category, $owner, $assignees, $client, $priority, $status, $dueDate, $lastUpdateDate, $lastUpdateRemarks, $hours, $time, $goal, $photos, $pdf, $id);
        } else {
            $stmt = $conn->prepare("UPDATE vendor_tasks SET title=?, description=?, project=?, firm=?, category=?, owner=?, assignees=?, vendor=?, vendorCategory=?, priority=?, status=?, dueDate=?, lastUpdateDate=?, lastUpdateRemarks=?, hours=?, time=?, goal=?, photos=?, pdf=? WHERE id=?" . (app_table_is_scoped($conn, 'vendor_tasks') ? " AND tenant_id = " . app_tenant_id() : ''));
            if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare vendor task update.'], 500);
            $stmt->bind_param('ssssssssssssssdssssi', $title, $description, $project, $firm, $category, $owner, $assignees, $vendor, $vendorCategory, $priority, $status, $dueDate, $lastUpdateDate, $lastUpdateRemarks, $hours, $time, $goal, $photos, $pdf, $id);
        }

        $ok = $stmt->execute();
        $stmt->close();
	        if (!$ok) sendJson(['success' => false, 'error' => 'Failed to update task.'], 400);

		        if (!$skipLog && ($lastUpdateRemarks !== '' || $status !== 'Not Yet Started' || $hours > 0 || $logGoal !== '' || $logPhotos !== '' || $logPdf !== '')) {
		            $logId = (int)round(microtime(true) * 1000);
	            $updatedOn = '';
	            $timestamp = '';
	            if ($lastUpdateDate !== '') {
	                $dateTime = explode(' ', $lastUpdateDate, 2);
	                $updatedOn = $dateTime[0] ?? '';
	                $timestamp = $dateTime[1] ?? '';
	            }

            if (app_table_is_scoped($conn, 'action_logs')) {
                $tenantId = app_tenant_id();
                $logStmt = $conn->prepare("INSERT INTO action_logs (tenant_id, id, taskId, taskTitle, taskDate, updateDate, project, firm, client, category, owner, assignees, vendor, status, remarks, hours, time, goal, photos, pdf, updatedOn, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                if (!$logStmt) sendJson(['success' => false, 'error' => 'Failed to prepare action log insert.'], 500);
                $logStmt->bind_param('iiissssssssssssdssssss', $tenantId, $logId, $id, $title, $taskDate, $lastUpdateDate, $project, $firm, $client, $category, $owner, $assignees, $vendor, $status, $lastUpdateRemarks, $hours, $time, $logGoal, $logPhotos, $logPdf, $updatedOn, $timestamp);
            } else {
                $logStmt = $conn->prepare("INSERT INTO action_logs (id, taskId, taskTitle, taskDate, updateDate, project, firm, client, category, owner, assignees, vendor, status, remarks, hours, time, goal, photos, pdf, updatedOn, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                if (!$logStmt) sendJson(['success' => false, 'error' => 'Failed to prepare action log insert.'], 500);
                $logStmt->bind_param('iissssssssssssdssssss', $logId, $id, $title, $taskDate, $lastUpdateDate, $project, $firm, $client, $category, $owner, $assignees, $vendor, $status, $lastUpdateRemarks, $hours, $time, $logGoal, $logPhotos, $logPdf, $updatedOn, $timestamp);
            }
	            $logOk = $logStmt->execute();
	            $logError = $logStmt->error;
	            $logStmt->close();
		            if (!$logOk) sendJson(['success' => false, 'error' => 'Failed to add action log: ' . $logError], 400);
	        }

          // Notifications (non-blocking): enqueue after successful update.
          try {
              $taskRow = [
                  'title' => $title,
                  'notes' => $description,
                  'firm' => $firm,
                  'project' => $project,
                  'client' => $client,
                  'category' => $category,
                  'owner' => $owner,
                  'assignees' => $assignees,
                  'priority' => $priority,
                  'status' => $status,
                  'dueDate' => $dueDate,
                  'vendor' => $vendor,
                  'goal' => $goal,
              ];
              $logRow = [
                  'remarks' => $lastUpdateRemarks,
                  'minutes' => $hours,
                  'achieved' => $logGoal,
              ];
              notify_task_updated($conn, $taskRow, $logRow, $table === 'vendor_tasks' || trim($vendor) !== '');
          } catch (Throwable $e) {
          }

	        sendJson(['success' => true]);
	    }

    if ($action === 'updateMaster' && $table === 'clients') {
        $id = (int)($data['id'] ?? 0);
        if ($id <= 0) sendJson(['success' => false, 'error' => 'Invalid client id.'], 400);
        $name = trim((string)($data['name'] ?? ''));
        $email = trim((string)($data['email'] ?? ''));
        $mobile = trim((string)($data['mobile'] ?? ''));
        $address = trim((string)($data['address'] ?? ''));
        $gstNumber = trim((string)($data['gSTNumber'] ?? $data['gstNumber'] ?? ''));
        $stmt = $conn->prepare("UPDATE clients SET name=?, email=?, mobile=?, address=?, gstNumber=? WHERE id=?" . (app_table_is_scoped($conn, 'clients') ? " AND tenant_id = " . app_tenant_id() : ''));
        if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare client update.'], 500);
        $stmt->bind_param('sssssi', $name, $email, $mobile, $address, $gstNumber, $id);
        $ok = $stmt->execute();
        $stmt->close();
        if (!$ok) sendJson(['success' => false, 'error' => 'Failed to update client.'], 400);
        sendJson(['success' => true]);
    }

    if ($action === 'updateMaster' && $table === 'vendors') {
        $id = (int)($data['id'] ?? 0);
        if ($id <= 0) sendJson(['success' => false, 'error' => 'Invalid vendor id.'], 400);
        $name = trim((string)($data['name'] ?? ''));
        $email = trim((string)($data['email'] ?? ''));
        $mobile = trim((string)($data['mobile'] ?? ''));
        $address = trim((string)($data['address'] ?? ''));
        $gstNumber = trim((string)($data['gSTNumber'] ?? $data['gstNumber'] ?? ''));
        $stmt = $conn->prepare("UPDATE vendors SET name=?, email=?, mobile=?, address=?, gstNumber=? WHERE id=?" . (app_table_is_scoped($conn, 'vendors') ? " AND tenant_id = " . app_tenant_id() : ''));
        if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare vendor update.'], 500);
        $stmt->bind_param('sssssi', $name, $email, $mobile, $address, $gstNumber, $id);
        $ok = $stmt->execute();
        $stmt->close();
        if (!$ok) sendJson(['success' => false, 'error' => 'Failed to update vendor.'], 400);
        sendJson(['success' => true]);
    }

    if ($action === 'updateMaster' && $table === 'projects') {
        $id = (int)($data['id'] ?? 0);
        if ($id <= 0) sendJson(['success' => false, 'error' => 'Invalid project id.'], 400);
        $name = trim((string)($data['name'] ?? ''));
        $client = trim((string)($data['client'] ?? ''));
        $projectType = trim((string)($data['projectType'] ?? ''));
        $status = trim((string)($data['status'] ?? 'Active'));
        $stmt = $conn->prepare("UPDATE projects SET name=?, client=?, projectType=?, status=? WHERE id=?" . (app_table_is_scoped($conn, 'projects') ? " AND tenant_id = " . app_tenant_id() : ''));
        if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare project update.'], 500);
        $stmt->bind_param('ssssi', $name, $client, $projectType, $status, $id);
        $ok = $stmt->execute();
        $stmt->close();
        if (!$ok) sendJson(['success' => false, 'error' => 'Failed to update project.'], 400);
        sendJson(['success' => true]);
    }

    if ($action === 'updateMaster' && $table === 'categories') {
        $id = (int)($data['id'] ?? 0);
        if ($id <= 0) sendJson(['success' => false, 'error' => 'Invalid category id.'], 400);
        $name = trim((string)($data['name'] ?? ''));
        $type = trim((string)($data['type'] ?? ''));
        if ($name === '') sendJson(['success' => false, 'error' => 'Category name is required.'], 400);
        if (scoped_name_exists($conn, 'categories', $name, $id)) sendJson(['success' => false, 'error' => 'This category already exists in this organization.'], 400);
        $stmt = $conn->prepare("UPDATE categories SET name=?, type=? WHERE id=?" . (app_table_is_scoped($conn, 'categories') ? " AND tenant_id = " . app_tenant_id() : ''));
        if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare category update.'], 500);
        $stmt->bind_param('ssi', $name, $type, $id);
        $ok = $stmt->execute();
        $stmtError = $stmt->error;
        $stmt->close();
        if (!$ok) sendJson(['success' => false, 'error' => 'Failed to update category: ' . $stmtError], 400);
        sendJson(['success' => true]);
    }

    if ($action === 'updateMaster' && $table === 'status_master') {
        $id = (int)($data['id'] ?? 0);
        if ($id <= 0) sendJson(['success' => false, 'error' => 'Invalid status id.'], 400);
        $name = trim((string)($data['name'] ?? ''));
        if ($name === '') sendJson(['success' => false, 'error' => 'Status name is required.'], 400);
        $check = $conn->prepare("SELECT is_system, name FROM status_master WHERE id=?" . (app_table_is_scoped($conn, 'status_master') ? " AND tenant_id = " . app_tenant_id() : '') . " LIMIT 1");
        if (!$check) sendJson(['success' => false, 'error' => 'Failed to validate status.'], 500);
        $check->bind_param('i', $id);
        $check->execute();
        $row = $check->get_result()?->fetch_assoc();
        $check->close();
        if (!$row) sendJson(['success' => false, 'error' => 'Status not found.'], 404);
        if ((int)($row['is_system'] ?? 0) === 1 || in_array(strtolower(trim((string)($row['name'] ?? ''))), ['in progress', 'completed'], true)) {
            sendJson(['success' => false, 'error' => 'Default status cannot be updated.'], 400);
        }
        if (scoped_name_exists($conn, 'status_master', $name, $id)) sendJson(['success' => false, 'error' => 'This status already exists in this organization.'], 400);
        $stmt = $conn->prepare("UPDATE status_master SET name=? WHERE id=?" . (app_table_is_scoped($conn, 'status_master') ? " AND tenant_id = " . app_tenant_id() : ''));
        if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare status update.'], 500);
        $stmt->bind_param('si', $name, $id);
        $ok = $stmt->execute();
        $stmt->close();
        if (!$ok) sendJson(['success' => false, 'error' => 'Failed to update status.'], 400);
        sendJson(['success' => true]);
    }

    if ($action === 'updateMaster' && $table === 'firms') {
        $id = (int)($data['id'] ?? 0);
        if ($id <= 0) sendJson(['success' => false, 'error' => 'Invalid firm id.'], 400);
        $name = trim((string)($data['name'] ?? ''));
        $sortName = trim((string)($data['sortName'] ?? $data['sortname'] ?? ''));
        if ($name === '') sendJson(['success' => false, 'error' => 'Client name is required.'], 400);
        if (scoped_name_exists($conn, 'firms', $name, $id)) sendJson(['success' => false, 'error' => 'This client already exists in this organization.'], 400);
        $stmt = $conn->prepare("UPDATE firms SET name=?, sortName=? WHERE id=?" . (app_table_is_scoped($conn, 'firms') ? " AND tenant_id = " . app_tenant_id() : ''));
        if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare firm update.'], 500);
        $stmt->bind_param('ssi', $name, $sortName, $id);
        $ok = $stmt->execute();
        $stmt->close();
        if (!$ok) sendJson(['success' => false, 'error' => 'Failed to update firm.'], 400);
        sendJson(['success' => true]);
    }

    if ($action === 'updateMaster' && $table === 'vendor_categories') {
        $id = (int)($data['id'] ?? 0);
        if ($id <= 0) sendJson(['success' => false, 'error' => 'Invalid vendor category id.'], 400);
        $name = trim((string)($data['name'] ?? ''));
        if (scoped_name_exists($conn, 'vendor_categories', $name, $id)) sendJson(['success' => false, 'error' => 'This vendor category already exists in this organization.'], 400);
        $stmt = $conn->prepare("UPDATE vendor_categories SET name=? WHERE id=?" . (app_table_is_scoped($conn, 'vendor_categories') ? " AND tenant_id = " . app_tenant_id() : ''));
        if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare vendor category update.'], 500);
        $stmt->bind_param('si', $name, $id);
        $ok = $stmt->execute();
        $stmt->close();
        if (!$ok) sendJson(['success' => false, 'error' => 'Failed to update vendor category.'], 400);
        sendJson(['success' => true]);
    }

    if ($action === 'updateMaster' && $table === 'designations') {
        $id = (int)($data['id'] ?? 0);
        if ($id <= 0) sendJson(['success' => false, 'error' => 'Invalid designation id.'], 400);
        $name = trim((string)($data['name'] ?? ''));
        if (scoped_name_exists($conn, 'designations', $name, $id)) sendJson(['success' => false, 'error' => 'This designation already exists in this organization.'], 400);
        $stmt = $conn->prepare("UPDATE designations SET name=? WHERE id=?" . (app_table_is_scoped($conn, 'designations') ? " AND tenant_id = " . app_tenant_id() : ''));
        if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare designation update.'], 500);
        $stmt->bind_param('si', $name, $id);
        $ok = $stmt->execute();
        $stmt->close();
        if (!$ok) sendJson(['success' => false, 'error' => 'Failed to update designation.'], 400);
        sendJson(['success' => true]);
    }

    if ($action === 'updateMaster' && $table === 'departments') {
        $id = (int)($data['id'] ?? 0);
        if ($id <= 0) sendJson(['success' => false, 'error' => 'Invalid department id.'], 400);
        $name = trim((string)($data['name'] ?? ''));
        if (scoped_name_exists($conn, 'departments', $name, $id)) sendJson(['success' => false, 'error' => 'This department already exists in this organization.'], 400);
        $stmt = $conn->prepare("UPDATE departments SET name=? WHERE id=?" . (app_table_is_scoped($conn, 'departments') ? " AND tenant_id = " . app_tenant_id() : ''));
        if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare department update.'], 500);
        $stmt->bind_param('si', $name, $id);
        $ok = $stmt->execute();
        $stmt->close();
        if (!$ok) sendJson(['success' => false, 'error' => 'Failed to update department.'], 400);
        sendJson(['success' => true]);
    }

    if ($action === 'updateMaster' && $table === 'recurring_tasks') {
        $id = (int)($data['id'] ?? 0);
        if ($id <= 0) sendJson(['success' => false, 'error' => 'Invalid recurring task id.'], 400);

        $stmt = $conn->prepare("SELECT * FROM recurring_tasks WHERE id=?" . (app_table_is_scoped($conn, 'recurring_tasks') ? " AND tenant_id = " . app_tenant_id() : '') . " LIMIT 1");
        if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare recurring task lookup.'], 500);
        $idStr = (string)$id;
        $stmt->bind_param('s', $idStr);
        $stmt->execute();
        $existing = $stmt->get_result();
        $row = $existing ? $existing->fetch_assoc() : null;
        $stmt->close();
        if (!$row) sendJson(['success' => false, 'error' => 'Recurring task not found.'], 404);

        $title = array_key_exists('title', $data) ? trim((string)$data['title']) : (string)($row['title'] ?? '');
        $notes = array_key_exists('notes', $data) ? trim((string)$data['notes']) : (string)($row['notes'] ?? '');
        $firm = array_key_exists('firm', $data) ? trim((string)$data['firm']) : (string)($row['firm'] ?? '');
        $owner = array_key_exists('owner', $data) ? trim((string)$data['owner']) : (string)($row['owner'] ?? '');
        $category = array_key_exists('category', $data) ? trim((string)$data['category']) : (string)($row['category'] ?? '');
        $assignee = array_key_exists('assignee', $data) ? trim((string)$data['assignee']) : (string)($row['assignee'] ?? '');
        $frequencyType = array_key_exists('frequencyType', $data) || array_key_exists('periodicity', $data)
            ? trim((string)($data['frequencyType'] ?? $data['periodicity'] ?? 'Fixed Days'))
            : (string)($row['frequencyType'] ?? 'Fixed Days');
        $frequencyDays = array_key_exists('frequencyDays', $data) ? (int)$data['frequencyDays'] : (int)($row['frequencyDays'] ?? 0);
        $recurrenceDay = array_key_exists('recurrenceDay', $data) ? (int)$data['recurrenceDay'] : (int)($row['recurrenceDay'] ?? 0);
        $recurrenceMonth = array_key_exists('recurrenceMonth', $data) ? trim((string)$data['recurrenceMonth']) : trim((string)($row['recurrenceMonth'] ?? ''));
        $startDate = array_key_exists('startDate', $data) ? trim((string)$data['startDate']) : (string)($row['startDate'] ?? '');
        $time = array_key_exists('time', $data) ? trim((string)$data['time']) : (string)($row['time'] ?? '');
        $goal = array_key_exists('goal', $data) ? normalizeNumericGoal($data['goal']) : normalizeNumericGoal($row['goal'] ?? '');
        $status = array_key_exists('status', $data) ? trim((string)$data['status']) : (string)($row['status'] ?? 'Not Yet Started');
        $lastUpdatedOn = array_key_exists('lastUpdatedOn', $data) ? trim((string)$data['lastUpdatedOn']) : (string)($row['lastUpdatedOn'] ?? '');
        $lastUpdateRemarks = array_key_exists('lastUpdateRemarks', $data) ? (string)$data['lastUpdateRemarks'] : (string)($row['lastUpdateRemarks'] ?? '');

        if ($title === '') sendJson(['success' => false, 'error' => 'Recurring task title is required.'], 400);

        $supportsRecurrenceExtras = hasColumn($conn, 'recurring_tasks', 'recurrenceDay') && hasColumn($conn, 'recurring_tasks', 'recurrenceMonth');
        if ($supportsRecurrenceExtras) {
            $stmt = $conn->prepare("UPDATE recurring_tasks SET title=?, notes=?, firm=?, owner=?, category=?, assignee=?, frequencyType=?, frequencyDays=?, recurrenceDay=?, recurrenceMonth=?, startDate=?, time=?, goal=?, status=?, lastUpdatedOn=?, lastUpdateRemarks=? WHERE id=?" . (app_table_is_scoped($conn, 'recurring_tasks') ? " AND tenant_id = " . app_tenant_id() : ''));
            if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare recurring task update.'], 500);
            $stmt->bind_param('sssssssiissssssss', $title, $notes, $firm, $owner, $category, $assignee, $frequencyType, $frequencyDays, $recurrenceDay, $recurrenceMonth, $startDate, $time, $goal, $status, $lastUpdatedOn, $lastUpdateRemarks, $idStr);
        } else {
            if (in_array($frequencyType, ['Monthly', 'Yearly'], true) && $recurrenceDay > 0) {
                $frequencyDays = $recurrenceDay;
            }
            $stmt = $conn->prepare("UPDATE recurring_tasks SET title=?, notes=?, firm=?, owner=?, category=?, assignee=?, frequencyType=?, frequencyDays=?, startDate=?, time=?, goal=?, status=?, lastUpdatedOn=?, lastUpdateRemarks=? WHERE id=?" . (app_table_is_scoped($conn, 'recurring_tasks') ? " AND tenant_id = " . app_tenant_id() : ''));
            if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare recurring task update.'], 500);
            $stmt->bind_param('sssssssisssssss', $title, $notes, $firm, $owner, $category, $assignee, $frequencyType, $frequencyDays, $startDate, $time, $goal, $status, $lastUpdatedOn, $lastUpdateRemarks, $idStr);
        }
        $ok = $stmt->execute();
        $stmtError = $stmt->error;
        $stmt->close();
        if (!$ok) sendJson(['success' => false, 'error' => 'Failed to update recurring task: ' . $stmtError], 400);
        sendJson(['success' => true]);
    }

    if ($action === 'deleteRecord' && $table === 'users') {
        $id = (int)($data['id'] ?? 0);
        if ($id <= 0) {
            sendJson(['success' => false, 'error' => 'Invalid user id.'], 400);
        }
        $stmt = $conn->prepare("DELETE FROM users WHERE id=?" . (app_table_is_scoped($conn, 'users') ? " AND tenant_id = " . app_tenant_id() : ''));
        if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare delete query.'], 500);
        $stmt->bind_param('i', $id);
        $ok = $stmt->execute();
        $stmt->close();
        if (!$ok) {
            sendJson(['success' => false, 'error' => 'Failed to delete user.'], 400);
        }
        sendJson(['success' => true]);
    }

    if ($action === 'deleteRecord' && in_array($table, ['main_tasks', 'vendor_tasks'], true)) {
        $id = (int)($data['id'] ?? 0);
        if ($id <= 0) sendJson(['success' => false, 'error' => 'Invalid task id.'], 400);
        $stmt = $conn->prepare("DELETE FROM `{$table}` WHERE id=?" . (app_table_is_scoped($conn, $table) ? " AND tenant_id = " . app_tenant_id() : ''));
        if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare task delete.'], 500);
        $stmt->bind_param('i', $id);
        $ok = $stmt->execute();
        $stmt->close();
        if (!$ok) sendJson(['success' => false, 'error' => 'Failed to delete task.'], 400);
        sendJson(['success' => true]);
    }

    if ($action === 'deleteRecord' && $table === 'action_logs') {
        $id = (int)($data['id'] ?? 0);
        if ($id <= 0) sendJson(['success' => false, 'error' => 'Invalid log id.'], 400);
        $stmt = $conn->prepare("DELETE FROM action_logs WHERE id=?" . (app_table_is_scoped($conn, 'action_logs') ? " AND tenant_id = " . app_tenant_id() : ''));
        if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare log delete.'], 500);
        $stmt->bind_param('i', $id);
        $ok = $stmt->execute();
        $stmt->close();
        if (!$ok) sendJson(['success' => false, 'error' => 'Failed to delete log.'], 400);
        sendJson(['success' => true]);
    }

    if ($action === 'deleteRecord' && in_array($table, ['recurring_tasks', 'recurring_actions'], true)) {
        $id = (int)($data['id'] ?? 0);
        if ($id <= 0) sendJson(['success' => false, 'error' => 'Invalid id.'], 400);
        $stmt = $conn->prepare("DELETE FROM `{$table}` WHERE id=?" . (app_table_is_scoped($conn, $table) ? " AND tenant_id = " . app_tenant_id() : ''));
        if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare delete query.'], 500);
        $idStr = (string)$id;
        $stmt->bind_param('s', $idStr);
        $ok = $stmt->execute();
        $stmt->close();
        if (!$ok) sendJson(['success' => false, 'error' => 'Failed to delete record.'], 400);
        sendJson(['success' => true]);
    }

    if ($action === 'deleteRecord' && in_array($table, ['clients', 'projects', 'firms', 'vendors', 'categories', 'vendor_categories', 'designations', 'departments', 'status_master'], true)) {
        $id = (int)($data['id'] ?? 0);
        if ($id <= 0) sendJson(['success' => false, 'error' => 'Invalid id.'], 400);
        if ($table === 'status_master') {
            $check = $conn->prepare("SELECT is_system, name FROM status_master WHERE id=?" . (app_table_is_scoped($conn, 'status_master') ? " AND tenant_id = " . app_tenant_id() : '') . " LIMIT 1");
            if (!$check) sendJson(['success' => false, 'error' => 'Failed to validate status.'], 500);
            $check->bind_param('i', $id);
            $check->execute();
            $row = $check->get_result()?->fetch_assoc();
            $check->close();
            if (!$row) sendJson(['success' => false, 'error' => 'Status not found.'], 404);
            if ((int)($row['is_system'] ?? 0) === 1 || in_array(strtolower(trim((string)($row['name'] ?? ''))), ['in progress', 'completed'], true)) {
                sendJson(['success' => false, 'error' => 'Default status cannot be deleted.'], 400);
            }
        }
        $stmt = $conn->prepare("DELETE FROM `{$table}` WHERE id=?" . (app_table_is_scoped($conn, $table) ? " AND tenant_id = " . app_tenant_id() : ''));
        if (!$stmt) sendJson(['success' => false, 'error' => 'Failed to prepare delete query.'], 500);
        $stmt->bind_param('i', $id);
        $ok = $stmt->execute();
        $stmt->close();
        if (!$ok) sendJson(['success' => false, 'error' => 'Failed to delete record.'], 400);
        sendJson(['success' => true]);
    }

    sendJson(['success' => false, 'error' => 'Unsupported action.'], 400);
}

sendJson(['success' => false, 'error' => 'Method not allowed.'], 405);
