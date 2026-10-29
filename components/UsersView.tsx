
import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Search, LayoutGrid, LayoutList, FileText, Download, Filter, X } from 'lucide-react';
import { UserTable } from './UserTable';
import { AddUserModal } from './AddUserModal';
import { UpdateUserModal } from './UpdateUserModal';
import { User, Designation, Department, Firm, Category } from '../types';
import { useLabels } from '../labelOverrides';
import { SearchableSelect } from './SearchableSelect';

interface UsersViewProps {
  users: User[];
  designations: Designation[];
  departments: Department[];
  firms: Firm[];
  categories: Category[];
  onAddUser: (user: Omit<User, 'id' | 'isActive'>) => void;
  onEditUser: (user: User) => void;
  onToggleStatus: (id: number) => void;
  onDeleteUser: (id: number) => void;
  onAddDesignation: () => void;
  onAddDepartment: () => void;
  sidebarCollapsed?: boolean;
}

export const UsersView: React.FC<UsersViewProps> = ({ 
  users, 
  designations, 
  departments, 
  firms,
  categories,
  onAddUser, 
  onEditUser, 
  onToggleStatus, 
  onDeleteUser, 
  onAddDesignation, 
  onAddDepartment, 
  sidebarCollapsed = false 
}) => {
  const { getViewLabel } = useLabels();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [mobileViewMode, setMobileViewMode] = useState<'card' | 'table'>('card');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Filter States
  const [filterName, setFilterName] = useState<string[]>([]);
  const [filterDesignation, setFilterDesignation] = useState<string[]>([]);
  const [filterRole, setFilterRole] = useState<string[]>([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterName, filterDesignation, filterRole]);

  const doesUserMatchAllFilters = (u: User, excludeKey?: string) => {
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      const matchesSearch = 
        u.name.toLowerCase().includes(lowerTerm) || 
        u.email.toLowerCase().includes(lowerTerm) ||
        (u.employeeId && u.employeeId.toLowerCase().includes(lowerTerm)) ||
        (u.designation && u.designation.toLowerCase().includes(lowerTerm)) ||
        (u.role && u.role.toLowerCase().includes(lowerTerm));
      if (!matchesSearch) return false;
    }
    if (excludeKey !== 'name' && filterName.length > 0 && !filterName.includes(u.name)) return false;
    if (excludeKey !== 'designation' && filterDesignation.length > 0 && !filterDesignation.includes(u.designation || '')) return false;
    if (excludeKey !== 'role' && filterRole.length > 0 && !filterRole.includes(u.role)) return false;
    return true;
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => doesUserMatchAllFilters(u));
  }, [users, searchTerm, filterName, filterDesignation, filterRole]);

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredUsers.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredUsers, currentPage]);

  const handleEditClick = (user: User) => {
    setSelectedUser(user);
    setIsEditModalOpen(true);
  };

  const handleClearFilters = () => {
    setFilterName([]);
    setFilterDesignation([]);
    setFilterRole([]);
    setSearchTerm('');
  };

  const nameOptions = useMemo(() => {
    const matchedUsers = users.filter(u => doesUserMatchAllFilters(u, 'name'));
    return Array.from(new Set(matchedUsers.map(u => u.name))).sort().map(name => ({ value: name, label: name }));
  }, [users, searchTerm, filterDesignation, filterRole]);

  const dOptions = useMemo(() => {
    const matchedUsers = users.filter(u => doesUserMatchAllFilters(u, 'designation'));
    return Array.from(new Set(matchedUsers.map(u => u.designation || '').filter(Boolean))).sort().map(d => ({ value: d, label: d }));
  }, [users, searchTerm, filterName, filterRole]);


  const roleOptions = useMemo(() => {
    const matchedUsers = users.filter(u => doesUserMatchAllFilters(u, 'role'));
    return Array.from(new Set(matchedUsers.map(u => u.role))).sort().map(role => ({ value: role, label: role }));
  }, [users, searchTerm, filterName, filterDesignation]);

  const activeFilterBadges = useMemo(() => {
    const badges: { label: string; clear: () => void }[] = [];
    if (filterName.length > 0) badges.push({ label: `Name: ${filterName.join(', ')}`, clear: () => setFilterName([]) });
    if (filterDesignation.length > 0) badges.push({ label: `Designation: ${filterDesignation.join(', ')}`, clear: () => setFilterDesignation([]) });
    if (filterRole.length > 0) badges.push({ label: `Role: ${filterRole.join(', ')}`, clear: () => setFilterRole([]) });
    return badges;
  }, [filterName, filterDesignation, filterRole]);

  const startEntry = filteredUsers.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endEntry = Math.min(currentPage * itemsPerPage, filteredUsers.length);
  
  const handleExportExcel = () => {
    const csv = [
      'S.No.,Name,Employee Id,Email,Mobile,Designation,Role,Status',
      ...filteredUsers.map((u, i) => `${i + 1},"${String(u.name || '').replace(/"/g, '""')}","${String(u.employeeId || '').replace(/"/g, '""')}","${String(u.email || '').replace(/"/g, '""')}","${String(u.mobile || '').replace(/"/g, '""')}","${String(u.designation || '').replace(/"/g, '""')}","${String(u.role || '').replace(/"/g, '""')}","${u.isActive ? 'Active' : 'Inactive'}"`)
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Users_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  };

  const handleExportPDF = async () => {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.text('Users', 14, 14);
    autoTable(doc, {
      head: [['S.No.', 'Name', 'Employee Id', 'Email', 'Mobile', 'Designation', 'Role', 'Status']],
      body: filteredUsers.map((u, i) => [i + 1, u.name || '-', u.employeeId || '-', u.email || '-', u.mobile || '-', u.designation || '-', u.role || '-', u.isActive ? 'Active' : 'Inactive']),
      startY: 20
    });
    doc.save(`Users_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between gap-3 md:gap-4">
        <div className={sidebarCollapsed ? 'pl-14 md:pl-16' : ''}>
          <h2 className="text-2xl font-bold text-indigo-600">{getViewLabel('users', 'Users')}</h2>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="md:hidden inline-flex items-center justify-center w-10 h-10 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 shadow-sm"
          title="Add User"
        >
          <Plus size={18} />
        </button>
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

        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 text-indigo-600" size={18} />
            <input 
                type="text" 
                placeholder="Search users..."
                className={`w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-100 text-sm transition-colors ${searchTerm ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-medium' : 'border-indigo-300 text-indigo-700'}`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
            </div>
            
            <div className="flex gap-3 w-full md:w-auto">
                <button 
                  onClick={() => setIsAddModalOpen(true)}
                  className="hidden md:flex flex-1 md:flex-none items-center justify-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium shadow-sm transition-colors whitespace-nowrap"
                >
                  <Plus size={16} />
                  <span>Add User</span>
                </button>
                <button 
                    onClick={() => setShowFilters(!showFilters)} 
                    className={`flex items-center space-x-1 px-3 py-2 border rounded-md text-sm font-medium shadow-sm transition-all duration-200 ${showFilters ? 'bg-indigo-600 border-indigo-700 text-white ring-2 ring-indigo-200' : 'bg-indigo-50 border-indigo-300 text-indigo-600 hover:bg-indigo-100'}`} 
                >
                    <Filter size={16} />
                </button>
                <button onClick={handleExportPDF} title="Export PDF" className="hidden md:flex items-center justify-center p-2.5 bg-indigo-500 text-white border border-indigo-600 rounded-md hover:bg-indigo-600"><Download size={16} /></button>
                <button onClick={handleExportExcel} title="Export Excel" className="hidden md:flex items-center justify-center p-2.5 bg-indigo-600 text-white border border-indigo-700 rounded-md hover:bg-indigo-700"><FileText size={16} /></button>
            </div>
        </div>

        <div className={`${showFilters ? 'grid' : 'hidden'} grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end`}>
            <SearchableSelect label="Name" options={nameOptions} value={filterName} onChange={setFilterName} multiple={true} placeholder="All Names" className="text-sm"/>
            <SearchableSelect label="Designation" options={dOptions} value={filterDesignation} onChange={setFilterDesignation} multiple={true} placeholder="All Designations" className="text-sm"/>
            <SearchableSelect label="Role" options={roleOptions} value={filterRole} onChange={setFilterRole} multiple={true} placeholder="All Roles" className="text-sm"/>
            <div className="col-span-1">
                <button onClick={handleClearFilters} className="w-full px-3 py-2 bg-red-600 text-white border border-red-700 rounded-md hover:bg-red-700 text-sm font-medium transition-colors h-[38px] flex items-center justify-center">Clear</button>
            </div>
        </div>
      </div>

      <UserTable 
        users={paginatedUsers} 
        onToggleStatus={onToggleStatus} 
        onDeleteUser={onDeleteUser} 
        onEditUser={handleEditClick}
        viewMode={mobileViewMode}
        startIndex={startEntry}
      />
      
       <div className="flex justify-between items-center text-xs text-indigo-600 font-bold px-1 uppercase tracking-wider">
          <span>Showing {startEntry} to {endEntry} of {filteredUsers.length} entries</span>
          <div className="flex space-x-2">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-4 py-1.5 bg-indigo-600 text-white rounded shadow hover:bg-indigo-700 disabled:opacity-50 transition-colors uppercase text-[10px]" 
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-4 py-1.5 bg-indigo-600 text-white rounded shadow hover:bg-indigo-700 disabled:opacity-50 transition-colors uppercase text-[10px]"
                disabled={currentPage === totalPages || totalPages === 0}
              >
                Next
              </button>
          </div>
      </div>

      <AddUserModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onSave={onAddUser} 
        designations={designations}
        departments={departments}
        onAddDesignation={onAddDesignation}
        onAddDepartment={onAddDepartment}
        users={users}
        firms={firms}
        categories={categories}
      />

      <UpdateUserModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        user={selectedUser}
        onUpdate={onEditUser}
        designations={designations}
        departments={departments}
        onAddDesignation={onAddDesignation}
        onAddDepartment={onAddDepartment}
        users={users}
      />
    </div>
  );
};
