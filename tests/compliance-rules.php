<?php
require_once __DIR__.'/../api/compliance_rules.php';
function check_cp($ok,$message){if(!$ok)throw new RuntimeException($message);}
check_cp(!cp_date('2026-02-30'),'Reject impossible dates');
$rule=['frequency'=>'Monthly','months'=>[],'name'=>'Monthly','due_day'=>31,'month_offset'=>1];
$p=cp_periods($rule,'2028-01-01','2028-02-01');
check_cp($p[0]['due']==='2028-02-29','Clamp to leap month end');
$rule['frequency']='Quarterly';$rule['month_offset']=3;$rule['due_day']=15;
$p=cp_periods($rule,'2026-04-01','2027-03-31');
check_cp(count($p)===4 && $p[0]['end']==='2026-06-30' && $p[0]['due']==='2026-07-15','Quarterly calendar periods');
$rule['frequency']='Annual';$rule['month_offset']=12;
$p=cp_periods($rule,'2026-04-01','2027-03-31');check_cp(count($p)===1&&$p[0]['end']==='2027-03-31','Indian financial year');
$rule['frequency']='Custom';$rule['months']=[6,9,12,3];$rule['month_offset']=0;
check_cp(count(cp_periods($rule,'2026-04-01','2027-03-31'))===4,'Custom instalments');
check_cp(cp_money('0')==='0.00' && cp_money('')===null,'Zero fee differs from unpriced');
foreach(['-1','1.234','abc'] as $bad){try{cp_money($bad);throw new RuntimeException('Bad amount accepted');}catch(InvalidArgumentException $expected){}}
echo "Compliance calendar and money rules passed.\n";
