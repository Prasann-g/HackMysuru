import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  CheckCircle2,
  Clock,
  MapPin,
  Calendar,
  ShieldCheck,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card, CardBody } from '../ui/Card';
import { apiTrackComplaint, type PublicTrackResult } from '../../services/api';

interface CitizenTrackingDrawerProps {
  isOpen: boolean;
  token: string | null;
  onClose: () => void;
  onReportIssue?: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  garbage_dumping: 'Garbage & Waste',
  overflowing_bin: 'Overflowing Bin',
  pothole: 'Road Pothole',
  broken_streetlight: 'Broken Streetlight',
  unsegregated_waste: 'Unsegregated Waste',
  construction_debris: 'Construction Debris',
  other: 'General Civic Issue',
};

const CATEGORY_BADGES: Record<string, string> = {
  pothole: 'bg-amber-50 text-amber-800 border-amber-200',
  garbage_dumping: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  broken_streetlight: 'bg-blue-50 text-blue-800 border-blue-200',
  overflowing_bin: 'bg-purple-50 text-purple-800 border-purple-200',
  unsegregated_waste: 'bg-lime-50 text-lime-800 border-lime-200',
  construction_debris: 'bg-orange-50 text-orange-800 border-orange-200',
  other: 'bg-bridge-almond-100 text-bridge-charcoal-700 border-bridge-almond-200',
};

type TimelineStep = {
  id: string;
  title: string;
  description: string;
};

const TIMELINE_STEPS: TimelineStep[] = [
  {
    id: 'SUBMITTED',
    title: 'Submitted & Validated',
    description: 'Registered in municipal registry with automated verification signals generated.',
  },
  {
    id: 'UNDER_REVIEW',
    title: 'Ward Officer Triage',
    description: 'Assigned municipal officer reviewing evidence, duplicate risk, and jurisdiction.',
  },
  {
    id: 'IN_PROGRESS',
    title: 'Field Team Dispatched',
    description: 'Department maintenance team assigned for on-site inspection and remediation.',
  },
  {
    id: 'RESOLVED',
    title: 'Resolved & Verified',
    description: 'Civic issue addressed and confirmed by municipal authority.',
  },
];

function getStepIndex(status: string): number {
  switch (status.toUpperCase()) {
    case 'SUBMITTED':
      return 0;
    case 'UNDER_REVIEW':
    case 'NEEDS_CLARIFICATION':
      return 1;
    case 'FORWARDED':
    case 'IN_PROGRESS':
      return 2;
    case 'RESOLVED':
    case 'CLOSED':
      return 3;
    default:
      return 0;
  }
}

