
import React, { useState, useMemo } from 'react';
import { Plus, Search, Edit2, Trash2, LayoutGrid, LayoutList, ArrowUpDown, ArrowUp, ArrowDown, FileText, Download } from 'lucide-react';
import { Category } from '../types';
import { AddCategoryModal } from './AddCategoryModal';
import { ConfirmationModal } from './ConfirmationModal';
import { useLabels } from '../labelOverrides';

interface CategoriesViewProps {
  categories: Category[];
  onAddCategory: () => void;
  onDeleteCategory: (id: number) => void;
  onEditCategory: (category: Category) => void;
  sidebarCollapsed?: boolean;
}

type SortConfig = {
  key: keyof Category;
  direction: 'asc' | 'desc';
} | null;

export const CategoriesView: React.FC<CategoriesViewProps> = ({ categories, onAddCategory, onDeleteCategory, onEditCategory, sidebarCollapsed = false }) => {
  const { getViewLabel } = useLabels();
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  const requestSort = (key: keyof Category) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: keyof Category) => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown size={14} className="ml-1 opacity-50" />;
    return sortConfig.direction === 'asc' ? <ArrowUp size={14} className="ml-1 text-white" /> : <ArrowDown size={14} className="ml-1 text-white" />;
  };

  const sortedCategories = useMemo(() => {
    let sortableItems = [...categories];
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
  }, [categories, sortConfig]);

  const handleEditClick = (category: Category) => {
    setSelectedCategory(category);
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (category: Category) => {
    setSelectedCategory(category);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (selectedCategory) {
        onDeleteCategory(selectedCategory.id);
        setIsDeleteModalOpen(false);
    }
  };

  const thClass = "px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider border-r border-indigo-500 last:border-r-0 cursor-pointer bg-indigo-600 hover:bg-indigo-700 transition-colors select-none";
  const tdClass = "px-6 py-4 text-sm text-gray-900 border-r border-black last:border-r-0";
  const handleExportExcel = () => {
    const csv = ['S.No.,Name', ...sortedCategories.map((c, i) => `${i + 1},"${String(c.name || '').replace(/"/g, '""')}"`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Categories_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  };
	  const handleExportPDF = async () => {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);
	    const doc = new jsPDF();
	    doc.text('Categories', 14, 14);
	    autoTable(doc, { head: [['S.No.', 'Name']], body: sortedCategories.map((c, i) => [i + 1, c.name || '-']), startY: 20 });
	    doc.save(`Categories_${new Date().toISOString().split('T')[0]}.pdf`);
	  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between gap-3 md:gap-4">
        <div className={sidebarCollapsed ? 'pl-14 md:pl-16' : ''}><h2 className="text-2xl font-bold text-indigo-600">{getViewLabel('categories', 'Categories')}</h2></div>
        <button
          onClick={onAddCategory}
          className="md:hidden inline-flex items-center justify-center w-10 h-10 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 shadow-sm"
          title="Add Category"
        >
          <Plus size={18} />
        </button>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-indigo-300 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full md:max-w-xl"><Search className="absolute left-3 top-2.5 text-indigo-600" size={18} /><input type="text" placeholder="Search categories..." className="w-full pl-10 pr-4 py-2 border border-indigo-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 text-sm"/></div>
        <div className="flex gap-3 w-full md:w-auto">
            <div className="flex bg-gray-100 p-1 rounded-lg md:hidden">
                <button onClick={() => setViewMode('card')} className={`p-1.5 rounded-md transition-all ${viewMode === 'card' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}><LayoutGrid size={18} /></button>
                <button onClick={() => setViewMode('table')} className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}><LayoutList size={18} /></button>
            </div>
            <button onClick={handleExportPDF} title="Export PDF" className="hidden md:flex items-center justify-center p-2.5 bg-indigo-500 text-white border border-indigo-600 rounded-md hover:bg-indigo-600"><Download size={16} /></button>
            <button onClick={handleExportExcel} title="Export Excel" className="hidden md:flex items-center justify-center p-2.5 bg-indigo-600 text-white border border-indigo-700 rounded-md hover:bg-indigo-700"><FileText size={16} /></button>
            <button onClick={onAddCategory} className="hidden md:flex flex-1 md:flex-none items-center justify-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium shadow-sm transition-colors whitespace-nowrap"><Plus size={16} /><span>Add Category</span></button>
        </div>
      </div>

      <div className={`bg-white rounded-lg border border-black shadow-sm overflow-hidden ${viewMode === 'card' ? 'hidden md:block' : 'block'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-indigo-600 border-b border-indigo-700">
                <th className={thClass} onClick={() => requestSort('id')}><div className="flex items-center">S.No. {getSortIcon('id')}</div></th>
                <th className={thClass} onClick={() => requestSort('name')}><div className="flex items-center">Name {getSortIcon('name')}</div></th>
                <th className="px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider border-r border-indigo-500 last:border-r-0 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black">
              {sortedCategories.map((item, index) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className={tdClass}>{index + 1}</td>
                  <td className={`${tdClass} font-medium`}>{item.name}</td>
                  <td className={`${tdClass} text-center`}>
                    <div className="flex items-center justify-center space-x-3">
                      <button onClick={() => handleEditClick(item)} className="text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 p-1.5 rounded-md border border-indigo-100"><Edit2 size={16} /></button>
                      <button type="button" onClick={() => handleDeleteClick(item)} className="text-red-500 hover:text-red-700 transition-colors bg-red-50 p-1.5 rounded-md border border-red-100"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
               {sortedCategories.length === 0 && (<tr><td colSpan={3} className="px-6 py-8 text-center text-gray-500">No categories found.</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>

      <div className={`space-y-4 md:hidden ${viewMode === 'card' ? 'block' : 'hidden'}`}>
        {sortedCategories.map((item) => (
             <div key={item.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex items-center justify-between"><div className="font-medium text-gray-900">{item.name}</div><div className="flex items-center gap-2"><button onClick={() => handleEditClick(item)} className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 p-2 rounded-md"><Edit2 size={16} /></button><button type="button" onClick={() => handleDeleteClick(item)} className="text-red-500 hover:text-red-700 bg-red-50 p-2 rounded-md"><Trash2 size={16} /></button></div></div>
        ))}
         {categories.length === 0 && <div className="text-center py-8 text-gray-500 bg-white rounded-lg border border-gray-200">No categories found.</div>}
      </div>

      <AddCategoryModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        onSave={(data) => { onEditCategory({...selectedCategory!, ...data}); setIsEditModalOpen(false); }} 
        initialData={selectedCategory} 
        categories={categories} 
      />
      <ConfirmationModal 
        isOpen={isDeleteModalOpen} 
        onClose={() => setIsDeleteModalOpen(false)} 
        onConfirm={confirmDelete}
        title="Delete Category"
        message={`Are you sure you want to delete category "${selectedCategory?.name}"?`}
      />
    </div>
  );
};
