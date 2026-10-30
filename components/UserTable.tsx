
import React, { useState, useMemo } from 'react';
import { User } from '../types';
import { TaskCardFields, TaskCardField } from './TaskCardFields';
import { Edit2, Trash2, Send, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

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
              <th className={thClass} onClick={() => requestSort('role')}>
                <div className="flex items-center">Role {getSortIcon('role')}</div>
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
                <td className={tdClass}>{user.role}</td>
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
        {sortedUsers.map(user => (
          <article key={user.id} aria-label={user.name} className="min-w-0 bg-white rounded-xl shadow-sm border border-blue-200 p-4">
            <TaskCardFields>
              <TaskCardField label="Name"><h3 className="font-semibold text-indigo-800">{user.name}</h3></TaskCardField>
              <TaskCardField label="Mobile">{user.mobile ? <a href={'tel:'+String(user.mobile).replace(/[^+0-9]/g,'')} className="text-indigo-700 underline">{user.mobile}</a> : null}</TaskCardField>
              <TaskCardField label="Email">{user.email}</TaskCardField>
              <TaskCardField label="Employee ID">{user.employeeId}</TaskCardField>
              <TaskCardField label="Designation">{user.designation}</TaskCardField>
              <TaskCardField label="Role">{user.role}</TaskCardField>
              <TaskCardField label="Telegram">{user.telegramUserName ? '@'+user.telegramUserName.replace(/^@/,'') : null}</TaskCardField>
              <TaskCardField label="Status">
                <button type="button" role="switch" aria-label={'Active status for '+user.name} aria-checked={user.isActive} onClick={()=>onToggleStatus(user.id)} className="inline-flex flex-wrap items-center gap-2 text-sm">
                  <span aria-hidden="true" className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${user.isActive ? 'bg-green-500' : 'bg-gray-300'}`}>
                    <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${user.isActive ? 'translate-x-4' : ''}`}/>
                  </span>
                  {user.isActive ? 'Active' : 'Inactive'}
                </button>
              </TaskCardField>
            </TaskCardFields>
            <div className="flex flex-wrap justify-end gap-2 pt-3">
              <button type="button" aria-label={'Edit '+user.name} onClick={()=>onEditUser(user)} className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100"><Edit2 size={16}/>Edit</button>
              <button type="button" aria-label={'Delete '+user.name} onClick={()=>onDeleteUser(user.id)} className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100"><Trash2 size={16}/>Delete</button>
            </div>
          </article>
        ))}
    </div>
    {users.length === 0 && <div className="p-8 text-center text-gray-500 bg-white rounded-lg border border-gray-200">No users found.</div>}
    </>
  );
};

