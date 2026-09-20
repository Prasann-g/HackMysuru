import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  // Lock background body scroll and handle Escape key when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Save previous styles
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;

    // Compensate for scrollbar width to prevent page content shifting
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 md:p-6"
      style={{
        backgroundColor: 'rgba(15, 18, 24, 0.60)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
    >
      {/* Clickable backdrop overlay to dismiss */}
      <div
        className="absolute inset-0 cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      {/*
        Modal Box:
        - Mobile (<640px): full viewport h-full w-full rounded-none
        - Desktop / Tablet: centered, rounded-2xl, max-w-5xl, h-[90vh] max-h-[820px]
        - Fits strictly within the viewport height
        - Header and footer are pinned; only the content area scrolls internally
      */}
      <div
        className="relative w-full h-[100dvh] sm:h-[90vh] sm:max-h-[820px] sm:max-w-4xl md:max-w-5xl bg-bridge-ivory-50 sm:rounded-2xl shadow-bridge-modal border-0 sm:border sm:border-bridge-almond-300 flex flex-col z-10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Fixed / Pinned Top Header Bar ── */}
        <header className="shrink-0 bg-white px-4 sm:px-6 py-3.5 border-b border-bridge-almond-200 flex items-center justify-between z-20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-bridge-gold-50 border border-bridge-gold-200 flex items-center justify-center text-bridge-gold-700 shrink-0">
              <PlusCircle className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="report-modal-title"
                className="text-sm sm:text-base font-bold text-bridge-charcoal-900 leading-tight"
              >
                Report a Civic Issue
              </h2>
              <p className="text-[11px] sm:text-xs text-bridge-charcoal-500">
                Mysuru City Corporation — Citizen Grievance Services
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-medium text-bridge-gold-800 bg-bridge-gold-50 border border-bridge-gold-200 px-2.5 py-1 rounded-md">
              <ShieldCheck className="w-3.5 h-3.5 text-bridge-gold-700" />
              <span>Verified Intake</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-bridge-charcoal-400 hover:text-bridge-charcoal-700 hover:bg-bridge-almond-100 active:scale-95 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-gold-500 cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* ── Modal Content Host: ComplaintSubmissionPortal ── */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <ComplaintSubmissionPortal
            isModal={true}
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

  return createPortal(modalContent, document.body);
};
