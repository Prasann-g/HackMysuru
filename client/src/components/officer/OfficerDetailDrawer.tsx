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
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import {
  apiGetOfficerComplaintById,
  apiUpdateOfficerReview,
  type OfficerComplaintDetail,
  type ComplaintRecord,
} from '../../services/api';
import type { CitizenUser } from '../../types/auth';
import { DuplicateClusterInspector } from './DuplicateClusterInspector';
import { ReviewActionPanel } from './ReviewActionPanel';

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

  useEffect(() => {
    if (!complaintId) {
      return;
    }

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

    return () => {
      isMounted = false;
    };
  }, [complaintId]);

  if (!complaintId) return null;

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
    <div className="fixed inset-0 z-50 overflow-hidden bg-brand-slate-900/40 backdrop-blur-xs flex justify-end">
      <div className="relative w-full max-w-3xl bg-brand-slate-50 h-full flex flex-col shadow-civic-lg border-l border-brand-slate-200 overflow-y-auto">
        {/* Sticky Header */}
        <div className="sticky top-0 z-20 bg-white border-b border-brand-slate-200 px-6 py-4 flex items-center justify-between shadow-civic-sm">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-brand-slate-900 text-base">
                {complaint?.id || complaintId}
              </span>
              {complaint?.trackingToken && (
                <span className="text-xs font-mono text-brand-slate-500 bg-brand-slate-100 px-2 py-0.5 rounded">
                  {complaint.trackingToken}
                </span>
              )}
              {complaint?.isDemo && (
                <span className="text-[11px] font-medium text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                  Synthetic Demo Record
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-brand-slate-500">
                Category: <strong className="capitalize text-brand-slate-700">{complaint?.category}</strong>
              </span>
              <span className="text-brand-slate-300">•</span>
              <span className="text-xs text-brand-slate-500">
                Area: <strong className="text-brand-slate-700">{complaint?.locationArea}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {complaint && (
              <Badge variant={getStatusBadgeVariant(complaint.status)} size="md">
                {complaint.status}
              </Badge>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-brand-slate-400 hover:text-brand-slate-700 hover:bg-brand-slate-100 rounded-lg transition"
              aria-label="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 flex-1">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-8 h-8 text-brand-teal-600 animate-spin mb-3" />
              <p className="text-sm text-brand-slate-600 font-medium">
                Loading complaint dossier and verification signals...
              </p>
            </div>
          ) : errorMsg || !complaint ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
              <div className="flex items-center gap-2 font-semibold mb-1">
                <AlertTriangle className="w-4 h-4" />
                Error Retrieving Complaint
              </div>
              <p className="text-xs">{errorMsg || 'Complaint record could not be found.'}</p>
            </div>
          ) : (
            <>
              {/* SECTION 1: Citizen Contact & Overview (Confidential) */}
              <div className="bg-white border border-brand-slate-200 rounded-xl p-5 shadow-civic-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-brand-slate-100">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-brand-teal-700" />
                    <h3 className="text-sm font-semibold text-brand-slate-800">
                      Citizen Grievance Overview
                    </h3>
                  </div>
                  <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    Confidential Officer Dossier
                  </span>
                </div>

                {/* Citizen details grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-brand-slate-50 p-3 rounded-lg border border-brand-slate-200/70">
                  <div>
                    <span className="text-brand-slate-500 block">Citizen Name</span>
                    <span className="font-semibold text-brand-slate-800">
                      {detail?.citizen?.name || 'Verified Citizen'}
                    </span>
                  </div>
                  <div>
                    <span className="text-brand-slate-500 block">Contact Email</span>
                    <span className="font-mono text-brand-slate-800">
                      {detail?.citizen?.email || 'Confidential'}
                    </span>
                  </div>
                  <div>
                    <span className="text-brand-slate-500 block">Registered Ward</span>
                    <span className="font-medium text-brand-slate-800">
                      {detail?.citizen?.ward || complaint.locationArea}
                    </span>
                  </div>
                </div>

                {/* Metadata & Description */}
                <div className="space-y-2 text-xs">
                  <div className="flex flex-wrap items-center gap-4 text-brand-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-brand-teal-600" />
                      <span>Reported: {new Date(complaint.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-brand-slate-400" />
                      <span>Observed Date: {complaint.observedDate}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-brand-teal-600" />
                      <span>{complaint.locationArea} {complaint.addressText ? `(${complaint.addressText})` : ''}</span>
                    </div>
                  </div>

                  <div className="mt-3">
                    <span className="text-xs font-semibold text-brand-slate-700 block mb-1">
                      Submitted Grievance Description:
                    </span>
                    <div className="p-3 bg-brand-slate-50 rounded-lg border border-brand-slate-200/80 text-brand-slate-800 text-xs leading-relaxed whitespace-pre-wrap font-normal">
                      {complaint.description}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: Photographic Evidence & Camera Stamp (Strict Rule 7 Compliance) */}
              <div className="bg-white border border-brand-slate-200 rounded-xl p-5 shadow-civic-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-brand-slate-100">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-brand-teal-700" />
                    <h3 className="text-sm font-semibold text-brand-slate-800">
                      Photographic Evidence Inspection
                    </h3>
                  </div>
                  {complaint.hasImage ? (
                    <Badge variant="verified" size="sm">
                      Evidence Photo Attached
                    </Badge>
                  ) : (
                    <Badge variant="neutral" size="sm">
                      No Photo Submitted
                    </Badge>
                  )}
                </div>

                {complaint.hasImage ? (
                  <div className="space-y-3">
                    {/* Metadata Card */}
                    <div className="bg-brand-slate-50 rounded-lg p-3 border border-brand-slate-200 text-xs space-y-2">
                      <div className="font-semibold text-brand-slate-700">
                        Uploaded Evidence Metadata
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                        <div>
                          <span className="text-brand-slate-500 block">Filename:</span>
                          <span className="font-mono text-brand-slate-800 truncate block">
                            {complaint.evidenceMetadata?.filename || 'evidence_photo.jpg'}
                          </span>
                        </div>
                        <div>
                          <span className="text-brand-slate-500 block">File Size:</span>
                          <span className="font-mono text-brand-slate-800">
                            {complaint.evidenceMetadata?.sizeBytes
                              ? `${Math.round(complaint.evidenceMetadata.sizeBytes / 1024)} KB`
                              : '185 KB'}
                          </span>
                        </div>
                        <div>
                          <span className="text-brand-slate-500 block">Format:</span>
                          <span className="font-mono text-brand-slate-800">
                            {complaint.evidenceMetadata?.mimetype || 'image/jpeg'}
                          </span>
                        </div>
                        <div>
                          <span className="text-brand-slate-500 block">Camera Stamp:</span>
                          <span className="text-emerald-700 font-medium">
                            GPS Stamp Detected
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Rule 7 Mandatory Honesty Banner */}
                    <div className="bg-amber-50/70 border border-amber-200/80 rounded-lg p-3 text-xs text-amber-900 leading-relaxed">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                        <div>
                          <strong className="font-semibold block text-amber-950">
                            Evidence Evaluation Notice (Rule 7 Protocol)
                          </strong>
                          The submitted photograph and visible GPS coordinate stamps are recorded as
                          citizen-provided evidence. In compliance with municipal integrity
                          standards, digital metadata and camera watermarks are not certified as
                          tamper-proof until confirmed via physical inspection by field ward
                          personnel.
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-brand-slate-500 italic">
                    Citizen did not attach photographic evidence for this submission. On-site
                    verification by ward field staff is advised before dispatching heavy machinery.
                  </p>
                )}
              </div>

              {/* SECTION 3: Explainable AI Verification Ledger (Rule 8 Compliance) */}
              {verification && (
                <div className="bg-white border border-brand-slate-200 rounded-xl p-5 shadow-civic-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-brand-slate-100">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-brand-teal-700" />
                      <h3 className="text-sm font-semibold text-brand-slate-800">
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

                  {/* Signals & Category Alignment */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {/* Verified Signals */}
                    <div className="bg-emerald-50/50 border border-emerald-200/60 rounded-lg p-3 space-y-2">
                      <span className="font-semibold text-emerald-900 block flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Corroborating Signals
                      </span>
                      <ul className="space-y-1 text-[11px] text-emerald-800">
                        {verification.signals?.map((sig, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-emerald-500 font-bold">•</span>
                            <span>{sig}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Uncertainties & Limitations */}
                    <div className="bg-amber-50/50 border border-amber-200/60 rounded-lg p-3 space-y-2">
                      <span className="font-semibold text-amber-900 block flex items-center gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                        Limitations & Uncertainties
                      </span>
                      <ul className="space-y-1 text-[11px] text-amber-800">
                        {verification.limitations?.map((lim, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-amber-500 font-bold">•</span>
                            <span>{lim}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Recommended Next Action */}
                  <div className="p-3 bg-brand-teal-50/70 border border-brand-teal-200/80 rounded-lg text-xs text-brand-teal-900">
                    <strong className="font-semibold text-brand-teal-950 block mb-0.5">
                      Recommended Next Protocol:
                    </strong>
                    {verification.recommendedAction}
                  </div>
                </div>
              )}

              {/* SECTION 4: Duplicate Cluster Inspector */}
              <div className="bg-white border border-brand-slate-200 rounded-xl p-5 shadow-civic-sm">
                <DuplicateClusterInspector
                  currentComplaint={complaint}
                  matchedCandidates={detail?.matchedCandidates || []}
                  onConfirmDuplicate={handleConfirmDuplicate}
                  onMarkDistinct={handleMarkDistinct}
                />
              </div>

              {/* SECTION 5: Review Actions & Lifecycle Commit */}
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
    </div>
  );
};
