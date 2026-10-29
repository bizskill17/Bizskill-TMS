import React, { useState } from 'react';
import { Plus, Edit2, Trash2, FileText, Download, Search } from 'lucide-react';
import { StatusMaster } from '../types';
import { AddStatusModal } from './AddStatusModal';
import { ConfirmationModal } from './ConfirmationModal';
import { useLabels } from '../labelOverrides';

interface StatusesViewProps {
  statuses: StatusMaster[];
  onAddStatus: (status: Omit<StatusMaster, 'id'>) => void;
  onEditStatus: (status: StatusMaster) => void;
  onDeleteStatus: (id: number) => void;
  sidebarCollapsed?: boolean;
}

export const StatusesView: React.FC<StatusesViewProps> = ({ statuses, onAddStatus, onEditStatus, onDeleteStatus, sidebarCollapsed = false }) => {
  const { getViewLabel } = useLabels();
  const [searchTerm, setSearchTerm] = useState('');
  const filteredStatuses = statuses.filter(status => String(status.name || '').toLowerCase().includes(searchTerm.toLowerCase()));
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<StatusMaster | null>(null);

  const isLocked = (status: StatusMaster) => Boolean(Number(status.is_system || 0)) || ['in progress', 'completed'].includes(String(status.name || '').trim().toLowerCase());
  const handleExportExcel = () => {
    const csv = [
      'S.No.,Status Name',
      ...filteredStatuses.map((item, idx) => `${idx + 1},"${String(item.name || '').replace(/"/g, '""')}"`)
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Status_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  };
  const handleExportPDF = async () => {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const doc = new jsPDF();
    doc.text('Status', 14, 14);
    autoTable(doc, { head: [['S.No.', 'Status Name']], body: filteredStatuses.map((s, i) => [i + 1, s.name || '-']), startY: 20 });
    doc.save(`Status_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="bg-white p-4 rounded-lg shadow-sm border border-indigo-300 flex items-center gap-3 overflow-x-auto">
        <div className="relative flex-1 min-w-[150px]"><Search className="absolute left-3 top-2.5 text-indigo-600" size={18}/><input aria-label="Search statuses" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search statuses..." className="w-full pl-10 pr-4 py-2 border border-indigo-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-100 text-sm"/></div>
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <button onClick={handleExportPDF} title="Export PDF" className="flex items-center justify-center p-2.5 bg-indigo-500 text-white border border-indigo-600 rounded-md hover:bg-indigo-600"><Download size={16} /></button>
          <button onClick={handleExportExcel} title="Export Excel" className="flex items-center justify-center p-2.5 bg-indigo-600 text-white border border-indigo-700 rounded-md hover:bg-indigo-700"><FileText size={16} /></button>
          <button onClick={() => { setSelected(null); setIsEditOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium shadow-sm">
            <Plus size={16} />
            <span className="whitespace-nowrap">Add Status</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-black shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-indigo-600 border-b border-indigo-700">
                <th className="px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider border-r border-indigo-500">S.No.</th>
                <th className="px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider border-r border-indigo-500">Status Name</th>
                <th className="px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black">
              {filteredStatuses.map((status, index) => (
                <tr key={status.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-gray-900 border-r border-black">{index + 1}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 border-r border-black">{status.name}</td>
                  <td className="px-6 py-4 text-center">
                    {!isLocked(status) ? (
                      <div className="flex items-center justify-center gap-3">
                        <button onClick={() => { setSelected(status); setIsEditOpen(true); }} className="text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 p-1.5 rounded-md border border-indigo-100"><Edit2 size={16} /></button>
                        <button onClick={() => { setSelected(status); setIsDeleteOpen(true); }} className="text-red-500 hover:text-red-700 transition-colors bg-red-50 p-1.5 rounded-md border border-red-100"><Trash2 size={16} /></button>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-gray-500">Locked</span>
                    )}
                  </td>
                </tr>
              ))}
              {filteredStatuses.length === 0 && (<tr><td colSpan={3} className="px-6 py-8 text-center text-gray-500">No status found.</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>

      <AddStatusModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        statuses={statuses}
        initialData={selected}
        onSave={(payload) => {
          if (selected) onEditStatus({ ...selected, ...payload });
          else onAddStatus(payload);
          setIsEditOpen(false);
        }}
      />

      <ConfirmationModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={() => {
          if (selected) onDeleteStatus(selected.id);
          setIsDeleteOpen(false);
        }}
        title="Delete Status"
        message={`Are you sure you want to delete status "${selected?.name}"?`}
      />
    </div>
  );
};
