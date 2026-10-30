import React from 'react';
import { TableRow } from '../types';

interface PendingTableProps {
  title: string;
  headerLabel: string;
  data: TableRow[];
  onRowClick: (name: string) => void;
  className?: string;
  statusColumns?: string[];
}

export const PendingTable: React.FC<PendingTableProps> = ({ title, headerLabel, data, onRowClick, className = '', statusColumns = [] }) => {
  const columns = statusColumns.length > 0 ? statusColumns : ['Not Yet Started', 'In Progress', 'Pending for Client', 'Pending for Owner', 'Pending for Training', 'Pending for Billing', 'Pending for Payment'];

  return (
    <div className={`${className || 'bg-white'} min-w-0 rounded-xl shadow-sm border-2 border-black overflow-hidden`}>
      <div className="p-4 md:p-6 border-b border-black flex justify-between items-center">
        <h3 className="text-lg font-bold text-blue-700 uppercase tracking-tight">{title}</h3>
        

      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-left">
          <thead>
            <tr className="bg-blue-600 text-white">
              <th className="px-3 md:px-6 py-3 md:py-4 font-bold text-[10px] uppercase tracking-widest border-r border-black last:border-r-0">{headerLabel}</th>
              <th className="px-3 md:px-6 py-3 md:py-4 font-bold text-[10px] uppercase tracking-widest text-center border-r border-black last:border-r-0">Total Pending</th>
              {columns.map((column) => (
                <th key={column} className="px-3 md:px-6 py-3 md:py-4 font-bold text-[10px] uppercase tracking-widest text-center border-r border-black last:border-r-0">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black">
            {data.length > 0 ? (
              data.map((row, idx) => (
                <tr 
                  key={idx} 
                  className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                  onClick={() => onRowClick(row.name)}
                >
                  <td className="px-3 md:px-6 py-3 md:py-4 text-sm text-black font-bold border-r border-black last:border-r-0">{row.name}</td>
                  <td className="px-3 md:px-6 py-3 md:py-4 text-sm text-black text-center font-bold border-r border-black last:border-r-0">{row.total}</td>
                  {columns.map((column) => (
                    <td key={`${row.name}-${column}`} className="px-3 md:px-6 py-3 md:py-4 text-sm text-center font-extrabold border-r border-black last:border-r-0 text-blue-700">
                      {row.statusCounts?.[column] || 0}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={2 + columns.length} className="px-6 py-10 text-center text-blue-900/40 text-sm font-bold uppercase">
                  No pending data found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};
