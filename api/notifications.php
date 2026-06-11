<?php
declare(strict_types=1);

/**
 * Notifications (WhatsApp + Telegram) for the MySQL backend.
 *
 * Safety goals:
 * - No-op by default unless $NOTIFICATIONS_ENABLED is set true in config.php.
 * - Never block core DB writes: all notification errors are swallowed and optionally logged.
 * - Prefer queueing to notification_queue when available; worker can send async.
 */

require_once __DIR__ . '/config.php';

function notifications_enabled(): bool {
    return (bool)($GLOBALS['NOTIFICATIONS_ENABLED'] ?? false);
}

function notifications_worker_token(): string {
    return (string)($GLOBALS['NOTIFICATIONS_WORKER_TOKEN'] ?? '');
}

function notifications_table_exists(mysqli $conn, string $table): bool {
    $table = preg_replace('/[^a-zA-Z0-9_]/', '', $table);
    if ($table === '') return false;
    $result = $conn->query("SHOW TABLES LIKE '{$table}'");
    if (!$result) return false;
    $row = $result->fetch_row();
    $result->free();
    return (bool)$row;
}

function notifications_get_settings(mysqli $conn): array {
    $result = $conn->query("SELECT * FROM app_settings LIMIT 1");
    if (!$result) return [];
    $row = $result->fetch_assoc() ?: [];
    $result->free();
    return $row;
}

function notifications_get_user_mobile(mysqli $conn, string $userName): string {
    $name = trim($userName);
    if ($name === '') return '';
    $stmt = $conn->prepare("SELECT mobile FROM users WHERE name = ? LIMIT 1");
    if (!$stmt) return '';
    $stmt->bind_param('s', $name);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    return trim((string)($row['mobile'] ?? ''));
}

function notifications_get_vendor_mobile(mysqli $conn, string $vendorName): string {
    $name = trim($vendorName);
    if ($name === '') return '';
    $stmt = $conn->prepare("SELECT mobile FROM vendors WHERE name = ? LIMIT 1");
    if (!$stmt) return '';
    $stmt->bind_param('s', $name);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    return trim((string)($row['mobile'] ?? ''));
}

function notifications_get_project_groups(mysqli $conn, string $projectName): array {
    $projectName = trim($projectName);
    if ($projectName === '' || $projectName === '-') return ['whatsappGroupId' => '', 'telegramGroupId' => ''];
    $stmt = $conn->prepare("SELECT whatsappGroupId, telegramGroupId FROM projects WHERE name = ? LIMIT 1");
    if (!$stmt) return ['whatsappGroupId' => '', 'telegramGroupId' => ''];
    $stmt->bind_param('s', $projectName);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? ($res->fetch_assoc() ?: []) : [];
    $stmt->close();
    return [
        'whatsappGroupId' => trim((string)($row['whatsappGroupId'] ?? $row['whatsAppGroupID'] ?? '')),
        'telegramGroupId' => trim((string)($row['telegramGroupId'] ?? $row['telegramGroupID'] ?? '')),
    ];
}

function notifications_pick_whatsapp_provider(array $settings): string {
    $metaToken = trim((string)($settings['metaAccessToken'] ?? ''));
    $metaPhoneId = trim((string)($settings['metaPhoneNumberId'] ?? ''));
    if ($metaToken !== '' && $metaPhoneId !== '') return 'meta';

    $masId = trim((string)($settings['masId'] ?? ''));
    $masPass = trim((string)($settings['masPassword'] ?? ''));
    if ($masId !== '' && $masPass !== '') return 'mas';

    return '';
}

function notifications_is_telegram_configured(array $settings): bool {
    $botToken = trim((string)($settings['officeTokenId'] ?? ''));
    $chatId = trim((string)($settings['officeTelegramGroupId'] ?? ''));
    return $botToken !== '' && $chatId !== '';
}

function notifications_format_datetime(): string {
    return date('d/m/Y H:i');
}

function notifications_trim(string $value): string {
    return trim(preg_replace('/\s+/', ' ', $value));
}

