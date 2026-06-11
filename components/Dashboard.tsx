import React, { useMemo } from 'react';
import { Plus, UserPlus, Folder, CheckSquare, Clock, AlertTriangle, CheckCircle, Users, Building2, Truck, FileText, RotateCcw, LayoutList, History, ShieldAlert, Tags } from 'lucide-react';
import { StatCard } from './StatCard';
import { QuickAction } from './QuickAction';
import { PendingTable } from './PendingTable';
import { Task, User, Project, ActionLogEntry, RecurringTaskAction, RecurringTask, Category, TableRow, StatusMaster } from '../types';
import { parseToISO } from '../App';
import { useLabels } from '../labelOverrides';

const VENDOR_MODULE_ENABLED = false;

interface DashboardProps {
  isAdmin: boolean;
  onOpenNewTask: () => void;
  onOpenNewRecurringTask: () => void;
  onOpenAddUser: () => void;
  onOpenAddCategory: () => void;
  onOpenAddProject: () => void;
  onOpenAddClient: () => void;
  onOpenAddVendor: () => void;
  onFilterChange: (type: string, value: string) => void;
  onNavigate: (tab: string) => void;
  tasks: Task[];
  users: User[];
  projects: Project[];
  categories: Category[];
  statuses: StatusMaster[];
  actionLogs?: ActionLogEntry[];
  recurringActions?: RecurringTaskAction[];
  recurringTasks?: RecurringTask[];
}

