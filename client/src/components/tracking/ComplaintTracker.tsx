import React, { useState, useEffect } from 'react';
import {
  Search,
  CheckCircle2,
  Clock,
  Building2,
  MapPin,
  Calendar,
  ShieldCheck,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  FileText,
  HelpCircle,
  RotateCcw,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card, CardBody } from '../ui/Card';
import { apiTrackComplaint, type PublicTrackResult } from '../../services/api';

interface ComplaintTrackerProps {
  initialToken?: string;
  onReportIssue?: () => void;
  onBackToHome?: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  garbage_dumping: 'Garbage dumping',
  overflowing_bin: 'Overflowing bin',
  pothole: 'Pothole',
  broken_streetlight: 'Broken streetlight',
  unsegregated_waste: 'Unsegregated waste',
  construction_debris: 'Construction debris',
  other: 'Other civic issue',
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
    description: 'Complaint registered in municipal log with verification signals generated.',
  },
  {
    id: 'UNDER_REVIEW',
    title: 'Ward Officer Review',
    description: 'Assigned municipal officer reviewing evidence and duplicate risk.',
  },
  {
    id: 'IN_PROGRESS',
    title: 'Field Team Dispatched',
    description: 'Department maintenance team assigned for on-site inspection/repair.',
  },
  {
    id: 'RESOLVED',
    title: 'Resolved & Closed',
    description: 'Civic issue addressed and verified by municipal authority.',
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

export const ComplaintTracker: React.FC<ComplaintTrackerProps> = ({
  initialToken = '',
  onReportIssue,
  onBackToHome,
}) => {
  const [tokenInput, setTokenInput] = useState(initialToken);
  const [prevInitialToken, setPrevInitialToken] = useState(initialToken);
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<PublicTrackResult | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  if (initialToken !== prevInitialToken) {
    setPrevInitialToken(initialToken);
    setTokenInput(initialToken);
  }

  const fetchTrackingData = async (tokenToFetch: string) => {
    const clean = tokenToFetch.trim();
    if (!clean) {
      setError('Please enter a valid tracking token.');
      return;
    }

    setLoading(true);
    setError(null);
    setActiveToken(clean);

    try {
      const data = await apiTrackComplaint(clean);
      setRecord(data);
    } catch (err: any) {
      setRecord(null);
      setError(
        err.message ||
          'Complaint not found with the provided tracking token. Please verify the code.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const clean = initialToken.trim();
    if (!clean) return;

    let ignore = false;
    apiTrackComplaint(clean)
      .then((data) => {
        if (!ignore) {
          setRecord(data);
          setActiveToken(clean);
          setError(null);
        }
      })
      .catch((err: any) => {
        if (!ignore) {
          setRecord(null);
          setError(
            err.message ||
              'Complaint not found with the provided tracking token. Please verify the code.'
          );
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [initialToken]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTrackingData(tokenInput);
  };

  const handleCopy = () => {
    if (record) {
      navigator.clipboard.writeText(record.trackingToken);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  const handleResetSearch = () => {
    setTokenInput('');
    setActiveToken(null);
    setRecord(null);
    setError(null);
  };

  const currentStepIndex = record ? getStepIndex(record.status) : 0;
  const isRejected = record?.status.toUpperCase() === 'REJECTED';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 animate-fadeIn space-y-8">
      {/* Header Section */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <Badge variant="info" size="md" icon={<Search className="w-3.5 h-3.5" />}>
          Mysuru City Corporation Tracking Portal
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-brand-slate-900 tracking-tight">
          Track Civic Complaint Progress
        </h1>
        <p className="text-sm text-brand-slate-600 leading-relaxed">
          Enter your unique tracking token to inspect live resolution progress, assigned municipal department, and automated verification signals.
        </p>
      </div>

      {/* Search Bar Card */}
      <Card className="border-brand-slate-200 shadow-civic-md">
        <CardBody className="p-5 sm:p-7">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="e.g. TRK-XXXX-XXXX"
                  className="w-full px-4 py-3 pl-11 text-sm sm:text-base font-mono rounded-xl border border-brand-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-teal-600 focus:border-transparent uppercase tracking-wider bg-white placeholder:normal-case placeholder:font-sans placeholder:tracking-normal placeholder:text-brand-slate-400"
                  aria-label="Complaint Tracking Token"
                />
                <Search className="w-5 h-5 text-brand-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={loading || !tokenInput.trim()}
                  icon={loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  className="flex-1 sm:flex-initial px-6"
                >
                  {loading ? 'Locating...' : 'Track Status'}
                </Button>
                {activeToken && (
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    onClick={handleResetSearch}
                    icon={<RotateCcw className="w-4 h-4" />}
                    aria-label="Reset search"
                  >
                    Reset
                  </Button>
                )}
              </div>
            </div>
          </form>
        </CardBody>
      </Card>

      {/* Loading State */}
      {loading && (
        <div className="py-14 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-brand-teal-600 animate-spin mx-auto" />
          <p className="text-sm font-medium text-brand-slate-700">
            Querying municipal complaint registry...
          </p>
          <p className="text-xs text-brand-slate-400">
            Verifying token: <span className="font-mono">{tokenInput}</span>
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && !loading && (
        <div className="p-5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-900 animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold">Unable to Locate Complaint</h4>
            <p className="text-xs text-rose-700 leading-relaxed">{error}</p>
            <p className="text-[11px] text-rose-600 pt-1">
              Tip: Check your submission confirmation receipt for the exact tracking token provided upon filing.
            </p>
          </div>
        </div>
      )}

      {/* Tracking Result View */}
      {record && !loading && (
        <div className="space-y-6 animate-fadeIn">
          {/* Synthetic Demo Disclaimer Banner */}
          {record.isDemo && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-900 text-xs">
              <HelpCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Demonstration Record:</span>{' '}
                This complaint is a synthetic demonstration record generated for platform verification and testing. It does not represent an active municipal case.
              </div>
            </div>
          )}

          {/* Primary Summary Header Card */}
          <Card className="border-brand-teal-200 bg-brand-teal-50/30">
            <CardBody className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-teal-100 pb-5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-brand-teal-800">
                      Public Tracking Token
                    </span>
                    {record.isDemo && (
                      <Badge variant="review" size="sm">
                        Demo Record
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xl sm:text-2xl font-black text-brand-slate-900 tracking-tight">
                      {record.trackingToken}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopy}
                      icon={copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    >
                      {copiedToken ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col sm:items-end">
                  <span className="text-[11px] font-medium text-brand-slate-500 uppercase tracking-wider">
                    Current Lifecycle Status
                  </span>
                  <div className="pt-1">
                    <Badge
                      variant={
                        record.status === 'RESOLVED' || record.status === 'CLOSED'
                          ? 'verified'
                          : record.status === 'IN_PROGRESS'
                            ? 'info'
                            : record.status === 'REJECTED'
                              ? 'duplicate'
                              : 'review'
                      }
                      size="md"
                    >
                      {record.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Quick Meta Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5 text-xs">
                <div>
                  <span className="text-brand-slate-500 font-medium flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-brand-slate-400" />
                    Department:
                  </span>
                  <p className="font-bold text-brand-slate-900 mt-0.5">
                    {record.assignedDepartment || 'MCC Engineering Division'}
                  </p>
                </div>

                <div>
                  <span className="text-brand-slate-500 font-medium flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-brand-slate-400" />
                    Ward / Area:
                  </span>
                  <p className="font-bold text-brand-slate-900 mt-0.5">
                    {record.locationArea}
                  </p>
                </div>

                <div>
                  <span className="text-brand-slate-500 font-medium flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-brand-slate-400" />
                    Observed Date:
                  </span>
                  <p className="font-bold text-brand-slate-900 mt-0.5">
                    {record.observedDate}
                  </p>
                </div>

                <div>
                  <span className="text-brand-slate-500 font-medium flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-brand-slate-400" />
                    Submitted:
                  </span>
                  <p className="font-bold text-brand-slate-900 mt-0.5">
                    {new Date(record.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Lifecycle Progress Timeline */}
          <Card className="border-brand-slate-200">
            <CardBody className="p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-brand-slate-100 pb-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-brand-slate-800 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-brand-teal-700" />
                  Resolution Lifecycle Timeline
                </h2>
                <span className="text-[11px] text-brand-slate-500">
                  Last updated: {new Date(record.updatedAt).toLocaleDateString()}
                </span>
              </div>

              {isRejected ? (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-1">
                  <span className="font-bold">Complaint Flagged / Rejected</span>
                  <p className="text-rose-700">
                    This complaint was reviewed by municipal officers and marked as rejected or closed. Check verification notes below.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 relative">
                  {TIMELINE_STEPS.map((step, idx) => {
                    const isCompleted = idx < currentStepIndex;
                    const isCurrent = idx === currentStepIndex;

                    return (
                      <div
                        key={step.id}
                        className={`relative p-4 rounded-xl border transition-all ${
                          isCurrent
                            ? 'bg-brand-teal-50 border-brand-teal-300 ring-2 ring-brand-teal-500/20'
                            : isCompleted
                              ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                              : 'bg-brand-slate-50 border-brand-slate-200 text-brand-slate-400'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                              isCompleted
                                ? 'bg-emerald-600 text-white'
                                : isCurrent
                                  ? 'bg-brand-teal-600 text-white animate-pulse'
                                  : 'bg-brand-slate-200 text-brand-slate-500'
                            }`}
                          >
                            {isCompleted ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                          </div>
                          <span
                            className={`text-xs font-bold ${
                              isCurrent
                                ? 'text-brand-teal-900'
                                : isCompleted
                                  ? 'text-emerald-900'
                                  : 'text-brand-slate-600'
                            }`}
                          >
                            {step.title}
                          </span>
                        </div>
                        <p
                          className={`text-[11px] leading-relaxed ${
                            isCurrent
                              ? 'text-brand-teal-800 font-medium'
                              : isCompleted
                                ? 'text-emerald-800'
                                : 'text-brand-slate-500'
                          }`}
                        >
                          {step.description}
                        </p>
                        {isCurrent && (
                          <div className="mt-2.5">
                            <Badge variant="info" size="sm">
                              Current Stage
                            </Badge>
                          </div>
                        )}
                        {isCompleted && (
                          <div className="mt-2.5">
                            <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Completed
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Details & Verification Breakdown Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Issue Description */}
            <Card className="border-brand-slate-200">
              <CardBody className="p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-brand-slate-100 pb-3">
                  <FileText className="w-4 h-4 text-brand-teal-700" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-brand-slate-900">
                    Registered Issue Details
                  </h3>
                </div>

                <div className="space-y-3 text-xs sm:text-sm">
                  <div>
                    <span className="text-brand-slate-500 font-medium text-xs">
                      Category:
                    </span>
                    <p className="font-bold text-brand-slate-900">
                      {CATEGORY_LABELS[record.category] || record.category}
                      {record.customCategory && ` (${record.customCategory})`}
                    </p>
                  </div>

                  <div>
                    <span className="text-brand-slate-500 font-medium text-xs">
                      Reported Description:
                    </span>
                    <p className="mt-1 p-3 bg-brand-slate-50 border border-brand-slate-100 rounded-lg text-brand-slate-800 leading-relaxed font-sans">
                      {record.description}
                    </p>
                  </div>

                  <div>
                    <span className="text-brand-slate-500 font-medium text-xs">
                      Reported Location:
                    </span>
                    <p className="font-semibold text-brand-slate-900 mt-0.5">
                      {record.locationArea}
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Right: Explainable Verification & Triage Signals */}
            <Card className="border-brand-slate-200">
              <CardBody className="p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-brand-slate-100 pb-3">
                  <ShieldCheck className="w-4 h-4 text-brand-teal-700" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-brand-slate-900">
                    Automated Verification Signals
                  </h3>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between p-2.5 bg-brand-slate-50 rounded-lg border border-brand-slate-100">
                    <span className="text-brand-slate-600 font-medium">Duplicate Risk:</span>
                    <Badge
                      variant={
                        record.duplicateRisk === 'HIGH'
                          ? 'duplicate'
                          : record.duplicateRisk === 'MEDIUM'
                            ? 'review'
                            : 'verified'
                      }
                      size="sm"
                    >
                      {record.duplicateRisk || 'LOW'} DUPLICATE RISK
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-brand-slate-50 rounded-lg border border-brand-slate-100">
                    <span className="text-brand-slate-600 font-medium">Verification Outcome:</span>
                    <Badge variant="info" size="sm">
                      {record.verificationOutcome?.replace('_', ' ') || 'PROCESSED'}
                    </Badge>
                  </div>

                  {/* Signals List */}
                  {record.signals && record.signals.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-brand-slate-500 font-medium">
                        Computed Verification Signals:
                      </span>
                      <ul className="space-y-1 list-disc list-inside text-brand-slate-700 pl-1 text-[11px] leading-relaxed">
                        {record.signals.map((signal, idx) => (
                          <li key={idx}>{signal}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* System Limitations & Transparency */}
                  <div className="pt-2 border-t border-brand-slate-100 text-[11px] text-brand-slate-500 italic space-y-1">
                    <p>• {record.disclaimer}</p>
                    <p>• Automated similarity scores support municipal triage and do not prove or disprove complaint authenticity.</p>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Action Footer */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-brand-slate-200">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={handleResetSearch}
            >
              Track Another Token
            </Button>

            <div className="flex items-center gap-3">
              {onBackToHome && (
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  onClick={onBackToHome}
                >
                  Return to Home
                </Button>
              )}

              {onReportIssue && (
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={onReportIssue}
                >
                  Report a New Issue
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