function notifications_format_date_dmy(string $value): string {
    $value = trim($value);
    if ($value === '') return '';
    // Already dd/mm/yyyy?
    if (preg_match('/^\d{1,2}\/\d{1,2}\/\d{4}$/', $value)) {
        [$d, $m, $y] = explode('/', $value);
        return str_pad($d, 2, '0', STR_PAD_LEFT) . '/' . str_pad($m, 2, '0', STR_PAD_LEFT) . '/' . $y;
    }
    // ISO yyyy-mm-dd
    if (preg_match('/^\d{4}-\d{2}-\d{2}/', $value)) {
        $date = substr($value, 0, 10);
        [$y, $m, $d] = explode('-', $date);
        return $d . '/' . $m . '/' . $y;
    }
    // Try parse
    $ts = strtotime($value);
    if ($ts !== false) return date('d/m/Y', $ts);
    return $value;
}

function notifications_format_time_hhmm(string $value): string {
    $value = trim($value);
    if ($value === '') return '';
    if (preg_match('/^\d{1,2}:\d{2}$/', $value)) {
        [$h, $m] = explode(':', $value);
        return str_pad($h, 2, '0', STR_PAD_LEFT) . ':' . $m;
    }
    $ts = strtotime($value);
    if ($ts !== false) return date('H:i', $ts);
    return $value;
}

function notifications_add_line(array &$lines, string $label, string $value, bool $optional = false): void {
    $value = notifications_trim($value);
    if ($optional && $value === '') return;
    if ($value === '') return;
    $lines[] = '*' . $label . ':* ' . $value;
}

function notifications_compose_task_created(array $task, bool $isVendor): string {
    $lines = [];
    $lines[] = $isVendor ? "*New Vendor Task*" : "*New Task Assigned*";
    $lines[] = '';

    notifications_add_line($lines, 'Task', (string)($task['title'] ?? ''));
    notifications_add_line($lines, 'Notes', (string)($task['notes'] ?? ''), true);
    notifications_add_line($lines, 'Firm', (string)($task['firm'] ?? ''));
    notifications_add_line($lines, 'Category', (string)($task['category'] ?? ''));
    if (!$isVendor) {
        notifications_add_line($lines, 'Assignees', (string)($task['assignees'] ?? ''));
    }
    notifications_add_line($lines, 'Owner', (string)($task['owner'] ?? ''));
    notifications_add_line($lines, 'Priority', (string)($task['priority'] ?? ''));
    $time = notifications_format_time_hhmm((string)($task['time'] ?? ''));
    notifications_add_line($lines, 'Time', $time, true);
    notifications_add_line($lines, 'Goal', (string)($task['goal'] ?? ''), true);
    $due = notifications_format_date_dmy((string)($task['dueDate'] ?? ''));
    notifications_add_line($lines, 'Due Date', $due);
    $lines[] = '*Created At:* ' . notifications_format_datetime();
    return implode("\n", $lines);
}

function notifications_compose_task_updated(array $task, array $log): string {
    $lines = [];
    $lines[] = "*Task Updated*";
    $lines[] = '';
    notifications_add_line($lines, 'Task', (string)($task['title'] ?? ''));
    notifications_add_line($lines, 'Firm', (string)($task['firm'] ?? ''));
    notifications_add_line($lines, 'Status', (string)($task['status'] ?? ''));
    notifications_add_line($lines, 'Remarks', (string)($log['remarks'] ?? ''));
    notifications_add_line($lines, 'Minutes', (string)($log['minutes'] ?? ''));
    notifications_add_line($lines, 'Achieved', (string)($log['achieved'] ?? ''), true);
    $lines[] = '*Updated At:* ' . notifications_format_datetime();
    return implode("\n", $lines);
}

function notifications_compose_recurring_created(array $task): string {
    $lines = [];
    $lines[] = "*New Recurring Task Created*";
    $lines[] = '';
    notifications_add_line($lines, 'Task', (string)($task['title'] ?? ''));
    notifications_add_line($lines, 'Firm', (string)($task['firm'] ?? ''));
    notifications_add_line($lines, 'Category', (string)($task['category'] ?? ''));
    notifications_add_line($lines, 'Assignee', (string)($task['assignee'] ?? ''));
    notifications_add_line($lines, 'Owner', (string)($task['owner'] ?? ''));
    notifications_add_line($lines, 'Start Date', notifications_format_date_dmy((string)($task['startDate'] ?? '')));
    $rule = trim((string)($task['frequencyType'] ?? ''));
    if ($rule !== '') {
        $ruleText = $rule . (isset($task['frequencyDays']) ? (" / " . (string)$task['frequencyDays']) : '');
        notifications_add_line($lines, 'Rule', $ruleText);
    }
    notifications_add_line($lines, 'Time', notifications_format_time_hhmm((string)($task['time'] ?? '')), true);
    notifications_add_line($lines, 'Goal', (string)($task['goal'] ?? ''), true);
    $lines[] = '*Created At:* ' . notifications_format_datetime();
    return implode("\n", $lines);
}