export const CitizenTrackingDrawer: React.FC<CitizenTrackingDrawerProps> = ({
  isOpen,
  token,
  onClose,
  onReportIssue,
}) => {
  const [data, setData] = useState<PublicTrackResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<boolean>(false);
  const [manualToken, setManualToken] = useState<string>(token || '');
  const [prevToken, setPrevToken] = useState<string | null>(token);

  if (token !== prevToken) {
    setPrevToken(token);
    setManualToken(token || '');
  }

  // Lock body scroll and handle Escape key
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

  useEffect(() => {
    const clean = token?.trim();
    if (!isOpen || !clean) {
      return;
    }

    let isMounted = true;
    apiTrackComplaint(clean)
      .then((res) => {
        if (isMounted) {
          setData(res);
          setLoading(false);
          setError(null);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          setData(null);
          setError(err.message || 'Complaint not found with the provided tracking token.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, token]);

  const handleManualSearch = (targetToken: string) => {
    const clean = targetToken.trim();
    if (!clean) return;

    setLoading(true);
    setError(null);

    apiTrackComplaint(clean)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err: any) => {
        setData(null);
        setError(err.message || 'Complaint not found with the provided tracking token.');
        setLoading(false);
      });
  };

  const handleCopy = () => {
    if (data?.trackingToken) {
      navigator.clipboard.writeText(data.trackingToken);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  if (!isOpen) return null;

  const currentStepIdx = data ? getStepIndex(data.status) : 0;
  const isClosed = data?.status === 'CLOSED';
  const isResolved = data?.status === 'RESOLVED';
  const categoryBadgeClass = data ? (CATEGORY_BADGES[data.category] || CATEGORY_BADGES.other) : '';

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-bridge-charcoal-900/60 backdrop-blur-xs flex justify-end animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tracking-drawer-title"
    >
      {/* Clickable Backdrop overlay */}
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Drawer Panel */}
      <div className="relative w-full max-w-2xl bg-white shadow-2xl border-l border-bridge-almond-300 z-10 flex flex-col h-full overflow-hidden animate-slideLeft">
        {/* Drawer Header */}
        <div className="bg-bridge-ivory-50 px-6 py-4 border-b border-bridge-almond-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-bridge-gold-50 border border-bridge-gold-200 flex items-center justify-center text-bridge-gold-700 shrink-0">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h2 id="tracking-drawer-title" className="text-base font-bold text-bridge-charcoal-900 leading-tight">
                Grievance Progress &amp; Evidence Timeline
              </h2>
              <p className="text-xs text-bridge-charcoal-500">
                Official MCC lifecycle tracking with explainable verification
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {token && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleManualSearch(token)}
                icon={<RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
              >
                Refresh
              </Button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-bridge-charcoal-400 hover:text-bridge-charcoal-700 hover:bg-bridge-almond-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-gold-500 cursor-pointer"
              aria-label="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Token Search Bar (if searching another token) */}
        <div className="px-6 py-3 bg-bridge-almond-50/70 border-b border-bridge-almond-200 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleManualSearch(manualToken);
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-bridge-charcoal-400" />
              <input
                type="text"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="Enter tracking token (e.g., DEMO-2026-0001 or TRK-...)"
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-bridge-almond-300 rounded-xl text-bridge-charcoal-900 placeholder:text-bridge-charcoal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-gold-500"
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={loading || !manualToken.trim()}
            >
              Track
            </Button>
          </form>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-bridge-gold-600 animate-spin mx-auto" />
              <p className="text-xs text-bridge-charcoal-600 font-medium">
                Retrieving authentic municipal tracking record...
              </p>
            </div>
          ) : error ? (
            <div className="py-12 text-center space-y-4 max-w-md mx-auto">
              <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-bridge-charcoal-900">
                  Tracking Record Not Found
                </h3>
                <p className="text-xs text-bridge-charcoal-600 mt-1 leading-relaxed">
                  {error}
                </p>
              </div>
              <div className="pt-2">
                <p className="text-[11px] text-bridge-charcoal-500 mb-3">
                  Please verify that the tracking code matches the format assigned upon registration.
                </p>
              </div>
            </div>
          ) : !data ? (
            <div className="py-16 text-center space-y-3">
              <Search className="w-10 h-10 text-bridge-charcoal-300 mx-auto" />
              <p className="text-xs text-bridge-charcoal-500 font-medium">
                Enter a tracking token above to inspect grievance progress.
              </p>
            </div>
          ) : (
            <>
              {/* Token & Status Banner */}
              <div className="bg-bridge-ivory-50 border border-bridge-almond-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base sm:text-lg font-bold text-bridge-charcoal-900 bg-white border border-bridge-almond-200 px-3 py-1 rounded-xl shadow-xs">
                      {data.trackingToken}
                    </span>
                    <button
                      onClick={handleCopy}
                      className="p-1.5 rounded-lg border border-bridge-almond-200 bg-white text-bridge-charcoal-500 hover:text-bridge-gold-700 transition-colors cursor-pointer"
                      title="Copy token"
                    >
                      {copiedToken ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${categoryBadgeClass}`}
                    >
                      {CATEGORY_LABELS[data.category] || data.category}
                    </span>
                    <Badge
                      variant={
                        isResolved
                          ? 'verified'
                          : isClosed
                          ? 'neutral'
                          : currentStepIdx >= 2
                          ? 'info'
                          : 'review'
                      }
                      size="md"
                    >
                      {data.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>

                <p className="text-xs text-bridge-charcoal-600">
                  Assigned Department:{' '}
                  <strong className="text-bridge-charcoal-900 font-semibold">
                    {data.assignedDepartment || 'Department Allocation in Progress'}
                  </strong>
                </p>
              </div>

              {/* Lifecycle Progress Stepper */}
              <Card>
                <CardBody className="p-5 space-y-4">
                  <span className="text-[11px] font-bold text-bridge-charcoal-400 uppercase tracking-wider block">
                    Municipal Remediation Lifecycle
                  </span>

                  <div className="space-y-4 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-bridge-almond-200">
                    {TIMELINE_STEPS.map((step, idx) => {
                      const isComplete = idx < currentStepIdx || isResolved;
                      const isCurrent = idx === currentStepIdx && !isResolved;

                      return (
                        <div key={step.id} className="relative flex items-start gap-4 pl-1">
                          {/* Step Indicator */}
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold z-10 transition-colors ${
                              isComplete
                                ? 'bg-emerald-600 text-white'
                                : isCurrent
                                ? 'bg-bridge-gold-500 text-white ring-4 ring-bridge-gold-100'
                                : 'bg-white border-2 border-bridge-almond-300 text-bridge-charcoal-400'
                            }`}
                          >
                            {isComplete ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : isCurrent ? (
                              <Clock className="w-4 h-4 animate-pulse" />
                            ) : (
                              idx + 1
                            )}
                          </div>

                          {/* Step Content */}
                          <div className="flex-1 pb-2">
                            <div className="flex items-center justify-between gap-2">
                              <h4
                                className={`text-xs sm:text-sm font-bold ${
                                  isCurrent
                                    ? 'text-bridge-gold-800'
                                    : isComplete
                                    ? 'text-bridge-charcoal-900'
                                    : 'text-bridge-charcoal-400'
                                }`}
                              >
                                {step.title}
                              </h4>
                              {isCurrent && (
                                <span className="text-[10px] uppercase font-bold text-bridge-gold-700 bg-bridge-gold-50 border border-bridge-gold-200 px-2 py-0.5 rounded-full">
                                  Current Stage
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-bridge-charcoal-600 mt-0.5 leading-relaxed">
                              {step.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardBody>
              </Card>

              {/* Grievance Core Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-white border border-bridge-almond-200 rounded-xl space-y-1">
                  <span className="text-[11px] text-bridge-charcoal-500 font-medium block">
                    Location &amp; Landmark
                  </span>
                  <div className="font-semibold text-bridge-charcoal-900 flex items-center gap-1.5 pt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-bridge-gold-700 shrink-0" />
                    <span>{data.locationArea}</span>
                  </div>
                </div>

                <div className="p-4 bg-white border border-bridge-almond-200 rounded-xl space-y-1">
                  <span className="text-[11px] text-bridge-charcoal-500 font-medium block">
                    Incident Date
                  </span>
                  <div className="font-semibold text-bridge-charcoal-900 flex items-center gap-1.5 pt-0.5">
                    <Calendar className="w-3.5 h-3.5 text-bridge-gold-700 shrink-0" />
                    <span>{data.observedDate}</span>
                  </div>
                  <p className="text-bridge-charcoal-500 text-[11px] pt-0.5">
                    Reported on: {new Date(data.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>

              {/* Description */}
              <div className="p-4 bg-white border border-bridge-almond-200 rounded-xl space-y-1.5">
                <span className="text-[11px] font-semibold text-bridge-charcoal-500 uppercase tracking-wider block">
                  Complaint Description
                </span>
                <p className="text-xs sm:text-sm text-bridge-charcoal-800 leading-relaxed font-medium">
                  {data.description}
                </p>
              </div>

              {/* Explainable Verification Breakdown (Rule 3 & 8 compliant) */}
              <div className="p-4 bg-bridge-gold-50/40 border border-bridge-gold-200 rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-bridge-gold-700" />
                  <span className="text-xs font-bold text-bridge-charcoal-900">
                    Explainable Verification Signals
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-bridge-charcoal-500 font-medium">Duplicate Risk Assessment:</span>
                    <div className="mt-1">
                      <Badge
                        variant={
                          data.duplicateRisk === 'HIGH'
                            ? 'duplicate'
                            : data.duplicateRisk === 'MEDIUM'
                            ? 'review'
                            : 'verified'
                        }
                        size="sm"
                      >
                        {data.duplicateRisk || 'LOW'} RISK
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <span className="text-bridge-charcoal-500 font-medium">Verification Outcome:</span>
                    <p className="text-bridge-charcoal-800 font-semibold mt-1">
                      {data.verificationOutcome || 'STANDARD_TRIAGE'}
                    </p>
                  </div>
                </div>

                {data.signals && data.signals.length > 0 && (
                  <div>
                    <span className="text-[11px] font-semibold text-bridge-charcoal-600 block">
                      Signals Evaluated:
                    </span>
                    <ul className="mt-1 space-y-0.5 list-disc list-inside text-[11px] text-bridge-charcoal-700">
                      {data.signals.map((sig: string, i: number) => (
                        <li key={i}>{sig}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="text-[10px] text-bridge-charcoal-500 italic border-t border-bridge-gold-200/60 pt-2">
                  {data.disclaimer || 'Verification signals assist ward officers during manual triage and do not prove or disprove complaint validity.'}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Drawer Footer Actions */}
        <div className="p-4 bg-white border-t border-bridge-almond-200 flex items-center justify-between shrink-0">
          <Button
            variant="outline"
            size="md"
            onClick={onClose}
          >
            Close Inspector
          </Button>

          {onReportIssue && (
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                onClose();
                onReportIssue();
              }}
            >
              Report New Issue
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
