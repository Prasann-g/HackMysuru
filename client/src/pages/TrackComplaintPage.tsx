import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  CheckCircle2,
  Clock,
  MapPin,
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
  X,
  PlusCircle,
  Info,
  FileSearch,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { apiTrackComplaint, type PublicTrackResult } from '../services/api';
import type { CitizenUser } from '../types/auth';

export interface TrackComplaintPageProps {
  isOpen?: boolean;
  initialToken?: string | null;
  onClose?: () => void;
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

interface PortalSection {
  id: number;
  label: string;
  sublabel: string;
}

const PORTAL_SECTIONS: PortalSection[] = [
  { id: 1, label: 'Token Search', sublabel: 'Search & Verify' },
  { id: 2, label: 'Remediation Journey', sublabel: '5-Stage Lifecycle' },
  { id: 3, label: 'Grievance Details', sublabel: 'Locality & Evidence' },
  { id: 4, label: 'Assessment Signals', sublabel: 'Explainable Triage' },
];

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
    description: 'Grievance officially registered in the Mysuru City Corporation database with automated intake checks.',
  },
  {
    id: 'VERIFIED',
    title: 'Evidence & Triage Verification',
    stageTag: 'Jurisdiction & Deduplication',
    description: 'Evidence clarity, jurisdictional boundaries, and duplicate similarity evaluated for engineering triage.',
  },
  {
    id: 'ASSIGNED',
    title: 'Department Assigned',
    stageTag: 'Jurisdictional Routing',
    description: 'Routing recommendation confirmed and dispatched to the designated MCC engineering department.',
  },
  {
    id: 'IN_PROGRESS',
    title: 'Field Team In Progress',
    stageTag: 'On-Site Remediation',
    description: 'Ward engineering maintenance team active on-site for physical civic inspection and repair.',
  },
  {
    id: 'RESOLVED',
    title: 'Resolved & Verified',
    stageTag: 'Closure & Confirmation',
    description: 'Remediation confirmed on-site and official resolution record sealed in the municipal register.',
  },
];

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
  isOpen = true,
  initialToken = null,
  onClose,
  onBackToDashboard,
  onReportGrievance,
  currentUser: _currentUser,
}) => {
  const [activeSection, setActiveSection] = useState<number>(1);
  const [tokenInput, setTokenInput] = useState<string>(initialToken || '');
  const [prevInitialToken, setPrevInitialToken] = useState<string | null>(initialToken || null);
  const [data, setData] = useState<PublicTrackResult | null>(null);
  const [loading, setLoading] = useState<boolean>(() => Boolean(initialToken?.trim()));
  const [error, setError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<boolean>(false);
  const [assessmentExpanded, setAssessmentExpanded] = useState<boolean>(true);

  const formBodyRef = useRef<HTMLDivElement>(null);

  // Sync tokenInput if initialToken changed from parent
  if (initialToken !== prevInitialToken) {
    setPrevInitialToken(initialToken || null);
    setTokenInput(initialToken || '');
  }

  // Handle escape key and lock body scroll when portal is open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (onClose) onClose();
        else if (onBackToDashboard) onBackToDashboard();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
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
      document.body.style.paddingRight = '';
    };
  }, [isOpen, onClose, onBackToDashboard]);

  // Fetch complaint from real backend API
  const fetchComplaint = useCallback(async (tokenToFetch: string) => {
    const cleanToken = tokenToFetch.trim();
    if (!cleanToken) {
      setError('Please enter your tracking token to inspect status.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await apiTrackComplaint(cleanToken);
      setData(result);
      setError(null);
      // Auto advance to Section 2 (Journey) on successful search
      setActiveSection(2);
      if (formBodyRef.current) {
        formBodyRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
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
          setActiveSection(2);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          setData(null);
          setError(
            err.message ||
              'Grievance not found with the provided tracking token. Please verify the code and try again.'
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

  const handleSectionJump = (sectionId: number) => {
    setActiveSection(sectionId);
    const target = document.getElementById(`track-section-${sectionId}`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleDismiss = () => {
    if (onClose) onClose();
    else if (onBackToDashboard) onBackToDashboard();
  };

  if (!isOpen || typeof document === 'undefined') return null;

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

  const modalPortal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 md:p-6"
      style={{
        backgroundColor: 'rgba(15, 18, 24, 0.65)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="track-portal-title"
    >
      {/* Clickable backdrop overlay to dismiss */}
      <div
        className="absolute inset-0 cursor-pointer"
        onClick={handleDismiss}
        aria-hidden="true"
      />

      {/*
        Portal Box:
        - Mobile (<640px): full viewport h-full w-full rounded-none
        - Desktop / Tablet: centered, rounded-2xl, max-w-5xl, h-[90vh] max-h-[820px]
        - Fits strictly within the viewport height
        - Header and footer are pinned; only the content area scrolls internally
      */}
      <div
        className="relative w-full h-full sm:h-[90vh] sm:max-h-[820px] sm:max-w-4xl md:max-w-5xl bg-bridge-ivory-50 sm:rounded-2xl shadow-bridge-modal border-0 sm:border sm:border-bridge-almond-300 flex flex-col z-10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Fixed / Pinned Top Header Bar ── */}
        <header className="shrink-0 bg-white px-4 sm:px-6 py-3.5 border-b border-bridge-almond-200 flex items-center justify-between z-20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-bridge-gold-50 border border-bridge-gold-200 flex items-center justify-center text-bridge-gold-700 shrink-0 shadow-2xs">
              <FileSearch className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1
                  id="track-portal-title"
                  className="text-sm sm:text-base font-bold text-bridge-charcoal-900 leading-tight"
                >
                  Track Your Civic Request
                </h1>
                <span className="hidden sm:inline-flex items-center text-[10px] uppercase font-bold text-bridge-gold-800 bg-bridge-gold-50 border border-bridge-gold-200 px-2 py-0.2 rounded-full">
                  MCC Grievance Portal
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-bridge-charcoal-500">
                Mysuru City Corporation — Real-Time Verification &amp; Follow-Through Registry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDismiss}
              className="p-2 rounded-lg text-bridge-charcoal-400 hover:text-bridge-charcoal-700 hover:bg-bridge-almond-100 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-gold-500"
              aria-label="Close Tracking Portal"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* ── DESKTOP 3-COLUMN / MOBILE STACKED WORKSPACE AREA ── */}
        <div className="flex flex-col lg:flex-row lg:gap-0 flex-1 min-h-0 overflow-hidden">
          {/* Left: Section Navigation Rail (desktop) & Mobile progress pills */}
          <aside className="lg:w-52 xl:w-56 shrink-0 lg:border-r lg:border-bridge-almond-200 p-4 lg:p-5 lg:pt-6 overflow-y-auto bg-white/50">
            {/* Mobile: compact horizontal progress pills */}
            <div className="lg:hidden flex items-center gap-2 mb-3">
              {PORTAL_SECTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSectionJump(s.id)}
                  disabled={!data && s.id > 1}
                  className={`flex-1 h-1.5 rounded-full transition-all duration-300 ease-out ${
                    s.id === activeSection
                      ? 'bg-bridge-gold-500 ring-2 ring-bridge-gold-400/25'
                      : data && s.id < activeSection
                      ? 'bg-bridge-gold-400'
                      : 'bg-bridge-almond-200'
                  }`}
                  title={s.label}
                />
              ))}
            </div>

            {/* Desktop Section Rail */}
            <nav className="hidden lg:block space-y-1.5" aria-label="Portal sections">
              <p className="text-[10px] font-bold text-bridge-charcoal-400 uppercase tracking-wider mb-2.5 px-2">
                Investigation View
              </p>
              {PORTAL_SECTIONS.map((s) => {
                const isCurrent = s.id === activeSection;
                const isDisabled = !data && s.id > 1;

                return (
                  <button
                    key={s.id}
                    onClick={() => handleSectionJump(s.id)}
                    disabled={isDisabled}
                    className={`w-full text-left p-2.5 rounded-xl text-xs transition-all duration-200 flex items-start gap-2.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-gold-500 ${
                      isCurrent
                        ? 'bg-bridge-charcoal-900 text-white font-semibold shadow-civic'
                        : isDisabled
                        ? 'opacity-40 cursor-not-allowed text-bridge-charcoal-400'
                        : 'text-bridge-charcoal-700 hover:bg-bridge-almond-100 hover:text-bridge-charcoal-900'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
                        isCurrent
                          ? 'bg-bridge-gold-500 text-bridge-charcoal-900'
                          : 'bg-bridge-almond-200 text-bridge-charcoal-700'
                      }`}
                    >
                      {s.id}
                    </div>
                    <div className="min-w-0">
                      <span className="block font-bold truncate">{s.label}</span>
                      <span
                        className={`text-[10px] block truncate ${
                          isCurrent ? 'text-bridge-almond-300' : 'text-bridge-charcoal-400'
                        }`}
                      >
                        {s.sublabel}
                      </span>
                    </div>
                  </button>
                );
              })}
            </nav>

            {/* Mobile current section label */}
            <div className="lg:hidden">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-bridge-charcoal-400">
                Section {activeSection} of {PORTAL_SECTIONS.length}
              </p>
              <p className="text-sm font-bold text-bridge-charcoal-900 mt-0.5">
                {PORTAL_SECTIONS[activeSection - 1]?.label}
              </p>
            </div>
          </aside>

          {/* Center: Scrollable Active Section Area */}
          <main
            ref={formBodyRef}
            data-modal-body="true"
            className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 lg:p-7 pb-8 space-y-6"
            aria-live="polite"
          >
            {/* Section 1: Search & Token Input */}
            <section
              id="track-section-1"
              className="bg-white border border-bridge-almond-200 rounded-2xl p-5 sm:p-6 shadow-bridge-card space-y-4"
            >
              <div className="flex items-start sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-bridge-charcoal-900 flex items-center gap-2">
                    <Search className="w-4 h-4 text-bridge-gold-700" />
                    <span>Search Official Grievance Token</span>
                  </h2>
                  <p className="text-xs text-bridge-charcoal-500 mt-0.5">
                    Query the municipal database for genuine remediation progress and verification signals.
                  </p>
                </div>

                <Badge variant="neutral" size="sm" icon={<ShieldCheck className="w-3.5 h-3.5 text-bridge-gold-700" />}>
                  Authentic Data Only
                </Badge>
              </div>

              <form onSubmit={handleSearchSubmit} className="space-y-3">
                <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
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
                      placeholder="Enter token (e.g. TRK-XXXX-XXXX or DEMO-2026-0001)"
                      aria-label="Tracking Token Input"
                      className={`w-full pl-10 pr-10 py-2.5 sm:py-3 text-xs sm:text-sm font-mono tracking-wide bg-white border rounded-xl text-bridge-charcoal-900 placeholder:text-bridge-charcoal-400 placeholder:font-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-gold-500 transition-all shadow-2xs ${
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
                        title="Clear input"
                        aria-label="Clear tracking input"
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
                    className="shrink-0 px-6 py-2.5 sm:py-3 font-semibold shadow-xs transition-all duration-200"
                    icon={
                      loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )
                    }
                  >
                    {loading ? 'Querying MCC...' : 'Track Complaint'}
                  </Button>
                </div>

                {/* Error Banner */}
                {error && (
                  <div
                    role="alert"
                    className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2.5 animate-fadeIn"
                  >
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5 flex-1">
                      <span className="font-semibold block text-rose-900">Grievance Not Found</span>
                      <span className="leading-relaxed">{error}</span>
                    </div>
                  </div>
                )}

                {/* Secondary Hint */}
                <div className="pt-2 border-t border-bridge-almond-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] sm:text-xs text-bridge-charcoal-500">
                  <div className="flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-bridge-gold-700 shrink-0" />
                    <span>
                      Tokens follow the format <code className="px-1 py-0.5 rounded bg-bridge-almond-100 font-mono font-semibold text-bridge-charcoal-800 text-[11px]">TRK-XXXX-XXXX</code>
                    </span>
                  </div>
                  <span className="text-bridge-charcoal-400">
                    No citizen personal identifiers are stored or visible here.
                  </span>
                </div>
              </form>
            </section>

            {/* Shimmer loading skeleton */}
            {loading && (
              <div className="bg-white border border-bridge-almond-200 rounded-2xl p-6 space-y-4 animate-pulse shadow-bridge-card">
                <div className="flex items-center justify-between">
                  <div className="w-36 h-4 bg-bridge-almond-200 rounded"></div>
                  <div className="w-20 h-6 bg-bridge-almond-200 rounded-full"></div>
                </div>
                <div className="w-full h-32 bg-bridge-almond-100 rounded-xl"></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-20 bg-bridge-almond-100 rounded-xl"></div>
                  <div className="h-20 bg-bridge-almond-100 rounded-xl"></div>
                </div>
              </div>
            )}

            {/* Empty state guidance */}
            {!loading && !data && !error && (
              <div className="bg-white border border-bridge-almond-200 rounded-2xl p-6 sm:p-8 shadow-bridge-card space-y-6 text-center">
                <div className="max-w-md mx-auto space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-bridge-gold-50 border border-bridge-gold-200 text-bridge-gold-700 flex items-center justify-center mx-auto shadow-2xs">
                    <FileSearch className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-bridge-charcoal-900">
                    Civic Grievance Transparency Portal
                  </h3>
                  <p className="text-xs text-bridge-charcoal-600 leading-relaxed">
                    Submit your token above to inspect real-time remediation stages, verify officer triage signals, and review jurisdictional routing.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left pt-2 border-t border-bridge-almond-100">
                  <div className="p-3.5 bg-bridge-ivory-50/70 border border-bridge-almond-200 rounded-xl space-y-1.5">
                    <div className="w-6 h-6 rounded-md bg-bridge-gold-100 text-bridge-gold-800 flex items-center justify-center text-xs font-bold">
                      1
                    </div>
                    <h4 className="text-xs font-bold text-bridge-charcoal-900">
                      Official Intake Check
                    </h4>
                    <p className="text-[11px] text-bridge-charcoal-500 leading-snug">
                      GPS coordinates and photo timestamps are inspected to verify Mysuru ward boundaries.
                    </p>
                  </div>

                  <div className="p-3.5 bg-bridge-ivory-50/70 border border-bridge-almond-200 rounded-xl space-y-1.5">
                    <div className="w-6 h-6 rounded-md bg-bridge-gold-100 text-bridge-gold-800 flex items-center justify-center text-xs font-bold">
                      2
                    </div>
                    <h4 className="text-xs font-bold text-bridge-charcoal-900">
                      Explainable Deduplication
                    </h4>
                    <p className="text-[11px] text-bridge-charcoal-500 leading-snug">
                      Automated text and image comparison flags potential duplicate filings for ward engineers.
                    </p>
                  </div>

                  <div className="p-3.5 bg-bridge-ivory-50/70 border border-bridge-almond-200 rounded-xl space-y-1.5">
                    <div className="w-6 h-6 rounded-md bg-bridge-gold-100 text-bridge-gold-800 flex items-center justify-center text-xs font-bold">
                      3
                    </div>
                    <h4 className="text-xs font-bold text-bridge-charcoal-900">
                      Field Follow-Through
                    </h4>
                    <p className="text-[11px] text-bridge-charcoal-500 leading-snug">
                      Maintenance crews are dispatched and update resolution status directly from the site.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Content when complaint data is loaded */}
            {!loading && data && (
              <div className="space-y-6">
                {/* Section 2: 5-Stage Remediation Journey */}
                <section
                  id="track-section-2"
                  className="bg-white border border-bridge-almond-200 rounded-2xl p-5 sm:p-6 shadow-bridge-card space-y-5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-bridge-almond-100 pb-3.5">
                    <div>
                      <span className="text-[10px] font-bold text-bridge-gold-700 uppercase tracking-wider block">
                        Lifecycle Stage
                      </span>
                      <h2 className="text-sm sm:text-base font-bold text-bridge-charcoal-900">
                        Municipal Remediation Progress
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

                  {/* Vertical Rail Stepper */}
                  <div className="space-y-5 relative before:absolute before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-bridge-almond-200">
                    {JOURNEY_STAGES.map((stage, idx) => {
                      const isComplete = idx < currentStageIdx || isResolved;
                      const isCurrent = !isResolved && idx === currentStageIdx;
                      const isPending = !isComplete && !isCurrent;

                      return (
                        <div
                          key={stage.id}
                          className={`relative flex items-start gap-4 pl-0.5 transition-all duration-200 ${
                            isCurrent ? 'scale-[1.01] motion-reduce:scale-100' : ''
                          }`}
                        >
                          {/* Step Marker */}
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold z-10 transition-all ${
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
                            className={`flex-1 p-3.5 rounded-xl transition-colors ${
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
                              <div className="mt-2 text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                <span>
                                  Automated verification signals flagged this complaint for human triage by a ward engineer before field dispatch.
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Public SLA Tracking Window */}
                  {data.slaTracking && (
                    <div className="mt-5 pt-4 border-t border-bridge-almond-100 bg-bridge-ivory-50/60 rounded-xl p-4 border border-bridge-almond-200/80 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-bridge-gold-700" />
                          <span className="text-xs font-bold text-bridge-charcoal-900">
                            Standard Municipal Resolution Window
                          </span>
                        </div>
                        <span
                          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border self-start sm:self-auto ${
                            data.slaTracking.status === 'BREACHED'
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : data.slaTracking.status === 'AT_RISK'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          {data.slaTracking.status === 'BREACHED'
                            ? 'Turnaround Window Extended'
                            : data.slaTracking.status === 'AT_RISK'
                            ? 'Resolution in Progress'
                            : 'Within Standard Window'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                        <div className="bg-white p-2.5 rounded-lg border border-bridge-almond-200">
                          <span className="text-bridge-charcoal-400 block text-[10px]">Benchmark Window</span>
                          <span className="font-semibold text-bridge-charcoal-800">
                            {data.slaTracking.slaTargetHours} hours
                          </span>
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border border-bridge-almond-200">
                          <span className="text-bridge-charcoal-400 block text-[10px]">Elapsed Time</span>
                          <span className="font-semibold text-bridge-charcoal-800">
                            {data.slaTracking.elapsedHours} hours
                          </span>
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border border-bridge-almond-200 col-span-2 sm:col-span-1">
                          <span className="text-bridge-charcoal-400 block text-[10px]">Current Status</span>
                          <span className="font-semibold text-bridge-charcoal-800">
                            {data.slaTracking.remainingHours > 0
                              ? `~${data.slaTracking.remainingHours}h remaining`
                              : 'Under Active Escalation'}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="w-full bg-bridge-almond-200 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${
                              data.slaTracking.status === 'BREACHED'
                                ? 'bg-rose-500'
                                : data.slaTracking.status === 'AT_RISK'
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{
                              width: `${Math.min(100, data.slaTracking.slaProgressPercent)}%`,
                            }}
                          />
                        </div>
                        <p className="text-[10px] text-bridge-charcoal-400 leading-tight">
                          {data.slaTracking.benchmarkNotice}
                        </p>
                      </div>
                    </div>
                  )}
                </section>

                {/* Section 3: Grievance Details & Evidence */}
                <section
                  id="track-section-3"
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                >
                  {/* Quoted Description Card */}
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
                </section>

                {/* Section 4: Expandable Verification Section: How Your Complaint Was Assessed */}
                <section
                  id="track-section-4"
                  className="bg-bridge-gold-50/40 border border-bridge-gold-200 rounded-2xl p-5 sm:p-6 space-y-4 shadow-bridge-sm transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-white border border-bridge-gold-200 flex items-center justify-center text-bridge-gold-700 shadow-2xs">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm sm:text-base font-bold text-bridge-charcoal-900">
                          How Your Complaint Was Assessed
                        </h3>
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
                      {/* Duplicate Risk & Outcome */}
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

                      {/* Evaluated Verification Signals */}
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

                      {/* Photo Quality Findings */}
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

                      {/* Geo Evidence Boundary Check */}
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

                      {/* Temporal Evidence Verification */}
                      {data.temporalEvidence && (
                        <div className="p-3.5 bg-white border border-bridge-gold-200/90 rounded-xl space-y-1.5">
                          <span className="text-[10px] font-bold text-bridge-charcoal-600 uppercase tracking-wider block">
                            Temporal &amp; Timestamp Evidence
                          </span>
                          <div className="flex items-center gap-2 flex-wrap text-[11px]">
                            <Badge
                              variant={
                                data.temporalEvidence.status === 'VALID'
                                  ? 'verified'
                                  : data.temporalEvidence.status === 'FUTURE_DATED' ||
                                    data.temporalEvidence.status === 'DISCREPANCY' ||
                                    data.temporalEvidence.status === 'EXCESSIVE_AGE' ||
                                    data.temporalEvidence.status === 'INVALID'
                                  ? 'review'
                                  : 'neutral'
                              }
                              size="sm"
                            >
                              TIME: {data.temporalEvidence.status}
                            </Badge>
                            <span className="text-bridge-charcoal-600 font-medium">
                              {data.temporalEvidence.hasTimestamp && data.temporalEvidence.exifDateTime
                                ? `Captured: ${data.temporalEvidence.exifDateTime}`
                                : data.temporalEvidence.status === 'MISSING'
                                ? 'No embedded capture timestamp (standard for messaging app uploads)'
                                : 'Temporal correlation unavailable'}
                            </span>
                          </div>
                          {data.temporalEvidence.signals.length > 0 && (
                            <p className="text-[11px] text-bridge-charcoal-600 mt-1 leading-snug">
                              {data.temporalEvidence.signals[0]}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Anti-Hallucination Disclaimer */}
                      <div className="p-3 bg-white/80 rounded-xl border border-bridge-gold-200/60 text-[11px] text-bridge-charcoal-500 leading-relaxed">
                        <p>
                          <strong>Governance Notice:</strong> Verification signals and duplicate scores serve as decision support for ward engineers. They do not claim definitive judgment regarding citizen intent.
                        </p>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            )}
          </main>

          {/* Right: Live Summary Panel (desktop xl+) */}
          <aside className="hidden xl:flex xl:flex-col xl:w-60 2xl:w-64 shrink-0 border-l border-bridge-almond-200 p-4 xl:p-5 overflow-y-auto bg-white/60 space-y-4">
            <div>
              <span className="text-[10px] font-bold text-bridge-charcoal-400 uppercase tracking-wider block">
                Complaint Status
              </span>
              <h3 className="text-sm font-bold text-bridge-charcoal-900 mt-0.5">
                Live Overview
              </h3>
            </div>

            {data ? (
              <div className="space-y-3.5 text-xs">
                {/* Token Badge */}
                <div className="p-3 bg-bridge-ivory-50 rounded-xl border border-bridge-almond-200 space-y-1">
                  <span className="text-[10px] uppercase font-semibold text-bridge-charcoal-400 block">
                    Grievance Token
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-bridge-charcoal-900 text-xs truncate">
                      {data.trackingToken}
                    </span>
                    <button
                      onClick={() => handleCopy(data.trackingToken)}
                      className="text-bridge-charcoal-500 hover:text-bridge-gold-700 p-0.5 cursor-pointer"
                      title="Copy token"
                    >
                      {copiedToken ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="space-y-1">
                  <span className="text-[10px] text-bridge-charcoal-400 font-semibold uppercase block">
                    Current Status
                  </span>
                  <Badge
                    variant={
                      isResolved
                        ? 'verified'
                        : requiresHumanReview
                        ? 'review'
                        : 'info'
                    }
                    size="sm"
                  >
                    {data.status.replace(/_/g, ' ')}
                  </Badge>
                </div>

                {/* Category */}
                <div className="space-y-1">
                  <span className="text-[10px] text-bridge-charcoal-400 font-semibold uppercase block">
                    Category
                  </span>
                  <div className="flex items-center gap-1.5">
                    <CategoryIcon className="w-3.5 h-3.5 text-bridge-gold-700" />
                    <span className="font-semibold text-bridge-charcoal-800">
                      {categoryInfo.label}
                    </span>
                  </div>
                </div>

                {/* Assigned Department */}
                <div className="space-y-1">
                  <span className="text-[10px] text-bridge-charcoal-400 font-semibold uppercase block">
                    Assigned Division
                  </span>
                  <div className="flex items-center gap-1.5 text-bridge-charcoal-800 font-semibold">
                    <Building2 className="w-3.5 h-3.5 text-bridge-gold-700 shrink-0" />
                    <span className="truncate">
                      {data.assignedDepartment || 'Triage in Progress'}
                    </span>
                  </div>
                </div>

                {/* Verification Outcome */}
                <div className="space-y-1">
                  <span className="text-[10px] text-bridge-charcoal-400 font-semibold uppercase block">
                    Verification Outcome
                  </span>
                  <Badge variant="neutral" size="sm">
                    {data.verificationOutcome || 'STANDARD_TRIAGE'}
                  </Badge>
                </div>

                {/* Review Warning if required */}
                {requiresHumanReview && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 space-y-1">
                    <div className="flex items-center gap-1 font-bold text-amber-900">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Review In Progress</span>
                    </div>
                    <p className="leading-snug">
                      Assigned to ward engineer for manual assessment.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-bridge-ivory-50/80 rounded-xl border border-bridge-almond-200 text-xs text-bridge-charcoal-500 space-y-2">
                <Info className="w-4 h-4 text-bridge-gold-700" />
                <p className="leading-relaxed text-[11px]">
                  Enter a valid tracking token on the left to inspect real-time complaint status, department assignment, and verification signals.
                </p>
              </div>
            )}
          </aside>
        </div>

        {/* ── PINNED / STICKY BOTTOM ACTION BAR ── */}
        <footer className="shrink-0 border-t border-bridge-almond-200 bg-white px-4 sm:px-6 py-3 sm:py-3.5 flex items-center justify-between gap-3 z-20 shadow-bridge-sm">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            icon={<X className="w-3.5 h-3.5" />}
            className="transition-all duration-200 ease-out active:scale-[0.98] motion-reduce:active:scale-100 hover:bg-bridge-almond-100/90"
          >
            Close Portal
          </Button>

          <div className="flex items-center gap-3">
            {data && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleCopy(data.trackingToken)}
                icon={
                  copiedToken ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )
                }
              >
                {copiedToken ? 'Token Copied!' : 'Copy Token'}
              </Button>
            )}

            {onReportGrievance && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={onReportGrievance}
                icon={<PlusCircle className="w-4 h-4" />}
              >
                Report Grievance
              </Button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );

  return createPortal(modalPortal, document.body);
};

export default TrackComplaintPage;
