<?php
declare(strict_types=1);
require_once __DIR__.'/../api/dsc_rules.php';
function check($actual,$expected,string $message): void {
 if ($actual!==$expected) throw new RuntimeException($message.' Actual: '.json_encode($actual));
}
check(dsc_valid_date('2026-02-30'),false,'Reject impossible date');
check(dsc_valid_date('2028-02-29'),true,'Allow leap day');
check(dsc_days_left('2028-03-01','2028-02-28'),2,'Count leap-day boundary');
check(dsc_intervals('7,60,30,7,1'),[60,30,7,1],'Normalise intervals');
foreach (['0','-1','abc','366',''] as $bad) {
 $failed=false;
 try {dsc_intervals($bad);} catch (InvalidArgumentException $e) {$failed=true;}
 check($failed,true,'Reject invalid intervals');
}
$row=['lifecycle'=>'active','deleted_at'=>null,'expiry_date'=>'2026-10-29'];
check(dsc_reminder_stage($row,[60,30,15,7,1],'2026-09-14',true),60,'Catch up relevant stage');
check(dsc_reminder_stage($row,[60,30,15,7,1],'2026-10-01',true),30,'Select nearest milestone');
check(dsc_reminder_stage($row,[60,30,15,7,1],'2026-10-29',true),1,'Expiry today');
check(dsc_reminder_stage($row,[60,30,15,7,1],'2026-10-30',true),-1,'One expired stage');
check(dsc_reminder_stage($row,[60,30,15,7,1],'2026-10-30',false),null,'Respect expired reminder setting');
check(dsc_reminder_stage($row,[60,30,15,7,1],'2026-08-01',true),null,'Outside window');
foreach (['inactive','renewed','closed'] as $state) check(dsc_reminder_stage(array_merge($row,['lifecycle'=>$state]),[60,30,15,7,1],'2026-10-28',true),null,'Stop reminders for '.$state);
check(dsc_reminder_stage(array_merge($row,['deleted_at'=>'2026-10-01']),[60,30,15,7,1],'2026-10-28',true),null,'Stop Trash reminders');
echo "DSC date and reminder-rule tests passed.\n";
