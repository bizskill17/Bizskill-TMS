<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

$input = app_get_raw_input_data();

$email = isset($input['email']) ? trim((string)$input['email']) : '';
$password = isset($input['password']) ? (string)$input['password'] : '';

if ($email === '' || $password === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Email and password are required.']);
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
        'tenantCode' => app_tenant_code(),
        'tenantName' => app_tenant_name(),
    ],
    'tenant' => [
        'id' => app_tenant_id(),
        'code' => app_tenant_code(),
        'name' => app_tenant_name(),
        'dbMode' => (string)($currentTenant['db_mode'] ?? 'shared'),
    ]
]);
