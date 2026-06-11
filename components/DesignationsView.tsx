import React, { useState, useMemo } from 'react';
import { Plus, Search, Edit2, Trash2, LayoutGrid, LayoutList, ArrowUpDown, ArrowUp, ArrowDown, FileText, Download } from 'lucide-react';
import { Designation } from '../types';
import { useLabels } from '../labelOverrides';

interface DesignationsViewProps {
  designations: Designation[];
  onAddDesignation: () => void;
  onDeleteDesignation: (id: number) => void;
  onEditDesignation: (designation: Designation) => void;
}

type SortConfig = {
  key: keyof Designation;
  direction: 'asc' | 'desc';
} | null;

export const DesignationsView: React.FC<DesignationsViewProps> = ({ designations, onAddDesignation, onDeleteDesignation, onEditDesignation }) => {
  const { getViewLabel } = useLabels();
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);

  const requestSort = (key: keyof Designation) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: keyof Designation) => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown size={14} className="ml-1 opacity-50" />;
    return sortConfig.direction === 'asc' ? <ArrowUp size={14} className="ml-1 text-white" /> : <ArrowDown size={14} className="ml-1 text-white" />;
  };

  const sortedDesignations = useMemo(() => {
    let sortableItems = [...designations];
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
  }, [designations, sortConfig]);

  const thClass = "px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider border-r border-indigo-500 last:border-r-0 cursor-pointer bg-indigo-600 hover:bg-indigo-700 transition-colors select-none";
  const tdClass = "px-6 py-4 text-sm text-gray-900 border-r border-black last:border-r-0";

  const handleExportExcel = () => {
    const csv = [
      'S.No.,Title',
      ...sortedDesignations.map((item, idx) => `${idx + 1},"${String(item.title || '').replace(/"/g, '""')}"`)
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Designations_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  };

  const handleExportPDF = async () => {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const doc = new jsPDF();
    doc.text('Designations', 14, 14);
    autoTable(doc, {
      head: [['S.No.', 'Title']],
      body: sortedDesignations.map((item, idx) => [idx + 1, item.title || '-']),
      startY: 20
    });
    doc.save(`Designations_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div><h2 className="text-2xl font-bold text-indigo-600">{getViewLabel('designations', 'Designations')}</h2></div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportPDF} title="Export PDF" className="flex items-center justify-center p-2.5 bg-indigo-500 text-white border border-indigo-600 rounded-md hover:bg-indigo-600"><Download size={16} /></button>
          <button onClick={handleExportExcel} title="Export Excel" className="flex items-center justify-center p-2.5 bg-indigo-600 text-white border border-indigo-700 rounded-md hover:bg-indigo-700"><FileText size={16} /></button>
          <button onClick={onAddDesignation} className="flex items-center justify-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium shadow-sm transition-colors whitespace-nowrap"><Plus size={16} /><span>Add Designation</span></button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-indigo-300 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full md:max-w-xl"><Search className="absolute left-3 top-2.5 text-indigo-600" size={18} /><input type="text" placeholder="Search designations..." className="w-full pl-10 pr-4 py-2 border border-indigo-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 text-sm"/></div>
        <div className="flex gap-3 w-full md:w-auto">
            <div className="flex bg-gray-100 p-1 rounded-lg md:hidden">
                <button onClick={() => setViewMode('card')} className={`p-1.5 rounded-md transition-all ${viewMode === 'card' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}><LayoutGrid size={18} /></button>
                <button onClick={() => setViewMode('table')} className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}><LayoutList size={18} /></button>
            </div>
        </div>
      </div>

      <div className={`bg-white rounded-lg border border-black shadow-sm overflow-hidden ${viewMode === 'card' ? 'hidden md:block' : 'block'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-indigo-600 border-b border-indigo-700">
                <th className={thClass} onClick={() => requestSort('id')}><div className="flex items-center">S.No. {getSortIcon('id')}</div></th>
                <th className={thClass} onClick={() => requestSort('title')}><div className="flex items-center">Title {getSortIcon('title')}</div></th>
                <th className="px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider border-r border-indigo-500 last:border-r-0 text-center bg-indigo-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black">
              {sortedDesignations.map((item, index) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className={tdClass}>{index + 1}</td>
                  <td className={`${tdClass} font-medium`}>{item.title}</td>
                  <td className={`${tdClass} text-center`}>
                    <div className="flex items-center justify-center space-x-3">
                      <button onClick={() => onEditDesignation(item)} className="text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 p-1.5 rounded-md border border-indigo-100"><Edit2 size={16} /></button>
                      <button type="button" onClick={() => onDeleteDesignation(item.id)} className="text-red-500 hover:text-red-700 transition-colors bg-red-50 p-1.5 rounded-md border border-red-100"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {sortedDesignations.length === 0 && (<tr><td colSpan={3} className="px-6 py-8 text-center text-gray-500">No designations found.</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>

      <div className={`space-y-4 md:hidden ${viewMode === 'card' ? 'block' : 'hidden'}`}>
        {sortedDesignations.map((item) => (
             <div key={item.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex items-center justify-between"><div className="font-medium text-gray-900">{item.title}</div><div className="flex items-center gap-2"><button onClick={() => onEditDesignation(item)} className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 p-2 rounded-md"><Edit2 size={16} /></button><button type="button" onClick={() => onDeleteDesignation(item.id)} className="text-red-500 hover:text-red-700 bg-red-50 p-2 rounded-md"><Trash2 size={16} /></button></div></div>
        ))}
         {designations.length === 0 && <div className="text-center py-8 text-gray-500 bg-white rounded-lg border border-gray-200">No designations found.</div>}
      </div>
    </div>
  );
};
