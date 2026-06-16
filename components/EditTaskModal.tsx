
import React, { useState, useEffect } from 'react';
import { X, Plus, Info, AlertTriangle, Clock3 } from 'lucide-react';
import { Task, User, Category, Project, Vendor, VendorCategory, Firm, Client } from '../types';
import { SearchableSelect } from './SearchableSelect';
import { useLabels } from '../labelOverrides';

interface EditTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  onSave: (task: Task) => void;
  onAddCategory: () => void;
  onAddProject: () => void;
  onAddVendorCategory: () => void;
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

export const EditTaskModal: React.FC<EditTaskModalProps> = ({ 
  isOpen, 
  onClose, 
  task,
  onSave, 
  onAddCategory, 
  onAddProject,
  onAddVendorCategory,
  users, 
  categories, 
  projects, 
  firms,
  clients,
  vendors,
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
    owner: string;
    project: string; // Combined 'Project Name (Client Name)'
    firm: string;
    category: string;
    dueDate: string;
    vendor: string;
    vendorCategory: string[]; 
    notes: string;
    priority: string;
    time: string;
    goal: number | '';
    photos: string[];
    pdf: string;
  }>({
    title: '',
    assignees: [],
    owner: '',
    project: '',
    firm: '',
    category: '',
    dueDate: '',
    vendor: '',
    vendorCategory: [],
    notes: '',
    priority: 'Medium',
    time: '',
    goal: '',
    photos: [],
    pdf: ''
  });
  const [isConfirming, setIsConfirming] = useState(false);

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  useEffect(() => {
    if (task && isOpen) {
        let formattedDate = task.dueDate || '';
        if (formattedDate.includes('/')) {
            const parts = formattedDate.split('/');
            if (parts.length === 3) {
                formattedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
        }

        // Project value should already be in 'Name (Client)' format from App.tsx normalization
        // If not, construct it for consistency in the selector
        let currentProjectValue = task.project || '';
        if (currentProjectValue && !currentProjectValue.includes('(') && task.clientName) {
            currentProjectValue = `${currentProjectValue.trim()} (${task.clientName.trim()})`;
        }

        let parsedPhotos: string[] = [];
        if (task.photos) {
            try {
                const decodedPhotos = JSON.parse(task.photos);
                if (Array.isArray(decodedPhotos)) {
                    parsedPhotos = decodedPhotos.filter(photo => typeof photo === 'string');
                }
            } catch {
                parsedPhotos = [];
            }
        }

        setFormData({
            title: task.title,
            assignees: task.assignees ? task.assignees.split(',').map(s => s.trim()) : [],
            owner: task.owner,
            project: currentProjectValue, // Use the combined format for project selector
            firm: task.firm || '',
            category: task.category || '',
            dueDate: formattedDate,
            vendor: task.vendor || '',
            vendorCategory: task.vendorCategory ? task.vendorCategory.split(',').map(s => s.trim()) : [],
            notes: task.remarks || '',
            priority: task.priority,
            time: task.time || '',
            goal: task.goal || '',
            photos: parsedPhotos,
            pdf: task.pdf || ''
        });
        setIsConfirming(false);
    }
  }, [task, isOpen]);

  // Handle instant pre-selection when props change (Category, Project etc)
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
    }
  }, [categories, projects, vendorCategories, isOpen, lastAddedCategory, lastAddedProject, lastAddedVendorCategory]);

  if (!isOpen || !task) return null;

  const isVendorMode = isVendorView || (!!task.vendor && task.vendor.trim() !== '');

  const activeUsers = users.filter(u => u.isActive);
  const userOptions = activeUsers.map(u => ({ value: u.name, label: u.name }));
  const projectOptions = projects.map(p => {
    const constructed = `${p.name.trim()} (${p.client.trim()})`;
    return { value: constructed, label: constructed };
  });
  const vendorOptions = vendors.map(v => ({ value: v.name, label: v.name }));
  const categoryOptions = categories.map(c => ({ value: c.name, label: c.name }));
  const vendorCategoryOptions = (vendorCategories || []).map(c => ({ value: c.name, label: c.name }));
  const clientOptions = Array.from(new Set([
    ...clients.map(c => String(c.name || '').trim()),
    ...firms.map(f => String(f.name || '').trim()),
    String(formData.firm || '').trim()
  ].filter(Boolean)))
    .sort((a, b) => a.localeCompare(b))
    .map(name => ({ value: name, label: name }));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const isFormValid = () => {
	    const basicValid = formData.title.trim() !== '' && 
	                       formData.owner !== '' && 
                         formData.firm !== '';

    if (isVendorMode) return basicValid && formData.vendor !== '';
    
    return basicValid && 
           formData.assignees.length > 0 && 
           formData.category !== '';
  };

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid()) return;
    setIsConfirming(true);
  };

  const handleFinalSave = () => {
    const updatedTask: Task = {
      ...task,
      title: formData.title,
      owner: formData.owner,
      remarks: formData.notes,
      dueDate: formData.dueDate,
      priority: formData.priority as any,
      project: formData.project, // Project is always saved as the combined string
      firm: formData.firm,
      time: formData.time,
      goal: formData.goal,
      photos: JSON.stringify(formData.photos || []),
      pdf: formData.pdf || ''
    };

    if (isVendorMode) {
        updatedTask.vendor = formData.vendor;
        updatedTask.vendorCategory = Array.isArray(formData.vendorCategory) ? formData.vendorCategory.join(', ') : formData.vendorCategory;
        // For vendor tasks, assignees and category should be empty
        updatedTask.assignees = '';
        updatedTask.category = ''; 
    } else {
        updatedTask.assignees = formData.assignees.join(', ');
        updatedTask.category = formData.category;
        // For non-vendor tasks, vendor fields should be empty
        updatedTask.vendor = '';
        updatedTask.vendorCategory = '';
    }

    onSave(updatedTask);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-opacity">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl animate-in fade-in zoom-in duration-200 border-2 border-indigo-400">
        
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-indigo-600">{isConfirming ? 'Confirm Changes' : (isVendorMode ? 'Edit Vendor Task' : 'Edit Task')}</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {isConfirming ? (
          <div className="p-8 space-y-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="p-4 bg-indigo-50 rounded-full text-indigo-600">
                <AlertTriangle size={48} />
              </div>
              <h3 className="text-xl font-bold text-black">Are you sure?</h3>
            </div>
            <div className="flex gap-4 pt-6">
              <button onClick={() => setIsConfirming(false)} className="flex-1 px-8 py-4 text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-2xl transition-colors uppercase tracking-widest border border-indigo-200">Go Back</button>
              <button onClick={handleFinalSave} className="flex-1 px-8 py-4 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-xl transition-all uppercase tracking-widest">Save Changes</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handlePreSubmit}>
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="w-full md:w-32">
                  <label className="text-sm font-medium text-black block mb-1">Date</label>
                  <input type="text" readOnly value={task.date} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-black cursor-not-allowed text-center font-medium" />
                </div>
                <div className="flex-1">
		              <label className="text-sm font-medium text-black block mb-1">{getFieldLabel('task.title', 'Task')} <span className="text-red-500">*</span></label>
                  <input name="title" type="text" required value={formData.title} onChange={handleChange} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none text-black font-medium" />
                </div>
                <div className="w-full md:w-56">
                  <label className="text-sm font-medium text-black block mb-1">Priority <span className="text-red-500">*</span></label>
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
                  {isVendorMode ? (
                      <>
                        <div className="space-y-1">
	                            <SearchableSelect label="Task Owner" labelKey="task.owner" options={userOptions} value={formData.owner} onChange={(val) => setFormData(prev => ({ ...prev, owner: val }))} multiple={false} placeholder="Select Owner..." required />
                        </div>
                        <div className="space-y-1">
	                            <SearchableSelect label="Vendor" labelKey="task.vendor" options={vendorOptions} value={formData.vendor} onChange={(val) => setFormData(prev => ({ ...prev, vendor: val }))} placeholder="Select Vendor..." required />
                        </div>
                        <div className="space-y-1">
	                            <label className="text-sm font-medium text-black block mb-1">{getFieldLabel('task.vendorCategory', 'Vendor Category')}</label>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <SearchableSelect
                                        options={vendorCategoryOptions}
                                        value={formData.vendorCategory}
                                        onChange={(val) => setFormData(prev => ({ ...prev, vendorCategory: val }))}
                                        multiple={true}
                                        placeholder="Select Categories..."
                                    />
                                </div>
                                <button type="button" onClick={onAddVendorCategory} className="px-3 py-2 text-gray-500 hover:text-indigo-600 border border-gray-200 hover:bg-indigo-50 rounded-lg h-[42px]"><Plus size={18} /></button>
                            </div>
                        </div>
                      </>
                  ) : (
                      <>
                        <div className="space-y-1">
	                            <SearchableSelect label="Assignees" labelKey="task.assignees" options={userOptions} value={formData.assignees} onChange={(val) => setFormData(prev => ({ ...prev, assignees: val }))} multiple={true} placeholder="Select Assignees..." required />
                        </div>
                        <div className="space-y-1">
	                            <SearchableSelect label="Task Owner" labelKey="task.owner" options={userOptions} value={formData.owner} onChange={(val) => setFormData(prev => ({ ...prev, owner: val }))} multiple={false} placeholder="Select Owner..." required />
                        </div>
                        <div className="space-y-1">
	                            <label className="text-sm font-medium text-black block mb-1">{getFieldLabel('task.category', 'Category')} <span className="text-red-500">*</span></label>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <SearchableSelect options={categoryOptions} value={formData.category} onChange={(val) => setFormData(prev => ({ ...prev, category: val }))} placeholder="Select Category..." required />
                                </div>
                                <button type="button" onClick={onAddCategory} className="px-3 py-2 text-gray-500 hover:text-indigo-600 border border-gray-200 hover:bg-indigo-50 rounded-lg h-[42px]"><Plus size={18} /></button>
                            </div>
                        </div>
                      </>
                  )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-black block mb-1">Due Date <span className="text-red-500">*</span></label>
                  <input name="dueDate" type="date" required value={formData.dueDate} onChange={handleChange} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none text-black font-medium" />
                </div>
              </div>
              
              <div className="space-y-1">
		              <label className="text-sm font-medium text-black block mb-1">{getFieldLabel('task.remarks', 'Notes')}</label>
                <textarea name="notes" rows={4} value={formData.notes} onChange={handleChange} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 outline-none text-black font-medium resize-none"></textarea>
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
                      className="w-full px-4 pr-10 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none text-black font-medium appearance-none [-webkit-appearance:none] [-moz-appearance:textfield] [background-image:none] [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none [&::-webkit-calendar-picker-indicator]:opacity-0"
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
	                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none text-black font-medium"
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
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{formData.photos.length > 0 ? 'Photo selected' : 'No photo selected'}</span>
                    {formData.photos.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, photos: [] }))}
                        className="text-red-500 hover:text-red-700 font-medium"
                      >
                        Clear Photos
                      </button>
                    )}
                  </div>
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
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{formData.pdf ? 'PDF selected' : 'No PDF selected'}</span>
                    {formData.pdf && (
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, pdf: '' }))}
                        className="text-red-500 hover:text-red-700 font-medium"
                      >
                        Clear PDF
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end space-x-3">
              <button type="button" onClick={onClose} className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">Cancel</button>
              {isFormValid() && (
                  <button type="submit" className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-md transition-all">Save Changes</button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