export const Dashboard: React.FC<DashboardProps> = ({
  isAdmin,
  onOpenNewTask, 
  onOpenNewRecurringTask,
  onOpenAddUser,
  onOpenAddCategory,
  onOpenAddProject,
  onOpenAddClient,
  onOpenAddVendor,
  onFilterChange,
  onNavigate,
  tasks, 
  users, 
  projects,
  categories,
  statuses,
  actionLogs = [],
  recurringActions = [],
  recurringTasks = []
}) => {
  const { getFieldLabel } = useLabels();
  const categoryLabel = getFieldLabel('task.category', 'Category');
  
  const stats = useMemo(() => {
    const regularTasks = tasks.filter(t => !t.vendor || t.vendor.trim() === '');
    const totalTasks = regularTasks.length;
    const pendingTasks = regularTasks.filter(t => t.status !== 'Completed').length;

    const todayISO = new Date().toISOString().split('T')[0];
    const overdueTasks = regularTasks.filter(t => {
      if (t.status === 'Completed' || !t.dueDate) return false;
      const dueISO = parseToISO(t.dueDate);
      return dueISO && dueISO < todayISO;
    }).length;

    const completedTasks = regularTasks.filter(t => t.status === 'Completed').length;
    const totalUsers = users.length;
    return { totalTasks, pendingTasks, overdueTasks, completedTasks, totalUsers };
  }, [tasks, users]);

  const dynamicLiveStatuses = useMemo(() => {
    const baseStatuses = statuses
      .map(s => String(s.name || '').trim())
      .filter(Boolean);
    const taskStatuses = Array.from(new Set(tasks.map(t => String(t.status || '').trim()).filter(Boolean)));
    const merged = Array.from(new Set([...baseStatuses, ...taskStatuses]));
    return merged.filter(s => !['completed', 'not yet started', 'in progress', 'started'].includes(s.toLowerCase()));
  }, [statuses, tasks]);

  const dynamicLiveStatusCounts = useMemo(() => {
    const regularTasks = tasks.filter(t => !t.vendor || t.vendor.trim() === '');
    const countMap: Record<string, number> = {};
    dynamicLiveStatuses.forEach(status => {
      countMap[status] = regularTasks.filter(t => String(t.status || '').trim().toLowerCase() === status.toLowerCase()).length;
    });
    return countMap;
  }, [tasks, dynamicLiveStatuses]);

  const dynamicPendingStatuses = useMemo(() => {
    const fromMaster = statuses
      .map(s => String(s.name || '').trim())
      .filter(Boolean)
      .filter(name => name.toLowerCase() !== 'completed');
    const fromTasks = Array.from(
      new Set(
        tasks
          .map(t => String(t.status || '').trim())
          .filter(Boolean)
          .filter(name => name.toLowerCase() !== 'completed')
      )
    );
    const merged = Array.from(new Set([...fromMaster, ...fromTasks]));
    const preferredOrder = ['Not Yet Started', 'In Progress', 'Pending for Client', 'Pending for Owner', 'Pending for Training', 'Pending for Billing', 'Pending for Payment'];
    return merged.sort((a, b) => {
      const ia = preferredOrder.indexOf(a);
      const ib = preferredOrder.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [statuses, tasks]);

  const updateTableDataMap = (map: Map<string, TableRow>, key: string, status: string) => {
    if (!map.has(key)) {
      map.set(key, { name: key, total: 0, notStarted: 0, inProgress: 0, pendingClient: 0, pendingOwner: 0, pendingTraining: 0, pendingBilling: 0, pendingPayment: 0, statusCounts: {} });
    }
    const entry = map.get(key)!;
    entry.total += 1;
    const normalizedStatus = String(status || '').trim();
    if (!entry.statusCounts) entry.statusCounts = {};
    entry.statusCounts[normalizedStatus] = (entry.statusCounts[normalizedStatus] || 0) + 1;
    if (normalizedStatus === 'Not Yet Started') entry.notStarted += 1;
    if (normalizedStatus === 'In Progress' || normalizedStatus === 'Started') entry.inProgress += 1;
    if (normalizedStatus === 'Pending for Client') entry.pendingClient += 1;
    if (normalizedStatus === 'Pending for Owner') entry.pendingOwner += 1;
    if (normalizedStatus === 'Pending for Training') entry.pendingTraining += 1;
    if (normalizedStatus === 'Pending for Billing') entry.pendingBilling += 1;
    if (normalizedStatus === 'Pending for Payment') entry.pendingPayment += 1;
  };

  const assigneeData = useMemo(() => {
    const map = new Map<string, TableRow>();
    tasks.forEach(task => {
      if (!!(task.vendor && task.vendor.trim() !== '')) return; 
      if (task.status === 'Completed') return;
      const assignees = task.assignees ? task.assignees.split(',').map(s => s.trim()) : ['Unassigned'];
      assignees.forEach(assignee => {
        updateTableDataMap(map, assignee, task.status);
      });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  const priorityData = useMemo(() => {
    const map = new Map<string, TableRow>();
    const priorities = ['High', 'Medium', 'Low'];
    priorities.forEach(p => map.set(p, { name: p, total: 0, notStarted: 0, inProgress: 0, pendingClient: 0, pendingOwner: 0, pendingTraining: 0, pendingBilling: 0, pendingPayment: 0 }));

    tasks.forEach(task => {
      if (!!(task.vendor && task.vendor.trim() !== '')) return;
      if (task.status === 'Completed') return;
      const p = task.priority || 'Medium';
      updateTableDataMap(map, p, task.status);
    });
    return Array.from(map.values()).filter(p => p.total > 0);
  }, [tasks]);

  const projectData = useMemo(() => {
    const map = new Map<string, TableRow>();
    tasks.forEach(task => {
      if (!!(task.vendor && task.vendor.trim() !== '')) return;
      if (task.status === 'Completed') return;
      const projectName = task.project || 'Unknown Project';
      const projectObj = projects.find(p => p.name === projectName);
      const displayName = projectObj ? `${projectName} (${projectObj.client})` : projectName;
      updateTableDataMap(map, displayName, task.status);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks, projects]);

  const categoryData = useMemo(() => {
    const map = new Map<string, TableRow>();
    tasks.forEach(task => {
      if (!!(task.vendor && task.vendor.trim() !== '')) return;
      if (task.status === 'Completed') return;
      const categoryName = task.category || 'Uncategorized';
      updateTableDataMap(map, categoryName, task.status);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  const vendorData = useMemo(() => {
    const map = new Map<string, TableRow>();
    tasks.forEach(task => {
      if (!task.vendor || task.vendor.trim() === '') return;
      if (task.status === 'Completed') return;
      const vendor = task.vendor;
      updateTableDataMap(map, vendor, task.status);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  const isoToday = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString('en-CA');
  }, []);

  const dailyUpdates = useMemo(() => {
    const map = new Map<string, number>();
    actionLogs
      .filter(l => {
        if (l.vendor && l.vendor.trim() !== '') return false;
        const logDateStr = parseToISO(l.updateDate);
        return logDateStr === isoToday;
      })
      .forEach(log => {
        const nameStr = log.assignees || log.owner || 'Unknown';
        const names = nameStr.split(',').map(s => s.trim()).filter(Boolean);
        names.forEach(n => map.set(n, (map.get(n) || 0) + 1));
      });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [actionLogs, isoToday]);

  const vendorUpdates = useMemo(() => {
    const map = new Map<string, number>();
    actionLogs
      .filter(l => {
        if (!l.vendor || l.vendor.trim() === '') return false;
        const logDateStr = parseToISO(l.updateDate);
        return logDateStr === isoToday;
      })
      .forEach(log => {
        if (log.vendor) {
          map.set(log.vendor, (map.get(log.vendor) || 0) + 1);
        }
      });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [actionLogs, isoToday]);

  const recurringUpdates = useMemo(() => {
    const map = new Map<string, number>();
    recurringActions
      .filter(a => {
        const actionDateStr = parseToISO(a.updatedOn);
        return actionDateStr === isoToday;
      })
      .forEach(action => {
        if (action.assignee) {
          map.set(action.assignee, (map.get(action.assignee) || 0) + 1);
        }
      });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [recurringActions, isoToday]);

  const dailyKraRows = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const parseDDMMYYYY = (value?: string): Date | null => {
      const raw = String(value || '').trim();
      if (!raw) return null;
      const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
      if (match) {
        const d = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        const y = parseInt(match[3], 10);
        const dt = new Date(y, m - 1, d);
        if (isNaN(dt.getTime())) return null;
        dt.setHours(0, 0, 0, 0);
        return dt;
      }
      const dt = new Date(raw);
      if (isNaN(dt.getTime())) return null;
      dt.setHours(0, 0, 0, 0);
      return dt;
    };

    const clampDay = (year: number, monthIndex: number, day: number): Date => {
      const maxDay = new Date(year, monthIndex + 1, 0).getDate();
      const safeDay = Math.min(Math.max(day, 1), maxDay);
      const date = new Date(year, monthIndex, safeDay);
      date.setHours(0, 0, 0, 0);
      return date;
    };

    const getLastCompletionDateStr = (taskId: number, startDate: string): string => {
      const history = recurringActions
        .filter(a => Number(a.taskId) === taskId && String(a.status || '') === 'Complete')
        .sort((a, b) => {
          const da = parseDDMMYYYY(String(a.updatedOn || ''))?.getTime() || 0;
          const db = parseDDMMYYYY(String(b.updatedOn || ''))?.getTime() || 0;
          return db - da;
        });
      return history.length > 0 ? String(history[0].updatedOn || '') : startDate;
    };

    const getNextDueDateObject = (task: any): Date | null => {
      const periodicity = String(task.periodicity || task.frequencyType || 'Fixed Days').trim() || 'Fixed Days';
      const taskId = Number(task.id || 0);
      if (!taskId) return null;

      const anchorStr = getLastCompletionDateStr(taskId, String(task.startDate || ''));
      const anchor = parseDDMMYYYY(anchorStr);
      if (!anchor) return null;
      anchor.setHours(0, 0, 0, 0);
      const todayRef = new Date(today);

      if (periodicity === 'Fixed Days') {
        const frequencyDays = Math.max(1, Number(task.frequencyDays || 1));
        const next = new Date(anchor);
        do {
          next.setDate(next.getDate() + frequencyDays);
          next.setHours(0, 0, 0, 0);
        } while (next < todayRef);
        return next;
      }

      if (periodicity === 'Weekly') {
        const targetDay = Math.max(0, Math.min(6, Number(task.recurrenceDay ?? 0)));
        let diff = targetDay - anchor.getDay();
        if (diff <= 0) diff += 7;
        const next = new Date(anchor);
        next.setDate(anchor.getDate() + diff);
        next.setHours(0, 0, 0, 0);
        while (next < todayRef) {
          next.setDate(next.getDate() + 7);
          next.setHours(0, 0, 0, 0);
        }
        return next;
      }

      if (periodicity === 'Monthly') {
        const targetDay = Math.max(1, Number(task.recurrenceDay ?? 1));
        let year = anchor.getFullYear();
        let month = anchor.getMonth();
        let next = clampDay(year, month, targetDay);
        if (next <= anchor) {
          month += 1;
          next = clampDay(year, month, targetDay);
        }
        while (next < todayRef) {
          month += 1;
          next = clampDay(year, month, targetDay);
        }
        return next;
      }

      if (periodicity === 'Yearly') {
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const foundMonth = months.indexOf(String(task.recurrenceMonth || 'January'));
        const targetMonthIdx = foundMonth >= 0 ? foundMonth : 0;
        const targetDay = Math.max(1, Number(task.recurrenceDay ?? 1));
        let year = anchor.getFullYear();
        let next = clampDay(year, targetMonthIdx, targetDay);
        if (next <= anchor) {
          year += 1;
          next = clampDay(year, targetMonthIdx, targetDay);
        }
        while (next < todayRef) {
          year += 1;
          next = clampDay(year, targetMonthIdx, targetDay);
        }
        return next;
      }

      return null;
    };

    const dueTodayOrOverdue = recurringTasks.filter(task => {
      const nextDue = getNextDueDateObject(task);
      if (!nextDue) return false;
      nextDue.setHours(0, 0, 0, 0);
      return nextDue.getTime() <= today.getTime();
    });

    const byEmployee = new Map<string, { goal: number; achieved: number }>();

    dueTodayOrOverdue.forEach(task => {
      const employeeName = String(task.assignee || '-').trim() || '-';
      const rawGoal = Number(task.goal || 0);
      const effectiveGoal = rawGoal > 0 ? rawGoal : 1;

      const actionsToday = recurringActions.filter(
        a => Number(a.taskId) === Number(task.id) && parseToISO(a.updatedOn) === isoToday
      );
      const achievedFromActions = actionsToday.reduce((sum, a) => sum + Number(a.goal || 0), 0);

      // For tasks without a numeric Goal, treat "Achieved" as 1 only if an update was logged today.
      const effectiveAchieved = rawGoal > 0 ? achievedFromActions : (actionsToday.length > 0 ? 1 : 0);

      if (!byEmployee.has(employeeName)) {
        byEmployee.set(employeeName, { goal: 0, achieved: 0 });
      }
      const row = byEmployee.get(employeeName)!;
      row.goal += effectiveGoal;
      row.achieved += effectiveAchieved;
    });

    return Array.from(byEmployee.entries()).map(([employeeName, values]) => {
      const achievedPercent = values.goal > 0 ? ((values.achieved / values.goal) * 100).toFixed(2) + '%' : '0%';
      return {
        employeeName,
        goal: values.goal,
        achieved: values.achieved,
        achievedPercent
      };
    });
  }, [recurringTasks, recurringActions, isoToday]);

  const SectionHeader = ({ title, icon }: { title: string; icon: React.ReactNode }) => (
    <div className="flex items-center gap-2 mb-4">
        <span className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">{icon}</span>
        <h3 className="text-lg font-black text-blue-800 uppercase tracking-tight">{title}</h3>
    </div>
  );

  return (
    <div className="space-y-8 pb-10">
      {/* Centered Dashboard Title as requested */}
      <div className="flex flex-col items-center justify-center pt-2">
        <h2 className="text-3xl font-black text-blue-700 uppercase tracking-[0.1em]">Task Dashboard</h2>
        <div className="w-64 h-1 bg-blue-600 mt-2 rounded-full"></div>
      </div>

	      {isAdmin && (
	        <div className="bg-sky-50 p-6 rounded-2xl shadow-md border-2 border-blue-300">
	          <SectionHeader title="Quick Control" icon={<LayoutList size={20}/>} />
	          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
		            <QuickAction label="Simple Task" icon={<Plus size={18} />} colorClass="bg-blue-600 hover:bg-blue-700 text-white" onClick={onOpenNewTask}/>
		            <QuickAction label="New Recurring Task" icon={<RotateCcw size={18} />} colorClass="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={onOpenNewRecurringTask}/>
	            <QuickAction label="Add User" icon={<UserPlus size={18} />} colorClass="bg-indigo-500 hover:bg-indigo-600 text-white" onClick={onOpenAddUser}/>
              <QuickAction label={`Add ${categoryLabel}`} icon={<Tags size={18} />} colorClass="bg-violet-500 hover:bg-violet-600 text-white" onClick={onOpenAddCategory}/>
	            {VENDOR_MODULE_ENABLED && (
	              <QuickAction label="Add Vendor" icon={<Truck size={18} />} colorClass="bg-orange-500 hover:bg-orange-600 text-white" onClick={onOpenAddVendor}/>
	            )}
	          </div>
	        </div>
	      )}

      <div className="bg-blue-50/70 p-6 rounded-2xl border-2 border-blue-300 shadow-sm">
        <SectionHeader title="Live Statistics" icon={<Clock size={20}/>} />
	        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-10 gap-4">
	            <StatCard title="Total Tasks" value={stats.totalTasks} icon={<CheckSquare size={20}/>} iconBgColor="bg-blue-100" iconColor="text-blue-600" onClick={() => onNavigate('all-tasks')} />
	            <StatCard title="Pending" value={stats.pendingTasks} icon={<Clock size={20}/>} iconBgColor="bg-amber-100" iconColor="text-amber-600" onClick={() => onNavigate('pending')}/>
              {dynamicLiveStatuses.map((status) => (
                <StatCard
                  key={status}
                  title={status}
                  value={dynamicLiveStatusCounts[status] || 0}
                  icon={<Tags size={20}/>}
                  iconBgColor="bg-indigo-100"
                  iconColor="text-indigo-600"
                  onClick={() => onFilterChange('status', status)}
                />
              ))}
	            <StatCard title="Overdue" value={stats.overdueTasks} icon={<AlertTriangle size={20}/>} iconBgColor="bg-red-100" iconColor="text-red-600" onClick={() => onFilterChange('status', 'Overdue')}/>
	            <StatCard title="Completed" value={stats.completedTasks} icon={<CheckCircle size={20}/>} iconBgColor="bg-green-100" iconColor="text-green-600" onClick={() => onNavigate('completed')}/>
	            <StatCard title="Total Users" value={stats.totalUsers} icon={<Users size={20}/>} iconBgColor="bg-indigo-100" iconColor="text-indigo-600" onClick={isAdmin ? () => onNavigate('users') : undefined}/>
	        </div>
	      </div>

      <div className="space-y-6">
        <SectionHeader title="Today's Activity" icon={<History size={20}/>} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="bg-white p-5 rounded-2xl border-2 border-blue-200 shadow-sm flex flex-col">
              <div className="flex items-center gap-2 mb-4 border-b border-blue-50 pb-2">
                 <Users size={18} className="text-indigo-600" />
                 <h4 className="text-sm font-black text-indigo-900 uppercase">Employee Updates</h4>
              </div>
              <div className="flex-1 space-y-2 max-h-[300px] overflow-y-auto pr-1">
                 {dailyUpdates.map(u => (
                    <div key={u.name} onClick={() => onFilterChange('employee-log', u.name)} className="flex items-center justify-between p-2.5 hover:bg-indigo-50 rounded-xl cursor-pointer transition-colors border border-indigo-100 bg-indigo-50/10 shadow-sm">
                       <span className="text-xs font-bold text-indigo-900">{u.name}</span>
                       <span className="bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-full font-black shadow-sm">{u.count}</span>
                    </div>
                 ))}
                 {dailyUpdates.length === 0 && (
                   <div className="flex flex-col items-center justify-center py-8 opacity-40">
                      <Clock size={32} className="text-gray-300 mb-2" />
                      <p className="text-[10px] text-gray-500 italic text-center uppercase font-bold tracking-widest">No employee activity today</p>
                   </div>
                 )}
              </div>
           </div>

	           {VENDOR_MODULE_ENABLED && (
	             <div className="bg-white p-5 rounded-2xl border-2 border-orange-200 shadow-sm flex flex-col">
	                <div className="flex items-center gap-2 mb-4 border-b border-orange-50 pb-2">
	                   <Truck size={18} className="text-orange-600" />
	                   <h4 className="text-sm font-black text-orange-900 uppercase">Vendor Updates</h4>
	                </div>
	                <div className="flex-1 space-y-2 max-h-[300px] overflow-y-auto pr-1">
	                   {vendorUpdates.map(u => (
	                      <div key={u.name} onClick={() => onFilterChange('vendor-log', u.name)} className="flex items-center justify-between p-2.5 hover:bg-orange-50 rounded-xl cursor-pointer transition-colors border border-orange-100 bg-orange-50/10 shadow-sm">
	                         <span className="text-xs font-bold text-orange-900">{u.name}</span>
	                         <span className="bg-orange-600 text-white text-[10px] px-2 py-0.5 rounded-full font-black shadow-sm">{u.count}</span>
	                      </div>
	                   ))}
	                   {vendorUpdates.length === 0 && (
	                      <div className="flex flex-col items-center justify-center py-8 opacity-40">
	                        <Clock size={32} className="text-gray-300 mb-2" />
	                        <p className="text-[10px] text-gray-500 italic text-center uppercase font-bold tracking-widest">No vendor activity today</p>
	                     </div>
	                   )}
	                </div>
	             </div>
	           )}

           <div className="bg-white p-5 rounded-2xl border-2 border-emerald-200 shadow-sm flex flex-col">
              <div className="flex items-center gap-2 mb-4 border-b border-emerald-50 pb-2">
                 <RotateCcw size={18} className="text-emerald-600" />
                 <h4 className="text-sm font-black text-emerald-900 uppercase">Recurring Updates</h4>
              </div>
              <div className="flex-1 space-y-2 max-h-[300px] overflow-y-auto pr-1">
                 {recurringUpdates.map(u => (
                    <div key={u.name} onClick={() => onFilterChange('recurring-log', u.name)} className="flex items-center justify-between p-2.5 hover:bg-emerald-50 rounded-xl cursor-pointer transition-colors border border-emerald-100 bg-emerald-50/10 shadow-sm">
                       <span className="text-xs font-bold text-emerald-900">{u.name}</span>
                       <span className="bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded-full font-black shadow-sm">{u.count}</span>
                    </div>
                 ))}
                 {recurringUpdates.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 opacity-40">
                      <Clock size={32} className="text-gray-300 mb-2" />
                      <p className="text-[10px] text-gray-500 italic text-center uppercase font-bold tracking-widest">No recurring updates today</p>
                   </div>
                 )}
              </div>
           </div>
          <div className="bg-white p-5 rounded-2xl border-2 border-sky-200 shadow-sm">
	          <div className="flex items-center gap-2 mb-4 border-b border-sky-50 pb-2">
	            <History size={18} className="text-sky-600" />
	            <h4 className="text-sm font-black text-sky-900 uppercase">Daily KRA Tracker</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-sky-600">
                  <th className="px-4 py-2 text-xs font-bold text-white uppercase">Employee Name</th>
                  <th className="px-4 py-2 text-xs font-bold text-white uppercase">Goal</th>
                  <th className="px-4 py-2 text-xs font-bold text-white uppercase">Achived</th>
                  <th className="px-4 py-2 text-xs font-bold text-white uppercase">Achived%</th>
                </tr>
              </thead>
              <tbody>
                {dailyKraRows.map((row, idx) => (
                  <tr key={`${row.employeeName}-${idx}`} className="border-b border-sky-100">
                    <td className="px-4 py-2 text-sm">{row.employeeName}</td>
                    <td className="px-4 py-2 text-sm">{row.goal}</td>
                    <td className="px-4 py-2 text-sm">{row.achieved}</td>
                    <td className="px-4 py-2 text-sm">{row.achievedPercent}</td>
                  </tr>
                ))}
                {dailyKraRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">No recurring tasks due today.</td>
                  </tr>
                )}
              </tbody>
	            </table>
	          </div>
	        </div>
	        </div>
	      </div>

	      <div className="grid grid-cols-1 gap-8">
	        <PendingTable title="Pending by Assignee" headerLabel="Assignee Name" data={assigneeData} onRowClick={(name) => onFilterChange('assignee', name)} statusColumns={dynamicPendingStatuses}/>
	        <PendingTable title="Pending by Priority" headerLabel="Priority Level" data={priorityData} onRowClick={(name) => onFilterChange('priority', name)} className="bg-indigo-50/30" statusColumns={dynamicPendingStatuses}/>
		        <PendingTable title={`Pending by ${categoryLabel}`} headerLabel={`${categoryLabel} Name`} data={categoryData} onRowClick={(name) => onFilterChange('category', name)} className="bg-indigo-50/30" statusColumns={dynamicPendingStatuses}/>
	        {VENDOR_MODULE_ENABLED && (
	          <PendingTable title="Pending by Vendor" headerLabel="Vendor Name" data={vendorData} onRowClick={(name) => onFilterChange('vendor', name)} className="bg-orange-50/30" statusColumns={dynamicPendingStatuses}/>
	        )}
	      </div>
    </div>
  );
};
