
import React, { useState, useMemo } from 'react';
import { Plus, Search, Edit2, Trash2, ArrowUpDown, ArrowUp, ArrowDown, FileText, Download } from 'lucide-react';
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
  const [searchTerm,setSearchTerm]=useState('');
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
    let sortableItems = categories.filter(category=>String(category.name||'').toLowerCase().includes(searchTerm.toLowerCase()));
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
  }, [categories, sortConfig, searchTerm]);

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

  const thClass = "px-2 md:px-4 py-3 text-xs font-semibold text-white uppercase tracking-normal border-r border-indigo-500 last:border-r-0 cursor-pointer bg-indigo-600 hover:bg-indigo-700 transition-colors select-none";
  const tdClass = "px-2 md:px-4 py-3 text-sm text-gray-900 border-r border-black last:border-r-0";
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
      <h2 className="sr-only">{getViewLabel('categories','Categories')}</h2>
      <div className="bg-white p-3 rounded-lg shadow-sm border border-indigo-300 flex items-center gap-2">
        <div className="relative flex-1 min-w-0"><Search className="absolute left-3 top-2.5 text-indigo-600" size={18}/><input aria-label="Search categories" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="Search categories..." className="w-full pl-9 pr-2 py-2 border border-indigo-300 rounded-md text-sm"/></div>
        <button onClick={handleExportPDF} title="Export PDF" aria-label="Export PDF" className="shrink-0 p-2 bg-indigo-500 text-white rounded-md"><Download size={16}/></button>
        <button onClick={handleExportExcel} title="Export Excel" aria-label="Export Excel" className="shrink-0 p-2 bg-indigo-600 text-white rounded-md"><FileText size={16}/></button>
        <button aria-label="Add Category" title="Add Category" onClick={onAddCategory} className="shrink-0 flex items-center gap-2 p-2 md:px-4 bg-indigo-600 text-white rounded-md text-sm"><Plus size={18}/><span className="sr-only md:not-sr-only">Add Category</span></button>
      </div>

      <div className="bg-white min-w-0 rounded-lg border border-black shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-left border-collapse"><colgroup><col style={{width:56}}/><col/><col style={{width:100}}/></colgroup>
            <thead>
              <tr className="bg-indigo-600 border-b border-indigo-700">
                <th className={thClass} onClick={() => requestSort('id')}><div className="flex items-center">S.No. {getSortIcon('id')}</div></th>
                <th className={thClass} onClick={() => requestSort('name')}><div className="flex items-center">Name {getSortIcon('name')}</div></th>
                <th className="px-2 md:px-4 py-3 text-xs font-semibold text-white uppercase tracking-normal border-r border-indigo-500 last:border-r-0 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black">
              {sortedCategories.map((item, index) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className={tdClass}>{index + 1}</td>
                  <td className={`${tdClass} font-medium break-words`}>{item.name}</td>
                  <td className={`${tdClass} text-center`}>
                    <div className="flex items-center justify-center space-x-3">
                      <button aria-label={'Edit '+item.name} onClick={() => handleEditClick(item)} className="text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 p-1.5 rounded-md border border-indigo-100"><Edit2 size={16} /></button>
                      <button type="button" aria-label={'Delete '+item.name} onClick={() => handleDeleteClick(item)} className="text-red-500 hover:text-red-700 transition-colors bg-red-50 p-1.5 rounded-md border border-red-100"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
               {sortedCategories.length === 0 && (<tr><td colSpan={3} className="px-6 py-8 text-center text-gray-500">No categories found.</td></tr>)}
            </tbody>
          </table>
        </div>
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
