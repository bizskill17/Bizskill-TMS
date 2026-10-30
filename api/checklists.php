<?php
declare(strict_types=1);
require_once __DIR__.'/config.php';
require_once __DIR__.'/dsc_module.php';
require_once __DIR__.'/checklist_notes.php';
function cl_reply(array $p,int $code=200):void {http_response_code($code);echo json_encode($p);exit;}
session_start(['cookie_httponly'=>true,'cookie_secure'=>!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off','cookie_samesite'=>'Lax']);
if(empty($_SESSION['documents_tenant'])||(int)$_SESSION['documents_tenant']!==app_tenant_id()) cl_reply(['success'=>false,'error'=>'Please sign out and sign in again.'],401);
if(strtolower($currentTenant['status']??'')!=='active'||(app_requested_tenant_code()!==''&&app_requested_tenant_code()!==app_tenant_code())) cl_reply(['success'=>false,'error'=>'Organisation unavailable.'],403);
if(($currentTenant['db_mode']??'')==='dedicated'&&$conn===$platformConn) cl_reply(['success'=>false,'error'=>'Organisation database unavailable.'],503);
$actor=(int)($_SESSION['documents_user']??0);$admin=!empty($_SESSION['documents_platform_admin']);$csrf=(string)($_SESSION['documents_csrf']??'');session_write_close();$tenant=app_tenant_id();
try {
 if(!$admin){dsc_active_user($conn,$actor,$tenant);$scope=app_table_is_scoped($conn,'users')?' AND tenant_id=?':'';$u=dsc_all($conn,'SELECT role FROM users WHERE id=?'.$scope,$scope?[$actor,$tenant]:[$actor]);$admin=($u[0]['role']??'')==='Admin';}
 cl_schema($conn);
 if($_SERVER['REQUEST_METHOD']==='GET'){
  $rows=dsc_all($conn,'SELECT * FROM checklist_templates WHERE tenant_id=?'.($admin?'':' AND active=1').' ORDER BY sort_order,name,id',[$tenant]);
  foreach($rows as &$row){$row['note_html']=cl_sanitize_note($row['note_html']??cl_legacy_note($row));unset($row['introduction'],$row['items'],$row['closing_note']);}unset($row);
  $scope=app_table_is_scoped($conn,'categories')?' WHERE tenant_id=?':'';
  $categories=dsc_all($conn,'SELECT id,name FROM categories'.$scope.' ORDER BY name',$scope?[$tenant]:[]);
  cl_reply(['success'=>true,'templates'=>$rows,'categories'=>$categories,'admin'=>$admin,'csrf'=>$csrf]);
 }
 if($_SERVER['REQUEST_METHOD']!=='POST')cl_reply(['success'=>false,'error'=>'Method not allowed.'],405);
 $data=app_get_raw_input_data();if($csrf===''||!hash_equals($csrf,(string)($data['csrf']??'')))cl_reply(['success'=>false,'error'=>'Session expired. Reload and try again.'],403);
 if(!$admin)cl_reply(['success'=>false,'error'=>'Only an Admin can manage checklists.'],403);

 if(($data['action']??'')==='reorder'){
  $ids=$data['ids']??null;$expected=$data['expected']??null;
  if(!is_array($ids)||!is_array($expected))throw new InvalidArgumentException('Invalid checklist order.');
  foreach(array_merge($ids,$expected) as $value)if(!is_int($value)||$value<1)throw new InvalidArgumentException('Invalid checklist order.');
  if(count(array_unique($ids))!==count($ids))throw new InvalidArgumentException('Invalid checklist order.');
  $conn->begin_transaction();
  try {
   $rows=dsc_all($conn,'SELECT id FROM checklist_templates WHERE tenant_id=? ORDER BY sort_order,name,id FOR UPDATE',[$tenant]);
   $current=array_map('intval',array_column($rows,'id'));
   $sorted=$ids;$existing=$current;sort($sorted);sort($existing);
   if($expected!==$current||$sorted!==$existing)throw new InvalidArgumentException('Checklists changed. Reload and try again.');
   foreach($ids as $position=>$id)dsc_query($conn,'UPDATE checklist_templates SET sort_order=? WHERE id=? AND tenant_id=?',[$position,$id,$tenant]);
   $conn->commit();
  }catch(Throwable $e){$conn->rollback();throw $e;}
  cl_reply(['success'=>true]);
 }
 if(($data['action']??'')==='delete'){
  $id=(int)($data['id']??0);$version=(int)($data['version']??0);
  $stmt=dsc_query($conn,'DELETE FROM checklist_templates WHERE id=? AND tenant_id=? AND version=?',[$id,$tenant,$version]);
  if($stmt->affected_rows!==1)throw new InvalidArgumentException('Note changed or unavailable. Reopen it and try again.');
  cl_reply(['success'=>true,'deleted'=>true]);
 }
 $category=trim((string)($data['category']??''));
 if(strlen($category)>190)throw new InvalidArgumentException('Choose a valid Category.');
 if($category!==''){
  $scope=app_table_is_scoped($conn,'categories')?' AND tenant_id=?':'';
  $found=dsc_all($conn,'SELECT id FROM categories WHERE name=?'.$scope,$scope?[$category,$tenant]:[$category]);
  if(!$found){
   $existing=dsc_all($conn,'SELECT category FROM checklist_templates WHERE id=? AND tenant_id=?',[(int)($data['id']??0),$tenant]);
   if(!$existing||$existing[0]['category']!==$category)throw new InvalidArgumentException('Choose a Category from Category Master.');
  }
 }
 $name=trim((string)($data['name']??''));
 if($name===''||strlen($name)>190)throw new InvalidArgumentException('Enter a name of up to 190 characters.');
 $note=cl_sanitize_note(array_key_exists('note_html',$data)?(string)$data['note_html']:cl_legacy_note($data));
 if(cl_note_text($note)==='')throw new InvalidArgumentException('Enter a note.');
 $id=(int)($data['id']??0);
 if($id){
  $version=(int)($data['version']??0);
  $stmt=dsc_query($conn,'UPDATE checklist_templates SET name=?,category=?,note_html=?,version=version+1 WHERE id=? AND tenant_id=? AND version=?',[$name,$category,$note,$id,$tenant,$version]);
  if($stmt->affected_rows!==1)throw new InvalidArgumentException('Note changed or unavailable. Reopen it and try again.');
 }else{
  $last=dsc_all($conn,'SELECT COALESCE(MAX(sort_order),-1)+1 AS next_position FROM checklist_templates WHERE tenant_id=?',[$tenant]);
  $position=(int)$last[0]['next_position'];
  $id=dsc_insert($conn,'checklist_templates',['sort_order'=>$position,'color_index'=>$position%8,'tenant_id'=>$tenant,'name'=>$name,'category'=>$category,'introduction'=>'','items'=>'[]','closing_note'=>'','note_html'=>$note,'active'=>1]);
 }
 cl_reply(['success'=>true,'id'=>$id]);
}catch(InvalidArgumentException $e){cl_reply(['success'=>false,'error'=>$e->getMessage()],400);}catch(Throwable $e){error_log('Checklists: '.$e->getMessage());cl_reply(['success'=>false,'error'=>'Unable to load or save checklists. Please try again.'],500);}
