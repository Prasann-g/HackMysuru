import React from 'react';
import { Trash2, AlertCircle, LightbulbOff, Layers, Hammer, HelpCircle, Check } from 'lucide-react';
import type { IssueCategory, CategoryOption } from './types';

interface Step1Props {
  selectedCategory: IssueCategory | '';
  customCategory: string;
  error?: string;
  onSelectCategory: (cat: IssueCategory) => void;
  onChangeCustomCategory: (val: string) => void;
}

const CATEGORIES: CategoryOption[] = [
  {
    id: 'garbage_dumping',
    label: 'Garbage dumping',
    description: 'Unauthorized waste dumped on roadsides, vacant plots, or drains.',
  },
  {
    id: 'overflowing_bin',
    label: 'Overflowing bin',
    description: 'Public dustbin or community container full and spilling over.',
  },
  {
    id: 'pothole',
    label: 'Pothole',
    description: 'Damaged road surface, crater, or hazardous road indentation.',
  },
  {
    id: 'broken_streetlight',
    label: 'Broken streetlight',
    description: 'Streetlight pole not functioning, blinking, or physically damaged.',
  },
  {
    id: 'unsegregated_waste',
    label: 'Unsegregated waste',
    description: 'Mixed wet/dry waste collection or community segregation failure.',
  },
  {
    id: 'construction_debris',
    label: 'Construction debris',
    description: 'Building rubble, sand, or stones obstructing pathways/streets.',
  },
  {
    id: 'other',
    label: 'Other',
    description: 'Any other civic issue within Mysuru City Corporation jurisdiction.',
  },
];

const getCategoryIcon = (id: IssueCategory) => {
  switch (id) {
    case 'garbage_dumping':
      return <Trash2 className="w-5 h-5" />;
    case 'overflowing_bin':
      return <AlertCircle className="w-5 h-5" />;
    case 'pothole':
      return <Layers className="w-5 h-5" />;
    case 'broken_streetlight':
      return <LightbulbOff className="w-5 h-5" />;
    case 'unsegregated_waste':
      return <Trash2 className="w-5 h-5" />;
    case 'construction_debris':
      return <Hammer className="w-5 h-5" />;
    case 'other':
      return <HelpCircle className="w-5 h-5" />;
  }
};

export const Step1IssueDetails: React.FC<Step1Props> = ({
  selectedCategory,
  customCategory,
  error,
  onSelectCategory,
  onChangeCustomCategory,
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-brand-slate-900">
          Select the type of civic issue
        </h2>
        <p className="text-xs sm:text-sm text-brand-slate-600 mt-1">
          Choose the category that best describes the problem observed in your area.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5" role="radiogroup" aria-label="Issue Categories">
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelectCategory(cat.id)}
              className={`p-4 rounded-xl border text-left transition-all duration-150 cursor-pointer flex items-start gap-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal-600 ${
                isSelected
                  ? 'bg-brand-teal-50/70 border-brand-teal-600 ring-1 ring-brand-teal-600 shadow-civic-sm'
                  : 'bg-white border-brand-slate-200 hover:border-brand-teal-300 hover:bg-brand-slate-50'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                  isSelected
                    ? 'bg-brand-teal-600 text-white'
                    : 'bg-brand-slate-100 text-brand-slate-700'
                }`}
              >
                {getCategoryIcon(cat.id)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-sm font-semibold ${
                      isSelected ? 'text-brand-teal-900' : 'text-brand-slate-900'
                    }`}
                  >
                    {cat.label}
                  </span>
                  {isSelected && <Check className="w-4 h-4 text-brand-teal-600 shrink-0" />}
                </div>
                <p className="text-xs text-brand-slate-600 mt-1 leading-normal">
                  {cat.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {selectedCategory === 'other' && (
        <div className="mt-4 p-4 rounded-xl bg-brand-slate-50 border border-brand-slate-200 animate-fadeIn">
          <label
            htmlFor="custom-category-input"
            className="block text-xs font-semibold text-brand-slate-900 mb-1"
          >
            Specify other issue type <span className="text-brand-slate-500 font-normal">(Optional)</span>
          </label>
          <input
            id="custom-category-input"
            type="text"
            value={customCategory}
            onChange={(e) => onChangeCustomCategory(e.target.value)}
            placeholder="e.g. Open manhole on main road"
            className="w-full px-3.5 py-2 text-sm bg-white border border-brand-slate-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal-600 text-brand-slate-900 placeholder:text-brand-slate-400"
          />
        </div>
      )}
    </div>
  );
};
