import React from 'react';
import { Check } from 'lucide-react';

interface StepperProps {
  currentStep: number;
  totalSteps: number;
  stepLabels: string[];
  maxVisitedStep?: number;
  onStepClick?: (step: number) => void;
}

export const Stepper: React.FC<StepperProps> = ({
  currentStep,
  totalSteps,
  stepLabels,
  maxVisitedStep = 1,
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
            const isVisited = stepNumber <= maxVisitedStep;
            const isClickable = !isCurrent && isVisited && !!onStepClick;

            return (
              <li
                key={label}
                className={`relative flex-1 ${
                  index !== totalSteps - 1 ? 'pr-4 sm:pr-6' : ''
                }`}
              >
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => isClickable && onStepClick(stepNumber)}
                    disabled={!isClickable}
                    className={`flex items-center gap-2.5 text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-gold-500 rounded-lg p-1 transition-all ${
                      isClickable
                        ? 'cursor-pointer hover:bg-bridge-almond-50'
                        : 'cursor-default'
                    }`}
                    aria-current={isCurrent ? 'step' : undefined}
                  >
                    {/* Step Circle */}
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors ${
                        isCompleted
                          ? 'bg-bridge-charcoal-800 text-white shadow-sm'
                          : isCurrent
                          ? 'bg-bridge-gold-50 border-2 border-bridge-gold-500 text-bridge-gold-700 font-bold shadow-sm'
                          : isVisited
                          ? 'bg-bridge-almond-100 border border-bridge-gold-300 text-bridge-charcoal-700'
                          : 'bg-bridge-almond-100 border border-bridge-almond-200 text-bridge-charcoal-400'
                      }`}
                    >
                      {isCompleted ? <Check className="w-3.5 h-3.5" /> : stepNumber}
                    </span>

                    {/* Step Label */}
                    <div className="flex flex-col min-w-0">
                      <span
                        className={`text-[10px] font-semibold tracking-wider uppercase truncate ${
                          isCurrent
                            ? 'text-bridge-gold-700 font-bold'
                            : isCompleted
                            ? 'text-bridge-charcoal-700'
                            : 'text-bridge-charcoal-400'
                        }`}
                      >
                        Step {stepNumber}
                      </span>
                      <span
                        className={`text-xs font-medium truncate ${
                          isCurrent
                            ? 'text-bridge-charcoal-900 font-bold'
                            : isCompleted
                            ? 'text-bridge-charcoal-800'
                            : 'text-bridge-charcoal-500'
                        }`}
                      >
                        {label}
                      </span>
                    </div>
                  </button>

                  {/* Connecting Line */}
                  {index !== totalSteps - 1 && (
                    <div
                      className={`hidden sm:block flex-1 h-0.5 ml-3 transition-colors ${
                        stepNumber < currentStep
                          ? 'bg-bridge-gold-500'
                          : 'bg-bridge-almond-200'
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
          <span className="font-semibold text-bridge-gold-700 uppercase tracking-wider">
            Step {currentStep} of {totalSteps}
          </span>
          <span className="font-bold text-bridge-charcoal-900">
            {stepLabels[currentStep - 1]}
          </span>
        </div>
        <div className="w-full bg-bridge-almond-200 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-bridge-gold-500 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};
