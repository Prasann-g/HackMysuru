import React from 'react';
import {
  AlertTriangle,
  Trash2,
  LightbulbOff,
  Layers,
  Hammer,
  HelpCircle,
  Recycle,
  CheckCircle2,
} from 'lucide-react';
import { CATEGORY_OPTIONS, type IssueCategory } from './types';

interface Step1Props {
  selectedCategory: IssueCategory | '';
  customCategory: string;
  error?: string;
  onSelectCategory: (cat: IssueCategory) => void;
  onChangeCustomCategory: (val: string) => void;
}

const renderCategoryIcon = (iconName: string, isSelected: boolean) => {
  const iconClass = `w-5 h-5 ${isSelected ? 'text-white' : 'text-bridge-charcoal-700'}`;
  switch (iconName) {
    case 'pothole':
      return <Layers className={iconClass} />;
    case 'trash':
      return <Trash2 className={iconClass} />;
    case 'light':
      return <LightbulbOff className={iconClass} />;
    case 'bin':
      return <AlertTriangle className={iconClass} />;
    case 'construction':
      return <Hammer className={iconClass} />;
    case 'recycle':
      return <Recycle className={iconClass} />;
    default:
      return <HelpCircle className={iconClass} />;
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
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-bridge-charcoal-900">
            Select Grievance Category
          </h2>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-bridge-almond-100 text-bridge-charcoal-600">
            Required
          </span>
        </div>
        <p className="text-xs sm:text-sm text-bridge-charcoal-600 mt-1">
          Pick the category that best matches what you observed in Mysuru.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2.5 animate-fadeIn"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      <div
        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        role="radiogroup"
        aria-label="Civic Grievance Category"
      >
        {CATEGORY_OPTIONS.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <div
              key={cat.id}
              role="radio"
              tabIndex={0}
              aria-checked={isSelected}
              onClick={() => onSelectCategory(cat.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectCategory(cat.id);
                }
              }}
              className={`group p-4 rounded-xl border text-left cursor-pointer flex items-start gap-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-gold-500 select-none transition-all duration-200 ease-out motion-reduce:transition-none motion-reduce:hover:translate-y-0 active:scale-[0.99] motion-reduce:active:scale-100 ${
                isSelected
                  ? 'bg-bridge-gold-50/80 border-bridge-gold-500 ring-2 ring-bridge-gold-400/30 shadow-bridge-card -translate-y-0.5'
                  : 'bg-white border-bridge-almond-200 hover:-translate-y-0.5 hover:border-bridge-gold-400 hover:shadow-bridge-card hover:bg-bridge-gold-50/20 shadow-[0_1px_2px_rgba(0,0,0,0.03)]'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200 ease-out ${
                  isSelected
                    ? 'bg-bridge-charcoal-800 shadow-sm'
                    : 'bg-bridge-almond-100 group-hover:bg-bridge-gold-100 group-hover:text-bridge-gold-800'
                }`}
              >
                {renderCategoryIcon(cat.iconName, isSelected)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={`text-sm font-semibold truncate transition-colors duration-200 ${
                      isSelected
                        ? 'text-bridge-charcoal-900 font-bold'
                        : 'text-bridge-charcoal-800 group-hover:text-bridge-charcoal-900'
                    }`}
                  >
                    {cat.label}
                  </span>
                  {isSelected && (
                    <span className="inline-flex items-center animate-fadeIn">
                      <CheckCircle2 className="w-4 h-4 text-bridge-gold-600 shrink-0" />
                    </span>
                  )}
                </div>
                <p className="text-xs text-bridge-charcoal-600 mt-1 line-clamp-2 leading-relaxed">
                  {cat.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {selectedCategory === 'other' && (
        <div className="p-4 rounded-xl bg-bridge-almond-50 border border-bridge-almond-200 animate-fadeIn">
          <label
            htmlFor="custom-category-input"
            className="block text-xs font-semibold text-bridge-charcoal-900 mb-1"
          >
            Specify other grievance category{' '}
            <span className="text-bridge-charcoal-500 font-normal">(Optional)</span>
          </label>
          <input
            id="custom-category-input"
            type="text"
            value={customCategory}
            onChange={(e) => onChangeCustomCategory(e.target.value)}
            placeholder="e.g., Open utility trench, overflowing stormwater drain"
            maxLength={100}
            className="w-full px-3.5 py-2 text-sm bg-white border border-bridge-almond-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-gold-500 text-bridge-charcoal-900 placeholder:text-bridge-charcoal-400"
          />
        </div>
      )}
    </div>
  );
};
