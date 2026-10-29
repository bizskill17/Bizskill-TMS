<?php
declare(strict_types=1);
function cp_date(string $s): bool { $d=DateTimeImmutable::createFromFormat('!Y-m-d',$s); return $d && $d->format('Y-m-d')===$s; }
function cp_money($value): ?string {
    if ($value===null || $value==='') return null;
    if (!preg_match('/^\d{1,10}(\.\d{1,2})?$/',(string)$value)) throw new InvalidArgumentException('Enter a valid non-negative amount with up to two decimals.');
    return number_format((float)$value,2,'.','');
}
function cp_billing($v): string { if (!in_array($v,['Billable','Non Billable'],true)) throw new InvalidArgumentException('Select Billing Type.'); return $v; }
function cp_periods(array $schedule,string $start,string $end): array {
    if (!cp_date($start)||!cp_date($end)||$end<$start) throw new InvalidArgumentException('Enter a valid date range.');
    $cursor=(new DateTimeImmutable($start))->modify('first day of this month');
    $limit=new DateTimeImmutable($end); $out=[];$n=0;
    while ($cursor<=$limit) {
        if (++$n>600) throw new InvalidArgumentException('Date range is too long.');
        $m=(int)$cursor->format('n'); $frequency=$schedule['frequency'];
        if ($frequency==='Monthly' || ($frequency==='Quarterly' && in_array($m,[4,7,10,1],true)) || ($frequency==='Annual' && $m===4) || ($frequency==='Custom' && in_array($m,$schedule['months'],true))) {
            $span=$frequency==='Quarterly'?3:($frequency==='Annual'?12:1);
            $periodEnd=$cursor->modify('+'.$span.' months')->modify('-1 day')->format('Y-m-d');
            $dueMonth=$cursor->modify('+'.(int)$schedule['month_offset'].' months');
            $day=min((int)$schedule['due_day'],(int)$dueMonth->format('t'));
            $due=$dueMonth->format('Y-m-').str_pad((string)$day,2,'0',STR_PAD_LEFT);
            $out[]=['start'=>$cursor->format('Y-m-d'),'end'=>$periodEnd,'due'=>$due,'label'=>$schedule['name']];
        }
        $cursor=$cursor->modify('+1 month');
    }
    return $out;
}
