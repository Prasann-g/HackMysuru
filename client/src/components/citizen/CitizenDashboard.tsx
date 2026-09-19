import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileText,
  PlusCircle,
  Search,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Building2,
  UserCheck,
  ChevronRight,
  ShieldCheck,
  MapPin,
  BarChart3,
} from 'lucide-react';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { apiGetMyComplaints, type ComplaintRecord } from '../../services/api';
import type { CitizenUser } from '../../types/auth';
import { ReportGrievanceModal } from './ReportGrievanceModal';
import { CitizenTrackingDrawer } from './CitizenTrackingDrawer';
import { ComplaintTracker } from '../tracking/ComplaintTracker';
import { PublicMapAnalytics } from '../public/PublicMapAnalytics';

interface CitizenDashboardProps {
  currentUser: CitizenUser;
  onNavigateToSubmit?: () => void;
  onNavigateToTrack?: (token: string) => void;
  onNavigateToAnalytics?: () => void;
  initialOpenReportModal?: boolean;
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

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: 'verified' | 'review' | 'info' | 'neutral' }
> = {
  SUBMITTED: { label: 'Submitted', variant: 'neutral' },
  UNDER_REVIEW: { label: 'Under Review', variant: 'review' },
  NEEDS_CLARIFICATION: { label: 'Needs Info', variant: 'review' },
  FORWARDED: { label: 'Forwarded', variant: 'info' },
  IN_PROGRESS: { label: 'In Progress', variant: 'info' },
  RESOLVED: { label: 'Resolved', variant: 'verified' },
  CLOSED: { label: 'Closed', variant: 'neutral' },
};

