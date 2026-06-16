import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Clock } from 'lucide-react';
import { Task, User, Vendor } from '../types';
import { SearchableSelect } from './SearchableSelect';
import { useLabels } from '../labelOverrides';

interface UpdateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  onUpdate: (task: Task) => void;
  users: User[];
  vendors?: Vendor[];
  statusOptions: string[];
}

export const UpdateTaskModal: React.FC<UpdateTaskModalProps> = ({ isOpen, onClose, task, onUpdate, users = [], vendors = [], statusOptions = [] }) => {
  const { getFieldLabel } = useLabels();
  const [formData, setFormData] = useState<Partial<Task>>({});
  const [reassignSelection, setReassignSelection] = useState<string | string[]>([]);
  const [remarksInput, setRemarksInput] = useState<string>('');
  const [hoursInput, setHoursInput] = useState<string>('0');
  const [goalInput, setGoalInput] = useState<string>('');
  const [photosInput, setPhotosInput] = useState<string[]>([]);
  const [pdfInput, setPdfInput] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isConfirming, setIsConfirming] = useState(false);

  const isVendorTask = task ? !!task.vendor && task.vendor.trim() !== '' : false;
  const hasTaskGoal = task ? String(task.goal ?? '').trim() !== '' : false;

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const parsePhotos = (rawPhotos?: string): string[] => {
    if (!rawPhotos) return [];
    try {
      const parsed = JSON.parse(rawPhotos);
      return Array.isArray(parsed) ? parsed.filter(photo => typeof photo === 'string' && photo.trim() !== '') : [];
    } catch {
      return [];
    }
  };

	  useEffect(() => {
	    if (task) {
	      setFormData({
	        status: task.status,
	      });
	      setRemarksInput('');
	      setHoursInput('0');
	      // Goal/Photo/PDF updates should be stored only in action_logs (not the task master row),
	      // so start these fields empty for each update.
	      setGoalInput('');
	      setPhotosInput([]);
	      setPdfInput('');
	      setReassignSelection(isVendorTask ? '' : []);
	      setError('');
	      setIsConfirming(false);
	    }
	  }, [task, isOpen, isVendorTask]);

  if (!isOpen || !task) return null;

  const userOptions = users.filter(u => u.isActive).map(u => ({ value: u.name, label: u.name }));
  const vendorOptions = vendors.map(v => ({ value: v.name, label: v.name }));

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleRemarkChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setRemarksInput(e.target.value);
  }

  const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setHoursInput(e.target.value);
  }

  const handleGoalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.replace(/[^\d.]/g, '');
      setGoalInput(value);
  }

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate first
    if ((formData.status === 'In Progress' || formData.status === 'Pending for Client' || formData.status === 'Pending for Owner') && (!remarksInput || remarksInput.trim() === '')) {
      setError('Remarks are required for this status change');
      return;
    }

    setIsConfirming(true);
  };

  const handleFinalSubmit = () => {
    if (hasTaskGoal && goalInput.trim() === '') {
      setError('Achieved is required when Goal is set.');
      setIsConfirming(false);
      return;
    }

    const updatedTask: Task = { 
        ...task, 
        status: formData.status as any,
        lastUpdateRemarks: remarksInput,
        hours: Number(hoursInput || 0), // This will be handled as "New hours logged" by server
        goal: goalInput,
        photos: JSON.stringify(photosInput || []),
        pdf: pdfInput || '',
    };
    
    const hasReassignment = Array.isArray(reassignSelection) 
      ? reassignSelection.length > 0 
      : (typeof reassignSelection === 'string' && reassignSelection.trim() !== '');

    if (hasReassignment) {
        if (isVendorTask) {
             updatedTask.vendor = Array.isArray(reassignSelection) ? reassignSelection[0] : reassignSelection;
        } else {
             updatedTask.assignees = Array.isArray(reassignSelection) ? reassignSelection.join(', ') : reassignSelection;
        }
    }

    onUpdate(updatedTask);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-opacity">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg animate-in fade-in zoom-in duration-200">
        
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-indigo-600">{isConfirming ? 'Confirm Status Update' : 'Update Status'}</h2>
            {!isConfirming && <p className="text-sm font-bold text-gray-500 mt-1 line-clamp-1">{task.title}</p>}
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {isConfirming ? (
          <div className="p-6 space-y-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="p-4 bg-indigo-50 rounded-full text-indigo-600">
                <AlertTriangle size={48} />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Are you sure?</h3>
              <p className="text-sm text-gray-500">You are updating the status for:<br/><span className="font-bold text-indigo-600">{task.title}</span></p>
            </div>
            <div className="flex gap-3 pt-4">
              <button onClick={() => setIsConfirming(false)} className="flex-1 px-6 py-3 text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors uppercase tracking-wider">Cancel</button>
              <button onClick={handleFinalSubmit} className="flex-1 px-6 py-3 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg transition-all uppercase tracking-wider">Confirm</button>
            </div>
          </div>
        ) : (
	          <form onSubmit={handlePreSubmit}>
	            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              
              {error && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 font-bold">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
	                  <label className="text-sm font-medium text-gray-900 block mb-1">{getFieldLabel('task.status', 'Status')} <span className="text-red-500">*</span></label>
                  <select 
                      name="status"
                      required
                      value={formData.status}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 outline-none"
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                </div>
                <div className="space-y-1">
	                  <label className="text-sm font-medium text-gray-900 block mb-1">{getFieldLabel('task.minutesLogged', 'Minutes Logged')}</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      step="1" 
                      min="0"
                      value={hoursInput}
                      onChange={handleHoursChange}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 outline-none"
                    />
                    <Clock size={16} className="absolute left-3 top-3.5 text-gray-400" />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
	                <label className="text-sm font-medium text-gray-900 block mb-1">
	                  {getFieldLabel('task.lastUpdateRemarks', 'Update Remark')} <span className="text-red-500">*</span>
	                </label>
                <textarea 
                  name="remarks"
                  rows={3}
                  placeholder="What was done?"
                  value={remarksInput}
                  onChange={handleRemarkChange}
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 outline-none text-gray-900 resize-none"
                ></textarea>
              </div>

              {hasTaskGoal && (
                <div className="space-y-1">
	                  <label className="text-sm font-medium text-gray-900 block mb-1">{getFieldLabel('task.achieved', 'Achieved')} <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={goalInput}
                    onChange={handleGoalChange}
                    placeholder="Enter achieved value"
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 outline-none text-gray-900"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
	                  <label className="text-sm font-medium text-gray-900 block mb-1">{getFieldLabel('task.photos', 'Photo')}</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) {
                        setPhotosInput([]);
                        return;
                      }
                      const photoData = await readFileAsDataUrl(file);
                      setPhotosInput([photoData]);
                      setError('');
                    }}
                    className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm"
                  />
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{photosInput.length > 0 ? 'Photo selected' : 'No photo selected'}</span>
                    {photosInput.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setPhotosInput([])}
                        className="text-red-500 hover:text-red-700 font-medium"
                      >
                        Clear Photos
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
	                  <label className="text-sm font-medium text-gray-900 block mb-1">{getFieldLabel('task.pdf', 'PDF')}</label>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const pdfData = await readFileAsDataUrl(file);
                      setPdfInput(pdfData);
                    }}
                    className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm"
                  />
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{pdfInput ? 'PDF selected' : 'No PDF selected'}</span>
                    {pdfInput && (
                      <button
                        type="button"
                        onClick={() => setPdfInput('')}
                        className="text-red-500 hover:text-red-700 font-medium"
                      >
                        Clear PDF
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {(formData.status === 'In Progress' || formData.status === 'Pending for Client' || formData.status === 'Pending for Owner') && (
                <div className="space-y-1">
	                  <SearchableSelect 
	                      label={isVendorTask ? "Reassign Vendor" : "Reassign User"}
	                      labelKey={isVendorTask ? "task.reassignVendor" : "task.reassignUser"}
	                      options={isVendorTask ? vendorOptions : userOptions}
	                      value={reassignSelection}
	                      onChange={setReassignSelection}
                      multiple={!isVendorTask} 
                      placeholder={isVendorTask ? "Select Vendor..." : "Select Assignees..."}
                  />
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end space-x-3">
              <button type="button" onClick={onClose} className="px-6 py-2.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg">Cancel</button>
              <button type="submit" className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm uppercase font-bold tracking-wider">Confirm Update</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
