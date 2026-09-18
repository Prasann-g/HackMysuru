import React from 'react';
import { Calendar, AlertCircle, FileText } from 'lucide-react';

interface Step2Props {
  description: string;
  observedDate: string;
  errors: {
    description?: string;
    observedDate?: string;
  };
  onChangeDescription: (val: string) => void;
  onChangeObservedDate: (val: string) => void;
}

export const Step2Description: React.FC<Step2Props> = ({
  description,
  observedDate,
  errors,
  onChangeDescription,
  onChangeObservedDate,
}) => {
  // Get today's date in YYYY-MM-DD for max constraint
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-bridge-charcoal-900">
          Describe the problem & when it was observed
        </h2>
        <p className="text-xs sm:text-sm text-bridge-charcoal-600 mt-1">
          Detailed descriptions help the verification system identify similar complaints and assist ward engineers in dispatching the right team.
        </p>
      </div>

      {/* Complaint Description Input */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor="complaint-description"
            className="block text-xs font-semibold text-bridge-charcoal-900 flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5 text-bridge-gold-700" />
            <span>Complaint Description</span>
            <span className="text-rose-500 font-bold">*</span>
          </label>
          <span className="text-[11px] text-bridge-charcoal-500">
            {description.length} / 1000 characters
          </span>
        </div>

        <textarea
          id="complaint-description"
          rows={5}
          value={description}
          onChange={(e) => onChangeDescription(e.target.value)}
          maxLength={1000}
          placeholder="Please describe what you observed, including any specific hazards, extent of damage, or prominent nearby landmarks (e.g. Near Kuvempunagar Double Road junction, deep pothole posing risk to two-wheelers)..."
          aria-invalid={!!errors.description}
          aria-describedby={errors.description ? 'desc-error' : 'desc-hint'}
          className={`w-full px-3.5 py-2.5 text-sm bg-white border rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-gold-500 text-bridge-charcoal-900 placeholder:text-bridge-charcoal-400 transition-colors ${
            errors.description
              ? 'border-rose-400 bg-rose-50/20'
              : 'border-bridge-almond-300'
          }`}
        />

        {errors.description ? (
          <p id="desc-error" className="text-xs text-rose-600 flex items-center gap-1 mt-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{errors.description}</span>
          </p>
        ) : (
          <p id="desc-hint" className="text-[11px] text-bridge-charcoal-500">
            Minimum 10 characters required. Avoid using sensitive citizen personal information.
          </p>
        )}
      </div>

      {/* Date Observed Input */}
      <div className="space-y-1.5 max-w-sm">
        <label
          htmlFor="observed-date"
          className="block text-xs font-semibold text-bridge-charcoal-900 flex items-center gap-1.5"
        >
          <Calendar className="w-3.5 h-3.5 text-bridge-gold-700" />
          <span>Date Issue Was Observed</span>
          <span className="text-rose-500 font-bold">*</span>
        </label>

        <input
          id="observed-date"
          type="date"
          max={today}
          value={observedDate}
          onChange={(e) => onChangeObservedDate(e.target.value)}
          aria-invalid={!!errors.observedDate}
          aria-describedby={errors.observedDate ? 'date-error' : undefined}
          className={`w-full px-3.5 py-2 text-sm bg-white border rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-gold-500 text-bridge-charcoal-900 transition-colors ${
            errors.observedDate
              ? 'border-rose-400 bg-rose-50/20'
              : 'border-bridge-almond-300'
          }`}
        />

        {errors.observedDate ? (
          <p id="date-error" className="text-xs text-rose-600 flex items-center gap-1 mt-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{errors.observedDate}</span>
          </p>
        ) : (
          <p className="text-[11px] text-bridge-charcoal-500">
            Cannot select a future date.
          </p>
        )}
      </div>
    </div>
  );
};
