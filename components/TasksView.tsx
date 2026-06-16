
import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Download, FileText, Search, CheckSquare, LayoutGrid, LayoutList, Filter, X, Clock, AlertTriangle, Users, Trash2, AlertCircle, Tags, Menu } from 'lucide-react';
import { TaskTable } from './TaskTable';
import { UpdateTaskModal } from './UpdateTaskModal';
import { EditTaskModal } from './EditTaskModal';
import { BulkUpdateModal } from './BulkUpdateModal';
import { Task, User, Project, Category, Vendor, VendorCategory, Firm, Client } from '../types';
import { SearchableSelect } from './SearchableSelect';
import { parseToISO, formatToIndianDate } from '../App';
import { useLabels } from '../labelOverrides';

interface TasksViewProps {
	  title: string;
	  description: string;
	  onAddTask: (isVendor?: boolean) => void;
	  tasks: Task[];
  users: User[];
  projects: Project[];
  categories: Category[];
  vendors: Vendor[];
  firms: Firm[];
  clients: Client[];
  taskStatuses: string[];
  onUpdateTask: (task: Task) => void;
  onEditTask: (task: Task) => void;
  onBulkUpdateTask: (ids: number[], updates: Partial<Task>) => void;
  onDeleteTask: (id: number, isVendor: boolean) => void;
  onExportExcel: (tasks: Task[]) => void;
  onViewHistory: (task: Task) => void;
  filterType?: 'all' | 'pending' | 'completed';
  onAddCategory: () => void;
  onAddProject: () => void;
  onAddVendorCategory?: () => void;
  isVendorView?: boolean;
  syncingIds?: Set<number>;
  currentUser?: User | null;
  vendorCategories: VendorCategory[];
  lastAddedCategory?: string;
  lastAddedProject?: string;
  lastAddedVendorCategory?: string;
  onClearLastAdded?: () => void;
  filterStatus: string[];
  setFilterStatus: (val: string[]) => void;
  filterPriority: string[];
  setFilterPriority: (val: string[]) => void;
  filterProject: string[];
  setFilterProject: (val: string[]) => void;
  filterClient: string[];
  setFilterClient: (val: string[]) => void;
  filterOwner: string[];
  setFilterOwner: (val: string[]) => void;
  filterAssignee: string[];
  setFilterAssignee: (val: string[]) => void;
  filterCategory: string[];
  setFilterCategory: (val: string[]) => void;
  filterFirm: string[];
  setFilterFirm: (val: string[]) => void;
  filterVendor?: string[];
  setFilterVendor?: (val: string[]) => void;
  dateFrom: string;
  setDateFrom: (val: string) => void;
  dateTo: string;
  setDateTo: (val: string) => void;
  lastUpdateFrom: string;
  setLastUpdateFrom: (val: string) => void;
	  lastUpdateTo: string;
	  setLastUpdateTo: (val: string) => void;
	  searchTerm: string;
	  setSearchTerm: (val: string) => void;
	  sidebarCollapsed?: boolean;
  showCollapsedMenuButton?: boolean;
  onShowMenu?: () => void;
		}

