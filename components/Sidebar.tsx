import React, { useEffect, useState } from 'react';
import { NavItem } from '../types';
import { X, LogOut, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

interface SidebarProps {
  items: NavItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  onLayoutChange: (mode: 'side' | 'top') => void;
  layoutMode: 'side' | 'top';
  isOpen?: boolean;
  onClose?: () => void;
  lastSynced?: Date | null;
  isSyncing?: boolean;
  onSync?: (loading: boolean) => void;
  className?: string;
  hasError?: boolean;
  onLogout?: () => void;
  onExitWorkspace?: () => void;
  workspaceId?: string;
  brandName?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  items, 
  activeTab, 
  onTabChange, 
  onLayoutChange, 
  layoutMode,
  isOpen = false, 
  onClose,
  lastSynced,
  isSyncing,
  onSync,
  className = '',
  hasError = false,
  onLogout,
  onExitWorkspace,
  workspaceId,
  brandName = 'TaskPro'
}) => {
  const [openPendingGroup, setOpenPendingGroup] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    Dashboard: false,
    'Simple Tasks': false,
    Master: false,
    'Recurring Tasks': false,
    Documentation: false,
    Vendor: false,
  });

  const pendingChildIds = React.useMemo(
    () => items
      .filter(item => item.section === 'Tasks' && (item.id === 'pending' || item.id.startsWith('pending-status:')))
      .map(item => item.id),
    [items]
  );

  useEffect(() => {
    if (pendingChildIds.includes(activeTab)) {
      setOpenPendingGroup(true);
    }
  }, [activeTab, pendingChildIds]);

  useEffect(() => {
    const activeItem = items.find(item => item.id === activeTab);
    const activeSection = activeItem?.section || 'main';
    const sectionLabel = activeSection === 'main' ? 'Dashboard' : (activeSection === 'Tasks' ? 'Simple Tasks' : activeSection);
    setOpenSections({
      Dashboard: sectionLabel === 'Dashboard',
      Master: sectionLabel === 'Master',
      'Simple Tasks': sectionLabel === 'Simple Tasks',
      'Recurring Tasks': sectionLabel === 'Recurring Tasks',
      Documentation: sectionLabel === 'Documentation',
      Vendor: sectionLabel === 'Vendor',
    });
  }, [activeTab, items]);

  const groupedItems = items.reduce((acc, item) => {
    const section = item.section || 'main';
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {} as Record<string, NavItem[]>);

  const renderCount = (item: NavItem, active: boolean) => {
    if (typeof item.count !== 'number') return null;
    return (
      <span className={`min-w-[2rem] rounded-full px-2 py-0.5 text-center text-xs font-bold ${active ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-700 group-hover:bg-white/20 group-hover:text-white'}`}>
        {item.count}
      </span>
    );
  };

  const NavButton = ({ item, isChild = false }: { item: NavItem; isChild?: boolean }) => {
    const isActive = activeTab === item.id;
    const hideEverywhere = item.id === 'add-multiple' || item.id === 'update-multiple';
    return (
      <button
        onClick={() => {
          onTabChange(item.id);
          if (window.innerWidth < 768 && onClose) onClose();
        }}
        className={`group w-full ${hideEverywhere ? 'hidden' : 'flex'} items-center gap-3 ${isChild ? 'pl-12 pr-4 py-2' : 'px-4 py-2.5'} rounded-md text-sm font-medium ml-2 border-l-2 
          ${isActive 
            ? 'bg-indigo-600 border-indigo-700 text-white shadow-sm' 
            : 'border-transparent text-indigo-600 hover:bg-indigo-600 hover:text-white'
          }`}
      >
        {!isChild && (
          <span className={`flex-shrink-0 ${isActive ? 'text-white' : 'text-indigo-600 group-hover:text-white'}`}>
            {item.icon}
          </span>
        )}
        <span className="text-left leading-tight flex-1">{item.label}</span>
        {renderCount(item, isActive)}
      </button>
    );
  };

  const renderTasksSection = () => {
    const taskItems: NavItem[] = (groupedItems['Tasks'] || []) as NavItem[];
    const itemMap = new Map<string, NavItem>(taskItems.map(item => [item.id, item]));
    const topLevelItems = taskItems.filter(item => !pendingChildIds.includes(item.id));
    const pendingGroupItem = itemMap.get('pending-group');
    const isPendingGroupActive = pendingChildIds.includes(activeTab);

    return topLevelItems.map(item => {
      if (item.id !== 'pending-group') {
        return <li key={item.id}><NavButton item={item} /></li>;
      }

      if (!pendingGroupItem) return null;

      return (
        <li key={item.id}>
          <button
            onClick={() => setOpenPendingGroup(prev => !prev)}
            className={`group w-full flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium ml-2 border-l-2 ${isPendingGroupActive || openPendingGroup ? 'bg-red-600 border-red-700 text-white shadow-sm' : 'border-transparent text-red-700 bg-red-50 hover:bg-red-600 hover:text-white'}`}
          >
            <span className={`flex-shrink-0 ${isPendingGroupActive || openPendingGroup ? 'text-white' : 'text-red-500 group-hover:text-white'}`}>
              {pendingGroupItem.icon}
            </span>
            <span className="text-left leading-tight flex-1">{pendingGroupItem.label}</span>
            <div className="flex items-center gap-2 shrink-0">
              {renderCount(pendingGroupItem, isPendingGroupActive || openPendingGroup)}
              {openPendingGroup ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </button>
          {openPendingGroup && (
            <ul className="mt-1 space-y-1">
              {pendingChildIds.map(id => {
                const childItem = itemMap.get(id);
                return childItem ? <li key={childItem.id}><NavButton item={childItem} isChild={true} /></li> : null;
              })}
            </ul>
          )}
        </li>
      );
    });
  };

  return (
    <>
      <aside className={`
        w-64 bg-blue-50 h-screen shadow-lg flex flex-col flex-shrink-0 z-[80] border-r border-blue-100
        fixed md:relative inset-y-0 left-0 transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        ${className}
      `}>
        <div className="p-4 border-b-2 border-indigo-500 flex flex-col bg-white/40">
          <div className="flex justify-between items-center w-full">
            <a 
              href="https://bizskilledu.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center space-x-2 w-full overflow-hidden group hover:opacity-80"
            >
              <img 
                src="https://i.ibb.co/YBSjM7Gg/Chat-GPT-Image-Dec-18-2025-10-23-18-AM.png" 
                className="h-10 w-10 object-contain flex-shrink-0" 
                alt="TaskPro Logo" 
              />
              <div className="flex flex-col min-w-0 flex-1">
                <h1 className="text-xl font-bold text-indigo-600 leading-tight whitespace-normal break-words">{brandName}</h1>
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest group-hover:text-indigo-500">BIZSKILL</span>
              </div>
            </a>
            <button 
              onClick={onClose} 
              className="md:hidden p-2 text-gray-500 hover:bg-blue-100 rounded-full flex-shrink-0"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          {[
            { key: 'Dashboard', source: 'main' },
            { key: 'Master', source: 'Master' },
            { key: 'Simple Tasks', source: 'Tasks' },
            { key: 'Recurring Tasks', source: 'Recurring Tasks' },
            { key: 'Documentation', source: 'Documentation' },
            ...(groupedItems['Vendor'] ? [{ key: 'Vendor', source: 'Vendor' }] : [])
          ].map(sectionInfo => {
            const sectionItems = groupedItems[sectionInfo.source] || [];
            if (sectionItems.length === 0) return null;
            const isOpenSection = !!openSections[sectionInfo.key];
            return (
              <div key={sectionInfo.key} className="mb-2 px-3">
                <button
                  type="button"
                  onClick={() =>
                    setOpenSections(prev => {
                      const willOpen = !prev[sectionInfo.key];
                      return {
                        Dashboard: false,
                        Master: false,
                        'Simple Tasks': false,
                        'Recurring Tasks': false,
                        Documentation: false,
                        Vendor: false,
                        [sectionInfo.key]: willOpen,
                      };
                    })
                  }
                  className="w-full px-4 py-2 mb-1 flex items-center justify-between text-indigo-600 hover:bg-indigo-100/60 rounded-md"
                >
                  <span className="text-xs font-bold uppercase tracking-wider">{sectionInfo.key}</span>
                  {isOpenSection ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {isOpenSection && (
                  <ul className="space-y-1">
                    {sectionInfo.source === 'Tasks'
                      ? renderTasksSection()
                      : sectionItems.map(item => <li key={item.id}><NavButton item={item} /></li>)}
                  </ul>
                )}
                <div className="mx-4 my-2 border-b border-indigo-200"></div>
              </div>
            );
          })}
        </nav>

        <div className="hidden md:block p-4 bg-white/50 border-t-2 border-indigo-500 space-y-3 mt-auto">

          <div className="grid grid-cols-2 gap-2">
            <button onClick={onLogout} className="flex items-center justify-center gap-2 py-2 text-xs font-bold text-indigo-600 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50">
              <LogOut size={14} />
              Logout
            </button>
            <button onClick={onExitWorkspace} className="flex items-center justify-center gap-2 py-2 text-xs font-bold text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50">
              <ExternalLink size={14} />
              Exit
            </button>
          </div>
        </div>

        <div className="md:hidden p-4 bg-white/50 border-t-2 border-indigo-500 mt-auto">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={onLogout} className="flex items-center justify-center gap-2 py-2 text-xs font-bold text-indigo-600 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50">
              <LogOut size={14} />
              Logout
            </button>
            <button onClick={onExitWorkspace} className="flex items-center justify-center gap-2 py-2 text-xs font-bold text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50">
              <ExternalLink size={14} />
              Exit
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

