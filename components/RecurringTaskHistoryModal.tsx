
import React from 'react';
import { X, Download, Clock, Calendar, AlertCircle } from 'lucide-react';
import { RecurringTask, RecurringTaskAction } from '../types';

interface RecurringTaskHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: RecurringTask | null;
  actions: RecurringTaskAction[];
}

export const RecurringTaskHistoryModal: React.FC<RecurringTaskHistoryModalProps> = ({ isOpen, onClose, task, actions }) => {
  if (!isOpen || !task) return null;

  // Use numeric comparison for safety
  const taskActions = actions.filter(a => Number(a.taskId) === Number(task.id));
  const [photoViewer, setPhotoViewer] = React.useState<{ photos: string[]; index: number } | null>(null);

  const parsePhotos = (rawPhotos?: string): string[] => {
    if (!rawPhotos) return [];
    try {
      const parsed = JSON.parse(rawPhotos);
      if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
    } catch {}
    return [];
  };

  const normalizePdfHref = (raw?: string): string => {
    if (!raw) return '';
    const s = String(raw).trim();
    if (!s) return '';
    if (s.startsWith('data:')) return s;
    if (/^https?:\/\//i.test(s)) return s;
    if (/^[A-Za-z0-9+/=\r\n]+$/.test(s)) {
      return `data:application/pdf;base64,${s.replace(/\s+/g, '')}`;
    }
    return s;
  };

  const openPdf = async (raw?: string) => {
    const href = normalizePdfHref(raw);
    if (!href) return;
    try {
      const res = await fetch(href);
      const blob = await res.blob();
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      window.open(href, '_blank', 'noopener,noreferrer');
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const s = String(dateStr).trim();
    if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) return s;
    const parts = s.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return s;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Complete': return 'bg-green-100 text-green-700';
      case 'In Progress': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '-';
    const s = String(timeStr).trim();
    const direct = s.match(/^(\d{1,2}):(\d{2})/);
    if (direct) return `${direct[1].padStart(2, '0')}:${direct[2]}`;
    const dateMatch = s.match(/\b(\d{1,2}):(\d{2})(?::\d{2})?\b/);
    if (dateMatch) return `${dateMatch[1].padStart(2, '0')}:${dateMatch[2]}`;
    try {
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      }
    } catch {}
    return s;
  };

	  const handleDownloadPDF = async () => {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);
	    const doc = new jsPDF();
	    doc.setFontSize(18);
	    doc.text('Recurring Task History', 14, 20);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Task: ${task.title}`, 14, 28);
    doc.text(`Assignee: ${task.assignee}`, 14, 34);

    const tableColumn = ["Date", "Time", "Status", "Remarks", "Photo", "PDF"];
    const tableRows = taskActions.map(a => [
      formatDate(a.updatedOn),
      formatTime(a.timestamp),
      a.status,
      a.remarks,
      parsePhotos(a.photos).length > 0 ? `${parsePhotos(a.photos).length} photo(s)` : '-',
      a.pdf ? 'Open PDF' : '-'
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 42,
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 9 }
    });

    doc.save(`History_${task.id}_${new Date().getTime()}.pdf`);
  };

	  return (
	    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4 bg-black/40 backdrop-blur-sm transition-opacity">
	      <div className="bg-white rounded-xl shadow-2xl w-[98vw] h-[96vh] max-w-none max-h-none flex flex-col animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-indigo-600">Update History</h2>
            <p className="text-sm text-gray-500 mt-1">{task.title} • {task.assignee}</p>
          </div>
          <div className="flex items-center gap-3">
             <button 
                onClick={handleDownloadPDF}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors shadow-sm"
              >
                <Download size={16} />
                <span className="hidden sm:inline">PDF</span>
              </button>
              <button 
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
          </div>
        </div>

		        <div className="flex-1 overflow-auto p-4 md:p-6">
	          {/* Desktop Table View */}
	          <div className="hidden md:block border border-gray-200 rounded-lg overflow-hidden">
	            <table className="w-full text-left border-collapse">
	              <thead className="bg-gray-50">
	                <tr className="border-b border-gray-200">
	                  <th className="px-6 py-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Date</th>
	                  <th className="px-6 py-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Time</th>
	                  <th className="px-6 py-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
	                  <th className="px-6 py-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Remarks</th>
	                  <th className="px-6 py-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Photo</th>
	                  <th className="px-6 py-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">PDF</th>
	                </tr>
	              </thead>
	              <tbody className="divide-y divide-gray-100">
	                {taskActions.map((action) => (
	                  <tr key={action.id} className="hover:bg-gray-50 transition-colors">
	                    <td className="px-6 py-4 text-sm text-black font-medium">{formatDate(action.updatedOn)}</td>
	                    <td className="px-6 py-4 text-sm text-gray-500 italic">{formatTime(action.timestamp)}</td>
	                    <td className="px-6 py-4 text-sm">
	                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${getStatusColor(action.status)}`}>
	                        {action.status}
	                      </span>
	                    </td>
	                    <td className="px-6 py-4 text-sm text-black">{action.remarks}</td>
	                    <td className="px-6 py-4 text-sm">
	                      {parsePhotos(action.photos).length > 0 ? (
	                        <button
	                          onClick={() => setPhotoViewer({ photos: parsePhotos(action.photos), index: 0 })}
	                          className="text-indigo-600 underline font-semibold"
	                        >
	                          {parsePhotos(action.photos).length} photo(s)
	                        </button>
	                      ) : (
	                        <span className="text-gray-400">-</span>
	                      )}
	                    </td>
	                    <td className="px-6 py-4 text-sm">
	                      {normalizePdfHref(action.pdf) ? (
	                        <button type="button" onClick={() => openPdf(action.pdf)} className="text-indigo-600 underline font-semibold">
	                          Open PDF
	                        </button>
	                      ) : (
	                        <span className="text-gray-400">-</span>
	                      )}
	                    </td>
	                  </tr>
	                ))}
	                {taskActions.length === 0 && (
	                  <tr>
	                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
	                      No update history recorded for this task.
	                    </td>
	                  </tr>
	                )}
	              </tbody>
	            </table>
	          </div>

	          {/* Mobile Card View */}
	          <div className="md:hidden space-y-4">
	             {taskActions.map((action) => (
	                <div key={action.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                   <div className="flex justify-between items-start mb-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${getStatusColor(action.status)}`}>{action.status}</span>
                      <div className="text-right">
                         <div className="text-[10px] text-gray-500 font-bold flex items-center gap-1 justify-end"><Calendar size={12} />{formatDate(action.updatedOn)}</div>
                         <div className="text-[9px] text-gray-400 font-medium mt-0.5 italic">{formatTime(action.timestamp)}</div>
                      </div>
                   </div>
	                   <div className="bg-indigo-50/50 border border-indigo-100 p-2 rounded space-y-2">
	                      <p className="text-xs text-gray-700 leading-relaxed">"{action.remarks || 'No remarks provided'}"</p>
	                      <div className="flex items-center justify-between text-[11px]">
	                        <div>
	                          <span className="text-gray-500 font-semibold uppercase">Photo</span>{' '}
	                          {parsePhotos(action.photos).length > 0 ? (
	                            <button
	                              onClick={() => setPhotoViewer({ photos: parsePhotos(action.photos), index: 0 })}
	                              className="text-indigo-600 underline font-semibold"
	                            >
	                              {parsePhotos(action.photos).length} photo(s)
	                            </button>
	                          ) : (
	                            <span className="text-gray-400">-</span>
	                          )}
	                        </div>
	                        <div>
	                          <span className="text-gray-500 font-semibold uppercase">PDF</span>{' '}
	                          {normalizePdfHref(action.pdf) ? (
	                            <button type="button" onClick={() => openPdf(action.pdf)} className="text-indigo-600 underline font-semibold">
	                              Open
	                            </button>
	                          ) : (
	                            <span className="text-gray-400">-</span>
	                          )}
	                        </div>
	                      </div>
	                   </div>
	                </div>
	             ))}
	             {taskActions.length === 0 && (
	                <div className="text-center py-12 text-gray-400 text-sm italic">
	                   No recurring history logs available.
                </div>
             )}
          </div>
        </div>

	        <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end flex-shrink-0">
	          <button 
	            type="button"
	            onClick={onClose}
	            className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
	          >
	            Close
	          </button>
	        </div>

	        {photoViewer && (
	          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70">
	            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full p-4 relative">
	              <button
	                onClick={() => setPhotoViewer(null)}
	                className="absolute top-3 right-3 p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700"
	              >
	                <X size={18} />
	              </button>
	              <div className="flex items-center justify-between mb-3">
	                <button
	                  onClick={() =>
	                    setPhotoViewer(p =>
	                      p ? { ...p, index: Math.max(0, p.index - 1) } : p
	                    )
	                  }
	                  disabled={photoViewer.index === 0}
	                  className="px-3 py-1.5 text-sm font-semibold rounded bg-indigo-600 text-white disabled:bg-gray-200 disabled:text-gray-500"
	                >
	                  Prev
	                </button>
	                <div className="text-sm text-gray-700 font-semibold">
	                  {photoViewer.index + 1} / {photoViewer.photos.length}
	                </div>
	                <button
	                  onClick={() =>
	                    setPhotoViewer(p =>
	                      p ? { ...p, index: Math.min(p.photos.length - 1, p.index + 1) } : p
	                    )
	                  }
	                  disabled={photoViewer.index >= photoViewer.photos.length - 1}
	                  className="px-3 py-1.5 text-sm font-semibold rounded bg-indigo-600 text-white disabled:bg-gray-200 disabled:text-gray-500"
	                >
	                  Next
	                </button>
	              </div>
	              <div className="flex items-center justify-center">
	                <img
	                  src={photoViewer.photos[photoViewer.index]}
	                  alt={`Log photo ${photoViewer.index + 1}`}
	                  className="max-h-[70vh] w-auto max-w-full object-contain"
	                />
	              </div>
	            </div>
	          </div>
	        )}
	      </div>
	    </div>
	  );
};
