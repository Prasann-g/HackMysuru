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
  Building2,
  Camera,
  AlertTriangle,
  FileText,
  HelpCircle,
  Trash2,
  Trash,
  Lightbulb,
  Recycle,
  Hammer,
  ShieldAlert,
  Compass,
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

interface CategoryConfig {
  label: string;
  badge: string;
  icon: React.FC<{ className?: string }>;
}

const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  garbage_dumping: {
    label: 'Garbage & Waste',
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    icon: Trash2,
  },
  overflowing_bin: {
    label: 'Overflowing Waste Bin',
    badge: 'bg-purple-50 text-purple-800 border-purple-200',
    icon: Trash,
  },
  pothole: {
    label: 'Road Pothole',
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
    icon: AlertTriangle,
  },
  broken_streetlight: {
    label: 'Broken Streetlight',
    badge: 'bg-blue-50 text-blue-800 border-blue-200',
    icon: Lightbulb,
  },
  unsegregated_waste: {
    label: 'Unsegregated Waste',
    badge: 'bg-lime-50 text-lime-800 border-lime-200',
    icon: Recycle,
  },
  construction_debris: {
    label: 'Construction Debris',
    badge: 'bg-orange-50 text-orange-800 border-orange-200',
    icon: Hammer,
  },
  other: {
    label: 'General Civic Issue',
    badge: 'bg-bridge-almond-100 text-bridge-charcoal-700 border-bridge-almond-200',
    icon: HelpCircle,
  },
};

type TimelineStep = {
  id: string;
  title: string;
  stageTag: string;
  description: string;
};

