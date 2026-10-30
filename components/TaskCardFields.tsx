import React from 'react';

// Read the displayed value inside formatted text and attachment buttons as well.
const cardValueText = (value: React.ReactNode): string => {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (React.isValidElement<{ children?: React.ReactNode }>(value)) return cardValueText(value.props.children);
  return React.Children.toArray(value).map(child =>
    typeof child === 'string' || typeof child === 'number' ? String(child) :
      React.isValidElement<{ children?: React.ReactNode }>(child) ? cardValueText(child.props.children) : ''
  ).join('');
};

const hasCardValue = (value: React.ReactNode): boolean => {
  const text = cardValueText(value).trim();
  if (!text || /^[-–—]+$/.test(text)) return false;
  return !/^[+-]?(?:0+(?:\.0*)?|\.0+)$/.test(text);
};

export const TaskCardFields = ({ children }: { children: React.ReactNode }) => {
  const fields = React.Children.toArray(children).filter(child =>
    React.isValidElement<{ children?: React.ReactNode }>(child) && hasCardValue(child.props.children)
  );
  return fields.length ? <dl className="divide-y divide-blue-100 border-y border-blue-100">{fields}</dl> : null;
};

export const TaskCardField = ({ label, children }: { label: string; children: React.ReactNode }) => {
  if (!hasCardValue(children)) return null;
  return (
    <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-3 py-2 text-sm leading-5">
      <dt className="min-w-0 font-medium text-gray-500 [overflow-wrap:anywhere]">{label}</dt>
      <dd className="min-w-0 whitespace-pre-wrap text-gray-900 [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
};
