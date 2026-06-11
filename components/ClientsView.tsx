
import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, LayoutGrid, LayoutList, Mail, Phone, MapPin, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Client, Project } from '../types';
import { AddClientModal } from './AddClientModal';
import { EditClientModal } from './EditClientModal';
import { ClientProjectsModal } from './ClientProjectsModal';
import { ConfirmationModal } from './ConfirmationModal';
import { useLabels } from '../labelOverrides';

interface ClientsViewProps {
  clients: Client[];
  projects: Project[];
  onAddClient: (client: Omit<Client, 'id'>) => void;
  onDeleteClient: (id: number) => void;
  onEditClient: (client: Client) => void;
  onNavigateToProjectTasks?: (projectName: string) => void;
}

type SortConfig = {
  key: keyof Client;
  direction: 'asc' | 'desc';
} | null;

export const ClientsView: React.FC<ClientsViewProps> = ({ clients, projects, onAddClient, onDeleteClient, onEditClient, onNavigateToProjectTasks }) => {
  const { getViewLabel } = useLabels();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isProjectsModalOpen, setIsProjectsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);

  const requestSort = (key: keyof Client) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: keyof Client) => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown size={14} className="ml-1 opacity-50" />;
    return sortConfig.direction === 'asc' ? <ArrowUp size={14} className="ml-1 text-white" /> : <ArrowDown size={14} className="ml-1 text-white" />;
  };

  const sortedClients = useMemo(() => {
    let sortableItems = [...clients];
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
  }, [clients, sortConfig]);

  const handleClientClick = (client: Client) => {
    setSelectedClient(client);
    setIsProjectsModalOpen(true);
  };

  const handleEditClick = (client: Client) => {
    setSelectedClient(client);
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (client: Client) => {
    setSelectedClient(client);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (selectedClient) {
        onDeleteClient(selectedClient.id);
        setIsDeleteModalOpen(false);
    }
  };

  const thClass = "px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider border-r border-indigo-500 last:border-r-0 cursor-pointer bg-indigo-600 hover:bg-indigo-700 transition-colors select-none";
  const tdClass = "px-6 py-4 text-sm text-gray-900 border-r border-black last:border-r-0";

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-indigo-600">{getViewLabel('clients', 'Client Master')}</h2>
          <p className="text-sm text-gray-500 mt-1">Manage client details, GST, and contacts</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-indigo-300 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full md:max-w-xl">
           <Search className="absolute left-3 top-2.5 text-indigo-600" size={18} />
          <input 
            type="text" 
            placeholder="Search clients..."
            className="w-full pl-10 pr-4 py-2 border border-indigo-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 text-sm"
          />
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
            <div className="flex bg-gray-100 p-1 rounded-lg md:hidden">
                <button onClick={() => setViewMode('card')} className={`p-1.5 rounded-md transition-all ${viewMode === 'card' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}><LayoutGrid size={18} /></button>
                <button onClick={() => setViewMode('table')} className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}><LayoutList size={18} /></button>
            </div>
            <button onClick={() => setIsModalOpen(true)} className="flex-1 md:flex-none flex items-center justify-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium shadow-sm transition-colors whitespace-nowrap"><Plus size={16} /><span>Add Client</span></button>
        </div>
      </div>

      <div className={`bg-white rounded-lg border border-black shadow-sm overflow-hidden ${viewMode === 'card' ? 'hidden md:block' : 'block'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-indigo-600 border-b border-indigo-700">
                <th className={thClass} onClick={() => requestSort('id')}><div className="flex items-center">S.No. {getSortIcon('id')}</div></th>
                <th className={thClass} onClick={() => requestSort('name')}><div className="flex items-center">Client Name {getSortIcon('name')}</div></th>
                <th className={thClass} onClick={() => requestSort('gstNumber')}><div className="flex items-center">GST Number {getSortIcon('gstNumber')}</div></th>
                <th className={thClass} onClick={() => requestSort('email')}><div className="flex items-center">Email {getSortIcon('email')}</div></th>
                <th className={thClass} onClick={() => requestSort('mobile')}><div className="flex items-center">Mobile {getSortIcon('mobile')}</div></th>
                <th className={thClass} onClick={() => requestSort('address')}><div className="flex items-center">Address {getSortIcon('address')}</div></th>
                <th className="px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider border-r border-indigo-500 last:border-r-0 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black">
              {sortedClients.map((item, index) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className={tdClass}>{index + 1}</td>
                  <td className={`${tdClass} text-left font-medium`}>
                    <button onClick={() => handleClientClick(item)} className="text-left text-indigo-600 hover:underline hover:text-indigo-800">{item.name}</button>
                  </td>
                  <td className={tdClass}>{item.gstNumber || '-'}</td>
                  <td className={tdClass}>{item.email}</td>
                  <td className={tdClass}>{item.mobile}</td>
                  <td className={`${tdClass} max-w-[200px] truncate`} title={item.address}>{item.address}</td>
                  <td className={`${tdClass} text-center`}>
                    <div className="flex items-center justify-center space-x-3">
                      <button onClick={() => handleEditClick(item)} className="text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 p-1.5 rounded-md border border-indigo-100"><Edit2 size={16} /></button>
                      <button type="button" onClick={() => handleDeleteClick(item)} className="text-red-500 hover:text-red-700 transition-colors bg-red-50 p-1.5 rounded-md border border-red-100"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {sortedClients.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-500">No clients found. Add a new client to get started.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

       <div className={`space-y-4 md:hidden ${viewMode === 'card' ? 'block' : 'hidden'}`}>
        {sortedClients.map((item) => (
             <div key={item.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                 <div className="flex justify-between items-start mb-3">
                    <button onClick={() => handleClientClick(item)} className="font-bold text-lg text-indigo-600 hover:underline text-left">{item.name}</button>
                    {item.gstNumber && <span className="px-2 py-0.5 bg-gray-100 text-[10px] font-bold text-gray-600 rounded border border-gray-200 uppercase">GST: {item.gstNumber}</span>}
                 </div>
                 <div className="space-y-2 text-sm text-gray-600 mb-4">
                     {item.email && <div className="flex items-center gap-2"><Mail size={14} className="text-gray-400" /><span className="truncate">{item.email}</span></div>}
                     {item.mobile && <div className="flex items-center gap-2"><Phone size={14} className="text-gray-400" /><span>{item.mobile}</span></div>}
                     {item.address && <div className="flex items-start gap-2"><MapPin size={14} className="text-gray-400 mt-0.5" /><span className="flex-1">{item.address}</span></div>}
                </div>
                 <div className="flex gap-2 pt-3 border-t border-gray-100">
                     <button onClick={() => handleEditClick(item)} className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"><Edit2 size={16} />Edit</button>
                     <button onClick={() => handleDeleteClick(item)} className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"><Trash2 size={16} />Delete</button>
                 </div>
             </div>
        ))}
         {clients.length === 0 && <div className="text-center py-8 text-gray-500 bg-white rounded-lg border border-gray-200">No clients found.</div>}
      </div>

      <AddClientModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={onAddClient} clients={clients} />
      <EditClientModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onSave={onEditClient} client={selectedClient} clients={clients} />
      <ClientProjectsModal isOpen={isProjectsModalOpen} onClose={() => setIsProjectsModalOpen(false)} client={selectedClient} projects={projects} onNavigateToProjectTasks={onNavigateToProjectTasks} />
      <ConfirmationModal 
        isOpen={isDeleteModalOpen} 
        onClose={() => setIsDeleteModalOpen(false)} 
        onConfirm={confirmDelete}
        title="Delete Client"
        message={`Are you sure you want to delete ${selectedClient?.name}? This action cannot be undone.`}
      />
    </div>
  );
};
