import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { Footer } from './components/Footer';
import { Dashboard } from './components/Dashboard';
import { TasksView } from './components/TasksView';
import { UsersView } from './components/UsersView';
import { DesignationsView } from './components/DesignationsView';
import { DepartmentsView } from './components/DepartmentsView';
import { CategoriesView } from './components/CategoriesView';
import { StatusesView } from './components/StatusesView';
import { VendorCategoriesView } from './components/VendorCategoriesView';
import { ProjectsView } from './components/ProjectsView';
import { ClientsView } from './components/ClientsView';
import { FirmsView } from './components/FirmsView';
import { VendorsView } from './components/VendorsView';
import { ActionLogView } from './components/ActionLogView';
import { ActivityDashboardView } from './components/ActivityDashboardView';
import { RecurringTasksView } from './components/RecurringTasksView';
import { RecurringTaskActionsView } from './components/RecurringTaskActionsView';
import { UpdateMultipleView } from './components/UpdateMultipleView';
import { AddMultipleTasksView } from './components/AddMultipleTasksView';
import { SettingsView } from './components/SettingsView';
import { LoginView } from './components/LoginView';
import { AddTaskModal } from './components/AddTaskModal';
import { AddCategoryModal } from './components/AddCategoryModal';
import { AddVendorCategoryModal } from './components/AddVendorCategoryModal';
import { AddProjectModal } from './components/AddProjectModal';
import { AddUserModal } from './components/AddUserModal';
import { AddClientModal } from './components/AddClientModal';
import { AddVendorModal } from './components/AddVendorModal';
import { AddDesignationModal } from './components/AddDesignationModal';
import { AddDepartmentModal } from './components/AddDepartmentModal';
import { AddFirmModal } from './components/AddFirmModal';
import { EditProjectModal } from './components/EditProjectModal';
import { EditClientModal } from './components/EditClientModal';
import { EditVendorModal } from './components/EditVendorModal';
import { TaskHistoryModal } from './components/TaskHistoryModal';
import { RecurringTaskHistoryModal } from './components/RecurringTaskHistoryModal';
import { AddRecurringTaskModal } from './components/AddRecurringTaskModal';
import { UpdateRecurringTaskModal } from './components/UpdateRecurringTaskModal';
import { EditRecurringTaskModal } from './components/EditRecurringTaskModal';
import { LabelProvider, buildLabelResolvers } from './labelOverrides';
import { TelegramSetupView } from './components/TelegramSetupView'; 
import { DocumentationView } from './components/DocumentationView';
import { 
  LayoutDashboard, 
  CheckSquare, 
  Clock, 
  CheckCircle, 
  Users, 
  Briefcase, 
  Tags, 
  Folder, 
  FileText,
  Building2,
  Truck,
  Layers,
  Menu,
  RotateCcw,
  History,
  Settings,
  AlertCircle,
  X,
  Hammer,
  Send,
  BarChart3,
  UserCheck,
  UserCog,
  GraduationCap,
  IndianRupee,
  Wallet
} from 'lucide-react';
import { NavItem, Task, User, Designation, Department, Category, Project, Client, ActionLogEntry, Vendor, VendorCategory, RecurringTask, RecurringTaskAction, AppSettings, Firm, StatusMaster } from './types';

const AUTO_SYNC_INTERVAL = 120000;
const VENDOR_MODULE_ENABLED = false;

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
  
  // Tasks Section
  { id: 'all-tasks', label: 'All Tasks', icon: <CheckSquare size={20} />, section: 'Tasks' },
  { id: 'pending-group', label: 'Pending', icon: <Clock size={20} />, section: 'Tasks' },
  { id: 'pending', label: 'Pending Tasks', icon: <Clock size={20} />, section: 'Tasks' },
  { id: 'completed', label: 'Completed Tasks', icon: <CheckCircle size={20} />, section: 'Tasks' },
  { id: 'activity-dashboard', label: 'Activity Dashboard', icon: <BarChart3 size={20} />, section: 'Tasks' },
  { id: 'action-log', label: 'Action Log', icon: <History size={20} />, section: 'Tasks' },
  
	  // Vendor Section (hidden)
	  ...(VENDOR_MODULE_ENABLED ? ([
	    { id: 'pending-vendor-tasks', label: 'Vendor Pending', icon: <Hammer size={20} />, section: 'Vendor' },
	    { id: 'vendor-tasks', label: 'Vendor All', icon: <Layers size={20} />, section: 'Vendor' },
	    { id: 'completed-vendor-tasks', label: 'Vendor History', icon: <CheckCircle size={20} />, section: 'Vendor' },
	    { id: 'vendor-action-log', label: 'Vendor Log', icon: <History size={20} />, section: 'Vendor' },
	  ] as NavItem[]) : []),
  
  // Recurring Tasks Section
  { id: 'recurring-tasks', label: 'Recurring Master', icon: <RotateCcw size={20} />, section: 'Recurring Tasks' },
  { id: 'due-recurring-tasks', label: 'Due Recurring', icon: <AlertCircle size={20} />, section: 'Recurring Tasks' },
  { id: 'recurring-actions', label: 'Recurring Log', icon: <History size={20} />, section: 'Recurring Tasks' },
  
  // Master Section
  { id: 'users', label: 'Users', icon: <Users size={20} />, section: 'Master' },
  { id: 'firms', label: 'Firms', icon: <Building2 size={20} />, section: 'Master' },
  { id: 'categories', label: 'Categories', icon: <Tags size={20} />, section: 'Master' },
  { id: 'statuses', label: 'Status', icon: <Tags size={20} />, section: 'Master' },
  { id: 'designations', label: 'Designation', icon: <Briefcase size={20} />, section: 'Master' },
  ...(VENDOR_MODULE_ENABLED ? ([
	    { id: 'vendor-categories', label: 'Vendor Categories', icon: <Tags size={20} />, section: 'Master' },
	    { id: 'vendors', label: 'Vendors', icon: <Truck size={20} />, section: 'Master' },
	  ] as NavItem[]) : []),
  { id: 'settings', label: 'Settings', icon: <Settings size={20} />, section: 'Master' },
  { id: 'telegram-setup', label: 'Telegram Setup', icon: <Send size={20} />, section: 'Master' },

  // Documentation (keep last so it appears at the bottom of the menu)
  { id: 'documentation', label: 'Documentation', icon: <FileText size={20} />, section: 'Documentation' },
];

export const formatToIndianDate = (dateInput: any): string => {
  if (!dateInput) return '';
  const s = String(dateInput).trim();
  const match = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (match) {
      return `${match[1].padStart(2, '0')}/${match[2].padStart(2, '0')}/${match[3]}`;
  }
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return s;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  } catch { return s; }
};

export const formatToIndianDateTime = (dateInput: any): string => {
  if (!dateInput) return '';
  let s = String(dateInput).trim();
  const match = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)?)?/i);
  if (match) {
      const [_, d, m, y, hh, mm, ss, ampm] = match;
      const datePart = `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
      if (hh && mm) {
          return `${datePart} ${hh.padStart(2, '0')}:${mm.padStart(2, '0')}${ampm ? ' ' + ampm.toUpperCase() : ''}`;
      }
      return datePart;
  }
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return s;
    const datePart = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    const h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${datePart} ${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
  } catch { return s; }
};

export const formatToHHMM = (timeInput: any): string => {
  if (!timeInput) return '';
  const raw = String(timeInput).trim();
  if (!raw) return '';

  // Google Sheets time-only values can accidentally get formatted as the base date.
  // If we get that sentinel date as a string, treat it as "no time" rather than showing a date.
  if (
    raw === '30-12-1899' ||
    raw === '30/12/1899' ||
    raw === '1899-12-30' ||
    /^1899-12-30[ t]/.test(raw) ||
    /^30[/-]12[/-]1899\b/.test(raw)
  ) {
    return '';
  }

  const hhmmMatch = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (hhmmMatch) {
    const hh = Math.min(23, Math.max(0, Number(hhmmMatch[1])));
    const mm = Math.min(59, Math.max(0, Number(hhmmMatch[2])));
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  try {
    const parsed = new Date(timeInput);
    if (!isNaN(parsed.getTime())) {
      return `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
    }
  } catch {}

  return raw;
};

const getCaseInsensitive = (obj: any, key: string): any => {
  if (!obj) return undefined;
  const target = key.toLowerCase();
  const foundKey = Object.keys(obj).find(k => k.toLowerCase() === target);
  return foundKey ? obj[foundKey] : undefined;
};

export const parseToISO = (str: string) => {
	    if (!str) return '';
	    const trimmed = str.trim().replace(/,+/g, '');
	    if (!trimmed) return '';
	    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.split(/[ T]/)[0];
	    const datePart = trimmed.split(/[ T]/)[0].replace(/,+/g, '');
	    const parts = datePart.split(/[/-]/);
	    if (parts.length !== 3) return trimmed;
	    if (parts[0].length === 4) {
	        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
	    }
	    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
};

async function safeJsonParse(response: Response, sourceName: string) {
  const text = await response.text();
  if (text.toLowerCase().includes("404 file not found") || text.includes("<!DOCTYPE html>")) {
    throw new Error(`Backend error in ${sourceName}.`);
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`${sourceName} returned invalid format.`);
  }
}

