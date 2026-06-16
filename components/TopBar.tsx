import React, { useMemo, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NavItem } from '../types';
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

interface TopBarProps {
  items: NavItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  onLayoutChange: (mode: 'side' | 'top') => void;
  layoutMode: 'side' | 'top';
  lastSynced?: Date | null;
  isSyncing?: boolean;
  onSync?: (loading: boolean) => void;
  hasError?: boolean;
  brandName?: string;
}

export const TopBar: React.FC<TopBarProps> = ({ 
  items, 
  activeTab, 
  onTabChange, 
  onLayoutChange,
  layoutMode,
  lastSynced,
  isSyncing,
  onSync,
  hasError = false,
  brandName = 'TaskPro'
}) => {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [openPendingGroup, setOpenPendingGroup] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownPortalRef = useRef<HTMLDivElement>(null);
  const dropdownAnchorRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const pendingChildIds = useMemo(
    () => items
      .filter(item => item.section === 'Tasks' && (item.id === 'pending' || item.id.startsWith('pending-status:')))
      .map(item => item.id),
    [items]
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedTopBar = dropdownRef.current?.contains(target);
      const clickedDropdown = dropdownPortalRef.current?.contains(target);
      if (!clickedTopBar && !clickedDropdown) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (pendingChildIds.includes(activeTab)) {
      setOpenPendingGroup(true);
    }
  }, [activeTab, pendingChildIds]);

  useEffect(() => {
    if (!openDropdown) {
      setDropdownPos(null);
      return;
    }

    const anchor = dropdownAnchorRefs.current[openDropdown];
    if (!anchor) return;

    const compute = () => {
      const rect = anchor.getBoundingClientRect();
      const width = 288; // Tailwind w-72
      const marginTop = 8; // mt-2

      let left = rect.left;
      const maxLeft = Math.max(8, window.innerWidth - width - 8);
      left = Math.min(Math.max(8, left), maxLeft);

      setDropdownPos({ top: rect.bottom + marginTop, left, width });
    };

    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
  }, [openDropdown]);

  const groupedItems = items.reduce((acc, item) => {
    const section = item.section || 'main';
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {} as Record<string, NavItem[]>);

  const toggleDropdown = (section: string) => {
    setOpenDropdown(openDropdown === section ? null : section);
  };

  const handleItemClick = (id: string) => {
    onTabChange(id);
    setOpenDropdown(null);
  };

  const isSectionActive = (section: string) => {
    if (!groupedItems[section]) return false;
    return groupedItems[section].some(item => item.id === activeTab);
  };

  const renderCount = (item: NavItem, active: boolean, inactiveClass: string) => {
    if (typeof item.count !== 'number') return null;
    return (
      <span className={`min-w-[2rem] rounded-full px-2 py-0.5 text-center text-xs font-bold ${active ? 'bg-white/20 text-white' : inactiveClass}`}>
        {item.count}
      </span>
    );
  };

  const renderDropdownButton = (item: NavItem, isChild = false) => {
    const isActive = activeTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => handleItemClick(item.id)}
        className={`w-full text-left ${isChild ? 'pl-14 pr-5 py-2.5' : 'px-5 py-3'} text-sm flex items-center justify-between gap-3 ${isActive ? 'text-white bg-indigo-600' : 'text-indigo-700 hover:bg-blue-100 hover:text-indigo-900'}`}
      >
        <div className="flex items-center gap-4 min-w-0">
          {!isChild && <span className={`shrink-0 ${isActive ? 'text-white' : 'text-indigo-500'}`}>{item.icon}</span>}
          <span className="font-medium truncate">{item.label}</span>
        </div>
        {renderCount(item, isActive, 'bg-white text-indigo-700')}
      </button>
    );
  };

  const renderTasksDropdown = () => {
    const taskItems: NavItem[] = (groupedItems['Tasks'] || []) as NavItem[];
    const itemMap = new Map<string, NavItem>(taskItems.map(item => [item.id, item]));
    const topLevelItems = taskItems.filter(item => !pendingChildIds.includes(item.id));
    const pendingGroupItem = itemMap.get('pending-group');

    return topLevelItems.map(item => {
      if (item.id !== 'pending-group') {
        return renderDropdownButton(item);
      }

      if (!pendingGroupItem) return null;

      const isGroupActive = pendingChildIds.includes(activeTab);
      return (
        <div key={item.id}>
          <button
            onClick={() => setOpenPendingGroup(prev => !prev)}
            className={`w-full text-left px-5 py-3 text-sm flex items-center justify-between gap-3 ${isGroupActive || openPendingGroup ? 'text-white bg-red-600' : 'text-red-700 bg-red-50 hover:bg-red-100 hover:text-red-900'}`}
          >
            <div className="flex items-center gap-4 min-w-0">
              <span className={`shrink-0 ${isGroupActive || openPendingGroup ? 'text-white' : 'text-red-500'}`}>{pendingGroupItem.icon}</span>
              <span className="font-medium truncate">{pendingGroupItem.label}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {renderCount(pendingGroupItem, isGroupActive || openPendingGroup, 'bg-white text-red-700')}
              {openPendingGroup ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </button>
          {openPendingGroup && pendingChildIds.map(id => {
            const childItem = itemMap.get(id);
            return childItem ? renderDropdownButton(childItem, true) : null;
          })}
        </div>
      );
    });
  };

  const dropdownContent = useMemo(() => {
    if (!openDropdown || !dropdownPos) return null;

    const section = openDropdown;
    return (
      <div
        ref={dropdownPortalRef}
        className="fixed bg-blue-50 rounded-xl shadow-2xl border border-blue-200 py-2 z-[9999] overflow-hidden"
        style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
      >
        {section === 'Tasks'
          ? renderTasksDropdown()
          : (groupedItems[section] || []).map(item => renderDropdownButton(item))}
      </div>
    );
  }, [activeTab, groupedItems, openDropdown, dropdownPos, openPendingGroup]);

  return (
    <div className="w-full bg-white shadow-sm border-b border-gray-100 flex items-center justify-between px-0 py-2 flex-shrink-0 z-40 relative" ref={dropdownRef}>
      <div className="flex items-center space-x-4 flex-shrink-0">
         <a 
            href="https://bizskilledu.com/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center space-x-2 hover:opacity-80 group"
          >
             <img 
               src="https://i.ibb.co/YBSjM7Gg/Chat-GPT-Image-Dec-18-2025-10-23-18-AM.png" 
               className="h-8 w-8 object-contain" 
               alt="TaskPro Logo" 
             />
             <div className="flex flex-col justify-center">
                 <h1 className="text-xl font-bold text-indigo-600 leading-tight">{brandName}</h1>
                 <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider group-hover:text-indigo-500">BIZSKILL</span>
             </div>
         </a>
         <span className="hidden lg:block h-8 w-px bg-gray-200 mx-2"></span>
      </div>

      <nav className="flex-1 ml-4 overflow-hidden md:overflow-visible">
        <ul className="flex items-center space-x-2 min-w-max md:min-w-0">
          {groupedItems['main']?.map(item => (
             <li key={item.id}>
              <button
                onClick={() => handleItemClick(item.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold ${activeTab === item.id ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100 hover:text-indigo-600'}`}
              >
                <span className="shrink-0">{item.icon}</span>
                <span className="flex-1 text-left">{item.label}</span>
                {renderCount(item, activeTab === item.id, 'bg-indigo-100 text-indigo-700')}
              </button>
            </li>
          ))}

          {['Tasks', 'Vendor', 'Master', 'Recurring Tasks', 'Documentation'].map(section => groupedItems[section] && (
            <li key={section} className="relative">
              <button
                onClick={() => toggleDropdown(section)}
                ref={(el) => {
                  dropdownAnchorRefs.current[section] = el;
                }}
                className={`flex items-center px-4 py-2.5 rounded-lg text-sm font-semibold ${isSectionActive(section) || openDropdown === section ? 'text-indigo-600 bg-indigo-50' : 'text-gray-600 hover:text-indigo-600 hover:bg-gray-50'}`}
              >
                <span>{section}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex items-center space-x-4 flex-shrink-0 ml-4">
        <div className="hidden xl:flex items-center space-x-3 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
          <div className="text-right">
             <div className={`text-[9px] uppercase font-bold tracking-widest leading-none ${hasError ? 'text-red-500' : 'text-indigo-500'}`}>
               DATABASE {hasError ? 'OFFLINE' : 'ONLINE'}
             </div>
             <div className="text-[10px] text-gray-500 font-medium leading-none mt-1">
                {isSyncing ? 'Syncing...' : lastSynced ? `Last: ${lastSynced.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : 'Connected'}
             </div>
          </div>
          <button 
              onClick={() => onSync?.(false)} 
              disabled={isSyncing}
              className={`p-1.5 rounded-full ${isSyncing ? 'text-indigo-400 animate-spin' : hasError ? 'text-red-600' : 'text-indigo-600 hover:bg-white'}`}
            >
              <RefreshCw size={14} />
            </button>
        </div>

        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg p-1">
          <button
            onClick={() => onLayoutChange('side')}
            className={`px-3 py-2 text-[10px] font-bold rounded-md uppercase tracking-wider ${layoutMode === 'side' ? 'bg-indigo-600 text-white shadow-sm' : 'text-indigo-600 hover:bg-white'}`}
          >
            Side
          </button>
          <button
            onClick={() => onLayoutChange('top')}
            className={`px-3 py-2 text-[10px] font-bold rounded-md uppercase tracking-wider ${layoutMode === 'top' ? 'bg-indigo-600 text-white shadow-sm' : 'text-indigo-600 hover:bg-white'}`}
          >
            Top
          </button>
        </div>
      </div>

      {dropdownContent && createPortal(dropdownContent, document.body)}
    </div>
  );
};

