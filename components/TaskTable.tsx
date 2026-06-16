import React, { useState } from 'react';
import { Task, Project, User as UserType } from '../types';
import { Edit2, Info, Calendar, Clock, User, Users, ArrowUpDown, ArrowUp, ArrowDown, Loader2, Trash2, Tag, Layout, Building2, AlertTriangle, ChevronDown, ChevronUp, Hammer, X } from 'lucide-react';
import { formatToIndianDate } from '../App';
import { useLabels } from '../labelOverrides';

interface TaskTableProps {
  tasks: Task[];
  onUpdateTask: (task: Task) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: number, isVendor: boolean) => void;
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
  onViewHistory: (task: Task) => void;
  showSelection?: boolean;
  isVendorView?: boolean;
  viewMode?: 'card' | 'table';
  projects?: Project[];
  syncingIds?: Set<number>;
  currentUser?: UserType | null;
  sortKey: keyof Task;
  sortDir: 'asc' | 'desc';
  onSort: (key: keyof Task, dir: 'asc' | 'desc') => void;
  startIndex: number;
}

export const TaskTable: React.FC<TaskTableProps> = ({ 
  tasks, 
  onUpdateTask, 
  onEditTask,
  onDeleteTask,
  selectedIds, 
  onSelectionChange, 
  onViewHistory,
  showSelection = false,
  isVendorView = false,
  viewMode = 'card',
  projects = [],
  syncingIds = new Set(),
  currentUser,
  sortKey,
  sortDir,
  onSort,
  startIndex
}) => {
  const { getFieldLabel } = useLabels();
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [photoViewer, setPhotoViewer] = useState<{ photos: string[]; index: number } | null>(null);

  const toggleExpand = (id: number) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedIds(newExpanded);
  };

  const requestSort = (key: keyof Task) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortKey === key && sortDir === 'asc') {
      direction = 'desc';
    }
    onSort(key, direction);
  };

  const getSortIcon = (key: keyof Task) => {
    if (sortKey !== key) return <ArrowUpDown size={14} className="ml-1 opacity-50 text-white" />;
    return sortDir === 'asc' ? <ArrowUp size={14} className="ml-1 text-white" /> : <ArrowDown size={14} className="ml-1 text-white" />;
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) onSelectionChange(tasks.map(t => t.id));
    else onSelectionChange([]);
  };

  const handleSelectOne = (id: number) => {
    if (selectedIds.includes(id)) onSelectionChange(selectedIds.filter(i => i !== id));
    else onSelectionChange([...selectedIds, id]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-green-100 text-green-700';
      case 'In Progress': return 'bg-blue-100 text-blue-700';
      case 'Pending for Client': return 'bg-purple-100 text-purple-700';
      case 'Pending for Owner': return 'bg-indigo-100 text-indigo-700';
      case 'Pending for Training': return 'bg-cyan-100 text-cyan-700';
      case 'Pending for Billing': return 'bg-orange-100 text-orange-700';
      case 'Pending for Payment': return 'bg-emerald-100 text-emerald-700';
      case 'Started': return 'bg-blue-50 text-blue-600';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const formatDate = (dateStr: string) => {
    return formatToIndianDate(dateStr);
  };

  const getClientDisplay = (task: Task) => {
    const direct = String(task.clientName || '').trim();
    if (direct) return direct;
    const rawProject = String(task.project || '').trim();
    const match = rawProject.match(/^(.*?)\s*\((.*?)\)\s*$/);
    if (match?.[2]) return String(match[2]).trim();
    return String(task.firm || '').trim();
  };

  const parseNumber = (value: unknown): number => {
    const num = Number(String(value ?? '').trim());
    return Number.isFinite(num) ? num : 0;
  };

  const getAchievedPercent = (goalValue: unknown, achievedValue: unknown): string => {
    const goal = parseNumber(goalValue);
    const achieved = parseNumber(achievedValue);
    if (goal <= 0) return '-';
    return `${((achieved / goal) * 100).toFixed(2)}%`;
  };

  const isUpdatedToday = (lastUpdateDate?: string) => {
    if (!lastUpdateDate) return false;
    const today = new Date().toLocaleDateString('en-GB'); // dd/MM/yyyy
    return lastUpdateDate.startsWith(today);
  };

	  const parsePhotos = (rawPhotos?: string): string[] => {
	    if (!rawPhotos) return [];
	    try {
	      const parsed = JSON.parse(rawPhotos);
	      return Array.isArray(parsed) ? parsed.filter(photo => typeof photo === 'string' && photo.trim() !== '') : [];
	    } catch {
	      return [];
	    }
	  };

	  const normalizePdfHref = (raw?: string): string => {
	    if (!raw) return '';
	    const s = String(raw).trim();
	    if (!s) return '';
	    if (s.startsWith('data:')) return s;
	    if (/^https?:\/\//i.test(s)) return s;
	    if (/^[A-Za-z0-9+/=\r\n]+$/.test(s)) {
	      return `data:application/pdf;base64,${s.replace(/\s+/g, '')}`;
	    }
	    return s;
	  };

	  const openPdf = async (raw?: string) => {
	    const href = normalizePdfHref(raw);
	    if (!href) return;
	    try {
	      const res = await fetch(href);
	      const blob = await res.blob();
	      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
	      window.open(url, '_blank', 'noopener,noreferrer');
	      // Best-effort cleanup (browser may block immediate revoke if still loading).
	      setTimeout(() => URL.revokeObjectURL(url), 60_000);
	    } catch (err) {
	      window.open(href, '_blank', 'noopener,noreferrer');
	    }
	  };

  const openPhotos = (rawPhotos?: string, index = 0) => {
    const photos = parsePhotos(rawPhotos);
    if (photos.length === 0) return;
    setPhotoViewer({ photos, index: Math.max(0, Math.min(index, photos.length - 1)) });
  };

	  const thClass = "px-4 py-3 text-xs font-black text-white uppercase tracking-widest border-r border-black last:border-r-0 cursor-pointer hover:bg-blue-800 transition-colors select-none whitespace-normal !bg-blue-700 sticky top-0 z-10";
	  const tdClass = "px-4 py-3 text-sm text-black border-r border-black last:border-r-0 align-top whitespace-normal break-words";

  return (
    <>
      <div className={`bg-white rounded-lg border border-black shadow-sm overflow-hidden ${viewMode === 'card' ? 'hidden md:block' : 'block'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-max table-fixed">
            <thead>
              <tr className="!bg-blue-700">
                {showSelection && (
                  <th className="px-4 py-3 w-10 text-center border-r border-black !bg-blue-700">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300 text-blue-600 h-4 w-4" 
                      checked={tasks.length > 0 && selectedIds.length === tasks.length} 
                      onChange={handleSelectAll}
                    />
                  </th>
                )}
	                <th className="px-4 py-3 text-xs font-black text-white uppercase tracking-widest border-r border-black w-16 text-center whitespace-nowrap !bg-blue-700 sticky top-0 z-10">S.No.</th>
	                <th className={thClass} style={{ width: '350px' }} onClick={() => requestSort('title')}><div className="flex items-center">Task {getSortIcon('title')}</div></th>
	                <th className={thClass} style={{ width: '320px' }} onClick={() => requestSort('remarks')}><div className="flex items-center">Notes {getSortIcon('remarks')}</div></th>
	                <th className={thClass} style={{ width: '120px' }} onClick={() => requestSort('date')}><div className="flex items-center">Date {getSortIcon('date')}</div></th>
                    <th className={thClass} style={{ width: '160px' }} onClick={() => requestSort('firm')}><div className="flex items-center">Client {getSortIcon('firm')}</div></th>
		                <th className={thClass} style={{ width: '150px' }} onClick={() => requestSort('category')}><div className="flex items-center">{getFieldLabel('task.category', 'Category')} {getSortIcon('category')}</div></th>
	                <th className={thClass} style={{ width: '100px' }} onClick={() => requestSort('priority')}><div className="flex items-center">Priority {getSortIcon('priority')}</div></th>
	                <th className={thClass} style={{ width: '100px' }} onClick={() => requestSort('time')}><div className="flex items-center">Time {getSortIcon('time')}</div></th>
	                <th className={thClass} style={{ width: '120px' }}><div className="flex items-center">Photo</div></th>
	                <th className={thClass} style={{ width: '120px' }}><div className="flex items-center">PDF</div></th>
		                <th className={thClass} style={{ width: '140px' }} onClick={() => requestSort('goal')}><div className="flex items-center">Goal {getSortIcon('goal')}</div></th>
		                <th className={thClass} style={{ width: '140px' }}><div className="flex items-center">Achieved</div></th>
		                <th className={thClass} style={{ width: '120px' }}><div className="flex items-center">Achieved %</div></th>
	                <th className={thClass} style={{ width: '120px' }} onClick={() => requestSort('dueDate')}><div className="flex items-center">Due Date {getSortIcon('dueDate')}</div></th>
	                <th className={thClass} style={{ width: '150px' }} onClick={() => requestSort('lastUpdateDate')}><div className="flex items-center">Last Update {getSortIcon('lastUpdateDate')}</div></th>
	                <th className={thClass} style={{ width: '120px' }} onClick={() => requestSort('status')}><div className="flex items-center">Status {getSortIcon('status')}</div></th>
	                <th className={thClass} style={{ width: '300px' }} onClick={() => requestSort('lastUpdateRemarks')}><div className="flex items-center">Remark {getSortIcon('lastUpdateRemarks')}</div></th>
	                <th className={thClass} style={{ width: '100px' }} onClick={() => requestSort('hours')}><div className="flex items-center">Minutes {getSortIcon('hours')}</div></th>
	                <th className={thClass} style={{ width: '180px' }} onClick={() => requestSort('owner')}><div className="flex items-center">Owner {getSortIcon('owner')}</div></th>
	                <th className={thClass} style={{ width: '180px' }} onClick={() => requestSort(isVendorView ? 'vendor' : 'assignees')}><div className="flex items-center">{isVendorView ? 'Vendor' : 'Assignee'} {getSortIcon(isVendorView ? 'vendor' : 'assignees')}</div></th>
	                <th className="px-4 py-3 text-xs font-black text-white uppercase tracking-widest border-r border-black last:border-r-0 text-center !bg-blue-700 sticky top-0 z-10" style={{ width: '190px' }}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black">
              {tasks.map((task, idx) => {
                const isSyncing = syncingIds.has(task.id);
                const canDelete = currentUser?.role === 'Admin';
                const displayCategory = task.vendor ? (task.vendorCategory || '-') : (task.category || '-');
                const responsibleParty = task.vendor ? (task.vendor || '-') : (task.assignees || '-');
                // Row Highlight condition: Last update is today AND status is NOT 'Not Yet Started'
                const isRowHighlighted = task.status !== 'Not Yet Started' && isUpdatedToday(task.lastUpdateDate);
                
                return (
                  <tr 
                    key={task.id} 
                    onDoubleClick={() => onUpdateTask(task)}
                    className={`hover:bg-blue-50 transition-colors cursor-pointer ${selectedIds.includes(task.id) ? 'bg-blue-50/50' : ''} ${isSyncing ? 'opacity-60' : ''} ${isRowHighlighted ? '!bg-green-100' : ''}`}
                  >
                    {showSelection && (
                      <td className={`${tdClass} text-center`} onDoubleClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          className="rounded border-gray-300 text-blue-600 h-4 w-4" 
                          checked={selectedIds.includes(task.id)} 
                          onChange={() => handleSelectOne(task.id)}
                        />
                      </td>
                    )}
	                    <td className={`${tdClass} text-center font-bold text-blue-600 !whitespace-nowrap`}>{startIndex + idx}</td>
	                    <td className={`${tdClass} font-bold`} title={task.title}>{task.title || '-'}</td>
	                    <td className={`${tdClass} italic text-gray-700`} title={task.remarks}>{task.remarks || '-'}</td>
	                    <td className={`${tdClass}`}><div className="flex items-center gap-1">{isSyncing && <Loader2 className="animate-spin text-blue-500" size={12} />}{formatDate(task.date)}</div></td>
                    <td className={tdClass}>{getClientDisplay(task) || '-'}</td>
		                    <td className={tdClass}>{displayCategory}</td>
	                    <td className={tdClass}>{task.priority}</td>
	                      <td className={tdClass}>{task.time || '-'}</td>
	                      <td className={tdClass}>
	                        {parsePhotos(task.photos).length > 0 ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openPhotos(task.photos);
                            }}
                            className="text-indigo-600 underline hover:text-indigo-800"
                          >
                            {parsePhotos(task.photos).length} photo(s)
                          </button>
                        ) : '-'}
                      </td>
	                      <td className={tdClass}>
	                        {normalizePdfHref(task.pdf) ? (
	                          <button
	                            type="button"
	                            onClick={(e) => {
	                              e.stopPropagation();
	                              openPdf(task.pdf);
	                            }}
	                            className="text-indigo-600 underline hover:text-indigo-800"
	                          >
	                            Open PDF
	                          </button>
	                        ) : '-'}
	                      </td>
		                      <td className={tdClass}>{task.goal || '-'}</td>
		                      <td className={tdClass}>{task.achieved || '-'}</td>
		                      <td className={tdClass}>{getAchievedPercent(task.goal, task.achieved)}</td>
	                    <td className={`${tdClass}`}>{formatDate(task.dueDate)}</td>
	                    <td className={`${tdClass}`}>
	                        {task.status === 'Not Yet Started' ? '-' : (formatDate(task.lastUpdateDate || ''))}
	                    </td>
	                    <td className={tdClass}><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>{task.status}</span></td>
	                    <td className={`${tdClass} italic text-gray-700`} title={task.lastUpdateRemarks}>
	                        {task.status === 'Not Yet Started' ? '-' : (task.lastUpdateRemarks || '-')}
	                    </td>
	                    <td className={`${tdClass} font-bold text-indigo-600 text-center`}>{task.hours || 0}</td>
		                    <td className={`${tdClass} font-bold text-xs uppercase`}>{task.owner}</td>
	                    <td className={tdClass}>
	                        <div className="flex items-center gap-1 font-bold text-xs uppercase">
	                            {task.vendor ? <Hammer size={12} className="text-orange-500 shrink-0"/> : <Users size={12} className="text-indigo-700 shrink-0"/>}
	                            {responsibleParty}
	                        </div>
	                    </td>
	                    <td className={`${tdClass} text-center`}>
	  <div className="flex items-center justify-center gap-2 whitespace-nowrap" onDoubleClick={(e) => e.stopPropagation()}>
	    <button onClick={() => onUpdateTask(task)} disabled={isSyncing} className="px-3 py-1 bg-blue-600 rounded text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-30 uppercase whitespace-nowrap shrink-0 inline-flex items-center gap-1">
	      {isSyncing && <Loader2 className="animate-spin" size={14} />}
	      <span>{isSyncing ? 'Updating' : 'Update'}</span>
	    </button>
	    <button onClick={() => onEditTask(task)} disabled={isSyncing} className="p-1 text-blue-600 hover:text-blue-800 disabled:opacity-30 shrink-0"><Edit2 size={16} /></button>
	    <button onClick={() => onViewHistory(task)} disabled={isSyncing} className="p-1 text-red-500 hover:text-red-700 disabled:opacity-30 shrink-0"><Info size={16} /></button>
	    {canDelete && <button onClick={() => onDeleteTask(task.id, isVendorView)} disabled={isSyncing} className="p-1 text-red-600 hover:text-red-800 disabled:opacity-30 shrink-0"><Trash2 size={16} /></button>}
	  </div>
</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className={`space-y-4 md:hidden ${viewMode === 'card' ? 'block' : 'hidden'}`}>
        {tasks.map((task, idx) => {
          const isSyncing = syncingIds.has(task.id);
          const isExpanded = expandedIds.has(task.id);
          const canDelete = currentUser?.role === 'Admin';
          const isVendorTask = !!(task.vendor && task.vendor.trim() !== '');
          const priorityBorderColor = task.priority === 'High' ? 'border-red-500' : task.priority === 'Medium' ? 'border-amber-500' : 'border-blue-400';
          const responsiblePartyIcon = isVendorTask ? <Hammer size={12} className="text-orange-500"/> : <Users size={12} className="text-indigo-700"/>;
          const responsiblePartyText = isVendorTask ? (task.vendor || '-') : (task.assignees || '-');
          const displayCategory = isVendorTask ? (task.vendorCategory || '-') : (task.category || '-');
          // Card Highlight condition: Last update is today AND status is NOT 'Not Yet Started'
          const isCardHighlighted = task.status !== 'Not Yet Started' && isUpdatedToday(task.lastUpdateDate);

          return (
            <div 
              key={task.id} 
              onDoubleClick={() => onUpdateTask(task)}
              className={`bg-white rounded-xl shadow-lg p-5 relative border-2 cursor-pointer ${priorityBorderColor} ${isSyncing ? 'opacity-70' : ''} ${isCardHighlighted ? '!bg-green-50/80 !border-green-400' : ''}`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2" onClick={() => toggleExpand(task.id)}>
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-[10px] font-bold">#{startIndex + idx}</span>
                    <h3 className="text-base font-bold leading-tight text-blue-800">{task.title || '-'}</h3>
                </div>
                <div className="flex items-center gap-2" onDoubleClick={(e) => e.stopPropagation()}>
                  <button onClick={() => toggleExpand(task.id)} className="p-1 text-blue-600 hover:bg-blue-50 rounded">
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>
                  {showSelection && (
                    <input 
                      type="checkbox" 
                      className="rounded border-blue-300 text-blue-600 h-5 w-5" 
                      checked={selectedIds.includes(task.id)} 
                      onChange={() => handleSelectOne(task.id)}
                    />
                  )}
                </div>
              </div>

              <div className="space-y-3 mb-5">
                <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-black text-blue-900/60">Client</span>
                        <div className="flex items-center gap-1.5 text-xs text-black font-bold uppercase whitespace-normal break-words">{getClientDisplay(task) || '-'}</div>
                      </div>
                    <div className="space-y-1">
                        <span className="text-[10px] uppercase font-black text-blue-900/60">Priority</span>
                        <div className="flex items-center gap-1.5 text-xs text-black font-bold uppercase whitespace-normal break-words">
                            <AlertTriangle size={12} className={task.priority === 'High' ? 'text-red-500' : task.priority === 'Medium' ? 'text-amber-500' : 'text-blue-500'} /> 
                            {task.priority}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <span className="text-[10px] uppercase font-black text-blue-900/60">Total Minutes</span>
                        <div className="flex items-center gap-1.5 text-xs text-indigo-700 font-black uppercase whitespace-normal break-words"><Clock size={12} /> {task.hours || 0} min</div>
                    </div>

                    {isExpanded && (
                      <>
                        <div className="space-y-1">
                            <span className="text-[10px] uppercase font-black text-blue-900/60">Owner</span>
                            <div className="flex items-center gap-1.5 text-xs text-black font-bold uppercase whitespace-normal break-words"><User size={12} className="text-blue-700" /> {task.owner}</div>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[10px] uppercase font-black text-blue-900/60">{isVendorTask ? 'Vendor' : 'Assignees'}</span>
                            <div className="flex items-center gap-1.5 text-xs text-black font-bold uppercase whitespace-normal break-words">{responsiblePartyIcon} {responsiblePartyText}</div>
                        </div>
                        
                        <div className="space-y-1">
                            <span className="text-[10px] uppercase font-black text-blue-900/60">{getFieldLabel('task.category', 'Category')}</span>
                            <div className="flex items-center gap-1.5 text-xs text-black font-bold uppercase whitespace-normal break-words"><Tag size={12} className="text-green-600" /> {displayCategory}</div>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[10px] uppercase font-black text-blue-900/60">Task Date</span>
                            <div className="flex items-center gap-1.5 text-xs text-black font-bold uppercase whitespace-normal break-words"><Calendar size={12} className="text-blue-900" /> {formatDate(task.date)}</div>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[10px] uppercase font-black text-blue-900/60">Update Date</span>
                            <div className="flex items-center gap-1.5 text-xs text-black font-bold uppercase whitespace-normal break-words"><Clock size={12} className="text-indigo-600" /> {formatDate(task.lastUpdateDate || '')}</div>
                        </div>
                      </>
                    )}
                </div>

                {isExpanded && (
                  <>
                    {(task.time || task.goal || task.achieved || parsePhotos(task.photos).length > 0 || task.pdf) && (
                      <div className="grid grid-cols-2 gap-x-3 gap-y-4 mt-2">
                        <div>
                          <span className="text-[10px] uppercase font-black text-blue-900/60 block">Time</span>
                          <span className="text-xs font-bold text-black">{task.time || '-'}</span>
                        </div>
	                        <div>
	                          <span className="text-[10px] uppercase font-black text-blue-900/60 block">Goal</span>
	                          <span className="text-xs font-bold text-black break-words">{task.goal || '-'}</span>
	                        </div>
	                        <div>
	                          <span className="text-[10px] uppercase font-black text-blue-900/60 block">Achieved</span>
	                          <span className="text-xs font-bold text-black break-words">{task.achieved || '-'}</span>
	                        </div>
	                        <div>
	                          <span className="text-[10px] uppercase font-black text-blue-900/60 block">Achieved %</span>
	                          <span className="text-xs font-bold text-black break-words">{getAchievedPercent(task.goal, task.achieved)}</span>
	                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-black text-blue-900/60 block">Photo</span>
                          {parsePhotos(task.photos).length > 0 ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openPhotos(task.photos);
                              }}
                              className="text-xs font-bold text-indigo-600 underline"
                            >
                              {parsePhotos(task.photos).length} photo(s)
                            </button>
                          ) : (
                            <span className="text-xs font-bold text-black">-</span>
                          )}
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-black text-blue-900/60 block">PDF</span>
                          {normalizePdfHref(task.pdf) ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openPdf(task.pdf);
                              }}
                              className="text-xs font-bold text-indigo-600 underline"
                            >
                              Open PDF
                            </button>
                          ) : (
                            <span className="text-xs font-bold text-black">-</span>
                          )}
                        </div>
                      </div>
                    )}
                    {task.lastUpdateRemarks && task.lastUpdateRemarks.trim() !== '' && (
                      <div className="flex items-start gap-2 bg-blue-50 p-2 rounded-lg text-blue-700 border border-blue-100 mt-2 min-w-0 overflow-hidden">
                          <Info size={14} className="mt-0.5 shrink-0 opacity-70" />
                          <p className="text-xs italic leading-relaxed whitespace-normal break-all">{task.lastUpdateRemarks}</p>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <span className={`flex items-center justify-center text-center px-2 py-1.5 rounded-full text-[8px] font-black uppercase whitespace-normal break-words min-w-[90px] ${getStatusColor(task.status)}`}>
                    {task.status}
                </span>
                <div className="flex items-center gap-2" onDoubleClick={(e) => e.stopPropagation()}>
	                    <button onClick={() => onViewHistory(task)} disabled={isSyncing} className="p-2 bg-blue-100 text-blue-600 hover:bg-blue-200 rounded-lg transition-colors shadow-sm disabled:opacity-40"><Info size={18} /></button>
	                    <button onClick={() => onEditTask(task)} className="p-2 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded-lg transition-colors shadow-sm"><Edit2 size={18} /></button>
	                    {canDelete && <button onClick={() => onDeleteTask(task.id, isVendorView)} className="p-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition-colors shadow-sm"><Trash2 size={18} /></button>}
	                    <button onClick={() => onUpdateTask(task)} disabled={isSyncing} className="ml-1 px-4 py-2 bg-white text-blue-600 border border-blue-600 text-[10px] font-black rounded-lg uppercase shadow-sm inline-flex items-center gap-2 disabled:opacity-40">
	                      {isSyncing && <Loader2 className="animate-spin" size={14} />}
	                      {isSyncing ? 'Updating' : 'Update'}
	                    </button>
	                </div>
	              </div>
            </div>
          );
        })}
      </div>

      {photoViewer && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPhotoViewer(null)}
        >
          <div
            className="relative w-full max-w-4xl rounded-2xl bg-white p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPhotoViewer(null)}
              className="absolute right-3 top-3 rounded-full bg-white/90 p-2 text-gray-700 shadow hover:text-black"
            >
              <X size={18} />
            </button>
            <div className="flex min-h-[280px] items-center justify-center overflow-hidden rounded-xl bg-gray-100">
              <img
                src={photoViewer.photos[photoViewer.index]}
                alt={`Task photo ${photoViewer.index + 1}`}
                className="max-h-[70vh] w-auto max-w-full object-contain"
              />
            </div>
            {photoViewer.photos.length > 1 && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {photoViewer.photos.map((photo, index) => (
                  <button
                    type="button"
                    key={`${photo.slice(0, 32)}-${index}`}
                    onClick={() => setPhotoViewer({ photos: photoViewer.photos, index })}
                    className={`overflow-hidden rounded-lg border-2 ${index === photoViewer.index ? 'border-indigo-600' : 'border-transparent'}`}
                  >
                    <img src={photo} alt={`Thumbnail ${index + 1}`} className="h-16 w-16 object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};