export default function App() {
  const normalizeSettings = useCallback((incoming: any): AppSettings => {
    const base: AppSettings = {
      officeTokenId: '', officeTelegramGroupId: '', whatsappGroupId: '', masId: '',
      masPassword: '', metaAccessToken: '', metaPhoneNumberId: '', metaWabaId: '', metaVerifyToken: '',
      viewLabelOverrides: '{}', fieldLabelOverrides: '{}'
    };
    if (!incoming || typeof incoming !== 'object') return base;
    const merged: any = { ...base, ...incoming };
    if (!merged.viewLabelOverrides || String(merged.viewLabelOverrides).trim() === '') merged.viewLabelOverrides = '{}';
    if (!merged.fieldLabelOverrides || String(merged.fieldLabelOverrides).trim() === '') merged.fieldLabelOverrides = '{}';
    return merged as AppSettings;
  }, []);
  const normalizeStatusName = (value: string) => String(value || '').trim().toLowerCase();
  const makePendingStatusId = (statusName: string) => `pending-status:${encodeURIComponent(normalizeStatusName(statusName))}`;
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('taskpro_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [workspaceId, setWorkspaceId] = useState<string>(() => localStorage.getItem('taskpro_workspace_id') || '');
  const [apiUrl, setApiUrl] = useState<string>(() => localStorage.getItem('taskpro_api_url') || '');

  const isAdmin = currentUser?.role === 'Admin';

  const [activeTab, setActiveTab] = useState(() => {
    return 'dashboard';
  });

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    if (layoutMode === 'side') {
      setIsSidebarCollapsed(true);
    }
  };

  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<'side' | 'top'>(() => (localStorage.getItem('taskpro_layout') as any) || 'side');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [syncingIds, setSyncingIds] = useState<Set<number>>(new Set());
  const uniqueIdCounterRef = useRef(0);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [statuses, setStatuses] = useState<StatusMaster[]>([]);
  const [vendorCategories, setVendorCategories] = useState<VendorCategory[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [firms, setFirms] = useState<Firm[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [actionLogs, setActionLogs] = useState<ActionLogEntry[]>([]);
  const [recurringTasks, setRecurringTasks] = useState<RecurringTask[]>([]);
  const [recurringActions, setRecurringActions] = useState<RecurringTaskAction[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
	    officeTokenId: '', officeTelegramGroupId: '', whatsappGroupId: '', masId: '',
	    masPassword: '', metaAccessToken: '', metaPhoneNumberId: '', metaWabaId: '', metaVerifyToken: '',
	    viewLabelOverrides: '{}', fieldLabelOverrides: '{}'
	  });

  const CACHE_KEY = 'taskpro_init_cache_v1';
  const hasHydratedCacheRef = useRef(false);

  const hydrateFromCache = useCallback((): boolean => {
    if (hasHydratedCacheRef.current) return true;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return false;

      const {
        cachedAt,
        users: cachedUsers,
        projects: cachedProjects,
        clients: cachedClients,
        firms: cachedFirms,
        vendors: cachedVendors,
        categories: cachedCategories,
        statuses: cachedStatuses,
        vendorCategories: cachedVendorCategories,
        designations: cachedDesignations,
        departments: cachedDepartments,
        tasks: cachedTasks,
        actionLogs: cachedActionLogs,
        recurringTasks: cachedRecurringTasks,
        recurringActions: cachedRecurringActions,
        settings: cachedSettings,
      } = parsed as any;

      if (Array.isArray(cachedUsers)) setUsers(cachedUsers);
      if (Array.isArray(cachedProjects)) setProjects(cachedProjects);
      if (Array.isArray(cachedClients)) setClients(cachedClients);
      if (Array.isArray(cachedFirms)) setFirms(cachedFirms);
      if (Array.isArray(cachedVendors)) setVendors(cachedVendors);
      if (Array.isArray(cachedCategories)) setCategories(cachedCategories);
      if (Array.isArray(cachedStatuses)) setStatuses(cachedStatuses);
      if (Array.isArray(cachedVendorCategories)) setVendorCategories(cachedVendorCategories);
      if (Array.isArray(cachedDesignations)) setDesignations(cachedDesignations);
      if (Array.isArray(cachedTasks)) setTasks(cachedTasks);
      if (Array.isArray(cachedActionLogs)) setActionLogs(cachedActionLogs);
      if (Array.isArray(cachedRecurringTasks)) setRecurringTasks(cachedRecurringTasks);
      if (Array.isArray(cachedRecurringActions)) setRecurringActions(cachedRecurringActions);
      if (cachedSettings && typeof cachedSettings === 'object') setSettings(normalizeSettings(cachedSettings));
      if (cachedAt) setLastSynced(new Date(cachedAt));

      hasHydratedCacheRef.current = true;
      return true;
    } catch {
      return false;
    }
  }, []);

  const persistCache = useCallback((payload: any) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ...payload, cachedAt: Date.now() }));
    } catch {
      // ignore quota / serialization issues
    }
  }, []);

  // Master item IDs for filtering
  const masterIds = ['users', 'firms', 'categories', 'statuses', 'designations', 'departments', ...(VENDOR_MODULE_ENABLED ? ['vendor-categories', 'vendors'] : []), 'settings', 'telegram-setup'];
  const pendingStatusNavItems = useMemo<NavItem[]>(() => {
    return statuses
      .map(s => String(s.name || '').trim())
      .filter(Boolean)
      .filter(name => {
        const normalized = normalizeStatusName(name);
        return normalized !== 'in progress' && normalized !== 'completed';
      })
      .map(name => ({
        id: makePendingStatusId(name),
        label: name,
        icon: <Clock size={20} />,
        section: 'Tasks'
      }));
  }, [statuses]);
  const resolvedNavItems = useMemo<NavItem[]>(() => {
    const pendingGroupIndex = navItems.findIndex(item => item.id === 'pending-group');
    if (pendingGroupIndex < 0) return navItems;
    const pendingTaskItem = navItems.find(item => item.id === 'pending');
    const remainingItems = navItems.filter(item => item.id !== 'pending');
    return [
      ...remainingItems.slice(0, pendingGroupIndex + 1),
      ...(pendingTaskItem ? [pendingTaskItem] : []),
      ...pendingStatusNavItems,
      ...remainingItems.slice(pendingGroupIndex + 1),
    ];
  }, [pendingStatusNavItems]);

  // Navigation Logic based on Role
  const filteredNavItems = useMemo(() => {
    if (isAdmin) return resolvedNavItems;
    // Completely hide 'Master' section items for Employees
    return resolvedNavItems.filter(item => item.section !== 'Master');
  }, [isAdmin, resolvedNavItems]);

  // Data subsets based on user role
  const visibleTasks = useMemo(() => {
    if (!currentUser) return [];
    if (isAdmin) return tasks;
    return tasks.filter(t => {
      const isOwner = String(t.owner || '').trim() === currentUser.name;
      const isAssignee = String(t.assignees || '').split(',').map(s => s.trim()).includes(currentUser.name);
      const isVendor = String(t.vendor || '').trim() === currentUser.name;
      return isOwner || isAssignee || isVendor;
    });
  }, [tasks, currentUser, isAdmin]);

  const visibleActionLogs = useMemo(() => {
    if (!currentUser) return [];
    if (isAdmin) return actionLogs;
    return actionLogs.filter(l => {
      const isOwner = String(l.owner || '').trim() === currentUser.name;
      const isAssignee = String(l.assignees || '').split(',').map(s => s.trim()).includes(currentUser.name);
      const isVendor = String(l.vendor || '').trim() === currentUser.name;
      return isOwner || isAssignee || isVendor;
    });
  }, [actionLogs, currentUser, isAdmin]);

  const visibleRecurringTasks = useMemo(() => {
    if (!currentUser) return [];
    if (isAdmin) return recurringTasks;
    // For recurring tasks, check both owner and assignee
    return recurringTasks.filter(t => 
      String(t.owner || '').trim() === currentUser.name ||
      String(t.assignee || '').trim() === currentUser.name
    );
  }, [recurringTasks, currentUser, isAdmin]);

  const visibleRecurringActions = useMemo(() => {
    if (!currentUser) return [];
    if (isAdmin) return recurringActions;
    // For recurring actions, check both owner and assignee
    return recurringActions.filter(a => 
      String(a.owner || '').trim() === currentUser.name ||
      String(a.assignee || '').trim() === currentUser.name
    );
  }, [recurringActions, currentUser, isAdmin]);

	  const navItemsWithCounts = useMemo(() => {
	    const { getViewLabel } = buildLabelResolvers(settings);
	    const employeeTasks = visibleTasks.filter(t => !t.vendor || t.vendor === '');
	    const vendorTasksOnly = visibleTasks.filter(t => t.vendor && t.vendor !== '');
	    const employeeLogs = visibleActionLogs.filter(l => !l.vendor || l.vendor === '');
	    const vendorLogs = visibleActionLogs.filter(l => l.vendor && l.vendor !== '');

	    const counts: Record<string, number> = {
	      'all-tasks': employeeTasks.length,
	      'pending-group': employeeTasks.filter(t => t.status !== 'Completed').length,
	      'pending': employeeTasks.filter(t => t.status !== 'Completed').length,
	      'completed': employeeTasks.filter(t => t.status === 'Completed').length,
	      'action-log': employeeLogs.length,
	      'vendor-tasks': vendorTasksOnly.length,
	      'pending-vendor-tasks': vendorTasksOnly.filter(t => t.status !== 'Completed').length,
	      'completed-vendor-tasks': vendorTasksOnly.filter(t => t.status === 'Completed').length,
	      'vendor-action-log': vendorLogs.length,
	      'recurring-tasks': visibleRecurringTasks.length,
	      'recurring-actions': visibleRecurringActions.length,
	    };
      pendingStatusNavItems.forEach(item => {
        const decoded = decodeURIComponent(item.id.replace('pending-status:', ''));
        counts[item.id] = employeeTasks.filter(t => normalizeStatusName(t.status) === decoded).length;
      });

	    return filteredNavItems.map(item => {
	      const withCount = Object.prototype.hasOwnProperty.call(counts, item.id)
	        ? { ...item, count: counts[item.id] }
	        : item;
	      return { ...withCount, label: getViewLabel(item.id, withCount.label) };
	    });
		  }, [filteredNavItems, visibleTasks, visibleActionLogs, visibleRecurringTasks, visibleRecurringActions, pendingStatusNavItems, settings]);

  const [lastAddedCategory, setLastAddedCategory] = useState<string>('');
  const [lastAddedProject, setLastAddedProject] = useState<string>('');
  const [lastAddedVendorCategory, setLastAddedVendorCategory] = useState<string>('');
  const [projectModalInitialName, setProjectModalInitialName] = useState<string>('');
  const [categoryModalInitialName, setCategoryModalInitialName] = useState<string>('');

  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterPriority, setFilterPriority] = useState<string[]>([]);
  const [filterProject, setFilterProject] = useState<string[]>([]);
  const [filterFirm, setFilterFirm] = useState<string[]>([]);
  const [filterClient, setFilterClient] = useState<string[]>([]);
  const [filterOwner, setFilterOwner] = useState<string[]>([]);
  const [filterAssignee, setFilterAssignee] = useState<string[]>([]);
  const [filterVendor, setFilterVendor] = useState<string[]>([]);
  const [filterCategory, setFilterCategory] = useState<string[]>([]);
  
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [lastUpdateFrom, setLastUpdateFrom] = useState('');
  const [lastUpdateTo, setLastUpdateTo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [logDashboardFilter, setLogDashboardFilter] = useState<{ type: string; value: string; dateFrom?: string; dateTo?: string } | null>(null);

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isTaskModalVendorMode, setIsTaskModalVendorMode] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [isVendorCategoryModalOpen, setIsVendorCategoryModalOpen] = useState(false);
  const [isDesignationModalOpen, setIsDesignationModalOpen] = useState(false);
  const [editingDesignation, setEditingDesignation] = useState<Designation | null>(null);
  const [isDepartmentModalOpen, setIsDepartmentModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [isFirmModalOpen, setIsFirmModalOpen] = useState(false);
  const [isRecurringTaskModalOpen, setIsRecurringTaskModalOpen] = useState(false);
  const [isRecurringTaskUpdateModalOpen, setIsRecurringTaskUpdateModalOpen] = useState(false);
  const [isEditRecurringTaskModalOpen, setIsEditRecurringTaskModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isRecurringHistoryModalOpen, setIsRecurringHistoryModalOpen] = useState(false);
	  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
	  const sidebarCollapsedBeforeViewRef = useRef<boolean | null>(null);
	  const lastAutoCollapsedTabRef = useRef<string>('');
	  const [selectedTaskForHistory, setSelectedTaskForHistory] = useState<Task | null>(null);
	  const [selectedRecurringTask, setSelectedRecurringTask] = useState<RecurringTask | null>(null);

	  useEffect(() => {
	    if (!selectedTaskForHistory) return;
	    const latest = tasks.find(t => Number(t.id) === Number(selectedTaskForHistory.id));
	    if (!latest) return;
	    setSelectedTaskForHistory(prev => {
	      if (!prev) return prev;
	      return Number(prev.id) === Number(latest.id) ? latest : prev;
	    });
	  }, [tasks, selectedTaskForHistory?.id]);

	  const isDashboardNavigation = useRef(false);

  useEffect(() => {
    if (isDashboardNavigation.current) {
        isDashboardNavigation.current = false;
        return;
    }
    setFilterStatus([]);
    setFilterPriority([]);
    setFilterProject([]);
    setFilterFirm([]);
    setFilterClient([]);
    setFilterOwner([]);
    setFilterAssignee([]);
    setFilterVendor([]);
    setFilterCategory([]);
    setDateFrom('');
    setDateTo('');
    setLastUpdateFrom('');
    setLastUpdateTo('');
    setSearchTerm('');
    setLogDashboardFilter(null);
  }, [activeTab]);

	  const apiPost = async (action: string, data: any, target?: string) => {
    if (!apiUrl) return { success: false, error: 'No API URL configured' };
    setIsSyncing(true);
    setApiError(null);

    const now = new Date();
    const timestamp = now.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '');
    const shortDate = now.toLocaleDateString('en-GB');

    const finalData = { ...data };
    
    if (action === 'addTask' || action === 'updateTask') {
        finalData.id = data.id || data.ID || 0;
        finalData.title = data.title || data.Title || data.task || data.taskTitle || data.Task || '';
        finalData.task = finalData.title; 
        finalData.notes = data.remarks || data.Notes || data.remarks || '';
        finalData.assignees = data.assignees || '';
        finalData.owner = data.owner || '';
        finalData.status = data.status || 'Not Yet Started';
        finalData.priority = data.priority || 'Medium';
        finalData.category = data.category || '';
        finalData.vendor = data.vendor || '';
        finalData.vendorCategory = data.vendorCategory || '';
        finalData.hours = Number(data.hours || 0); // Include hours
        
        const projectValue = String(data.project || '');
        const projMatch = projectValue.match(/(.*)\s\((.*)\)/);
        if (projMatch) {
            finalData.project = projMatch[1].trim(); 
            finalData.clientName = projMatch[2].trim(); 
        } else {
            finalData.project = projectValue;
            finalData.clientName = data.clientName || '';
        }
        
        finalData['due Date'] = data.dueDate || '';
        
        if (!data.skipTimestamp) {
            finalData['last Update'] = timestamp;
            finalData.lastUpdateDate = timestamp; 
            finalData['remark'] = data.lastUpdateRemarks || data.remarks || data.Remarks || '';
        }
        
        finalData.taskDate = data.date || shortDate;
        finalData['date'] = data.date || shortDate;
        finalData.time = data.time || '';
        finalData.goal = data.goal || '';
        finalData.photos = data.photos || '';
        finalData.pdf = data.pdf || '';
    }

    if (action === 'addMaster' || action === 'updateMaster') {
        finalData.id = data.id || data.ID || 0;
        if (data.taskId) {
            finalData.taskID = data.taskId;
            finalData.recurringTaskId = data.taskId;
        }
        const gst = data.gstNumber || data.GSTNumber || data.gSTNumber || '';
        if (gst) finalData.gSTNumber = gst;
        if ('password' in data) finalData.password = data.password;
    }

    const payload = {
      action: action,
      target: target,
      data: finalData,
      user: currentUser?.name || 'Unknown'
    };

	    try {
	      const response = await fetch(apiUrl, {
	        method: 'POST',
	        headers: { 'Content-Type': 'text/plain' },
	        body: JSON.stringify(payload),
	        mode: 'cors',
	        redirect: 'follow'
	      });
	      const result = await safeJsonParse(response, action);
	      if (result.success) setTimeout(() => fetchData(false), 1500);
	      return result;
	    } catch (err: any) {
	      console.error(`API Error:`, err.message);
	      setTimeout(() => fetchData(false), 2000);
	      return { success: false, error: err?.message || 'Request failed' };
	    } finally {
	      setIsSyncing(false);
	    }
	  };

	  const confirmDelete = (label = 'this item') => {
	    return window.confirm(`Are you sure you want to delete ${label}?`);
	  };

  const abortControllerRef = useRef<AbortController | null>(null);

		  const fetchData = useCallback(async (showLoading = true) => {
		    if (!apiUrl) return;
		    if (showLoading) setIsLoading(true);
		    else setIsSyncing(true);
	    if (abortControllerRef.current) abortControllerRef.current.abort();
	    abortControllerRef.current = new AbortController();
	    const timeoutId = window.setTimeout(() => {
	      try { abortControllerRef.current?.abort(); } catch {}
	    }, 20000);
	    
	    try {
		      const response = await fetch(
            `${apiUrl}${apiUrl.includes('?') ? '&' : '?'}action=init&actionLogsLimit=500&recurringActionsLimit=500&_cb=${Date.now()}`,
            { 
		        signal: abortControllerRef.current.signal,
		        cache: 'no-store',
		        mode: 'cors'
		      });
	      const result = await safeJsonParse(response, 'Data Load');
	      
			      if (result.success) {
			        const { data } = result;
	        const normalizeTasks = (list: any[]) => (list || []).map(item => {
            const rawProject = String(item.project || item.Project || '').trim();
            const rawClient = String(item.clientName || item['client Name'] || item['Client Name'] || item.client || item.Client || '').trim();
            
            return {
                ...item,
                id: Number(item.id || item.ID || 0),
                title: String(item.title || item.Title || item.task || item.taskTitle || item.Task || ''),
                date: formatToIndianDate(item.date || item.Date || ''),
                lastUpdateDate: formatToIndianDateTime(item.lastUpdate || item.lastUpdateDate || item.LastUpdateDate || ''),
                remarks: String(item.description || item.notes || item.remarks || item.Remarks || ''),
                lastUpdateRemarks: String(item.remark || item.lastUpdateRemarks || item.lastUpdateRemark || item.LastUpdateRemarks || ''),
                status: String(item.status || item.Status || 'Not Yet Started'),
                priority: String(item.priority || item.Priority || 'Medium'),
                dueDate: formatToIndianDate(item.dueDate || item['due Date'] || item.DueDate || ''),
                vendor: item.vendor ? String(item.vendor) : '',
                category: item.category ? String(item.category) : '',
                vendorCategory: item.vendorCategory || item.vendorcategory || '',
                clientName: rawClient,
	                hours: Number(item.hours || 0), // Normalize hours
	                time: String(item.time || ''),
	                goal: String(item.goal || ''),
	                achieved: '',
	                firm: String(item.firm || item.Firm || ''),
	                photos: String(item.photos || ''),
	                pdf: String(item.pdf || ''),
                project: (rawProject && rawClient && !rawProject.includes('(')) 
                    ? `${rawProject} (${rawClient})` 
                    : rawProject || ''
            };
        });

	        const normalizedTaskList = normalizeTasks([...(data.mainTasks || []), ...(data.vendorTasks || [])]);
	        const taskGoalById = new Map<number, string>(
	          normalizedTaskList.map((t: any) => [Number(t.id || 0), String(t.goal || '')])
	        );
        setUsers((data.users || []).map((u: any) => ({ ...u, id: Number(u.id), employeeId: String(u.employeeId || u.employee_id || ''), isActive: String(u.isActive).toUpperCase() === 'TRUE' })));
        setProjects((data.projects || []).map((p: any) => ({ ...p, id: Number(p.id) })));
        setClients((data.clients || []).map((c: any) => ({ ...c, id: Number(c.id), gstNumber: c.gstNumber || c.gSTNumber || c.GSTNumber || '' })));
        setFirms((data.firms || []).map((f: any) => ({ ...f, id: Number(f.id), name: String(f.name || ''), sortName: String(f.sortName || f.sortname || f.SortName || '') })));
        setVendors((data.vendors || []).map((v: any) => ({ ...v, id: Number(v.id), gstNumber: v.gstNumber || v.gSTNumber || v.GSTNumber || '' })));
        setCategories((data.categories || []).map((c: any) => ({ ...c, id: Number(c.id) })));
        setStatuses((data.statuses || []).map((s: any) => ({ ...s, id: Number(s.id), name: String(s.name || ''), is_system: Number(s.is_system || 0) })));
        setVendorCategories((data.vendorCategories || []).map((vc: any) => ({ ...vc, id: Number(vc.id) })));
        setDesignations((data.designations || []).map((d: any) => ({
          id: Number(d.id),
          title: String(d.title || d.name || ''),
          description: String(d.description || '')
        })));
        setDepartments((data.departments || []).map((d: any) => ({
          id: Number(d.id),
          name: String(d.name || '')
        })));
        const normalizedLogs = (data.actionLogs || []).map((l: any) => {
            const rawProject = String(l.project || l.Project || '').trim();
            const rawClient = String(l.clientName || l['client Name'] || l['Client Name'] || l.client || l.Client || '').trim();
            return {
                ...l,
                id: Number(l.id || l.ID || 0),
                taskId: Number(l.taskId || l.taskID || 0),
                task: String(l.task || l.taskTitle || l.TaskTitle || l.Task || ''),
                taskDate: formatToIndianDate(l.taskDate || l.TaskDate || l['task Date'] || l['Task Date'] || ''),
                updateDate: formatToIndianDateTime(l.updateDate || l.UpdateDate || l['update Date'] || l['Update Date'] || l.updatedOn || l.UpdatedOn || ''),
                clientName: rawClient,
                assignees: String(l.assignees || l.Assignees || ''),
                hours: Number(l.hours || 0), // Normalize hours in log
                time: String(l.time || l.Time || ''),
	                goal: String(l.goal || l.Goal || ''),
	                taskGoal: taskGoalById.get(Number(l.taskId || l.taskID || 0)) || '',
	                firm: String(l.firm || l.Firm || ''),
                photos: String(l.photos || ''),
                pdf: String(l.pdf || ''),
                project: (rawProject && rawClient && !rawProject.includes('(')) 
                    ? `${rawProject} (${rawClient})` 
                    : rawProject || '',
                vendor: l.vendor || l.Vendor || ''
            };
        });
		        const achievedSumByTaskId = new Map<number, number>();
		        normalizedLogs.forEach((log: any) => {
		          const taskId = Number(log.taskId || 0);
		          if (!taskId) return;
		          const achievedValue = Number(String(log.goal || '').trim());
		          const prev = achievedSumByTaskId.get(taskId) || 0;
		          achievedSumByTaskId.set(taskId, prev + (Number.isFinite(achievedValue) ? achievedValue : 0));
		        });

		        setTasks(
			          normalizedTaskList
			            .map((task: any) => ({
			              ...task,
			              achieved: String(achievedSumByTaskId.get(Number(task.id || 0)) || '')
			            }))
		            .sort((a: any, b: any) => Number(b.id || 0) - Number(a.id || 0))
		        );
		        setActionLogs(normalizedLogs);
		        const recurringTaskGoalById = new Map<number, string>(
		          (data.recurringTasks || []).map((t: any) => [Number(t.id || 0), String(t.goal || '')])
		        );
		        setRecurringTasks((data.recurringTasks || []).map((t: any) => ({
			            ...t,
		            id: Number(t.id),
                notes: String(t.notes || ''),
		            frequencyDays: Number(t.frequencyDays || 30),
		            periodicity: (t.periodicity || t.frequencyType || 'Fixed Days') as any,
                recurrenceDay: Number(t.recurrenceDay || t.recurrenceday || (['Monthly', 'Yearly'].includes(String(t.periodicity || t.frequencyType || '')) ? (Number(t.frequencyDays || 0) || 1) : (String(t.periodicity || t.frequencyType || '') === 'Weekly' ? Number(t.frequencyDays || 0) : 0))),
                recurrenceMonth: String(t.recurrenceMonth || t.recurrencemonth || ''),
		            startDate: formatToIndianDate(t.startDate || ''),
		            time: formatToHHMM(getCaseInsensitive(t, 'time') || ''),
			            lastUpdatedOn: formatToIndianDateTime(t.lastUpdatedOn || ''),
			            lastUpdateRemarks: String(t.lastUpdateRemarks || ''),
				            goal: String(t.goal || ''),
                  firm: String(t.firm || ''),
                  owner: String(t.owner || t.Owner || ''),
				            status: String(t.status || 'Not Yet Started') as any
			        })).sort((a: any, b: any) => Number(b.id || 0) - Number(a.id || 0)));
		        setRecurringActions((data.recurringActions || []).map((a: any) => ({
		          ...a,
		          id: Number(a.id || 0),
		          taskId: Number(a.taskId || a.taskID || a.taskid || 0),
		          taskTitle: String(a.taskTitle || a.task || a.title || a.TaskTitle || a['Task Title'] || ''),
		          category: String(a.category || a.Category || ''),
		          assignee: String(a.assignee || a.Assignee || ''),
		          status: String(a.status || a.Status || 'Not Yet Started') as any,
			          remarks: String(a.remarks || a.Remarks || a.remark || ''),
					          goal: String(a.goal || a.Goal || ''),
			          taskGoal: recurringTaskGoalById.get(Number(a.taskId || a.taskID || a.taskid || 0)) || '',
                firm: String(a.firm || a.Firm || ''),
                  owner: String(a.owner || a.Owner || ''),
				          photos: String(a.photos || a.Photos || ''),
		          pdf: String(a.pdf || a.PDF || ''),
		          timestamp: formatToHHMM(getCaseInsensitive(a, 'timestamp') || ''),
		          updatedOn: formatToIndianDateTime(getCaseInsensitive(a, 'updatedOn') || '')
		        })));
		        if (data.settings) setSettings(normalizeSettings(data.settings));
		        setLastSynced(new Date());

            // Cache a trimmed snapshot for faster next load.
            persistCache({
              users: (data.users || []).map((u: any) => ({ ...u, id: Number(u.id), isActive: String(u.isActive).toUpperCase() === 'TRUE' })),
              projects: (data.projects || []).map((p: any) => ({ ...p, id: Number(p.id) })),
              clients: (data.clients || []).map((c: any) => ({ ...c, id: Number(c.id), gstNumber: c.gstNumber || c.gSTNumber || c.GSTNumber || '' })),
              firms: (data.firms || []).map((f: any) => ({ ...f, id: Number(f.id), name: String(f.name || ''), sortName: String(f.sortName || f.sortname || f.SortName || '') })),
              vendors: (data.vendors || []).map((v: any) => ({ ...v, id: Number(v.id), gstNumber: v.gstNumber || v.gSTNumber || v.GSTNumber || '' })),
              categories: (data.categories || []).map((c: any) => ({ ...c, id: Number(c.id) })),
              statuses: (data.statuses || []).map((s: any) => ({ ...s, id: Number(s.id), name: String(s.name || ''), is_system: Number(s.is_system || 0) })),
              vendorCategories: (data.vendorCategories || []).map((vc: any) => ({ ...vc, id: Number(vc.id) })),
              designations: (data.designations || []).map((d: any) => ({ id: Number(d.id), title: String(d.title || d.name || ''), description: String(d.description || '') })),
              // Use the already-normalized + computed arrays, trimmed to keep localStorage small.
              tasks: normalizedTaskList
                .map((task: any) => ({ ...task, achieved: String(achievedSumByTaskId.get(Number(task.id || 0)) || '') }))
                .sort((a: any, b: any) => Number(b.id || 0) - Number(a.id || 0))
                .slice(0, 500),
              actionLogs: normalizedLogs.slice(0, 500),
              recurringTasks: (data.recurringTasks || []).map((t: any) => ({
                ...t,
                id: Number(t.id),
                frequencyDays: Number(t.frequencyDays || 30),
                periodicity: (t.periodicity || t.frequencyType || 'Fixed Days') as any,
                startDate: formatToIndianDate(t.startDate || ''),
                time: formatToHHMM(getCaseInsensitive(t, 'time') || ''),
                lastUpdatedOn: formatToIndianDate(t.lastUpdatedOn || ''),
                lastUpdateRemarks: String(t.lastUpdateRemarks || ''),
                goal: String(t.goal || ''),
                firm: String(t.firm || ''),
                owner: String(t.owner || t.Owner || ''),
                status: String(t.status || 'Not Yet Started') as any,
              })).slice(0, 300),
              recurringActions: (data.recurringActions || []).slice(0, 500),
              settings: data.settings || null,
            });
		      } else {
		        setApiError(result?.error || 'Failed to load data.');
		      }
	    } catch (error: any) {
	      if (error?.name === 'AbortError') {
	        setApiError('Loading timed out. Please refresh.');
	      } else {
	        console.error("fetchData error:", error);
	        setApiError(error?.message || 'Failed to load data.');
	      }
	    } finally {
	      window.clearTimeout(timeoutId);
	      if (showLoading) setIsLoading(false);
	      setIsSyncing(false);
	    }
		  }, [apiUrl, persistCache]);

	  useEffect(() => {
	    if (apiUrl && currentUser) {
        const hadCache = hydrateFromCache();
	      fetchData(!hadCache);
	      const interval = setInterval(() => fetchData(false), AUTO_SYNC_INTERVAL);
	      return () => clearInterval(interval);
	    }
	  }, [fetchData, apiUrl, currentUser, hydrateFromCache]);

  useEffect(() => {
    if (VENDOR_MODULE_ENABLED) return;
    if (
      activeTab === 'vendors' ||
      activeTab === 'vendor-categories' ||
      activeTab === 'vendor-tasks' ||
      activeTab === 'pending-vendor-tasks' ||
      activeTab === 'completed-vendor-tasks' ||
      activeTab === 'vendor-action-log'
    ) {
      setActiveTab('all-tasks');
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'clients' || activeTab === 'projects') {
      setActiveTab('all-tasks');
    }
  }, [activeTab]);

  // Auto-hide left sidebar for non-dashboard pages (more working space).
  // Users can always bring it back via the fixed "Menu" button.
  useEffect(() => {
    if (layoutMode !== 'side') return;
    if (!currentUser) return;

    const shouldAutoCollapse = activeTab !== 'dashboard';
    if (!shouldAutoCollapse) return;

    // Only auto-collapse once per tab to avoid fighting the user if they re-open it.
    if (lastAutoCollapsedTabRef.current === activeTab) return;
    lastAutoCollapsedTabRef.current = activeTab;

    setIsSidebarCollapsed(true);
  }, [layoutMode, activeTab, currentUser]);

  // Auto-hide left sidebar when any modal is open (View/Update/Add),
  // and restore it back when all modals close.
  useEffect(() => {
    if (layoutMode !== 'side') return;

    const isAnyModalOpen =
      isTaskModalOpen ||
      isCategoryModalOpen ||
      isProjectModalOpen ||
      isUserModalOpen ||
      isClientModalOpen ||
      isVendorModalOpen ||
      isVendorCategoryModalOpen ||
      isDesignationModalOpen ||
      isRecurringTaskModalOpen ||
      isRecurringTaskUpdateModalOpen ||
      isEditRecurringTaskModalOpen ||
      isHistoryModalOpen ||
      isRecurringHistoryModalOpen;

    if (isAnyModalOpen) {
      if (sidebarCollapsedBeforeViewRef.current === null) {
        sidebarCollapsedBeforeViewRef.current = isSidebarCollapsed;
      }
      setIsSidebarCollapsed(true);
      return;
    }

    if (sidebarCollapsedBeforeViewRef.current !== null) {
      setIsSidebarCollapsed(sidebarCollapsedBeforeViewRef.current);
      sidebarCollapsedBeforeViewRef.current = null;
    }
  }, [
    layoutMode,
    isTaskModalOpen,
    isCategoryModalOpen,
    isProjectModalOpen,
    isUserModalOpen,
    isClientModalOpen,
    isVendorModalOpen,
    isVendorCategoryModalOpen,
    isDesignationModalOpen,
    isRecurringTaskModalOpen,
    isRecurringTaskUpdateModalOpen,
    isEditRecurringTaskModalOpen,
    isHistoryModalOpen,
    isRecurringHistoryModalOpen,
    isSidebarCollapsed,
  ]);

  const handleLogin = async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/login.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass })
      });
      const authData = await safeJsonParse(response, 'Login');
      if (!response.ok || !authData?.success || !authData?.user) {
        return { success: false, error: authData?.error || "Incorrect Email or Password." };
      }
      const user = authData.user;
      const normalizedUser = { ...user, id: Number(user.id), isActive: true };
      setCurrentUser(normalizedUser);
      setWorkspaceId('');
      const mysqlApiUrl = '/api/init.php';
      setApiUrl(mysqlApiUrl);
      localStorage.setItem('taskpro_api_url', mysqlApiUrl);
      localStorage.setItem('taskpro_user', JSON.stringify(normalizedUser));
      localStorage.removeItem('taskpro_workspace_id');
      setActiveTab('dashboard');
      return { success: true };
    } catch (err) { return { success: false, error: "Connection Error." }; }
    finally { setIsLoading(false); }
  };

  const handleAddTaskOptimistic = async (taskData: any, isVendor: boolean) => {
    const uniqueId = Date.now() * 1000 + (uniqueIdCounterRef.current++ % 1000);
    const tempId = -uniqueId;
    const now = new Date();
    const shortDate = now.toLocaleDateString('en-GB');
    const tempTask: Task = {
      ...taskData,
      id: tempId,
      date: shortDate,
      status: 'Not Yet Started',
      lastUpdateDate: '',
      lastUpdateRemarks: '',
      priority: taskData.priority || 'Medium',
      dueDate: formatToIndianDate(taskData.dueDate),
      hours: 0,
      remarks: String(taskData.remarks || taskData.notes || taskData.description || ''),
    };
    setTasks(prev => [tempTask, ...prev]);
    setSyncingIds(prev => new Set(prev).add(tempId));
    try {
      const targetSheet = isVendor ? 'VendorTasks' : 'MainTasks';
      await apiPost('addTask', { ...taskData, id: uniqueId }, targetSheet);
    } catch (err) {
      setTasks(prev => prev.filter(t => t.id !== tempId));
    } finally {
      setSyncingIds(prev => {
        const next = new Set(prev);
        next.delete(tempId);
        return next;
      });
    }
  };

  const handleUpdateTaskOptimistic = async (task: Task) => {
    const now = new Date();
    const timestamp = now.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '');
    // Note: Cumulative hours are calculated by server, UI adds newly logged hours to local optimistic state
    setTasks(prev => prev.map(t => {
      if (t.id !== task.id) return t;
      const currentAchieved = Number(String((t as any).achieved || '0').trim());
      const newAchieved = Number(String(task.goal || '0').trim());
      const sumAchieved = (Number.isFinite(currentAchieved) ? currentAchieved : 0) + (Number.isFinite(newAchieved) ? newAchieved : 0);
      return { ...task, achieved: String(sumAchieved), lastUpdateDate: timestamp };
    })); 
    setSyncingIds(prev => new Set(prev).add(task.id));
    try {
      const targetSheet = task.vendor && task.vendor.trim() !== '' ? 'VendorTasks' : 'MainTasks';
      await apiPost('updateTask', { ...task, lastUpdateRemarks: task.lastUpdateRemarks || '' }, targetSheet); 
    } catch (err) {
    } finally {
      setSyncingIds(prev => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }
  };

  const handleEditTaskOptimistic = async (task: Task) => {
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...task } : t)); 
    setSyncingIds(prev => new Set(prev).add(task.id));
    try {
      const targetSheet = task.vendor && task.vendor.trim() !== '' ? 'VendorTasks' : 'MainTasks';
      await apiPost('updateTask', { ...task, skipLog: true, skipTimestamp: true }, targetSheet); 
    } catch (err) {
    } finally {
      setSyncingIds(prev => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }
  };

  const handleDeleteLog = async (logId: number, taskId: number, isVendorLog: boolean) => {
    const targetLogSheet = isVendorLog ? 'VendorTaskActionLog' : 'MainTaskActionLog';
    setActionLogs(prev => prev.filter(l => l.id !== logId));
    if (!confirmDelete('this log')) return;
    apiPost('deleteRecord', { id: logId }, targetLogSheet);
    const remainingLogs = actionLogs.filter(l => l.id !== logId && Number(l.taskId) === Number(taskId));
    const lastLog = remainingLogs[0];
    const task = tasks.find(t => t.id === taskId);
    if (task) {
	      const updatedTask = {
	        ...task,
	        status: lastLog ? lastLog.status as any : 'Not Yet Started',
	        lastUpdateDate: lastLog ? lastLog.updateDate : '',
	        lastUpdateRemarks: lastLog ? lastLog.remarks : '',
	        achieved: lastLog ? String(lastLog.goal || '') : ''
	      };
      setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
      const targetTaskSheet = isVendorLog ? 'VendorTasks' : 'MainTasks';
      apiPost('updateTask', { ...updatedTask, skipLog: true }, targetTaskSheet);
    }
  };

	  const handleDashboardFilterChange = (type: string, value: string) => {
	    isDashboardNavigation.current = true;
	    const today = new Date().toLocaleDateString('en-CA');
	    if (type === 'vendor') {
	      if (!VENDOR_MODULE_ENABLED) return;
	      setActiveTab('pending-vendor-tasks');
	      setFilterVendor([value]);
	    }
	    else if (type === 'assignee') { setActiveTab('pending'); setFilterAssignee([value]); }
	    else if (type === 'project') { setActiveTab('pending'); setFilterProject([value]); }
	    else if (type === 'priority') { setActiveTab('pending'); setFilterPriority([value]); }
	    else if (type === 'category') { setActiveTab('pending'); setFilterCategory([value]); }
	    else if (type === 'status') { 
	        if (value === 'Overdue') setActiveTab('pending');
	        else if (value === 'Completed') setActiveTab('completed');
	        else if (value) setActiveTab(makePendingStatusId(value));
	        else setActiveTab('all-tasks');
	        setFilterStatus([value]);
	    }
    else if (type === 'employee-log') { setActiveTab('action-log'); setLogDashboardFilter({ type: 'assignee', value: value, dateFrom: today, dateTo: today }); }
	    else if (type === 'vendor-log') {
	      if (!VENDOR_MODULE_ENABLED) return;
	      setActiveTab('vendor-action-log');
	      setLogDashboardFilter({ type: 'vendor', value: value, dateFrom: today, dateTo: today });
	    }
    else if (type === 'recurring-log') { setActiveTab('recurring-actions'); setLogDashboardFilter({ type: 'assignee', value: value, dateFrom: today, dateTo: today }); }
  };

  const handleInstantAddCategory = async (cat: Omit<Category, 'id'>) => {
    const tempId = Date.now();
    const newCat = { ...cat, id: tempId } as Category;
    setCategories(prev => [...prev, newCat]);
    setLastAddedCategory(cat.name);
    await apiPost('addMaster', cat, 'Categories');
  };

  const handleInstantAddVendorCategory = async (vcat: Omit<VendorCategory, 'id'>) => {
    const tempId = Date.now();
    const newVCat = { ...vcat, id: tempId } as VendorCategory;
    setVendorCategories(prev => [...prev, newVCat]);
    setLastAddedVendorCategory(vcat.name);
    await apiPost('addMaster', vcat, 'VendorCategories');
  };

  const handleInstantAddProject = async (proj: Omit<Project, 'id'>) => {
    const tempId = Date.now();
    const newProj = { ...proj, id: tempId } as Project;
    setProjects(prev => [...prev, newProj]);
    setLastAddedProject(`${proj.name} (${proj.client})`);
    await apiPost('addMaster', proj, 'Projects');
  };

  const handleInstantAddClient = async (client: Omit<Client, 'id'>) => {
    const tempId = Date.now();
    const newClient = { ...client, id: tempId } as Client;
    setClients(prev => [...prev, newClient]);
    await apiPost('addMaster', client, 'Clients');
  };

  const handleInstantAddFirm = async (firm: Omit<Firm, 'id'>) => {
    const tempId = Date.now();
    const newFirm = { ...firm, id: tempId } as Firm;
    setFirms(prev => [...prev, newFirm]);
    await apiPost('addMaster', firm, 'Firms');
  };

  const handleInstantAddDepartment = async (dept: Omit<Department, 'id'>) => {
    const tempId = Date.now();
    const newDept = { ...dept, id: tempId } as Department;
    setDepartments(prev => [...prev, newDept]);
    await apiPost('addMaster', dept, 'Departments');
  };

  const renderContent = () => {
    const handleExportExcel = (tasksToExport: Task[]) => {
      const activeFilters: string[] = [];
      if (filterStatus.length > 0) activeFilters.push(`Status: ${filterStatus.join(',')}`);
      if (filterPriority.length > 0) activeFilters.push(`Priority: ${filterPriority.join(',')}`);
      if (filterProject.length > 0) activeFilters.push(`Project: ${filterProject.length} selected`);
      if (filterFirm.length > 0) activeFilters.push(`Firm: ${filterFirm.join(',')}`);
      if (filterCategory.length > 0) activeFilters.push(`Category: ${filterCategory.join(',')}`);
      if (filterAssignee.length > 0) activeFilters.push(`Assignee: ${filterAssignee.join(',')}`);
      if (filterVendor.length > 0) activeFilters.push(`Vendor: ${filterVendor.join(',')}`);
      if (dateFrom || dateTo) activeFilters.push(`Range: ${dateFrom || 'Start'} to ${dateTo || 'End'}`);
      
      const filterRow = activeFilters.length > 0 ? `Filters Applied: ${activeFilters.join(' | ')}` : "No Filters Applied";
      const generatedRow = `Generated on: ${new Date().toLocaleString('en-GB')}`;

	      const headers = ['Date', 'Task', 'Notes', 'Assignees', 'Owner', 'Project', 'Firm', 'Client Name', 'Vendor', 'Vendor Category', 'Status', 'Last Update Date', 'Last Update Remark', 'Priority', 'Due Date', 'Hours'];
      
      const csvContent = [
        `"${filterRow}"`,
        `"${generatedRow}"`,
        headers.join(','), 
        ...tasksToExport.map(task => {
          const isNotStarted = task.status === 'Not Yet Started';
          const lastDate = isNotStarted ? '' : (task.lastUpdateDate || '');
          const lastRemark = isNotStarted ? '' : (task.lastUpdateRemarks || '');

          return [
            `"${task.date}"`, 
            `"${(task.title || '').replace(/"/g, '""')}"`, 
            `"${(task.remarks || '').replace(/"/g, '""')}"`, 
	            `"${task.assignees}"`, 
	            `"${task.owner}"`, 
	            `"${task.project.split(' (')[0]}"`, 
              `"${task.firm || ''}"`,
	            `"${task.clientName || ''}"`, 
            `"${task.vendor || ''}"`, 
            `"${task.vendorCategory || ''}"`, 
            `"${task.status}"`, 
            `"${lastDate}"`, 
            `"${lastRemark.replace(/"/g, '""')}"`, 
            `"${task.priority}"`, 
            `"${task.dueDate}"`,
            `"${task.hours || 0}"`
          ].join(',');
        })
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a'); 
      link.href = URL.createObjectURL(blob); 
      link.setAttribute('download', `TaskPro_Export_${new Date().toISOString().split('T')[0]}.csv`); 
      link.click();
    };

      const taskStatusOptions = Array.from(new Set(
        ['Not Yet Started', ...statuses.map(s => String(s.name || '').trim()).filter(Boolean)]
      ));
	    const commonTaskProps = {
		      users, projects, vendors, firms, categories, syncingIds, vendorCategories, currentUser,
          taskStatuses: taskStatusOptions,
        showCollapsedMenuButton: layoutMode === 'side' && isSidebarCollapsed && !isAnyFormModalOpen,
        onShowMenu: () => setIsSidebarCollapsed(false),
	      sidebarCollapsed: layoutMode === 'side' && isSidebarCollapsed,
	      filterStatus, setFilterStatus, filterPriority, setFilterPriority, 
	      filterProject, setFilterProject, filterFirm, setFilterFirm, filterClient, setFilterClient,
	      filterOwner, setFilterOwner, filterAssignee, setFilterAssignee, filterCategory, setFilterCategory,
	      dateFrom, setDateFrom, dateTo, setDateTo,
	      lastUpdateFrom, setLastUpdateFrom, lastUpdateTo, setLastUpdateTo, searchTerm, setSearchTerm, filterVendor, setFilterVendor,
      lastAddedCategory, lastAddedProject, lastAddedVendorCategory, onClearLastAdded: () => { setLastAddedCategory(''); setLastAddedProject(''); setLastAddedVendorCategory(''); },
      onUpdateTask: handleUpdateTaskOptimistic, onEditTask: handleEditTaskOptimistic,
      onDeleteTask: (id: number, isVendor: boolean) => {
        if (!confirmDelete('this task')) return;
        setTasks(prev => prev.filter(t => t.id !== id));
        apiPost('deleteRecord', { id }, isVendor ? 'VendorTasks' : 'MainTasks');
      },
      onViewHistory: (task: Task) => { setSelectedTaskForHistory(task); setIsHistoryModalOpen(true); },
      onAddTask: (isVendor: boolean = false) => { setIsTaskModalVendorMode(isVendor); setIsTaskModalOpen(true); },
      onAddCategory: () => setIsCategoryModalOpen(true), onAddProject: () => setIsProjectModalOpen(true),
      onAddVendorCategory: () => setIsVendorCategoryModalOpen(true), onExportExcel: handleExportExcel,
      onBulkUpdateTask: async (ids: number[], updates: any) => {
          setTasks(prev => prev.map(t => ids.includes(t.id) ? { ...t, ...updates } : t));
          for (const id of ids) {
              const task = tasks.find(t => t.id === id);
              if (task) {
                  const targetSheet = task.vendor && task.vendor.trim() !== '' ? 'VendorTasks' : 'MainTasks';
                  const finalUpdates = { ...updates };
                  
                  const isMetadataOnly = (updates.priority || updates.category || updates.assignees || updates.vendor) && !updates.status;

                  if (isMetadataOnly) {
                      finalUpdates.skipTimestamp = true;
                      finalUpdates.skipLog = true;
                  } else {
                      if (!finalUpdates.lastUpdateRemarks) {
                          const changedFields = [];
                          if (updates.priority) changedFields.push(`Priority to ${updates.priority}`);
                          if (updates.assignees) changedFields.push(`Reassigned to ${updates.assignees}`);
                          if (updates.status) changedFields.push(`Status to ${updates.status}`);
                          if (updates.category) changedFields.push(`Category to ${updates.category}`);
                          finalUpdates.lastUpdateRemarks = `Bulk update: ${changedFields.join(', ')}`;
                      }
                      if ((updates.priority || updates.assignees || updates.vendor || updates.category) && !updates.status) { 
                          finalUpdates.skipLog = true; 
                      }
                  }
                  await apiPost('updateTask', { ...task, ...finalUpdates }, targetSheet);
              }
          }
      }
	    };

      const { getViewLabel } = buildLabelResolvers(settings);

	      if (activeTab.startsWith('pending-status:')) {
	        const targetStatus = decodeURIComponent(activeTab.replace('pending-status:', ''));
	        const viewTitle = pendingStatusNavItems.find(x => x.id === activeTab)?.label || 'Pending';
	        return <TasksView title={viewTitle} tasks={visibleTasks.filter(t => (!t.vendor || t.vendor === '') && normalizeStatusName(t.status) === targetStatus)} {...commonTaskProps} filterType="all" />;
	      }

	    switch (activeTab) {
      case 'dashboard': 
		        return <Dashboard 
		          isAdmin={isAdmin} tasks={visibleTasks} users={users} projects={projects} categories={categories} statuses={statuses} actionLogs={visibleActionLogs} recurringActions={visibleRecurringActions} recurringTasks={visibleRecurringTasks}
	          onNavigate={(tab) => {
              if (tab === 'pending-client') setActiveTab(makePendingStatusId('Pending for Client'));
              else if (tab === 'pending-owner') setActiveTab(makePendingStatusId('Pending for Owner'));
              else if (tab === 'pending-training') setActiveTab(makePendingStatusId('Pending for Training'));
              else if (tab === 'pending-billing') setActiveTab(makePendingStatusId('Pending for Billing'));
              else if (tab === 'pending-payment') setActiveTab(makePendingStatusId('Pending for Payment'));
              else setActiveTab(tab);
	            }} onFilterChange={handleDashboardFilterChange} onOpenNewTask={() => { setIsTaskModalVendorMode(false); setIsTaskModalOpen(true); }} onOpenNewRecurringTask={() => setIsRecurringTaskModalOpen(true)}
	          onOpenAddUser={() => setIsUserModalOpen(true)} onOpenAddCategory={() => setIsCategoryModalOpen(true)} onOpenAddProject={() => setIsProjectModalOpen(true)} onOpenAddClient={() => setIsClientModalOpen(true)} onOpenAddVendor={() => setIsVendorModalOpen(true)} 
	        />;
      case 'all-tasks': return <TasksView title={getViewLabel('all-tasks', 'All Tasks')} tasks={visibleTasks.filter(t => !t.vendor || t.vendor === '')} {...commonTaskProps} filterType="all" />;
      case 'add-multiple': return (
        <AddMultipleTasksView
          projects={projects}
          users={users}
          categories={categories}
          currentUser={currentUser}
          onOpenAddProject={(name) => {
            setProjectModalInitialName(name);
            setIsProjectModalOpen(true);
          }}
          onOpenAddCategory={(name) => {
            setCategoryModalInitialName(name);
            setIsCategoryModalOpen(true);
          }}
          onSaveTasks={async (tasksToSave) => {
            for (const t of tasksToSave) await handleAddTaskOptimistic(t, false);
            setActiveTab('all-tasks');
          }}
        />
      );
      case 'pending': return <TasksView title={getViewLabel('pending', 'Pending Tasks')} tasks={visibleTasks.filter(t => (!t.vendor || t.vendor === '') && t.status !== 'Completed')} {...commonTaskProps} filterType="pending" />;
		      case 'completed': return <TasksView title={getViewLabel('completed', 'Completed Tasks')} tasks={visibleTasks.filter(t => (!t.vendor || t.vendor === '') && t.status === 'Completed')} {...commonTaskProps} filterType="completed" />;
      case 'update-multiple': return <UpdateMultipleView projects={projects} tasks={visibleTasks.filter(t => t.status !== 'Completed')} onUpdateTasks={async (updates) => { for (const u of updates) await handleUpdateTaskOptimistic(u); setActiveTab('pending'); }} />;
      case 'activity-dashboard': return <ActivityDashboardView logs={visibleActionLogs.filter(l => !l.vendor || l.vendor === '')} users={users} currentUser={currentUser} />;
      case 'action-log': return <ActionLogView logs={visibleActionLogs.filter(l => !l.vendor || l.vendor === '')} isAdmin={isAdmin} projects={projects} onDeleteLog={(logId, taskId) => handleDeleteLog(logId, taskId, false)} dashboardFilter={logDashboardFilter} onClearDashboardFilter={() => setLogDashboardFilter(null)} />;
      case 'vendors': if (!isAdmin) return null; return <VendorsView vendors={vendors} onAddVendor={(v) => { setVendors(p => [...p, { ...v, id: Date.now() } as any]); apiPost('addMaster', v, 'Vendors'); }} onDeleteVendor={(id) => { if (!confirmDelete('this vendor')) return; setVendors(p => p.filter(v => v.id !== id)); apiPost('deleteRecord', { id }, 'Vendors'); }} onEditVendor={(v) => { setVendors(p => p.map(x => x.id === v.id ? v : x)); apiPost('updateMaster', v, 'Vendors'); }} />;
      case 'vendor-categories': if (!isAdmin) return null; return <VendorCategoriesView categories={vendorCategories} onAddCategory={() => setIsVendorCategoryModalOpen(true)} onDeleteCategory={(id) => { if (!confirmDelete('this vendor category')) return; setVendorCategories(p => p.filter(c => c.id !== id)); apiPost('deleteRecord', { id }, 'VendorCategories'); }} onEditCategory={(vc) => { setVendorCategories(p => p.map(x => x.id === vc.id ? vc : x)); apiPost('updateMaster', vc, 'VendorCategories'); }} />;
      case 'vendor-tasks': return <TasksView title={getViewLabel('vendor-tasks', 'All Vendor Tasks')} tasks={visibleTasks.filter(t => t.vendor && t.vendor !== '')} {...commonTaskProps} isVendorView={true} filterType="all" />;
      case 'pending-vendor-tasks': return <TasksView title={getViewLabel('pending-vendor-tasks', 'Pending Vendor Tasks')} tasks={visibleTasks.filter(t => t.vendor && t.vendor !== '')} {...commonTaskProps} isVendorView={true} filterType="pending" />;
      case 'completed-vendor-tasks': return <TasksView title={getViewLabel('completed-vendor-tasks', 'Completed Vendor Tasks')} tasks={visibleTasks.filter(t => t.vendor && t.vendor !== '')} {...commonTaskProps} isVendorView={true} filterType="completed" />;
      case 'vendor-action-log': return <ActionLogView logs={visibleActionLogs.filter(l => l.vendor && l.vendor !== '')} isAdmin={isAdmin} projects={projects} isVendorView={true} onDeleteLog={(logId, taskId) => handleDeleteLog(logId, taskId, true)} dashboardFilter={logDashboardFilter} onClearDashboardFilter={() => setLogDashboardFilter(null)} />;
      case 'due-recurring-tasks': return <RecurringTasksView title={getViewLabel('due-recurring-tasks', 'Due Recurring Tasks')} filterType="due" tasks={visibleRecurringTasks} actions={visibleRecurringActions} onAdd={() => setIsRecurringTaskModalOpen(true)} onUpdate={(t) => { setSelectedRecurringTask(t); setIsRecurringTaskUpdateModalOpen(true); }} onEdit={(t) => { setSelectedRecurringTask(t); setIsEditRecurringTaskModalOpen(true); }} onViewHistory={(t) => { setSelectedRecurringTask(t); setIsRecurringHistoryModalOpen(true); }} onDelete={async (id) => { if (!confirmDelete('this recurring task')) return; setRecurringTasks(prev => prev.filter(t => t.id !== id)); await apiPost('deleteRecord', { id }, 'RecurringTasks'); }} currentUser={currentUser} sidebarCollapsed={layoutMode === 'side' && isSidebarCollapsed} />;
      case 'recurring-tasks': return <RecurringTasksView title={getViewLabel('recurring-tasks', 'Recurring Tasks')} tasks={visibleRecurringTasks} actions={visibleRecurringActions} onAdd={() => setIsRecurringTaskModalOpen(true)} onUpdate={(t) => { setSelectedRecurringTask(t); setIsRecurringTaskUpdateModalOpen(true); }} onEdit={(t) => { setSelectedRecurringTask(t); setIsEditRecurringTaskModalOpen(true); }} onViewHistory={(t) => { setSelectedRecurringTask(t); setIsRecurringHistoryModalOpen(true); }} onDelete={async (id) => { if (!confirmDelete('this recurring task')) return; setRecurringTasks(prev => prev.filter(t => t.id !== id)); await apiPost('deleteRecord', { id }, 'RecurringTasks'); }} currentUser={currentUser} sidebarCollapsed={layoutMode === 'side' && isSidebarCollapsed} />;
      case 'recurring-actions': return <RecurringTaskActionsView actions={visibleRecurringActions} isAdmin={isAdmin} onDeleteAction={(logId, taskId) => { if (!confirmDelete('this recurring log')) return; apiPost('deleteRecord', { id: logId, taskId: taskId }, 'RecurringActions'); }} dashboardFilter={logDashboardFilter} onClearDashboardFilter={() => setLogDashboardFilter(null)} />;
      case 'users': if (!isAdmin) return null; return <UsersView users={users} designations={designations} departments={categories as any} sidebarCollapsed={layoutMode === 'side' && isSidebarCollapsed} onAddUser={(u) => { setUsers(p => [...p, { ...u, id: Date.now(), isActive: true } as any]); apiPost('addMaster', u, 'Users'); }} onEditUser={(u) => { setUsers(p => p.map(x => x.id === u.id ? u : x)); apiPost('updateMaster', u, 'Users'); }} onToggleStatus={(id) => { const user = users.find(u => u.id === id); if (!user) return; const newStatus = !user.isActive; setUsers(prev => prev.map(u => u.id === id ? { ...u, isActive: newStatus } : u)); apiPost('updateMaster', { id, isActive: newStatus ? 'TRUE' : 'FALSE' }, 'Users'); }} onDeleteUser={(id) => { if (!confirmDelete('this user')) return; setUsers(p => p.filter(u => u.id !== id)); apiPost('deleteRecord', { id }, 'Users'); }} onAddDesignation={() => { setEditingDesignation(null); setIsDesignationModalOpen(true); }} onAddDepartment={() => setIsCategoryModalOpen(true)} />;
      case 'firms': if (!isAdmin) return null; return <FirmsView firms={firms} sidebarCollapsed={layoutMode === 'side' && isSidebarCollapsed} onAddFirm={() => setIsFirmModalOpen(true)} onDeleteFirm={(id) => { const target = firms.find(f => f.id === id); if (!target) return; if (String(target.name || '').trim().toUpperCase() === 'GENERAL') return; if (!confirmDelete('this firm')) return; setFirms(p => p.filter(f => f.id !== id)); apiPost('deleteRecord', { id }, 'Firms'); }} onEditFirm={(f) => { if (String(f.name || '').trim().toUpperCase() === 'GENERAL') return; setFirms(p => p.map(x => x.id === f.id ? f : x)); apiPost('updateMaster', f, 'Firms'); }} />;
      case 'clients': if (!isAdmin) return null; return <ClientsView clients={clients} projects={projects} onAddClient={handleInstantAddClient} onDeleteClient={(id) => { if (!confirmDelete('this client')) return; setClients(p => p.filter(c => c.id !== id)); apiPost('deleteRecord', { id }, 'Clients'); }} onEditClient={(c) => { setClients(p => p.map(x => x.id === c.id ? c : x)); apiPost('updateMaster', c, 'Clients'); }} onNavigateToProjectTasks={handleDashboardFilterChange.bind(null, 'project')} />;
      case 'projects': if (!isAdmin) return null; return <ProjectsView projects={projects} clients={clients} onAddProject={handleInstantAddProject} onDeleteProject={(id) => { if (!confirmDelete('this project')) return; setProjects(p => p.filter(x => x.id !== id)); apiPost('deleteRecord', { id }, 'Projects'); }} onEditProject={(p) => { setProjects(prev => prev.map(x => x.id === p.id ? p : x)); apiPost('updateMaster', p, 'Projects'); }} onAddClient={() => setIsClientModalOpen(true)} onNavigateToProjectTasks={handleDashboardFilterChange.bind(null, 'project')} />;
      case 'categories': if (!isAdmin) return null; return <CategoriesView categories={categories} sidebarCollapsed={layoutMode === 'side' && isSidebarCollapsed} onAddCategory={() => setIsCategoryModalOpen(true)} onDeleteCategory={(id) => { if (!confirmDelete('this category')) return; setCategories(p => p.filter(c => c.id !== id)); apiPost('deleteRecord', { id }, 'Categories'); }} onEditCategory={(c) => { setCategories(p => p.map(x => x.id === c.id ? c : x)); apiPost('updateMaster', c, 'Categories'); }} />;
      case 'statuses': if (!isAdmin) return null; return <StatusesView statuses={statuses} sidebarCollapsed={layoutMode === 'side' && isSidebarCollapsed} onAddStatus={async (status) => { const tempId = Date.now(); const row = { ...status, id: tempId, is_system: 0 } as StatusMaster; setStatuses(prev => [...prev, row]); await apiPost('addMaster', status, 'Statuses'); }} onEditStatus={async (status) => { setStatuses(prev => prev.map(x => x.id === status.id ? status : x)); await apiPost('updateMaster', status, 'Statuses'); }} onDeleteStatus={async (id) => { if (!confirmDelete('this status')) return; setStatuses(prev => prev.filter(x => x.id !== id)); await apiPost('deleteRecord', { id }, 'Statuses'); }} />;
      case 'settings': if (!isAdmin) return null; return <SettingsView settings={settings} onUpdate={async (s) => {
        setSettings(normalizeSettings(s));
        const result = await apiPost('updateMaster', s, 'AppSettings');
        if (!result?.success) {
          throw new Error(result?.error || 'Failed to save settings.');
        }
      }} />;
      case 'telegram-setup': if (!isAdmin) return null; return <TelegramSetupView />;
      case 'documentation': return <DocumentationView />;
      default: return null;
    }
  };

  const isAnyFormModalOpen =
    isTaskModalOpen ||
    isCategoryModalOpen ||
    isProjectModalOpen ||
    isUserModalOpen ||
    isClientModalOpen ||
    isVendorModalOpen ||
    isVendorCategoryModalOpen ||
    isDesignationModalOpen ||
    isRecurringTaskModalOpen ||
    isRecurringTaskUpdateModalOpen ||
    isEditRecurringTaskModalOpen ||
    isHistoryModalOpen ||
    isRecurringHistoryModalOpen ||
    isFirmModalOpen;

	  return (
		    <div className="flex min-h-screen bg-gray-50 overflow-hidden font-inter">
	      {!currentUser ? (
	        <LoginView onLogin={handleLogin} isAuthenticating={isLoading} />
	      ) : (
	        <LabelProvider settings={settings}>
	          {layoutMode === 'side' && (!isSidebarCollapsed || isSidebarOpen) && (
			            <Sidebar 
		              items={navItemsWithCounts} 
		              activeTab={activeTab} 
	              onTabChange={handleTabChange} 
	              onLayoutChange={setLayoutMode}
	              layoutMode={layoutMode}
	              isOpen={isSidebarOpen} 
	              onClose={() => setIsSidebarOpen(false)}
	              lastSynced={lastSynced}
	              isSyncing={isSyncing}
	              onSync={fetchData}
	              hasError={!!apiError}
	              onLogout={() => { setCurrentUser(null); localStorage.removeItem('taskpro_user'); }}
	              onExitWorkspace={() => { setCurrentUser(null); setWorkspaceId(''); setApiUrl(''); localStorage.clear(); }}
	              workspaceId={workspaceId}
	            />
	          )}

          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {layoutMode === 'top' ? (
              <TopBar 
                items={navItemsWithCounts} 
                activeTab={activeTab} 
                onTabChange={handleTabChange} 
                onLayoutChange={setLayoutMode}
                layoutMode={layoutMode}
                lastSynced={lastSynced}
                isSyncing={isSyncing}
                onSync={fetchData}
                hasError={!!apiError}
              />
            ) : (
	              <header className="md:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between sticky top-0 z-40">
                <div className="flex items-center space-x-2">
                   <img src="https://i.ibb.co/YBSjM7Gg/Chat-GPT-Image-Dec-18-2025-10-23-18-AM.png" className="h-8 w-8" alt="Logo" />
                   <h1 className="text-xl font-bold text-indigo-600">TaskPro</h1>
                </div>
                  {!isAnyFormModalOpen && (
	                  <button onClick={() => setIsSidebarOpen(prev => !prev)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-md">
	                    <Menu size={24} />
	                  </button>
                  )}
              </header>
            )}

            {layoutMode === 'side' && isSidebarOpen && (
              <div
                className="md:hidden fixed inset-0 z-30 bg-black/30"
                onClick={() => setIsSidebarOpen(false)}
              />
            )}

			            {(() => {
			              const showCollapsedMenuButton =
			                layoutMode === 'side' &&
			                isSidebarCollapsed &&
			                !isAnyFormModalOpen &&
			                activeTab !== 'all-tasks' &&
			                activeTab !== 'pending' &&
			                !activeTab.startsWith('pending-status:') &&
			                activeTab !== 'completed';

			              return (
			                <main
			                  className={`flex-1 overflow-y-auto pt-2 md:pt-4 px-2 md:px-4 pb-0 custom-scrollbar relative ${
			                    showCollapsedMenuButton ? 'md:pl-20' : ''
			                  }`}
			                >
				              {showCollapsedMenuButton && (
				                <button
				                  type="button"
				                  onClick={() => setIsSidebarCollapsed(false)}
				                  className="hidden md:inline-flex items-center justify-center fixed top-6 left-4 z-[120] w-11 h-11 bg-white border-2 border-indigo-200 text-indigo-700 rounded-xl shadow-lg hover:bg-indigo-50"
				                  title="Show menu"
				                >
			                  <Menu size={18} />
			                </button>
			              )}
		              {isLoading ? (
	                <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-50 flex flex-col items-center justify-center space-y-4">
	                    <div className="relative w-20 h-20">
	                        <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
	                        <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
	                    </div>
	                    <p className="text-indigo-600 font-black uppercase tracking-widest text-sm animate-pulse">Loading...</p>
	                </div>
	              ) : (
				                <div className="w-full mx-auto min-h-full flex flex-col">
		                  <div className="flex-1">
		                    {renderContent()}
		                  </div>
		                  <Footer />
		                </div>
	              )}
			            </main>
			              );
				            })()}
				          </div>
			        </LabelProvider>
			      )}

	      <LabelProvider settings={settings}>
	      {/* Modals */}
	      <AddTaskModal 
	        isOpen={isTaskModalOpen} 
	        onClose={() => setIsTaskModalOpen(false)} 
	        onSave={(t) => {
	          setActiveTab('all-tasks');
	          handleAddTaskOptimistic(t, isTaskModalVendorMode);
	        }}
        onAddCategory={() => setIsCategoryModalOpen(true)}
        onAddProject={() => setIsProjectModalOpen(true)}
        onAddVendorCategory={() => setIsVendorCategoryModalOpen(true)}
        users={users} categories={categories} projects={projects} firms={firms} vendors={vendors}
        vendorCategories={vendorCategories} isVendorView={isTaskModalVendorMode}
        lastAddedCategory={lastAddedCategory} lastAddedProject={lastAddedProject} 
        lastAddedVendorCategory={lastAddedVendorCategory} onClearLastAdded={() => { setLastAddedCategory(''); setLastAddedProject(''); setLastAddedVendorCategory(''); }}
      />
      
      <AddCategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => {
          setIsCategoryModalOpen(false);
          setCategoryModalInitialName('');
        }}
        onSave={(c) => {
          handleInstantAddCategory(c);
          setCategoryModalInitialName('');
        }}
        initialData={categoryModalInitialName ? ({ id: 0, name: categoryModalInitialName, type: '' } as any) : null}
        categories={categories}
      />
      <AddVendorCategoryModal isOpen={isVendorCategoryModalOpen} onClose={() => setIsVendorCategoryModalOpen(false)} onSave={handleInstantAddVendorCategory} vendorCategories={vendorCategories} />
      <AddProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => {
          setIsProjectModalOpen(false);
          setProjectModalInitialName('');
        }}
        onSave={(p) => {
          handleInstantAddProject(p);
          setProjectModalInitialName('');
        }}
        clients={clients}
        onAddClient={() => setIsClientModalOpen(true)}
        initialName={projectModalInitialName}
      />
      <AddClientModal isOpen={isClientModalOpen} onClose={() => setIsClientModalOpen(false)} onSave={handleInstantAddClient} clients={clients} />
      <AddUserModal 
        isOpen={isUserModalOpen} 
        onClose={() => setIsUserModalOpen(false)} 
        onSave={(u) => { 
          setUsers(p => [...p, { ...u, id: Date.now(), isActive: true } as any]); 
          apiPost('addMaster', u, 'Users'); 
        }} 
        designations={designations} 
        departments={departments} 
        onAddDesignation={() => { setEditingDesignation(null); setIsDesignationModalOpen(true); }} 
        onAddDepartment={() => { setEditingDepartment(null); setIsDepartmentModalOpen(true); }} 
        users={users}
        firms={firms}
        categories={categories}
      />
      <AddDesignationModal isOpen={isDesignationModalOpen} onClose={() => { setIsDesignationModalOpen(false); setEditingDesignation(null); }} initialData={editingDesignation} onSave={async (d) => {
        const designationPayload = { name: d.title };
        if (editingDesignation) {
          const updatedDesignation = { ...editingDesignation, ...d };
          const result = await apiPost('updateMaster', { id: updatedDesignation.id, ...designationPayload }, 'Designations');
          if (!result?.success) {
            alert(result?.error || 'Failed to update designation.');
            return;
          }
          setDesignations(prev => prev.map(x => x.id === updatedDesignation.id ? updatedDesignation : x));
        } else {
          const result = await apiPost('addMaster', designationPayload, 'Designations');
          if (!result?.success) {
            alert(result?.error || 'Failed to add designation.');
            return;
          }
          const newId = Number(result?.data?.id || Date.now());
          setDesignations(prev => [...prev, { ...d, id: newId } as any]);
        }
      }} designations={designations} />
      <AddDepartmentModal isOpen={isDepartmentModalOpen} onClose={() => { setIsDepartmentModalOpen(false); setEditingDepartment(null); }} initialData={editingDepartment} onSave={async (dept) => {
        if (editingDepartment) {
          const updated = { ...editingDepartment, ...dept };
          const result = await apiPost('updateMaster', { id: updated.id, name: updated.name }, 'Departments');
          if (!result?.success) {
            alert(result?.error || 'Failed to update department.');
            return;
          }
          setDepartments(prev => prev.map(x => x.id === updated.id ? updated : x));
        } else {
          const result = await apiPost('addMaster', { name: dept.name }, 'Departments');
          if (!result?.success) {
            alert(result?.error || 'Failed to add department.');
            return;
          }
          const newId = Number(result?.data?.id || Date.now());
          setDepartments(prev => [...prev, { ...dept, id: newId } as any]);
        }
      }} departments={departments} />
      <AddVendorModal isOpen={isVendorModalOpen} onClose={() => setIsVendorModalOpen(false)} onSave={(v) => { setVendors(p => [...p, { ...v, id: Date.now() } as any]); apiPost('addMaster', v, 'Vendors'); }} vendors={vendors} />
      <AddFirmModal isOpen={isFirmModalOpen} onClose={() => setIsFirmModalOpen(false)} onSave={handleInstantAddFirm} firms={firms} />
      
      <TaskHistoryModal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} task={selectedTaskForHistory} logs={actionLogs} />
      
      <AddRecurringTaskModal
        isOpen={isRecurringTaskModalOpen}
        onClose={() => setIsRecurringTaskModalOpen(false)}
        onSave={async (t) => {
          setActiveTab('recurring-tasks');
          const createResult = await apiPost('addMaster', t, 'RecurringTasks');
          if (!createResult?.success) {
            setApiError(createResult?.error || 'Failed to save recurring task.');
            return;
          }
          const createdId = Number(createResult?.data?.id || Date.now());
          setRecurringTasks(prev => [{ ...t, id: createdId, status: 'Not Yet Started' } as any, ...prev]);
        }}
        users={users}
        categories={categories}
        firms={firms}
      />
      <UpdateRecurringTaskModal
        isOpen={isRecurringTaskUpdateModalOpen}
        onClose={() => setIsRecurringTaskUpdateModalOpen(false)}
        task={selectedRecurringTask}
        onSave={async (t) => {
          const now = new Date();
          const updatedOn = now.toLocaleDateString('en-GB');
          const timestamp = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
          const existingTask = recurringTasks.find(x => Number(x.id) === Number(t.id));
          const updatedTask = {
            ...t,
            lastUpdatedOn: updatedOn,
            lastUpdateRemarks: t.lastUpdateRemarks,
            goal: existingTask?.goal || ''
          };
          const photos = String((t as any).photos || '');
          const pdf = String((t as any).pdf || '');

          setRecurringTasks(prev => prev.map(x => x.id === t.id ? updatedTask : x));

          // Only patch fields that are actually updated here so we don't accidentally wipe columns
          // (e.g., keep StartDate in the backend sheet unchanged).
          await apiPost('updateMaster', {
            id: t.id,
            status: t.status,
            firm: t.firm || '',
            owner: t.owner || '',
            lastUpdatedOn: updatedOn,
            lastUpdateRemarks: t.lastUpdateRemarks || ''
          }, 'RecurringTasks');

          await apiPost('addMaster', {
            taskId: t.id,
            taskTitle: t.title,
            firm: t.firm || '',
            owner: t.owner || '',
            category: t.category,
            assignee: t.assignee,
            status: t.status,
            updatedOn,
            timestamp,
            remarks: t.lastUpdateRemarks,
            goal: t.goal || '',
            photos,
            pdf
          }, 'RecurringActions');
        }}
      />
	      <EditRecurringTaskModal 
	        isOpen={isEditRecurringTaskModalOpen} 
	        onClose={() => setIsEditRecurringTaskModalOpen(false)} 
	        task={selectedRecurringTask} 
	        onSave={async (t) => { 
	          setRecurringTasks(prev => prev.map(x => x.id === t.id ? t : x)); 
	          await apiPost('updateMaster', t, 'RecurringTasks'); 
	        }} 
	        users={users} 
	        categories={categories} 
	        firms={firms} 
	      />
	      <RecurringTaskHistoryModal isOpen={isRecurringHistoryModalOpen} onClose={() => setIsRecurringHistoryModalOpen(false)} task={selectedRecurringTask} actions={recurringActions} />
	      </LabelProvider>
	    </div>
	  );
}