function notifications_compose_recurring_action(array $action): string {
    $lines = [];
    $lines[] = "*Recurring Task Updated*";
    $lines[] = '';
    notifications_add_line($lines, 'Task', (string)($action['taskTitle'] ?? ''));
    notifications_add_line($lines, 'Firm', (string)($action['firm'] ?? ''));
    notifications_add_line($lines, 'Status', (string)($action['status'] ?? ''));
    notifications_add_line($lines, 'Remarks', (string)($action['remarks'] ?? ''));
    notifications_add_line($lines, 'Achieved', (string)($action['goal'] ?? ''), true);
    $lines[] = '*Updated At:* ' . notifications_format_datetime();
    return implode("\n", $lines);
}

function notifications_enqueue(mysqli $conn, string $channel, string $provider, string $targetType, string $target, string $message, array $meta = []): void {
    if (!notifications_enabled()) return;
    if ($channel === '' || $provider === '' || $target === '' || $message === '') return;
    if (!notifications_table_exists($conn, 'notification_queue')) return;

    $stmt = $conn->prepare("INSERT INTO notification_queue (channel, provider, targetType, target, message, meta, status, attempts, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, NOW(), NOW())");
    if (!$stmt) return;
    $metaJson = json_encode($meta, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $stmt->bind_param('ssssss', $channel, $provider, $targetType, $target, $message, $metaJson);
    $stmt->execute();
    $stmt->close();
}

function notifications_log(mysqli $conn, string $eventType, string $channel, string $provider, string $target, string $status, string $error = ''): void {
    if (!notifications_enabled()) return;
    if (!notifications_table_exists($conn, 'notification_logs')) return;
    $stmt = $conn->prepare("INSERT INTO notification_logs (eventType, channel, provider, target, status, error, createdAt) VALUES (?, ?, ?, ?, ?, ?, NOW())");
    if (!$stmt) return;
    $stmt->bind_param('ssssss', $eventType, $channel, $provider, $target, $status, $error);
    $stmt->execute();
    $stmt->close();
}

function notifications_http_post_json(string $url, array $headers, array $body, int $timeoutSeconds = 12): array {
    $ch = curl_init($url);
    if (!$ch) return ['ok' => false, 'error' => 'curl_init failed'];
    $payload = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $merged = array_merge(['Content-Type: application/json'], $headers);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $merged,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_CONNECTTIMEOUT => 4,
        CURLOPT_TIMEOUT => $timeoutSeconds,
    ]);
    $resp = curl_exec($ch);
    $err = curl_error($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($resp === false) return ['ok' => false, 'error' => $err ?: 'curl error'];
    if ($code < 200 || $code >= 300) return ['ok' => false, 'error' => "HTTP {$code}: {$resp}"];
    return ['ok' => true, 'response' => $resp];
}

function notifications_http_post_form(string $url, array $headers, array $body, int $timeoutSeconds = 12): array {
    $ch = curl_init($url);
    if (!$ch) return ['ok' => false, 'error' => 'curl_init failed'];
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POSTFIELDS => http_build_query($body),
        CURLOPT_CONNECTTIMEOUT => 4,
        CURLOPT_TIMEOUT => $timeoutSeconds,
    ]);
    $resp = curl_exec($ch);
    $err = curl_error($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($resp === false) return ['ok' => false, 'error' => $err ?: 'curl error'];
    if ($code < 200 || $code >= 300) return ['ok' => false, 'error' => "HTTP {$code}: {$resp}"];
    return ['ok' => true, 'response' => $resp];
}

