
import React, { useState, useMemo } from 'react';
import { User } from '../types';
import { Edit2, Trash2, Phone, Mail, Shield, Briefcase, Send, ArrowUpDown, ArrowUp, ArrowDown, Building2 } from 'lucide-react';

interface UserTableProps {
  users: User[];
  onToggleStatus: (id: number) => void;
  onDeleteUser: (id: number) => void;
  onEditUser: (user: User) => void;
  viewMode?: 'card' | 'table';
  startIndex?: number;
}

type SortConfig = {
  key: keyof User;
  direction: 'asc' | 'desc';
} | null;

export const UserTable: React.FC<UserTableProps> = ({ users, onToggleStatus, onDeleteUser, onEditUser, viewMode = 'card', startIndex = 1 }) => {
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);

  const requestSort = (key: keyof User) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: keyof User) => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown size={14} className="ml-1 opacity-50" />;
    return sortConfig.direction === 'asc' ? <ArrowUp size={14} className="ml-1 text-white" /> : <ArrowDown size={14} className="ml-1 text-white" />;
  };

  const sortedUsers = useMemo(() => {
    let sortableItems = [...users];
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
  }, [users, sortConfig]);

  const thClass = "px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider border-r border-indigo-500 last:border-r-0 cursor-pointer bg-indigo-600 hover:bg-indigo-700 transition-colors select-none whitespace-normal";
  const tdClass = "px-6 py-4 text-sm text-gray-900 border-r border-black last:border-r-0 whitespace-normal break-words";

  return (
    <>
    <div className={`bg-white rounded-lg border border-black shadow-sm overflow-hidden ${viewMode === 'card' ? 'hidden md:block' : 'block'}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-indigo-600 border-b border-indigo-700">
              <th className={thClass} onClick={() => requestSort('id')}>
                <div className="flex items-center">S.No. {getSortIcon('id')}</div>
              </th>
              <th className={thClass} onClick={() => requestSort('name')}>
                <div className="flex items-center">Name {getSortIcon('name')}</div>
              </th>
              <th className={thClass} onClick={() => requestSort('employeeId')}>
                <div className="flex items-center">Employee Id {getSortIcon('employeeId')}</div>
              </th>
              <th className={thClass} onClick={() => requestSort('email')}>
                <div className="flex items-center">Email {getSortIcon('email')}</div>
              </th>
              <th className={thClass} onClick={() => requestSort('mobile')}>
                <div className="flex items-center">Mobile {getSortIcon('mobile')}</div>
              </th>
              <th className={thClass} onClick={() => requestSort('telegramUserName')}>
                <div className="flex items-center">Telegram {getSortIcon('telegramUserName')}</div>
              </th>
              <th className={thClass} onClick={() => requestSort('designation')}>
                <div className="flex items-center">Designation {getSortIcon('designation')}</div>
              </th>
              <th className={thClass} onClick={() => requestSort('department')}>
                <div className="flex items-center">Department {getSortIcon('department')}</div>
              </th>
              <th className={thClass} onClick={() => requestSort('role')}>
                <div className="flex items-center">Role {getSortIcon('role')}</div>
              </th>
              <th className={thClass} onClick={() => requestSort('password')}>
                <div className="flex items-center">Password {getSortIcon('password')}</div>
              </th>
              <th className={thClass} onClick={() => requestSort('isActive')}>
                <div className="flex items-center justify-center">Status {getSortIcon('isActive')}</div>
              </th>
              <th className="px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider border-r border-indigo-500 last:border-r-0 text-center whitespace-normal bg-indigo-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black">
            {sortedUsers.map((user, index) => (
              <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                <td className={tdClass}>{startIndex + index}</td>
                <td className={`${tdClass} font-medium`}>{user.name}</td>
                <td className={tdClass}>{user.employeeId || '-'}</td>
                <td className={tdClass}>{user.email}</td>
                <td className={tdClass}>{user.mobile}</td>
                <td className={tdClass}>
                   {user.telegramUserName ? (
                       <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs border border-blue-100 whitespace-normal break-words">
                           <Send size={12} />
                           @{user.telegramUserName}
                       </span>
                   ) : '-'}
                </td>
                <td className={tdClass}>{user.designation || ''}</td>
                <td className={tdClass}>{user.department || '-'}</td>
                <td className={tdClass}>{user.role}</td>
                <td className={tdClass}>{user.password || '-'}</td>
                <td className={`${tdClass} text-center`}>
                   <button 
                    onClick={() => onToggleStatus(user.id)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${user.isActive ? 'bg-green-500' : 'bg-gray-200 border-gray-200'}`}
                    role="switch"
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${user.isActive ? 'translate-x-5' : 'translate-x-0'}`}
                    />
                  </button>
                </td>
                <td className={`${tdClass} text-center`}>
                  <div className="flex items-center justify-center space-x-3">
                    <button onClick={() => onEditUser(user)} className="text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 p-1.5 rounded-md border border-indigo-100"><Edit2 size={16} /></button>
                    <button type="button" onClick={() => onDeleteUser(user.id)} className="text-red-500 hover:text-red-700 transition-colors bg-red-50 p-1.5 rounded-md border border-red-100"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    <div className={`space-y-4 md:hidden ${viewMode === 'card' ? 'block' : 'hidden'}`}>
        {sortedUsers.map((user) => (
            <div key={user.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-lg">{user.name.charAt(0).toUpperCase()}</div>
                        <div>
                            <h3 className="font-bold text-gray-900 whitespace-normal break-words">{user.name}</h3>
                            <div className="flex items-center gap-1 text-xs text-gray-500 whitespace-normal break-words">
                                <Shield size={12} />
                                <span>{user.role}</span>
                                {user.employeeId && <span> • ID: {user.employeeId}</span>}
                            </div>
                        </div>
                    </div>
                     <button onClick={() => onToggleStatus(user.id)} className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${user.isActive ? 'bg-green-500' : 'bg-gray-200 border-gray-200'}`}>
                        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${user.isActive ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                </div>
                <div className="space-y-2 text-sm text-gray-600 mb-4">
                     <div className="flex items-center gap-2 whitespace-normal break-words"><Mail size={14} className="text-gray-400" /><span>{user.email}</span></div>
                     <div className="flex items-center gap-2 whitespace-normal break-words"><Phone size={14} className="text-gray-400" /><span>{user.mobile}</span></div>
                     <div className="flex items-center gap-2 whitespace-normal break-words"><Briefcase size={14} className="text-gray-400" /><span>{user.designation || 'N/A'}</span></div>
                     <div className="flex items-center gap-2 whitespace-normal break-words"><Building2 size={14} className="text-gray-400" /><span>{user.department || 'N/A'}</span></div>
                     {user.telegramUserName && <div className="flex items-center gap-2 whitespace-normal break-words"><Send size={14} className="text-blue-400" /><span>@{user.telegramUserName}</span></div>}
                     <div className="flex items-center gap-2 font-mono text-xs bg-gray-50 p-1 rounded whitespace-normal break-words"><span className="text-gray-400 uppercase font-bold text-[10px]">Pass:</span> <span>{user.password || '-'}</span></div>
                </div>
                <div className="flex gap-2 pt-3 border-t border-gray-100">
                     <button onClick={() => onEditUser(user)} className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"><Edit2 size={16} />Edit</button>
                     <button onClick={() => onDeleteUser(user.id)} className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"><Trash2 size={16} />Delete</button>
                </div>
            </div>
        ))}
    </div>
    {users.length === 0 && <div className="p-8 text-center text-gray-500 bg-white rounded-lg border border-gray-200">No users found.</div>}
    </>
  );
};