export const CitizenDashboard: React.FC<CitizenDashboardProps> = ({
  currentUser,
  onNavigateToTrack,
  initialOpenReportModal = false,
}) => {
  const [complaints, setComplaints] = useState<ComplaintRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'RESOLVED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Integrated Dashboard Views: 'ledger' or 'map'
  const [activeView, setActiveView] = useState<'ledger' | 'map'>('ledger');

  // Integrated Modal & Drawer States
  const [isReportModalOpen, setIsReportModalOpen] = useState(initialOpenReportModal);
  const [isTrackingDrawerOpen, setIsTrackingDrawerOpen] = useState(false);
  const [selectedTrackingToken, setSelectedTrackingToken] = useState<string | null>(null);

  const handleRefresh = useCallback(() => {
    setLoading(true);
    setError(null);
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let isMounted = true;

    apiGetMyComplaints()
      .then((data) => {
        if (isMounted) {
          setComplaints(data);
          setLoading(false);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          setError(err.message || 'Unable to load your grievance history.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  const handleCopy = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleOpenTracker = (token: string) => {
    if (onNavigateToTrack) {
      onNavigateToTrack(token);
    } else {
      setSelectedTrackingToken(token);
      setIsTrackingDrawerOpen(true);
    }
  };

  // Metrics calculated strictly from real authentic complaints
  const totalCount = complaints.length;
  const inReviewCount = complaints.filter(
    (c) => c.status === 'UNDER_REVIEW' || c.status === 'NEEDS_CLARIFICATION' || c.status === 'SUBMITTED'
  ).length;
  const inProgressCount = complaints.filter(
    (c) => c.status === 'IN_PROGRESS' || c.status === 'FORWARDED'
  ).length;
  const resolvedCount = complaints.filter(
    (c) => c.status === 'RESOLVED' || c.status === 'CLOSED'
  ).length;

  // Filtered grievances
  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      if (statusFilter === 'ACTIVE') {
        if (c.status === 'RESOLVED' || c.status === 'CLOSED') return false;
      } else if (statusFilter === 'RESOLVED') {
        if (c.status !== 'RESOLVED' && c.status !== 'CLOSED') return false;
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesToken = c.trackingToken.toLowerCase().includes(query);
        const matchesArea = c.locationArea.toLowerCase().includes(query);
        const matchesCategory = (CATEGORY_LABELS[c.category] || c.category).toLowerCase().includes(query);
        const matchesDesc = c.description.toLowerCase().includes(query);
        if (!matchesToken && !matchesArea && !matchesCategory && !matchesDesc) {
          return false;
        }
      }

      return true;
    });
  }, [complaints, statusFilter, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fadeIn">
      {/* 1. Welcome & Citizen Profile Header */}
      <div className="bg-white border border-bridge-almond-200 rounded-2xl p-6 sm:p-8 shadow-bridge-card">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-semibold uppercase tracking-wider text-bridge-gold-700 bg-bridge-gold-50 border border-bridge-gold-200 px-2.5 py-0.5 rounded-full">
                Mysuru Citizen Portal
              </span>
              <Badge variant="verified" size="sm" icon={<UserCheck className="w-3 h-3" />}>
                Verified Citizen Account
              </Badge>
              {currentUser.ward && (
                <span className="text-xs text-bridge-charcoal-600 bg-bridge-almond-100 border border-bridge-almond-200 px-2.5 py-0.5 rounded-full">
                  Ward: {currentUser.ward}
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-bridge-charcoal-900 tracking-tight">
              Welcome back, {currentUser.name}
            </h1>
            <p className="text-xs sm:text-sm text-bridge-charcoal-600 max-w-2xl">
              Track your reported civic grievances, review AI-guided verification outcomes, and submit new issues directly to Mysuru City Corporation.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button
              variant="outline"
              size="md"
              onClick={handleRefresh}
              icon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => setIsReportModalOpen(true)}
              icon={<PlusCircle className="w-4 h-4" />}
            >
              Report Grievance
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Executive Grievance KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card hoverable>
          <CardBody className="p-5 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-bridge-charcoal-500 uppercase tracking-wider block">
                Total Submitted
              </span>
              <span className="text-3xl font-extrabold text-bridge-charcoal-900 mt-1 block">
                {totalCount}
              </span>
              <span className="text-xs text-bridge-charcoal-500 mt-1 block">
                All-time grievances reported
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-bridge-almond-100 border border-bridge-almond-200 flex items-center justify-center text-bridge-charcoal-700 transition-colors duration-200">
              <FileText className="w-6 h-6" />
            </div>
          </CardBody>
        </Card>

        <Card hoverable>
          <CardBody className="p-5 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-bridge-charcoal-500 uppercase tracking-wider block">
                Intake &amp; Review
              </span>
              <span className="text-3xl font-extrabold text-amber-600 mt-1 block">
                {inReviewCount}
              </span>
              <span className="text-xs text-bridge-charcoal-500 mt-1 block">
                Awaiting officer verification
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 transition-colors duration-200">
              <Clock className="w-6 h-6" />
            </div>
          </CardBody>
        </Card>

        <Card hoverable>
          <CardBody className="p-5 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-bridge-charcoal-500 uppercase tracking-wider block">
                Field In Progress
              </span>
              <span className="text-3xl font-extrabold text-bridge-gold-700 mt-1 block">
                {inProgressCount}
              </span>
              <span className="text-xs text-bridge-charcoal-500 mt-1 block">
                Assigned to ward division
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-bridge-gold-50 border border-bridge-gold-200 flex items-center justify-center text-bridge-gold-700 transition-colors duration-200">
              <Building2 className="w-6 h-6" />
            </div>
          </CardBody>
        </Card>

        <Card hoverable>
          <CardBody className="p-5 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-bridge-charcoal-500 uppercase tracking-wider block">
                Resolved Cases
              </span>
              <span className="text-3xl font-extrabold text-emerald-600 mt-1 block">
                {resolvedCount}
              </span>
              <span className="text-xs text-bridge-charcoal-500 mt-1 block">
                Closed or confirmed fixed
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </CardBody>
        </Card>
      </div>

      {/* 3. Integrated Sub-View Switcher Tabs */}
      <div className="flex items-center gap-3 border-b border-bridge-almond-200 pb-2">
        <button
          onClick={() => setActiveView('ledger')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 cursor-pointer active:scale-[0.985] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-gold-500 ${
            activeView === 'ledger'
              ? 'bg-bridge-charcoal-900 text-white shadow-civic'
              : 'bg-white text-bridge-charcoal-700 hover:bg-bridge-almond-100 hover:border-bridge-almond-300 border border-bridge-almond-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>My Grievances &amp; Tracking ({totalCount})</span>
        </button>

        <button
          onClick={() => setActiveView('map')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 cursor-pointer active:scale-[0.985] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-gold-500 ${
            activeView === 'map'
              ? 'bg-bridge-charcoal-900 text-white shadow-civic'
              : 'bg-white text-bridge-charcoal-700 hover:bg-bridge-almond-100 hover:border-bridge-almond-300 border border-bridge-almond-200'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Mysuru Spatial Map &amp; City Analytics</span>
        </button>
      </div>

      {/* 4. Active View Content */}
      {activeView === 'ledger' ? (
        <div className="space-y-6">
          {/* 1. Track Your Civic Request Search Card */}
          <ComplaintTracker
            onTrack={handleOpenTracker}
            onOpenFullPage={(tok) => onNavigateToTrack?.(tok || '')}
          />

          {/* Grievance Ledger & Activity View */}
          <Card className="border-bridge-almond-200 shadow-bridge-card">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-bridge-charcoal-900 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-bridge-gold-700" />
                    <span>My Submitted Grievances</span>
                  </h2>
                  <p className="text-xs text-bridge-charcoal-500 mt-0.5">
                    Authentic status timeline and verification signals for your reports
                  </p>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  {/* Status Tabs */}
                  <div className="flex items-center bg-bridge-almond-100 p-1 rounded-xl border border-bridge-almond-200 text-xs">
                    <button
                      onClick={() => setStatusFilter('ALL')}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition-all duration-150 cursor-pointer active:scale-[0.98] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bridge-gold-500 ${
                        statusFilter === 'ALL'
                          ? 'bg-white text-bridge-charcoal-900 shadow-xs'
                          : 'text-bridge-charcoal-600 hover:text-bridge-charcoal-900 hover:bg-white/60'
                      }`}
                    >
                      All ({totalCount})
                    </button>
                    <button
                      onClick={() => setStatusFilter('ACTIVE')}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition-all duration-150 cursor-pointer active:scale-[0.98] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bridge-gold-500 ${
                        statusFilter === 'ACTIVE'
                          ? 'bg-white text-bridge-charcoal-900 shadow-xs'
                          : 'text-bridge-charcoal-600 hover:text-bridge-charcoal-900 hover:bg-white/60'
                      }`}
                    >
                      Active ({inReviewCount + inProgressCount})
                    </button>
                    <button
                      onClick={() => setStatusFilter('RESOLVED')}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition-all duration-150 cursor-pointer active:scale-[0.98] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bridge-gold-500 ${
                        statusFilter === 'RESOLVED'
                          ? 'bg-white text-bridge-charcoal-900 shadow-xs'
                          : 'text-bridge-charcoal-600 hover:text-bridge-charcoal-900 hover:bg-white/60'
                      }`}
                    >
                      Resolved ({resolvedCount})
                    </button>
                  </div>

                  {/* Search Box */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-bridge-charcoal-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search token, area..."
                      className="civic-input w-full sm:w-48 pl-8 pr-3 py-1.5 text-xs rounded-xl"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardBody className="p-0">
              {loading ? (
                <div className="p-12 text-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-bridge-gold-600 animate-spin mx-auto" />
                  <p className="text-xs text-bridge-charcoal-600 font-medium">
                    Loading your registered grievances...
                  </p>
                </div>
              ) : error ? (
                <div className="p-8 text-center space-y-3">
                  <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
                  <p className="text-xs text-rose-700 font-medium">{error}</p>
                  <Button variant="outline" size="sm" onClick={handleRefresh}>
                    Try Again
                  </Button>
                </div>
              ) : filteredComplaints.length === 0 ? (
                <div className="p-12 text-center max-w-md mx-auto space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-bridge-almond-100 border border-bridge-almond-200 flex items-center justify-center text-bridge-charcoal-500 mx-auto">
                    <FileText className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-bridge-charcoal-900">
                      {searchQuery || statusFilter !== 'ALL'
                        ? 'No matching grievances found'
                        : 'No grievances submitted yet'}
                    </h3>
                    <p className="text-xs text-bridge-charcoal-500 mt-1 leading-relaxed">
                      {searchQuery || statusFilter !== 'ALL'
                        ? 'Try adjusting your search query or switching your status filter.'
                        : 'Notice a road hazard, waste accumulation, or broken streetlight in Mysuru? Submit a report with photographic evidence to begin verification.'}
                    </p>
                  </div>
                  {!searchQuery && statusFilter === 'ALL' && (
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => setIsReportModalOpen(true)}
                      icon={<PlusCircle className="w-4 h-4" />}
                    >
                      File Your First Grievance
                    </Button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-bridge-almond-100">
                  {filteredComplaints.map((item) => {
                    const statusInfo = STATUS_CONFIG[item.status] || {
                      label: item.status,
                      variant: 'neutral',
                    };
                    const catBadgeClass = CATEGORY_BADGES[item.category] || CATEGORY_BADGES.other;
                    const formattedDate = new Date(item.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    });

                    return (
                      <div
                        key={item.id}
                        className="p-5 sm:p-6 hover:bg-bridge-almond-50/70 border-l-2 border-l-transparent hover:border-l-bridge-gold-500 transition-all duration-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                      >
                        {/* Left Details */}
                        <div className="space-y-2 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Tracking Token */}
                            <div className="flex items-center gap-1 bg-bridge-almond-100 border border-bridge-almond-200 px-2.5 py-1 rounded-lg text-xs font-mono font-bold text-bridge-charcoal-800">
                              <span>{item.trackingToken}</span>
                              <button
                                onClick={() => handleCopy(item.trackingToken)}
                                className="text-bridge-charcoal-400 hover:text-bridge-gold-700 active:scale-90 transition-all p-0.5 rounded cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bridge-gold-500"
                                title="Copy tracking token"
                              >
                                {copiedToken === item.trackingToken ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>

                            {/* Category Badge */}
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${catBadgeClass}`}
                            >
                              {CATEGORY_LABELS[item.category] || item.category}
                            </span>

                            {/* Lifecycle Status */}
                            <Badge variant={statusInfo.variant} size="sm">
                              {statusInfo.label}
                            </Badge>

                            {/* Single Demo Tag if applicable */}
                            {item.isDemo && (
                              <span className="text-[10px] uppercase font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-md">
                                Demo Record
                              </span>
                            )}
                          </div>

                          {/* Description */}
                          <p className="text-xs sm:text-sm text-bridge-charcoal-800 font-medium line-clamp-2 leading-relaxed">
                            {item.description}
                          </p>

                          {/* Metadata Row */}
                          <div className="flex items-center gap-4 text-xs text-bridge-charcoal-500 flex-wrap pt-1">
                            <span>
                              <strong className="text-bridge-charcoal-700 font-semibold">Location:</strong>{' '}
                              {item.locationArea} {item.addressText ? `(${item.addressText})` : ''}
                            </span>
                            <span>•</span>
                            <span>
                              <strong className="text-bridge-charcoal-700 font-semibold">Reported:</strong>{' '}
                              {formattedDate}
                            </span>
                            {item.verificationResult?.duplicateRisk && (
                              <>
                                <span>•</span>
                                <span className="inline-flex items-center gap-1 font-semibold text-bridge-charcoal-700">
                                  <ShieldCheck className="w-3.5 h-3.5 text-bridge-gold-700" />
                                  <span>
                                    Risk:{' '}
                                    <span
                                      className={
                                        item.verificationResult.duplicateRisk === 'HIGH'
                                          ? 'text-rose-600'
                                          : item.verificationResult.duplicateRisk === 'MEDIUM'
                                          ? 'text-amber-600'
                                          : 'text-emerald-600'
                                      }
                                    >
                                      {item.verificationResult.duplicateRisk}
                                    </span>
                                  </span>
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Right Action: Open Inline Drawer */}
                        <div className="shrink-0 flex items-center gap-2 pt-2 lg:pt-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenTracker(item.trackingToken)}
                            icon={<ChevronRight className="w-3.5 h-3.5" />}
                          >
                            Track Timeline
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      ) : (
        /* Embedded Public Map & Locality Analytics */
        <div className="space-y-6">
          <div className="bg-white border border-bridge-almond-200 rounded-2xl p-4 sm:p-5 shadow-bridge-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-bridge-charcoal-900 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-bridge-gold-700" />
                  <span>Mysuru City-Wide Transparency Map &amp; Spatial Density</span>
                </h3>
                <p className="text-xs text-bridge-charcoal-500 mt-0.5">
                  Aggregate civic complaint metrics and authentic GPS coordinate distribution across MCC zones. Zero personal citizen information exposed.
                </p>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsReportModalOpen(true)}
                icon={<PlusCircle className="w-4 h-4" />}
              >
                Report New Issue
              </Button>
            </div>
          </div>

          <PublicMapAnalytics
            onNavigateToReport={() => setIsReportModalOpen(true)}
            onNavigateToTrack={(token) => {
              if (token) {
                handleOpenTracker(token);
              }
            }}
          />
        </div>
      )}

      {/* 5. Report Grievance Modal (Opens in-dashboard without page switching) */}
      <ReportGrievanceModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onSuccess={() => {
          handleRefresh();
        }}
        onTrackComplaint={(token) => {
          setIsReportModalOpen(false);
          handleOpenTracker(token);
        }}
      />

      {/* 6. Inline Complaint Tracking Drawer (Inspects without page switching) */}
      <CitizenTrackingDrawer
        isOpen={isTrackingDrawerOpen}
        token={selectedTrackingToken}
        onClose={() => {
          setIsTrackingDrawerOpen(false);
          setSelectedTrackingToken(null);
        }}
        onReportIssue={() => {
          setIsTrackingDrawerOpen(false);
          setIsReportModalOpen(true);
        }}
      />
    </div>
  );
};
