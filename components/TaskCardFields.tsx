import React from 'react';

export const TaskCardFields = ({ children }: { children: React.ReactNode }) => (
  <dl className="divide-y divide-blue-100 border-y border-blue-100">{children}</dl>
);

export const TaskCardField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-3 py-2 text-sm leading-5">
    <dt className="min-w-0 font-medium text-gray-500 [overflow-wrap:anywhere]">{label}</dt>
    <dd className="min-w-0 whitespace-pre-wrap text-gray-900 [overflow-wrap:anywhere]">{children}</dd>
  </div>
);
