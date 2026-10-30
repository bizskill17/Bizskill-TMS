<?php
declare(strict_types=1);

// Compare names as sets so ordering and extra spaces do not trigger reassignment.
function task_assignment_names(string $value): array {
    $names = [];
    foreach (explode(',', $value) as $name) {
        $name = trim(preg_replace('/\s+/', ' ', $name));
        if ($name !== '') $names[strtolower($name)] = $name;
    }
    return $names;
}
function task_assignment_changed(string $previous, string $current): bool {
    $before = array_keys(task_assignment_names($previous));
    $after = array_keys(task_assignment_names($current));
    sort($before); sort($after);
    return $before !== $after;
}
function task_reassignment_recipients(string $assignees, string $owner): array {
    return array_values(task_assignment_names($assignees . ',' . $owner));
}
function task_reassignment_message(array $task, array $log, string $previous, ?string $timestamp = null): string {
    $due = trim((string)($task['dueDate'] ?? ''));
    if (preg_match('/^(\d{4})-(\d{2})-(\d{2})/', $due, $parts)) $due = $parts[3].'/'.$parts[2].'/'.$parts[1];
    $fields = [
        'Task' => (string)($task['title'] ?? ''),
        'Client' => trim((string)($task['firm'] ?? '')) ?: (string)($task['client'] ?? ''),
        'Previous Assignees' => implode(', ', array_values(task_assignment_names($previous))) ?: 'None',
        'New Assignees' => implode(', ', array_values(task_assignment_names((string)($task['assignees'] ?? '')))) ?: 'None',
        'Due Date' => $due ?: 'Not set',
        'Remarks' => trim((string)($log['remarks'] ?? '')) ?: 'None',
        'Reassigned At' => $timestamp ?? (new DateTimeImmutable('now', new DateTimeZone('Asia/Kolkata')))->format('d/m/Y H:i'),
    ];
    $lines = ['*Task Reassigned*', ''];
    foreach ($fields as $label => $value) {
        if (trim($value) !== '') $lines[] = '*'.$label.':* '.$value;
    }
    return implode("\n", $lines);
}