const TIMELINE_STEPS: TimelineStep[] = [
  {
    id: 'SUBMITTED',
    title: 'Submitted & Validated',
    stageTag: 'Municipal Intake',
    description: 'Complaint registered in official MCC registry with automated verification signals computed.',
  },
  {
    id: 'UNDER_REVIEW',
    title: 'Ward Officer Triage',
    stageTag: 'Jurisdiction & Deduplication',
    description: 'Assigned ward officer reviewing evidence, duplicate risk assessment, and jurisdictional routing.',
  },
  {
    id: 'IN_PROGRESS',
    title: 'Field Team Dispatched',
    stageTag: 'On-Site Remediation',
    description: 'Department maintenance team assigned for on-site inspection and civic issue remediation.',
  },
  {
    id: 'RESOLVED',
    title: 'Resolved & Verified',
    stageTag: 'Closure & Confirmation',
    description: 'Civic issue addressed and resolution confirmed by municipal engineering team.',
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
    if (token?.trim()) {
      setLoading(true);
      setError(null);
    } else {
      setData(null);
      setError(null);
      setLoading(false);
    }
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

  // Load token data on open or token prop change
  useEffect(() => {
    const clean = token?.trim();
    if (!isOpen || !clean) return;

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
  const isRejected = data?.status.toUpperCase() === 'REJECTED';
  const isClosed = data?.status.toUpperCase() === 'CLOSED';
  const isResolved = data?.status.toUpperCase() === 'RESOLVED';

  const categoryCfg = data
    ? CATEGORY_CONFIG[data.category] || CATEGORY_CONFIG.other
    : CATEGORY_CONFIG.other;
  const CategoryIcon = categoryCfg.icon;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-bridge-charcoal-900/60 backdrop-blur-xs flex justify-end animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tracking-portal-title"
    >
      {/* Clickable Backdrop overlay */}
      <div
        className="fixed inset-0 cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Portal Panel */}
      <div className="relative w-full max-w-2xl sm:max-w-3xl lg:max-w-3xl bg-[#FAF9F5] shadow-2xl border-l border-bridge-almond-200 z-10 flex flex-col h-full max-h-screen overflow-hidden animate-slideLeft motion-reduce:transition-none">
        {/* Portal Header */}
        <header className="bg-white px-5 sm:px-6 py-4 border-b border-bridge-almond-200 flex items-center justify-between shrink-0 shadow-bridge-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-bridge-gold-50 border border-bridge-gold-200 flex items-center justify-center text-bridge-gold-700 shrink-0">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="tracking-portal-title"
                  className="text-base sm:text-lg font-bold text-bridge-charcoal-900 leading-tight"
                >
                  Municipal Grievance Tracker
                </h2>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-bridge-gold-50 text-bridge-gold-800 border border-bridge-gold-200">
                  Official MCC Portal
                </span>
              </div>
              <p className="text-xs text-bridge-charcoal-500 mt-0.5">
                Transparent lifecycle tracking with explainable verification signals
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {data && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleManualSearch(data.trackingToken)}
                disabled={loading}
                icon={<RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
              >
                Refresh
              </Button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-bridge-charcoal-400 hover:text-bridge-charcoal-800 hover:bg-bridge-almond-100 active:scale-95 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-gold-500 cursor-pointer"
              aria-label="Close tracking portal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Token Search Bar */}
        <div className="bg-white/95 backdrop-blur-xs px-5 sm:px-6 py-3 border-b border-bridge-almond-200 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleManualSearch(manualToken);
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-bridge-charcoal-400 pointer-events-none" />
              <input
                type="text"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="Enter tracking token (e.g. TRK-ABCD-1234 or DEMO-2026-0001)"
                className="civic-input w-full pl-9 pr-8 py-2 text-xs sm:text-sm rounded-xl font-mono transition-all duration-150"
              />
              {manualToken && (
                <button
                  type="button"
                  onClick={() => setManualToken('')}
                  className="absolute right-2.5 top-2.5 text-bridge-charcoal-400 hover:text-bridge-charcoal-700 p-0.5 rounded cursor-pointer"
                  title="Clear input"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={loading || !manualToken.trim()}
              className="px-4 shrink-0"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Track'}
            </Button>
          </form>
        </div>

        {/* Scrollable Portal Content (Single Controlled Scroll Container) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 focus:outline-none">
          {loading ? (
            <div className="py-24 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-bridge-gold-50 border border-bridge-gold-200 flex items-center justify-center text-bridge-gold-600 mx-auto">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-bridge-charcoal-900">
                  Retrieving Municipal Tracking Record
                </h3>
                <p className="text-xs text-bridge-charcoal-500 max-w-sm mx-auto">
                  Connecting to Mysuru City Corporation complaint registry and fetching verified timeline...
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="py-14 text-center space-y-4 max-w-md mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mx-auto">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-bridge-charcoal-900">
                  Tracking Record Not Found
                </h3>
                <p className="text-xs text-bridge-charcoal-600 leading-relaxed">
                  {error}
                </p>
              </div>
              <div className="p-3 bg-white border border-bridge-almond-200 rounded-xl text-left space-y-1 text-xs text-bridge-charcoal-600">
                <p className="font-semibold text-bridge-charcoal-800">Verification Tips:</p>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-bridge-charcoal-500">
                  <li>Ensure the tracking token format matches: <code className="font-mono bg-bridge-almond-100 px-1 py-0.5 rounded text-bridge-charcoal-800">TRK-XXXX-XXXX</code></li>
                  <li>Check for any missing hyphens or characters.</li>
                  <li>Tokens are assigned immediately upon complaint submission.</li>
                </ul>
              </div>
              {manualToken && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setManualToken('')}
                >
                  Clear &amp; Try Another Token
                </Button>
              )}
            </div>
          ) : !data ? (
            <div className="py-20 text-center space-y-4 max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-bridge-almond-100 border border-bridge-almond-200 flex items-center justify-center text-bridge-charcoal-400 mx-auto">
                <Compass className="w-8 h-8 text-bridge-gold-600" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-bridge-charcoal-900">
                  Enter a Tracking Token
                </h3>
                <p className="text-xs text-bridge-charcoal-600 leading-relaxed">
                  Use the search bar above to look up any registered civic complaint in Mysuru by its public tracking identifier.
                </p>
              </div>
              <div className="p-4 bg-white border border-bridge-almond-200 rounded-xl text-left space-y-2 text-xs">
                <div className="flex items-center gap-2 text-bridge-gold-800 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-bridge-gold-600 shrink-0" />
                  <span>Public Transparency &amp; Privacy Protection</span>
                </div>
                <p className="text-[11px] text-bridge-charcoal-500 leading-relaxed">
                  Under CivicTrust Security Rule 12, public tracking presents zero citizen personal information. Only the grievance category, ward location, remediation lifecycle, and explainable verification signals are displayed.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Grievance Identity & Status Hero Banner */}
              <div className="bg-white border border-bridge-almond-200 rounded-2xl p-5 sm:p-6 shadow-bridge-card space-y-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-bridge-charcoal-400 uppercase tracking-wider block">
                      Public Tracking Token
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base sm:text-xl font-bold text-bridge-charcoal-900 bg-bridge-ivory-50 border border-bridge-almond-200 px-3.5 py-1 rounded-xl shadow-xs">
                        {data.trackingToken}
                      </span>
                      <button
                        onClick={handleCopy}
                        className="p-1.5 rounded-lg border border-bridge-almond-200 bg-white text-bridge-charcoal-500 hover:text-bridge-gold-700 hover:bg-bridge-almond-50 transition-colors cursor-pointer"
                        title="Copy tracking token"
                        aria-label="Copy tracking token"
                      >
                        {copiedToken ? (
                          <Check className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Category Chip */}
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${categoryCfg.badge}`}
                    >
                      <CategoryIcon className="w-3.5 h-3.5" />
                      <span>
                        {data.category === 'other' && data.customCategory
                          ? data.customCategory
                          : categoryCfg.label}
                      </span>
                    </span>

                    {/* Status Badge */}
                    <Badge
                      variant={
                        isResolved
                          ? 'verified'
                          : isRejected
                          ? 'duplicate'
                          : isClosed
                          ? 'neutral'
                          : currentStepIdx >= 2
                          ? 'info'
                          : 'review'
                      }
                      size="md"
                    >
                      {data.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                </div>

                {/* Quick Meta Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-bridge-almond-100 text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-bridge-charcoal-400 font-semibold uppercase tracking-wider block">
                      Location / Ward
                    </span>
                    <div className="font-semibold text-bridge-charcoal-800 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-bridge-gold-600 shrink-0" />
                      <span className="truncate">{data.locationArea}</span>
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-[10px] text-bridge-charcoal-400 font-semibold uppercase tracking-wider block">
                      Incident Date
                    </span>
                    <div className="font-semibold text-bridge-charcoal-800 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-bridge-gold-600 shrink-0" />
                      <span>{data.observedDate}</span>
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-[10px] text-bridge-charcoal-400 font-semibold uppercase tracking-wider block">
                      Reported On
                    </span>
                    <div className="font-semibold text-bridge-charcoal-800 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-bridge-gold-600 shrink-0" />
                      <span>
                        {new Date(data.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-[10px] text-bridge-charcoal-400 font-semibold uppercase tracking-wider block">
                      Assigned Dept
                    </span>
                    <div className="font-semibold text-bridge-charcoal-800 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-bridge-gold-600 shrink-0" />
                      <span className="truncate">
                        {data.assignedDepartment || 'Triage in Progress'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Municipal Remediation Lifecycle Stepper */}
              <Card className="border-bridge-almond-200 bg-white">
                <CardBody className="p-5 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-bridge-almond-100 pb-3">
                    <div>
                      <span className="text-[10px] font-bold text-bridge-charcoal-400 uppercase tracking-wider block">
                        Remediation Lifecycle
                      </span>
                      <h3 className="text-sm font-bold text-bridge-charcoal-900">
                        Municipal Remediation Progress
                      </h3>
                    </div>
                    {isRejected ? (
                      <span className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full">
                        Grievance Rejected
                      </span>
                    ) : isResolved ? (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3" /> Resolved &amp; Verified
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-bridge-gold-800 bg-bridge-gold-50 border border-bridge-gold-200 px-2.5 py-0.5 rounded-full">
                        Stage {currentStepIdx + 1} of 4 Active
                      </span>
                    )}
                  </div>

                  {/* Stepper Vertical Rail */}
                  <div className="space-y-4 relative before:absolute before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-bridge-almond-200">
                    {TIMELINE_STEPS.map((step, idx) => {
                      const isComplete = !isRejected && (idx < currentStepIdx || isResolved);
                      const isCurrent = !isRejected && !isResolved && idx === currentStepIdx;
                      const isPending = !isComplete && !isCurrent;

                      return (
                        <div key={step.id} className="relative flex items-start gap-4 pl-0.5">
                          {/* Step Marker */}
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold z-10 transition-colors ${
                              isComplete
                                ? 'bg-emerald-600 text-white'
                                : isCurrent
                                ? 'bg-bridge-gold-500 text-white ring-4 ring-bridge-gold-100'
                                : isRejected && idx === currentStepIdx
                                ? 'bg-rose-600 text-white'
                                : 'bg-white border-2 border-bridge-almond-300 text-bridge-charcoal-400'
                            }`}
                          >
                            {isComplete ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : isCurrent ? (
                              <Clock className="w-4 h-4 animate-pulse" />
                            ) : isRejected && idx === currentStepIdx ? (
                              <AlertCircle className="w-4 h-4" />
                            ) : (
                              idx + 1
                            )}
                          </div>

                          {/* Step Content */}
                          <div className="flex-1 pb-1">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2">
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
                                <span className="text-[10px] text-bridge-charcoal-400 font-medium">
                                  • {step.stageTag}
                                </span>
                              </div>

                              {isCurrent && (
                                <span className="text-[10px] uppercase font-bold text-bridge-gold-700 bg-bridge-gold-50 border border-bridge-gold-200 px-2 py-0.5 rounded-full">
                                  Current Stage
                                </span>
                              )}
                            </div>

                            <p
                              className={`text-xs mt-0.5 leading-relaxed ${
                                isPending ? 'text-bridge-charcoal-400' : 'text-bridge-charcoal-600'
                              }`}
                            >
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Description Card */}
                <div className="p-5 bg-white border border-bridge-almond-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-bridge-charcoal-600">
                    <FileText className="w-4 h-4 text-bridge-gold-600" />
                    <span className="text-[11px] font-bold text-bridge-charcoal-500 uppercase tracking-wider">
                      Grievance Description
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-bridge-charcoal-900 leading-relaxed font-medium bg-bridge-ivory-50/70 p-3 rounded-lg border border-bridge-almond-100">
                    &ldquo;{data.description}&rdquo;
                  </p>
                </div>

                {/* Location & Evidence Status */}
                <div className="p-5 bg-white border border-bridge-almond-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-bridge-charcoal-600">
                    <MapPin className="w-4 h-4 text-bridge-gold-600" />
                    <span className="text-[11px] font-bold text-bridge-charcoal-500 uppercase tracking-wider">
                      Location &amp; Evidence
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-[10px] text-bridge-charcoal-400 uppercase font-semibold block">
                        Neighborhood / Area
                      </span>
                      <p className="font-semibold text-bridge-charcoal-900">
                        {data.locationArea}
                      </p>
                      {data.addressText && (
                        <p className="text-bridge-charcoal-600 text-[11px] mt-0.5">
                          {data.addressText}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-bridge-almond-100">
                      <span className="text-[10px] text-bridge-charcoal-400 uppercase font-semibold block">
                        Photographic Evidence
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <Camera className="w-3.5 h-3.5 text-bridge-gold-700" />
                        <span className="font-medium text-bridge-charcoal-800">
                          {data.hasImage
                            ? 'Photographic Evidence Attached'
                            : 'Visual evidence on record with filing'}
                        </span>
                      </div>
                      <p className="text-[10px] text-bridge-charcoal-500 mt-0.5 italic">
                        Archived securely for ward officer triage inspection.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Explainable Verification Breakdown (Rule 3 & 8 compliant) */}
              <div className="bg-bridge-gold-50/30 border border-bridge-gold-200 rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-bridge-gold-200/60 pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-bridge-gold-700" />
                    <div>
                      <h3 className="text-sm font-bold text-bridge-charcoal-900">
                        Explainable Verification Signals
                      </h3>
                      <p className="text-[11px] text-bridge-charcoal-500">
                        Transparent decision-support signals generated for ward officer triage
                      </p>
                    </div>
                  </div>
                  <Badge variant="info" size="sm">
                    Decision Support
                  </Badge>
                </div>

                {/* Risk and Outcome Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-white border border-bridge-gold-200/80 rounded-xl space-y-1.5">
                    <span className="text-[10px] font-bold text-bridge-charcoal-500 uppercase tracking-wider block">
                      Duplicate Risk Assessment
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          data.duplicateRisk === 'HIGH'
                            ? 'duplicate'
                            : data.duplicateRisk === 'MEDIUM'
                            ? 'review'
                            : 'verified'
                        }
                        size="md"
                      >
                        {data.duplicateRisk || 'LOW'} RISK
                      </Badge>
                      <span className="text-bridge-charcoal-600 font-medium">
                        Outcome: <strong>{data.verificationOutcome || 'STANDARD_TRIAGE'}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-white border border-bridge-gold-200/80 rounded-xl space-y-1.5">
                    <span className="text-[10px] font-bold text-bridge-charcoal-500 uppercase tracking-wider block">
                      Recommended Action
                    </span>
                    <p className="text-bridge-charcoal-800 font-semibold leading-snug">
                      {data.recommendedAction || 'Proceed with ward engineer review and department assignment.'}
                    </p>
                  </div>
                </div>

                {/* Evaluated Signals List */}
                {data.signals && data.signals.length > 0 && (
                  <div className="p-3 bg-white border border-bridge-gold-200/80 rounded-xl space-y-2">
                    <span className="text-[10px] font-bold text-bridge-charcoal-600 uppercase tracking-wider block">
                      Verification Signals Evaluated ({data.signals.length})
                    </span>
                    <ul className="space-y-1.5 text-xs text-bridge-charcoal-700">
                      {data.signals.map((sig: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                          <span className="leading-tight">{sig}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Evidence Quality Findings (if returned by backend) */}
                {data.evidenceQuality && (
                  <div className="p-3 bg-white border border-bridge-gold-200/80 rounded-xl space-y-2 text-xs">
                    <span className="text-[10px] font-bold text-bridge-charcoal-600 uppercase tracking-wider block">
                      Photographic Evidence Quality &amp; Forensics
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                      <div className="p-2 bg-bridge-ivory-50 rounded-lg">
                        <span className="text-bridge-charcoal-400 block">Quality Score:</span>
                        <strong className="text-bridge-charcoal-800 font-bold">
                          {data.evidenceQuality.qualityScore !== undefined
                            ? `${data.evidenceQuality.qualityScore} / 100`
                            : 'Evaluated'}
                        </strong>
                      </div>
                      <div className="p-2 bg-bridge-ivory-50 rounded-lg">
                        <span className="text-bridge-charcoal-400 block">Sharpness:</span>
                        <strong className="text-bridge-charcoal-800 font-bold">
                          {data.evidenceQuality.sharpness?.isBlurry ? 'Blurry Detected' : 'Adequate Focus'}
                        </strong>
                      </div>
                      <div className="p-2 bg-bridge-ivory-50 rounded-lg col-span-2 sm:col-span-1">
                        <span className="text-bridge-charcoal-400 block">EXIF GPS Metadata:</span>
                        <strong className="text-bridge-charcoal-800 font-bold">
                          {data.evidenceQuality.metadata?.hasGpsMetadata
                            ? 'GPS Metadata Present'
                            : 'No Embedded EXIF GPS'}
                        </strong>
                      </div>
                    </div>

                    {data.evidenceQuality.warnings && data.evidenceQuality.warnings.length > 0 && (
                      <div className="pt-1">
                        {data.evidenceQuality.warnings.map((warn, wIdx) => (
                          <div
                            key={wIdx}
                            className="flex items-center gap-1.5 text-[11px] text-amber-800 bg-amber-50 p-1.5 rounded-lg border border-amber-200"
                          >
                            <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                            <span>{warn}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Geo-Evidence Status (if returned by backend) */}
                {data.geoEvidence && (
                  <div className="p-3 bg-white border border-bridge-gold-200/80 rounded-xl space-y-1.5 text-xs">
                    <span className="text-[10px] font-bold text-bridge-charcoal-600 uppercase tracking-wider block">
                      Jurisdictional &amp; Geo-Evidence Verification
                    </span>
                    <div className="flex items-center gap-2 flex-wrap text-[11px]">
                      <Badge
                        variant={
                          data.geoEvidence.status === 'VALID'
                            ? 'verified'
                            : data.geoEvidence.status === 'OUT_OF_BOUNDS' ||
                              data.geoEvidence.status === 'MISMATCH'
                            ? 'review'
                            : 'neutral'
                        }
                        size="sm"
                      >
                        GEO: {data.geoEvidence.status}
                      </Badge>
                      <span className="text-bridge-charcoal-600">
                        Service Area Check:{' '}
                        <strong>
                          {data.geoEvidence.withinServiceArea !== false
                            ? 'Mysuru Bounds Confirmed'
                            : 'Outside Mysuru Bounds'}
                        </strong>
                      </span>
                    </div>
                  </div>
                )}

                {/* Mandatory Non-Authoritative Civic Disclaimers */}
                <div className="space-y-1 text-[11px] text-bridge-charcoal-500 italic border-t border-bridge-gold-200/60 pt-3">
                  <p>
                    • {data.disclaimer || 'Photo evidence is treated as citizen-submitted visual evidence only. Authenticity unverified. Physical site veracity requires human inspection.'}
                  </p>
                  <p>
                    • Automated verification signals assist ward officers during manual triage and do not prove or disprove complaint validity.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Pinned Bottom Footer Action Bar */}
        <footer className="shrink-0 border-t border-bridge-almond-200 bg-white px-5 sm:px-6 py-3.5 flex items-center justify-between gap-3 z-20 shadow-bridge-sm">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onClose}
          >
            Close Inspector
          </Button>

          {onReportIssue && (
            <Button
              type="button"
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
        </footer>
      </div>
    </div>
  );
};
