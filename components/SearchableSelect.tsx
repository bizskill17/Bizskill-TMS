import { createPortal } from 'react-dom';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, X, Check, Square, CheckSquare, ListChecks, Eraser, Plus } from 'lucide-react';
import { useLabels } from '../labelOverrides';

interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  label?: React.ReactNode;
  labelKey?: string;
  options: Option[];
  value: string | string[]; // Single value or array of values
  onChange: (value: any) => void;
  multiple?: boolean;
  placeholder?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
  allowCreate?: boolean;
  onCreateOption?: (value: string) => void | boolean;
  createLabel?: (value: string) => string;
  compact?: boolean;
  dropdownPlacement?: 'bottom' | 'top';
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  label,
  labelKey,
  options,
  value,
  onChange,
  multiple = false,
  placeholder: placeholderText = 'Select...',
  required = false,
  className = '',
  disabled = false,
  allowCreate = false,
  onCreateOption,
  createLabel,
  compact = false,
  dropdownPlacement = 'bottom'
}) => {
  const { getFieldLabel } = useLabels();
  const normalizedPlaceholder = placeholderText ? 'Select' : 'Select';
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [overlayStyle, setOverlayStyle] = useState<React.CSSProperties | null>(null);
  useEffect(() => {
    if (!isOpen || dropdownPlacement !== 'top') return;
    const position = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const zoom = (parseFloat(getComputedStyle(document.documentElement).zoom) || 1) * (parseFloat(getComputedStyle(document.body).zoom) || 1);
      setOverlayStyle({ position: 'fixed', left: rect.left / zoom, top: (rect.top - 4) / zoom, width: rect.width / zoom, transform: 'translateY(-100%)', maxHeight: Math.min(320, Math.max(0, (rect.top - 12) / zoom)), zIndex: 300 });
    };
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => { window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true); };
  }, [isOpen, dropdownPlacement]);
  const [searchTerm, setSearchTerm] = useState('');
	  const wrapperRef = useRef<HTMLDivElement>(null);
	  const inputRef = useRef<HTMLInputElement>(null);
	  const dropdownRef = useRef<HTMLDivElement>(null);

	  const resolvedLabel = useMemo(() => {
	    if (!labelKey) return label;
	    if (typeof label === 'string') return getFieldLabel(labelKey, label);
	    // If label is a ReactNode (e.g. contains required * markup), caller should handle overrides manually.
	    return label;
	  }, [labelKey, label, getFieldLabel]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (wrapperRef.current && !wrapperRef.current.contains(target) && 
          dropdownRef.current && !dropdownRef.current.contains(target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentValues = useMemo(() => {
    if (!multiple) return typeof value === 'string' ? value : '';
    if (Array.isArray(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      return value.split(',').map(s => s.trim());
    }
    return [];
  }, [value, multiple]);

  const sortedOptions = useMemo(() => {
    return [...options].sort((a, b) => {
      const labelA = String(a?.label || '');
      const labelB = String(b?.label || '');
      return labelA.localeCompare(labelB);
    });
  }, [options]);

  const filteredOptions = useMemo(() => {
    const safeSearch = searchTerm.toLowerCase().trim();
    if (!safeSearch) return sortedOptions;
    return sortedOptions.filter(option => 
      String(option?.label || '').toLowerCase().includes(safeSearch)
    );
  }, [sortedOptions, searchTerm]);

  const createValue = useMemo(() => searchTerm.trim(), [searchTerm]);
  const canCreate = useMemo(() => {
    if (!allowCreate || disabled) return false;
    if (!createValue) return false;
    const needle = createValue.toLowerCase();
    return !sortedOptions.some(o => String(o.value || o.label || '').toLowerCase() === needle || String(o.label || o.value || '').toLowerCase() === needle);
  }, [allowCreate, disabled, createValue, sortedOptions]);

  const handleSelect = (optionValue: string) => {
    if (disabled) return;
    if (multiple) {
      const vals = Array.isArray(currentValues) ? currentValues : [];
      const newValue = vals.includes(optionValue)
        ? vals.filter(v => v !== optionValue)
        : [...vals, optionValue];
      onChange(newValue);
    } else {
      onChange(optionValue);
      setIsOpen(false);
    }
  };

  const handleCreate = (val: string) => {
    if (!val.trim()) return;
    const res = onCreateOption?.(val);
    if (res !== false) handleSelect(val);
    setSearchTerm('');
  };

  const handleSelectAllVisible = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!multiple || disabled) return;
    const visibleValues = filteredOptions.map(o => o.value);
    const existingValues = Array.isArray(currentValues) ? currentValues : [];
    const combined = Array.from(new Set([...existingValues, ...visibleValues]));
    onChange(combined);
    inputRef.current?.focus();
  };

  const handleClearAllVisible = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!multiple || disabled) return;
    const visibleValues = filteredOptions.map(o => o.value);
    const existingValues = Array.isArray(currentValues) ? currentValues : [];
    const remaining = existingValues.filter(v => !visibleValues.includes(v));
    onChange(remaining);
    inputRef.current?.focus();
  };

  const removeValue = (e: React.MouseEvent, valToRemove: string) => {
    e.stopPropagation();
    if (disabled) return;
    if (Array.isArray(currentValues)) {
      onChange(currentValues.filter(v => v !== valToRemove));
    } else {
      onChange('');
    }
  };

  const getDisplayValue = () => {
    if (multiple) {
       const vals = Array.isArray(currentValues) ? currentValues : [];
	       if (vals.length === 0) return <span className="text-black">{normalizedPlaceholder}</span>;
       
       return (
         <div className="flex flex-wrap gap-1.5 py-0.5">
           {vals.map(val => {
             const opt = options.find(o => o.value === val);
             return (
               <span key={val} className={`bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md text-[11px] font-bold flex items-center border border-indigo-200 ${disabled ? 'opacity-60' : ''}`}>
                 {opt ? opt.label : val}
                 {!disabled && <X size={12} className="ml-1.5 cursor-pointer hover:text-red-600 transition-colors" onClick={(e) => removeValue(e, val)} />}
               </span>
             );
           })}
         </div>
       );
    } else {
      const selectedOption = options.find(o => o.value === currentValues);
      return selectedOption ? (
        <span className="text-black font-medium">{selectedOption.label}</span>
      ) : (
        <span className="text-black">{normalizedPlaceholder}</span>
      );
    }
  };

  const dropdownContent = (
    <div 
      ref={dropdownRef}
      style={dropdownPlacement === 'top' ? overlayStyle || {visibility: 'hidden'} : undefined}
      className={`${dropdownPlacement === 'top' ? '' : 'absolute top-full left-0 mt-1 w-full z-[120]'} bg-white border border-gray-200 rounded-xl shadow-2xl max-h-80 overflow-hidden flex flex-col animate-in fade-in duration-200`}
    >
      <div className="p-2 border-b border-gray-100 bg-gray-50 sticky top-0 z-10 space-y-2">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            className="w-full pl-3 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 font-medium text-black placeholder-black"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            autoFocus
          />
        </div>
        
        {multiple && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSelectAllVisible}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-white border border-indigo-200 rounded-md hover:bg-indigo-50 transition-colors"
            >
              <ListChecks size={14} />
              All
            </button>
            <button
              type="button"
              onClick={handleClearAllVisible}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-red-600 bg-white border border-red-200 rounded-md hover:bg-red-50 transition-colors"
            >
              <Eraser size={14} />
              Clear
            </button>
          </div>
        )}
      </div>

      <div className="overflow-y-auto flex-1 custom-scrollbar">
        {filteredOptions.length > 0 ? (
          filteredOptions.map(option => {
            const isSelected = multiple 
                ? (Array.isArray(currentValues) && currentValues.includes(option.value))
                : currentValues === option.value;
            
            return (
              <div
                key={option.value}
                className={`px-4 py-3 text-sm cursor-pointer flex items-center gap-3 transition-colors border-b border-gray-50 last:border-0 ${isSelected ? 'bg-indigo-50/50 text-indigo-700' : 'text-black hover:bg-gray-50'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect(option.value);
                }}
              >
                <div className="flex-shrink-0">
                  {multiple ? (
                    isSelected ? (
                      <CheckSquare size={20} className="text-indigo-600" />
                    ) : (
                      <Square size={20} className="text-gray-300" />
                    )
                  ) : (
                    isSelected && <Check size={18} className="text-indigo-600" />
                  )}
                </div>
                <span className={`flex-1 ${isSelected ? 'font-bold' : 'font-medium'}`}>{option.label}</span>
              </div>
            );
          })
        ) : (
          <div className="px-4 py-8 text-sm text-black text-center font-bold uppercase tracking-widest">
            No matching results
          </div>
        )}

        {canCreate && (
          <div
            key="__create__"
            className="px-4 py-3 text-sm cursor-pointer flex items-center gap-3 transition-colors border-t border-gray-100 text-emerald-700 hover:bg-emerald-50"
            onClick={(e) => {
              e.stopPropagation();
              handleCreate(createValue);
            }}
          >
            <span className="flex-1 font-bold">
              {createLabel ? createLabel(createValue) : `Add "${createValue}"`}
            </span>
            <div className="flex-shrink-0">
              <Plus size={18} className="text-emerald-600" />
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className={`space-y-1 relative ${className} ${disabled ? 'opacity-70' : ''}`} ref={wrapperRef}>
	      {resolvedLabel && (
	        <label className="text-xs font-bold text-black uppercase tracking-wider block mb-1">
	          {resolvedLabel} {required && <span className="text-red-500">*</span>}
	        </label>
	      )}
      <div
        ref={triggerRef}
        className={`w-full ${compact ? 'px-3 py-1.5 min-h-[36px]' : 'px-4 py-2.5 min-h-[44px]'} bg-white border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-500 flex justify-between items-center transition-all ${isOpen ? 'ring-2 ring-indigo-100 border-indigo-500' : ''} ${disabled ? 'bg-white cursor-not-allowed' : 'cursor-pointer'}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div className="flex-1 overflow-hidden">
          {getDisplayValue()}
        </div>
        <ChevronDown size={16} className={`text-indigo-400 flex-shrink-0 ml-2 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && !disabled && (dropdownPlacement === 'top' ? createPortal(dropdownContent, document.body) : dropdownContent)}
    </div>
  );
};
