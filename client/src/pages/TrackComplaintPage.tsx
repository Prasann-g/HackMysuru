import React, { useState, useEffect, useCallback } from 'react';
import {
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
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  PlusCircle,
  Info,
  X,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardBody } from '../components/ui/Card';
import { apiTrackComplaint, type PublicTrackResult } from '../services/api';
import type { CitizenUser } from '../types/auth';

export interface TrackComplaintPageProps {
  initialToken?: string | null;
  onBackToDashboard?: () => void;
  onReportGrievance?: () => void;
  currentUser?: CitizenUser | null;
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

interface JourneyStage {
  id: string;
  title: string;
  stageTag: string;
  description: string;
}

const JOURNEY_STAGES: JourneyStage[] = [
  {
    id: 'SUBMITTED',
    title: 'Submitted & Registered',
    stageTag: 'Municipal Intake',
    description: 'Complaint entered into the official MCC public registry with automated intake signals generated.',
  },
  {
    id: 'VERIFIED',
    title: 'Evidence & Triage Verification',
    stageTag: 'Jurisdiction & Deduplication',
    description: 'Evidence clarity, geographic boundaries, and duplicate similarity checked for ward engineering triage.',
  },
  {
    id: 'ASSIGNED',
    title: 'Department Assigned',
    stageTag: 'Jurisdictional Routing',
    description: 'Routing recommendation approved and assigned to responsible municipal engineering department.',
  },
  {
    id: 'IN_PROGRESS',
    title: 'Field Team In Progress',
    stageTag: 'On-Site Remediation',
    description: 'Ward maintenance crew dispatched for physical on-site inspection and remedial action.',
  },
  {
    id: 'RESOLVED',
    title: 'Resolved & Verified',
    stageTag: 'Closure & Confirmation',
    description: 'Physical remediation completed and resolution logged in the official civic register.',
  },
];

/**
 * Maps real backend complaint status to 5-stage lifecycle step index (0 to 4)
 */
function mapStatusToStageIndex(status: string): number {
  switch (status.toUpperCase()) {
    case 'SUBMITTED':
      return 0;
    case 'UNDER_REVIEW':
    case 'NEEDS_CLARIFICATION':
      return 1;
    case 'FORWARDED':
      return 2;
    case 'IN_PROGRESS':
      return 3;
    case 'RESOLVED':
    case 'CLOSED':
      return 4;
    default:
      return 0;
  }
}

export const TrackComplaintPage: React.FC<TrackComplaintPageProps> = ({
  initialToken = null,
  onBackToDashboard,
  onReportGrievance,
  currentUser,
}) => {
  const [tokenInput, setTokenInput] = useState<string>(initialToken || '');
  const [prevInitialToken, setPrevInitialToken] = useState<string | null>(initialToken || null);
  const [data, setData] = useState<PublicTrackResult | null>(null);
  const [loading, setLoading] = useState<boolean>(() => Boolean(initialToken?.trim()));
  const [error, setError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<boolean>(false);
  const [assessmentExpanded, setAssessmentExpanded] = useState<boolean>(true);

  if (initialToken !== prevInitialToken) {
    setPrevInitialToken(initialToken || null);
    setTokenInput(initialToken || '');
  }

  // Fetch complaint from real backend API
  const fetchComplaint = useCallback(async (tokenToFetch: string) => {
    const cleanToken = tokenToFetch.trim();
    if (!cleanToken) {
      setError('Please enter a valid tracking token to check progress.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await apiTrackComplaint(cleanToken);
      setData(result);
      setError(null);
    } catch (err: any) {
      setData(null);
      setError(
        err.message ||
          'Grievance not found. Please verify your tracking token format (e.g. TRK-XXXX-XXXX or DEMO-2026-XXXX) and try again.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch if initialToken was provided on load
  useEffect(() => {
    const token = initialToken?.trim();
    if (!token) return;

    let isMounted = true;

    apiTrackComplaint(token)
      .then((res) => {
        if (isMounted) {
          setData(res);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          setData(null);
          setError(
            err.message ||
              'Grievance not found. Please verify your tracking token format (e.g. TRK-XXXX-XXXX or DEMO-2026-XXXX) and try again.'
          );
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [initialToken]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchComplaint(tokenInput);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleClear = () => {
    setTokenInput('');
    setError(null);
  };

  const currentStageIdx = data ? mapStatusToStageIndex(data.status) : 0;
  const isResolved = data?.status === 'RESOLVED' || data?.status === 'CLOSED';
  const requiresHumanReview =
    data?.verificationOutcome === 'REQUIRES_HUMAN_REVIEW' ||
    data?.status === 'UNDER_REVIEW' ||
    data?.status === 'NEEDS_CLARIFICATION';

  const categoryInfo = data
    ? CATEGORY_CONFIG[data.category] || CATEGORY_CONFIG.other
    : CATEGORY_CONFIG.other;
  const CategoryIcon = categoryInfo.icon;

  return (
    <div className="min-h-screen bg-bridge-ivory-50 pb-16 animate-fadeIn selection:bg-bridge-gold-200 selection:text-bridge-charcoal-900">
      {/* 1. Return & Context Breadcrumb Bar */}
      <div className="border-b border-bridge-almond-200 bg-white sticky top-16 z-30 shadow-bridge-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between text-xs">
          <button
            onClick={onBackToDashboard}
            className="flex items-center gap-1.5 font-semibold text-bridge-charcoal-700 hover:text-bridge-charcoal-900 hover:underline cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-gold-500 rounded px-1.5 py-1"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-bridge-gold-700" />
            <span>{currentUser ? 'Return to Dashboard' : 'Return to Civic Services'}</span>
          </button>

          <div className="flex items-center gap-2 text-bridge-charcoal-500">
            <span className="hidden sm:inline">Mysuru City Corporation</span>
            <span className="hidden sm:inline">•</span>
            <span className="font-medium text-bridge-charcoal-700">Dedicated Tracking Portal</span>
          </div>
        </div>
      </div>

      {/* 2. Page Hero Section */}
      <section className="bg-gradient-to-b from-white via-white to-bridge-ivory-50/80 border-b border-bridge-almond-200 py-10 sm:py-14">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <div className="inline-flex items-center gap-2">
            <Badge
              variant="neutral"
              size="md"
              icon={<ShieldCheck className="w-4 h-4 text-bridge-gold-700" />}
            >
              MCC Public Civic Registry
            </Badge>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-bridge-charcoal-900 tracking-tight">
            Track Your Civic Request
          </h1>

          <p className="text-sm sm:text-base text-bridge-charcoal-600 max-w-2xl mx-auto leading-relaxed">
            Follow the real-time remediation journey of your municipal grievance, inspect transparent AI-guided verification signals, and view ward department assignment records.
          </p>

          {/* Search Box Form */}
          <div className="pt-4 max-w-2xl mx-auto">
            <form onSubmit={handleSearchSubmit} className="space-y-2.5">
              <div className="flex flex-col sm:flex-row items-stretch gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-bridge-charcoal-400">
                    <Search className="w-4 h-4" />
                  </div>

                  <input
                    type="text"
                    value={tokenInput}
                    onChange={(e) => {
                      setTokenInput(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="Enter tracking token (e.g. TRK-XXXX-XXXX or DEMO-2026-0001)"
                    aria-label="Complaint tracking token"
                    className={`w-full pl-10 pr-10 py-3 text-sm font-mono tracking-wide bg-white border rounded-xl text-bridge-charcoal-900 placeholder:text-bridge-charcoal-400 placeholder:font-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-gold-500 shadow-2xs transition-all ${
                      error
                        ? 'border-rose-400 bg-rose-50/20 text-rose-900'
                        : 'border-bridge-almond-300 hover:border-bridge-gold-400 focus:border-bridge-gold-500'
                    }`}
                  />

                  {tokenInput && (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-bridge-charcoal-400 hover:text-bridge-charcoal-700 cursor-pointer transition-colors"
                      title="Clear token input"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={loading}
                  className="shrink-0 px-6 py-3 font-semibold shadow-xs"
                  icon={
                    loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )
                  }
                >
                  {loading ? 'Verifying...' : 'Track Complaint'}
                </Button>
              </div>

              {/* Helper format hint */}
              <div className="flex items-center justify-between text-left text-[11px] text-bridge-charcoal-500 px-1">
                <div className="flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-bridge-gold-700 shrink-0" />
                  <span>
                    Tokens follow the format <code className="px-1 py-0.2 rounded bg-bridge-almond-100 font-mono font-semibold text-bridge-charcoal-800">TRK-XXXX-XXXX</code>
                  </span>
                </div>
                <span className="hidden sm:inline text-bridge-charcoal-400">
                  Zero citizen personal data exposed
                </span>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* 3. Main Body Content Container */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-6">
        {/* Error Alert */}
        {error && (
          <div
            role="alert"
            className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-start gap-3 animate-fadeIn shadow-bridge-sm"
          >
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs sm:text-sm">
              <span className="font-bold text-rose-900 block">Grievance Not Found</span>
              <p className="text-rose-800 leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        {/* Loading Shimmer Skeleton */}
        {loading && (
          <div className="bg-white border border-bridge-almond-200 rounded-2xl p-6 sm:p-8 space-y-6 animate-pulse shadow-bridge-card">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="w-32 h-4 bg-bridge-almond-200 rounded"></div>
                <div className="w-48 h-6 bg-bridge-almond-300 rounded"></div>
              </div>
              <div className="w-24 h-8 bg-bridge-almond-200 rounded-full"></div>
            </div>
            <div className="space-y-4 pt-4 border-t border-bridge-almond-100">
              <div className="w-full h-24 bg-bridge-almond-100 rounded-xl"></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="h-28 bg-bridge-almond-100 rounded-xl"></div>
                <div className="h-28 bg-bridge-almond-100 rounded-xl"></div>
              </div>
            </div>
          </div>
        )}

        {/* State A: Initial Ready / Empty State (Explaining How Journey Works) */}
        {!loading && !data && !error && (
          <div className="bg-white border border-bridge-almond-200 rounded-2xl p-6 sm:p-10 shadow-bridge-card space-y-8 text-center">
            <div className="max-w-md mx-auto space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-bridge-gold-50 border border-bridge-gold-200 text-bridge-gold-700 flex items-center justify-center mx-auto shadow-2xs">
                <Search className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-bridge-charcoal-900">
                Enter Your Grievance Tracking Token
              </h2>
              <p className="text-xs sm:text-sm text-bridge-charcoal-600 leading-relaxed">
                When you register a complaint via CivicBridge, an official tamper-evident token is assigned to monitor progress from intake to field resolution.
              </p>
            </div>

            {/* How Tracking Works Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left pt-4 border-t border-bridge-almond-100">
              <div className="p-4 bg-bridge-ivory-50/70 border border-bridge-almond-200 rounded-xl space-y-2">
                <div className="w-7 h-7 rounded-lg bg-bridge-gold-100 text-bridge-gold-800 flex items-center justify-center text-xs font-bold">
                  1
                </div>
                <h3 className="text-xs font-bold text-bridge-charcoal-900">
                  Intake &amp; Registration
                </h3>
                <p className="text-[11px] text-bridge-charcoal-600 leading-relaxed">
                  Your report is indexed in the Mysuru City Corporation database with GPS verification.
                </p>
              </div>

              <div className="p-4 bg-bridge-ivory-50/70 border border-bridge-almond-200 rounded-xl space-y-2">
                <div className="w-7 h-7 rounded-lg bg-bridge-gold-100 text-bridge-gold-800 flex items-center justify-center text-xs font-bold">
                  2
                </div>
                <h3 className="text-xs font-bold text-bridge-charcoal-900">
                  Explainable Verification
                </h3>
                <p className="text-[11px] text-bridge-charcoal-600 leading-relaxed">
                  Evidence signals and duplicate checks provide transparent triage support to ward officers.
                </p>
              </div>

              <div className="p-4 bg-bridge-ivory-50/70 border border-bridge-almond-200 rounded-xl space-y-2">
                <div className="w-7 h-7 rounded-lg bg-bridge-gold-100 text-bridge-gold-800 flex items-center justify-center text-xs font-bold">
                  3
                </div>
                <h3 className="text-xs font-bold text-bridge-charcoal-900">
                  Ward Team Follow-Through
                </h3>
                <p className="text-[11px] text-bridge-charcoal-600 leading-relaxed">
                  Field engineers are assigned and update the status as physical remediation progresses.
                </p>
              </div>
            </div>

            {onReportGrievance && (
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onReportGrievance}
                  icon={<PlusCircle className="w-4 h-4 text-bridge-gold-700" />}
                >
                  Need to Report a New Civic Issue?
                </Button>
              </div>
            )}
          </div>
        )}

        {/* State B: Complaint Found & Active Display */}
        {!loading && data && (
          <div className="space-y-6">
            {/* 1. Header Overview Card */}
            <div className="bg-white border border-bridge-almond-200 rounded-2xl p-6 sm:p-7 shadow-bridge-card space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-bridge-almond-100 pb-5">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] uppercase font-bold text-bridge-charcoal-500 tracking-wider">
                      Tracking Token:
                    </span>
                    <span className="font-mono text-xs sm:text-sm font-bold text-bridge-charcoal-900 bg-bridge-almond-100 px-2 py-0.5 rounded border border-bridge-almond-200">
                      {data.trackingToken}
                    </span>
                    <button
                      onClick={() => handleCopy(data.trackingToken)}
                      className="p-1 text-bridge-charcoal-500 hover:text-bridge-gold-700 cursor-pointer rounded transition-colors"
                      title="Copy tracking token"
                      aria-label="Copy tracking token"
                    >
                      {copiedToken ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    {copiedToken && (
                      <span className="text-[11px] text-emerald-700 font-semibold animate-fadeIn">
                        Copied!
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 flex-wrap pt-1">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${categoryInfo.badge}`}
                    >
                      <CategoryIcon className="w-3.5 h-3.5" />
                      <span>{categoryInfo.label}</span>
                    </span>

                    {data.isDemo && (
                      <Badge variant="neutral" size="sm">
                        Verified Demo Record
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:items-end gap-1">
                  <span className="text-[10px] text-bridge-charcoal-400 uppercase font-semibold">
                    Current Status
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant={
                        isResolved
                          ? 'verified'
                          : requiresHumanReview
                          ? 'review'
                          : 'info'
                      }
                      size="md"
                    >
                      {data.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Quick Details Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-bridge-charcoal-400 uppercase font-semibold block">
                    Observed Date
                  </span>
                  <div className="font-semibold text-bridge-charcoal-800 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-bridge-gold-600 shrink-0" />
                    <span>{data.observedDate}</span>
                  </div>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] text-bridge-charcoal-400 uppercase font-semibold block">
                    Reported In Registry
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
                  <span className="text-[10px] text-bridge-charcoal-400 uppercase font-semibold block">
                    Ward Locality
                  </span>
                  <div className="font-semibold text-bridge-charcoal-800 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-bridge-gold-600 shrink-0" />
                    <span className="truncate">{data.locationArea}</span>
                  </div>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] text-bridge-charcoal-400 uppercase font-semibold block">
                    Assigned Division
                  </span>
                  <div className="font-semibold text-bridge-charcoal-800 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-bridge-gold-600 shrink-0" />
                    <span className="truncate">
                      {data.assignedDepartment || 'Ward Triage in Progress'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Animated Complaint Journey Timeline */}
            <Card className="border-bridge-almond-200 bg-white shadow-bridge-card overflow-hidden">
              <CardBody className="p-6 sm:p-7 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-bridge-almond-100 pb-4">
                  <div>
                    <span className="text-[10px] font-bold text-bridge-gold-700 uppercase tracking-wider block">
                      Remediation Lifecycle
                    </span>
                    <h2 className="text-base sm:text-lg font-bold text-bridge-charcoal-900">
                      Civic Grievance Journey
                    </h2>
                  </div>

                  <div>
                    {isResolved ? (
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Resolution Confirmed &amp; Closed
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-bridge-gold-800 bg-bridge-gold-50 border border-bridge-gold-200 px-3 py-1 rounded-full">
                        Stage {currentStageIdx + 1} of 5 Active
                      </span>
                    )}
                  </div>
                </div>

                {/* Vertical Stepper Rail */}
                <div className="space-y-6 relative before:absolute before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-bridge-almond-200">
                  {JOURNEY_STAGES.map((stage, idx) => {
                    const isComplete = idx < currentStageIdx || isResolved;
                    const isCurrent = !isResolved && idx === currentStageIdx;
                    const isPending = !isComplete && !isCurrent;

                    return (
                      <div
                        key={stage.id}
                        className={`relative flex items-start gap-4 transition-all duration-200 ${
                          isCurrent ? 'scale-[1.01] motion-reduce:scale-100' : ''
                        }`}
                      >
                        {/* Step Circle Marker */}
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold z-10 transition-all ${
                            isComplete
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : isCurrent
                              ? 'bg-bridge-gold-500 text-white ring-4 ring-bridge-gold-100 shadow-xs'
                              : 'bg-white border-2 border-bridge-almond-300 text-bridge-charcoal-400'
                          }`}
                        >
                          {isComplete ? (
                            <Check className="w-4 h-4" />
                          ) : isCurrent ? (
                            <Clock className="w-4 h-4 animate-pulse" />
                          ) : (
                            idx + 1
                          )}
                        </div>

                        {/* Step Details */}
                        <div
                          className={`flex-1 p-3.5 sm:p-4 rounded-xl transition-colors ${
                            isCurrent
                              ? 'bg-bridge-gold-50/50 border border-bridge-gold-200/80 shadow-2xs'
                              : 'border border-transparent'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3
                                className={`text-xs sm:text-sm font-bold ${
                                  isCurrent
                                    ? 'text-bridge-charcoal-900'
                                    : isComplete
                                    ? 'text-bridge-charcoal-800'
                                    : 'text-bridge-charcoal-400'
                                }`}
                              >
                                {stage.title}
                              </h3>
                              <span className="text-[10px] text-bridge-charcoal-400 font-medium">
                                • {stage.stageTag}
                              </span>
                            </div>

                            {isCurrent && (
                              <div className="flex items-center gap-1.5">
                                {stage.id === 'VERIFIED' && requiresHumanReview && (
                                  <span className="text-[10px] uppercase font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                    Requires Human Review
                                  </span>
                                )}
                                <span className="text-[10px] uppercase font-bold text-bridge-gold-700 bg-bridge-gold-50 border border-bridge-gold-200 px-2 py-0.5 rounded-full">
                                  In Progress
                                </span>
                              </div>
                            )}

                            {isComplete && (
                              <span className="text-[10px] uppercase font-semibold text-emerald-700 flex items-center gap-1">
                                <Check className="w-3 h-3" /> Completed
                              </span>
                            )}
                          </div>

                          <p
                            className={`text-xs mt-1 leading-relaxed ${
                              isPending ? 'text-bridge-charcoal-400' : 'text-bridge-charcoal-600'
                            }`}
                          >
                            {stage.description}
                          </p>

                          {/* Dynamic Contextual Information for Specific Stages */}
                          {stage.id === 'ASSIGNED' && data.assignedDepartment && (
                            <div className="mt-2 text-[11px] text-bridge-charcoal-700 bg-white/80 p-2 rounded-lg border border-bridge-almond-200 flex items-center gap-2">
                              <Building2 className="w-3.5 h-3.5 text-bridge-gold-700 shrink-0" />
                              <span>
                                Assigned Department:{' '}
                                <strong className="text-bridge-charcoal-900">
                                  {data.assignedDepartment}
                                </strong>
                              </span>
                            </div>
                          )}

                          {stage.id === 'VERIFIED' && requiresHumanReview && isCurrent && (
                            <div className="mt-2 text-[11px] text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200 flex items-center gap-2">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>
                                Automated signals flagged this grievance for manual verification by a ward engineer before dispatch.
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardBody>
            </Card>

            {/* 3. Core Complaint Information Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Description Card */}
              <div className="p-5 bg-white border border-bridge-almond-200 rounded-2xl shadow-bridge-sm space-y-2.5">
                <div className="flex items-center gap-2 text-bridge-charcoal-600">
                  <FileText className="w-4 h-4 text-bridge-gold-700" />
                  <span className="text-xs font-bold text-bridge-charcoal-700 uppercase tracking-wider">
                    Grievance Description
                  </span>
                </div>
                <div className="bg-bridge-ivory-50/80 p-3.5 rounded-xl border border-bridge-almond-100">
                  <p className="text-xs sm:text-sm text-bridge-charcoal-900 font-medium leading-relaxed italic">
                    &ldquo;{data.description}&rdquo;
                  </p>
                </div>
              </div>

              {/* Location & Evidence Status */}
              <div className="p-5 bg-white border border-bridge-almond-200 rounded-2xl shadow-bridge-sm space-y-3">
                <div className="flex items-center gap-2 text-bridge-charcoal-600">
                  <MapPin className="w-4 h-4 text-bridge-gold-700" />
                  <span className="text-xs font-bold text-bridge-charcoal-700 uppercase tracking-wider">
                    Location &amp; Evidence
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-[10px] text-bridge-charcoal-400 uppercase font-semibold block">
                      Reported Locality
                    </span>
                    <p className="font-bold text-bridge-charcoal-900 text-sm">
                      {data.locationArea}
                    </p>
                    {data.addressText && (
                      <p className="text-bridge-charcoal-600 text-xs mt-0.5 leading-snug">
                        {data.addressText}
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-bridge-almond-100">
                    <span className="text-[10px] text-bridge-charcoal-400 uppercase font-semibold block">
                      Photographic Evidence
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <Camera className="w-4 h-4 text-bridge-gold-700 shrink-0" />
                      <span className="font-semibold text-bridge-charcoal-800">
                        {data.hasImage
                          ? 'Photographic Evidence Attached'
                          : 'Visual Evidence on Official Record'}
                      </span>
                    </div>
                    <p className="text-[11px] text-bridge-charcoal-500 mt-0.5 italic">
                      Archived securely for ward officer triage inspection.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Expandable Verification Transparency Section: "How Your Complaint Was Assessed" */}
            <div className="bg-bridge-gold-50/40 border border-bridge-gold-200 rounded-2xl p-5 sm:p-6 space-y-4 shadow-bridge-sm transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-white border border-bridge-gold-200 flex items-center justify-center text-bridge-gold-700 shadow-2xs">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-bridge-charcoal-900">
                      How Your Complaint Was Assessed
                    </h2>
                    <p className="text-[11px] text-bridge-charcoal-500">
                      Explainable decision-support signals generated for Mysuru City Corporation triage
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setAssessmentExpanded(!assessmentExpanded)}
                  className="p-1.5 rounded-lg border border-bridge-gold-200 bg-white text-bridge-charcoal-600 hover:text-bridge-charcoal-900 hover:bg-bridge-gold-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-gold-500"
                  aria-expanded={assessmentExpanded}
                  aria-label="Toggle assessment details"
                >
                  {assessmentExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              </div>

              {assessmentExpanded && (
                <div className="space-y-4 pt-3 border-t border-bridge-gold-200/70 animate-fadeIn text-xs">
                  {/* Outcome & Duplicate Risk Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 bg-white border border-bridge-gold-200/90 rounded-xl space-y-1.5">
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

                    <div className="p-3.5 bg-white border border-bridge-gold-200/90 rounded-xl space-y-1.5">
                      <span className="text-[10px] font-bold text-bridge-charcoal-500 uppercase tracking-wider block">
                        Recommended Action
                      </span>
                      <p className="text-bridge-charcoal-800 font-semibold leading-snug">
                        {data.recommendedAction ||
                          'Proceed with ward engineer review and department assignment.'}
                      </p>
                    </div>
                  </div>

                  {/* Evaluated Signals List */}
                  {data.signals && data.signals.length > 0 && (
                    <div className="p-3.5 bg-white border border-bridge-gold-200/90 rounded-xl space-y-2">
                      <span className="text-[10px] font-bold text-bridge-charcoal-600 uppercase tracking-wider block">
                        Evaluated Verification Signals ({data.signals.length})
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

                  {/* Photographic Evidence Quality & Forensics (if present) */}
                  {data.evidenceQuality && (
                    <div className="p-3.5 bg-white border border-bridge-gold-200/90 rounded-xl space-y-2">
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
                            {data.evidenceQuality.sharpness?.isBlurry
                              ? 'Blurry Detected'
                              : 'Adequate Focus'}
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
                        <div className="pt-1 space-y-1">
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

                  {/* Geolocation Verification Status */}
                  {data.geoEvidence && (
                    <div className="p-3.5 bg-white border border-bridge-gold-200/90 rounded-xl space-y-1.5">
                      <span className="text-[10px] font-bold text-bridge-charcoal-600 uppercase tracking-wider block">
                        Geolocation &amp; Jurisdiction Status
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
                        <span className="text-bridge-charcoal-600 font-medium">
                          {data.geoEvidence.withinServiceArea
                            ? 'Within Mysuru municipal boundaries'
                            : 'Outside supported jurisdiction'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Anti-Hallucination & Governance Disclaimer */}
                  <div className="p-3 bg-white/70 rounded-xl border border-bridge-gold-200/60 text-[11px] text-bridge-charcoal-500 leading-relaxed">
                    <p>
                      <strong>Governance Notice:</strong> Verification signals and quality scores are automated decision-support aids designed to assist Mysuru City Corporation ward officers. They do not constitute a definitive determination of complaint validity or citizen intent.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 5. Bottom Navigation & Action Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-bridge-almond-200">
              <Button
                variant="outline"
                size="md"
                onClick={onBackToDashboard}
                icon={<ArrowLeft className="w-4 h-4" />}
              >
                {currentUser ? 'Back to Dashboard' : 'Back to Civic Services'}
              </Button>

              <div className="flex items-center gap-2.5">
                {onReportGrievance && (
                  <Button
                    variant="primary"
                    size="md"
                    onClick={onReportGrievance}
                    icon={<PlusCircle className="w-4 h-4" />}
                  >
                    Report Another Issue
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrackComplaintPage;