function notifications_send_whatsapp_meta(array $settings, string $toMobile, string $message): array {
    $token = trim((string)($settings['metaAccessToken'] ?? ''));
    $phoneId = trim((string)($settings['metaPhoneNumberId'] ?? ''));
    if ($token === '' || $phoneId === '') return ['ok' => false, 'error' => 'Meta WhatsApp not configured'];
    $toMobile = preg_replace('/[^0-9]/', '', $toMobile);
    if ($toMobile === '') return ['ok' => false, 'error' => 'Invalid mobile'];
    $url = "https://graph.facebook.com/v20.0/{$phoneId}/messages";
    $body = [
        'messaging_product' => 'whatsapp',
        'recipient_type' => 'individual',
        'to' => $toMobile,
        'type' => 'text',
        'text' => ['preview_url' => false, 'body' => $message],
    ];
    return notifications_http_post_json($url, ["Authorization: Bearer {$token}"], $body);
}

function notifications_send_whatsapp_mas_personal(array $settings, string $toMobile, string $message): array {
    $username = trim((string)($settings['masId'] ?? ''));
    $password = trim((string)($settings['masPassword'] ?? ''));
    if ($username === '' || $password === '') return ['ok' => false, 'error' => 'MessageAutoSender not configured'];
    $toMobile = preg_replace('/[^0-9]/', '', $toMobile);
    if ($toMobile === '') return ['ok' => false, 'error' => 'Invalid mobile'];
    $url = "https://app.messageautosender.com/api/v1/message/create";
    $auth = base64_encode($username . ":" . $password);
    return notifications_http_post_json($url, ["Authorization: Basic {$auth}"], [
        'receiverMobileNo' => $toMobile,
        'message' => [$message],
    ]);
}

function notifications_send_whatsapp_mas_group(array $settings, string $groupInviteCode, string $message): array {
    $username = trim((string)($settings['masId'] ?? ''));
    $password = trim((string)($settings['masPassword'] ?? ''));
    if ($username === '' || $password === '') return ['ok' => false, 'error' => 'MessageAutoSender not configured'];
    $groupInviteCode = trim($groupInviteCode);
    if ($groupInviteCode === '') return ['ok' => false, 'error' => 'Missing group id'];
    $url = "https://app.messageautosender.com/api/v1/message/create-group-message";
    $auth = base64_encode($username . ":" . $password);
    return notifications_http_post_json($url, ["Authorization: Basic {$auth}"], [
        'groupInviteCode' => $groupInviteCode,
        'message' => [$message],
    ]);
}

function notifications_send_telegram(array $settings, string $chatId, string $message): array {
    $token = trim((string)($settings['officeTokenId'] ?? ''));
    if ($token === '') return ['ok' => false, 'error' => 'Telegram bot token not configured'];
    $chatId = trim($chatId);
    if ($chatId === '') return ['ok' => false, 'error' => 'Telegram chat id missing'];
    $url = "https://api.telegram.org/bot{$token}/sendMessage";
    // Use plain text to avoid parse issues.
    return notifications_http_post_form($url, [], [
        'chat_id' => $chatId,
        'text' => $message,
        'disable_web_page_preview' => 'true',
    ]);
}

/**
 * Sends one queued message. Returns ['ok'=>bool,'error' => string]
 */
function notifications_dispatch(mysqli $conn, array $queueRow): array {
    if (!notifications_enabled()) return ['ok' => true];
    $settings = notifications_get_settings($conn);

    $channel = (string)($queueRow['channel'] ?? '');
    $provider = (string)($queueRow['provider'] ?? '');
    $targetType = (string)($queueRow['targetType'] ?? '');
    $target = (string)($queueRow['target'] ?? '');
    $message = (string)($queueRow['message'] ?? '');

    if ($channel === 'telegram') {
        return notifications_send_telegram($settings, $target, $message);
    }

    if ($channel === 'whatsapp') {
        if ($provider === 'meta') {
            // Meta supports personal only in this implementation.
            if ($targetType !== 'personal') return ['ok' => false, 'error' => 'Meta group sending not supported'];
            return notifications_send_whatsapp_meta($settings, $target, $message);
        }
        if ($provider === 'mas') {
            if ($targetType === 'group') return notifications_send_whatsapp_mas_group($settings, $target, $message);
            return notifications_send_whatsapp_mas_personal($settings, $target, $message);
        }
        return ['ok' => false, 'error' => 'Unknown WhatsApp provider'];
    }

    return ['ok' => false, 'error' => 'Unknown channel'];
}
