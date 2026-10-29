import React, { useEffect, useRef, useState } from 'react';
import { Plus, RefreshCw, Search, Settings, X, History, FileText } from 'lucide-react';
import { SearchableSelect } from './SearchableSelect';
import { todayISO, daysLeft, dscStatus, matchesDscTab } from './dscRules.mjs';

type Certificate = {
 id:number; version:number; client_name:string; holder_name:string; organisation:string; designation:string;
 mobile:string; email:string; issue_date:string|null; expiry_date:string; responsible_user_id:number; responsible_user_name:string;
 token_location:string; token_details:string; document_movement_id:number|null; last_followup_date:string|null; next_followup_date:string|null;
 remarks:string; lifecycle:string; pending_renewal:number|string; inactive_reason:string; inactive_on:string|null; inactive_by_name:string;
 deleted_at:string|null; previous_certificate_id:number|null; renewed_to_id:number|null;
};
type RegisterData = {certificates:Certificate[]; users:any[]; clients:any[]; documents:any[]; settings:any; canConfigure:boolean; csrf:string};
const emptyData:RegisterData={certificates:[],users:[],clients:[],documents:[],settings:{enabled:0,office_reminders:1,client_reminders:0,expired_reminder:1,intervals:[60,30,15,7,1]},canConfigure:false,csrf:''};
const tabItems=[['all','All DSCs'],['expiring','Expiring Soon'],['expired','Expired'],['pending','Pending Renewal'],['followup','Follow-up Due'],['renewed','Renewed / Closed'],['inactive','Inactive'],['trash','Trash']];
const dateText=(value:any)=>value?String(value).slice(0,10).split('-').reverse().join('/'):'—';
const detailLabels:Record<string,string>={client_name:'Client',holder_name:'Certificate Holder',organisation:'Organisation',designation:'Designation',mobile:'Mobile',email:'Email',issue_date:'Issued On',expiry_date:'Expiry Date',responsible_user_name:'Responsible User',token_location:'Token Location',token_details:'Location Details',last_followup_date:'Last Follow-up',next_followup_date:'Next Follow-up',remarks:'Remarks',lifecycle:'Status',inactive_reason:'Deactivation Reason',inactive_by_name:'Deactivated By',pending_renewal:'Pending Renewal'};
function eventDetails(raw:string):[string,string][] {
 try {const parsed=JSON.parse(raw);const values=parsed.changes||parsed.new_certificate||parsed;
 return Object.entries(detailLabels).filter(([key])=>Object.prototype.hasOwnProperty.call(values,key)).map(([key,title])=>[title,key.endsWith('_date')?dateText(values[key]):key==='pending_renewal'?(Number(values[key])?'Yes':'No'):String(values[key]??'—')]);}
 catch {return [];}
}
const activeUser=(user:any)=>['1','true','yes'].includes(String(user.isActive).toLowerCase());
const blank=()=>({client_name:'',holder_name:'',organisation:'',designation:'',mobile:'',email:'',issue_date:'',expiry_date:'',responsible_user_id:'',token_location:'Client',token_details:'',document_movement_id:'',last_followup_date:'',next_followup_date:'',remarks:'',notes:'',reason:'',enabled:false,office_reminders:true,client_reminders:false,expired_reminder:true,intervals:'60,30,15,7,1'});
const input='w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-200';
const label='block text-sm font-medium text-gray-700 mb-1';
const actionTitles:Record<string,string>={create:'Add DSC',edit:'Edit DSC',renew:'Mark Renewed',followup:'Record Follow-up',deactivate:'Deactivate DSC',reactivate:'Reactivate DSC',trash:'Move to Trash',restore:'Restore DSC',close:'Close DSC',startRenewal:'Start Renewal',settings:'Reminder Settings',clientReminders:'Preview Client Reminders',history:'DSC Details & History'};


async function readDscResponse(response:Response) {
 const raw=await response.text();
 try {return JSON.parse(raw);}
 catch {
  throw new Error(response.status===504||response.status===502||response.status===503
   ? 'The server is temporarily unavailable. Please try Refresh shortly.'
   : 'The DSC server returned an unexpected response. Please refresh; if this continues, contact support.');
 }
}

