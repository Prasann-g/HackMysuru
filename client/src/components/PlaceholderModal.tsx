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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bridge-charcoal-900/40 backdrop-blur-xs animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-civic-lg border border-bridge-almond-200">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
              <Construction className="w-5 h-5" />
            </div>
            <div>
              <Badge variant="review" size="sm">
                Under Active Development
              </Badge>
              <h3 id="modal-title" className="text-lg font-bold text-bridge-charcoal-900 mt-1">
                {featureName}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-bridge-charcoal-400 hover:text-bridge-charcoal-700 p-1 rounded-lg focus-visible:ring-2 focus-visible:ring-bridge-gold-500 cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 text-xs sm:text-sm text-bridge-charcoal-600 space-y-3 leading-relaxed">
          <p>
            In accordance with the <strong>CivicBridge Product Scope</strong>, this module is scheduled for development in Phase 5:
          </p>
          <ul className="list-disc list-inside space-y-1 text-bridge-charcoal-700 font-medium pl-1">
            <li>Public Transparency Map & Corporation-Wide Grievance Analytics</li>
          </ul>
          <p className="text-xs text-bridge-charcoal-500 italic">
            In compliance with anti-hallucination rules, map coordinates, zone boundaries, and aggregated municipal metrics are not fabricated prior to official integration.
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
