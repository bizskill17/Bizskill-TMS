<?php
declare(strict_types=1);
require_once __DIR__.'/config.php';
require_once __DIR__.'/dsc_module.php';
function cl_reply(array $p,int $code=200):void {http_response_code($code);echo json_encode($p);exit;}
session_start(['cookie_httponly'=>true,'cookie_secure'=>!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off','cookie_samesite'=>'Lax']);
if(empty($_SESSION['documents_tenant'])||(int)$_SESSION['documents_tenant']!==app_tenant_id()) cl_reply(['success'=>false,'error'=>'Please sign out and sign in again.'],401);
if(strtolower($currentTenant['status']??'')!=='active'||(app_requested_tenant_code()!==''&&app_requested_tenant_code()!==app_tenant_code())) cl_reply(['success'=>false,'error'=>'Organisation unavailable.'],403);
if(($currentTenant['db_mode']??'')==='dedicated'&&$conn===$platformConn) cl_reply(['success'=>false,'error'=>'Organisation database unavailable.'],503);
$actor=(int)($_SESSION['documents_user']??0);$admin=!empty($_SESSION['documents_platform_admin']);$csrf=(string)($_SESSION['documents_csrf']??'');session_write_close();$tenant=app_tenant_id();
try {
 if(!$admin){dsc_active_user($conn,$actor,$tenant);$scope=app_table_is_scoped($conn,'users')?' AND tenant_id=?':'';$u=dsc_all($conn,'SELECT role FROM users WHERE id=?'.$scope,$scope?[$actor,$tenant]:[$actor]);$admin=($u[0]['role']??'')==='Admin';}
 dsc_query($conn,"CREATE TABLE IF NOT EXISTS checklist_templates (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,tenant_id INT NOT NULL,name VARCHAR(190) NOT NULL,category VARCHAR(190) NOT NULL DEFAULT '',introduction TEXT NOT NULL,items MEDIUMTEXT NOT NULL,closing_note TEXT NOT NULL,active TINYINT NOT NULL DEFAULT 1,version INT NOT NULL DEFAULT 1,KEY checklist_tenant (tenant_id,active)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
 if($_SERVER['REQUEST_METHOD']==='GET'){
  $rows=dsc_all($conn,'SELECT * FROM checklist_templates WHERE tenant_id=?'.($admin?'':' AND active=1').' ORDER BY name,id',[$tenant]);
  foreach($rows as &$row){$row['items']=json_decode($row['items'],true)??[];}unset($row);
  cl_reply(['success'=>true,'templates'=>$rows,'admin'=>$admin,'csrf'=>$csrf]);
 }
 if($_SERVER['REQUEST_METHOD']!=='POST')cl_reply(['success'=>false,'error'=>'Method not allowed.'],405);
 $data=app_get_raw_input_data();if($csrf===''||!hash_equals($csrf,(string)($data['csrf']??'')))cl_reply(['success'=>false,'error'=>'Session expired. Reload and try again.'],403);
 if(!$admin)cl_reply(['success'=>false,'error'=>'Only an Admin can manage checklists.'],403);
 $name=trim((string)($data['name']??''));$category=trim((string)($data['category']??''));$intro=trim((string)($data['introduction']??''));$closing=trim((string)($data['closing_note']??''));$items=$data['items']??[];
 if($name===''||strlen($name)>190||strlen($category)>190||strlen($intro)>10000||strlen($closing)>10000||!is_array($items)||count($items)<1||count($items)>100)throw new InvalidArgumentException('Enter a name and between 1 and 100 checklist items.');
 foreach($items as &$item){if(!is_string($item)||trim($item)===''||strlen($item)>2000)throw new InvalidArgumentException('Each checklist item must contain 1–2000 characters.');$item=trim($item);}unset($item);
 $id=(int)($data['id']??0);$active=!empty($data['active'])?1:0;$json=json_encode(array_values($items));
 if($id){$version=(int)($data['version']??0);$stmt=dsc_query($conn,'UPDATE checklist_templates SET name=?,category=?,introduction=?,items=?,closing_note=?,active=?,version=version+1 WHERE id=? AND tenant_id=? AND version=?',[$name,$category,$intro,$json,$closing,$active,$id,$tenant,$version]);if($stmt->affected_rows!==1)throw new InvalidArgumentException('Checklist changed or unavailable. Refresh and try again.');}
 else{$id=dsc_insert($conn,'checklist_templates',['tenant_id'=>$tenant,'name'=>$name,'category'=>$category,'introduction'=>$intro,'items'=>$json,'closing_note'=>$closing,'active'=>$active]);}
 cl_reply(['success'=>true,'id'=>$id]);
}catch(InvalidArgumentException $e){cl_reply(['success'=>false,'error'=>$e->getMessage()],400);}catch(Throwable $e){error_log('Checklists: '.$e->getMessage());cl_reply(['success'=>false,'error'=>'Unable to load or save checklists. Please try again.'],500);}
