import React, { useEffect, useMemo, useState } from 'react';
import { ActivitySummary } from './ActivitySummary';
import {createPortal} from 'react-dom';
import {dashboardToday, isDelayedTask, taskAssignees} from './dashboardRules.mjs';
import { Plus, UserPlus, Folder, CheckSquare, Clock, AlertTriangle, CheckCircle, Users, Building2, Truck, FileText, RotateCcw, LayoutList, History, ShieldAlert, Tags } from 'lucide-react';
import { StatCard } from './StatCard';
import { QuickAction } from './QuickAction';
import { PendingTable } from './PendingTable';
import { Task, User, Project, ActionLogEntry, RecurringTaskAction, RecurringTask, Category, TableRow, StatusMaster } from '../types';
import { parseToISO } from '../App';
import { useLabels } from '../labelOverrides';

const VENDOR_MODULE_ENABLED = false;

interface DashboardProps {
  onOpenActivityLogs: (name: string, from: string, to: string) => void;
  isAdmin: boolean;
  quickControlsHidden?: boolean;
  onOpenNewTask: () => void;
  onOpenNewRecurringTask: () => void;
  onOpenAddUser: () => void;
  onOpenAddCategory: () => void;
  onOpenAddProject: () => void;
  onOpenAddClient: () => void;
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
  onOpenActivityLogs,
  isAdmin,
  quickControlsHidden=false,
  onOpenNewTask, 
  onOpenNewRecurringTask,
  onOpenAddUser,
  onOpenAddCategory,
  onOpenAddProject,
  onOpenAddClient,
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
  const [isoToday,setIsoToday]=useState(()=>dashboardToday());
  useEffect(()=>{const id=window.setInterval(()=>setIsoToday(dashboardToday()),30000);return()=>window.clearInterval(id);},[]);
  
