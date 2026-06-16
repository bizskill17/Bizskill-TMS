
import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { RecurringTask } from '../types';
import { useLabels } from '../labelOverrides';

interface UpdateRecurringTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: RecurringTask | null;
  onSave: (updatedTask: RecurringTask & { lastUpdateRemarks: string; goal?: string; photos?: string; pdf?: string }) => Promise<void>;
}

export const UpdateRecurringTaskModal: React.FC<UpdateRecurringTaskModalProps> = ({ isOpen, onClose, task, onSave }) => {
  const { getFieldLabel } = useLabels();
  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const [remarks, setRemarks] = useState('');
  const [status, setStatus] = useState<'Not Yet Started' | 'In Progress' | 'Complete'>('Complete');
  const [goal, setGoal] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [pdf, setPdf] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen || !task) return null;
  const hasTaskGoal = String(task.goal ?? '').trim() !== '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasTaskGoal && goal.trim() === '') {
      alert('Achieved is required when Goal is set.');
      return;
    }
    
    setIsSaving(true);
    try {
      // Explicitly include title, category, and assignee in the update payload 
      // to ensure logs correctly identify the task in the spreadsheet.
      await onSave({ 
        ...task, 
        status, 
        lastUpdateRemarks: remarks,
        goal,
        photos: JSON.stringify(photos || []),
        pdf: pdf || '',
        title: task.title,
        category: task.category,
        assignee: task.assignee
      });
      
      setRemarks('');
      setStatus('Complete');
      setGoal('');
      setPhotos([]);
      setPdf('');
      onClose();
    } catch (error) {
      console.error('Failed to update recurring task:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-opacity">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-indigo-600">Update Recurring Task</h2>
            <p className="text-sm text-gray-500 truncate max-w-[300px]">{task.title}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="space-y-1">
              <label className="text-sm font-medium text-black">{getFieldLabel('recurringAction.status', 'Update Status')} <span className="text-red-500">*</span></label>
              <select 
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 outline-none"
                required
                disabled={isSaving}
              >
                <option value="Not Yet Started">Not Yet Started</option>
                <option value="In Progress">In Progress</option>
                <option value="Complete">Complete</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-black">{getFieldLabel('recurringAction.remarks', 'Update Remarks')} <span className="text-red-500">*</span></label>
              <textarea 
                required
                rows={4}
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 outline-none resize-none"
                placeholder="Enter what was done..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                disabled={isSaving}
              />
            </div>
            {hasTaskGoal && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-black">{getFieldLabel('recurringAction.achieved', 'Achieved')} <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 outline-none"
                  placeholder="Enter achieved value"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value.replace(/[^\d.]/g, ''))}
                  disabled={isSaving}
                />
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-black block mb-1">{getFieldLabel('recurringAction.photos', 'Photo')}</label>
                <input
                  type="file"
                  accept="image/*"
                  disabled={isSaving}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) {
                      setPhotos([]);
                      return;
                    }
                    const photoData = await readFileAsDataUrl(file);
                    setPhotos([photoData]);
                  }}
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm"
                />
                <p className="text-xs text-gray-500">{photos.length > 0 ? 'Photo selected' : 'No photo selected'}</p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-black block mb-1">{getFieldLabel('recurringAction.pdf', 'PDF')}</label>
                <input
                  type="file"
                  accept="application/pdf"
                  disabled={isSaving}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const pdfData = await readFileAsDataUrl(file);
                    setPdf(pdfData);
                  }}
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm"
                />
                <p className="text-xs text-gray-500">{pdf ? 'PDF selected' : 'No PDF selected'}</p>
              </div>
            </div>
            {status === 'Complete' && (
              <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100 text-xs text-indigo-800">
                Marking as "Complete" will log this action and set the next due date based on the frequency ({task.frequencyDays} days).
              </div>
            )}
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
              disabled={isSaving}
              className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center min-w-[140px]"
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin mr-2" />
                  Updating...
                </>
              ) : (
                'Confirm Update'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
