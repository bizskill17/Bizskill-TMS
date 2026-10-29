<?php
declare(strict_types=1);
// Runs only against the disposable MySQL service in CI. Never dispatches messages.
$base=getenv('DSC_TEST_BASE_URL') ?: 'http://127.0.0.1:8080';
$db=new mysqli(getenv('DB_HOST') ?: '127.0.0.1',getenv('DB_USER') ?: 'root',getenv('DB_PASS') ?: 'test_password',getenv('DB_NAME') ?: 'tms_test');
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
$schema=(string)file_get_contents(__DIR__.'/../hostinger_full_schema.sql');
$db->multi_query($schema);
do {if($result=$db->store_result())$result->free();} while($db->more_results() && $db->next_result());
function expect_true(bool $condition,string $message): void {if(!$condition)throw new RuntimeException($message);}
function http_call(string $path,?array $body,string $session='a'):array {
 global $base;
 $curl=curl_init($base.$path);
 $jar=sys_get_temp_dir().'/dsc-test-'.$session.'.cookies';
 curl_setopt_array($curl,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_COOKIEJAR=>$jar,CURLOPT_COOKIEFILE=>$jar,CURLOPT_TIMEOUT=>20]);
 if($body!==null){curl_setopt($curl,CURLOPT_POST,true);curl_setopt($curl,CURLOPT_HTTPHEADER,['Content-Type: application/json']);curl_setopt($curl,CURLOPT_POSTFIELDS,json_encode($body));}
 $raw=curl_exec($curl);$code=curl_getinfo($curl,CURLINFO_HTTP_CODE);curl_close($curl);
 $data=json_decode((string)$raw,true);
 if(!is_array($data))throw new RuntimeException('Invalid JSON at '.$path.': '.substr((string)$raw,0,300));
 return [$code,$data];
}
function login_test(string $org,string $jar='a',bool $admin=true):void {
 [$code,$data]=http_call('/api/login.php',['orgId'=>$org,'email'=>$admin?'test-admin@example.com':'user-a@example.com','password'=>$admin?'test-admin-password':'user-password'],$jar);
 expect_true($code===200&&!empty($data['success']),'Test login failed');
}
function load_dsc(string $org='test-a',string $jar='a'):array {
 [$code,$data]=http_call('/api/dsc.php?tenantCode='.$org,null,$jar);
 expect_true($code===200&&!empty($data['success']),'Load DSC failed: '.json_encode($data));
 return $data;
}
function find_certificate(int $id):array {
 $data=load_dsc();
 foreach($data['certificates'] as $row)if((int)$row['id']===$id)return $row;
 throw new RuntimeException('Certificate missing');
}
function action_test(string $action,array $row,array $extra=[]):array {
 $data=load_dsc();
 [$code,$reply]=http_call('/api/dsc.php?tenantCode=test-a',array_merge(['action'=>$action,'id'=>$row['id'],'version'=>$row['version'],'csrf'=>$data['csrf']],$extra));
 expect_true($code===200&&!empty($reply['success']),'Action '.$action.' failed: '.json_encode($reply));
 return $reply;
}
[$code]=http_call('/api/dsc.php?tenantCode=test-a',null,'anonymous');
expect_true($code===401,'Unauthenticated access must fail');
$tenantA=(int)$db->query("SELECT id FROM tenants WHERE code='test-a'")->fetch_assoc()['id'];
$db->query("INSERT INTO tenants (code,name,db_mode,status) VALUES ('test-b','Test B','shared','active')");
$tenantB=(int)$db->insert_id;
$stmt=$db->prepare('INSERT INTO users (name,email,password,mobile,role,isActive,tenant_id) VALUES (?,?,?,?,?,1,?)');
$name='User A';$email='user-a@example.com';$password=password_hash('user-password',PASSWORD_DEFAULT);$mobile='9000000001';$role='Employee';
$stmt->bind_param('sssssi',$name,$email,$password,$mobile,$role,$tenantA);$stmt->execute();$userA=(int)$stmt->insert_id;
$name='User B';$email='user-b@example.com';$stmt->bind_param('sssssi',$name,$email,$password,$mobile,$role,$tenantB);$stmt->execute();$userB=(int)$stmt->insert_id;$stmt->close();
$db->query("INSERT INTO firms (name,sortName,tenant_id) VALUES ('Client A','A',{$tenantA}),('Client B','B',{$tenantB})");
login_test('test-a');login_test('test-b','b');
$data=load_dsc();
expect_true((int)$data['settings']['enabled']===0,'Reminders must initially be off');
$today=(new DateTimeImmutable('today',new DateTimeZone('Asia/Kolkata')));
$fields=['client_name'=>'Client A','holder_name'=>'Holder A','issue_date'=>$today->modify('-365 days')->format('Y-m-d'),'expiry_date'=>$today->modify('+10 days')->format('Y-m-d'),'token_location'=>'Client','mobile'=>'9000000002','email'=>'holder@example.com'];
[$code]=http_call('/api/dsc.php?tenantCode=test-a',array_merge($fields,['action'=>'create','csrf'=>'invalid']));
expect_true($code===403,'CSRF mismatch must fail');
[$code,$reply]=http_call('/api/dsc.php?tenantCode=test-a',array_merge($fields,['action'=>'create','csrf'=>$data['csrf']]));
expect_true($code===200&&!empty($reply['id']),'Create DSC failed: '.json_encode($reply));$id=(int)$reply['id'];
$b=load_dsc('test-b','b');expect_true(count($b['certificates'])===0,'Tenant B must not see A records');
[$code]=http_call('/api/dsc.php?tenantCode=test-b&id='.$id,null,'b');expect_true($code===404,'Cross-tenant history must fail');
[$code]=http_call('/api/dsc.php?tenantCode=test-b',['action'=>'trash','id'=>$id,'version'=>1,'csrf'=>$b['csrf']],'b');expect_true($code===404,'Cross-tenant mutation must fail');
[$code]=http_call('/api/dsc.php?tenantCode=test-b',['action'=>'settings','csrf'=>$b['csrf'],'intervals'=>'60,30','responsible_user_id'=>$userA],'b');expect_true($code===422,'Cross-tenant global responsible user must fail');
[$code]=http_call('/api/dsc.php?tenantCode=test-a',array_merge($fields,['action'=>'create','expiry_date'=>'2026-02-30','csrf'=>$data['csrf']]));expect_true($code===422,'Invalid date must fail');
$db->query("CREATE TABLE document_movements (id BIGINT PRIMARY KEY,tenant_id INT,document_name VARCHAR(255),movement_date DATE,direction VARCHAR(3),external_person VARCHAR(190),office_user_name VARCHAR(190),returned_on DATE NULL,client_name VARCHAR(190))");
$db->query("INSERT INTO document_movements VALUES (1,{$tenantB},'Token B','2026-10-01','In','Person B','User B',NULL,'Client B')");
[$code]=http_call('/api/dsc.php?tenantCode=test-a',array_merge($fields,['action'=>'create','document_movement_id'=>1,'csrf'=>$data['csrf']]));expect_true($code===422,'Cross-tenant document link must fail');
expect_true((int)find_certificate($id)['responsible_user_id']===0,'Create must work without choosing a per-certificate user');
$row=find_certificate($id);
action_test('followup',$row,['last_followup_date'=>$today->format('Y-m-d'),'next_followup_date'=>$today->modify('+1 day')->format('Y-m-d'),'notes'=>'Called client']);
$latest=find_certificate($id);expect_true($latest['next_followup_date']!==null,'Follow-up must be saved');
[$code]=http_call('/api/dsc.php?tenantCode=test-a',['action'=>'deactivate','id'=>$id,'version'=>$row['version'],'reason'=>'Old form','csrf'=>$data['csrf']]);expect_true($code===409,'Stale versions must fail');
action_test('startRenewal',$latest);
expect_true((int)find_certificate($id)['pending_renewal']===1,'Pending renewal must be saved');
login_test('test-a','ordinary',false);
$ordinary=load_dsc('test-a','ordinary');
[$code]=http_call('/api/dsc.php?tenantCode=test-a',['action'=>'settings','csrf'=>$ordinary['csrf'],'intervals'=>'60,30','enabled'=>true,'office_reminders'=>true],'ordinary');
expect_true($code===403,'Non-admin settings changes must fail');
[$code,$reply]=http_call('/api/dsc.php?tenantCode=test-a',['action'=>'settings','csrf'=>$data['csrf'],'intervals'=>'60,30,15,7,1','enabled'=>true,'office_reminders'=>true,'client_reminders'=>true,'expired_reminder'=>true,'responsible_user_id'=>$userA]);
expect_true($code===200,'Settings save failed');
expect_true((int)find_certificate($id)['responsible_user_id']===$userA,'Global responsible user must apply to existing entries');
$db->query("UPDATE app_settings SET masId='test',masPassword='test',metaAccessToken='',metaPhoneNumberId='' WHERE tenant_id={$tenantA}");
$_GET['tenantCode']='test-a';$_SERVER['HTTP_HOST']='localhost';
require_once __DIR__.'/../api/notifications.php';
require_once __DIR__.'/../api/dsc_reminders.php';
expect_true(dsc_phone('919000000001','mas')==='9000000001','MAS should use 10 digits');
expect_true(dsc_schedule_reminders($conn)===2,'Queue one office and one client reminder');
expect_true(dsc_schedule_reminders($conn)===0,'Repeated cron must not duplicate reminders');
$queued=dsc_all($conn,"SELECT * FROM notification_queue WHERE tenant_id=? AND status='pending'",[$tenantA]);
expect_true(count($queued)===2,'Expected two queued reminders');
expect_true(dsc_reminder_current($conn,$queued[0]),'Fresh reminder should be current');
action_test('deactivate',find_certificate($id),['reason'=>'Client discontinued']);
$inactive=find_certificate($id);
expect_true($inactive['lifecycle']==='inactive' && $inactive['inactive_by_name']!=='','Deactivation must retain reason and actor');
expect_true(!dsc_reminder_current($conn,$queued[0]),'Inactive certificates must suppress queued messages');
expect_true(dsc_schedule_reminders($conn)===0,'Inactive certificates must not queue reminders');
$pending=dsc_all($conn,"SELECT id FROM notification_queue WHERE tenant_id=? AND status='pending'",[$tenantA]);expect_true(count($pending)===0,'Deactivation must cancel pending reminders');
action_test('reactivate',$inactive);
action_test('edit',find_certificate($id),array_merge($fields,['expiry_date'=>$today->modify('+5 days')->format('Y-m-d')]));
expect_true(dsc_schedule_reminders($conn)===2,'Changed expiry must start a fresh reminder series');
expect_true(!dsc_reminder_current($conn,$queued[0]),'Old expiry messages must be rejected');
action_test('trash',find_certificate($id));
expect_true(find_certificate($id)['deleted_at']!==null,'Trash must be recoverable');
expect_true(dsc_schedule_reminders($conn)===0,'Trash must not receive reminders');
action_test('restore',find_certificate($id));
$renewed=action_test('renew',find_certificate($id),['issue_date'=>$today->format('Y-m-d'),'expiry_date'=>$today->modify('+365 days')->format('Y-m-d'),'notes'=>'Renewal completed']);
$newId=(int)$renewed['id'];
expect_true(find_certificate($id)['lifecycle']==='renewed','Previous certificate must remain renewed');
expect_true((int)find_certificate($newId)['previous_certificate_id']===$id,'Renewal must link back to previous entry');
expect_true(find_certificate($id)['expiry_date']===$today->modify('+5 days')->format('Y-m-d'),'Old expiry must be preserved');
action_test('close',find_certificate($newId),['notes'=>'No longer needed']);
expect_true(find_certificate($newId)['lifecycle']==='closed','Close must preserve history');
action_test('trash',find_certificate($id));action_test('restore',find_certificate($id));
expect_true(find_certificate($id)['lifecycle']==='renewed','Restore must preserve previous lifecycle');
[$code,$hist]=http_call('/api/dsc.php?tenantCode=test-a&id='.$id,null);
expect_true($code===200&&count($hist['history'])>=8,'History must retain all lifecycle actions');
expect_true(count($hist['reminders'])===4,'Reminder history must retain queued records');
expect_true(dsc_schedule_reminders($conn)===0,'Closed and renewed entries must not trigger reminders');
// Dedicated database isolation, using the same numeric user ID as a shared tenant.
$db->query('CREATE DATABASE tms_dedicated');
$dedicated=new mysqli(getenv('DB_HOST'),'root',getenv('DB_PASS'),'tms_dedicated');
$dedicated->multi_query($schema);
do {if($result=$dedicated->store_result())$result->free();} while($dedicated->more_results() && $dedicated->next_result());
$dedicated->query("INSERT INTO users (name,email,password,mobile,isActive) VALUES ('Dedicated User','dedicated@example.com','unused','9000000003',1)");
$dedicatedUser=(int)$dedicated->insert_id;
$db->query("INSERT INTO tenants (code,name,db_mode,status) VALUES ('test-c','Test C','dedicated','active')");
$tenantC=(int)$db->insert_id;
$host=getenv('DB_HOST');$dbName='tms_dedicated';$dbUser='root';$dbPass=getenv('DB_PASS');
$stmt=$db->prepare('INSERT INTO tenant_db_connections (tenant_id,db_host,db_name,db_user,db_pass,is_active) VALUES (?,?,?,?,?,1)');
$stmt->bind_param('issss',$tenantC,$host,$dbName,$dbUser,$dbPass);$stmt->execute();
login_test('test-c','c');
$c=load_dsc('test-c','c');expect_true(count($c['certificates'])===0,'Dedicated database must start independently');
[$code,$reply]=http_call('/api/dsc.php?tenantCode=test-c',array_merge($fields,['action'=>'create','csrf'=>$c['csrf'],'responsible_user_id'=>$dedicatedUser,'client_name'=>'Dedicated Client']),'c');
expect_true($code===200,'Dedicated create failed: '.json_encode($reply));
expect_true((int)$dedicated->query('SELECT COUNT(*) AS n FROM dsc_certificates')->fetch_assoc()['n']===1,'Dedicated row must live in dedicated database');
expect_true(count(load_dsc()['certificates'])===2,'Dedicated create must not affect shared records');
echo "DSC integration tests passed: lifecycle, dates, CSRF, tenant isolation, renewal history, reminders and dedicated databases. No messages dispatched.\n";
