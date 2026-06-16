<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

$input = app_get_raw_input_data();

$orgId = isset($input['orgId']) ? strtolower(trim((string)$input['orgId'])) : '';
$orgId = $orgId !== '' ? preg_replace('/[^a-z0-9_-]+/', '-', $orgId) : '';
$email = isset($input['email']) ? trim((string)$input['email']) : '';
$password = isset($input['password']) ? (string)$input['password'] : '';

if ($orgId === '' || $email === '' || $password === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Org Id, email and password are required.']);
    exit;
}

$resolvedTenantCode = app_tenant_code();
if ($resolvedTenantCode !== $orgId) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Invalid Org Id.']);
    exit;
}

$tenantStatus = strtolower(trim((string)($currentTenant['status'] ?? 'inactive')));
if ($tenantStatus !== 'active') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'This organization is inactive.']);
    exit;
}

if (app_is_platform_admin_credentials($platformConn, $email, $password)) {
    $platformAdminEmail = strtolower(trim($email));
    echo json_encode([
        'success' => true,
        'user' => [
            'id' => 0,
            'name' => 'BizSkill Platform Admin',
            'email' => $platformAdminEmail,
            'employeeId' => '',
            'role' => 'Admin',
            'designation' => 'Platform Admin',
            'department' => 'Platform',
            'telegramUserName' => '',
            'isActive' => true,
            'tenantId' => app_tenant_id(),
            'tenantCode' => $resolvedTenantCode,
            'tenantName' => app_tenant_name(),
            'isPlatformAdmin' => true,
            'platformAdminEmail' => $platformAdminEmail,
            'platformAdminToken' => app_issue_platform_admin_token($platformAdminEmail),
        ],
        'tenant' => [
            'id' => app_tenant_id(),
            'code' => $resolvedTenantCode,
            'name' => app_tenant_name(),
            'dbMode' => (string)($currentTenant['db_mode'] ?? 'shared'),
            'status' => (string)($currentTenant['status'] ?? 'active'),
        ]
    ]);
    exit;
}

$sql = "SELECT id, name, email, role, designation, department, employee_id, telegram_user_name, password, isActive FROM users WHERE LOWER(email) = LOWER(?)";
if (app_table_is_scoped($conn, 'users')) {
    $sql .= " AND tenant_id = " . app_tenant_id();
}
$sql .= " LIMIT 1";
$stmt = $conn->prepare($sql);

if (!$stmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server query error.']);
    exit;
}

$stmt->bind_param('s', $email);
$stmt->execute();
$result = $stmt->get_result();
$user = $result ? $result->fetch_assoc() : null;
$stmt->close();

if (!$user) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Incorrect Email or Password.']);
    exit;
}

$isPasswordMatch = $user['password'] === $password || password_verify($password, (string)$user['password']);
if (!$isPasswordMatch) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Incorrect Email or Password.']);
    exit;
}

$isActiveRaw = strtolower((string)($user['isActive'] ?? 'true'));
$isActive = in_array($isActiveRaw, ['1', 'true', 'yes'], true);
if (!$isActive) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'User is inactive.']);
    exit;
}

unset($user['password']);

echo json_encode([
    'success' => true,
    'user' => [
        'id' => (int)$user['id'],
        'name' => (string)($user['name'] ?? ''),
        'email' => (string)$user['email'],
        'employeeId' => (string)($user['employee_id'] ?? ''),
        'role' => (string)($user['role'] ?? 'Employee'),
        'designation' => (string)($user['designation'] ?? ''),
        'department' => (string)($user['department'] ?? ''),
        'telegramUserName' => (string)($user['telegram_user_name'] ?? ''),
        'isActive' => true,
        'tenantId' => app_tenant_id(),
        'tenantCode' => $resolvedTenantCode,
        'tenantName' => app_tenant_name(),
    ],
    'tenant' => [
        'id' => app_tenant_id(),
        'code' => $resolvedTenantCode,
        'name' => app_tenant_name(),
        'dbMode' => (string)($currentTenant['db_mode'] ?? 'shared'),
        'status' => (string)($currentTenant['status'] ?? 'active'),
    ]
]);
