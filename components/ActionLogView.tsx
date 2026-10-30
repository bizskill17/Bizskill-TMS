import React, { useState, useMemo, useEffect } from 'react';
import { Search, FileText, LayoutGrid, LayoutList, Calendar, User, Clock, AlertCircle, Filter, ArrowUpDown, ArrowUp, ArrowDown, X, Trash2, Briefcase, Building2, Download } from 'lucide-react';
import { ActionLogEntry, Project } from '../types';
import { SearchableSelect } from './SearchableSelect';
import { TaskCardFields, TaskCardField } from './TaskCardFields';
import { formatToIndianDate, formatToIndianDateTime, parseToISO } from '../App';

interface ActionLogViewProps {
  logs?: ActionLogEntry[];
  isAdmin: boolean;
  isVendorView?: boolean;
  onDeleteLog: (logId: number, taskId: number) => void;
  projects?: Project[];
  dashboardFilter?: { type: string; value: string; dateFrom?: string; dateTo?: string } | null;
  onClearDashboardFilter?: () => void;
}

type SortConfig = {
  key: keyof ActionLogEntry;
  direction: 'asc' | 'desc';
} | null;

export const ActionLogView: React.FC<ActionLogViewProps> = ({ 
    logs = [], 
    isAdmin,
    isVendorView = false, 
    onDeleteLog, 
    projects = [], 
    dashboardFilter = null,
    onClearDashboardFilter 
}) => {
  const [photoViewer, setPhotoViewer] = useState<{ photos: string[]; index: number } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [updateDateFrom, setUpdateDateFrom] = useState('');
  const [updateDateTo, setUpdateDateTo] = useState('');
  const [taskDateFrom, setTaskDateFrom] = useState('');
  const [taskDateTo, setTaskDateTo] = useState('');
  
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterOwner, setFilterOwner] = useState<string[]>([]);
  const [filterAssignee, setFilterAssignee] = useState<string[]>([]);
  const [filterProject, setFilterProject] = useState<string[]>([]);
  const [filterVendor, setFilterVendor] = useState<string[]>([]);
  const [filterClient, setFilterClient] = useState<string[]>([]);
  
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [showFilters, setShowFilters] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    if (dashboardFilter) {
      if (dashboardFilter.type === 'owner') {
          setFilterOwner([dashboardFilter.value]);
          setSearchTerm(''); 
      } else if (dashboardFilter.type === 'vendor') {
          setFilterVendor([dashboardFilter.value]);
          setSearchTerm('');
      } else if (dashboardFilter.type === 'assignee') {
          setFilterAssignee([dashboardFilter.value]);
          setSearchTerm('');
      }

      if (dashboardFilter.dateFrom) setUpdateDateFrom(dashboardFilter.dateFrom);
      if (dashboardFilter.dateTo) setUpdateDateTo(dashboardFilter.dateTo);
      
      if (dashboardFilter.dateFrom || dashboardFilter.dateTo) setShowFilters(true);
    } else {
      setUpdateDateFrom('');
      setUpdateDateTo('');
      setFilterOwner([]);
      setFilterAssignee([]);
      setFilterVendor([]);
    }
  }, [dashboardFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, updateDateFrom, updateDateTo, taskDateFrom, taskDateTo, filterStatus, filterOwner, filterAssignee, filterProject, filterVendor, filterClient]);

  const requestSort = (key: keyof ActionLogEntry) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: keyof ActionLogEntry) => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown size={14} className="ml-1 opacity-50 text-white" />;
    return sortConfig.direction === 'asc' ? <ArrowUp size={14} className="ml-1 text-white" /> : <ArrowDown size={14} className="ml-1 text-white" />;
  };

  const uniqueOwners = useMemo(() => Array.from(new Set(logs.flatMap(l => String(l.owner || '').split(',').map(s => s.trim()).filter(Boolean)))), [logs]);
  const uniqueAssignees = useMemo(() => Array.from(new Set(logs.flatMap(l => String(l.assignees || '').split(',').map(s => s.trim()).filter(Boolean)))), [logs]);
  const uniqueClients = useMemo(() => Array.from(new Set(logs.map(l => String(l.clientName || '').trim()).filter(Boolean))), [logs]);

  const projectPairs = useMemo(() => {
    return logs.map(l => {
      const rawProject = String(l.project || '').trim();
      const rawClient = String(l.clientName || '').trim();
      if (!rawProject) return null;
      const display = (rawClient && !rawProject.includes('(')) ? `${rawProject} (${rawClient})` : rawProject;
      return { rawProject, rawClient, display };
    }).filter(Boolean) as Array<{ rawProject: string; rawClient: string; display: string }>;
  }, [logs]);

  const uniqueProjects = useMemo(() => {
    return Array.from(new Set(projectPairs.map(p => p.display))).filter(Boolean);
  }, [projectPairs]);

  const projectDisplayToClients = useMemo(() => {
    const map = new Map<string, Set<string>>();
    projectPairs.forEach(p => {
      if (!map.has(p.display)) map.set(p.display, new Set());
      if (p.rawClient) map.get(p.display)!.add(p.rawClient);
    });
    return map;
  }, [projectPairs]);

  const visibleProjectsForProjectFilter = useMemo(() => {
    if (!filterClient || filterClient.length === 0) return uniqueProjects;
    const selectedClients = new Set(filterClient.map(c => String(c || '').trim()).filter(Boolean));
    return uniqueProjects.filter(display => {
      const clients = projectDisplayToClients.get(display);
      if (!clients || clients.size === 0) return false;
      for (const c of clients) {
        if (selectedClients.has(c)) return true;
      }
      return false;
    });
  }, [uniqueProjects, projectDisplayToClients, filterClient]);

  const allowedProjectValuesForProjectFilter = useMemo(() => {
    const allowed = new Set<string>();
    const visibleSet = new Set(visibleProjectsForProjectFilter);
    projectPairs.forEach(p => {
      if (!visibleSet.has(p.display)) return;
      allowed.add(p.display);
      allowed.add(p.rawProject);
    });
    return allowed;
  }, [visibleProjectsForProjectFilter, projectPairs]);

  useEffect(() => {
    if (!filterProject || filterProject.length === 0) return;
    const next = filterProject.filter(v => allowedProjectValuesForProjectFilter.has(String(v || '').trim()));
    const changed = next.length !== filterProject.length || next.some((v, idx) => v !== filterProject[idx]);
    if (changed) setFilterProject(next);
  }, [allowedProjectValuesForProjectFilter, filterProject, setFilterProject]);

  const uniqueStatuses = useMemo(() => Array.from(new Set(logs.map(l => l.status))), [logs]);
  const uniqueVendors = useMemo(() => Array.from(new Set(logs.map(l => String(l.vendor || '')).filter(v => v !== ''))), [logs]);

  const ownerOptions = uniqueOwners.map(o => ({ value: o, label: o }));
  const assigneeOptions = uniqueAssignees.map(a => ({ value: a, label: a }));
  const projectOptions = visibleProjectsForProjectFilter.map(p => ({ value: p, label: p }));
  const statusOptions = uniqueStatuses.map(s => ({ value: s, label: s }));
  const vendorOptions = uniqueVendors.map(v => ({ value: v, label: v }));
  const clientOptions = uniqueClients.map(c => ({ value: c, label: c }));

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (searchTerm) {
        const lowerTerm = searchTerm.toLowerCase();
        const matchesSearch = Object.values(log).some(val => 
          String(val || '').toLowerCase().includes(lowerTerm)
        );
        if (!matchesSearch) return false;
      }
      
      const logISO = parseToISO(log.updateDate);
      if (updateDateFrom && logISO < updateDateFrom) return false;
      if (updateDateTo && logISO > updateDateTo) return false;

      const taskISO = parseToISO(log.taskDate);
      if (taskDateFrom && taskISO < taskDateFrom) return false;
      if (taskDateTo && taskISO > taskDateTo) return false;

	      if (filterStatus.length > 0 && !filterStatus.includes(log.status)) return false;
	      if (filterOwner.length > 0 && !filterOwner.some(v => String(log.owner || '').includes(v))) return false;

	      const rawLogProject = String(log.project || '').trim();
	      const rawLogClient = String(log.clientName || '').trim();
	      const displayLogProject = (rawLogProject && rawLogClient && !rawLogProject.includes('(')) ? `${rawLogProject} (${rawLogClient})` : rawLogProject;
	      if (filterProject.length > 0 && !filterProject.includes(rawLogProject) && !filterProject.includes(displayLogProject)) return false;

	      if (filterClient.length > 0 && !filterClient.includes(log.clientName || '')) return false;
	      
	      if (isVendorView) {
	          if (filterVendor.length > 0 && !filterVendor.includes(log.vendor || '')) return false;
	      } else {
	          if (filterAssignee.length > 0 && !filterAssignee.some(v => String(log.assignees || '').includes(v))) return false;
      }
      return true;
    });
  }, [logs, searchTerm, updateDateFrom, updateDateTo, taskDateFrom, taskDateTo, filterStatus, filterOwner, filterAssignee, filterProject, filterVendor, filterClient, isVendorView]);

  const sortedLogs = useMemo(() => {
    let sortableItems = [...filteredLogs];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue = a[sortConfig.key] ?? '';
        let bValue = b[sortConfig.key] ?? '';
        
        if (sortConfig.key === 'updateDate' || sortConfig.key === 'taskDate') {
            const isoA = parseToISO(String(aValue));
            const isoB = parseToISO(String(bValue));
            if (isoA < isoB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (isoA > isoB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
        sortableItems.sort((a, b) => {
            const isoA = parseToISO(a.updateDate);
            const isoB = parseToISO(b.updateDate);
            return isoB.localeCompare(isoA);
        });
    }
    return sortableItems;
  }, [filteredLogs, sortConfig]);

  const totalPages = Math.ceil(sortedLogs.length / itemsPerPage);
  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedLogs.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedLogs, currentPage]);

  const activeFilterSummary = useMemo(() => {
    const parts: string[] = [];
    const cleanSearch = searchTerm.replace(/\s+/g, ' ').trim();

    if (cleanSearch) parts.push(`Search: "${cleanSearch}"`);
    if (updateDateFrom || updateDateTo) {
      parts.push(
        `Update Date: ${updateDateFrom ? formatToIndianDate(updateDateFrom) : 'start'} to ${updateDateTo ? formatToIndianDate(updateDateTo) : 'end'}`
      );
    }
    if (taskDateFrom || taskDateTo) {
      parts.push(
        `Task Date: ${taskDateFrom ? formatToIndianDate(taskDateFrom) : 'start'} to ${taskDateTo ? formatToIndianDate(taskDateTo) : 'end'}`
      );
    }
    if (filterStatus.length > 0) parts.push(`Status: ${filterStatus.join(', ')}`);
    if (filterOwner.length > 0) parts.push(`Owner: ${filterOwner.join(', ')}`);
    if (filterProject.length > 0) parts.push(`Project: ${filterProject.length} selected`);
    if (filterClient.length > 0) parts.push(`Client: ${filterClient.length} selected`);
    if (isVendorView) {
      if (filterVendor.length > 0) parts.push(`Vendor: ${filterVendor.join(', ')}`);
    } else {
      if (filterAssignee.length > 0) parts.push(`Assignee: ${filterAssignee.join(', ')}`);
    }

    return parts.length > 0 ? parts.join(' | ') : 'No filters applied';
  }, [
    searchTerm,
    updateDateFrom,
    updateDateTo,
    taskDateFrom,
    taskDateTo,
    filterStatus,
    filterOwner,
    filterProject,
    filterClient,
    filterVendor,
    filterAssignee,
    isVendorView
  ]);

  const handleExportExcel = () => {
    const headers = ['Task', 'Task Date', 'Update Date', 'Status', 'Minutes', 'Remarks', 'Photo', 'PDF', 'Owner'];
    if (isVendorView) headers.push('Vendor');
    else headers.push('Assignee');

    const csvContent = [
        headers.join(','),
        ...sortedLogs.map(log => {
            const row = [
                `"${String(log.task || '').replace(/"/g, '""')}"`, 
                formatToIndianDate(log.taskDate), 
                formatToIndianDate(log.updateDate), 
                log.status,
                log.hours || 0,
                `"${String(log.remarks || '').replace(/"/g, '""')}"`, 
                parsePhotos(log.photos).length > 0 ? `${parsePhotos(log.photos).length} photo(s)` : '-',
                log.pdf ? 'Open PDF' : '-',
                `"${log.owner}"`
            ];
            if (isVendorView) row.push(`"${log.vendor || ''}"`);
            else row.push(`"${log.assignees}"`);
            return row.join(',');
        })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${isVendorView ? 'Vendor_' : ''}Action_Log_Export_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  };

  const handleExportPDF = async () => {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const doc = new jsPDF('l', 'mm', 'a4');
    const exportDate = new Date().toISOString().split('T')[0];
    const title = isVendorView ? 'Vendor Action Log' : 'Task Action Log';
    const oneLineFilterText = `Filters: ${activeFilterSummary}`;
    const pdfFilterText = oneLineFilterText.length > 180 ? `${oneLineFilterText.slice(0, 177)}...` : oneLineFilterText;

    doc.setFontSize(16);
    doc.setTextColor(30, 64, 175);
    doc.text(title, 14, 14);

    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(`Generated on: ${new Date().toLocaleString('en-GB')}`, 14, 20);
    doc.text(`Total entries: ${sortedLogs.length}`, 14, 25);
    doc.text(pdfFilterText, 14, 30);

    const headers = [
      'S.No',
      'Task',
      'Task Date',
      'Update Date',
      'Status',
      'Minutes',
      'Remarks',
      'Photo',
      'PDF',
      'Owner',
      isVendorView ? 'Vendor' : 'Assignee'
    ];

    const rows = sortedLogs.map((log, index) => [
      index + 1,
      log.task || '-',
      formatToIndianDate(log.taskDate),
      formatToIndianDate(log.updateDate),
      log.status || '-',
      log.hours || 0,
      log.remarks || '-',
      parsePhotos(log.photos).length > 0 ? `${parsePhotos(log.photos).length} photo(s)` : '-',
      log.pdf ? 'Open PDF' : '-',
      log.owner || '-',
      isVendorView ? (log.vendor || '-') : (log.assignees || '-')
    ]);

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 35,
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: 2,
        overflow: 'linebreak',
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.1
      },
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: [255, 255, 255]
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 48 },
        6: { cellWidth: 45 },
        9: { cellWidth: 30 },
        10: { cellWidth: 30 }
      }
    });

    doc.save(`${isVendorView ? 'Vendor_' : ''}Action_Log_Export_${exportDate}.pdf`);
  };

  const handleClearFilters = () => {
      setUpdateDateFrom('');
      setUpdateDateTo('');
      setTaskDateFrom('');
      setTaskDateTo('');
      setFilterStatus([]);
      setFilterOwner([]);
      setFilterAssignee([]);
      setFilterProject([]);
      setFilterVendor([]);
      setFilterClient([]);
      setSearchTerm('');
      if (onClearDashboardFilter) onClearDashboardFilter();
  };

  const getFilterClass = (isActive: boolean) => 
    `w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors ${isActive ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-black' : 'bg-white border-indigo-300 text-black'}`;

  const parseNumber = (value: unknown): number => {
    const num = Number(String(value ?? '').trim());
    return Number.isFinite(num) ? num : 0;
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
	      setTimeout(() => URL.revokeObjectURL(url), 60_000);
	    } catch {
	      window.open(href, '_blank', 'noopener,noreferrer');
	    }
	  };

  const thClass = "px-6 py-4 text-xs font-black text-white uppercase tracking-widest border-r border-black last:border-r-0 cursor-pointer !bg-blue-700 hover:bg-blue-800 transition-colors select-none whitespace-normal sticky top-0 z-10";
  const tdClass = "px-6 py-4 text-sm text-gray-900 border-r border-black last:border-r-0 whitespace-normal break-words align-top";

  const startEntry = sortedLogs.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endEntry = Math.min(currentPage * itemsPerPage, sortedLogs.length);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="sr-only">{isVendorView ? 'Vendor Action Log' : 'Action Log'}</h2>
        </div>
        <div className="flex gap-3 w-full md:auto items-center">
            <div className="flex bg-blue-50 p-1 rounded-lg md:hidden border border-blue-200">
                <button aria-label="Card View" title="Card View" onClick={() => setViewMode('card')} className={`p-1.5 rounded-md transition-all ${viewMode === 'card' ? 'bg-white shadow text-blue-600' : 'text-blue-500'}`}><LayoutGrid size={18} /></button>
                <button aria-label="Table View" title="Table View" onClick={() => setViewMode('table')} className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-white shadow text-indigo-600' : 'text-blue-500'}`}><LayoutList size={18} /></button>
            </div>
            <button onClick={handleExportExcel} title="Export Excel" className="flex items-center justify-center p-2.5 bg-blue-600 text-white border-2 border-blue-700 rounded-md hover:bg-blue-700 shadow-sm transition-colors">
              <FileText size={16} />
            </button>
            <button onClick={handleExportPDF} title="Export PDF" className="flex items-center justify-center p-2.5 bg-white text-blue-700 border-2 border-blue-700 rounded-md hover:bg-blue-50 shadow-sm transition-colors">
              <Download size={16} />
            </button>
            <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center space-x-1 px-3 py-2 border-2 rounded-md text-xs font-black shadow-sm transition-all duration-200 uppercase tracking-widest ${showFilters ? 'bg-blue-600 border-blue-700 text-white' : 'bg-blue-50 border-blue-300 text-blue-600 hover:bg-blue-100'}`} title="Toggle Filters">
              <Filter size={16} />
            </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border-2 border-blue-400 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-blue-600" size={18} />
          <input 
            type="text" 
            placeholder="Search log history..." 
            className={`w-full pl-10 pr-4 py-2 border-2 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-100 text-sm transition-colors font-black ${searchTerm ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-blue-200 text-blue-900'}`} 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="w-full px-3 py-2 rounded-md border border-blue-200 bg-blue-50">
          <p className="text-[10px] sm:text-[11px] font-black text-blue-700 tracking-wider whitespace-nowrap overflow-x-auto custom-scrollbar">
            FILTERS: <span className="font-semibold normal-case tracking-normal text-blue-900">{activeFilterSummary}</span>
          </p>
        </div>
        <div className={`${showFilters ? 'grid' : 'hidden'} grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end animate-in fade-in slide-in-from-top-2 duration-200`}>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest block">Update From</label>
                <input type="date" className={getFilterClass(updateDateFrom !== '')} value={updateDateFrom} onChange={(e) => setUpdateDateFrom(e.target.value)}/>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest block">Update To</label>
                <input type="date" className={getFilterClass(updateDateTo !== '')} value={updateDateTo} onChange={(e) => setUpdateDateTo(e.target.value)}/>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest block">Task Date From</label>
                <input type="date" className={getFilterClass(taskDateFrom !== '')} value={taskDateFrom} onChange={(e) => setTaskDateFrom(e.target.value)}/>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest block">Task Date To</label>
                <input type="date" className={getFilterClass(taskDateTo !== '')} value={taskDateTo} onChange={(e) => setTaskDateTo(e.target.value)}/>
              </div>

              <div className="space-y-1 text-blue-600 font-black uppercase tracking-wider">
                <SearchableSelect label={<span className="text-[10px] font-black uppercase tracking-widest">Status</span>} options={statusOptions} value={filterStatus} onChange={setFilterStatus} multiple={true} placeholder="All Status" className="text-sm" />
              </div>
              <div className="space-y-1 text-blue-600 font-black uppercase tracking-wider">
                <SearchableSelect label={<span className="text-[10px] font-black uppercase tracking-widest">Owner</span>} options={ownerOptions} value={filterOwner} onChange={setFilterOwner} multiple={true} placeholder="All Owners" className="text-sm" />
              </div>

              {isVendorView ? (
                  <div className="space-y-1 text-blue-600 font-black uppercase tracking-wider">
                    <SearchableSelect label={<span className="text-[10px] font-black uppercase tracking-widest">Vendor</span>} options={vendorOptions} value={filterVendor} onChange={setFilterVendor} multiple={true} placeholder="All Vendors" className="text-sm" />
                  </div>
              ) : (
                  <div className="space-y-1 text-blue-600 font-black uppercase tracking-wider">
                    <SearchableSelect label={<span className="text-[10px] font-black uppercase tracking-widest">Assignee</span>} options={assigneeOptions} value={filterAssignee} onChange={setFilterAssignee} multiple={true} placeholder="All Assignees" className="text-sm" />
                  </div>
              )}
              <div className="flex items-end">
                  <button onClick={handleClearFilters} className="w-full px-4 py-2 bg-red-600 text-white border-2 border-red-700 rounded-md hover:bg-red-700 text-xs font-black uppercase tracking-widest h-[42px] flex items-center justify-center gap-2">
                    <X size={16}/>Clear
                  </button>
              </div>
        </div>
      </div>

      <div className={`space-y-4 md:hidden ${viewMode === 'card' ? 'block' : 'hidden'}`}>
        {paginatedLogs.map(log=>(
          <article key={log.id} aria-label={log.task || 'Action log'} className="min-w-0 bg-white border border-blue-200 rounded-xl p-4 shadow-sm">
            <TaskCardFields>
              <TaskCardField label="Task"><h4 className="font-semibold text-indigo-800">{log.task}</h4></TaskCardField>
              <TaskCardField label="Update Date">{formatToIndianDate(log.updateDate)}</TaskCardField>
              <TaskCardField label={isVendorView ? 'Vendor' : 'Assignee'}>{isVendorView ? log.vendor : log.assignees}</TaskCardField>
              <TaskCardField label="Status">{log.status}</TaskCardField>
              <TaskCardField label="Client">{log.clientName || log.firm}</TaskCardField>
              <TaskCardField label="Owner">{log.owner}</TaskCardField>
              <TaskCardField label="Task Date">{formatToIndianDate(log.taskDate)}</TaskCardField>
              <TaskCardField label="Minutes">{log.hours}</TaskCardField>
              <TaskCardField label="Remarks">{log.remarks}</TaskCardField>
              <TaskCardField label="Photo">{parsePhotos(log.photos).length>0 ? <button type="button" onClick={()=>setPhotoViewer({photos:parsePhotos(log.photos),index:0})} className="text-indigo-700 underline">{parsePhotos(log.photos).length} photo(s)</button> : null}</TaskCardField>
              <TaskCardField label="PDF">{normalizePdfHref(log.pdf) ? <button type="button" onClick={()=>openPdf(log.pdf)} className="text-indigo-700 underline">Open PDF</button> : null}</TaskCardField>
            </TaskCardFields>
            {isAdmin && <div className="flex justify-end pt-3">
              <button type="button" aria-label={'Delete log for '+log.task} onClick={()=>onDeleteLog(log.id,log.taskId)} className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100"><Trash2 size={16}/>Delete</button>
            </div>}
          </article>
        ))}
        {paginatedLogs.length === 0 && <div className="text-center py-10 text-blue-300 font-black uppercase text-xs">No logs found.</div>}
      </div>

      <div className={`bg-white rounded-lg border-2 border-black shadow-sm overflow-hidden ${viewMode === 'card' ? 'hidden md:block' : 'block'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-max table-fixed">
            <thead>
              <tr className="!bg-blue-700">
                <th className="px-4 py-3 text-[10px] font-black text-white uppercase tracking-widest border-r border-black w-16 text-center !bg-blue-700 sticky top-0 z-10">S.No.</th>
                <th className={thClass} style={{ width: '350px' }} onClick={() => requestSort('task')}><div className="flex items-center">Task {getSortIcon('task')}</div></th>
                <th className={thClass} style={{ width: '120px' }} onClick={() => requestSort('taskDate')}><div className="flex items-center">Task Date {getSortIcon('taskDate')}</div></th>
                <th className={thClass} style={{ width: '130px' }} onClick={() => requestSort('updateDate')}><div className="flex items-center">Update Date {getSortIcon('updateDate')}</div></th>
                <th className={thClass} style={{ width: '120px' }} onClick={() => requestSort('status')}><div className="flex items-center">Status {getSortIcon('status')}</div></th>
                <th className={thClass} style={{ width: '100px' }} onClick={() => requestSort('hours')}><div className="flex items-center">Minutes {getSortIcon('hours')}</div></th>
                <th className={thClass} style={{ width: '300px' }} onClick={() => requestSort('remarks')}><div className="flex items-center">Remarks {getSortIcon('remarks')}</div></th>
	                <th className={thClass} style={{ width: '140px' }}></th>
	                <th className={thClass} style={{ width: '120px' }}></th>
                <th className={thClass} style={{ width: '120px' }}><div className="flex items-center">Photo</div></th>
                <th className={thClass} style={{ width: '120px' }}><div className="flex items-center">PDF</div></th>
                <th className={thClass} style={{ width: '180px' }} onClick={() => requestSort('owner')}><div className="flex items-center">Owner {getSortIcon('owner')}</div></th>
                {isVendorView ? (
                    <th className={thClass} style={{ width: '180px' }} onClick={() => requestSort('vendor')}><div className="flex items-center">Vendor {getSortIcon('vendor')}</div></th>
                ) : (
                    <th className={thClass} style={{ width: '180px' }} onClick={() => requestSort('assignees')}><div className="flex items-center">Assignee {getSortIcon('assignees')}</div></th>
                )}
                <th className="px-6 py-4 text-xs font-black text-white uppercase tracking-widest text-center whitespace-normal !bg-blue-700 sticky top-0 z-10" style={{ width: '100px' }}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black">
              {paginatedLogs.map((log, index) => (
                <tr key={log.id} className="hover:bg-blue-50/50 transition-colors">
                  <td className={`${tdClass} text-center font-bold text-blue-600 !whitespace-nowrap`}>{startEntry + index}</td>
                  <td className={`${tdClass} font-bold`} title={log.task}>{log.task}</td>
                  <td className={`${tdClass} !whitespace-nowrap`}>{formatToIndianDate(log.taskDate)}</td>
                  <td className={`${tdClass} !whitespace-nowrap`}>{formatToIndianDate(log.updateDate)}</td>
                  <td className={tdClass}><span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-[10px] font-black uppercase tracking-tighter !whitespace-nowrap border border-blue-200">{log.status}</span></td>
                  <td className={`${tdClass} font-bold text-indigo-600 text-center`}>{log.hours || 0}</td>
                  <td className={`${tdClass} italic text-blue-800`} title={log.remarks}>{log.remarks}</td>
                  <td className={tdClass}>
                    {parsePhotos(log.photos).length > 0 ? (
                      <button type="button" onClick={() => setPhotoViewer({ photos: parsePhotos(log.photos), index: 0 })} className="text-indigo-600 underline">
                        {parsePhotos(log.photos).length} photo(s)
                      </button>
                    ) : '-'}
                  </td>
	                  <td className={tdClass}>
	                    {normalizePdfHref(log.pdf) ? (
	                      <button type="button" onClick={() => openPdf(log.pdf)} className="text-indigo-600 underline">
	                        Open PDF
	                      </button>
	                    ) : '-'}
	                  </td>
                  <td className={`${tdClass} font-bold text-xs uppercase`}>{log.owner}</td>
                  {isVendorView ? (
                    <td className={`${tdClass} font-bold text-xs uppercase`}>{log.vendor}</td>
                  ) : (
                    <td className={`${tdClass} font-bold text-xs uppercase`}>{log.assignees}</td>
                  )}
                  <td className={`${tdClass} text-center`}>
                    {isAdmin && (
                      <button onClick={() => onDeleteLog(log.id, log.taskId)} className="p-1.5 text-red-500 hover:bg-red-50 border-2 border-transparent hover:border-red-600 rounded-md transition-all">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
	              {paginatedLogs.length === 0 && (<tr><td colSpan={16} className="px-6 py-12 text-center text-blue-300 font-black uppercase">No update logs found.</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-between items-center text-xs text-blue-600 font-black px-1 uppercase tracking-wider">
          <span>Showing {startEntry} to {endEntry} of {sortedLogs.length} entries</span>
          <div className="flex space-x-2">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-4 py-1.5 bg-blue-600 text-white rounded shadow hover:bg-blue-700 disabled:opacity-50 transition-colors uppercase text-[10px] font-black" 
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-4 py-1.5 bg-blue-600 text-white rounded shadow hover:bg-blue-700 disabled:opacity-50 transition-colors uppercase text-[10px] font-black"
                disabled={currentPage === totalPages || totalPages === 0}
              >
                Next
              </button>
          </div>
      </div>

      {photoViewer && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" onClick={() => setPhotoViewer(null)}>
          <div className="relative w-full max-w-4xl rounded-2xl bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setPhotoViewer(null)} className="absolute right-3 top-3 rounded-full bg-white/90 p-2 text-gray-700 shadow hover:text-black">
              <X size={18} />
            </button>
            <div className="flex min-h-[280px] items-center justify-center overflow-hidden rounded-xl bg-gray-100">
              <img src={photoViewer.photos[photoViewer.index]} alt={`Log photo ${photoViewer.index + 1}`} className="max-h-[70vh] w-auto max-w-full object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};



