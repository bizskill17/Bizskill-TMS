<?php
declare(strict_types=1);
function dsc_valid_date(?string $value): bool {
    if (!$value) return false;
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value, new DateTimeZone('Asia/Kolkata'));
    return $date !== false && $date->format('Y-m-d') === $value;
}
function dsc_days_left(string $expiry, ?string $today = null): int {
    $zone = new DateTimeZone('Asia/Kolkata');
    $start = new DateTimeImmutable($today ?? 'today', $zone);
    return (int)$start->setTime(0,0)->diff(new DateTimeImmutable($expiry, $zone))->format('%r%a');
}
function dsc_intervals($raw): array {
    if (is_string($raw)) $raw = explode(',', $raw);
    if (!is_array($raw) || count($raw) === 0 || count($raw) > 12) throw new InvalidArgumentException('Enter between 1 and 12 reminder intervals.');
    $values = [];
    foreach ($raw as $value) {
        if (!preg_match('/^\d+$/', trim((string)$value))) throw new InvalidArgumentException('Reminder intervals must be whole days.');
        $number = (int)$value;
        if ($number < 1 || $number > 365) throw new InvalidArgumentException('Reminder intervals must be between 1 and 365 days.');
        $values[] = $number;
    }
    $values = array_values(array_unique($values));
    rsort($values);
    return $values;
}
// Catch up only the most relevant milestone; do not flood missed milestones.
function dsc_reminder_stage(array $certificate, array $intervals, string $today, bool $expiredReminder): ?int {
    if (($certificate['lifecycle'] ?? '') !== 'active' || !empty($certificate['deleted_at'])) return null;
    $days = dsc_days_left((string)$certificate['expiry_date'], $today);
    if ($days < 0) return $expiredReminder ? -1 : null;
    sort($intervals);
    foreach ($intervals as $threshold) if ($days <= $threshold) return (int)$threshold;
    return null;
}
function dsc_check_dates(?string $issue, string $expiry): void {
    if (!dsc_valid_date($expiry) || ($issue && (!dsc_valid_date($issue) || $issue > $expiry))) {
        throw new InvalidArgumentException('Enter valid certificate dates. Expiry must be on or after the issue date.');
    }
}
