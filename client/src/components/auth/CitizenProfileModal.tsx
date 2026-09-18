import React, { useEffect } from 'react';
import { X, User, MapPin, Mail, Calendar, ShieldCheck, FileText } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import type { CitizenUser } from '../../types/auth';

interface CitizenProfileModalProps {
  isOpen: boolean;
  view: 'profile' | 'complaints' | null;
  user: CitizenUser | null;
  onClose: () => void;
  onNavigateToSubmit: () => void;
}

export const CitizenProfileModal: React.FC<CitizenProfileModalProps> = ({
  isOpen,
  view,
  user,
  onClose,
  onNavigateToSubmit,
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

  if (!isOpen || !user || !view) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-slate-900/50 backdrop-blur-xs animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="citizen-modal-title"
    >
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-civic-lg border border-brand-slate-200">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-teal-50 border border-brand-teal-200 flex items-center justify-center text-brand-teal-700">
              {view === 'profile' ? <User className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div>
              <Badge
                variant={user.role === 'OFFICER' ? 'review' : 'verified'}
                size="sm"
                className="mb-1"
              >
                {user.role === 'OFFICER' ? 'MCC Officer Account' : 'Citizen Account'}
              </Badge>
              <h2 id="citizen-modal-title" className="text-xl font-bold text-brand-slate-900">
                {view === 'profile'
                  ? user.role === 'OFFICER'
                    ? 'Officer Profile'
                    : 'Citizen Profile'
                  : 'My Complaints'}
              </h2>
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

        {view === 'profile' ? (
          <div className="mt-5 space-y-4 text-xs sm:text-sm">
            <div className="p-4 rounded-xl bg-brand-slate-50 border border-brand-slate-200 space-y-3">
              <div className="flex items-center justify-between border-b border-brand-slate-200 pb-2">
                <span className="text-brand-slate-500 font-medium">Name:</span>
                <span className="font-bold text-brand-slate-900">{user.name}</span>
              </div>
              <div className="flex items-center justify-between border-b border-brand-slate-200 pb-2">
                <span className="text-brand-slate-500 font-medium flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-brand-slate-400" />
                  Email Address:
                </span>
                <span className="font-semibold text-brand-slate-900">{user.email}</span>
              </div>
              {user.department && (
                <div className="flex items-center justify-between border-b border-brand-slate-200 pb-2">
                  <span className="text-brand-slate-500 font-medium">Department:</span>
                  <span className="font-semibold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-xs">
                    {user.department}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between border-b border-brand-slate-200 pb-2">
                <span className="text-brand-slate-500 font-medium flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-brand-slate-400" />
                  Assigned Ward / Locality:
                </span>
                <span className="font-semibold text-brand-slate-900">
                  {user.ward || 'Mysuru (General)'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-brand-slate-500 font-medium flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-brand-slate-400" />
                  Account Status:
                </span>
                <span className="text-brand-slate-700 font-medium text-emerald-700">
                  Active & Verified
                </span>
              </div>
            </div>

            <div className="p-3 bg-brand-teal-50 border border-brand-teal-200 rounded-lg text-xs text-brand-teal-900 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-brand-teal-700 shrink-0 mt-0.5" />
              <span>
                {user.role === 'OFFICER'
                  ? 'Authenticated as official Mysuru City Corporation (MCC) staff. Authorized for complaint review and duplicate resolution.'
                  : 'Your citizen account is authorized to report civic grievances across Mysuru City Corporation (MCC) Wards.'}
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="text-center py-8 px-4 bg-brand-slate-50 rounded-xl border border-dashed border-brand-slate-300">
              <FileText className="w-10 h-10 text-brand-slate-400 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-brand-slate-800">
                No active complaints submitted in this session
              </h3>
              <p className="text-xs text-brand-slate-500 max-w-xs mx-auto mt-1">
                When you submit a civic complaint, its tracking token and resolution status will be displayed here.
              </p>
              <div className="mt-4">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    onClose();
                    onNavigateToSubmit();
                  }}
                >
                  Report a Civic Issue Now
                </Button>
              </div>
            </div>

            <p className="text-[11px] text-brand-slate-500 italic text-center">
              Notice: Persistent database history will be synchronized when backend database integration is completed.
            </p>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
