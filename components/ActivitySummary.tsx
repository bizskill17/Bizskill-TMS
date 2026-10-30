import React, {useMemo, useState} from 'react';
import {Download, FileText, Filter, Search} from 'lucide-react';
import {ActionLogEntry} from '../types';
import {parseToISO} from '../App';

type Period = 'today' | 'yesterday' | 'week' | 'month' | 'custom';
type ActivityRow = {name: string; updates: number; minutes: number};
const shiftDate = (iso: string, days: number) => {
  const date = new Date(iso+'T12:00:00Z');
  date.setUTCDate(date.getUTCDate()+days);
  return date.toISOString().slice(0,10);
};
const formatTime = (minutes: number) => {
  const rounded = Math.round(minutes);
  return String(Math.floor(rounded/60)).padStart(2,'0')+':'+String(rounded%60).padStart(2,'0');
};

export const ActivitySummary = ({logs, today, onOpenLogs}: {
  logs: ActionLogEntry[];
  today: string;
  onOpenLogs: (name: string, from: string, to: string) => void;
}) => {
  const [period,setPeriod] = useState<Period>('today');
  const [showFilters,setShowFilters] = useState(false);
  const [from,setFrom] = useState(today);
  const [to,setTo] = useState(today);
  const [search,setSearch] = useState('');
  const [exporting,setExporting] = useState(false);
  const [exportError,setExportError] = useState('');
  const range = period==='custom' ? {from,to} :
    period==='yesterday' ? {from:shiftDate(today,-1),to:shiftDate(today,-1)} :
    {from:period==='week' ? shiftDate(today,-6) : period==='month' ? today.slice(0,7)+'-01' : today,to:today};
  const invalidRange = Boolean(range.from && range.to && range.from>range.to);
  const rows = useMemo(() => {
    if(invalidRange) return [];
    const users = new Map<string,ActivityRow>();
    for(const log of logs){
      const date = parseToISO(String(log.updateDate || (log as any).updatedOn || ''));
      if(!date || (range.from && date<range.from) || (range.to && date>range.to)) continue;
      const names = [...new Set(String(log.assignees || log.owner || 'Unknown').split(',').map(name=>name.trim()).filter(Boolean))];
      const rawMinutes = Number(log.hours);
      const minutes = Number.isFinite(rawMinutes) ? Math.max(0,rawMinutes) : 0;
      for(const name of names){
        const row = users.get(name) || {name,updates:0,minutes:0};
        row.updates++;row.minutes+=minutes;users.set(name,row);
      }
    }
    return [...users.values()].filter(row=>row.name.toLowerCase().includes(search.trim().toLowerCase())).sort((a,b)=>b.updates-a.updates || a.name.localeCompare(b.name));
  },[logs,range.from,range.to,search,invalidRange]);
  const totals = rows.reduce((sum,row)=>({updates:sum.updates+row.updates,minutes:sum.minutes+row.minutes}),{updates:0,minutes:0});
  const exportRows = () => rows.map(row=>[row.name,String(row.updates),formatTime(row.minutes)]);
  const exportCSV = () => {
    const csv = [['User','Updates','Time Spent'],...exportRows()].map(row=>row.map(cell=>'"'+String(cell).replace(/"/g,'""')+'"').join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
    const link = document.createElement('a');link.href=url;link.download='Activity_'+today+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const exportPDF = async () => {
    setExporting(true);setExportError('');
    try{
      const [{jsPDF},{default:autoTable}] = await Promise.all([import('jspdf'),import('jspdf-autotable')]);
      const doc = new jsPDF();
      doc.text('Activity Dashboard',14,14);
      const displayDate = (date: string) => date ? date.split('-').reverse().join('/') : 'All dates';
      doc.setFontSize(10);doc.text(displayDate(range.from)+' to '+displayDate(range.to),14,22);
      autoTable(doc,{head:[['User','Updates','Time Spent']],body:exportRows(),startY:28,theme:'grid',headStyles:{fillColor:[79,70,229]}});
      doc.save('Activity_'+today+'.pdf');
    }catch{setExportError('Could not export. Please try again.');}finally{setExporting(false);}
  };
  return <section aria-label="Activity Dashboard" className="min-w-0 rounded-xl border border-blue-200 bg-white overflow-hidden">
    <div className="p-3 space-y-3">
      <h3 className="font-bold text-blue-700">Activity Dashboard</h3>
      <div className="flex items-center gap-2 min-w-0">
        <select aria-label="Activity period" value={period} onChange={e=>{
          const next=e.target.value as Period;setPeriod(next);
          if(next==='custom'){setFrom(range.from);setTo(range.to);setShowFilters(true);}
        }} className="min-w-0 flex-1 rounded-md border border-indigo-200 bg-white px-2 py-2 text-sm text-indigo-700">
          <option value="today">Today</option><option value="yesterday">Yesterday</option><option value="week">Last 7 days</option><option value="month">This month</option><option value="custom">Custom dates</option>
        </select>
        <button type="button" aria-label="Toggle activity filters" aria-expanded={showFilters} onClick={()=>setShowFilters(value=>!value)} className="shrink-0 rounded-md border border-indigo-200 p-2 text-indigo-700"><Filter size={18}/></button>
        <button type="button" aria-label="Export activity PDF" title="Export PDF" disabled={!rows.length || exporting} onClick={exportPDF} className="shrink-0 rounded-md border border-indigo-200 p-2 text-indigo-700 disabled:opacity-40"><Download size={18}/></button>
        <button type="button" aria-label="Export activity Excel" title="Export Excel" disabled={!rows.length} onClick={exportCSV} className="shrink-0 rounded-md border border-indigo-200 p-2 text-indigo-700 disabled:opacity-40"><FileText size={18}/></button>
      </div>
      {showFilters && <div className="space-y-2">
        <div className="relative"><Search size={16} aria-hidden="true" className="absolute left-2 top-2.5 text-indigo-500"/><input aria-label="Search activity by user" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search users..." className="w-full min-w-0 rounded-md border border-indigo-200 pl-8 pr-2 py-2 text-sm"/></div>
        {period==='custom' && <div className="grid grid-cols-2 gap-2">
          <label className="min-w-0 text-xs text-gray-600">From<input aria-label="Activity from" type="date" value={from} onChange={e=>setFrom(e.target.value)} className="block w-full min-w-0 rounded-md border border-indigo-200 p-2 text-sm"/></label>
          <label className="min-w-0 text-xs text-gray-600">To<input aria-label="Activity to" type="date" value={to} onChange={e=>setTo(e.target.value)} className="block w-full min-w-0 rounded-md border border-indigo-200 p-2 text-sm"/></label>
        </div>}
      </div>}
      {exportError && <p role="alert" className="text-sm text-red-600">{exportError}</p>}
      {invalidRange && <p role="alert" className="text-sm text-red-600">From date must be on or before To date.</p>}
    </div>
    <table className="w-full table-fixed border-collapse text-sm">
      <colgroup><col style={{width:'50%'}}/><col style={{width:'22%'}}/><col style={{width:'28%'}}/></colgroup>
      <thead className="bg-indigo-600 text-white"><tr>{['User','Updates','Time Spent'].map((label,index)=><th key={label} className={'px-2 py-2 font-semibold whitespace-normal '+(index?'text-center':'text-left')}>{label}</th>)}</tr></thead>
      <tbody className="divide-y divide-blue-100">
        {rows.map(row=><tr key={row.name} className="hover:bg-indigo-50">
          <td className="px-2 py-2 [overflow-wrap:anywhere]"><button type="button" aria-label={'View activity for '+row.name} onClick={()=>onOpenLogs(row.name,range.from,range.to)} className="text-left font-medium text-indigo-700 underline underline-offset-2">{row.name}</button></td>
          <td className="px-2 py-2 text-center tabular-nums">{row.updates}</td><td className="px-2 py-2 text-center tabular-nums">{formatTime(row.minutes)}</td>
        </tr>)}
        {!rows.length && <tr><td colSpan={3} className="px-3 py-3 text-center text-sm text-gray-500">No activity for this period.</td></tr>}
      </tbody>
      {rows.length>0 && <tfoot className="border-t border-blue-200 bg-blue-50 font-semibold"><tr><td className="px-2 py-2">Total</td><td className="px-2 py-2 text-center tabular-nums">{totals.updates}</td><td className="px-2 py-2 text-center tabular-nums">{formatTime(totals.minutes)}</td></tr></tfoot>}
    </table>
  </section>;
};
