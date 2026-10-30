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

  const countWidth=60/(columns.length+1);
  // Extra custom statuses may scroll; the usual four-column table fits the screen.
  const minimumWidth=columns.length>2?Math.ceil((columns.length+1)*64/0.6):undefined;

  return (
    <div className={`${className || 'bg-white'} min-w-0 rounded-xl shadow-sm border-2 border-black overflow-hidden`}>
      <div className="p-3 md:p-4 border-b border-black flex justify-between items-center">
        <h3 className="text-lg font-bold text-blue-700 uppercase tracking-tight">{title}</h3>

      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-left" style={{minWidth:minimumWidth}}>
          <colgroup>
            <col style={{width:'40%'}}/>
            <col style={{width:countWidth+'%'}}/>
            {columns.map(column=><col key={column} style={{width:countWidth+'%'}}/>)}
          </colgroup>
          <thead>
            <tr className="bg-blue-600 text-white">
              <th className="px-2 py-2 font-bold text-[10px] uppercase leading-tight whitespace-normal break-normal [overflow-wrap:normal] border-r border-black last:border-r-0">{headerLabel}</th>
              <th className="px-1 py-2 font-bold text-[10px] uppercase leading-tight whitespace-normal break-normal [overflow-wrap:normal] text-center border-r border-black last:border-r-0">Total Pending</th>
              {columns.map((column) => (
                <th key={column} className="px-1 py-2 font-bold text-[10px] uppercase leading-tight whitespace-normal break-normal [overflow-wrap:normal] text-center border-r border-black last:border-r-0">
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
                  <td className="px-2 py-2 text-xs md:text-sm leading-snug whitespace-normal break-words text-black font-bold border-r border-black last:border-r-0">{row.name}</td>
                  <td className="px-1 py-2 text-xs md:text-sm tabular-nums whitespace-nowrap text-black text-center font-bold border-r border-black last:border-r-0">{row.total}</td>
                  {columns.map((column) => (
                    <td key={`${row.name}-${column}`} className="px-1 py-2 text-xs md:text-sm tabular-nums whitespace-nowrap text-center font-extrabold border-r border-black last:border-r-0 text-blue-700">
                      {row.statusCounts?.[column] || 0}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={2 + columns.length} className="px-2 py-6 text-center text-blue-900/40 text-sm font-bold uppercase">
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