export const TasksView: React.FC<TasksViewProps> = ({ 
	  title, 
	  description, 
	  onAddTask, 
	  tasks, 
  users,
  projects,
  categories,
  vendors,
  firms,
  clients,
    taskStatuses,
  onUpdateTask,
  onEditTask,
  onBulkUpdateTask,
  onDeleteTask,
  onExportExcel,
  onViewHistory,
  filterType = 'all',
  onAddCategory,
  onAddProject,
  onAddVendorCategory,
  isVendorView = false,
  syncingIds = new Set(),
  currentUser,
  vendorCategories = [],
  lastAddedCategory = '',
  lastAddedProject = '',
  lastAddedVendorCategory = '',
  onClearLastAdded,
  filterStatus, setFilterStatus,
  filterPriority, setFilterPriority,
  filterProject, setFilterProject,
  filterClient, setFilterClient,
  filterOwner, setFilterOwner,
  filterAssignee, setFilterAssignee,
  filterCategory, setFilterCategory,
  filterFirm, setFilterFirm,
  filterVendor = [], setFilterVendor,
  dateFrom, setDateFrom,
	  dateTo, setDateTo,
	  lastUpdateFrom, setLastUpdateFrom,
	  lastUpdateTo, setLastUpdateTo,
	  searchTerm, setSearchTerm,
	  sidebarCollapsed = false,
    showCollapsedMenuButton = false,
    onShowMenu
			}) => {
	  const { getFieldLabel } = useLabels();
	  const categoryLabel = getFieldLabel('task.category', 'Category');
	  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState<'status' | 'priority' | 'assignee' | 'category'>('status');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [mobileViewMode, setMobileViewMode] = useState<'card' | 'table'>('card');
  const [showFilters, setShowFilters] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [sortKey, setSortKey] = useState<keyof Task>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  
  const isAdmin = currentUser?.role === 'Admin';
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    setSelectedIds([]);
    setCurrentPage(1);
  }, [filterType, filterStatus, filterPriority, filterProject, filterClient, filterOwner, filterAssignee, filterCategory, filterFirm, filterVendor, dateFrom, dateTo, lastUpdateFrom, lastUpdateTo, searchTerm]);

  // Helper for generating filter summary string for reports
	  const getFilterSummary = () => {
	    const active: string[] = [];
    if (filterStatus.length > 0) active.push(`Status: ${filterStatus.join(', ')}`);
    if (filterPriority.length > 0) active.push(`Priority: ${filterPriority.join(', ')}`);
    if (filterProject.length > 0) active.push(`Projects: ${filterProject.length} items`);
    if (filterClient.length > 0) active.push(`Clients: ${filterClient.length} items`);
	    if (filterCategory.length > 0) active.push(`${categoryLabel}: ${filterCategory.join(', ')}`);
    if (filterClient.length > 0) active.push(`Clients: ${filterClient.length} items`);
    if (filterAssignee.length > 0) active.push(`Assignee: ${filterAssignee.join(', ')}`);
    if (isVendorView && filterVendor.length > 0) active.push(`Vendor: ${filterVendor.join(', ')}`);
    if (dateFrom || dateTo) active.push(`Date: ${dateFrom || 'start'} to ${dateTo || 'end'}`);
    if (searchTerm) active.push(`Search: "${searchTerm}"`);
    return active.length > 0 ? active.join(' | ') : 'None';
  };

  const normalize = (val: unknown) => String(val || '').trim();
  const splitCommaValues = (val: unknown) => normalize(val).split(',').map(s => s.trim()).filter(Boolean);

  const getProjectInfoFromValue = (projectValue: unknown) => {
    const raw = normalize(projectValue);
    if (!raw) return { name: '', client: '', display: '' };

    const match = raw.match(/^(.*?)\s*\((.*?)\)\s*$/);
    if (match) {
      const name = normalize(match[1]);
      const client = normalize(match[2]);
      const display = client ? `${name} (${client})` : name;
      return { name, client, display };
    }

    const found = projects.find(p => {
      const name = normalize(p.name);
      const client = normalize(p.client);
      const combined = client ? `${name} (${client})` : name;
      return raw === name || raw === combined;
    });

    if (found) {
      const name = normalize(found.name);
      const client = normalize(found.client);
      const display = client ? `${name} (${client})` : name;
      return { name, client, display };
    }

    return { name: raw, client: '', display: raw };
  };

  const getClientFromTask = (task: Task) => {
    const direct = normalize(task.clientName);
    if (direct) return direct;
    const info = getProjectInfoFromValue(task.project);
    return info.client;
  };

  const matchesFilter = (task: Task, filterKey: string, values: string[]) => {
	    if (!values || values.length === 0) return true;
	    switch(filterKey) {
	        case 'status': 
	          if (values.includes('Overdue')) {
	              if (values.length === 1) {
	                  if (task.status === 'Completed' || !task.dueDate) return false;
	                  const dueISO = parseToISO(task.dueDate);
	                  const todayISO = new Date().toISOString().split('T')[0];
	                  return dueISO && dueISO < todayISO;
	              }
	              const isOverdue = task.status !== 'Completed' && task.dueDate && parseToISO(task.dueDate) < new Date().toISOString().split('T')[0];
	              return values.includes(task.status) || isOverdue;
	          }
	          return values.includes(task.status);
	        case 'priority': return values.includes(task.priority);
	        case 'project': {
	          const rawProject = normalize(task.project);
	          if (!rawProject) return false;

	          const info = getProjectInfoFromValue(rawProject);
	          const possible = new Set<string>([rawProject, info.name, info.display]);

	          const parsedRaw = rawProject.match(/^(.*?)\s*\((.*?)\)\s*$/);
	          if (parsedRaw) possible.add(normalize(parsedRaw[1]));

	          const parsedDisplay = info.display.match(/^(.*?)\s*\((.*?)\)\s*$/);
	          if (parsedDisplay) possible.add(normalize(parsedDisplay[1]));

	          return values.some(v => possible.has(normalize(v)));
	        }
	        case 'category': return values.includes(task.category || '');
	        case 'client': return values.includes(getClientFromTask(task));
	        case 'owner': return values.some(v => String(task.owner || '').includes(v));
	        case 'assignee': return values.some(v => String(task.assignees || '').includes(v));
        case 'vendor': return values.includes(task.vendor || '');
	        default: return true;
	    }
	  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (filterType === 'pending') {
          const project = projects.find(p => p.name === task.project || `${p.name} (${p.client})` === task.project);
          if (project && project.status === 'Inactive') return false;
          if (task.status === 'Completed' && filterStatus.length === 0) return false;
      }
      if (filterType === 'completed' && task.status !== 'Completed') return false;

      if (searchTerm) {
        const lowerTerm = searchTerm.toLowerCase();
        const matchesSearch = Object.values(task).some(val => 
          String(val || '').toLowerCase().includes(lowerTerm)
        );
        if (!matchesSearch) return false;
      }

      if (!matchesFilter(task, 'status', filterStatus)) return false;
      if (!matchesFilter(task, 'priority', filterPriority)) return false;
      if (!matchesFilter(task, 'project', filterProject)) return false;
	      if (!matchesFilter(task, 'category', filterCategory)) return false;
      if (!matchesFilter(task, 'client', filterClient)) return false;
      if (!matchesFilter(task, 'owner', filterOwner)) return false;
      if (!matchesFilter(task, 'assignee', filterAssignee)) return false;
      if (isVendorView && filterVendor && !matchesFilter(task, 'vendor', filterVendor)) return false;

      const taskISO = parseToISO(task.date);
      if (dateFrom && taskISO < dateFrom) return false;
	      if (dateTo && taskISO > dateTo) return false;

      const updateISO = parseToISO(task.lastUpdateDate || '');
      if (lastUpdateFrom && (!updateISO || updateISO < lastUpdateFrom)) return false;
      if (lastUpdateTo && (!updateISO || updateISO > lastUpdateTo)) return false;

      return true;
    });
	  }, [tasks, projects, filterType, searchTerm, filterStatus, filterPriority, filterProject, filterCategory, filterFirm, filterClient, filterOwner, filterAssignee, filterVendor, dateFrom, dateTo, lastUpdateFrom, lastUpdateTo, isVendorView]);

  const finalSortedTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
        const aVal = a[sortKey] || '';
        const bVal = b[sortKey] || '';
        if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
        return 0;
    });
  }, [filteredTasks, sortKey, sortDir]);

  const paginatedTasks = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return finalSortedTasks.slice(startIndex, startIndex + itemsPerPage);
  }, [finalSortedTasks, currentPage]);

  const handleExportExcelLocal = () => {
    const filterText = `Applied Filters: ${getFilterSummary()}`;
    const generatedOn = `Generated on: ${new Date().toLocaleString('en-GB')}`;

    const headers = ['Date', 'Task', 'Notes', categoryLabel, 'Responsible', 'Owner', 'Status', 'Last Update Date', 'Last Update Remark', 'Priority', 'Due Date'];
    
    const csvRows = [
        `"${filterText}"`,
        `"${generatedOn}"`,
        headers.join(','),
        ...finalSortedTasks.map(t => {
            const isNotStarted = t.status === 'Not Yet Started';
            const lastDate = isNotStarted ? '' : (t.lastUpdateDate || '');
            const lastRemark = isNotStarted ? '' : (t.lastUpdateRemarks || '');
            const resp = isVendorView ? (t.vendor || '-') : (t.assignees || '-');

            return [
                `"${t.date}"`,
                `"${(t.title || '').replace(/"/g, '""')}"`,
                `"${(t.remarks || '').replace(/"/g, '""')}"`,
                `"${t.category || '-'}"`,
                `"${resp}"`,
                `"${t.owner}"`,
                `"${t.status}"`,
                `"${lastDate}"`,
                `"${lastRemark.replace(/"/g, '""')}"`,
                `"${t.priority}"`,
                `"${t.dueDate}"`
            ].join(',');
        })
    ].join('\n');

    const blob = new Blob([csvRows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  };

	  const handleDownloadPDF = async () => {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);
	    const doc = new jsPDF('l', 'mm', 'a4');
	    doc.setFontSize(18);
	    doc.setTextColor(79, 70, 229); 
	    doc.text(`${title} Report`, 14, 15);
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Generated on: ${new Date().toLocaleString('en-GB')}`, 14, 21);
    
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    const filterSummary = getFilterSummary();
    const splitFilters = doc.splitTextToSize(`Active Filters: ${filterSummary}`, 260);
    doc.text(splitFilters, 14, 27);

    const hasAnyNotes = finalSortedTasks.some(t => String(t.remarks || '').trim() !== '');
    const headers = [[
      'S.No',
      'Date',
      'Task',
      ...(hasAnyNotes ? ['Notes'] : []),
      'Responsible',
      'Status',
      'P',
      'Last Update Date',
      'Last Update Remark',
      'Due Date',
      'Min'
    ]];

    const data = finalSortedTasks.map((t, i) => {
      const isNotStarted = t.status === 'Not Yet Started';
      const row: (string | number)[] = [
        i + 1,
        formatToIndianDate(t.date),
        t.title
      ];
      if (hasAnyNotes) row.push(t.remarks || '-');
      row.push(
        isVendorView ? (t.vendor || '-') : (t.assignees || '-'),
        t.status,
        String(t.priority || '-').trim() ? String(t.priority || '-').trim().charAt(0).toUpperCase() : '-',
        isNotStarted ? '' : formatToIndianDate(t.lastUpdateDate || ''),
        isNotStarted ? '' : (t.lastUpdateRemarks || ''),
        formatToIndianDate(t.dueDate),
        t.hours || 0
      );
      return row;
    });

    const columnStyles: any = {
      2: { cellWidth: 35 },
      [hasAnyNotes ? 8 : 7]: { cellWidth: 35 },
      [hasAnyNotes ? 10 : 9]: { cellWidth: 12, halign: 'center' }
    };
    if (hasAnyNotes) {
      columnStyles[3] = { cellWidth: 35 };
    }

	    autoTable(doc, {
	      head: headers,
	      body: data,
	      theme: 'grid',
      startY: 32 + (splitFilters.length * 4),
      styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak', textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.1 },
      headStyles: { fillColor: [79, 70, 229], lineColor: [0, 0, 0], lineWidth: 0.1 },
      tableLineColor: [0, 0, 0],
      tableLineWidth: 0.1,
      columnStyles
    });

    doc.save(`${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

	  const statusOptionsAll = [
      ...taskStatuses.map(s => ({ value: s, label: s })),
	    { value: 'Overdue', label: 'Overdue' }
	  ];
	  const priorityOptionsAll = [
	    { value: 'High', label: 'High' },
	    { value: 'Medium', label: 'Medium' },
	    { value: 'Low', label: 'Low' }
	  ];

	  const doesTaskMatchAllFilters = (task: Task, excludeKey?: string) => {
	    const effectiveStatus = excludeKey === 'status' ? [] : filterStatus;
	    const effectivePriority = excludeKey === 'priority' ? [] : filterPriority;
	    const effectiveProject = excludeKey === 'project' ? [] : filterProject;
	    const effectiveCategory = excludeKey === 'category' ? [] : filterCategory;
	    const effectiveClient = excludeKey === 'client' ? [] : filterClient;
	    const effectiveOwner = excludeKey === 'owner' ? [] : filterOwner;
	    const effectiveAssignee = excludeKey === 'assignee' ? [] : filterAssignee;
	    const effectiveVendor = excludeKey === 'vendor' ? [] : filterVendor;

	    if (filterType === 'pending') {
	      const project = projects.find(p => p.name === task.project || `${p.name} (${p.client})` === task.project);
	      if (project && project.status === 'Inactive') return false;
	      if (task.status === 'Completed' && effectiveStatus.length === 0) return false;
	    }
	    if (filterType === 'completed' && task.status !== 'Completed') return false;

	    if (searchTerm) {
	      const lowerTerm = searchTerm.toLowerCase();
	      const matchesSearch = Object.values(task).some(val => String(val || '').toLowerCase().includes(lowerTerm));
	      if (!matchesSearch) return false;
	    }

	    if (!matchesFilter(task, 'status', effectiveStatus)) return false;
	    if (!matchesFilter(task, 'priority', effectivePriority)) return false;
	    if (!matchesFilter(task, 'project', effectiveProject)) return false;
	    if (!matchesFilter(task, 'category', effectiveCategory)) return false;
	    if (!matchesFilter(task, 'client', effectiveClient)) return false;
	    if (!matchesFilter(task, 'owner', effectiveOwner)) return false;
	    if (!matchesFilter(task, 'assignee', effectiveAssignee)) return false;
	    if (isVendorView && effectiveVendor && !matchesFilter(task, 'vendor', effectiveVendor)) return false;

	    const taskISO = parseToISO(task.date);
	    if (dateFrom && taskISO < dateFrom) return false;
	    if (dateTo && taskISO > dateTo) return false;

	    const updateISO = parseToISO(task.lastUpdateDate || '');
	    if (lastUpdateFrom && (!updateISO || updateISO < lastUpdateFrom)) return false;
	    if (lastUpdateTo && (!updateISO || updateISO > lastUpdateTo)) return false;

	    return true;
	  };

	  const baseActiveUsers = useMemo(() => {
	    return users.filter(u => u.isActive).map(u => ({ value: normalize(u.name), label: normalize(u.name) })).filter(o => o.value !== '');
	  }, [users]);

	  const baseCategoryOptions = useMemo(() => {
	    return categories.map(c => ({ value: normalize(c.name), label: normalize(c.name) })).filter(o => o.value !== '');
	  }, [categories]);

	  const baseProjectOptions = useMemo(() => {
	    return projects.map(p => {
	      const name = normalize(p.name);
	      const client = normalize(p.client);
	      const val = client ? `${name} (${client})` : name;
	      return { value: val, label: val };
	    }).filter(o => o.value !== '');
	  }, [projects]);

	  const baseClientOptions = useMemo(() => {
	    const unique = Array.from(new Set([
        ...clients.map(c => normalize(c.name)),
        ...projects.map(p => normalize(p.client)),
        ...tasks.map(t => normalize(getClientFromTask(t)))
      ])).filter(Boolean);
	    return unique.map(c => ({ value: c, label: c }));
	  }, [clients, projects, tasks]);

	  const baseVendorOptions = useMemo(() => {
	    return vendors.map(v => ({ value: normalize(v.name), label: normalize(v.name) })).filter(o => o.value !== '');
	  }, [vendors]);

	  const tasksForStatusOptions = useMemo(() => tasks.filter(t => doesTaskMatchAllFilters(t, 'status')), [tasks, projects, filterType, searchTerm, filterPriority, filterProject, filterCategory, filterFirm, filterClient, filterOwner, filterAssignee, filterVendor, dateFrom, dateTo, lastUpdateFrom, lastUpdateTo, isVendorView]);
	  const statusOptions = useMemo(() => {
	    if (tasksForStatusOptions.length === 0) return statusOptionsAll;
	    const present = new Set(tasksForStatusOptions.map(t => t.status));
	    const todayISO = new Date().toISOString().split('T')[0];
	    const hasOverdue = tasksForStatusOptions.some(t => {
	      if (t.status === 'Completed' || !t.dueDate) return false;
	      const dueISO = parseToISO(t.dueDate);
	      return !!dueISO && dueISO < todayISO;
	    });
	    return statusOptionsAll.filter(o => (o.value === 'Overdue' ? hasOverdue : present.has(o.value as any)));
	  }, [tasksForStatusOptions]);

	  const tasksForPriorityOptions = useMemo(() => tasks.filter(t => doesTaskMatchAllFilters(t, 'priority')), [tasks, projects, filterType, searchTerm, filterStatus, filterProject, filterCategory, filterFirm, filterClient, filterOwner, filterAssignee, filterVendor, dateFrom, dateTo, lastUpdateFrom, lastUpdateTo, isVendorView]);
	  const priorityOptions = useMemo(() => {
	    if (tasksForPriorityOptions.length === 0) return priorityOptionsAll;
	    const present = new Set(tasksForPriorityOptions.map(t => t.priority));
	    return priorityOptionsAll.filter(o => present.has(o.value as any));
	  }, [tasksForPriorityOptions]);

	  const tasksForCategoryOptions = useMemo(() => tasks.filter(t => doesTaskMatchAllFilters(t, 'category')), [tasks, projects, filterType, searchTerm, filterStatus, filterPriority, filterProject, filterFirm, filterClient, filterOwner, filterAssignee, filterVendor, dateFrom, dateTo, lastUpdateFrom, lastUpdateTo, isVendorView]);
	  const categoryOptions = useMemo(() => {
	    if (tasksForCategoryOptions.length === 0) return baseCategoryOptions;
	    const allowed = new Set(tasksForCategoryOptions.map(t => normalize(t.category)).filter(Boolean));
	    const fromBase = baseCategoryOptions.filter(o => allowed.has(o.value));
	    const extras = Array.from(allowed).filter(v => !fromBase.some(o => o.value === v)).map(v => ({ value: v, label: v }));
	    return [...fromBase, ...extras];
	  }, [tasksForCategoryOptions, baseCategoryOptions]);

	  const tasksForProjectOptions = useMemo(() => tasks.filter(t => doesTaskMatchAllFilters(t, 'project')), [tasks, projects, filterType, searchTerm, filterStatus, filterPriority, filterCategory, filterFirm, filterClient, filterOwner, filterAssignee, filterVendor, dateFrom, dateTo, lastUpdateFrom, lastUpdateTo, isVendorView]);
	  const projectOptions = useMemo(() => {
	    if (tasksForProjectOptions.length === 0) return baseProjectOptions;
	    const allowed = new Set(tasksForProjectOptions.map(t => normalize(getProjectInfoFromValue(t.project).display)).filter(Boolean));
	    const fromBase = baseProjectOptions.filter(o => allowed.has(o.value));
	    const extras = Array.from(allowed).filter(v => !fromBase.some(o => o.value === v)).map(v => ({ value: v, label: v }));
	    return [...fromBase, ...extras];
	  }, [tasksForProjectOptions, baseProjectOptions]);

	  const tasksForClientOptions = useMemo(() => tasks.filter(t => doesTaskMatchAllFilters(t, 'client')), [tasks, projects, filterType, searchTerm, filterStatus, filterPriority, filterProject, filterCategory, filterFirm, filterOwner, filterAssignee, filterVendor, dateFrom, dateTo, lastUpdateFrom, lastUpdateTo, isVendorView]);
	  const clientOptions = useMemo(() => {
	    if (tasksForClientOptions.length === 0) return baseClientOptions;
	    const allowed = new Set(tasksForClientOptions.map(t => normalize(getClientFromTask(t))).filter(Boolean));
	    return Array.from(allowed).map(c => ({ value: c, label: c }));
	  }, [tasksForClientOptions, baseClientOptions]);

	  const tasksForOwnerOptions = useMemo(() => tasks.filter(t => doesTaskMatchAllFilters(t, 'owner')), [tasks, projects, filterType, searchTerm, filterStatus, filterPriority, filterProject, filterCategory, filterFirm, filterClient, filterAssignee, filterVendor, dateFrom, dateTo, lastUpdateFrom, lastUpdateTo, isVendorView]);
	  const ownerOptions = useMemo(() => {
	    if (tasksForOwnerOptions.length === 0) return baseActiveUsers;
	    const allowed = new Set(tasksForOwnerOptions.flatMap(t => splitCommaValues(t.owner)).map(normalize).filter(Boolean));
	    const fromBase = baseActiveUsers.filter(o => allowed.has(o.value));
	    const extras = Array.from(allowed).filter(v => !fromBase.some(o => o.value === v)).map(v => ({ value: v, label: v }));
	    return [...fromBase, ...extras];
	  }, [tasksForOwnerOptions, baseActiveUsers]);

	  const tasksForAssigneeOptions = useMemo(() => tasks.filter(t => doesTaskMatchAllFilters(t, 'assignee')), [tasks, projects, filterType, searchTerm, filterStatus, filterPriority, filterProject, filterCategory, filterFirm, filterClient, filterOwner, filterVendor, dateFrom, dateTo, lastUpdateFrom, lastUpdateTo, isVendorView]);
	  const assigneeOptions = useMemo(() => {
	    if (tasksForAssigneeOptions.length === 0) return baseActiveUsers;
	    const allowed = new Set(tasksForAssigneeOptions.flatMap(t => splitCommaValues(t.assignees)).map(normalize).filter(Boolean));
	    const fromBase = baseActiveUsers.filter(o => allowed.has(o.value));
	    const extras = Array.from(allowed).filter(v => !fromBase.some(o => o.value === v)).map(v => ({ value: v, label: v }));
	    return [...fromBase, ...extras];
	  }, [tasksForAssigneeOptions, baseActiveUsers]);

	  const tasksForVendorOptions = useMemo(() => tasks.filter(t => doesTaskMatchAllFilters(t, 'vendor')), [tasks, projects, filterType, searchTerm, filterStatus, filterPriority, filterProject, filterCategory, filterFirm, filterClient, filterOwner, filterAssignee, dateFrom, dateTo, lastUpdateFrom, lastUpdateTo, isVendorView]);
	  const vendorOptions = useMemo(() => {
	    if (tasksForVendorOptions.length === 0) return baseVendorOptions;
	    const allowed = new Set(tasksForVendorOptions.map(t => normalize(t.vendor)).filter(Boolean));
	    const fromBase = baseVendorOptions.filter(o => allowed.has(o.value));
	    const extras = Array.from(allowed).filter(v => !fromBase.some(o => o.value === v)).map(v => ({ value: v, label: v }));
	    return [...fromBase, ...extras];
	  }, [tasksForVendorOptions, baseVendorOptions]);

  const totalPages = Math.ceil(filteredTasks.length / itemsPerPage);
  const handleUpdateTaskClick = (task: Task) => { setSelectedTask(task); setIsUpdateModalOpen(true); };
  const handleEditTaskClick = (task: Task) => { setSelectedTask(task); setIsEditModalOpen(true); };
  const openBulkUpdate = (mode: 'status' | 'priority' | 'assignee' | 'category') => { setBulkMode(mode); setIsBulkUpdateModalOpen(true); };
  const handleBulkUpdate = (updates: Partial<Task>) => { onBulkUpdateTask(selectedIds, updates); setSelectedIds([]); };
  const confirmBulkDelete = () => { selectedIds.forEach(id => onDeleteTask(id, isVendorView)); setSelectedIds([]); setShowBulkDeleteConfirm(false); };

  const handleClearFiltersLocal = () => {
    setFilterStatus([]);
    setFilterPriority([]);
    setFilterProject([]);
	    setFilterCategory([]);
	    setFilterClient([]);
    setFilterOwner([]);
    setFilterAssignee([]);
    if (setFilterVendor) setFilterVendor([]);
    setDateFrom('');
    setDateTo('');
    setLastUpdateFrom('');
    setLastUpdateTo('');
    setSearchTerm('');
  };

  const activeFilterBadges = useMemo(() => {
      const badges: { label: string; clear: () => void }[] = [];
      if (filterStatus.length > 0) badges.push({ label: `Status: ${filterStatus.join(', ')}`, clear: () => setFilterStatus([]) });
      if (filterPriority.length > 0) badges.push({ label: `Priority: ${filterPriority.join(', ')}`, clear: () => setFilterPriority([]) });
	      if (filterCategory.length > 0) badges.push({ label: `${categoryLabel}: ${filterCategory.join(', ')}`, clear: () => setFilterCategory([]) });
      if (filterProject.length > 0) badges.push({ label: `Project: ${filterProject.length} selected`, clear: () => setFilterProject([]) });
      if (filterClient.length > 0) badges.push({ label: `Client: ${filterClient.length} selected`, clear: () => setFilterClient([]) });
      if (filterOwner.length > 0) badges.push({ label: `Owner: ${filterOwner.join(', ')}`, clear: () => setFilterOwner([]) });
      if (filterAssignee.length > 0) badges.push({ label: `Assignee: ${filterAssignee.join(', ')}`, clear: () => setFilterAssignee([]) });
      if (isVendorView && filterVendor.length > 0) badges.push({ label: `Vendor: ${filterVendor.join(', ')}`, clear: () => setFilterVendor?.([]) });
      return badges;
	  }, [filterStatus, filterPriority, filterCategory, filterProject, filterClient, filterOwner, filterAssignee, filterVendor, isVendorView]);

  const getFilterClass = (isActive: boolean) => 
    `w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors ${isActive ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-medium' : 'bg-white border-indigo-300 text-black'}`;

  const startEntry = filteredTasks.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endEntry = Math.min(currentPage * itemsPerPage, filteredTasks.length);

	  return (
	    <div className="space-y-6">
		      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
		        <div className="flex items-start md:items-center gap-3">
              {showCollapsedMenuButton && (
                <button
                  type="button"
                  onClick={onShowMenu}
                  className="hidden md:inline-flex items-center justify-center w-10 h-10 bg-white border-2 border-indigo-200 text-indigo-700 rounded-xl shadow-sm hover:bg-indigo-50"
                  title="Show menu"
                >
                  <Menu size={18} />
                </button>
              )}
              <div>
		            <h2 className="text-2xl font-bold text-indigo-600">{title}</h2>
		            {description && <p className="text-sm text-black mt-1">{description}</p>}
              </div>
		        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {selectedIds.length > 0 && isAdmin ? (
            <div className="flex flex-wrap gap-2 animate-in fade-in zoom-in duration-200">
                <button onClick={() => openBulkUpdate('status')} className="flex items-center space-x-1 px-4 py-2 bg-indigo-50 text-indigo-700 border-2 border-indigo-200 rounded-md hover:bg-indigo-100 text-sm font-bold shadow-sm transition-colors uppercase tracking-wider">
                    <Clock size={16} /><span>Status ({selectedIds.length})</span>
                </button>
                <button onClick={() => openBulkUpdate('priority')} className="flex items-center space-x-1 px-4 py-2 bg-indigo-50 text-indigo-700 border-2 border-indigo-200 rounded-md hover:bg-indigo-100 text-sm font-bold shadow-sm transition-colors uppercase tracking-wider">
                    <AlertTriangle size={16} /><span>Priority</span>
                </button>
                <button onClick={() => openBulkUpdate('category')} className="flex items-center space-x-1 px-4 py-2 bg-indigo-50 text-indigo-700 border-2 border-indigo-200 rounded-md hover:bg-indigo-100 text-sm font-bold shadow-sm transition-colors uppercase tracking-wider">
                    <Tags size={16} /><span>{getFieldLabel('task.category', 'Category')}</span>
                </button>
                <button onClick={() => openBulkUpdate('assignee')} className="flex items-center space-x-1 px-4 py-2 bg-indigo-50 text-indigo-700 border-2 border-indigo-200 rounded-md hover:bg-indigo-100 text-sm font-bold shadow-sm transition-colors uppercase tracking-wider">
                    <Users size={16} /><span>Assignee</span>
                </button>
                <button onClick={() => setShowBulkDeleteConfirm(true)} className="flex items-center space-x-1 px-4 py-2 bg-red-600 text-white border-2 border-red-700 rounded-md hover:bg-red-700 text-sm font-bold shadow-sm transition-colors uppercase tracking-wider">
                  <Trash2 size={16} /><span>Bulk Delete</span>
                </button>
            </div>
          ) : (
            <button onClick={() => onAddTask(isVendorView)} className="flex items-center space-x-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium shadow-sm transition-colors"><Plus size={16} /><span>Add Task</span></button>
          )}
          <button onClick={handleExportExcelLocal} title="Export Excel" className="flex items-center justify-center p-2.5 bg-white border border-indigo-600 text-indigo-600 rounded-md hover:bg-indigo-50 shadow-sm transition-colors"><FileText size={16} className="text-green-600" /></button>
          <button onClick={handleDownloadPDF} title="Export PDF" className="flex items-center justify-center p-2.5 bg-white border border-indigo-600 text-indigo-600 rounded-md hover:bg-indigo-50 shadow-sm transition-colors"><Download size={16} className="text-red-500" /></button>
          <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center space-x-1 px-3 py-2 border rounded-md text-sm font-medium shadow-sm transition-all duration-200 ${showFilters ? 'bg-indigo-600 border-indigo-700 text-white ring-2 ring-indigo-200' : 'bg-indigo-50 border-indigo-300 text-indigo-600 hover:bg-indigo-100'}`} title="Toggle Filters"><Filter size={16} /></button>
          
          <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200 shadow-sm">
              <button onClick={() => setMobileViewMode('card')} className={`p-1.5 rounded-md transition-all ${mobileViewMode === 'card' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-indigo-400'}`} title="Card View"><LayoutGrid size={18} /></button>
              <button onClick={() => setMobileViewMode('table')} className={`p-1.5 rounded-md transition-all ${mobileViewMode === 'table' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`} title="Table View"><LayoutList size={18} /></button>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-indigo-200 space-y-4">
        {activeFilterBadges.length > 0 && (
            <div className="flex flex-wrap gap-2 pb-2">
                {activeFilterBadges.map((badge, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-red-600 text-xs font-bold border border-indigo-200">
                        {badge.label}
                        <button onClick={badge.clear} className="p-0.5 hover:bg-indigo-200 rounded-full transition-colors"><X size={10} className="text-red-600" /></button>
                    </span>
                ))}
            </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-indigo-600" size={18} />
          <input 
            type="text" 
            placeholder="Search all columns (Task, Assignee, Status, etc)..." 
            className={`w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-100 text-sm transition-colors ${searchTerm ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-medium' : 'border-indigo-300 text-indigo-700'}`} 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className={`${showFilters ? 'grid' : 'hidden'} grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end`}>
             <SearchableSelect label="Status" options={statusOptions} value={filterStatus} onChange={setFilterStatus} multiple={true} placeholder="All Statuses" className="text-sm"/>
	             <SearchableSelect label="Priority" options={priorityOptions} value={filterPriority} onChange={setFilterPriority} multiple={true} placeholder="All Priorities" className="text-sm"/>
	             <SearchableSelect label="Category" labelKey="task.category" options={categoryOptions} value={filterCategory} onChange={setFilterCategory} multiple={true} placeholder="All Categories" className="text-sm"/>
               <SearchableSelect label="Client" options={clientOptions} value={filterClient} onChange={setFilterClient} multiple={true} placeholder="All Clients" className="text-sm"/>
             <SearchableSelect label="Owner" options={ownerOptions} value={filterOwner} onChange={setFilterOwner} multiple={true} placeholder="All Owners" className="text-sm"/>
             {!isVendorView && <SearchableSelect label="Assignee" options={assigneeOptions} value={filterAssignee} onChange={setFilterAssignee} multiple={true} placeholder="All Assignees" className="text-sm"/>}
             {isVendorView && setFilterVendor && <SearchableSelect label="Vendor" options={vendorOptions} value={filterVendor} onChange={setFilterVendor} multiple={true} placeholder="All Vendors" className="text-sm"/>}
            <div className="col-span-1 relative">
                 <label className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1 block">Created From</label>
                 <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={getFilterClass(dateFrom !== '')}/>
            </div>
            <div className="col-span-1 relative">
                <label className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1 block">Created To</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={getFilterClass(dateTo !== '')}/>
            </div>
            <div className="col-span-1">
                <button onClick={handleClearFiltersLocal} className="w-full px-3 py-2 bg-red-600 text-white border border-red-700 rounded-md hover:bg-red-700 text-sm font-medium transition-colors h-[38px] flex items-center justify-center" title="Clear Filters">Clear Filters</button>
            </div>
        </div>
      </div>

      <TaskTable tasks={paginatedTasks} onUpdateTask={handleUpdateTaskClick} onEditTask={handleEditTaskClick} onDeleteTask={onDeleteTask} selectedIds={selectedIds} onSelectionChange={setSelectedIds} onViewHistory={onViewHistory} showSelection={isAdmin} isVendorView={isVendorView} viewMode={mobileViewMode} projects={projects} syncingIds={syncingIds} currentUser={currentUser} sortKey={sortKey} sortDir={sortDir} onSort={(key, dir) => { setSortKey(key); setSortDir(dir); }} startIndex={startEntry} />
      
      <div className="flex justify-between items-center text-xs text-indigo-600 font-bold px-1 uppercase tracking-wider pb-6">
          <span>Showing {startEntry} to {endEntry} of {filteredTasks.length} entries</span>
          <div className="flex space-x-2">
              <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} className="px-4 py-1.5 bg-indigo-600 text-white rounded shadow hover:bg-indigo-700 disabled:opacity-50 transition-colors uppercase text-[10px]" disabled={currentPage === 1}>Previous</button>
              <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} className="px-4 py-1.5 bg-indigo-600 text-white rounded shadow hover:bg-indigo-700 disabled:opacity-50 transition-colors uppercase text-[10px]" disabled={currentPage === totalPages || totalPages === 0}>Next</button>
          </div>
      </div>

	      <UpdateTaskModal isOpen={isUpdateModalOpen} onClose={() => setIsUpdateModalOpen(false)} task={selectedTask} onUpdate={onUpdateTask} users={users} vendors={vendors} statusOptions={taskStatuses}/>
      <EditTaskModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} task={selectedTask} onSave={onEditTask} onAddCategory={onAddCategory} onAddProject={onAddProject} onAddVendorCategory={onAddVendorCategory!} users={users} categories={categories} projects={projects} firms={firms} clients={clients} vendors={vendors} vendorCategories={vendorCategories} isVendorView={isVendorView} lastAddedCategory={lastAddedCategory} lastAddedProject={lastAddedProject} lastAddedVendorCategory={lastAddedVendorCategory} onClearLastAdded={onClearLastAdded} />
      <BulkUpdateModal isOpen={isBulkUpdateModalOpen} onClose={() => setIsBulkUpdateModalOpen(false)} count={selectedIds.length} onUpdate={handleBulkUpdate} users={users} vendors={vendors} categories={categories} isVendorView={isVendorView} mode={bulkMode} />

      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
              <div className="p-6 text-center space-y-4">
                 <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600">
                    <AlertCircle size={32} />
                 </div>
                 <div>
                    <h3 className="text-xl font-bold text-gray-900 uppercase">Confirm Bulk Delete</h3>
                    <p className="text-sm text-gray-500 mt-2">Are you sure you want to delete <strong>{selectedIds.length}</strong> selected tasks? <br/>This action cannot be undone.</p>
                 </div>
                 <div className="flex gap-3 pt-2">
                    <button onClick={() => setShowBulkDeleteConfirm(false)} className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors uppercase text-sm">Cancel</button>
                    <button onClick={confirmBulkDelete} className="flex-1 py-3 px-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-200 uppercase text-sm">Delete All</button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
