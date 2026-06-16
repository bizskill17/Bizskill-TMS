import React, { useState, useMemo, useEffect } from 'react';
import { RotateCcw, Plus, Search, Filter, X, Info, ArrowUpDown, ArrowUp, ArrowDown, Trash2, Edit2, LayoutGrid, LayoutList, AlertCircle, Calendar, Loader2 } from 'lucide-react';
import { RecurringTask, RecurringTaskAction } from '../types';
import { SearchableSelect } from './SearchableSelect';
import { useLabels } from '../labelOverrides';

interface RecurringTasksViewProps {
  tasks: RecurringTask[];
  actions: RecurringTaskAction[]; 
  onAdd: () => void;
  onUpdate: (task: RecurringTask) => void;
  onEdit: (task: RecurringTask) => void;
  onViewHistory: (task: RecurringTask) => void;
  onDelete: (id: number) => Promise<void>;
  title?: string;
  filterType?: 'all' | 'due';
  currentUser?: any;
  sidebarCollapsed?: boolean;
}

type SortConfig = {
  key: string;
  direction: 'asc' | 'desc';
} | null;

export const RecurringTasksView: React.FC<RecurringTasksViewProps> = ({ 
    tasks, 
    actions,
    onAdd, 
    onUpdate, 
    onEdit, 
    onViewHistory, 
    onDelete, 
    title = "Recurring Tasks",
    filterType = 'all',
    currentUser,
    sidebarCollapsed = false
}) => {
  const { getFieldLabel } = useLabels();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterClient, setFilterClient] = useState('All');
  const [filterAssignee, setFilterAssignee] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const isAdmin = currentUser?.role === 'Admin';

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds([]);
  }, [searchTerm, filterCategory, filterClient, filterAssignee, filterStatus, filterType]);

  const categories = useMemo(() => ['All', ...Array.from(new Set(tasks.map(t => t.category)))], [tasks]);
  const clients = useMemo(() => ['All', ...Array.from(new Set(tasks.map(t => t.firm || '').filter(Boolean)))], [tasks]);
  const assignees = useMemo(() => ['All', ...Array.from(new Set(tasks.map(t => t.assignee)))], [tasks]);
  const statuses = ['All', 'Not Yet Started', 'In Progress', 'Complete'];

  const parseDDMMYYYY = (value: string): Date | null => {
    const match = String(value || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return null;
    const day = Number(match[1]);
    const month = Number(match[2]) - 1;
    const year = Number(match[3]);
    const date = new Date(year, month, day);
    if (isNaN(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const clampDay = (year: number, monthIndex: number, day: number): Date => {
    const maxDay = new Date(year, monthIndex + 1, 0).getDate();
    const safeDay = Math.min(Math.max(day, 1), maxDay);
    const date = new Date(year, monthIndex, safeDay);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const addDays = (date: Date, days: number): Date => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    next.setHours(0, 0, 0, 0);
    return next;
  };

  const getCycleWindow = (task: RecurringTask): { start: Date; end: Date } | null => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const periodicity = task.periodicity || 'Fixed Days';

    if (periodicity === 'Fixed Days') {
      const anchor = parseDDMMYYYY(getLastCompletionDate(task));
      if (!anchor) return null;
      const frequencyDays = Math.max(1, Number(task.frequencyDays || 1));
      const diffDays = Math.floor((today.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24));
      const cyclesElapsed = Math.max(0, Math.floor(diffDays / frequencyDays));
      const start = addDays(anchor, cyclesElapsed * frequencyDays);
      const end = addDays(start, frequencyDays - 1);
      return { start, end };
    }

    if (periodicity === 'Weekly') {
      const targetDay = typeof task.recurrenceDay === 'number' ? task.recurrenceDay : 0;
      const start = new Date(today);
      const diff = (today.getDay() - targetDay + 7) % 7;
      start.setDate(today.getDate() - diff);
      start.setHours(0, 0, 0, 0);
      const end = addDays(start, 6);
      return { start, end };
    }

    if (periodicity === 'Monthly') {
      const targetDay = typeof task.recurrenceDay === 'number' ? task.recurrenceDay : 1;
      let start = clampDay(today.getFullYear(), today.getMonth(), targetDay);
      if (start > today) {
        start = clampDay(today.getFullYear(), today.getMonth() - 1, targetDay);
      }
      const nextStart = clampDay(start.getFullYear(), start.getMonth() + 1, targetDay);
      const end = addDays(nextStart, -1);
      return { start, end };
    }

    if (periodicity === 'Yearly') {
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const targetMonth = Math.max(0, months.indexOf(task.recurrenceMonth || 'January'));
      const targetDay = typeof task.recurrenceDay === 'number' ? task.recurrenceDay : 1;
      let start = clampDay(today.getFullYear(), targetMonth, targetDay);
      if (start > today) {
        start = clampDay(today.getFullYear() - 1, targetMonth, targetDay);
      }
      const nextStart = clampDay(start.getFullYear() + 1, targetMonth, targetDay);
      const end = addDays(nextStart, -1);
      return { start, end };
    }

    return null;
  };

  const achievedSumByTaskId = useMemo(() => {
    const map = new Map<number, number>();
    tasks.forEach((task) => {
      const taskId = Number(task.id || 0);
      if (!taskId) return;
      const window = getCycleWindow(task);
      if (!window) {
        map.set(taskId, 0);
        return;
      }
      const total = actions
        .filter((action) => Number(action.taskId || 0) === taskId)
        .reduce((sum, action) => {
          const actionDate = parseDDMMYYYY(String(action.updatedOn || ''));
          if (!actionDate) return sum;
          if (actionDate < window.start || actionDate > window.end) return sum;
          const achievedValue = Number(String(action.goal || '').trim());
          return sum + (Number.isFinite(achievedValue) ? achievedValue : 0);
        }, 0);
      map.set(taskId, total);
    });
    return map;
  }, [actions, tasks]);

  const parseNumber = (value: unknown): number => {
    const num = Number(String(value ?? '').trim());
    return Number.isFinite(num) ? num : 0;
  };

  const hasGoalValue = (value: unknown): boolean => {
    const raw = String(value ?? '').trim();
    if (!raw || raw === '-') return false;
    const num = Number(raw);
    return Number.isFinite(num) && num > 0;
  };

  const getAchievedPercent = (goalValue: unknown, achievedValue: unknown): string => {
    const goal = parseNumber(goalValue);
    const achieved = parseNumber(achievedValue);
    if (goal <= 0) return '-';
    return `${((achieved / goal) * 100).toFixed(2)}%`;
  };

  function getLastCompletionDate(task: RecurringTask): string {
    const taskHistory = actions
      .filter(a => Number(a.taskId) === Number(task.id) && a.status === 'Complete')
      .sort((a, b) => {
         const parseDate = (ds: string) => {
            const [d, m, y] = ds.split('/');
            return new Date(`${y}-${m}-${d}`).getTime();
         };
         return parseDate(b.updatedOn) - parseDate(a.updatedOn);
      });

    return taskHistory.length > 0 ? taskHistory[0].updatedOn : task.startDate;
  }

  const getNextDueDateObject = (task: RecurringTask): Date | null => {
    const periodicity = task.periodicity || 'Fixed Days';
    const lastCompleteDateStr = getLastCompletionDate(task);
    
    const match = lastCompleteDateStr.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    let lastComplete: Date;
    if (match) lastComplete = new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
    else lastComplete = new Date(lastCompleteDateStr);
    
    if (isNaN(lastComplete.getTime())) return null;
    lastComplete.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (periodicity === 'Fixed Days') {
        const frequencyDays = Math.max(1, Number(task.frequencyDays || 1));
        const nextDate = new Date(lastComplete);
        do {
          nextDate.setDate(nextDate.getDate() + frequencyDays);
          nextDate.setHours(0, 0, 0, 0);
        } while (nextDate < today);
        return nextDate;
    }

    if (periodicity === 'Weekly') {
        const targetDay = Math.max(0, Math.min(6, Number(task.recurrenceDay ?? 0)));
        let diff = targetDay - lastComplete.getDay();
        if (diff <= 0) diff += 7;
        const nextDate = new Date(lastComplete);
        nextDate.setDate(lastComplete.getDate() + diff);
        nextDate.setHours(0, 0, 0, 0);
        while (nextDate < today) {
          nextDate.setDate(nextDate.getDate() + 7);
          nextDate.setHours(0, 0, 0, 0);
        }
        return nextDate;
    }

    if (periodicity === 'Monthly') {
        const targetDay = Math.max(1, Number(task.recurrenceDay ?? 1));
        let year = lastComplete.getFullYear();
        let month = lastComplete.getMonth();
        let nextDate = clampDay(year, month, targetDay);
        if (nextDate <= lastComplete) {
          month += 1;
          nextDate = clampDay(year, month, targetDay);
        }
        while (nextDate < today) {
          month += 1;
          nextDate = clampDay(year, month, targetDay);
        }
        return nextDate;
    }

    if (periodicity === 'Yearly') {
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const foundMonth = months.indexOf(task.recurrenceMonth || 'January');
        const targetMonthIdx = foundMonth >= 0 ? foundMonth : 0;
        const targetDay = Math.max(1, Number(task.recurrenceDay ?? 1));
        let year = lastComplete.getFullYear();
        let nextDate = clampDay(year, targetMonthIdx, targetDay);
        if (nextDate <= lastComplete) {
            year += 1;
            nextDate = clampDay(year, targetMonthIdx, targetDay);
        }
        while (nextDate < today) {
            year += 1;
            nextDate = clampDay(year, targetMonthIdx, targetDay);
        }
        return nextDate;
    }

    return null;
  };

  const getNextDueDateStr = (task: RecurringTask) => {
    const nextDate = getNextDueDateObject(task);
    if (!nextDate) return '-';
    return `${String(nextDate.getDate()).padStart(2, '0')}/${String(nextDate.getMonth() + 1).padStart(2, '0')}/${nextDate.getFullYear()}`;
  };

  const getEffectiveStatus = (task: RecurringTask) => {
    const dbStatus = task.status || 'Not Yet Started';
    const nextDue = getNextDueDateObject(task);
    if (!nextDue) return dbStatus;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(nextDue);
    checkDate.setHours(0, 0, 0, 0);

    if (today >= checkDate) {
        if (dbStatus === 'Complete') return 'Not Yet Started';
        return dbStatus;
    }
    return dbStatus;
  };

	  const getFrequencyText = (task: RecurringTask) => {
	    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const monthShortMap: Record<string, string> = {
        january: 'Jan',
        february: 'Feb',
        march: 'Mar',
        april: 'Apr',
        may: 'May',
        june: 'Jun',
        july: 'Jul',
        august: 'Aug',
        september: 'Sep',
        october: 'Oct',
        november: 'Nov',
        december: 'Dec',
      };
      const dayRaw = String((task as any).recurrenceDay ?? '').trim();
      const dayNumeric = Number(dayRaw);
      const weeklyNameMap: Record<string, number> = {
        sun: 0, sunday: 0,
        mon: 1, monday: 1,
        tue: 2, tues: 2, tuesday: 2,
        wed: 3, wednesday: 3,
        thu: 4, thur: 4, thurs: 4, thursday: 4,
        fri: 5, friday: 5,
        sat: 6, saturday: 6,
      };
      const weeklyIndex = Number.isFinite(dayNumeric) ? dayNumeric : (weeklyNameMap[dayRaw.toLowerCase()] ?? -1);
	    const weeklyDay = weeklyIndex >= 0 && weeklyIndex <= 6 ? dayNames[weeklyIndex] : null;
	    const monthlyDay = Number.isFinite(dayNumeric) && dayNumeric >= 1 && dayNumeric <= 31 ? dayNumeric : null;

	    switch(task.periodicity) {
	      case 'Weekly':
	        return weeklyDay ? `Weekly\n(${weeklyDay.toLowerCase()})` : 'Weekly';
	      case 'Monthly':
	        return monthlyDay ? `Monthly\n(${monthlyDay})` : 'Monthly';
	      case 'Yearly': {
	        const month = task.recurrenceMonth ? String(task.recurrenceMonth) : '';
          const shortMonth = monthShortMap[month.toLowerCase()] || month.slice(0, 3);
	        if (shortMonth && monthlyDay) return `Yearly\n(${shortMonth} - ${monthlyDay})`;
	        if (shortMonth) return `Yearly\n(${shortMonth})`;
	        if (monthlyDay) return `Yearly\n(${monthlyDay})`;
	        return 'Yearly';
	      }
	      default:
	        return `${task.frequencyDays}d`;
	    }
	  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const effectiveStatus = getEffectiveStatus(task);
      
      if (filterType === 'due') {
        const nextDue = getNextDueDateObject(task);
        if (!nextDue) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const checkDate = new Date(nextDue);
        checkDate.setHours(0, 0, 0, 0);
        
        if (today < checkDate) return false;
        if (effectiveStatus === 'Complete') return false; 
      }

      if (searchTerm) {
        const lowerTerm = searchTerm.toLowerCase();
        const matchesSearch = Object.values(task).some(val => 
          String(val || '').toLowerCase().includes(lowerTerm)
        );
        if (!matchesSearch) return false;
      }

      const matchesCategory = filterCategory === 'All' || task.category === filterCategory;
      const matchesClient = filterClient === 'All' || (task.firm || '') === filterClient;
      const matchesAssignee = filterAssignee === 'All' || task.assignee === filterAssignee;
      const matchesStatus = filterStatus === 'All' || effectiveStatus === filterStatus;
      
      return matchesCategory && matchesClient && matchesAssignee && matchesStatus;
    });
  }, [tasks, actions, searchTerm, filterCategory, filterClient, filterAssignee, filterStatus, filterType]);

  const getLatestActionTimestamp = (taskId: number) => {
    const taskActions = actions
      .filter(a => Number(a.taskId) === taskId)
      .sort((a, b) => {
        // Since timestamp is formatted as DD/MM/YYYY HH:MM:SS, we need a way to compare
        // But they are already sorted by ID DESC from backend, so first one is latest
        return 0; // The filter maintains relative order, and actions are newest first from API
      });
    return taskActions.length > 0 ? (taskActions[0].timestamp || taskActions[0].updatedOn) : null;
  };

  const getActivityDisplay = (task: RecurringTask) => {
    const dateTime = String(task.lastUpdatedOn || '').trim();
    if (dateTime.includes(':')) return dateTime;

    const latestStamp = String(getLatestActionTimestamp(task.id) || '').trim();
    if (!dateTime) return latestStamp || '-';
    if (!latestStamp || latestStamp === dateTime) return dateTime;

    const timePart = latestStamp.includes(' ') ? latestStamp.split(' ').slice(1).join(' ').trim() : latestStamp;
    return timePart ? `${dateTime} ${timePart}` : dateTime;
  };

  const sortedTasks = useMemo(() => {
    let sortableItems = [...filteredTasks];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        if (sortConfig.key === 'nextDue') {
            aValue = getNextDueDateObject(a)?.getTime() || 0;
            bValue = getNextDueDateObject(b)?.getTime() || 0;
        } else if (sortConfig.key === 'status') {
            aValue = getEffectiveStatus(a);
            bValue = getEffectiveStatus(b);
        } else {
            aValue = (a as any)[sortConfig.key] ?? '';
            bValue = (b as any)[sortConfig.key] ?? '';
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      sortableItems.sort((a, b) => {
        const assigneeCompare = String(a.assignee || '').localeCompare(String(b.assignee || ''), undefined, { sensitivity: 'base' });
        if (assigneeCompare !== 0) return assigneeCompare;

        const periodA = String(getFrequencyText(a) || '');
        const periodB = String(getFrequencyText(b) || '');
        const periodCompare = periodA.localeCompare(periodB, undefined, { sensitivity: 'base' });
        if (periodCompare !== 0) return periodCompare;

        const timeA = a.time || '99:99';
        const timeB = b.time || '99:99';
        const timeCompare = timeA.localeCompare(timeB);
        if (timeCompare !== 0) return timeCompare;

        return String(a.title || '').localeCompare(String(b.title || ''), undefined, { sensitivity: 'base' });
      });
    }
    return sortableItems;
  }, [filteredTasks, sortConfig, actions]);

  const paginatedTasks = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedTasks.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedTasks, currentPage]);

  const totalPages = Math.ceil(sortedTasks.length / itemsPerPage);

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this recurring task?')) return;
    setDeletingIds(prev => new Set(prev).add(id));
    try {
      await onDelete(id);
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const confirmBulkDelete = async () => {
    setIsBulkDeleting(true);
    try {
      for (const id of selectedIds) {
        await onDelete(id);
      }
      setSelectedIds([]);
      setShowDeleteConfirm(false);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) setSelectedIds(paginatedTasks.map(t => t.id));
    else setSelectedIds([]);
  };

  const handleSelectOne = (id: number) => {
    if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(i => i !== id));
    else setSelectedIds([...selectedIds, id]);
  };

  // Corrected requestSort implementation using internal state setSortConfig
  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown size={14} className="ml-1 opacity-50" />;
    return sortConfig.direction === 'asc' ? <ArrowUp size={14} className="ml-1 text-white" /> : <ArrowDown size={14} className="ml-1 text-white" />;
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'Complete': return 'bg-green-100 text-green-700';
      case 'In Progress': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const thClass = "px-4 py-3 text-[10px] font-bold text-white uppercase tracking-wider border-r border-indigo-500 last:border-r-0 cursor-pointer hover:bg-indigo-700 transition-colors select-none whitespace-normal";
  const tdClass = "px-4 py-3 text-xs text-black border-r border-black last:border-r-0 align-top whitespace-normal break-words";
  const taskColumnClass = "min-w-[280px] w-[280px] max-w-[360px]";
  const notesColumnClass = "min-w-[180px] w-[180px] max-w-[250px]";

  const startEntry = sortedTasks.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endEntry = Math.min(currentPage * itemsPerPage, sortedTasks.length);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className={`flex justify-between items-start md:block ${sidebarCollapsed ? 'pl-14 md:pl-16' : ''}`}>
            <div>
                <h2 className="text-2xl font-bold text-indigo-600 flex items-center gap-2">
                    {filterType === 'due' && <AlertCircle className="text-red-500" size={24} />}
                    {title}
                </h2>
            </div>
            <div className="flex bg-gray-100 p-1 rounded-lg md:hidden">
                <button onClick={() => setViewMode('card')} className={`p-1.5 rounded-md transition-all ${viewMode === 'card' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}><LayoutGrid size={18} /></button>
                <button onClick={() => setViewMode('table')} className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}><LayoutList size={18} /></button>
            </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && selectedIds.length > 0 && (
             <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center space-x-1 px-4 py-2 bg-red-600 text-white border-2 border-red-700 rounded-md hover:bg-red-700 text-sm font-bold shadow-sm transition-colors uppercase tracking-wider animate-in fade-in zoom-in duration-200">
                <Trash2 size={16} /><span>Bulk Delete ({selectedIds.length})</span>
             </button>
          )}
          <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center space-x-1 px-3 py-2 border rounded-md text-sm font-medium shadow-sm transition-all duration-200 ${showFilters ? 'bg-indigo-600 border-indigo-700 text-white' : 'bg-indigo-50 border-indigo-300 text-indigo-600 hover:bg-indigo-100'}`}><Filter size={16} /><span>Filters</span></button>
          {filterType !== 'due' && (
	            <button onClick={onAdd} className="flex items-center justify-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium transition-colors shadow-sm"><Plus size={16} /><span>New Recurring Task</span></button>
            )}
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-indigo-300 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-indigo-600" size={18} />
          <input 
            type="text" 
            placeholder="Search all columns (Task, Category, Assignee, Status, etc)..." 
            className={`w-full pl-10 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-indigo-100 text-sm transition-colors ${searchTerm ? 'border-indigo-500 bg-indigo-50' : 'border-indigo-300'}`} 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
	            <SearchableSelect label="Category" labelKey="recurringTask.category" options={categories.map(c => ({ value: c, label: c }))} value={filterCategory} onChange={setFilterCategory} />
              <SearchableSelect label="Client" options={clients.map(c => ({ value: c, label: c }))} value={filterClient} onChange={setFilterClient} />
	            <SearchableSelect label="Assignee" options={assignees.map(a => ({ value: a, label: a }))} value={filterAssignee} onChange={setFilterAssignee} />
	            <div><label className="text-[10px] font-bold text-indigo-600 uppercase mb-1 block">Status</label><select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full px-3 py-2 border border-indigo-300 rounded-md text-sm">{statuses.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
	            <div className="flex items-end"><button onClick={() => { setFilterCategory('All'); setFilterClient('All'); setFilterAssignee('All'); setFilterStatus('All'); setSearchTerm(''); }} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white border border-red-700 rounded-md hover:bg-red-700 text-sm font-medium h-[42px] transition-colors shadow-sm"><X size={16} />Clear</button></div>
          </div>
        )}
      </div>

      <div className={`bg-white rounded-lg border border-black shadow-sm overflow-hidden ${viewMode === 'card' ? 'hidden md:block' : 'block'}`}>
        <div className="overflow-x-auto">
	          <table className="w-full min-w-max text-left border-collapse">
            <thead>
              <tr className="bg-indigo-600">
                {isAdmin && (
                  <th className="px-4 py-3 w-10 text-center border-r border-indigo-500 whitespace-normal">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300 text-blue-600 h-4 w-4" 
                      checked={paginatedTasks.length > 0 && selectedIds.length === paginatedTasks.length} 
                      onChange={handleSelectAll}
                    />
                  </th>
                )}
	                <th className="px-4 py-3 text-[10px] font-bold text-white uppercase tracking-wider border-r border-indigo-500 w-16 text-center whitespace-nowrap">S.No.</th>
		                <th className={thClass} onClick={() => requestSort('frequencyDays')}><div className="flex items-center">Period {getSortIcon('frequencyDays')}</div></th>
			                <th className={thClass} onClick={() => requestSort('time')}><div className="flex items-center">Time {getSortIcon('time')}</div></th>
			                <th className={`${thClass} ${taskColumnClass}`} onClick={() => requestSort('title')}><div className="flex items-center">Task {getSortIcon('title')}</div></th>
                <th className={`${thClass} ${notesColumnClass}`} onClick={() => requestSort('notes' as any)}><div className="flex items-center">Notes {getSortIcon('notes' as any)}</div></th>
	                  <th className={thClass} onClick={() => requestSort('firm')}><div className="flex items-center">Client {getSortIcon('firm')}</div></th>
	                  <th className={thClass} onClick={() => requestSort('owner')}><div className="flex items-center">Owner {getSortIcon('owner')}</div></th>
		                <th className={thClass} onClick={() => requestSort('category')}><div className="flex items-center">{getFieldLabel('recurringTask.category', 'Category')} {getSortIcon('category')}</div></th>
	                <th className={thClass} onClick={() => requestSort('assignee')}><div className="flex items-center">Assignee {getSortIcon('assignee')}</div></th>
	                <th className={thClass} onClick={() => requestSort('status')}><div className="flex items-center">Status {getSortIcon('status')}</div></th>
		                <th className={thClass} onClick={() => requestSort('goal')}><div className="flex items-center">Goal {getSortIcon('goal')}</div></th>
		                <th className={thClass}><div className="flex items-center">Achieved</div></th>
		                <th className={thClass}><div className="flex items-center">Achieved %</div></th>
		                <th className={thClass} onClick={() => requestSort('lastUpdatedOn')}><div className="flex items-center">Activity {getSortIcon('lastUpdatedOn')}</div></th>
	                <th className={thClass} onClick={() => requestSort('remarks')}><div className="flex items-center">Remarks {getSortIcon('remarks')}</div></th>
	                <th className={thClass} onClick={() => requestSort('nextDue')}><div className="flex items-center">Next Due {getSortIcon('nextDue')}</div></th>
	                <th className="px-4 py-3 text-[10px] font-bold text-white uppercase tracking-wider text-center whitespace-normal">Actions</th>
	              </tr>
            </thead>
            <tbody className="divide-y divide-black">
              {paginatedTasks.map((task, idx) => {
                const effectiveStatus = getEffectiveStatus(task);
                const nextDueStr = getNextDueDateStr(task);
		                const nextDueObj = getNextDueDateObject(task);
		                const isOverdue = effectiveStatus !== 'Complete' && nextDueObj && (nextDueObj.getTime() < new Date().setHours(0,0,0,0));
                  const achieved = String(achievedSumByTaskId.get(Number(task.id || 0)) || 0);
                  const goalDisplay = hasGoalValue(task.goal) ? String(task.goal) : '1';
                  const achievedDisplay = hasGoalValue(task.goal) ? achieved : '0';
                  const periodText = getFrequencyText(task);
                  const prevTask = idx > 0 ? paginatedTasks[idx - 1] : null;
                  const showAssigneeHeader = !prevTask || String(prevTask.assignee || '') !== String(task.assignee || '');
                  const assigneeKey = String(task.assignee || '').trim().toLowerCase();
                  const assigneeBgClass = (() => {
                    const palettes = [
                      'bg-indigo-100 text-indigo-800',
                      'bg-emerald-100 text-emerald-800',
                      'bg-sky-100 text-sky-800',
                      'bg-violet-100 text-violet-800',
                      'bg-amber-100 text-amber-800',
                    ];
                    let hash = 0;
                    for (let i = 0; i < assigneeKey.length; i++) hash += assigneeKey.charCodeAt(i);
                    return palettes[hash % palettes.length];
                  })();
		                
		                return (
                  <React.Fragment key={task.id}>
                    {showAssigneeHeader && (
                      <tr>
                        <td colSpan={isAdmin ? 17 : 16} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider ${assigneeBgClass}`}>
                          {task.assignee || '-'}
                        </td>
                      </tr>
                    )}
                  <tr
                    onDoubleClick={() => onUpdate(task)}
                    className={`hover:bg-gray-50 transition-colors cursor-pointer ${selectedIds.includes(task.id) ? 'bg-indigo-50/50' : ''}`}
                  >
                    {isAdmin && (
                      <td className={`${tdClass} text-center`} onDoubleClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          className="rounded border-gray-300 text-blue-600 h-4 w-4" 
                          checked={selectedIds.includes(task.id)} 
                          onChange={() => handleSelectOne(task.id)}
                        />
                      </td>
                    )}
	                    <td className={`${tdClass} text-center font-bold text-indigo-600 !whitespace-nowrap`}>{startEntry + idx}</td>
	                    <td className={`${tdClass}`}>
	                      <div className="flex items-center gap-1">
	                        <Calendar size={12} className="text-indigo-400" />
	                        <span className="font-medium whitespace-pre-line">{periodText}</span>
	                      </div>
	                    </td>
	                    <td className={tdClass}>{task.time || '-'}</td>
			                    <td className={`${tdClass} ${taskColumnClass} font-medium`}>{task.title}</td>
                      <td className={`${tdClass} ${notesColumnClass}`}>
                        {task.notes || '-'}
                      </td>
	                      <td className={tdClass}>{task.firm || '-'}</td>
	                      <td className={tdClass}>{task.owner || '-'}</td>
		                    <td className={tdClass}>{task.category}</td>
	                    <td className={tdClass}>{task.assignee}</td>
                    <td className={tdClass}>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getStatusColor(effectiveStatus)} whitespace-normal break-words`}>
                            {effectiveStatus}
                        </span>
                    </td>
			                    <td className={`${tdClass} bg-yellow-700 text-white font-semibold`}>{goalDisplay}</td>
			                    <td className={`${tdClass} bg-yellow-700 text-white font-semibold`}>{achievedDisplay}</td>
			                    <td className={`${tdClass} bg-yellow-700 text-white font-semibold`}>{getAchievedPercent(goalDisplay, achievedDisplay)}</td>
		                    <td className={tdClass}>{getActivityDisplay(task)}</td>
	                    <td className={`${tdClass}`}>{task.lastUpdateRemarks || '-'}</td>
	                    <td className={`${tdClass} font-bold ${isOverdue ? 'text-red-600 animate-pulse' : 'text-indigo-600'}`}>
	                        {nextDueStr}
	                    </td>
                    <td className={tdClass}>
                      <div className="flex items-center gap-1 justify-center" onDoubleClick={(e) => e.stopPropagation()}>
                        <button onClick={() => onUpdate(task)} className="px-2 py-1 bg-indigo-600 text-white rounded text-[10px] font-bold hover:bg-indigo-700">Update</button>
                        <button onClick={() => onEdit(task)} className="p-1 text-indigo-600 hover:bg-indigo-50 rounded" title="Edit Master"><Edit2 size={16} /></button>
                        <button onClick={() => onViewHistory(task)} className="p-1 text-indigo-500 hover:bg-indigo-50 rounded"><Info size={16} /></button>
                        {isAdmin && (
                          <button 
                            onClick={() => handleDelete(task.id)} 
                            disabled={deletingIds.has(task.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                          >
                            {deletingIds.has(task.id) ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                          </button>
                        )}
                      </div>
                    </td>
	                  </tr>
                    </React.Fragment>
	                );
	              })}
			              {paginatedTasks.length === 0 && (<tr><td colSpan={isAdmin ? 17 : 16} className="px-6 py-10 text-center text-gray-500">No recurring tasks found.</td></tr>)}
	            </tbody>
	          </table>
	        </div>
	      </div>

      <div className={`space-y-4 md:hidden ${viewMode === 'card' ? 'block' : 'hidden'}`}>
        {paginatedTasks.map((task, idx) => {
             const effectiveStatus = getEffectiveStatus(task);
	             const nextDueStr = getNextDueDateStr(task);
	             const nextDueObj = getNextDueDateObject(task);
	             const isOverdue = effectiveStatus !== 'Complete' && nextDueObj && (nextDueObj.getTime() < new Date().setHours(0,0,0,0));
               const achieved = String(achievedSumByTaskId.get(Number(task.id || 0)) || 0);
               const goalDisplay = hasGoalValue(task.goal) ? String(task.goal) : '1';
               const achievedDisplay = hasGoalValue(task.goal) ? achieved : '0';

             return (
                <div 
                  key={task.id} 
                  onDoubleClick={() => onUpdate(task)}
                  className={`bg-white rounded-lg shadow-sm border p-4 relative cursor-pointer ${selectedIds.includes(task.id) ? 'border-indigo-500 bg-indigo-50/30' : 'border-gray-200'}`}
                >
                    <div className="mb-3">
                    <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-2">
                            {isAdmin && (
                                <input 
                                    type="checkbox" 
                                    className="rounded border-gray-300 text-blue-600 h-5 w-5" 
                                    checked={selectedIds.includes(task.id)} 
                                    onChange={() => handleSelectOne(task.id)}
                                    onDoubleClick={(e) => e.stopPropagation()}
                                />
                            )}
                            <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-[10px] font-bold">#{startEntry + idx}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getStatusColor(effectiveStatus)} whitespace-normal break-words`}>{effectiveStatus}</span>
                    </div>
                    <h3 className="font-bold text-gray-900 leading-tight mt-2 whitespace-normal break-words">{task.title}</h3>
                    </div>
		                    <div className="grid grid-cols-2 gap-y-2 text-xs text-gray-600 mb-4 bg-gray-50 p-2 rounded">
                    <div><span className="text-gray-400 font-bold uppercase text-[9px] block">Client</span><span className="whitespace-normal break-words">{task.firm || '-'}</span></div>
                    <div><span className="text-gray-400 font-bold uppercase text-[9px] block">Owner</span><span className="whitespace-normal break-words">{task.owner || '-'}</span></div>
		                    <div><span className="text-gray-400 font-bold uppercase text-[9px] block">{getFieldLabel('recurringTask.category', 'Category')}</span><span className="whitespace-normal break-words">{task.category}</span></div>
	                    <div><span className="text-gray-400 font-bold uppercase text-[9px] block">Assignee</span><span className="whitespace-normal break-words">{task.assignee}</span></div>
		                    <div><span className="text-gray-400 font-bold uppercase text-[9px] block">Period</span><span className="whitespace-pre-line break-words">{getFrequencyText(task)}</span></div>
		                    <div><span className="text-gray-400 font-bold uppercase text-[9px] block">Time</span><span className="whitespace-normal break-words">{task.time || '-'}</span></div>
                        <div><span className="text-gray-400 font-bold uppercase text-[9px] block">Goal</span><span className="whitespace-normal break-words">{goalDisplay}</span></div>
                        <div><span className="text-gray-400 font-bold uppercase text-[9px] block">Achieved</span><span className="whitespace-normal break-words">{achievedDisplay}</span></div>
                        <div><span className="text-gray-400 font-bold uppercase text-[9px] block">Achieved %</span><span className="whitespace-normal break-words">{getAchievedPercent(goalDisplay, achievedDisplay)}</span></div>
		                    <div>
		                        <span className="text-indigo-500 font-bold uppercase text-[9px] block">Next Due</span>
	                        <span className={`font-bold ${isOverdue ? 'text-red-600' : 'text-indigo-600'} whitespace-normal break-words`}>{nextDueStr}</span>
	                    </div>
                      <div className="col-span-2 mt-1 pt-1 border-t border-gray-100">
                        <span className="text-gray-400 font-bold uppercase text-[9px] block">Notes</span>
                        <div className="text-[10px] text-gray-600 whitespace-normal break-words">
                          {task.notes || '-'}
                        </div>
                      </div>
                      <div className="col-span-2 mt-1 pt-1 border-t border-gray-100">
                        <span className="text-gray-400 font-bold uppercase text-[9px] block">Last Activity</span>
	                        <div className="text-[10px] text-gray-600">{getActivityDisplay(task)}</div>
                      </div>
	                    </div>
                    <div className="flex gap-2 pt-3 border-t border-gray-100 flex-wrap">
                        <button onClick={() => onUpdate(task)} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm whitespace-normal break-words"><RotateCcw size={14} />Update</button>
                        <div className="flex gap-1 w-full sm:w-auto justify-end" onDoubleClick={(e) => e.stopPropagation()}>
                            <button onClick={() => onViewHistory(task)} className="p-2 text-indigo-500 hover:bg-gray-100 rounded-full border border-gray-100"><Info size={18} /></button>
                            <button onClick={() => onEdit(task)} className="p-2 text-indigo-600 hover:bg-gray-100 rounded-full border border-gray-100"><Edit2 size={18} /></button>
                            {isAdmin && (
                              <button 
                                onClick={() => handleDelete(task.id)} 
                                disabled={deletingIds.has(task.id)}
                                className="p-2 text-red-600 hover:bg-gray-100 rounded-full border border-gray-100 disabled:opacity-50"
                              >
                                {deletingIds.has(task.id) ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                              </button>
                            )}
                        </div>
                    </div>
                </div>
             );
        })}
      </div>

      <div className="flex justify-between items-center text-xs text-indigo-600 font-bold px-1 uppercase tracking-wider">
          <span>Showing {startEntry} to {endEntry} of {filteredTasks.length} entries</span>
          <div className="flex space-x-2">
              <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} className="px-4 py-1.5 bg-indigo-600 text-white rounded shadow hover:bg-indigo-700 disabled:opacity-50 transition-colors uppercase text-[10px]" disabled={currentPage === 1}>Previous</button>
              <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} className="px-4 py-1.5 bg-indigo-600 text-white rounded shadow hover:bg-indigo-700 disabled:opacity-50 transition-colors uppercase text-[10px]" disabled={currentPage === totalPages || totalPages === 0}>Next</button>
          </div>
      </div>

      {/* Custom Confirmation for Bulk Delete */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
              <div className="p-6 text-center space-y-4">
                 <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600">
                    <Trash2 size={32} />
                 </div>
                 <div>
                    <h3 className="text-xl font-bold text-gray-900 uppercase">Delete Recurring Tasks?</h3>
                    <p className="text-sm text-gray-500 mt-2">
                       Are you sure you want to delete <strong>{selectedIds.length}</strong> selected recurring tasks? 
                       <br/>This will permanently remove the rules and history.
                    </p>
                 </div>
                 <div className="flex gap-3 pt-2">
                    <button 
                       onClick={() => setShowDeleteConfirm(false)}
                       className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors uppercase text-sm"
                    >
                       Cancel
                    </button>
                    <button 
                       onClick={confirmBulkDelete}
                       className="flex-1 py-3 px-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-200 uppercase text-sm"
                    >
                       Delete All
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
