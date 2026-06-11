
import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, LayoutGrid, LayoutList, Mail, Phone, MapPin, Hammer } from 'lucide-react';
import { Vendor } from '../types';
import { AddVendorModal } from './AddVendorModal';
import { EditVendorModal } from './EditVendorModal';
import { useLabels } from '../labelOverrides';

interface VendorsViewProps {
  vendors: Vendor[];
  onAddVendor: (vendor: Omit<Vendor, 'id'>) => void;
  onDeleteVendor: (id: number) => void;
  onEditVendor: (vendor: Vendor) => void;
}

export const VendorsView: React.FC<VendorsViewProps> = ({ vendors, onAddVendor, onDeleteVendor, onEditVendor }) => {
  const { getViewLabel } = useLabels();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleEditClick = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setIsEditModalOpen(true);
  };

  const filteredVendors = useMemo(() => {
    return vendors.filter(v => v.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [vendors, searchTerm]);

  const totalPages = Math.ceil(filteredVendors.length / itemsPerPage);
  const paginatedVendors = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredVendors.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredVendors, currentPage]);

  const thClass = "px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider border-r border-indigo-500 last:border-r-0 bg-indigo-600";
  const tdClass = "px-6 py-4 text-sm text-gray-900 border-r border-black last:border-r-0";

  const startEntry = filteredVendors.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endEntry = Math.min(currentPage * itemsPerPage, filteredVendors.length);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-indigo-600">{getViewLabel('vendors', 'Vendors')}</h2>
          <p className="text-sm text-gray-500 mt-1">Manage vendors and suppliers</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-indigo-200 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full md:max-w-xl">
           <Search className="absolute left-3 top-2.5 text-indigo-600" size={18} />
          <input 
            type="text" 
            placeholder="Search vendors..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-100 text-sm transition-colors ${searchTerm ? 'border-indigo-500 bg-indigo-50' : 'border-indigo-300 text-indigo-700'}`}
          />
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
            <div className="flex bg-gray-100 p-1 rounded-lg md:hidden">
                <button
                onClick={() => setViewMode('card')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'card' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}
                >
                <LayoutGrid size={18} />
                </button>
                <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}
                >
                <LayoutList size={18} />
                </button>
            </div>

            <button 
            onClick={() => setIsModalOpen(true)}
            className="flex-1 md:flex-none flex items-center justify-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium shadow-sm transition-colors whitespace-nowrap"
            >
            <Plus size={16} />
            <span>Add Vendor</span>
            </button>
        </div>
      </div>

      {/* Table View */}
      <div className={`bg-white rounded-lg border border-black shadow-sm overflow-hidden ${viewMode === 'card' ? 'hidden md:block' : 'block'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-indigo-600 border-b border-indigo-700">
                <th className={thClass}>S.No.</th>
                <th className={`${thClass} text-left`}>Vendor Name</th>
                <th className={thClass}>GST Number</th>
                <th className={thClass}>Email</th>
                <th className={thClass}>Mobile</th>
                <th className={thClass}>Address</th>
                <th className={`${thClass} text-center`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black">
              {paginatedVendors.map((item, index) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className={tdClass}>{(currentPage - 1) * itemsPerPage + index + 1}</td>
                  <td className={`${tdClass} text-left font-medium`}>{item.name}</td>
                  <td className={tdClass}>{item.gstNumber || '-'}</td>
                  <td className={tdClass}>{item.email}</td>
                  <td className={tdClass}>{item.mobile}</td>
                  <td className={`${tdClass} max-w-[200px] truncate`} title={item.address}>{item.address}</td>
                  <td className={`${tdClass} text-center`}>
                    <div className="flex items-center justify-center space-x-3">
                      <button 
                        onClick={() => handleEditClick(item)}
                        className="text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 p-1.5 rounded-md border border-indigo-100"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        type="button"
                        onClick={() => onDeleteVendor(item.id)}
                        className="text-red-500 hover:text-red-700 transition-colors bg-red-50 p-1.5 rounded-md border border-red-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedVendors.length === 0 && (
                <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                        No vendors found. Add a new vendor to get started.
                    </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className={`space-y-4 md:hidden ${viewMode === 'card' ? 'block' : 'hidden'}`}>
        {paginatedVendors.map((item) => (
             <div key={item.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                 <div className="flex justify-between items-start mb-3">
                    <h3 className="font-bold text-lg text-indigo-600">{item.name}</h3>
                    {item.gstNumber && <span className="px-2 py-0.5 bg-gray-100 text-[10px] font-bold text-gray-600 rounded border border-gray-200 uppercase">GST: {item.gstNumber}</span>}
                 </div>
                 <div className="space-y-2 text-sm text-gray-600 mb-4">
                     {item.email && <div className="flex items-center gap-2"><Mail size={14} className="text-gray-400" /><span className="truncate">{item.email}</span></div>}
                     {item.mobile && <div className="flex items-center gap-2"><Phone size={14} className="text-gray-400" /><span>{item.mobile}</span></div>}
                     {item.address && <div className="flex items-start gap-2"><MapPin size={14} className="text-gray-400 mt-0.5" /><span className="flex-1">{item.address}</span></div>}
                </div>
                 <div className="flex gap-2 pt-3 border-t border-gray-100">
                     <button onClick={() => handleEditClick(item)} className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"><Edit2 size={16} />Edit</button>
                     <button onClick={() => onDeleteVendor(item.id)} className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"><Trash2 size={16} />Delete</button>
                 </div>
             </div>
        ))}
         {vendors.length === 0 && <div className="text-center py-8 text-gray-500 bg-white rounded-lg border border-gray-200">No vendors found.</div>}
      </div>

      <div className="flex justify-between items-center text-xs text-indigo-600 font-bold px-1 uppercase tracking-wider">
          <span>Showing {startEntry} to {endEntry} of {filteredVendors.length} entries</span>
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

      <AddVendorModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={onAddVendor} 
        vendors={vendors}
      />
      <EditVendorModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        vendor={selectedVendor}
        onSave={onEditVendor}
        vendors={vendors}
      />
    </div>
  );
};

