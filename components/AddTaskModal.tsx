
import React, { useState, useEffect } from 'react';
import { X, Plus, Clock3 } from 'lucide-react';
import { Task, User, Category, Project, Vendor, VendorCategory, Firm, Client } from '../types';
import { SearchableSelect } from './SearchableSelect';
import { useLabels } from '../labelOverrides';

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Omit<Task, 'id' | 'status' | 'date'>) => void;
  onAddCategory: () => void;
  onAddProject: () => void;
  onAddVendorCategory?: () => void;
  users: User[];
  categories: Category[];
  projects: Project[];
  firms: Firm[];
  clients: Client[];
  vendors: Vendor[];
  vendorCategories?: VendorCategory[];
  isVendorView?: boolean;
  lastAddedCategory?: string;
  lastAddedProject?: string;
  lastAddedVendorCategory?: string;
  onClearLastAdded?: () => void;
}

export const AddTaskModal: React.FC<AddTaskModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  onAddCategory, 
  onAddProject,
  onAddVendorCategory,
  users, 
  categories = [], 
  projects = [],
  firms = [],
  clients = [],
  vendors = [],
  vendorCategories = [],
  isVendorView = false,
  lastAddedCategory = '',
  lastAddedProject = '',
  lastAddedVendorCategory = '',
  onClearLastAdded
}) => {
  const { getFieldLabel } = useLabels();
  const [formData, setFormData] = useState<{
    title: string;
    assignees: string[]; 
    category: string;
    dueDate: string;
    priority: string;
    owner: string; 
    project: string; // Combined 'Project Name (Client Name)'
    firm: string;
    vendor: string;
    vendorCategory: string[]; 
    notes: string;
    time: string;
    goal: number | '';
    photos: string[];
    pdf: string;
  }>({
    title: '',
    assignees: [],
    category: '',
    dueDate: '',
    priority: 'Medium',
    owner: 'PANKAJ KUMAR JAIN',
    project: '',
    firm: '',
    vendor: '',
    vendorCategory: [],
    notes: '',
    time: '',
    goal: '',
    photos: [],
    pdf: ''
  });

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  useEffect(() => {
    if (isOpen) {
        if (lastAddedCategory) {
            setFormData(prev => ({ ...prev, category: lastAddedCategory }));
            onClearLastAdded?.();
        }
        if (lastAddedProject) {
            setFormData(prev => ({ ...prev, project: lastAddedProject }));
            onClearLastAdded?.();
        }
        if (lastAddedVendorCategory) {
            setFormData(prev => {
                const current = Array.isArray(prev.vendorCategory) ? prev.vendorCategory : [];
                return { ...prev, vendorCategory: [...current, lastAddedVendorCategory] };
            });
            onClearLastAdded?.();
        }
        // Ensure that if it's a vendor view, assignees are cleared
        if (isVendorView) {
            setFormData(prev => ({ ...prev, assignees: [] }));
        } else {
            // For non-vendor view, clear vendor fields
            setFormData(prev => ({ ...prev, vendor: '', vendorCategory: [] }));
        }
    }
  }, [categories, projects, vendorCategories, isOpen, lastAddedCategory, lastAddedProject, lastAddedVendorCategory, isVendorView]);

  if (!isOpen) return null;

  const activeUsers = users.filter(u => u.isActive);
  const userOptions = activeUsers.map(u => ({ value: u.name, label: u.name }));
  const categoryOptions = categories.map(c => ({ value: c.name, label: c.name }));
  
  // Robust project option generation
  const projectOptions = (projects || []).map(p => {
      const projName = String(p.name || '').trim();
      const clientName = String(p.client || '').trim();
      const uniqueValue = clientName ? `${projName} (${clientName})` : projName;
      return { value: uniqueValue, label: uniqueValue };
  });

  const vendorOptions = vendors.map(v => ({ value: v.name, label: v.name }));
  const vendorCategoryOptions = (vendorCategories || []).map(c => ({ value: c.name, label: c.name }));
  const clientOptions = Array.from(new Set([
    ...clients.map(c => String(c.name || '').trim()),
    ...firms.map(f => String(f.name || '').trim())
  ].filter(Boolean)))
    .sort((a, b) => a.localeCompare(b))
    .map(name => ({ value: name, label: name }));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const isFormValid = () => {
	    const basicValid = formData.title.trim() !== '' &&
	        formData.priority !== '' &&
	        formData.owner !== '' &&
	        formData.dueDate !== '' &&
          formData.firm !== '';
    
    if (isVendorView) {
        return basicValid && formData.vendor !== '' && formData.vendorCategory.length > 0;
    }

    return basicValid &&
        formData.assignees.length > 0 &&
        formData.category !== '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid()) return;
    
    const taskPayload: any = {
      title: formData.title,
      priority: formData.priority as any,
      dueDate: formData.dueDate,
      remarks: formData.notes,
      owner: formData.owner,
      project: formData.project, // Project is always included now
      firm: formData.firm,
      time: formData.time,
      goal: formData.goal,
      photos: JSON.stringify(formData.photos || []),
      pdf: formData.pdf || '',
    };

    if (isVendorView) {
        taskPayload.vendor = formData.vendor;
        taskPayload.vendorCategory = Array.isArray(formData.vendorCategory) ? formData.vendorCategory.join(', ') : formData.vendorCategory;
        // For vendor tasks, assignees and category should be empty
        taskPayload.assignees = '';
        taskPayload.category = ''; 
    } else {
        taskPayload.assignees = formData.assignees.join(', ');
        taskPayload.category = formData.category;
        // For non-vendor tasks, vendor fields should be empty
        taskPayload.vendor = '';
        taskPayload.vendorCategory = '';
    }

    onSave(taskPayload);
    
    setFormData({
      title: '',
      assignees: [],
      category: '',
      dueDate: '',
      priority: 'Medium',
      owner: 'PANKAJ KUMAR JAIN',
	      project: '',
	      firm: '',
      vendor: '',
      vendorCategory: [],
      notes: '',
      time: '',
      goal: '',
      photos: [],
      pdf: ''
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-opacity">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl animate-in fade-in zoom-in duration-200">
        
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-indigo-600">{isVendorView ? 'Add Vendor Task' : 'Add Task'}</h2>
          <button 
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-4 md:p-6 space-y-5 max-h-[70vh] overflow-y-auto">
            
		            <div className="space-y-1">
		              <label className="text-sm font-medium text-black block mb-1">{getFieldLabel('task.title', 'Task')} <span className="text-red-500">*</span></label>
		              <input 
	                name="title"
	                type="text"
	                required
	                placeholder="Enter task title"
	                value={formData.title}
	                onChange={handleChange}
	                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none text-black placeholder-gray-500"
	              />
	            </div>

		            <div className="space-y-1">
		              <label className="text-sm font-medium text-black block mb-1">{getFieldLabel('task.remarks', 'Notes')}</label>
		              <textarea 
	                name="notes"
	                rows={4}
	                value={formData.notes}
	                onChange={handleChange}
	                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none text-black resize-none"
	              ></textarea>
	            </div>

		            <div className="flex flex-col md:flex-row gap-4">
		              <div className="w-full md:w-72">
		                <label className="text-sm font-medium text-black block mb-1">{getFieldLabel('task.priority', 'Priority')} <span className="text-red-500">*</span></label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['High', 'Medium', 'Low'] as const).map((priorityOption) => (
                      <button
                        key={priorityOption}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, priority: priorityOption }))}
                        className={`px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                          formData.priority === priorityOption
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50'
                        }`}
                      >
                        {priorityOption}
                      </button>
                    ))}
                  </div>
	              </div>
	            </div>

		            <div className="space-y-1">
                    <SearchableSelect
                      label="Client"
                      options={clientOptions}
                      value={formData.firm}
                      onChange={(val) => setFormData(prev => ({ ...prev, firm: val }))}
                      placeholder="Select Client..."
                      required
                    />
			            </div>

	            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
	                {isVendorView ? (
	                    <>
	                        <div className="space-y-1">
	                            <SearchableSelect
	                                label="Task Owner"
	                                labelKey="task.owner"
	                                options={userOptions}
	                                value={formData.owner}
	                                onChange={(val) => setFormData(prev => ({ ...prev, owner: val }))}
	                                multiple={false}
	                                placeholder="Select Owner..."
	                                required
	                            />
	                        </div>
	                        <div className="space-y-1">
	                            <SearchableSelect
	                                label="Vendor"
	                                labelKey="task.vendor"
	                                options={vendorOptions}
	                                value={formData.vendor}
	                                onChange={(val) => setFormData(prev => ({ ...prev, vendor: val }))}
	                                placeholder="Select Vendor..."
	                                required
	                            />
	                        </div>
	                        <div className="space-y-1">
	                            <label className="text-sm font-medium text-black block mb-1">{getFieldLabel('task.vendorCategory', 'Vendor Category')} <span className="text-red-500">*</span></label>
	                            <div className="flex gap-2">
	                                <div className="flex-1">
	                                    <SearchableSelect
	                                        options={vendorCategoryOptions}
	                                        value={formData.vendorCategory}
	                                        onChange={(val) => setFormData(prev => ({ ...prev, vendorCategory: val }))}
	                                        multiple={true}
	                                        placeholder="Select Categories..."
	                                        required
	                                    />
	                                </div>
	                                <button type="button" onClick={onAddVendorCategory} className="px-3 py-2 text-gray-500 hover:text-indigo-600 border border-gray-200 hover:bg-indigo-50 rounded-lg h-[42px]"><Plus size={18} /></button>
	                            </div>
	                        </div>
	                        <div className="space-y-1">
	                            <label className="text-sm font-medium text-black block mb-1">Due Date <span className="text-red-500">*</span></label>
	                            <input 
	                                name="dueDate"
	                                type="date" 
	                                required
	                                value={formData.dueDate}
	                                onChange={handleChange}
	                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none text-black"
	                            />
	                        </div>
	                    </>
	                ) : (
	                    <>
	                        <div className="space-y-1">
	                            <SearchableSelect
	                                label="Assignees"
	                                labelKey="task.assignees"
	                                options={userOptions}
	                                value={formData.assignees}
	                                onChange={(val) => setFormData(prev => ({ ...prev, assignees: val }))}
	                                multiple={true}
	                                placeholder="Select Assignees..."
	                                required
	                            />
	                        </div>
	                        <div className="space-y-1">
	                            <SearchableSelect
	                                label="Task Owner"
	                                labelKey="task.owner"
	                                options={userOptions}
	                                value={formData.owner}
	                                onChange={(val) => setFormData(prev => ({ ...prev, owner: val }))}
	                                multiple={false}
	                                placeholder="Select Owner..."
	                                required
	                            />
	                        </div>
	                        <div className="space-y-1">
	                            <label className="text-sm font-medium text-black block mb-1">{getFieldLabel('task.category', 'Category')} <span className="text-red-500">*</span></label>
	                            <div className="flex gap-2">
	                                <div className="flex-1">
	                                    <SearchableSelect
	                                        options={categoryOptions}
	                                        value={formData.category}
	                                        onChange={(val) => setFormData(prev => ({ ...prev, category: val }))}
	                                        placeholder="Select Category..."
	                                        required
	                                    />
	                                </div>
	                                <button type="button" onClick={onAddCategory} className="px-3 py-2 text-gray-500 hover:text-indigo-600 border border-gray-200 hover:bg-indigo-50 rounded-lg h-[42px]"><Plus size={18} /></button>
	                            </div>
	                        </div>

	                        <div className="space-y-1">
	                            <label className="text-sm font-medium text-black block mb-1">Due Date <span className="text-red-500">*</span></label>
	                            <input 
	                                name="dueDate"
	                                type="date" 
	                                required
	                                value={formData.dueDate}
	                                onChange={handleChange}
	                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none text-black"
	                            />
	                        </div>
	                    </>
	                )}
	            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-black block mb-1">Time</label>
                <div className="relative">
                  <input
                    name="time"
                    type="time"
                    value={formData.time}
                    onChange={handleChange}
                    className="w-full px-4 pr-10 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none text-black appearance-none [-webkit-appearance:none] [-moz-appearance:textfield] [background-image:none] [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none [&::-webkit-calendar-picker-indicator]:opacity-0"
                  />
                  <Clock3 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-black pointer-events-none" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-black block mb-1">Goal</label>
	                <input
	                  name="goal"
	                  type="number"
                    min="0"
                    step="1"
	                  value={formData.goal}
	                  onChange={(e) => setFormData(prev => ({ ...prev, goal: e.target.value === '' ? '' : Number(e.target.value) }))}
	                  placeholder="Enter goal"
	                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none text-black"
	                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-black block mb-1">Photo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) {
                      setFormData(prev => ({ ...prev, photos: [] }));
                      return;
                    }
                    const photoData = await readFileAsDataUrl(file);
                    setFormData(prev => ({ ...prev, photos: [photoData] }));
                  }}
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm"
                />
                <p className="text-xs text-gray-500">{formData.photos.length > 0 ? 'Photo selected' : 'No photo selected'}</p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-black block mb-1">PDF</label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const pdfData = await readFileAsDataUrl(file);
                    setFormData(prev => ({ ...prev, pdf: pdfData }));
                  }}
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm"
                />
                <p className="text-xs text-gray-500">{formData.pdf ? 'PDF selected' : 'No PDF selected'}</p>
              </div>
            </div>
          </div>

          <div className="p-4 md:p-6 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">Cancel</button>
            {isFormValid() && (
                <button type="submit" className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm focus:ring-2 focus:ring-indigo-500 transition-all">Save Task</button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
