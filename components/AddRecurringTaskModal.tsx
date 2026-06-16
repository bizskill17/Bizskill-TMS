import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { User, Category, RecurringTask, Firm, Client } from '../types';
import { SearchableSelect } from './SearchableSelect';
import { useLabels } from '../labelOverrides';

interface AddRecurringTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Omit<RecurringTask, 'id' | 'lastUpdatedOn' | 'lastUpdateRemarks'>) => Promise<void>;
  users: User[];
  categories: Category[];
  firms: Firm[];
  clients: Client[];
  initialData?: any;
}

export const AddRecurringTaskModal: React.FC<AddRecurringTaskModalProps> = ({ isOpen, onClose, onSave, users, categories, firms, clients, initialData }) => {
  const { getFieldLabel } = useLabels();
				  const [formData, setFormData] = useState<{
			    title: string;
          notes: string;
			    goal: number | '';
          firm: string;
          owner: string;
			    category: string;
		    assignee: string;
		    frequencyDays: number | '';
		    startDate: string;
		    time: string;
		    periodicity: 'Fixed Days' | 'Weekly' | 'Monthly' | 'Yearly';
		    recurrenceDay: number;
		    recurrenceMonth: string;
		  }>({
			    title: initialData?.name || '',
          notes: '',
			    goal: '',
          firm: '',
          owner: '',
			    category: '',
		    assignee: '',
		    frequencyDays: '',
		    startDate: new Date().toISOString().split('T')[0],
		    time: '',
		    periodicity: 'Fixed Days',
		    recurrenceDay: 1,
		    recurrenceMonth: 'January'
		  });

  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const userOptions = users.map(u => ({ value: u.name, label: u.name }));
  const categoryOptions = categories.map(c => ({ value: c.name, label: c.name }));
  const clientOptions = Array.from(new Set([
    ...clients.map(c => String(c.name || '').trim()),
    ...firms.map(f => String(f.name || '').trim())
  ].filter(Boolean)))
    .sort((a, b) => a.localeCompare(b))
    .map(name => ({ value: name, label: name }));
  const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate frequencyDays only for Fixed Days periodicity
    if (formData.periodicity === 'Fixed Days' && (formData.frequencyDays === '' || Number(formData.frequencyDays) <= 0)) {
      return;
    }

    // Prepare task data based on periodicity
			    const taskData: any = {
			      title: formData.title,
            notes: formData.notes,
			      goal: formData.goal,
            firm: formData.firm,
            owner: formData.owner,
		      category: formData.category,
		      assignee: formData.assignee,
		      startDate: formData.startDate,
		      time: formData.time,
		      periodicity: formData.periodicity,
		      recurrenceDay: formData.recurrenceDay,
		      // Only include frequencyDays for Fixed Days periodicity
		      frequencyDays: formData.periodicity === 'Fixed Days' ? Number(formData.frequencyDays) : 0,
          status: 'Not Yet Started'
		    };

    // Only include recurrenceMonth for Yearly periodicity
    if (formData.periodicity === 'Yearly') {
      taskData.recurrenceMonth = formData.recurrenceMonth;
    }

    setIsSaving(true);
    try {
      await onSave(taskData);

      // Reset form
      setFormData({
        title: '',
        notes: '',
        goal: '',
        firm: '',
        owner: '',
        category: '',
        assignee: '',
        frequencyDays: '',
        startDate: new Date().toISOString().split('T')[0],
        time: '',
        periodicity: 'Fixed Days',
        recurrenceDay: 1,
        recurrenceMonth: 'January'
      });
      onClose();
    } catch (error) {
      console.error('Failed to save recurring task:', error);
    } finally {
      setIsSaving(false);
    }
  };

	  const isFormValid = () => {
	    // Basic required fields validation
		    if (!formData.title.trim() || !formData.firm || !formData.owner || !formData.category || !formData.assignee || !formData.startDate) {
		      return false;
		    }
    
    // Periodicity-specific validation
    switch (formData.periodicity) {
      case 'Fixed Days':
        return formData.frequencyDays !== '' && Number(formData.frequencyDays) > 0;
      case 'Weekly':
        return formData.recurrenceDay >= 0 && formData.recurrenceDay <= 6;
      case 'Monthly':
        return formData.recurrenceDay >= 1 && formData.recurrenceDay <= 31;
      case 'Yearly':
        return formData.recurrenceDay >= 1 && formData.recurrenceDay <= 31 && 
               months.includes(formData.recurrenceMonth);
      default:
        return false;
    }
  };

  const handlePeriodicityChange = (value: string) => {
    const newPeriodicity = value as 'Fixed Days' | 'Weekly' | 'Monthly' | 'Yearly';
    
    // Reset form fields based on the new periodicity
    setFormData(prev => {
      const newState = {
        ...prev,
        periodicity: newPeriodicity,
        frequencyDays: newPeriodicity === 'Fixed Days' ? prev.frequencyDays : '',
        // Reset recurrenceDay to appropriate default for each periodicity
        recurrenceDay: newPeriodicity === 'Weekly' ? 0 : 1
      };

      // Reset recurrenceMonth if changing from Yearly to another periodicity
      if (prev.periodicity === 'Yearly' && newPeriodicity !== 'Yearly') {
        newState.recurrenceMonth = 'January';
      }

      return newState;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-opacity">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-indigo-600">New Recurring Task</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
	            <div className="space-y-1">
	              <label className="text-sm font-medium text-black">{getFieldLabel('recurringTask.title', 'Task')} <span className="text-red-500">*</span></label>
	              <input 
	                type="text"
	                required
                  disabled={isSaving}
		                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 outline-none appearance-none [-webkit-appearance:none] [-moz-appearance:textfield] [background-image:none] [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none [&::-webkit-calendar-picker-indicator]:opacity-0 disabled:bg-gray-50"
	                value={formData.title}
	                onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
	                placeholder="Enter task title"
	              />
	            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-black">{getFieldLabel('recurringTask.notes', 'Notes')}</label>
              <textarea 
                disabled={isSaving}
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 outline-none min-h-[100px] disabled:bg-gray-50"
                value={formData.notes}
                onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))}
                placeholder="Enter more details..."
              />
            </div>
		            <div className="space-y-1">
		              <label className="text-sm font-medium text-black">{getFieldLabel('recurringTask.goal', 'Goal')}</label>
		              <input
		                type="number"
                    min="0"
                    step="1"
                    disabled={isSaving}
		                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 outline-none disabled:bg-gray-50"
		                value={formData.goal}
		                onChange={(e) => setFormData(p => ({ ...p, goal: e.target.value === '' ? '' : Number(e.target.value) }))}
			                placeholder=""
		              />
		            </div>
            <SearchableSelect 
              label="Client"
              options={clientOptions}
              value={formData.firm}
              onChange={(val) => setFormData(p => ({ ...p, firm: val }))}
              required
              placeholder="Select client"
              disabled={isSaving}
            />
            <SearchableSelect 
              label="Owner"
              options={userOptions}
              value={formData.owner}
              onChange={(val) => setFormData(p => ({ ...p, owner: val }))}
              required
              placeholder="Select owner"
              disabled={isSaving}
            />
	            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
		              <SearchableSelect 
		                label="Category"
		                labelKey="recurringTask.category"
		                options={categoryOptions}
		                value={formData.category}
	                onChange={(val) => setFormData(p => ({ ...p, category: val }))}
                required
                placeholder="Select category"
                disabled={isSaving}
              />
              <SearchableSelect 
                label="Assignee"
                options={userOptions}
                value={formData.assignee}
                onChange={(val) => setFormData(p => ({ ...p, assignee: val }))}
                required
                placeholder="Select assignee"
                disabled={isSaving}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-black">{getFieldLabel('recurringTask.period', 'Period')} <span className="text-red-500">*</span></label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'Fixed Days', label: 'Fixed Interval' },
                  { value: 'Weekly', label: 'Weekly' },
                  { value: 'Monthly', label: 'Monthly' },
                  { value: 'Yearly', label: 'Yearly' }
                ].map((periodOption) => (
                  <button
                    key={periodOption.value}
                    type="button"
                    disabled={isSaving}
                    onClick={() => handlePeriodicityChange(periodOption.value)}
                    className={`px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                      formData.periodicity === periodOption.value
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50'
                    } disabled:opacity-50`}
                  >
                    {periodOption.label}
                  </button>
                ))}
              </div>
            </div>

            {formData.periodicity === 'Fixed Days' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-black">{getFieldLabel('recurringTask.frequencyDays', 'Frequency (Days)')} <span className="text-red-500">*</span></label>
                  <input 
                    type="number"
                    required
                    min="1"
                    disabled={isSaving}
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 outline-none disabled:bg-gray-50"
                    value={formData.frequencyDays}
                    onChange={(e) => setFormData(p => ({ 
                      ...p, 
                      frequencyDays: e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1)
                    }))}
                    placeholder="Enter number of days"
                  />
                </div>
              </div>
            ) : null}

            {formData.periodicity === 'Weekly' && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-black">{getFieldLabel('recurringTask.dayOfWeek', 'Day of Week')} <span className="text-red-500">*</span></label>
                <select 
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 outline-none disabled:bg-gray-50"
                  value={formData.recurrenceDay}
                  disabled={isSaving}
                  onChange={(e) => setFormData(p => ({ 
                    ...p, 
                    recurrenceDay: parseInt(e.target.value) 
                  }))}
                >
                  {weekDays.map((day, idx) => (
                    <option key={day} value={idx}>{day}</option>
                  ))}
                </select>
              </div>
            )}

            {formData.periodicity === 'Monthly' && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-black">{getFieldLabel('recurringTask.dayOfMonth', 'Day of Month (1-31)')} <span className="text-red-500">*</span></label>
                <input 
                  type="number"
                  required
                  min="1"
                  max="31"
                  disabled={isSaving}
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 outline-none disabled:bg-gray-50"
                  value={formData.recurrenceDay}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 1;
                    setFormData(p => ({ 
                      ...p, 
                      recurrenceDay: Math.min(31, Math.max(1, value))
                    }));
                  }}
                />
              </div>
            )}

            {formData.periodicity === 'Yearly' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-black">{getFieldLabel('recurringTask.month', 'Month')} <span className="text-red-500">*</span></label>
                  <select 
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 outline-none disabled:bg-gray-50"
                    value={formData.recurrenceMonth}
                    disabled={isSaving}
                    onChange={(e) => setFormData(p => ({ 
                      ...p, 
                      recurrenceMonth: e.target.value 
                    }))}
                  >
                    {months.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-black">{getFieldLabel('recurringTask.day', 'Day (1-31)')} <span className="text-red-500">*</span></label>
                  <input 
                    type="number"
                    required
                    min="1"
                    max="31"
                    disabled={isSaving}
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 outline-none disabled:bg-gray-50"
                    value={formData.recurrenceDay}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 1;
                      setFormData(p => ({ 
                        ...p, 
                        recurrenceDay: Math.min(31, Math.max(1, value))
                      }));
                    }}
                  />
                </div>
              </div>
            )}

	            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
	              <div className="space-y-1">
	                <label className="text-sm font-medium text-black">{getFieldLabel('recurringTask.startDate', 'Start Date')} <span className="text-red-500">*</span></label>
	                <input 
	                  type="date"
	                  required
                    disabled={isSaving}
	                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 outline-none disabled:bg-gray-50"
	                  value={formData.startDate}
	                  onChange={(e) => setFormData(p => ({ ...p, startDate: e.target.value }))}
	                />
	              </div>

		              <div className="space-y-1">
		                <label className="text-sm font-medium text-black">{getFieldLabel('recurringTask.time', 'Time')}</label>
		                <input
		                  type="time"
                      disabled={isSaving}
		                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 outline-none disabled:bg-gray-50"
		                  value={formData.time}
		                  onChange={(e) => setFormData(p => ({ ...p, time: e.target.value }))}
		                />
		              </div>
	            </div>
	          </div>
	          <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end space-x-3">
	            <button 
	              type="button" 
	              onClick={onClose} 
                disabled={isSaving}
              className="px-6 py-2.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSaving || !isFormValid()}
              className={`px-6 py-2.5 text-sm font-medium rounded-lg shadow-sm transition-colors flex items-center justify-center min-w-[140px] ${
                isFormValid() 
                  ? 'text-white bg-indigo-600 hover:bg-indigo-700' 
                  : 'text-gray-400 bg-gray-200 cursor-not-allowed'
              } disabled:opacity-70`}
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                'Save Task'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
