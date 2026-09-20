import React, { useState, useEffect } from 'react';
import {
  X,
  MapPin,
  Calendar,
  User,
  Camera,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  ShieldCheck,
  Loader2,
  Copy,
  Check,
  ImageOff,
  Layers,
  Maximize2,
  Building2,
  Clock,
  Compass,
  Timer,
  Activity,
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import {
  apiGetOfficerComplaintById,
  apiUpdateOfficerReview,
  apiGetFollowThroughDossier,
  type OfficerComplaintDetail,
  type ComplaintRecord,
  type FollowThroughDossier,
} from '../../services/api';
import type { CitizenUser } from '../../types/auth';
import { DuplicateClusterInspector } from './DuplicateClusterInspector';
import { ReviewActionPanel } from './ReviewActionPanel';
import { AuthenticatedEvidenceImage } from '../common/AuthenticatedEvidenceImage';
import { FollowThroughPanel } from '../followthrough/FollowThroughPanel';
import { ComplaintTimeline } from '../followthrough/ComplaintTimeline';
import { RoutingDecisionCard } from './RoutingDecisionCard';
import { CVEvidenceInspectionPanel } from './CVEvidenceInspectionPanel';

interface OfficerDetailDrawerProps {
  complaintId: string | null;
  onClose: () => void;
  onUpdated: () => void;
  currentOfficer?: CitizenUser | null;
}

export const OfficerDetailDrawer: React.FC<OfficerDetailDrawerProps> = ({
  complaintId,
  onClose,
  onUpdated,
  currentOfficer,
}) => {
  const [detail, setDetail] = useState<OfficerComplaintDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [notePreFill, setNotePreFill] = useState<string>('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState<boolean>(false);
  const [dossier, setDossier] = useState<FollowThroughDossier | null>(null);
  const [dossierLoading, setDossierLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!complaintId) return;

    let isMounted = true;
    apiGetOfficerComplaintById(complaintId)
      .then((data) => {
        if (isMounted) {
          setDetail(data);
          setIsLoading(false);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          setErrorMsg(err.message || 'Failed to load complaint details.');
          setIsLoading(false);
        }
      });

    apiGetFollowThroughDossier(complaintId)
      .then((d) => {
        if (isMounted) {
          setDossier(d);
          setDossierLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setDossier(null);
          setDossierLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [complaintId]);

  const handleRetry = () => {
    if (!complaintId) return;
    setIsLoading(true);
    setErrorMsg(null);
    apiGetOfficerComplaintById(complaintId)
      .then((data) => {
        setDetail(data);
        setIsLoading(false);
      })
      .catch((err: any) => {
        setErrorMsg(err.message || 'Failed to load complaint details.');
        setIsLoading(false);
      });

    setDossierLoading(true);
    apiGetFollowThroughDossier(complaintId)
      .then((d) => {
        setDossier(d);
        setDossierLoading(false);
      })
      .catch(() => {
        setDossier(null);
        setDossierLoading(false);
      });
  };

  if (!complaintId) return null;

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text).catch(() => {
      // ignore clipboard error
    });
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleUpdateReview = async (payload: {
    status?: string;
    assignedDepartment?: string;
    reviewNotes?: string;
  }) => {
    if (!detail) return;
    setIsUpdating(true);
    try {
      const res = await apiUpdateOfficerReview(detail.complaint.id, payload);
      setDetail((prev) =>
        prev ? { ...prev, complaint: res.complaint } : null
      );
      apiGetFollowThroughDossier(detail.complaint.id).then(setDossier).catch(() => {});
      onUpdated();
    } finally {
      setIsUpdating(false);
    }
  };

  const handleConfirmDuplicate = (candidate: ComplaintRecord) => {
    setNotePreFill(
      `[DUPLICATE ACTION] Confirmed grievance matches existing complaint #${candidate.id} (${candidate.trackingToken}). Consolidated for joint field dispatch.`
    );
  };

  const handleMarkDistinct = (candidate: ComplaintRecord) => {
    setNotePreFill(
      `[DISTINCT ACTION] Inspected candidate #${candidate.id}. Verified separate occurrence requiring distinct field remediation despite textual similarity.`
    );
  };

  const complaint = detail?.complaint;
  const verification = complaint?.verificationResult;

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'RESOLVED':
        return 'verified';
      case 'IN_PROGRESS':
        return 'info';
      case 'UNDER_REVIEW':
      case 'FORWARDED':
        return 'review';
      case 'CLOSED':
        return 'neutral';
      default:
        return 'neutral';
    }
  };

  const getStatusDescription = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
        return 'Grievance received in intake ledger. Awaiting triage & field assignment.';
      case 'UNDER_REVIEW':
        return 'Officer is evaluating evidence, cross-referencing duplicates, and inspecting ward records.';
      case 'FORWARDED':
        return 'Grievance forwarded to specialized division or utility authority for action.';
      case 'IN_PROGRESS':
        return 'Active field work order dispatched to maintenance crews on site.';
      case 'RESOLVED':
        return 'Remediation completed and verified by municipal authority.';
      case 'CLOSED':
        return 'Case closed, archived, or consolidated into master grievance.';
      default:
        return 'Status update logged.';
    }
  };

  const getDuplicateRiskBadgeVariant = (risk?: string) => {
    switch (risk) {
      case 'HIGH':
        return 'duplicate';
      case 'MEDIUM':
        return 'review';
      case 'LOW':
      default:
        return 'verified';
    }
  };

  return (
    <div data-test-id="complaint-drawer" className="fixed inset-0 z-50 overflow-hidden bg-bridge-charcoal-900/50 backdrop-blur-xs flex justify-end animate-fadeIn">
      <div className="relative w-full max-w-3xl bg-bridge-ivory-50 h-full flex flex-col shadow-civic-lg border-l border-bridge-almond-200 overflow-y-auto">
        {/* Sticky Header */}
        <div className="sticky top-0 z-20 bg-white border-b border-bridge-almond-200 px-6 py-4 flex items-center justify-between shadow-civic-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-bridge-charcoal-900 text-base">
                {complaint?.id || complaintId}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(complaint?.id || complaintId, 'header-id')}
                className="text-bridge-charcoal-400 hover:text-bridge-charcoal-700 active:scale-90 transition-all p-0.5 rounded cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bridge-gold-500"
                title="Copy ID"
              >
                {copiedField === 'header-id' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>

              {complaint?.trackingToken && (
                <span className="text-xs font-mono text-bridge-charcoal-600 bg-bridge-almond-100 border border-bridge-almond-200 px-2 py-0.5 rounded flex items-center gap-1">
                  <span>TRK: {complaint.trackingToken}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(complaint.trackingToken, 'header-trk')}
                    className="text-bridge-charcoal-400 hover:text-bridge-charcoal-700 active:scale-90 transition-all p-0.5 rounded cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bridge-gold-500"
                    title="Copy Token"
                  >
                    {copiedField === 'header-trk' ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </span>
              )}

              {complaint?.isDemo && (
                <span className="text-[11px] font-medium text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                  Synthetic Demo Record
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-bridge-charcoal-500">
              <span>Category: <strong className="capitalize text-bridge-charcoal-800">{complaint?.category.replace(/_/g, ' ')}</strong></span>
              <span className="text-bridge-charcoal-300">•</span>
              <span>Ward: <strong className="text-bridge-charcoal-800">{complaint?.locationArea}</strong></span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {complaint && (
              <Badge variant={getStatusBadgeVariant(complaint.status)} size="md">
                {complaint.status}
              </Badge>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-bridge-charcoal-400 hover:text-bridge-charcoal-700 hover:bg-bridge-almond-100 active:scale-95 rounded-lg transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-gold-500"
              aria-label="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 flex-1">
          {isLoading ? (
            <div className="py-24 flex flex-col items-center justify-center text-center space-y-3">
              <Loader2 className="w-8 h-8 text-bridge-gold-600 animate-spin" />
              <p className="text-sm text-bridge-charcoal-700 font-medium">
                Retrieving complaint dossier, evidence, and verification ledger...
              </p>
              <span className="text-xs text-bridge-charcoal-400 font-mono">
                Query ID: {complaintId}
              </span>
            </div>
          ) : errorMsg || !complaint ? (
            <div className="p-5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                Error Retrieving Complaint Dossier
              </div>
              <p className="text-xs leading-relaxed text-rose-700">
                {errorMsg || 'Complaint record could not be found or is unavailable.'}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRetry}
                className="text-xs"
              >
                Retry Request
              </Button>
            </div>
          ) : (
            <>
              {/* STATUS & CONSOLIDATION SUMMARY HERO */}
              <div className="bg-white border border-bridge-almond-200 rounded-xl p-4 shadow-civic-sm space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-bridge-gold-600 shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-wider text-bridge-charcoal-600">
                      Lifecycle Stage:
                    </span>
                    <span className="font-bold text-xs text-bridge-charcoal-900">
                      {complaint.status}
                    </span>
                  </div>
                  {complaint.duplicateClusterId && (
                    <span className="text-[11px] font-mono font-semibold bg-bridge-almond-100 text-bridge-charcoal-700 px-2 py-0.5 rounded border border-bridge-almond-200">
                      Cluster: {complaint.duplicateClusterId}
                    </span>
                  )}
                </div>
                <p className="text-xs text-bridge-charcoal-600 leading-relaxed bg-bridge-almond-50/60 p-2.5 rounded-lg border border-bridge-almond-200">
                  {getStatusDescription(complaint.status)}
                </p>

                {/* Primary Complaint Link if Consolidated */}
                {complaint.primaryComplaintId && (
                  <div className="p-3 bg-bridge-gold-50/70 border border-bridge-gold-200 rounded-lg flex items-center justify-between text-xs text-bridge-gold-950">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-bridge-gold-600 shrink-0" />
                      <span>
                        Consolidated into Primary Ticket:{' '}
                        <strong className="font-mono text-bridge-gold-900">#{complaint.primaryComplaintId}</strong>
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-bridge-gold-800 bg-white px-2 py-0.5 rounded border border-bridge-gold-200">
                      Merged Secondary
                    </span>
                  </div>
                )}
              </div>

              {/* SECTION 1: CITIZEN STATEMENT & METADATA OVERVIEW */}
              <div className="bg-white border border-bridge-almond-200 rounded-xl p-5 shadow-civic-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-bridge-almond-100">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-bridge-gold-600" />
                    <h3 className="text-sm font-semibold text-bridge-charcoal-800">
                      Citizen Dossier & Grievance Particulars
                    </h3>
                  </div>
                  <span className="text-[11px] font-semibold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    Confidential Municipal Record
                  </span>
                </div>

                {/* Citizen Contact Grid */}
                <div data-test-id="citizen-info" className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-bridge-almond-50/60 p-3 rounded-lg border border-bridge-almond-200">
                  <div>
                    <span className="text-bridge-charcoal-400 block text-[11px]">Citizen Name</span>
                    <span className="font-semibold text-bridge-charcoal-800">
                      {detail?.citizen?.name || 'Registered Citizen'}
                    </span>
                  </div>
                  <div>
                    <span className="text-bridge-charcoal-400 block text-[11px]">Contact Email</span>
                    <span className="font-mono text-bridge-charcoal-800 truncate block">
                      {detail?.citizen?.email || 'Confidential'}
                    </span>
                  </div>
                  <div>
                    <span className="text-bridge-charcoal-400 block text-[11px]">Registered Ward</span>
                    <span className="font-medium text-bridge-charcoal-800">
                      {detail?.citizen?.ward || complaint.locationArea}
                    </span>
                  </div>
                </div>

                {/* Structured Metadata Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-bridge-almond-50/60 p-3 rounded-lg border border-bridge-almond-200 text-bridge-charcoal-700">
                  <div>
                    <span className="text-bridge-charcoal-400 block text-[11px] flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-bridge-gold-600" />
                      Observed Date
                    </span>
                    <span className="font-medium text-bridge-charcoal-800">{complaint.observedDate}</span>
                  </div>

                  <div>
                    <span className="text-bridge-charcoal-400 block text-[11px] flex items-center gap-1">
                      <Clock className="w-3 h-3 text-bridge-gold-600" />
                      Reported At
                    </span>
                    <span className="font-medium text-bridge-charcoal-800 text-[11px]">
                      {new Date(complaint.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div>
                    <span className="text-bridge-charcoal-400 block text-[11px] flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-bridge-gold-600" />
                      Department
                    </span>
                    <span className="font-medium text-bridge-charcoal-800 truncate block">
                      {complaint.assignedDepartment || 'Routing Pending'}
                    </span>
                  </div>

                  <div>
                    <span className="text-bridge-charcoal-400 block text-[11px] flex items-center gap-1">
                      <Compass className="w-3 h-3 text-bridge-gold-600" />
                      Coordinates
                    </span>
                    <span className="font-mono text-bridge-charcoal-800 text-[11px]">
                      {complaint.latitude && complaint.longitude
                        ? `${complaint.latitude.toFixed(4)}, ${complaint.longitude.toFixed(4)}`
                        : 'Area Only'}
                    </span>
                  </div>
                </div>

                {/* Geographic Address */}
                <div className="text-xs flex items-start gap-2 text-bridge-charcoal-600 bg-bridge-almond-50/60 p-2.5 rounded-lg border border-bridge-almond-200">
                  <MapPin className="w-4 h-4 text-bridge-gold-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-bridge-charcoal-800">
                      {complaint.locationArea}
                    </span>
                    {complaint.addressText && (
                      <span className="text-bridge-charcoal-600"> — {complaint.addressText}</span>
                    )}
                  </div>
                </div>

                {/* Submitted Description Statement */}
                <div>
                  <span className="text-xs font-semibold text-bridge-charcoal-700 block mb-1">
                    Submitted Grievance Description:
                  </span>
                  <div className="p-3 bg-bridge-almond-50/60 rounded-lg border border-bridge-almond-200 text-bridge-charcoal-800 text-xs leading-relaxed whitespace-pre-wrap font-normal">
                    {complaint.description}
                  </div>
                </div>
              </div>

              {/* ROUTING & JURISDICTION DOSSIER */}
              <RoutingDecisionCard
                complaint={complaint}
                currentOfficer={currentOfficer}
                onRerouted={(updated) => {
                  setDetail((prev) => (prev ? { ...prev, complaint: updated } : null));
                  onUpdated();
                }}
              />

              {/* SECTION 2: STRUCTURED EVIDENCE REVIEW & FORENSICS (Rule 7 Compliance) */}
              <div className="bg-white border border-bridge-almond-200 rounded-xl p-5 shadow-civic-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-bridge-almond-100">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-bridge-gold-600" />
                    <h3 className="text-sm font-semibold text-bridge-charcoal-800">
                      Evidence Dossier & Forensics
                    </h3>
                  </div>
                  {complaint.hasImage ? (
                    <Badge variant="info" size="sm">
                      Visual Evidence Attached
                    </Badge>
                  ) : (
                    <Badge variant="neutral" size="sm">
                      No Photo Evidence
                    </Badge>
                  )}
                </div>

                {complaint.hasImage ? (
                  <div className="space-y-4">
                    {/* Visual Evidence Preview with Expand Button */}
                    <div className="relative group bg-bridge-almond-100 rounded-xl overflow-hidden border border-bridge-almond-200">
                      <AuthenticatedEvidenceImage
                        complaintId={complaint.id}
                        className="w-full h-64 sm:h-72 object-cover"
                        alt={`Visual evidence for ${complaint.id}`}
                      />
                      <button
                        type="button"
                        onClick={() => setIsImageModalOpen(true)}
                        className="absolute bottom-3 right-3 bg-bridge-charcoal-900/80 hover:bg-bridge-charcoal-900 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 backdrop-blur-xs transition shadow-civic-sm cursor-pointer"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>Enlarge Evidence</span>
                      </button>
                    </div>

                    {/* CV Evidence Inspection Panel (Deterministic Classical Computer Vision) */}
                    <CVEvidenceInspectionPanel complaint={complaint} />
                  </div>
                ) : (
                  /* Clean Structured Empty State */
                  <div className="bg-bridge-almond-50/50 border border-dashed border-bridge-almond-300 rounded-xl p-6 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-bridge-almond-100 border border-bridge-almond-200 flex items-center justify-center mx-auto text-bridge-charcoal-400">
                      <ImageOff className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-bridge-charcoal-800 text-xs">
                        No Photographic Evidence Attached
                      </h4>
                      <p className="text-xs text-bridge-charcoal-500 max-w-md mx-auto leading-relaxed">
                        This grievance was lodged as a textual statement without image files.
                        Prior to issuing contractor work orders, on-site physical survey by ward engineering staff is advised.
                      </p>
                    </div>

                    <div className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-bridge-almond-200 text-[11px] text-bridge-charcoal-600">
                      <MapPin className="w-3.5 h-3.5 text-bridge-gold-600" />
                      <span>Physical site verification required for ward dispatch</span>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 3: EXPLAINABLE AI VERIFICATION LEDGER (Rule 8 Compliance) */}
              {verification ? (
                <div className="bg-white border border-bridge-almond-200 rounded-xl p-5 shadow-civic-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-bridge-almond-100">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-bridge-gold-600" />
                      <h3 className="text-sm font-semibold text-bridge-charcoal-800">
                        Explainable Verification Signals
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getDuplicateRiskBadgeVariant(verification.duplicateRisk)} size="sm">
                        {verification.duplicateRisk} Duplicate Risk
                      </Badge>
                      <Badge variant={verification.outcome === 'VERIFIED_LEGITIMATE' ? 'verified' : 'review'} size="sm">
                        {verification.outcome.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                  </div>

                  {/* Signals & Uncertainties Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {/* Corroborating Signals */}
                    <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-3.5 space-y-2">
                      <span className="font-bold text-emerald-950 block flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Corroborating Signals ({verification.signals?.length || 0})
                      </span>
                      <ul className="space-y-1.5 text-[11px] text-emerald-900">
                        {verification.signals?.map((sig, idx) => (
                          <li key={idx} className="flex items-start gap-1.5 leading-relaxed">
                            <span className="text-emerald-600 font-bold shrink-0">•</span>
                            <span>{sig}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Limitations & Uncertainties */}
                    <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3.5 space-y-2">
                      <span className="font-bold text-amber-950 block flex items-center gap-1.5">
                        <HelpCircle className="w-4 h-4 text-amber-600" />
                        Limitations & Uncertainties ({verification.limitations?.length || 0})
                      </span>
                      <ul className="space-y-1.5 text-[11px] text-amber-900">
                        {verification.limitations?.map((lim, idx) => (
                          <li key={idx} className="flex items-start gap-1.5 leading-relaxed">
                            <span className="text-amber-600 font-bold shrink-0">•</span>
                            <span>{lim}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Recommended Next Protocol */}
                  <div className="p-3.5 bg-bridge-gold-50/80 border border-bridge-gold-200 rounded-xl text-xs text-bridge-gold-950">
                    <strong className="font-bold text-bridge-gold-950 block mb-0.5">
                      Recommended Officer Protocol:
                    </strong>
                    <span className="leading-relaxed">{verification.recommendedAction}</span>
                  </div>
                </div>
              ) : (
                /* Verification Pending / Empty State */
                <div className="bg-white border border-bridge-almond-200 rounded-xl p-5 shadow-civic-sm text-center text-xs text-bridge-charcoal-500">
                  Verification signals are being computed for this intake submission.
                </div>
              )}

              {/* SECTION: OPERATIONAL SLA & DELAY-RISK INTELLIGENCE (ML-2) */}
              {complaint.delayRisk && (
                <div className="bg-white border border-bridge-almond-200 rounded-xl p-5 shadow-civic-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-bridge-almond-100">
                    <div className="flex items-center gap-2">
                      <Timer className="w-4 h-4 text-bridge-gold-600" />
                      <h3 className="text-sm font-semibold text-bridge-charcoal-800">
                        Operational SLA &amp; Delay-Risk Intelligence
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                          complaint.delayRisk.slaStatus === 'BREACHED'
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : complaint.delayRisk.slaStatus === 'AT_RISK'
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        }`}
                      >
                        SLA: {complaint.delayRisk.slaStatus.replace(/_/g, ' ')}
                      </span>
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                          complaint.delayRisk.riskLevel === 'BREACHED'
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : complaint.delayRisk.riskLevel === 'HIGH'
                            ? 'bg-orange-100 text-orange-900 border-orange-300'
                            : complaint.delayRisk.riskLevel === 'MEDIUM'
                            ? 'bg-amber-50 text-amber-800 border-amber-300'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        }`}
                      >
                        {complaint.delayRisk.riskLevel} DELAY RISK
                      </span>
                    </div>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-bridge-almond-50/60 p-3 rounded-lg border border-bridge-almond-200">
                    <div>
                      <span className="text-bridge-charcoal-400 block text-[11px]">SLA Benchmark</span>
                      <span className="font-semibold text-bridge-charcoal-800">
                        {complaint.delayRisk.slaTargetHours} hours
                      </span>
                    </div>
                    <div>
                      <span className="text-bridge-charcoal-400 block text-[11px]">Elapsed Duration</span>
                      <span className="font-semibold text-bridge-charcoal-800">
                        {complaint.delayRisk.elapsedHours} hours
                      </span>
                    </div>
                    <div>
                      <span className="text-bridge-charcoal-400 block text-[11px]">Turnaround Window</span>
                      <span
                        className={`font-semibold ${
                          complaint.delayRisk.remainingHours <= 0
                            ? 'text-rose-700'
                            : complaint.delayRisk.remainingHours <= complaint.delayRisk.slaTargetHours * 0.25
                            ? 'text-amber-700'
                            : 'text-bridge-charcoal-800'
                        }`}
                      >
                        {complaint.delayRisk.remainingHours > 0
                          ? `${complaint.delayRisk.remainingHours}h remaining`
                          : `${Math.abs(complaint.delayRisk.remainingHours)}h overdue`}
                      </span>
                    </div>
                    <div>
                      <span className="text-bridge-charcoal-400 block text-[11px]">Risk Index Score</span>
                      <span className="font-mono font-bold text-bridge-charcoal-800">
                        {complaint.delayRisk.riskScore} / 100
                      </span>
                    </div>
                  </div>

                  {/* SLA Consumption Meter */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-bridge-charcoal-600 font-medium flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-bridge-gold-600" />
                        SLA Window Consumption:
                      </span>
                      <span className="font-mono text-bridge-charcoal-700 font-semibold">
                        {Math.round((complaint.delayRisk.elapsedHours / complaint.delayRisk.slaTargetHours) * 100)}%
                      </span>
                    </div>
                    <div className="w-full bg-bridge-almond-200 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-2.5 rounded-full transition-all duration-300 ${
                          complaint.delayRisk.slaStatus === 'BREACHED'
                            ? 'bg-rose-500'
                            : complaint.delayRisk.slaStatus === 'AT_RISK'
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round((complaint.delayRisk.elapsedHours / complaint.delayRisk.slaTargetHours) * 100)
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Contributing Signals & Recommended Action */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {/* Contributing Factors */}
                    <div className="bg-bridge-almond-50/70 border border-bridge-almond-200 rounded-xl p-3.5 space-y-2">
                      <span className="font-bold text-bridge-charcoal-900 block flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-bridge-gold-600" />
                        Contributing Delay Factors ({complaint.delayRisk.contributingFactors.length})
                      </span>
                      <ul className="space-y-1.5 text-[11px] text-bridge-charcoal-700">
                        {complaint.delayRisk.contributingFactors.map((factor, idx) => (
                          <li key={idx} className="flex items-start gap-1.5 leading-relaxed">
                            <span className="text-bridge-gold-700 font-bold shrink-0">•</span>
                            <span>{factor}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Protocol Action */}
                    <div className="bg-bridge-gold-50/70 border border-bridge-gold-200 rounded-xl p-3.5 space-y-2 flex flex-col justify-between">
                      <div>
                        <span className="font-bold text-bridge-gold-950 block flex items-center gap-1.5 mb-1.5">
                          <CheckCircle2 className="w-4 h-4 text-bridge-gold-700" />
                          Recommended Protocol:
                        </span>
                        <p className="text-[11px] text-bridge-gold-900 leading-relaxed">
                          {complaint.delayRisk.recommendedAction}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-bridge-gold-200/60 text-[10px] text-bridge-charcoal-500 font-mono">
                        Model: {complaint.delayRisk.modelVersion} (Heuristic Baseline)
                      </div>
                    </div>
                  </div>

                  {/* Rule 3 & 8 Transparent Limitations Notice */}
                  {complaint.delayRisk.limitations && complaint.delayRisk.limitations.length > 0 && (
                    <div className="bg-bridge-almond-50/50 border border-bridge-almond-200 rounded-xl p-3 text-[11px] text-bridge-charcoal-500 space-y-1">
                      <span className="font-semibold text-bridge-charcoal-700 block">
                        Transparency &amp; ML Model Governance Notice:
                      </span>
                      <p className="leading-relaxed">
                        {complaint.delayRisk.limitations.join(' ')}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* SECTION 4: DUPLICATE CLUSTER INSPECTOR */}
              <div className="bg-white border border-bridge-almond-200 rounded-xl p-5 shadow-civic-sm">
                <DuplicateClusterInspector
                  currentComplaint={complaint}
                  matchedCandidates={detail?.matchedCandidates || []}
                  onConfirmDuplicate={handleConfirmDuplicate}
                  onMarkDistinct={handleMarkDistinct}
                  onResolved={() => {
                    handleRetry();
                    onUpdated();
                  }}
                />
              </div>

              {/* SECTION 4B: LIFECYCLE EVENT LEDGER & DORMANCY MONITORING */}
              <div className="bg-white border border-bridge-almond-200 rounded-xl p-5 shadow-civic-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-bridge-almond-100">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-bridge-gold-600" />
                    <h3 className="text-sm font-semibold text-bridge-charcoal-800">
                      Lifecycle Event Ledger &amp; Dormancy Monitoring
                    </h3>
                  </div>
                  {dossierLoading && (
                    <div className="flex items-center gap-1.5 text-xs text-bridge-charcoal-500">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-bridge-gold-600" />
                      <span>Syncing activity...</span>
                    </div>
                  )}
                </div>

                {dossier ? (
                  <div className="space-y-6">
                    <FollowThroughPanel
                      sla={dossier.sla}
                      inactivity={dossier.inactivity}
                      delayRisk={dossier.delayRisk || complaint.delayRisk}
                      isOfficer={true}
                    />

                    <div className="pt-2">
                      <h4 className="text-xs font-bold text-bridge-charcoal-700 uppercase tracking-wider mb-3">
                        Chronological Audit Trail &amp; Activity Events
                      </h4>
                      <ComplaintTimeline
                        timeline={dossier.timeline}
                        isCitizenView={false}
                      />
                    </div>
                  </div>
                ) : dossierLoading ? (
                  <div className="py-8 text-center text-xs text-bridge-charcoal-500">
                    <Loader2 className="w-5 h-5 animate-spin text-bridge-gold-600 mx-auto mb-2" />
                    Loading follow-through activity ledger...
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-bridge-charcoal-500 bg-bridge-almond-50/50 border border-dashed border-bridge-almond-200 rounded-xl">
                    No activity records logged yet for this grievance.
                  </div>
                )}
              </div>

              {/* SECTION 5: REVIEW ACTIONS & LIFECYCLE COMMIT */}
              <ReviewActionPanel
                complaint={complaint}
                onUpdate={handleUpdateReview}
                isUpdating={isUpdating}
                currentOfficer={currentOfficer}
                initialNotePreFill={notePreFill}
              />
            </>
          )}
        </div>
      </div>

      {/* Enlarged Photo Modal */}
      {isImageModalOpen && complaint && (
        <div className="fixed inset-0 z-60 bg-bridge-charcoal-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="relative max-w-4xl w-full bg-white rounded-2xl overflow-hidden shadow-civic-lg border border-bridge-almond-200 flex flex-col max-h-[90vh]">
            <div className="bg-bridge-almond-50 px-5 py-3 border-b border-bridge-almond-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-bridge-gold-600" />
                <span className="font-bold text-xs text-bridge-charcoal-900">
                  Evidence Inspection: #{complaint.id}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsImageModalOpen(false)}
                className="text-bridge-charcoal-400 hover:text-bridge-charcoal-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-bridge-charcoal-900 flex items-center justify-center overflow-auto max-h-[70vh]">
              <AuthenticatedEvidenceImage
                complaintId={complaint.id}
                className="max-h-[65vh] w-auto object-contain rounded-lg shadow-civic-md"
                alt={`Enlarged evidence for ${complaint.id}`}
                dataTestId="enlarged-image"
              />
            </div>

            <div className="p-4 bg-white border-t border-bridge-almond-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="font-mono text-[11px] text-bridge-charcoal-500">
                {complaint.evidenceMetadata?.filename || 'Attachment'} •{' '}
                {complaint.evidenceMetadata?.sizeBytes
                  ? `${Math.round(complaint.evidenceMetadata.sizeBytes / 1024)} KB`
                  : 'Image file'}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsImageModalOpen(false)}
              >
                Close Fullscreen
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
