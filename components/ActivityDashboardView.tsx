import React, { useState, useMemo } from 'react';
import { ActionLogEntry, User } from '../types';
import { parseToISO, formatToIndianDate } from '../App';
import { X, LayoutGrid, LayoutList, Clock, Filter, FileText, Download } from 'lucide-react';

interface ActivityDashboardViewProps {
  logs: ActionLogEntry[];
  users: User[];
  currentUser: User | null;
}

export const ActivityDashboardView: React.FC<ActivityDashboardViewProps> = ({ logs, users, currentUser }) => {
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA');
  const todayISO = now.toLocaleDateString('en-CA');
  
  const [fromDate, setFromDate] = useState(firstDayOfMonth);
  const [toDate, setToDate] = useState(todayISO);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [showFilters, setShowFilters] = useState(false);

  const isAdmin = currentUser?.role === 'Admin';

  const formatMinutesToHHMM = (totalMinutes: number) => {
    if (!totalMinutes || totalMinutes <= 0) return '';
    const h = Math.floor(totalMinutes / 60);
    const m = Math.round(totalMinutes % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const pivotedData = useMemo(() => {
    // Defensive: some logs may only have updatedOn (date) instead of updateDate (date+time).
    const filteredLogs = logs.filter(log => {
      const rawDate = String(log.updateDate || (log as any).updatedOn || '').trim();
      const logISO = parseToISO(rawDate);
      if (fromDate && logISO < fromDate) return false;
      if (toDate && logISO > toDate) return false;
      return true;
    });

    const datesMap = new Map<string, Map<string, number>>();
    const employeesSet = new Set<string>();

    if (isAdmin) {
      users.filter(u => u.role !== 'Admin').forEach(u => employeesSet.add(u.name));
    } else if (currentUser) {
      employeesSet.add(currentUser.name);
    }

    filteredLogs.forEach(log => {
      const dateStr = formatToIndianDate(String(log.updateDate || (log as any).updatedOn || ''));
      const names = (log.assignees || log.owner || 'Unknown')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      names.forEach(name => {
        // If the user list is missing or the role filter excluded someone, still show data for names we see in logs.
        if (!employeesSet.has(name)) {
            employeesSet.add(name);
        }
        if (employeesSet.has(name)) {
            if (!datesMap.has(dateStr)) {
                datesMap.set(dateStr, new Map());
            }
            const employeeMap = datesMap.get(dateStr)!;
            const currentMinutes = employeeMap.get(name) || 0;
            employeeMap.set(name, currentMinutes + (log.hours || 0));
        }
      });
    });

    const sortedDates = Array.from(datesMap.keys()).sort((a, b) => {
      const parse = (ds: string) => {
        const [d, m, y] = ds.split('/');
        return new Date(`${y}-${m}-${d}`).getTime();
      };
      return parse(a) - parse(b);
    });

    // Fix: Property 'name' does not exist on type 'string'. employeesSet is a Set of strings.
    const sortedEmployees = Array.from(employeesSet).sort((a, b) => a.localeCompare(b));

    return {
      dates: sortedDates,
      employees: sortedEmployees,
      data: datesMap
    };
  }, [logs, fromDate, toDate, users, isAdmin, currentUser]);

  const columnTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    pivotedData.employees.forEach(emp => {
      let sum = 0;
      pivotedData.dates.forEach(date => {
        sum += pivotedData.data.get(date)?.get(emp) || 0;
      });
      totals[emp] = sum;
    });
    return totals;
  }, [pivotedData]);

  const thClass = "px-6 py-4 border border-black bg-[#4a77d4] text-white font-black text-center text-xs whitespace-nowrap uppercase tracking-widest";
  const tdClass = "px-6 py-4 border border-black text-center text-sm font-black text-gray-800 h-14";
  const labelClass = "text-[10px] font-black bg-[#4a77d4] text-white px-4 py-2 rounded-l-md uppercase tracking-widest border border-[#4a77d4] flex items-center h-[44px] whitespace-nowrap";

  const handleExportExcel = () => {
    const headers = ['Date', ...pivotedData.employees];
    const rows = [...pivotedData.dates].reverse().map(date => ([
      date,
      ...pivotedData.employees.map(emp => formatMinutesToHHMM(pivotedData.data.get(date)?.get(emp) || 0))
    ]));
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Activity_Dashboard_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  };

  const handleExportPDF = async () => {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFontSize(16);
    doc.text('Activity Dashboard', 14, 14);
    autoTable(doc, {
      head: [['Date', ...pivotedData.employees]],
      body: [...pivotedData.dates].reverse().map(date => ([
        date,
        ...pivotedData.employees.map(emp => formatMinutesToHHMM(pivotedData.data.get(date)?.get(emp) || 0))
      ])),
      startY: 20,
      theme: 'grid',
      headStyles: { fillColor: [74, 119, 212], textColor: [255, 255, 255] },
      styles: { fontSize: 8 }
    });
    doc.save(`Activity_Dashboard_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-2xl font-black text-blue-600 uppercase tracking-tight">Activity Dashboard</h2>
        <div className="flex items-center gap-2">
        <button
          onClick={handleExportPDF}
          className="flex items-center justify-center p-2.5 bg-blue-500 text-white border border-blue-600 rounded-md hover:bg-blue-600"
          title="Export PDF"
        >
          <Download size={16} />
        </button>
        <button
          onClick={handleExportExcel}
          className="flex items-center justify-center p-2.5 bg-blue-600 text-white border border-blue-700 rounded-md hover:bg-blue-700"
          title="Export Excel"
        >
          <FileText size={16} />
        </button>
        <button
          onClick={() => setShowFilters(prev => !prev)}
          className={`flex items-center justify-center p-2.5 border rounded-md text-sm font-medium shadow-sm transition-all duration-200 ${showFilters ? 'bg-[#4a77d4] border-[#3f69be] text-white ring-2 ring-blue-200' : 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100'}`}
          title="Toggle Filters"
        >
          <Filter size={16} />
        </button>
        </div>
        <div className="flex bg-blue-50 p-1 rounded-lg md:hidden border border-blue-200">
          <button
            onClick={() => setViewMode('card')}
            className={`p-1.5 rounded-md transition-all border ${viewMode === 'card' ? 'bg-white shadow text-blue-600 border-blue-600' : 'text-blue-400 border-transparent'}`}
          >
            <LayoutGrid size={18} />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded-md transition-all border ${viewMode === 'table' ? 'bg-white shadow text-blue-600 border-blue-600' : 'text-blue-400 border-transparent'}`}
          >
            <LayoutList size={18} />
          </button>
        </div>
      </div>

      {/* Date Filters */}
      {showFilters && (
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-6">
        <div className="flex flex-row items-center justify-center gap-6 flex-wrap">
          <div className="flex flex-row items-center">
            <label className={labelClass}>From</label>
            <input 
              type="date" 
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-[170px] px-4 py-2 border-2 border-l-0 border-gray-200 rounded-r-lg focus:ring-4 focus:ring-blue-50 focus:border-[#4a77d4] outline-none transition-all font-bold text-gray-700 shadow-sm text-center h-[44px]"
            />
          </div>
          <div className="flex flex-row items-center">
            <label className={labelClass}>To</label>
            <input 
              type="date" 
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-[170px] px-4 py-2 border-2 border-l-0 border-gray-200 rounded-r-lg focus:ring-4 focus:ring-blue-50 focus:border-[#4a77d4] outline-none transition-all font-bold text-gray-700 shadow-sm text-center h-[44px]"
            />
          </div>
          <button 
            onClick={() => { setFromDate(''); setToDate(''); }}
            className="px-3 py-2.5 bg-gray-100 text-gray-600 font-black rounded-xl hover:bg-gray-200 transition-all border-2 border-gray-200 h-[44px] flex items-center justify-center shadow-sm active:scale-95"
            title="Clear"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      )}

      {/* Mobile Card View */}
      <div className={`${viewMode === 'card' ? 'grid md:hidden' : 'hidden'} grid-cols-1 gap-4 px-2`}>
        {[...pivotedData.dates].reverse().map(date => {
            const dateEntries = pivotedData.employees.map(emp => ({
                name: emp,
                value: pivotedData.data.get(date)?.get(emp) || 0
            })).filter(e => e.value > 0);
            
            if (dateEntries.length === 0) return null;

            return (
                <div key={date} className="bg-white p-4 rounded-xl border-2 border-blue-100 shadow-sm">
                    <div className="flex justify-between items-center mb-3 border-b border-blue-50 pb-2">
                        <span className="font-black text-blue-600 uppercase tracking-widest text-xs">{date}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {dateEntries.map(entry => (
                            <div key={entry.name} className="bg-blue-50/50 p-2 rounded-lg border border-blue-100">
                                <span className="text-[9px] font-black text-blue-400 uppercase tracking-tighter block truncate">{entry.name}</span>
                                <span className="font-black text-indigo-700 text-sm">{formatMinutesToHHMM(entry.value)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        })}
        {pivotedData.dates.length === 0 && (
            <div className="text-center py-24 bg-white rounded-2xl border-2 border-blue-100 flex flex-col items-center justify-center opacity-40">
              <Clock size={48} className="text-blue-300 mb-2" />
              <p className="font-black uppercase tracking-widest text-xs">No activity found</p>
            </div>
        )}
      </div>

      {/* Main Activity Table (Desktop or Mobile Toggle) */}
      <div className={`${viewMode === 'card' ? 'hidden md:block' : 'block'} bg-white p-2 rounded-2xl shadow-lg overflow-hidden border-2 border-blue-100`}>
        <div className="overflow-x-auto rounded-xl">
          <table className="w-full border-collapse border border-black table-fixed min-w-max">
            <thead>
              <tr>
                <th className={thClass} style={{ width: '200px' }}>DATE</th>
                {pivotedData.employees.map(emp => (
                  <th key={emp} className={thClass}>{emp}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black bg-white">
              {[...pivotedData.dates].reverse().map(date => (
                <tr key={date} className="hover:bg-blue-50/30 transition-colors">
                  <td className={tdClass}>{date}</td>
                  {pivotedData.employees.map(emp => {
                    const value = pivotedData.data.get(date)?.get(emp) || 0;
                    return (
                      <td key={`${date}-${emp}`} className={tdClass}>
                        {formatMinutesToHHMM(value)}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {pivotedData.dates.length === 0 && (
                <tr>
                  <td colSpan={pivotedData.employees.length + 1} className="px-6 py-24 text-center text-gray-400 italic font-black uppercase tracking-widest text-xs">
                    No activity logs found for the selected range.
                  </td>
                </tr>
              )}
            </tbody>
            {pivotedData.dates.length > 0 && (
              <tfoot>
                <tr className="bg-[#4a77d4] text-white border-t-2 border-black">
                  <td className="px-6 py-4 border border-black font-black text-sm uppercase tracking-widest text-center">TOTAL</td>
                  {pivotedData.employees.map(emp => (
                    <td key={`total-${emp}`} className="px-6 py-4 border border-black text-center font-black text-sm">
                      {formatMinutesToHHMM(columnTotals[emp])}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
