
import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { User, Category, RecurringTask, Firm, Client } from '../types';
import { SearchableSelect } from './SearchableSelect';
import { useLabels } from '../labelOverrides';

interface EditRecurringTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: RecurringTask) => Promise<void>;
  task: RecurringTask | null;
  users: User[];
  categories: Category[];
  firms: Firm[];
  clients: Client[];
}

export const EditRecurringTaskModal: React.FC<EditRecurringTaskModalProps> = ({ isOpen, onClose, onSave, task, users, categories, firms, clients }) => {
  const { getFieldLabel } = useLabels();
  const parseToISO = (str: string) => {
    if (!str) return '';
    const trimmed = str.trim();
    if (!trimmed) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.split(/[ T]/)[0];
    const match = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
    return trimmed;
  };

	  // Fix: Explicitly define periodicity type to avoid 'Fixed Days' narrowing
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
			    status: string;
			    periodicity: 'Fixed Days' | 'Weekly' | 'Monthly' | 'Yearly';
			    recurrenceDay: number;
			    recurrenceMonth: string;
			  }>({
			    title: '',
          notes: '',
			    goal: '',
			    firm: '',
          owner: '',
			    category: '',
			    assignee: '',
			    frequencyDays: '',
			    startDate: '',
			    time: '',
			    status: 'In Progress',
			    periodicity: 'Fixed Days',
			    recurrenceDay: 1,
			    recurrenceMonth: 'January'
			  });

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (task && isOpen) {
      setFormData({
        title: task.title,
        notes: task.notes || '',
        goal: (task.goal as any) || '',
        firm: task.firm || '',
        owner: task.owner || '',
        category: task.category,
        assignee: task.assignee,
        frequencyDays: task.frequencyDays,
        startDate: parseToISO(task.startDate),
        time: task.time || '',
        status: String(task.status || 'In Progress'),
        periodicity: task.periodicity || 'Fixed Days',
        recurrenceDay: task.recurrenceDay ?? 1,
        recurrenceMonth: task.recurrenceMonth || 'January'
      });
    }
  }, [task, isOpen]);

  if (!isOpen || !task) return null;

  const userOptions = users.map(u => ({ value: u.name, label: u.name }));
  const categoryOptions = categories.map(c => ({ value: c.name, label: c.name }));
  const clientOptions = Array.from(new Set([
    ...clients.map(c => String(c.name || '').trim()),
    ...firms.map(f => String(f.name || '').trim()),
    String(formData.firm || '').trim()
  ].filter(Boolean)))
    .sort((a, b) => a.localeCompare(b))
    .map(name => ({ value: name, label: name }));
  const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const handlePeriodChange = (value: 'Fixed Days' | 'Weekly' | 'Monthly' | 'Yearly') => {
    setFormData(prev => ({
      ...prev,
      periodicity: value,
      frequencyDays: value === 'Fixed Days' ? prev.frequencyDays : '',
      recurrenceDay: value === 'Weekly' ? 0 : 1,
      recurrenceMonth: value === 'Yearly' ? prev.recurrenceMonth : 'January'
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.frequencyDays === '') return;

    setIsSaving(true);
    try {
      await onSave({
        ...task,
        ...formData,
        frequencyDays: Number(formData.frequencyDays)
      });
      onClose();
    } catch (error) {
      console.error('Failed to save recurring task:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-opacity">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-indigo-600">Edit Recurring Task</h2>
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
                disabled={isSaving}
              />
              <SearchableSelect 
                label="Assignee"
                options={userOptions}
                value={formData.assignee}
                onChange={(val) => setFormData(p => ({ ...p, assignee: val }))}
                required
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
                    onClick={() => handlePeriodChange(periodOption.value as any)}
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
                    onChange={(e) => setFormData(p => ({ ...p, frequencyDays: e.target.value === '' ? '' : parseInt(e.target.value) }))}
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
                  onChange={(e) => setFormData(p => ({ ...p, recurrenceDay: parseInt(e.target.value) }))}
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
                  onChange={(e) => setFormData(p => ({ ...p, recurrenceDay: Math.min(31, Math.max(1, parseInt(e.target.value) || 1)) }))}
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
                    onChange={(e) => setFormData(p => ({ ...p, recurrenceMonth: e.target.value }))}
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
                    onChange={(e) => setFormData(p => ({ ...p, recurrenceDay: Math.min(31, Math.max(1, parseInt(e.target.value) || 1)) }))}
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
	            <button type="button" disabled={isSaving} onClick={onClose} className="px-6 py-2.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50">Cancel</button>
	            <button 
                type="submit" 
                disabled={isSaving}
                className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm flex items-center justify-center min-w-[140px] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
	          </div>
        </form>
      </div>
    </div>
  );
};
