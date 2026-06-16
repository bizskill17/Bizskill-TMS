import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Designation } from '../types';
import { useLabels } from '../labelOverrides';

interface AddDesignationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (designation: Omit<Designation, 'id'>) => boolean | Promise<boolean>;
  initialData?: Designation | null;
  designations: Designation[];
}

export const AddDesignationModal: React.FC<AddDesignationModalProps> = ({ isOpen, onClose, onSave, initialData, designations }) => {
  const { getFieldLabel } = useLabels();
  const [formData, setFormData] = useState({
    title: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialData) {
      setFormData({ title: initialData.title });
    } else {
      setFormData({ title: '' });
    }
    setError('');
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Uniqueness check
    const isDuplicate = designations.some(d => 
      d.id !== initialData?.id && 
      d.title.toLowerCase().trim() === formData.title.toLowerCase().trim()
    );

    if (isDuplicate) {
      setError('This designation already exists.');
      return;
    }

    const didSave = await onSave({ ...formData, description: '' });
    if (!didSave) {
      return;
    }

    setFormData({ title: '' });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-opacity">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-indigo-600">{initialData ? 'Edit Designation' : 'Add Designation'}</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-600">{getFieldLabel('designation.title', 'Title')} *</label>
              <input 
                name="title"
                type="text"
                required
                value={formData.title}
                onChange={handleChange}
                className={`w-full px-4 py-2.5 bg-white border rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none text-gray-600 ${error ? 'border-red-500' : 'border-gray-200'}`}
                placeholder="e.g. Developer"
              />
              {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
            </div>
          </div>
          <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-6 py-2.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">Cancel</button>
            <button type="submit" className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm">{initialData ? 'Save Changes' : 'Add Designation'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};