export function DscRegisterView({tenantCode}:{tenantCode:string}) {
 const [data,setData]=useState<RegisterData>(emptyData);
 const [loading,setLoading]=useState(false);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [tab,setTab]=useState('all');
 const [search,setSearch]=useState('');
 const [clientFilter,setClientFilter]=useState('');
 const [dateFrom,setDateFrom]=useState('');
 const [dateTo,setDateTo]=useState('');
 const [mode,setMode]=useState('');
 const [selected,setSelected]=useState<Certificate|null>(null);
 const [form,setForm]=useState<any>(blank);
 const [history,setHistory]=useState<any[]>([]);
 const [reminders,setReminders]=useState<any[]>([]);
 const [historyLoading,setHistoryLoading]=useState(false);
 const [selectedIds,setSelectedIds]=useState<number[]>([]);
 const [preview,setPreview]=useState<any>(null);
 const request=useRef(0);
 const endpoint='/api/dsc.php?tenantCode='+encodeURIComponent(tenantCode);
 async function load() {
  setLoading(true);setError('');
  try {
   const response=await fetch(endpoint,{cache:'no-store'});
   const payload=await readDscResponse(response);
   if(!response.ok||!payload.success) throw new Error(payload.error||'Unable to load DSC Register.');
   setData(payload);
  } catch(e) {setError(e instanceof Error?e.message:'Unable to load DSC Register.');}
  finally {setLoading(false);}
 }
 useEffect(()=>{setData(emptyData);setSelectedIds([]);void load();},[tenantCode]);
 function setField(key:string,value:any) {setForm((p:any)=>({...p,[key]:value}));}
 async function open(action:string,row:Certificate|null=null) {
  const seq=++request.current;
  setMode(action);setSelected(row);setError('');setNotice('');
  if(action==='clientReminders') {
   setPreview(null);setHistoryLoading(true);
   try {const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'previewClientReminders',ids:selectedIds,csrf:data.csrf})});const result=await readDscResponse(response);if(!response.ok||!result.success)throw new Error(result.error||'Unable to preview.');if(seq===request.current)setPreview(result);}catch(e){setError(e instanceof Error?e.message:'Unable to preview.');}finally{setHistoryLoading(false);}
  }
  if(action==='settings') setForm({...blank(),...data.settings,enabled:Boolean(Number(data.settings.enabled)),office_reminders:Boolean(Number(data.settings.office_reminders)),client_reminders:Boolean(Number(data.settings.client_reminders)),expired_reminder:Boolean(Number(data.settings.expired_reminder)),intervals:(data.settings.intervals||[]).join(',')});
  else if(action==='edit'&&row) setForm({...blank(),...row,issue_date:row.issue_date||'',responsible_user_id:String(row.responsible_user_id),document_movement_id:row.document_movement_id?String(row.document_movement_id):'',last_followup_date:row.last_followup_date||'',next_followup_date:row.next_followup_date||''});
  else setForm({...blank(),issue_date:action==='renew'?todayISO():'',last_followup_date:action==='followup'?todayISO():'',next_followup_date:action==='followup'?(row?.next_followup_date||''):''});
  if(action==='history'&&row) {
   setHistory([]);setReminders([]);setHistoryLoading(true);
   try {
    const response=await fetch(endpoint+'&id='+row.id,{cache:'no-store'});const payload=await readDscResponse(response);
    if(!response.ok||!payload.success) throw new Error(payload.error||'Unable to load history.');
    if(seq===request.current) {setHistory(payload.history||[]);setReminders(payload.reminders||[]);}
   } catch(e) {if(seq===request.current)setError(e instanceof Error?e.message:'Unable to load history.');}
   finally {if(seq===request.current)setHistoryLoading(false);}
  }
 }
 function close() {if(saving)return;request.current++;setMode('');setSelected(null);setError('');}
 async function save(e:React.FormEvent) {
  e.preventDefault();setSaving(true);setError('');setNotice('');
  try {
   const payload={...form,...(mode==='clientReminders'?{ids:preview?.recipients.map((r:any)=>r.id),batch:preview?.batch,token:preview?.token}:{}),action:mode==='clientReminders'?'sendClientReminders':mode,id:selected?.id,version:selected?.version,csrf:data.csrf,tenantCode};
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   const result=await readDscResponse(response);
   if(!response.ok||!result.success) throw new Error(result.error||'Unable to save DSC.');
   setMode('');setSelected(null);await load();
   if(mode==='clientReminders')setSelectedIds([]);
   setNotice(mode==='clientReminders'?result.queued+' client reminder(s) queued.':mode==='renew'?'Renewal recorded. The previous certificate is retained in Renewed / Closed.':mode==='trash'?'Moved to Trash. You can restore this entry.':mode==='restore'?'Entry restored.':mode==='settings'?'Reminder settings saved.':'DSC Register updated.');
  } catch(e) {setError(e instanceof Error?e.message:'Unable to save DSC.');}
  finally {setSaving(false);}
 }
 const rows=data.certificates||[];
 const today=todayISO();
 const filtered=rows.filter(r=>matchesDscTab(r,tab,today)&&(!clientFilter||r.client_name===clientFilter)&&(!dateFrom||r.expiry_date>=dateFrom)&&(!dateTo||r.expiry_date<=dateTo)&&[r.client_name,r.holder_name,r.organisation,r.designation,r.mobile,r.email,r.responsible_user_name,r.token_details,r.remarks].join(' ').toLowerCase().includes(search.toLowerCase()));
 const eligible=filtered.filter(r=>r.lifecycle==='active'&&!r.deleted_at);
 const userOptions=data.users.filter(activeUser).map(u=>({value:String(u.id),label:u.name}));
 const clientOptions=Array.from(new Set(data.clients.map(c=>String(c.name)))).map(name=>({value:name,label:name}));
 const selectedDocument=selected?.document_movement_id?data.documents.find(d=>Number(d.id)===Number(selected.document_movement_id)):null;
 function actions(row:Certificate):string[] {
  if(row.deleted_at)return ['restore'];
  if(row.lifecycle==='inactive')return ['edit','reactivate','trash'];
  if(row.lifecycle!=='active')return ['trash'];
  return ['edit','followup',...(!Number(row.pending_renewal)?['startRenewal']:[]),'renew','deactivate','close','trash'];
 }
 const field=(key:string,title:string,type='text',required=false,maxLength=190)=><label><span className={label}>{title}{required?' *':''}</span><input className={input} type={type} required={required} maxLength={maxLength} value={form[key]||''} onChange={e=>setField(key,e.target.value)}/></label>;
 return <div className="p-4 md:p-6 space-y-4">
  <div className="flex flex-wrap justify-between items-center gap-3">
   <div><h1 className="text-2xl font-bold text-indigo-700">DSC Register</h1><p className="text-sm text-indigo-600 mt-1">Responsible User: {data.settings.responsible_user_name||'Not set in DSC Settings'}</p></div>
   <div className="flex flex-wrap items-center gap-2">
    <span className={'text-xs px-3 py-2 rounded-full '+(Number(data.settings.enabled)?'bg-green-50 text-green-700':'bg-gray-100 text-gray-600')}>Office Reminders {Number(data.settings.enabled)?'On':'Off'}</span>
    {data.canConfigure&&<button disabled={loading||saving} className="p-2 border border-indigo-200 rounded-lg text-indigo-700" onClick={()=>void open('settings')} aria-label="Reminder settings"><Settings size={18}/></button>}
    <button disabled={loading||saving} className="p-2 border border-indigo-200 rounded-lg text-indigo-700" onClick={()=>void load()} aria-label="Refresh DSC Register"><RefreshCw size={18}/></button>
    <button disabled={!selectedIds.length||loading||saving||!data.csrf} onClick={()=>void open('clientReminders')} className="px-4 py-2 border border-indigo-200 text-indigo-700 rounded-lg disabled:opacity-50">Client Reminder ({selectedIds.length})</button>
    {selectedIds.length>0&&<button onClick={()=>setSelectedIds([])} className="text-sm text-indigo-700">Clear Selection</button>}
    <button disabled={loading||saving||!data.csrf} onClick={()=>void open('create')} className="flex gap-2 items-center px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50"><Plus size={18}/>Add DSC</button>
   </div>
  </div>
  {error&&!mode&&<p role="alert" className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700">{error}</p>}
  {notice&&<p role="status" className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700">{notice}</p>}
  <div role="tablist" aria-label="DSC views" className="flex flex-wrap gap-2">{tabItems.map(([id,title])=><button key={id} role="tab" aria-selected={id===tab} onClick={()=>setTab(id)} className={'px-3 py-2 text-sm font-semibold rounded-lg border '+(tab===id?'bg-indigo-600 text-white border-indigo-600':'bg-white text-indigo-700 border-indigo-200')}>{title} <span className="ml-1 opacity-75">{rows.filter(r=>matchesDscTab(r,id,today)).length}</span></button>)}</div>
  <div className="bg-white border border-indigo-100 rounded-xl p-3 space-y-3">
   <div className="relative"><Search size={18} className="absolute left-3 top-3 text-indigo-400"/><input aria-label="Search DSC Register" placeholder="Search clients, certificate holders or contact details..." className={input+' pl-10'} value={search} onChange={e=>setSearch(e.target.value)}/></div>
   <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
    <div><span className={label}>Client</span><SearchableSelect compact options={[{value:'',label:'All Clients'},...Array.from(new Set(rows.map(r=>r.client_name))).map(name=>({value:name,label:name}))]} value={clientFilter} onChange={setClientFilter}/></div>
    <label><span className={label}>Expiry From</span><input aria-label="Expiry from" type="date" className={input} value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/></label>
    <label><span className={label}>Expiry To</span><input aria-label="Expiry to" type="date" min={dateFrom} className={input} value={dateTo} onChange={e=>setDateTo(e.target.value)}/></label>
    <button onClick={()=>{setSearch('');setClientFilter('');setDateFrom('');setDateTo('');}} className="self-end border border-indigo-200 rounded-lg py-2 text-indigo-700 text-sm">Clear Filters</button>
   </div>
  </div>
  <div className="bg-white border border-indigo-200 rounded-xl overflow-x-auto">
   <table className="w-full text-sm text-left border-collapse">
    <thead className="bg-indigo-600 text-white"><tr><th className="p-3"><input aria-label="Select visible active DSCs" type="checkbox" checked={eligible.length>0&&eligible.every(r=>selectedIds.includes(r.id))} onChange={e=>setSelectedIds(p=>e.target.checked?Array.from(new Set([...p,...eligible.map(r=>r.id)])):p.filter(id=>!eligible.some(r=>r.id===id)))}/></th>{['Client','Certificate Holder / Contact','Certificate Dates','Days Left','Token Location','Next Follow-up','Status','Remarks','Actions'].map(h=><th key={h} className="p-3 border-r border-indigo-400 font-semibold whitespace-normal">{h}</th>)}</tr></thead>
    <tbody>{filtered.map(r=>{const status=dscStatus(r,today),left=daysLeft(r.expiry_date,today);return <tr key={r.id} className="border-b border-indigo-100 hover:bg-indigo-50">
     <td className="p-3">{r.lifecycle==='active'&&!r.deleted_at&&<input type="checkbox" aria-label={'Select DSC for '+r.holder_name} checked={selectedIds.includes(r.id)} onChange={e=>setSelectedIds(p=>e.target.checked?[...p,r.id]:p.filter(id=>id!==r.id))}/>}</td>
     <td className="p-3 font-medium">{r.client_name}</td>
     <td className="p-3"><div className="font-semibold">{r.holder_name}</div>{r.mobile&&<div className="text-xs text-gray-500">{r.mobile}</div>}{r.email&&<div className="text-xs text-gray-500 break-all">{r.email}</div>}</td>
     <td className="p-3 whitespace-nowrap"><div className="text-xs text-gray-500">Issued: {dateText(r.issue_date)}</div><div className="font-medium">Expiry: {dateText(r.expiry_date)}</div></td>
     <td className={'p-3 font-semibold '+(left<0?'text-red-600':left<=15?'text-amber-700':'text-gray-700')}>{r.lifecycle==='active'&&!r.deleted_at?(left<0?Math.abs(left)+' days overdue':left===0?'Today':left+' days'):'—'}</td>
     <td className="p-3">{r.token_location}{r.token_details&&<div className="text-xs text-gray-500">{r.token_details}</div>}{r.document_movement_id&&<button onClick={()=>void open('history',r)} className="block mt-1 text-xs text-indigo-600 underline">View custody</button>}</td>
     <td className={'p-3 whitespace-nowrap '+(r.lifecycle==='active'&&!r.deleted_at&&r.next_followup_date&&r.next_followup_date<today?'text-red-600':'')}>{dateText(r.next_followup_date)}</td>
     <td className="p-3"><span className={'inline-block rounded-full px-2 py-1 text-xs font-semibold '+(status==='Expired'?'bg-red-100 text-red-700':status==='Inactive'||status==='Trash'?'bg-gray-100 text-gray-600':status==='Renewed'||status==='Closed'?'bg-green-100 text-green-700':'bg-indigo-50 text-indigo-700')}>{status}</span></td>
     <td className="p-3 max-w-xs break-words">{r.remarks||'—'}</td>
     <td className="p-3 min-w-[145px]"><button className="flex gap-1 items-center text-indigo-700 font-medium mb-2" onClick={()=>void open('history',r)}><History size={15}/>Details & History</button><select aria-label={'Actions for '+r.holder_name} className={input} value="" onChange={e=>{if(e.target.value)void open(e.target.value,r);}}><option value="">Actions</option>{actions(r).map(a=><option key={a} value={a}>{actionTitles[a]}</option>)}</select></td>
    </tr>})}{!filtered.length&&<tr><td colSpan={10} className="text-center text-gray-500 p-8">{loading?'Loading DSC Register...':error?'Unable to load DSC entries. Please try Refresh.':'No DSC entries found.'}</td></tr>}</tbody>
   </table>
  </div>
  {mode&&<div className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="dsc-dialog-title">
   <form onSubmit={save} className={'bg-white rounded-2xl shadow-xl p-5 space-y-4 max-h-[90vh] overflow-y-auto w-full '+(mode==='create'||mode==='edit'||mode==='history'||mode==='clientReminders'?'max-w-3xl':'max-w-lg')}>
    <div className="flex justify-between gap-3 items-center"><h2 id="dsc-dialog-title" className="text-xl font-bold text-indigo-700">{actionTitles[mode]}</h2><button type="button" disabled={saving} aria-label="Close" onClick={close}><X/></button></div>
    {selected&&<p className="font-medium text-gray-700">{selected.client_name} · {selected.holder_name}</p>}
    {error&&<p role="alert" className="text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
    {(mode==='create'||mode==='edit')&&<div className="grid md:grid-cols-2 gap-4">
     <div><span className={label}>Client Name *</span><SearchableSelect compact required options={clientOptions} value={form.client_name} onChange={v=>setField('client_name',v)}/></div>
     {field('holder_name','Certificate Holder','text',true)}
     {field('organisation','Organisation')}{field('designation','Designation','text',false,120)}
     {field('mobile','Mobile','tel',false,30)}{field('email','Email','email')}
     {field('issue_date','Issued On','date')}{field('expiry_date','Expiry Date','date',true)}
     <label><span className={label}>Token Location</span><select className={input} value={form.token_location} onChange={e=>setField('token_location',e.target.value)}>{['Office','Client','Other'].map(v=><option key={v}>{v}</option>)}</select></label>
     {field('token_details','Location Details','text',false,255)}
     <div><span className={label}>Document Entry (Optional)</span><SearchableSelect compact options={[{value:'',label:'None'},...data.documents.map(d=>({value:String(d.id),label:d.document_name+' · '+dateText(d.movement_date)+' · '+d.direction}))]} value={form.document_movement_id} onChange={v=>setField('document_movement_id',v)}/></div>
     {field('last_followup_date','Last Follow-up Date','date')}{field('next_followup_date','Next Follow-up Date','date')}
     <label className="md:col-span-2"><span className={label}>Remarks</span><textarea className={input} rows={2} maxLength={10000} value={form.remarks} onChange={e=>setField('remarks',e.target.value)}/></label>
    </div>}
    {mode==='renew'&&<><p className="text-sm text-gray-600">Previous expiry: {dateText(selected?.expiry_date)}. The existing certificate will remain in history and a new active entry will be created.</p><div className="grid grid-cols-2 gap-3">{field('issue_date','New Issue Date','date',true)}{field('expiry_date','New Expiry Date','date',true)}</div>{field('notes','Renewal Remarks','text',false,10000)}</>}
    {mode==='followup'&&<><div className="grid grid-cols-2 gap-3">{field('last_followup_date','Follow-up Date','date',true)}{field('next_followup_date','Next Follow-up Date','date')}</div><label><span className={label}>Follow-up Remarks *</span><textarea required maxLength={10000} className={input} rows={3} value={form.notes} onChange={e=>setField('notes',e.target.value)}/></label></>}
    {mode==='deactivate'&&<><p className="text-sm text-gray-600">This stops expiry reminders and renewal follow-up. It does not revoke the DSC certificate.</p><label><span className={label}>Reason *</span><textarea required className={input} maxLength={1000} rows={3} value={form.reason} onChange={e=>setField('reason',e.target.value)}/></label></>}
    {mode==='reactivate'&&<p className="text-sm text-gray-600">Reactivate this entry and resume tracking using its existing expiry date?</p>}
    {mode==='trash'&&<p className="text-sm text-gray-600">Move this entry to Trash? Reminders will stop. Its details and history will be retained and you can restore it later.</p>}
    {mode==='restore'&&<p className="text-sm text-gray-600">Restore this entry to its previous status? Active entries will resume expiry tracking.</p>}
    {mode==='startRenewal'&&<p className="text-sm text-gray-600">Add this certificate to Pending Renewal?</p>}
    {mode==='close'&&<><p className="text-sm text-gray-600">Close this entry and stop reminders. Its details will remain under Renewed / Closed.</p><label><span className={label}>Closing Reason *</span><textarea required maxLength={10000} rows={3} className={input} value={form.notes} onChange={e=>setField('notes',e.target.value)}/></label></>}
    {mode==='clientReminders'&&<div className="space-y-3">{historyLoading?<p>Loading preview...</p>:preview?.recipients.map((r:any)=><div key={r.id} className="border rounded-lg p-3"><p className="font-semibold">{r.client_name} · {r.holder_name} · {r.mobile}</p><p className="whitespace-pre-wrap text-sm mt-2">{r.message}</p></div>)}</div>}
    {mode==='settings'&&<div className="space-y-4">
     <div><span className={label}>Responsible User{form.enabled&&form.office_reminders?' *':''}</span><SearchableSelect compact options={[{value:'',label:'None'},...userOptions]} value={String(form.responsible_user_id||'')} onChange={v=>setField('responsible_user_id',v)}/><p className="text-xs text-gray-500 mt-2">Applies to all DSCs in this organisation, including existing and renewed certificates.</p></div>
     {[['enabled','Enable office expiry reminders'],['office_reminders','Remind Responsible User'],['expired_reminder','Send one reminder after expiry']].map(([key,title])=><label key={key} className="flex gap-3 items-center text-sm"><input type="checkbox" checked={Boolean(form[key])} onChange={e=>setField(key,e.target.checked)}/>{title}</label>)}
     {field('intervals','Days Before Expiry (comma separated)','text',true,255)}
    </div>}
    {mode==='history'&&selected&&<div className="space-y-4">
     <dl className="grid grid-cols-2 gap-3 text-sm">{[['Organisation',selected.organisation],['Designation',selected.designation],['Issued On',dateText(selected.issue_date)],['Expiry Date',dateText(selected.expiry_date)],['Responsible User',selected.responsible_user_name],['Mobile',selected.mobile],['Email',selected.email],['Token Location',selected.token_location],['Location Details',selected.token_details],['Last Follow-up',dateText(selected.last_followup_date)],['Next Follow-up',dateText(selected.next_followup_date)],['Remarks',selected.remarks],['Deactivation Reason',selected.inactive_reason],['Deactivated By',selected.inactive_by_name],['Deactivated On',dateText(selected.inactive_on)]].map(([title,value])=><div key={title}><dt className="text-xs text-gray-500">{title}</dt><dd className="font-medium break-words">{value||'—'}</dd></div>)}</dl>
     {(selected.previous_certificate_id||selected.renewed_to_id)&&<p className="text-sm text-indigo-700">{selected.previous_certificate_id?'This entry was created through renewal.':'This certificate has been renewed.'} Related certificate records remain in All DSCs and Renewed / Closed.</p>}
     {selectedDocument&&<div className="rounded-xl border border-indigo-100 p-3 text-sm"><h3 className="font-bold text-indigo-700 flex items-center gap-1"><FileText size={16}/>Linked Document</h3><p>{selectedDocument.document_name} · {dateText(selectedDocument.movement_date)} · {selectedDocument.direction}</p><p>Office User: {selectedDocument.office_user_name} · Outside Person: {selectedDocument.external_person}</p><p>{selectedDocument.returned_on?'Returned on '+dateText(selectedDocument.returned_on):'Return not recorded'}</p></div>}
     <h3 className="font-bold text-indigo-700">History</h3>
     {historyLoading?<p className="text-gray-500">Loading history...</p>:!history.length?<p className="text-gray-500 text-sm">No history found.</p>:history.map((event,i)=><div key={i} className="border-l-2 border-indigo-200 pl-3 py-2 text-sm"><div className="font-semibold">{event.action} · {event.actor_name}</div><div className="text-xs text-gray-500">{dateText(event.created_at)}</div>{event.notes&&<p className="whitespace-pre-wrap">{event.notes}</p>}{event.snapshot&&<details className="mt-1"><summary className="text-xs text-indigo-600 cursor-pointer">Recorded details</summary><dl className="grid grid-cols-2 gap-2 bg-gray-50 p-2 rounded">{eventDetails(event.snapshot).map(([title,value])=><div key={title}><dt className="text-xs text-gray-500">{title}</dt><dd className="text-xs break-words">{value}</dd></div>)}</dl></details>}</div>)}
     <h3 className="font-bold text-indigo-700">Reminder History</h3>
     {!historyLoading&&!reminders.length&&<p className="text-sm text-gray-500">No reminders queued for this certificate.</p>}
     {reminders.map((r,i)=><div key={i} className="border border-indigo-100 rounded-lg p-3 text-sm"><p className="font-medium">{r.target_name} · {r.audience==='office'?'Responsible User':'Certificate Holder'} · {r.target}</p><p>{Number(r.stage)===-2?'Manual client reminder':Number(r.stage)<0?'After expiry':r.stage+'-day reminder'} · {r.status==='sent'?'Submitted to provider':r.status==='pending'?'Queued':r.status||'Unavailable'} · {dateText(r.created_at)}</p>{r.lastError&&<p className="text-red-600 break-words">{r.lastError}</p>}</div>)}
    </div>}
    <div className="flex justify-end gap-3 pt-2"><button type="button" disabled={saving} className="px-4 py-2 text-gray-600" onClick={close}>{mode==='history'?'Close':'Cancel'}</button>{mode!=='history'&&<button disabled={saving||(mode==='clientReminders'&&!preview)} className="px-5 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-50">{saving?'Saving...':mode==='clientReminders'?'Send '+(preview?.recipients.length||0)+' Client Reminders':mode==='create'||mode==='edit'||mode==='settings'?'Save':'Confirm'}</button>}</div>
   </form>
  </div>}
 </div>;
}
