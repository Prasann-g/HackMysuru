import React from 'react';
import { CheckCircle2, Circle, Lock } from 'lucide-react';

export interface SectionDef {
  id: number;
  label: string;
  sublabel: string;
  required: boolean;
}

interface SectionRailProps {
  sections: SectionDef[];
  currentSection: number;
  maxVisitedSection: number;
  onSectionClick: (id: number) => void;
}

export const SectionRail: React.FC<SectionRailProps> = ({
  sections,
  currentSection,
  maxVisitedSection,
  onSectionClick,
}) => {
  return (
    <nav
      aria-label="Complaint form progress"
      className="flex flex-col gap-1 w-full"
    >
      {sections.map((section, idx) => {
        const isCompleted = section.id < currentSection;
        const isCurrent = section.id === currentSection;
        const isVisited = section.id <= maxVisitedSection;
        const isLocked = !isVisited;

        const canClick = isVisited && !isCurrent;

        return (
          <div key={section.id} className="flex items-stretch gap-0">
            {/* Connector column: icon + vertical line */}
            <div className="flex flex-col items-center w-8 shrink-0">
              {/* Section icon */}
              <button
                type="button"
                disabled={!canClick}
                onClick={() => canClick && onSectionClick(section.id)}
                aria-label={`Go to ${section.label}`}
                aria-current={isCurrent ? 'step' : undefined}
                className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-gold-500 focus-visible:ring-offset-1 mt-1 ${
                  isCurrent
                    ? 'border-bridge-gold-500 bg-bridge-gold-500 text-white shadow-sm cursor-default'
                    : isCompleted
                    ? 'border-bridge-gold-400 bg-bridge-gold-50 text-bridge-gold-700 hover:bg-bridge-gold-100 cursor-pointer'
                    : isLocked
                    ? 'border-bridge-almond-200 bg-bridge-almond-50 text-bridge-charcoal-300 cursor-default'
                    : 'border-bridge-almond-300 bg-white text-bridge-charcoal-400 hover:border-bridge-gold-400 cursor-pointer'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : isLocked ? (
                  <Lock className="w-3 h-3" />
                ) : (
                  <Circle className="w-3 h-3" />
                )}
              </button>

              {/* Vertical connector line (not shown for last item) */}
              {idx < sections.length - 1 && (
                <div
                  className={`flex-1 w-0.5 my-1 rounded-full transition-colors duration-300 ease-out ${
                    isCompleted ? 'bg-bridge-gold-300' : 'bg-bridge-almond-200'
                  }`}
                  style={{ minHeight: '2rem' }}
                />
              )}
            </div>

            {/* Section text content */}
            <button
              type="button"
              disabled={!canClick}
              onClick={() => canClick && onSectionClick(section.id)}
              className={`flex-1 min-w-0 text-left px-3 py-2 rounded-xl transition-all duration-200 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-gold-500 mb-1 ${
                isCurrent
                  ? 'bg-bridge-gold-50 border border-bridge-gold-200 shadow-xs'
                  : isCompleted
                  ? 'hover:bg-bridge-almond-50 cursor-pointer active:scale-[0.99] motion-reduce:active:scale-100'
                  : isLocked
                  ? 'cursor-default opacity-50'
                  : 'hover:bg-bridge-almond-50 cursor-pointer active:scale-[0.99] motion-reduce:active:scale-100'
              }`}
            >
              <span
                className={`block text-xs font-bold leading-tight truncate transition-colors duration-200 ${
                  isCurrent
                    ? 'text-bridge-gold-800'
                    : isCompleted
                    ? 'text-bridge-charcoal-700'
                    : isLocked
                    ? 'text-bridge-charcoal-300'
                    : 'text-bridge-charcoal-500'
                }`}
              >
                {section.label}
              </span>
              <span
                className={`block text-[10px] mt-0.5 truncate transition-colors duration-200 ${
                  isCurrent
                    ? 'text-bridge-gold-600'
                    : 'text-bridge-charcoal-400'
                }`}
              >
                {section.sublabel}
              </span>
              {!section.required && (
                <span className="text-[9px] uppercase tracking-wider font-semibold text-bridge-charcoal-300 mt-0.5 block">
                  Optional
                </span>
              )}
            </button>
          </div>
        );
      })}

      {/* Progress summary */}
      <div className="mt-3 pt-3 border-t border-bridge-almond-200">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-bridge-charcoal-400">
            Progress
          </span>
          <span className="text-[10px] font-bold text-bridge-charcoal-600">
            {Math.min(currentSection - 1, sections.length)}/{sections.length}
          </span>
        </div>
        <div className="w-full h-1.5 bg-bridge-almond-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-bridge-gold-500 rounded-full transition-all duration-300 ease-out motion-reduce:transition-none"
            style={{
              width: `${Math.max(0, ((currentSection - 1) / sections.length) * 100)}%`,
            }}
          />
        </div>
      </div>
    </nav>
  );
};