  const stats = useMemo(() => {
    const regularTasks = tasks.filter(t => !t.vendor || t.vendor.trim() === '');
    const totalTasks = regularTasks.length;
    const pendingTasks = regularTasks.filter(t => t.status !== 'Completed').length;

    const todayISO = isoToday;
    const overdueTasks = regularTasks.filter(t => {
      if (t.status === 'Completed' || !t.dueDate) return false;
      return isDelayedTask(t,todayISO);
    }).length;

    const completedTasks = regularTasks.filter(t => t.status === 'Completed').length;
    const totalUsers = users.length;
    return { totalTasks, pendingTasks, overdueTasks, completedTasks, totalUsers };
  }, [tasks, users, isoToday]);

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
      const assignees = taskAssignees(task.assignees);
      assignees.forEach(assignee => {
        updateTableDataMap(map, assignee, task.status);
      });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  const delayedData=useMemo(()=>{
    const map=new Map<string,TableRow>();
    tasks.filter(task=>isDelayedTask(task,isoToday)).forEach(task=>{
      taskAssignees(task.assignees).forEach(name=>updateTableDataMap(map,name,task.status));
    });
    return Array.from(map.values()).sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name));
  },[tasks,isoToday]);

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
          taskAssignees(action.assignee).forEach(name=>map.set(name,(map.get(name)||0)+1));
        }
      });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [recurringActions, isoToday]);

  const activityRows=useMemo(()=>{
    const map=new Map<string,{name:string;simple:number;recurring:number;total:number}>();
    const add=(name:string,count:number,key:'simple'|'recurring')=>{
      const row=map.get(name)||{name,simple:0,recurring:0,total:0};row[key]+=count;row.total+=count;map.set(name,row);
    };
    dailyUpdates.forEach(row=>add(row.name,row.count,'simple'));
    recurringUpdates.forEach(row=>add(row.name,row.count,'recurring'));
    return Array.from(map.values()).sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name));
  },[dailyUpdates,recurringUpdates]);

  const SectionHeader = ({ title, icon }: { title: string; icon: React.ReactNode }) => (
    <div className="flex items-center gap-2 mb-4">
        <span className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">{icon}</span>
        <h3 className="text-lg font-black text-blue-800 uppercase tracking-tight">{title}</h3>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 md:gap-8 pb-6 md:pb-10">
      {/* Centered Dashboard Title as requested */}
      <div className="hidden md:flex flex-col items-center justify-center pt-2">
        <h2 className="text-3xl font-black text-blue-700 uppercase tracking-[0.1em]">Task Dashboard</h2>
        <div className="w-64 h-1 bg-blue-600 mt-2 rounded-full"></div>
      </div>

	      {isAdmin && (
	        <div className="hidden md:block bg-sky-50 p-6 rounded-2xl shadow-md border-2 border-blue-300">
	          <SectionHeader title="Quick Control" icon={<LayoutList size={20}/>} />
	          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
		            <QuickAction label="Simple Task" icon={<Plus size={18} />} colorClass="bg-blue-600 hover:bg-blue-700 text-white" onClick={onOpenNewTask}/>
		            <QuickAction label="New Recurring Task" icon={<RotateCcw size={18} />} colorClass="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={onOpenNewRecurringTask}/>
	            <QuickAction label="Add User" icon={<UserPlus size={18} />} colorClass="bg-indigo-500 hover:bg-indigo-600 text-white" onClick={onOpenAddUser}/>
              <QuickAction label={`Add ${categoryLabel}`} icon={<Tags size={18} />} colorClass="bg-violet-500 hover:bg-violet-600 text-white" onClick={onOpenAddCategory}/>
	            
	          </div>
	        </div>
	      )}

      <div className="hidden md:block bg-blue-50/70 p-6 rounded-2xl border-2 border-blue-300 shadow-sm">
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

      <div className="hidden md:block space-y-6">
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
          
	        </div>
	      </div>

	      <div className="order-first md:order-none grid grid-cols-1 gap-4 md:gap-8">
            <PendingTable title="Delayed Pending Tasks by Assignee" headerLabel="Assignee Name" totalLabel="Total Delayed" emptyMessage="No delayed pending tasks." data={delayedData} onRowClick={name=>onFilterChange('delayed-assignee',name)} statusColumns={dynamicPendingStatuses}/>
	        <PendingTable title="Pending by Assignee" headerLabel="Assignee Name" data={assigneeData} onRowClick={(name) => onFilterChange('assignee', name)} statusColumns={dynamicPendingStatuses}/>
	        <PendingTable title="Pending by Priority" headerLabel="Priority Level" data={priorityData} onRowClick={(name) => onFilterChange('priority', name)} className="bg-indigo-50/30" statusColumns={dynamicPendingStatuses}/>
		        <PendingTable title={`Pending by ${categoryLabel}`} headerLabel={`${categoryLabel} Name`} data={categoryData} onRowClick={(name) => onFilterChange('category', name)} className="bg-indigo-50/30" statusColumns={dynamicPendingStatuses}/>
	        
	      </div>
      <section aria-label="Today's Activity" className="md:hidden min-w-0 rounded-xl border-2 border-blue-200 overflow-hidden bg-white">
        <h3 className="p-3 font-bold text-blue-700 uppercase">Today's Activity</h3>
        <div className="overflow-x-auto"><table className="w-full table-fixed text-xs">
          <colgroup><col style={{width:'40%'}}/><col style={{width:'20%'}}/><col style={{width:'20%'}}/><col style={{width:'20%'}}/></colgroup>
          <thead className="bg-indigo-600 text-white"><tr>{['User','Simple Updates','Recurring Updates','Total'].map(title=><th key={title} className="px-1 py-2 text-[10px] leading-tight whitespace-normal break-normal">{title}</th>)}</tr></thead>
          <tbody>{activityRows.map(row=><tr key={row.name}><td className="p-2 break-words font-semibold">{row.name}</td><td className="px-1 py-2 text-center tabular-nums"><button type="button" disabled={!row.simple} aria-label={'Simple updates by '+row.name} className="text-blue-700 font-bold disabled:text-gray-500" onClick={()=>onFilterChange('employee-log',row.name)}>{row.simple}</button></td><td className="px-1 py-2 text-center tabular-nums"><button type="button" disabled={!row.recurring} aria-label={'Recurring updates by '+row.name} className="text-blue-700 font-bold disabled:text-gray-500" onClick={()=>onFilterChange('recurring-log',row.name)}>{row.recurring}</button></td><td className="px-1 py-2 text-center font-bold tabular-nums">{row.total}</td></tr>)}{!activityRows.length&&<tr><td colSpan={4} className="px-3 py-2 text-center text-xs text-gray-500">No activity today.</td></tr>}</tbody>
        </table></div>
      </section>
      <ActivitySummary logs={actionLogs.filter(log=>!log.vendor || log.vendor==='')} today={isoToday} onOpenLogs={onOpenActivityLogs}/>
      {!quickControlsHidden&&createPortal(<nav aria-label="Quick Control" className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-indigo-200 shadow-[0_-2px_10px_rgba(0,0,0,0.08)]" style={{paddingBottom:'env(safe-area-inset-bottom, 0px)'}}>
        <div className={'grid '+(isAdmin?'grid-cols-4':'grid-cols-2')}>
          {[{label:'Task',title:'Add Simple Task',icon:<Plus size={22}/>,action:onOpenNewTask},{label:'Recurring',title:'Add Recurring Task',icon:<RotateCcw size={22}/>,action:onOpenNewRecurringTask},...(isAdmin?[{label:'User',title:'Add User',icon:<UserPlus size={22}/>,action:onOpenAddUser},{label:categoryLabel,title:'Add '+categoryLabel,icon:<Tags size={22}/>,action:onOpenAddCategory}]:[])].map(item=><button type="button" key={item.title} aria-label={item.title} className="min-h-[64px] px-1 py-2 flex flex-col items-center justify-center gap-1 text-indigo-700 active:bg-indigo-50" onClick={item.action}>{item.icon}<span className="text-[11px] font-semibold leading-tight text-center">{item.label}</span></button>)}
        </div>
      </nav>,document.body)}
    </div>
  );
};
