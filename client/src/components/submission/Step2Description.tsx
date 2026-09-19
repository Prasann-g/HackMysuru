import React from 'react';
import { Calendar, AlertCircle, FileText, CheckCircle2, Clock } from 'lucide-react';

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
  const today = new Date().toISOString().split('T')[0];
  const charLength = description.trim().length;
  const isLengthValid = charLength >= 10 && charLength <= 1000;

  const handleSetToday = () => {
    onChangeObservedDate(today);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base sm:text-lg font-bold text-bridge-charcoal-900">
          Describe the Grievance & When It Happened
        </h2>
        <p className="text-xs sm:text-sm text-bridge-charcoal-600 mt-1">
          Providing specific observations helps municipal engineers locate the problem and assess urgency.
        </p>
      </div>

      {/* Complaint Description Input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor="complaint-description"
            className="text-xs font-semibold text-bridge-charcoal-900 flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5 text-bridge-gold-700" />
            <span>Detailed Description</span>
            <span className="text-rose-500 font-bold">*</span>
          </label>
          <div className="flex items-center gap-1.5 text-[11px]">
            {isLengthValid ? (
              <span className="text-emerald-700 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {charLength} / 1000 chars
              </span>
            ) : (
              <span
                className={`${
                  charLength > 0 && charLength < 10
                    ? 'text-amber-700 font-medium'
                    : 'text-bridge-charcoal-400'
                }`}
              >
                {charLength} / 1000 (min 10)
              </span>
            )}
          </div>
        </div>

        <textarea
          id="complaint-description"
          rows={5}
          value={description}
          onChange={(e) => onChangeDescription(e.target.value)}
          maxLength={1000}
          placeholder="e.g., Near Kuvempunagar Double Road junction opposite the bakery, a large pothole approximately 2 feet wide has formed. Rainwater is accumulating, creating a hazard for two-wheelers."
          aria-invalid={!!errors.description}
          aria-describedby={errors.description ? 'desc-error' : 'desc-hint'}
          className={`w-full px-3.5 py-2.5 text-sm bg-white border rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-gold-500 text-bridge-charcoal-900 placeholder:text-bridge-charcoal-400 transition-colors ${
            errors.description
              ? 'border-rose-400 bg-rose-50/20'
              : isLengthValid
              ? 'border-bridge-almond-300 focus:border-bridge-gold-500'
              : 'border-bridge-almond-200'
          }`}
        />

        {errors.description ? (
          <p id="desc-error" className="text-xs text-rose-600 flex items-center gap-1.5 animate-fadeIn">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{errors.description}</span>
          </p>
        ) : (
          <p id="desc-hint" className="text-[11px] text-bridge-charcoal-500">
            Minimum 10 characters. Include clear details such as nearby landmarks, approximate size, or safety hazards.
          </p>
        )}
      </div>

      {/* Date Observed Input */}
      <div className="space-y-2 max-w-sm">
        <div className="flex items-center justify-between">
          <label
            htmlFor="observed-date"
            className="text-xs font-semibold text-bridge-charcoal-900 flex items-center gap-1.5"
          >
            <Calendar className="w-3.5 h-3.5 text-bridge-gold-700" />
            <span>Date Observed</span>
            <span className="text-rose-500 font-bold">*</span>
          </label>
          <button
            type="button"
            onClick={handleSetToday}
            className="text-[11px] font-semibold text-bridge-gold-700 hover:text-bridge-gold-800 hover:underline flex items-center gap-1"
          >
            <Clock className="w-3 h-3" />
            Set to Today
          </button>
        </div>

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
          <p id="date-error" className="text-xs text-rose-600 flex items-center gap-1.5 animate-fadeIn">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{errors.observedDate}</span>
          </p>
        ) : (
          <p className="text-[11px] text-bridge-charcoal-500">
            The date when you personally witnessed the issue (cannot be a future date).
          </p>
        )}
      </div>
    </div>
  );
};
