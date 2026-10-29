import React, { useEffect, useState } from 'react';
import { Plus, X, RefreshCw, Search, CheckCircle, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { User, Firm } from '../types';
import { localDate, matchesTab, documentStatus } from './documentRules.mjs';

type DocumentRow = {
 id: number; movement_date: string; direction: 'In'|'Out'; document_name: string;
 client_name: string; external_person: string; office_user_id: number; office_user_name: string;
 return_user_name?: string; returnable: number|string; return_due_date: string|null; returned_on: string|null; remarks: string;
};
const tabs = [{id:'all',label:'All Documents'},{id:'sending',label:'Pending Sending'},{id:'receipt',label:'Pending Receipt'},{id:'returned',label:'Returned'}];
const blankForm = () => ({movement_date:localDate(),direction:'In' as 'In'|'Out',document_name:'',client_name:'',external_person:'',office_user_id:'',returnable:false,return_due_date:'',remarks:''});
const displayDate = (value: string|null) => value ? value.slice(0,10).split('-').reverse().join('/') : '—';

export function DocumentsView({users, clients, tenantCode}: {users:User[]; clients:Firm[]; tenantCode:string}) {
 const [rows,setRows]=useState<DocumentRow[]>([]);
 const [tab,setTab]=useState('all');
 const [search,setSearch]=useState('');
 const [direction,setDirection]=useState('');
 const [clientFilter,setClientFilter]=useState('');
 const [userFilter,setUserFilter]=useState('');
 const [from,setFrom]=useState('');
 const [to,setTo]=useState('');
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(false);
 const [saving,setSaving]=useState(false);
 const [csrf,setCsrf]=useState('');
 const [open,setOpen]=useState(false);
 const [form,setForm]=useState(blankForm);
 const [returnRow,setReturnRow]=useState<DocumentRow|null>(null);
 const [returnUser,setReturnUser]=useState('');
 const [returnedOn,setReturnedOn]=useState(localDate());
 const endpoint='/api/documents.php?tenantCode='+encodeURIComponent(tenantCode);
 async function load() {
  setLoading(true); setError('');
  try {
   const response=await fetch(endpoint,{cache:'no-store'});
   const data=await response.json();
   if(!response.ok || !data.success) throw new Error(data.error || 'Unable to load documents.');
   setRows(data.documents || []); setCsrf(data.csrf || '');
  } catch(e) {setError(e instanceof Error?e.message:'Unable to load documents.');}
  finally {setLoading(false);}
 }
 useEffect(()=>{setRows([]);setCsrf('');void load();},[tenantCode]);
 async function submit(payload:object) {
  setSaving(true);setError('');
  try {
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,csrf,tenantCode})});
   const data=await response.json();
   if(!response.ok || !data.success) throw new Error(data.error || 'Unable to save document.');
   setOpen(false);setReturnRow(null);setForm(blankForm());await load();
  } catch(e) {setError(e instanceof Error?e.message:'Unable to save document.');}
  finally {setSaving(false);}
 }
 const filtered=rows.filter(r=>matchesTab(r,tab)
  && (!direction || r.direction===direction)
  && (!clientFilter || r.client_name===clientFilter)
  && (!userFilter || String(r.office_user_id)===userFilter)
  && (!from || r.movement_date>=from) && (!to || r.movement_date<=to)
  && [r.document_name,r.client_name,r.external_person,r.office_user_name,r.remarks].join(' ').toLowerCase().includes(search.toLowerCase()));
 const input='w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300';
 const label='block text-sm font-medium text-gray-700 mb-1';
 const activeUsers=users.filter(u=>u.isActive);
 const formField=(key:string,value:unknown)=>setForm(p=>({...p,[key]:value}));
 const busy=loading||saving;
 return <div className="p-4 md:p-6 space-y-4">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <h1 className="text-2xl font-bold text-indigo-700">Documents</h1>
   <div className="flex gap-2">
    <button type="button" disabled={busy} onClick={()=>void load()} className="p-2 border border-indigo-200 rounded-lg text-indigo-600 disabled:opacity-50" aria-label="Refresh documents"><RefreshCw size={18}/></button>
    <button type="button" disabled={busy||!csrf} onClick={()=>{setError('');setForm(blankForm());setOpen(true);}} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50"><Plus size={18}/>Add Document</button>
   </div>
  </div>
  {error&&<div role="alert" className="rounded-lg bg-red-50 border border-red-200 text-red-700 p-3">{error}</div>}
  <div role="tablist" aria-label="Document views" className="flex flex-wrap gap-2">{tabs.map(t=><button key={t.id} role="tab" aria-selected={tab===t.id} onClick={()=>setTab(t.id)} className={'px-4 py-2 rounded-lg border text-sm font-semibold '+(tab===t.id?'bg-indigo-600 text-white border-indigo-600':'bg-white text-indigo-700 border-indigo-200')}>{t.label}<span className="ml-2 opacity-75">{rows.filter(r=>matchesTab(r,t.id)).length}</span></button>)}</div>
  <div className="bg-white rounded-xl border border-indigo-100 p-3 space-y-3">
   <div className="relative"><Search className="absolute left-3 top-2.5 text-indigo-400" size={18}/><input aria-label="Search documents" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search documents, clients or people..." className={input+' pl-10'}/></div>
   <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
    <label className="text-xs text-gray-600">In / Out<select aria-label="Filter movement" className={input} value={direction} onChange={e=>setDirection(e.target.value)}><option value="">All</option><option>In</option><option>Out</option></select></label>
    <label className="text-xs text-gray-600">Client<select aria-label="Filter client" className={input} value={clientFilter} onChange={e=>setClientFilter(e.target.value)}><option value="">All Clients</option>{Array.from(new Set(rows.map(r=>r.client_name).filter(Boolean))).sort().map(n=><option key={n}>{n}</option>)}</select></label>
    <label className="text-xs text-gray-600">Office User<select aria-label="Filter office user" className={input} value={userFilter} onChange={e=>setUserFilter(e.target.value)}><option value="">All Users</option>{Array.from(new Map(rows.map(r=>[String(r.office_user_id),r.office_user_name])).entries()).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
    <label className="text-xs text-gray-600">From Date<input aria-label="From date" type="date" value={from} onChange={e=>setFrom(e.target.value)} className={input}/></label>
    <label className="text-xs text-gray-600">To Date<input aria-label="To date" type="date" value={to} min={from} onChange={e=>setTo(e.target.value)} className={input}/></label>
    <button onClick={()=>{setSearch('');setDirection('');setClientFilter('');setUserFilter('');setFrom('');setTo('');}} className="self-end py-2 rounded-lg border border-indigo-200 text-indigo-600 text-sm">Clear Filters</button>
   </div>
  </div>
  <div className="bg-white border border-indigo-200 rounded-xl overflow-x-auto">
   <table className="w-full text-left text-sm border-collapse">
    <thead className="bg-indigo-600 text-white"><tr>{['Date','In / Out','Document Name','Client','Received From / Handed To','Office User','Returnable','Return Due Date','Returned On','Received By / Given By','Status','Remarks','Actions'].map(h=><th key={h} className="p-3 font-semibold border-r border-indigo-400 whitespace-normal">{h}</th>)}</tr></thead>
    <tbody>{filtered.map(r=>{const status=documentStatus(r);return <tr key={r.id} className="border-b border-indigo-100 hover:bg-indigo-50">
     <td className="p-3 whitespace-nowrap">{displayDate(r.movement_date)}</td>
     <td className="p-3"><span className={'inline-flex gap-1 items-center font-semibold '+(r.direction==='In'?'text-emerald-700':'text-blue-700')}>{r.direction==='In'?<ArrowDownLeft size={15}/>:<ArrowUpRight size={15}/>} {r.direction}</span></td>
     <td className="p-3 font-medium break-words">{r.document_name}</td><td className="p-3">{r.client_name||'—'}</td><td className="p-3">{r.external_person}</td><td className="p-3">{r.office_user_name}</td>
     <td className="p-3">{Number(r.returnable)?'Yes':'No'}</td><td className="p-3 whitespace-nowrap">{displayDate(r.return_due_date)}</td><td className="p-3 whitespace-nowrap">{displayDate(r.returned_on)}</td><td className="p-3">{r.return_user_name ? (r.direction==='In'?'Given by: ':'Received by: ')+r.return_user_name : '—'}</td>
     <td className="p-3"><span className={'inline-block rounded-full px-2 py-1 text-xs whitespace-nowrap '+(status==='Overdue'?'bg-red-100 text-red-700':status==='Returned'?'bg-green-100 text-green-700':'bg-gray-100 text-gray-700')}>{status}</span></td><td className="p-3 break-words">{r.remarks||'—'}</td>
     <td className="p-3">{Number(r.returnable)===1&&!r.returned_on?<button disabled={busy} onClick={()=>{setError('');setReturnedOn(localDate());setReturnUser('');setReturnRow(r);}} className="inline-flex gap-1 text-indigo-700 font-medium whitespace-nowrap"><CheckCircle size={16}/>Mark Returned</button>:'—'}</td>
    </tr>})}{!filtered.length&&<tr><td colSpan={13} className="p-8 text-center text-gray-500">{loading?'Loading documents...':'No documents found.'}</td></tr>}</tbody>
   </table>
  </div>
  {open&&<div className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="document-form-title">
   <form onSubmit={e=>{e.preventDefault();void submit({...form,action:'create'});}} className="w-full max-w-2xl bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto p-5 space-y-4">
    <div className="flex justify-between"><h2 id="document-form-title" className="text-xl font-bold text-indigo-700">Add Document</h2><button type="button" disabled={saving} onClick={()=>setOpen(false)} aria-label="Close"><X/></button></div>
    {error&&<p role="alert" className="text-red-600">{error}</p>}
    <div className="grid md:grid-cols-2 gap-4">
     <label><span className={label}>Date *</span><input required type="date" className={input} value={form.movement_date} onChange={e=>formField('movement_date',e.target.value)}/></label>
     <label><span className={label}>In / Out *</span><select className={input} value={form.direction} onChange={e=>formField('direction',e.target.value)}><option>In</option><option>Out</option></select></label>
     <label className="md:col-span-2"><span className={label}>Document Name *</span><input required maxLength={255} className={input} value={form.document_name} onChange={e=>formField('document_name',e.target.value)}/></label>
     <label><span className={label}>Client Name (Optional)</span><select className={input} value={form.client_name} onChange={e=>formField('client_name',e.target.value)}><option value="">Select</option>{clients.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></label>
     <label><span className={label}>{form.direction==='In'?'Received From':'Handed To'} *</span><input required maxLength={190} className={input} value={form.external_person} onChange={e=>formField('external_person',e.target.value)}/></label>
     <label><span className={label}>{form.direction==='In'?'Receiving User':'Giving User'} *</span><select required className={input} value={form.office_user_id} onChange={e=>formField('office_user_id',e.target.value)}><option value="">Select</option>{activeUsers.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
     <label><span className={label}>Returnable?</span><select className={input} value={form.returnable?'Yes':'No'} onChange={e=>formField('returnable',e.target.value==='Yes')}><option>No</option><option>Yes</option></select></label>
     {form.returnable&&<label><span className={label}>Return Due Date *</span><input required min={form.movement_date} type="date" className={input} value={form.return_due_date} onChange={e=>formField('return_due_date',e.target.value)}/></label>}
     <label className="md:col-span-2"><span className={label}>Remarks</span><textarea maxLength={10000} className={input} value={form.remarks} onChange={e=>formField('remarks',e.target.value)} rows={2}/></label>
    </div>
    <div className="flex justify-end gap-3"><button disabled={saving} type="button" onClick={()=>setOpen(false)} className="px-4 py-2 text-gray-600">Cancel</button><button disabled={saving} className="px-5 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50">{saving?'Saving...':'Save'}</button></div>
   </form>
  </div>}
  {returnRow&&<div className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="return-title">
   <form className="w-full max-w-md bg-white rounded-2xl p-6 space-y-4" onSubmit={e=>{e.preventDefault();void submit({action:'return',id:returnRow.id,returned_on:returnedOn,return_user_id:returnUser});}}>
    <h2 id="return-title" className="text-xl font-bold text-indigo-700">Mark Returned</h2><p className="font-medium">{returnRow.document_name}</p>
    {error&&<p role="alert" className="text-red-600">{error}</p>}
    <label className={label}>Returned On *<input required type="date" min={returnRow.movement_date} className={input} value={returnedOn} onChange={e=>setReturnedOn(e.target.value)}/></label>
    <label className={label}>{returnRow.direction==='In'?'Given By':'Received By'} *<select required className={input} value={returnUser} onChange={e=>setReturnUser(e.target.value)}><option value="">Select</option>{activeUsers.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
    <div className="flex justify-end gap-3"><button disabled={saving} type="button" onClick={()=>setReturnRow(null)}>Cancel</button><button disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50">{saving?'Saving...':'Confirm Return'}</button></div>
   </form>
  </div>}
 </div>;
}
