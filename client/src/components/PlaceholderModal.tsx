import React, { useEffect } from 'react';
import { X, Construction, ArrowRight } from 'lucide-react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';

interface PlaceholderModalProps {
  isOpen: boolean;
  featureName: string;
  onClose: () => void;
}

export const PlaceholderModal: React.FC<PlaceholderModalProps> = ({
  isOpen,
  featureName,
  onClose,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-slate-900/40 backdrop-blur-xs animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-civic-lg border border-brand-slate-200">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
              <Construction className="w-5 h-5" />
            </div>
            <div>
              <Badge variant="review" size="sm">
                Under Active Development
              </Badge>
              <h3 id="modal-title" className="text-lg font-bold text-brand-slate-900 mt-1">
                {featureName}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-brand-slate-400 hover:text-brand-slate-700 p-1 rounded-lg focus-visible:ring-2 focus-visible:ring-brand-teal-600 cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 text-xs sm:text-sm text-brand-slate-600 space-y-3 leading-relaxed">
          <p>
            In accordance with the <strong>Master Agent Rulebook</strong>, this module will be implemented in subsequent phases:
          </p>
          <ul className="list-disc list-inside space-y-1 text-brand-slate-700 font-medium pl-1">
            <li>Phase 3: Citizen Complaint Submission & Verification Engine</li>
            <li>Phase 4: MCC Ward Routing & Follow-Through SLA Tracker</li>
            <li>Phase 5: Public Visibility Hub & Interactive Mysuru Map</li>
          </ul>
          <p className="text-xs text-brand-slate-500 italic">
            Zero fake APIs or fabricated data are generated in Phase 2.
          </p>
        </div>

        <div className="mt-6 flex justify-end gap-2.5">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onClose}
            icon={<ArrowRight className="w-3.5 h-3.5" />}
          >
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
};
