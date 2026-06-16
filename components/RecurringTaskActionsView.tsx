import React, { useState, useMemo, useEffect } from 'react';
import { Search, History, Filter, X, FileText, Download, ArrowUpDown, ArrowUp, ArrowDown, Trash2, LayoutGrid, LayoutList, Calendar, Tag, User } from 'lucide-react';
import { RecurringTaskAction } from '../types';
import { SearchableSelect } from './SearchableSelect';
import { parseToISO } from '../App';
import { useLabels } from '../labelOverrides';

interface RecurringTaskActionsViewProps {
  actions: RecurringTaskAction[];
  isAdmin: boolean;
  onDeleteAction: (logId: number, taskId: number) => void;
  dashboardFilter?: { type: string; value: string; dateFrom?: string; dateTo?: string } | null;
  onClearDashboardFilter?: () => void;
}

type SortConfig = {
  key: keyof RecurringTaskAction;
  direction: 'asc' | 'desc';
} | null;

export const RecurringTaskActionsView: React.FC<RecurringTaskActionsViewProps> = ({ 
	    actions, 
      isAdmin,
	    onDeleteAction, 
	    dashboardFilter = null,
	    onClearDashboardFilter 
	}) => {
	  const { getFieldLabel } = useLabels();
	  const categoryLabel = getFieldLabel('recurringTask.category', 'Category');
	  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterClient, setFilterClient] = useState('All');
  const [filterAssignee, setFilterAssignee] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
	  const [filterDate, setFilterDate] = useState('');
	  const [showFilters, setShowFilters] = useState(false);
	  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
	  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
	  const [photoViewer, setPhotoViewer] = useState<{ photos: string[]; index: number } | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    if (dashboardFilter && dashboardFilter.type === 'assignee') {
        setFilterAssignee(dashboardFilter.value);
        setSearchTerm(''); 
        
        if (dashboardFilter.dateFrom) {
            setFilterDate(dashboardFilter.dateFrom);
            setShowFilters(true);
        }
    }
  }, [dashboardFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterCategory, filterAssignee, filterStatus, filterDate]);

  const requestSort = (key: keyof RecurringTaskAction) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: keyof RecurringTaskAction) => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown size={14} className="ml-1 opacity-50" />;
    return sortConfig.direction === 'asc' ? <ArrowUp size={14} className="ml-1 text-white" /> : <ArrowDown size={14} className="ml-1 text-white" />;
  };

  const categories = useMemo(() => ['All', ...Array.from(new Set(actions.map(a => a.category)))], [actions]);
  const clients = useMemo(() => ['All', ...Array.from(new Set(actions.map(a => a.firm || '').filter(Boolean)))], [actions]);
  const assignees = useMemo(() => ['All', ...Array.from(new Set(actions.map(a => a.assignee)))], [actions]);
  const statuses = ['All', 'Not Yet Started', 'In Progress', 'Complete'];

  const filteredActions = useMemo(() => {
    return actions.filter(action => {
      if (searchTerm) {
        const lowerTerm = searchTerm.toLowerCase();
        const matchesSearch = Object.values(action).some(val => 
          String(val || '').toLowerCase().includes(lowerTerm)
        );
        if (!matchesSearch) return false;
      }

      const matchesCategory = filterCategory === 'All' || action.category === filterCategory;
      const matchesClient = filterClient === 'All' || (action.firm || '') === filterClient;
      const matchesAssignee = filterAssignee === 'All' || action.assignee === filterAssignee;
      const matchesStatus = filterStatus === 'All' || action.status === filterStatus;
      
      let matchesDate = true;
      if (filterDate) {
          const actionISO = parseToISO(action.updatedOn);
          matchesDate = actionISO === filterDate;
      }
      
      return matchesCategory && matchesClient && matchesAssignee && matchesStatus && matchesDate;
    });
  }, [actions, searchTerm, filterCategory, filterClient, filterAssignee, filterStatus, filterDate]);

  const sortedActions = useMemo(() => {
    let sortableItems = [...filteredActions];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key] ?? '';
        const bValue = b[sortConfig.key] ?? '';
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredActions, sortConfig]);

  const totalPages = Math.ceil(sortedActions.length / itemsPerPage);
  const paginatedActions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedActions.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedActions, currentPage]);

  const formatDate = (dateInput: any) => {
    if (!dateInput) return '-';
    const s = String(dateInput).trim();
    const ddmmyyyyMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (ddmmyyyyMatch) return `${ddmmyyyyMatch[1].padStart(2, '0')}/${ddmmyyyyMatch[2].padStart(2, '0')}/${ddmmyyyyMatch[3]}`;
    const d = new Date(s.includes('T') ? s.split('T')[0] : s);
    if (!isNaN(d.getTime())) return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    return s;
  };

	  const getStatusColor = (status: string) => {
	    switch (status) {
	      case 'Complete': return 'bg-green-100 text-green-700';
	      case 'In Progress': return 'bg-blue-100 text-blue-700';
	      default: return 'bg-gray-100 text-gray-700';
	    }
	  };

	  const parsePhotos = (rawPhotos?: string): string[] => {
	    if (!rawPhotos) return [];
	    try {
	      const parsed = JSON.parse(rawPhotos);
	      return Array.isArray(parsed) ? parsed.filter(p => typeof p === 'string' && p.trim() !== '') : [];
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
	      setTimeout(() => URL.revokeObjectURL(url), 60_000);
	    } catch {
	      window.open(href, '_blank', 'noopener,noreferrer');
	    }
	  };

  const handleClearFilters = () => {
    setFilterCategory('All'); 
    setFilterClient('All'); 
    setFilterAssignee('All'); 
    setFilterStatus('All'); 
    setFilterDate(''); 
    setSearchTerm('');
    if (onClearDashboardFilter) onClearDashboardFilter();
  };

  const thClass = "px-4 py-3 text-[10px] font-black text-white uppercase tracking-widest border-r border-black last:border-r-0 cursor-pointer hover:bg-blue-700 transition-colors select-none whitespace-normal";
  const tdClass = "px-4 py-3 text-xs text-black border-r border-black last:border-r-0 align-top whitespace-normal break-words";

  const getGoalAchievedDisplay = (action: RecurringTaskAction) => {
    const rawGoal = String(action.taskGoal ?? '').trim();
    const rawAchieved = String(action.goal ?? '').trim();
    const isBlankGoal = !rawGoal || rawGoal === '-';
    const isBlankAchieved = !rawAchieved || rawAchieved === '-';
    if (action.status === 'Complete' && isBlankGoal && isBlankAchieved) {
      return { goal: '1', achieved: '1' };
    }
    return {
      goal: isBlankGoal ? '-' : rawGoal,
      achieved: isBlankAchieved ? '-' : rawAchieved
    };
  };

  const startEntry = sortedActions.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endEntry = Math.min(currentPage * itemsPerPage, sortedActions.length);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div><h2 className="text-2xl font-black text-blue-600 uppercase tracking-tight">Recurring Actions</h2><p className="text-sm text-gray-600 mt-1">History of recurring task activity</p></div>
        <div className="flex flex-wrap gap-2 items-center">
            <div className="flex bg-blue-50 p-1 rounded-lg md:hidden border border-blue-200">
                <button onClick={() => setViewMode('card')} className={`p-1.5 rounded-md transition-all ${viewMode === 'card' ? 'bg-white shadow text-blue-600' : 'text-blue-500'}`}><LayoutGrid size={18} /></button>
                <button onClick={() => setViewMode('table')} className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-white shadow text-indigo-600' : 'text-blue-500'}`}><LayoutList size={18} /></button>
            </div>
            <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center space-x-1 px-3 py-2 border-2 rounded-md text-xs font-black shadow-sm transition-all duration-200 uppercase tracking-widest ${showFilters ? 'bg-blue-600 border-blue-700 text-white' : 'bg-blue-50 border-blue-300 text-blue-600'}`}><Filter size={16} /><span>Filters</span></button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border-2 border-blue-400 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-blue-600" size={18} />
          <input 
            type="text" 
            placeholder="Search recurring history..." 
            className={`w-full pl-10 pr-4 py-2 border-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-100 text-sm transition-colors font-bold ${searchTerm ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-blue-200'}`} 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
	            <SearchableSelect label={<span className="text-[10px] font-black uppercase">{categoryLabel}</span>} options={categories.map(c => ({ value: c, label: c }))} value={filterCategory} onChange={setFilterCategory} />
            <SearchableSelect label={<span className="text-[10px] font-black uppercase">Client</span>} options={clients.map(c => ({ value: c, label: c }))} value={filterClient} onChange={setFilterClient} />
            <SearchableSelect label={<span className="text-[10px] font-black uppercase">Assignee</span>} options={assignees.map(a => ({ value: a, label: a }))} value={filterAssignee} onChange={setFilterAssignee} />
            <div className="space-y-1"><label className="text-[10px] font-black text-blue-600 uppercase block mb-1">Status</label><select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full px-3 py-2 border-2 border-blue-200 rounded-md text-sm">{statuses.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            <div className="space-y-1"><label className="text-[10px] font-black text-blue-600 uppercase block mb-1">Date</label><input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-full px-3 py-2 border-2 border-blue-200 rounded-md text-sm"/></div>
            <div className="flex items-end"><button onClick={handleClearFilters} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white border-2 border-red-700 rounded-md hover:bg-red-700 text-xs font-black uppercase tracking-widest h-[42px] transition-colors"><X size={16} />Clear</button></div>
          </div>
        )}
      </div>

	      {/* Mobile Card View */}
	      <div className={`space-y-4 md:hidden ${viewMode === 'card' ? 'block' : 'hidden'}`}>
	        {paginatedActions.map((action) => (
	             <div key={action.id} className="bg-white border-2 border-blue-200 rounded-xl p-4 shadow-sm space-y-3 relative">
                <div className="flex justify-between items-start">
                    <div className="space-y-1 max-w-[70%]">
                        <h4 className="text-sm font-black text-blue-900 leading-tight whitespace-normal break-words">{action.taskTitle}</h4>
                        <div className="flex items-center gap-1.5 text-[10px] text-blue-600 font-bold uppercase whitespace-normal break-words">
                            <Calendar size={12} />
                            {action.updatedOn}
                        </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border border-blue-100 whitespace-normal break-words ${getStatusColor(action.status)}`}>
                        {action.status}
                    </span>
                </div>

                <div className="grid grid-cols-2 gap-2 py-2 border-y border-black">
                    <div className="space-y-0.5">
                        <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Owner</span>
                        <div className="flex items-center gap-1 text-[10px] text-blue-900 font-bold whitespace-normal break-words">
                            <User size={10} /> {action.owner || '-'}
                        </div>
                    </div>
                    <div className="space-y-0.5">
                        <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Assignee</span>
                        <div className="flex items-center gap-1 text-[10px] text-blue-900 font-bold whitespace-normal break-words">
                            <User size={10} /> {action.assignee}
                        </div>
                    </div>
                    <div className="space-y-0.5">
                        <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">{categoryLabel}</span>
                        <div className="flex items-center gap-1 text-[10px] text-blue-900 font-bold whitespace-normal break-words">
                            <Tag size={10} /> {action.category}
                        </div>
                    </div>
                </div>

	                <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100">
	                    <p className="text-[11px] text-blue-800 italic leading-relaxed whitespace-normal break-words">"{action.remarks}"</p>
	                </div>

	                <div className="grid grid-cols-3 gap-2 text-[10px]">
		                  <div className="space-y-0.5">
		                    <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Goal</span>
		                    <div className="text-blue-900 font-bold whitespace-normal break-words">{action.taskGoal || '-'}</div>
		                  </div>
		                  <div className="space-y-0.5">
		                    <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Achieved</span>
		                    <div className="text-blue-900 font-bold whitespace-normal break-words">{action.goal || '-'}</div>
		                  </div>
		                  <div className="space-y-0.5">
		                    <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Photo</span>
	                    {parsePhotos(action.photos).length > 0 ? (
	                      <button
	                        type="button"
	                        onClick={() => setPhotoViewer({ photos: parsePhotos(action.photos), index: 0 })}
	                        className="text-indigo-600 underline font-bold"
	                      >
	                        {parsePhotos(action.photos).length} photo(s)
	                      </button>
	                    ) : (
	                      <div className="text-blue-900 font-bold">-</div>
	                    )}
	                  </div>
	                  <div className="space-y-0.5">
	                    <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">PDF</span>
	                    {normalizePdfHref(action.pdf) ? (
	                      <button type="button" onClick={() => openPdf(action.pdf)} className="text-indigo-600 underline font-bold text-left">
	                        Open
	                      </button>
	                    ) : (
	                      <div className="text-blue-900 font-bold">-</div>
	                    )}
	                  </div>
	                </div>

                {isAdmin && (
                  <button onClick={() => onDeleteAction(action.id, action.taskId)} className="absolute bottom-4 right-4 p-2 text-red-500 hover:bg-red-50 rounded-lg">
                      <Trash2 size={16} />
                  </button>
                )}
             </div>
        ))}
        {paginatedActions.length === 0 && <div className="text-center py-10 text-blue-300 font-bold uppercase text-xs">No activity history found.</div>}
      </div>

	      <div className={`bg-white rounded-lg border-2 border-black shadow-sm overflow-hidden ${viewMode === 'card' ? 'hidden md:block' : 'block'}`}>
	        <div className="overflow-x-auto">
	          <table className="w-full text-left border-collapse">
	            <thead>
	              <tr className="bg-blue-600">
	                <th className="px-4 py-3 text-[10px] font-black text-white uppercase tracking-widest border-r border-black w-16 text-center whitespace-nowrap">S.No.</th>
	                <th className={thClass} onClick={() => requestSort('taskTitle')}><div className="flex items-center">Task {getSortIcon('taskTitle')}</div></th>
		                <th className={thClass} onClick={() => requestSort('firm')}><div className="flex items-center">Client {getSortIcon('firm')}</div></th>
                <th className={thClass} onClick={() => requestSort('owner' as any)}><div className="flex items-center">Owner {getSortIcon('owner' as any)}</div></th>
	                <th className={thClass} onClick={() => requestSort('category')}><div className="flex items-center">{categoryLabel} {getSortIcon('category')}</div></th>
	                <th className={thClass} onClick={() => requestSort('assignee')}><div className="flex items-center">Assignee {getSortIcon('assignee')}</div></th>
	                <th className={thClass} onClick={() => requestSort('status')}><div className="flex items-center">Status {getSortIcon('status')}</div></th>
	                <th className={thClass} onClick={() => requestSort('updatedOn')}><div className="flex items-center">Date {getSortIcon('updatedOn')}</div></th>
	                <th className={thClass} onClick={() => requestSort('remarks')}><div className="flex items-center">Remarks {getSortIcon('remarks')}</div></th>
		                <th className={thClass} onClick={() => requestSort('goal')}><div className="flex items-center">Goal {getSortIcon('goal')}</div></th>
		                <th className={thClass} onClick={() => requestSort('goal')}><div className="flex items-center">Achieved {getSortIcon('goal')}</div></th>
		                <th className={thClass}><div className="flex items-center">Photo</div></th>
	                <th className={thClass}><div className="flex items-center">PDF</div></th>
	                <th className="px-4 py-3 text-[10px] font-black text-white uppercase tracking-widest text-center whitespace-normal">Actions</th>
	              </tr>
	            </thead>
	            <tbody className="divide-y divide-black">
		              {paginatedActions.map((action, idx) => (
                  (() => {
                    const display = getGoalAchievedDisplay(action);
                    return (
		                <tr key={action.id} className="hover:bg-blue-50 transition-colors">
		                  <td className={`${tdClass} text-center font-bold text-blue-600 !whitespace-nowrap`}>{startEntry + idx}</td>
		                  <td className={`${tdClass} font-bold`}>{action.taskTitle}</td>
			                  <td className={tdClass}>{action.firm || '-'}</td>
			                  <td className={tdClass}>{action.owner || '-'}</td>
			                  <td className={tdClass}>{action.category}</td>
		                  <td className={tdClass}>{action.assignee}</td>
		                  <td className={tdClass}><span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tighter border border-blue-100 whitespace-normal break-words ${getStatusColor(action.status)}`}>{action.status}</span></td>
		                  <td className={`${tdClass} font-bold`}>{formatDate(action.updatedOn)}</td>
		                  <td className={`${tdClass} italic text-blue-900`}>"{action.remarks}"</td>
		                  <td className={`${tdClass} font-bold`}>{display.goal}</td>
		                  <td className={`${tdClass} font-bold`}>{display.achieved}</td>
		                  <td className={tdClass}>
		                    {parsePhotos(action.photos).length > 0 ? (
		                      <button
	                        type="button"
	                        onClick={() => setPhotoViewer({ photos: parsePhotos(action.photos), index: 0 })}
	                        className="text-indigo-600 underline font-bold"
	                      >
	                        {parsePhotos(action.photos).length} photo(s)
	                      </button>
	                    ) : (
	                      '-'
	                    )}
	                  </td>
	                  <td className={tdClass}>
	                    {normalizePdfHref(action.pdf) ? (
	                      <button type="button" onClick={() => openPdf(action.pdf)} className="text-indigo-600 underline font-bold">
	                        Open PDF
	                      </button>
	                    ) : (
	                      '-'
	                    )}
	                  </td>
		                  <td className={`${tdClass} text-center`}>
		                    {isAdmin && (
                          <button onClick={() => onDeleteAction(action.id, action.taskId)} className="p-1.5 text-red-500 hover:bg-red-50 border-2 border-transparent hover:border-red-600 rounded-md transition-all">
                            <Trash2 size={16} />
                          </button>
                        )}
		                  </td>
		                </tr>
                    );
                  })()
		              ))}
		              {paginatedActions.length === 0 && (<tr><td colSpan={14} className="px-6 py-10 text-center text-blue-300 font-black uppercase">No activity found.</td></tr>)}
	            </tbody>
	          </table>
	        </div>
	      </div>

	      {photoViewer && (
	        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" onClick={() => setPhotoViewer(null)}>
	          <div className="relative w-full max-w-4xl rounded-2xl bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
	            <button type="button" onClick={() => setPhotoViewer(null)} className="absolute right-3 top-3 rounded-full bg-white/90 p-2 text-gray-700 shadow hover:text-black">
	              <X size={18} />
	            </button>
	            <div className="flex items-center justify-between mb-3">
	              <button
	                type="button"
	                onClick={() => setPhotoViewer(p => p ? ({ ...p, index: Math.max(0, p.index - 1) }) : p)}
	                disabled={photoViewer.index === 0}
	                className="px-3 py-1.5 text-sm font-semibold rounded bg-blue-600 text-white disabled:bg-gray-200 disabled:text-gray-500"
	              >
	                Prev
	              </button>
	              <div className="text-sm text-gray-700 font-semibold">
	                {photoViewer.index + 1} / {photoViewer.photos.length}
	              </div>
	              <button
	                type="button"
	                onClick={() => setPhotoViewer(p => p ? ({ ...p, index: Math.min(p.photos.length - 1, p.index + 1) }) : p)}
	                disabled={photoViewer.index >= photoViewer.photos.length - 1}
	                className="px-3 py-1.5 text-sm font-semibold rounded bg-blue-600 text-white disabled:bg-gray-200 disabled:text-gray-500"
	              >
	                Next
	              </button>
	            </div>
	            <div className="flex min-h-[280px] items-center justify-center overflow-hidden rounded-xl bg-gray-100">
	              <img src={photoViewer.photos[photoViewer.index]} alt={`Log photo ${photoViewer.index + 1}`} className="max-h-[70vh] w-auto max-w-full object-contain" />
	            </div>
	          </div>
	        </div>
	      )}
	    </div>
	  );
	};

