import React from 'react';
import { Check } from 'lucide-react';

interface StepperProps {
  currentStep: number;
  totalSteps: number;
  stepLabels: string[];
  onStepClick?: (step: number) => void;
}

export const Stepper: React.FC<StepperProps> = ({
  currentStep,
  totalSteps,
  stepLabels,
  onStepClick,
}) => {
  return (
    <div className="w-full">
      {/* Desktop & Tablet Stepper */}
      <nav aria-label="Progress" className="hidden sm:block">
        <ol className="flex items-center justify-between">
          {stepLabels.map((label, index) => {
            const stepNumber = index + 1;
            const isCompleted = stepNumber < currentStep;
            const isCurrent = stepNumber === currentStep;
            const isClickable = isCompleted && onStepClick;

            return (
              <li
                key={label}
                className={`relative flex-1 ${
                  index !== totalSteps - 1 ? 'pr-4 sm:pr-8' : ''
                }`}
              >
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => isClickable && onStepClick(stepNumber)}
                    disabled={!isClickable}
                    className={`flex items-center gap-2.5 text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal-600 rounded-lg p-1 ${
                      isClickable ? 'cursor-pointer' : 'cursor-default'
                    }`}
                    aria-current={isCurrent ? 'step' : undefined}
                  >
                    {/* Step Circle */}
                    <span
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors ${
                        isCompleted
                          ? 'bg-brand-teal-600 text-white'
                          : isCurrent
                          ? 'bg-brand-teal-50 border-2 border-brand-teal-600 text-brand-teal-700 font-bold'
                          : 'bg-brand-slate-100 border border-brand-slate-300 text-brand-slate-500'
                      }`}
                    >
                      {isCompleted ? <Check className="w-4 h-4" /> : stepNumber}
                    </span>

                    {/* Step Label */}
                    <div className="flex flex-col">
                      <span
                        className={`text-xs font-semibold tracking-wider uppercase ${
                          isCurrent
                            ? 'text-brand-teal-700'
                            : isCompleted
                            ? 'text-brand-slate-800'
                            : 'text-brand-slate-500'
                        }`}
                      >
                        Step {stepNumber}
                      </span>
                      <span
                        className={`text-xs font-medium ${
                          isCurrent
                            ? 'text-brand-slate-900 font-bold'
                            : isCompleted
                            ? 'text-brand-slate-700'
                            : 'text-brand-slate-500'
                        }`}
                      >
                        {label}
                      </span>
                    </div>
                  </button>

                  {/* Connecting Line */}
                  {index !== totalSteps - 1 && (
                    <div
                      className={`hidden sm:block flex-1 h-0.5 ml-4 transition-colors ${
                        stepNumber < currentStep
                          ? 'bg-brand-teal-600'
                          : 'bg-brand-slate-200'
                      }`}
                      aria-hidden="true"
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Mobile Stepper View */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-semibold text-brand-teal-700 uppercase tracking-wider">
            Step {currentStep} of {totalSteps}
          </span>
          <span className="font-bold text-brand-slate-900">
            {stepLabels[currentStep - 1]}
          </span>
        </div>
        <div className="w-full bg-brand-slate-200 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-brand-teal-600 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};
