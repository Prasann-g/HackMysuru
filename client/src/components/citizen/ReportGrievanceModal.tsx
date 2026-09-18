import React, { useEffect } from 'react';
import { X, PlusCircle, ShieldCheck } from 'lucide-react';
import { ComplaintSubmissionPortal } from '../submission/ComplaintSubmissionPortal';
import type { ComplaintRecord } from '../../services/api';

interface ReportGrievanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (complaint: ComplaintRecord) => void;
  onTrackComplaint: (token: string) => void;
}

export const ReportGrievanceModal: React.FC<ReportGrievanceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onTrackComplaint,
}) => {
  // Lock body scroll when modal is open and handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-bridge-charcoal-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
    >
      {/* Clickable Backdrop overlay */}
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Content Box */}
      <div className="relative w-full max-w-4xl bg-bridge-ivory-50 rounded-2xl shadow-2xl border border-bridge-almond-300 z-10 overflow-hidden my-4 max-h-[92vh] flex flex-col">
        {/* Modal Top Action Bar */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs px-6 py-4 border-b border-bridge-almond-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-bridge-gold-50 border border-bridge-gold-200 flex items-center justify-center text-bridge-gold-700 shrink-0">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 id="report-modal-title" className="text-base sm:text-lg font-bold text-bridge-charcoal-900 leading-tight">
                Report a Municipal Grievance
              </h2>
              <p className="text-xs text-bridge-charcoal-500">
                Direct MCC intake with automated verification pre-emption
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-bridge-gold-800 bg-bridge-gold-50 border border-bridge-gold-200 px-2.5 py-1 rounded-lg">
              <ShieldCheck className="w-3.5 h-3.5 text-bridge-gold-700" />
              <span>Evidence-Guided</span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-bridge-charcoal-400 hover:text-bridge-charcoal-700 hover:bg-bridge-almond-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-gold-500 cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto flex-1 p-2 sm:p-4">
          <ComplaintSubmissionPortal
            onBackToHome={onClose}
            onNavigateToTrack={(token) => {
              onClose();
              onTrackComplaint(token);
            }}
            onSuccess={(complaint) => {
              onSuccess(complaint);
            }}
          />
        </div>
      </div>
    </div>
  );
};
