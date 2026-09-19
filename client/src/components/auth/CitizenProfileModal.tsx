import React, { useEffect, useState } from 'react';
import {
  X,
  User,
  MapPin,
  Mail,
  Calendar,
  ShieldCheck,
  FileText,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import type { CitizenUser } from '../../types/auth';
import { apiGetMyComplaints, type ComplaintRecord } from '../../services/api';

interface CitizenProfileModalProps {
  isOpen: boolean;
  view: 'profile' | 'complaints' | null;
  user: CitizenUser | null;
  onClose: () => void;
  onNavigateToSubmit: () => void;
  onNavigateToTrack?: (token: string) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  garbage_dumping: 'Garbage dumping',
  overflowing_bin: 'Overflowing bin',
  pothole: 'Pothole',
  broken_streetlight: 'Broken streetlight',
  unsegregated_waste: 'Unsegregated waste',
  construction_debris: 'Construction debris',
  other: 'Other issue',
};

export const CitizenProfileModal: React.FC<CitizenProfileModalProps> = ({
  isOpen,
  view,
  user,
  onClose,
  onNavigateToSubmit,
  onNavigateToTrack,
}) => {
  const [complaints, setComplaints] = useState<ComplaintRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    let ignore = false;
    if (isOpen && view === 'complaints' && user?.role === 'CITIZEN') {
      apiGetMyComplaints()
        .then((data) => {
          if (!ignore) {
            setComplaints(data);
          }
        })
        .catch((err: any) => {
          if (!ignore) {
            setError(err.message || 'Failed to load your complaints.');
          }
        })
        .finally(() => {
          if (!ignore) {
            setLoading(false);
          }
        });
    }
    return () => {
      ignore = true;
    };
  }, [isOpen, view, user, refreshIndex]);

  const handleRefresh = () => {
    setLoading(true);
    setError(null);
    setRefreshIndex((k) => k + 1);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleCopy = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  if (!isOpen || !user || !view) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bridge-charcoal-900/60 backdrop-blur-xs animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="citizen-modal-title"
    >
      <div
        className={`bg-white rounded-2xl w-full p-6 sm:p-7 shadow-civic-lg border border-bridge-almond-200 transition-all ${
          view === 'complaints' ? 'max-w-2xl' : 'max-w-lg'
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-bridge-almond-50 border border-bridge-almond-200 flex items-center justify-center text-bridge-gold-700">
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
              <h2 id="citizen-modal-title" className="text-xl font-bold text-bridge-charcoal-900">
                {view === 'profile'
                  ? user.role === 'OFFICER'
                    ? 'Officer Profile'
                    : 'Citizen Profile'
                  : 'My Registered Complaints'}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-bridge-charcoal-400 hover:text-bridge-charcoal-700 hover:bg-bridge-almond-100 active:scale-95 transition-all duration-150 p-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-gold-500 cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {view === 'profile' ? (
          <div className="mt-5 space-y-4 text-xs sm:text-sm">
            <div className="p-4 rounded-xl bg-bridge-almond-50/70 border border-bridge-almond-200 space-y-3">
              <div className="flex items-center justify-between border-b border-bridge-almond-200/80 pb-2">
                <span className="text-bridge-charcoal-500 font-medium">Name:</span>
                <span className="font-bold text-bridge-charcoal-900">{user.name}</span>
              </div>
              <div className="flex items-center justify-between border-b border-bridge-almond-200/80 pb-2">
                <span className="text-bridge-charcoal-500 font-medium flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-bridge-charcoal-400" />
                  Email Address:
                </span>
                <span className="font-semibold text-bridge-charcoal-900">{user.email}</span>
              </div>
              {user.department && (
                <div className="flex items-center justify-between border-b border-bridge-almond-200/80 pb-2">
                  <span className="text-bridge-charcoal-500 font-medium">Department:</span>
                  <span className="font-semibold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-xs">
                    {user.department}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between border-b border-bridge-almond-200/80 pb-2">
                <span className="text-bridge-charcoal-500 font-medium flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-bridge-charcoal-400" />
                  Assigned Ward / Locality:
                </span>
                <span className="font-semibold text-bridge-charcoal-900">
                  {user.ward || 'Not specified'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-bridge-charcoal-500 font-medium flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-bridge-charcoal-400" />
                  Account Status:
                </span>
                <span className="font-medium text-emerald-700">
                  Active & Verified
                </span>
              </div>
            </div>

            <div className="p-3 bg-bridge-gold-50 border border-bridge-gold-200 rounded-lg text-xs text-bridge-charcoal-900 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-bridge-gold-700 shrink-0 mt-0.5" />
              <span>
                {user.role === 'OFFICER'
                  ? 'Authenticated as official Mysuru City Corporation (MCC) staff. Authorized for complaint review and duplicate resolution.'
                  : 'Your citizen account is authorized to report civic grievances across Mysuru City Corporation (MCC) Wards.'}
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {/* Loading State */}
            {loading && (
              <div className="py-12 text-center space-y-2">
                <Loader2 className="w-6 h-6 text-bridge-gold-600 animate-spin mx-auto" />
                <p className="text-xs text-bridge-charcoal-600">Retrieving your registered complaints...</p>
              </div>
            )}

            {/* Error State */}
            {error && !loading && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-900 text-xs">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <p className="font-bold">Error loading complaints</p>
                  <p className="text-rose-700">{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    icon={<RefreshCw className="w-3 h-3" />}
                    className="mt-2"
                  >
                    Retry
                  </Button>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!loading && !error && complaints.length === 0 && (
              <div className="text-center py-8 px-4 bg-bridge-almond-50 rounded-xl border border-dashed border-bridge-almond-300">
                <FileText className="w-10 h-10 text-bridge-charcoal-400 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-bridge-charcoal-800">
                  No complaints submitted yet
                </h3>
                <p className="text-xs text-bridge-charcoal-500 max-w-xs mx-auto mt-1">
                  When you submit a civic complaint, its tracking token and resolution status will appear here.
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
            )}

            {/* Complaints List */}
            {!loading && !error && complaints.length > 0 && (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {complaints.map((c) => (
                  <div
                    key={c.id}
                    className="p-4 rounded-xl border border-bridge-almond-200 bg-bridge-almond-50/50 hover:bg-white hover:border-bridge-gold-400 hover:shadow-civic-sm transition-all duration-200 space-y-2.5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs sm:text-sm font-bold text-bridge-charcoal-900 bg-white px-2 py-0.5 rounded border border-bridge-almond-200">
                          {c.trackingToken}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(c.trackingToken)}
                          className="text-bridge-charcoal-400 hover:text-bridge-charcoal-700 cursor-pointer"
                          title="Copy tracking token"
                        >
                          {copiedToken === c.trackingToken ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        {c.verificationResult?.duplicateRisk && (
                          <Badge
                            variant={
                              c.verificationResult.duplicateRisk === 'HIGH'
                                ? 'duplicate'
                                : c.verificationResult.duplicateRisk === 'MEDIUM'
                                  ? 'review'
                                  : 'verified'
                            }
                            size="sm"
                          >
                            {c.verificationResult.duplicateRisk} RISK
                          </Badge>
                        )}
                        <Badge
                          variant={
                            c.status === 'RESOLVED' || c.status === 'CLOSED'
                              ? 'verified'
                              : c.status === 'IN_PROGRESS'
                                ? 'info'
                                : 'review'
                          }
                          size="sm"
                        >
                          {c.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-bridge-charcoal-900">
                        {CATEGORY_LABELS[c.category] || c.category}
                      </h4>
                      <p className="text-xs text-bridge-charcoal-600 line-clamp-2 mt-0.5 leading-relaxed">
                        {c.description}
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-1 border-t border-bridge-almond-200/80 text-[11px] text-bridge-charcoal-500 gap-2">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-bridge-charcoal-400" />
                          {c.locationArea}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-bridge-charcoal-400" />
                          {c.observedDate}
                        </span>
                      </div>

                      {onNavigateToTrack && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onNavigateToTrack(c.trackingToken);
                          }}
                          className="text-bridge-gold-700 hover:text-bridge-gold-900 font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <span>Track Progress</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-between items-center">
          {view === 'complaints' && (
            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={handleRefresh}
              disabled={loading}
            >
              Refresh
            </Button>
          )}
          <div className="ml-auto">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
