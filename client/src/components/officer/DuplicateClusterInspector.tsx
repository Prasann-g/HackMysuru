import React, { useState, useEffect, useCallback } from 'react';
import {
  Copy,
  Check,
  CheckCircle2,
  Split,
  Camera,
  Layers,
  ImageOff,
  Tag,
  HelpCircle,
  AlertTriangle,
  AlertCircle,
  ShieldCheck,
  History,
  Loader2,
  Link,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { AuthenticatedEvidenceImage } from '../common/AuthenticatedEvidenceImage';
import {
  apiResolveDuplicateCluster,
  apiGetComplaintDuplicateAudits,
  type ComplaintRecord,
  type ComplaintResolutionAuditRecord,
  type ResolutionActionType,
} from '../../services/api';

interface DuplicateClusterInspectorProps {
  currentComplaint: ComplaintRecord;
  matchedCandidates: ComplaintRecord[];
  onConfirmDuplicate?: (candidate: ComplaintRecord) => void;
  onMarkDistinct?: (candidate: ComplaintRecord) => void;
  onResolved?: () => void;
}

export const DuplicateClusterInspector: React.FC<DuplicateClusterInspectorProps> = ({
  currentComplaint,
  matchedCandidates,
  onConfirmDuplicate,
  onMarkDistinct,
  onResolved,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<{
    actionType: ResolutionActionType;
    candidate: ComplaintRecord;
  } | null>(null);
  const [decisionNotes, setDecisionNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [auditRecords, setAuditRecords] = useState<ComplaintResolutionAuditRecord[]>([]);
  const [isLoadingAudits, setIsLoadingAudits] = useState<boolean>(false);
  const [showAuditHistory, setShowAuditHistory] = useState<boolean>(false);

  const matchesInfo = currentComplaint.verificationResult?.matches || [];

  const fetchAudits = useCallback(() => {
    setIsLoadingAudits(true);
    apiGetComplaintDuplicateAudits(currentComplaint.id)
      .then((records) => {
        setAuditRecords(records);
        setIsLoadingAudits(false);
      })
      .catch(() => {
        setAuditRecords([]);
        setIsLoadingAudits(false);
      });
  }, [currentComplaint.id]);

  useEffect(() => {
    fetchAudits();
  }, [fetchAudits]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).catch(() => {
      // ignore clipboard error
    });
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleInitiateAction = (actionType: ResolutionActionType, candidate: ComplaintRecord) => {
    setActionError(null);
    setActionSuccess(null);
    if (actionType === 'MERGE_DUPLICATES') {
      setDecisionNotes(
        `Site inspection and photographic review confirmed grievance #${candidate.id} and #${currentComplaint.id} describe the identical occurrence.`
      );
      onConfirmDuplicate?.(candidate);
    } else if (actionType === 'MARK_DISTINCT') {
      setDecisionNotes(
        `Field inspection verified complaint #${currentComplaint.id} is a distinct occurrence from #${candidate.id} despite geographic proximity.`
      );
      onMarkDistinct?.(candidate);
    } else if (actionType === 'MARK_RELATED') {
      setDecisionNotes(
        `Grievance #${currentComplaint.id} and #${candidate.id} are related incidents in the same locality, linked for coordinated municipal field crew dispatch.`
      );
    }
    setActiveAction({ actionType, candidate });
  };

  const handleExecuteResolution = async (
    actionType: ResolutionActionType,
    candidate: ComplaintRecord
  ) => {
    if (decisionNotes.trim().length < 5) {
      setActionError(
        'Decision notes must be at least 5 characters long explaining the adjudication rationale.'
      );
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    try {
      const res = await apiResolveDuplicateCluster(currentComplaint.id, {
        actionType,
        targetComplaintId: candidate.id,
        decisionNotes: decisionNotes.trim(),
      });
      setActionSuccess(res.message);
      setActiveAction(null);
      fetchAudits();
      if (onResolved) {
        onResolved();
      }
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to record duplicate resolution.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (matchedCandidates.length === 0) {
    return (
      <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-5 text-emerald-800">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <h4 className="font-semibold text-emerald-900 text-sm">
              No duplicate clusters require review.
            </h4>
            <p className="text-xs text-emerald-700 leading-relaxed">
              Deterministic similarity indexing, geographic proximity, and perceptual image hashing
              found no overlapping complaints in the municipal database for this locality and category.
              This appears to be an isolated, distinct grievance.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Determine overall cluster ID if existing, otherwise generate cluster grouping reference
  const clusterIdentifier =
    currentComplaint.duplicateClusterId ||
    matchedCandidates.find((c) => c.duplicateClusterId)?.duplicateClusterId ||
    `CLUSTER-${currentComplaint.id}`;

  return (
    <div className="space-y-5">
      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="text-emerald-600 hover:text-emerald-800 p-1 text-sm font-bold leading-none cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {/* Cluster Overview Header */}
      <div className="bg-bridge-almond-50/70 border border-bridge-almond-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-bridge-gold-600 shrink-0" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-bridge-charcoal-500">
                  Cluster Identification:
                </span>
                <span className="font-mono text-xs font-bold text-bridge-gold-900 bg-bridge-gold-50 border border-bridge-gold-200 px-2 py-0.5 rounded">
                  {clusterIdentifier}
                </span>
                <Badge variant="review" size="sm">
                  {matchedCandidates.length + 1} Grievances in Cluster
                </Badge>
              </div>
              <p className="text-xs text-bridge-charcoal-500 mt-0.5">
                Ward: <strong className="text-bridge-charcoal-700">{currentComplaint.locationArea}</strong> •
                Category: <strong className="capitalize text-bridge-charcoal-700">{currentComplaint.category.replace(/_/g, ' ')}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-bridge-charcoal-500">Evidence Integrity:</span>
            <span className="font-semibold text-bridge-charcoal-700">Non-destructive comparison</span>
          </div>
        </div>
      </div>

      {/* List of Matched Candidates in the Cluster */}
      <div className="space-y-5">
        {matchedCandidates.map((candidate) => {
          const matchMeta = matchesInfo.find(
            (m) => m.existingComplaintId === candidate.id
          );
          const similarityPct = matchMeta
            ? Math.round(matchMeta.jaccardSimilarity * 100)
            : null;
          const matchingPhrases = matchMeta?.matchingPhrases || [];

          const riskBadgeVariant =
            matchMeta?.riskLevel === 'HIGH'
              ? 'duplicate'
              : matchMeta?.riskLevel === 'MEDIUM'
              ? 'review'
              : 'info';

          return (
            <div
              key={candidate.id}
              className="bg-white border border-bridge-almond-200 rounded-xl p-5 shadow-civic-sm space-y-4"
            >
              {/* Card Sub-Header: Risk Assessment & Signals */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-bridge-almond-100">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={riskBadgeVariant} size="sm">
                    {matchMeta?.riskLevel || 'MEDIUM'} DUPLICATE OVERLAP
                  </Badge>

                  {/* Existing Adjudication Badges */}
                  {currentComplaint.primaryComplaintId === candidate.id && (
                    <Badge variant="duplicate" size="sm">
                      CONSOLIDATED AS DUPLICATE (MASTER #{candidate.id})
                    </Badge>
                  )}
                  {candidate.primaryComplaintId === currentComplaint.id && (
                    <Badge variant="verified" size="sm">
                      MASTER ANCHOR (CONSOLIDATED #{candidate.id})
                    </Badge>
                  )}
                  {(currentComplaint.resolutionAction === 'MARK_DISTINCT' || candidate.resolutionAction === 'MARK_DISTINCT') && (
                    <Badge variant="verified" size="sm">
                      VERIFIED DISTINCT
                    </Badge>
                  )}
                  {(currentComplaint.resolutionAction === 'MARK_RELATED' || candidate.resolutionAction === 'MARK_RELATED') &&
                    Boolean(currentComplaint.duplicateClusterId && currentComplaint.duplicateClusterId === candidate.duplicateClusterId) && (
                    <Badge variant="info" size="sm">
                      LINKED IN CLUSTER
                    </Badge>
                  )}

                  {similarityPct !== null && (
                    <span className="text-xs font-semibold text-bridge-charcoal-700 bg-bridge-almond-100 px-2.5 py-0.5 rounded-full">
                      {similarityPct}% Vocabulary Similarity
                    </span>
                  )}

                  {/* Image Match Status Indicators */}
                  {matchMeta?.imageMatch?.matchType === 'EXACT_IMAGE_REUSE' && (
                    <span className="text-xs font-semibold text-rose-800 bg-rose-100 border border-rose-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <Camera className="w-3.5 h-3.5 text-rose-600" />
                      Exact Image Reuse (SHA-256 Match)
                    </span>
                  )}

                  {matchMeta?.imageMatch?.matchType === 'LIKELY_VISUAL_SIMILARITY' && (
                    <span className="text-xs font-semibold text-amber-900 bg-amber-100 border border-amber-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <Camera className="w-3.5 h-3.5 text-amber-700" />
                      Perceptual dHash Match ({matchMeta.imageMatch.hammingDistance}/64)
                    </span>
                  )}

                  {!matchMeta?.imageMatch && currentComplaint.hasImage && candidate.hasImage && (
                    <span className="text-xs font-semibold text-bridge-gold-800 bg-bridge-gold-50 border border-bridge-gold-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <Camera className="w-3.5 h-3.5 text-bridge-gold-600" />
                      Both Have Independent Photos
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-bridge-charcoal-500">
                    Candidate: <strong>{candidate.id}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(candidate.id, `cand-${candidate.id}`)}
                    className="text-bridge-charcoal-400 hover:text-bridge-charcoal-700 p-1 rounded"
                    title="Copy Complaint ID"
                  >
                    {copiedId === `cand-${candidate.id}` ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Side-by-Side Comprehensive Comparison Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* 1. CURRENT COMPLAINT DOSSIER */}
                <div className="bg-bridge-almond-50/70 rounded-xl p-4 border border-bridge-almond-200 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-bridge-almond-200">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-bridge-gold-800 text-xs">
                        CURRENT COMPLAINT
                      </span>
                      <span className="font-mono text-bridge-charcoal-600">({currentComplaint.id})</span>
                    </div>
                    <Badge variant={currentComplaint.status === 'RESOLVED' ? 'verified' : 'review'} size="sm">
                      {currentComplaint.status}
                    </Badge>
                  </div>

                  {/* Metadata & Evidence Availability */}
                  <div className="space-y-1.5 text-[11px] text-bridge-charcoal-600">
                    <div className="flex items-center justify-between">
                      <span className="text-bridge-charcoal-400">Tracking Token:</span>
                      <span className="font-mono text-bridge-charcoal-800 font-medium">{currentComplaint.trackingToken}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-bridge-charcoal-400">Category:</span>
                      <span className="capitalize text-bridge-charcoal-800 font-medium">{currentComplaint.category.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-bridge-charcoal-400">Observed Date:</span>
                      <span className="text-bridge-charcoal-800 font-medium">{currentComplaint.observedDate}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-bridge-charcoal-400">Location Area:</span>
                      <span className="text-bridge-charcoal-800 font-medium">{currentComplaint.locationArea}</span>
                    </div>
                    {currentComplaint.addressText && (
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-bridge-charcoal-400 shrink-0">Street Address:</span>
                        <span className="text-bridge-charcoal-800 text-right truncate">{currentComplaint.addressText}</span>
                      </div>
                    )}
                  </div>

                  {/* Evidence Availability Indicator & Photo Preview */}
                  <div className="pt-2 border-t border-bridge-almond-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-bridge-charcoal-700 flex items-center gap-1">
                        <Camera className="w-3.5 h-3.5 text-bridge-gold-600" />
                        Photographic Evidence:
                      </span>
                      {currentComplaint.hasImage ? (
                        <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Photo Attached
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-bridge-charcoal-600 bg-bridge-almond-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <ImageOff className="w-3 h-3 text-bridge-charcoal-400" />
                          No Photo Provided
                        </span>
                      )}
                    </div>

                    {currentComplaint.hasImage ? (
                      <div className="rounded-lg overflow-hidden border border-bridge-almond-200 bg-white">
                        <AuthenticatedEvidenceImage
                          complaintId={currentComplaint.id}
                          className="w-full h-40 object-cover"
                          alt={`Evidence for ${currentComplaint.id}`}
                        />
                        <div className="p-2 text-[10px] font-mono text-bridge-charcoal-500 bg-bridge-almond-50 border-t border-bridge-almond-100 flex justify-between">
                          <span>{currentComplaint.evidenceMetadata?.filename || 'Visual Evidence'}</span>
                          <span>{currentComplaint.evidenceMetadata?.sizeBytes ? `${Math.round(currentComplaint.evidenceMetadata.sizeBytes / 1024)} KB` : 'Image'}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-white rounded-lg border border-dashed border-bridge-almond-200 text-center text-bridge-charcoal-400 text-[11px]">
                        Citizen reported without visual attachment.
                      </div>
                    )}
                  </div>

                  {/* Description Box */}
                  <div>
                    <span className="text-[11px] font-semibold text-bridge-charcoal-700 block mb-1">
                      Submitted Statement:
                    </span>
                    <p className="text-bridge-charcoal-800 bg-white p-3 rounded-lg border border-bridge-almond-200 leading-relaxed font-normal">
                      {currentComplaint.description}
                    </p>
                  </div>
                </div>

                {/* 2. CANDIDATE COMPLAINT DOSSIER */}
                <div className="bg-amber-50/40 rounded-xl p-4 border border-amber-200/80 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-amber-200/80">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-amber-950 text-xs">
                        EXISTING GRIEVANCE
                      </span>
                      <span className="font-mono text-amber-900">({candidate.id})</span>
                    </div>
                    <Badge variant={candidate.status === 'RESOLVED' || candidate.status === 'CLOSED' ? 'verified' : 'review'} size="sm">
                      {candidate.status}
                    </Badge>
                  </div>

                  {/* Metadata & Evidence Availability */}
                  <div className="space-y-1.5 text-[11px] text-bridge-charcoal-600">
                    <div className="flex items-center justify-between">
                      <span className="text-bridge-charcoal-400">Tracking Token:</span>
                      <span className="font-mono text-bridge-charcoal-800 font-medium">{candidate.trackingToken}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-bridge-charcoal-400">Category:</span>
                      <span className="capitalize text-bridge-charcoal-800 font-medium">{candidate.category.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-bridge-charcoal-400">Observed Date:</span>
                      <span className="text-bridge-charcoal-800 font-medium">{candidate.observedDate}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-bridge-charcoal-400">Location Area:</span>
                      <span className="text-bridge-charcoal-800 font-medium">{candidate.locationArea}</span>
                    </div>
                    {candidate.addressText && (
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-bridge-charcoal-400 shrink-0">Street Address:</span>
                        <span className="text-bridge-charcoal-800 text-right truncate">{candidate.addressText}</span>
                      </div>
                    )}
                  </div>

                  {/* Evidence Availability Indicator & Photo Preview */}
                  <div className="pt-2 border-t border-amber-200/80">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-amber-950 flex items-center gap-1">
                        <Camera className="w-3.5 h-3.5 text-amber-700" />
                        Photographic Evidence:
                      </span>
                      {candidate.hasImage ? (
                        <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Photo Attached
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-bridge-charcoal-600 bg-bridge-almond-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <ImageOff className="w-3 h-3 text-bridge-charcoal-400" />
                          No Photo Provided
                        </span>
                      )}
                    </div>

                    {candidate.hasImage ? (
                      <div className="rounded-lg overflow-hidden border border-amber-200 bg-white">
                        <AuthenticatedEvidenceImage
                          complaintId={candidate.id}
                          className="w-full h-40 object-cover"
                          alt={`Evidence for ${candidate.id}`}
                        />
                        <div className="p-2 text-[10px] font-mono text-bridge-charcoal-500 bg-amber-50/60 border-t border-amber-100 flex justify-between">
                          <span>{candidate.evidenceMetadata?.filename || 'Visual Evidence'}</span>
                          <span>{candidate.evidenceMetadata?.sizeBytes ? `${Math.round(candidate.evidenceMetadata.sizeBytes / 1024)} KB` : 'Image'}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-white rounded-lg border border-dashed border-amber-200 text-center text-bridge-charcoal-400 text-[11px]">
                        Citizen reported without visual attachment.
                      </div>
                    )}
                  </div>

                  {/* Description Box */}
                  <div>
                    <span className="text-[11px] font-semibold text-amber-950 block mb-1">
                      Submitted Statement:
                    </span>
                    <p className="text-bridge-charcoal-800 bg-white p-3 rounded-lg border border-amber-200 leading-relaxed font-normal">
                      {candidate.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Shared Overlapping Vocabulary Phrases */}
              {matchingPhrases.length > 0 && (
                <div className="bg-bridge-almond-50/70 p-3 rounded-xl border border-bridge-almond-200 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-bridge-charcoal-700">
                    <Tag className="w-3.5 h-3.5 text-bridge-gold-600" />
                    <span>Key Overlapping Deterministic Phrases ({matchingPhrases.length}):</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {matchingPhrases.map((phrase, idx) => (
                      <span
                        key={idx}
                        className="bg-amber-100 text-amber-900 border border-amber-200/80 px-2.5 py-0.5 rounded-md font-mono text-[11px]"
                      >
                        "{phrase}"
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Explainable Image Matching Forensic Card (when matchMeta.imageMatch exists) */}
              {matchMeta?.imageMatch && (
                <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Camera className="w-4 h-4 text-amber-700" />
                      <span className="text-xs font-bold text-amber-950">
                        Image Forensic Comparison Signal
                      </span>
                    </div>
                    <span className="text-[11px] font-mono font-medium text-amber-800 bg-white px-2 py-0.5 rounded border border-amber-200">
                      {matchMeta.imageMatch.matchType === 'EXACT_IMAGE_REUSE'
                        ? 'Identical SHA-256 Checksum Match'
                        : `Perceptual dHash Distance: ${matchMeta.imageMatch.hammingDistance}/64`}
                    </span>
                  </div>

                  <p className="text-xs text-amber-950 font-medium leading-relaxed bg-white/80 p-3 rounded-lg border border-amber-200/70">
                    {matchMeta.imageMatch.explanation}
                  </p>

                  <div className="text-[11px] text-amber-800 italic leading-relaxed flex items-start gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      Civic Integrity Note: Image hashes are deterministic evidence signals. Perceptual hashing measures gradient luminance patterns and is not a definitive proof of citizen deception or physical site state. Field inspection by ward officers remains mandatory before final decision.
                    </span>
                  </div>
                </div>
              )}

              {/* Action Buttons & Consequential Confirmation Flow */}
              {activeAction?.candidate.id === candidate.id ? (
                <div className="bg-bridge-almond-50 border border-bridge-gold-300 rounded-xl p-4 space-y-3 mt-3 animate-fadeIn">
                  <div className="flex items-center justify-between pb-2 border-b border-bridge-gold-200">
                    <span className="text-xs font-bold text-bridge-charcoal-900 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-bridge-gold-700" />
                      Confirm Adjudication: {activeAction.actionType.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[11px] font-mono text-bridge-charcoal-500">
                      Candidate #{candidate.id}
                    </span>
                  </div>

                  {activeAction.actionType === 'MERGE_DUPLICATES' && (
                    <div className="p-3 bg-amber-100/70 border border-amber-300 rounded-lg text-amber-900 text-xs flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <p className="font-semibold">Consequential Resolution Notice:</p>
                        <p className="text-[11px] leading-relaxed">
                          This will close grievance <strong>#{currentComplaint.id}</strong> with status <code>CLOSED</code>, consolidate it under master complaint <strong>#{candidate.id}</strong>, and record a persisted audit entry. Reopening is not automated.
                        </p>
                      </div>
                    </div>
                  )}

                  {activeAction.actionType === 'MARK_DISTINCT' && (
                    <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-xs flex items-start gap-2">
                      <Split className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <p className="text-[11px] leading-relaxed">
                        Both grievances will remain active in their respective queues. Their algorithmic similarity signals will be annotated with official distinct verification in the audit ledger.
                      </p>
                    </div>
                  )}

                  {activeAction.actionType === 'MARK_RELATED' && (
                    <div className="p-2.5 bg-bridge-gold-50 border border-bridge-gold-200 rounded-lg text-bridge-charcoal-800 text-xs flex items-start gap-2">
                      <Link className="w-4 h-4 text-bridge-gold-700 shrink-0 mt-0.5" />
                      <p className="text-[11px] leading-relaxed">
                        Both grievances will be linked in cluster <strong>{clusterIdentifier}</strong> for coordinated municipal field crew dispatch without closing either record.
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-bridge-charcoal-700 mb-1">
                      Officer Review Rationale &amp; Field Notes <span className="text-rose-600">*</span> (min 5 chars)
                    </label>
                    <textarea
                      value={decisionNotes}
                      onChange={(e) => setDecisionNotes(e.target.value)}
                      placeholder="Enter physical site inspection verification particulars or justification..."
                      className="w-full text-xs p-2.5 rounded-lg border border-bridge-almond-300 bg-white focus:ring-2 focus:ring-bridge-gold-500 focus:border-bridge-gold-500 focus:outline-none"
                      rows={3}
                    />
                  </div>

                  {actionError && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{actionError}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setActiveAction(null);
                        setActionError(null);
                      }}
                      disabled={isSubmitting}
                      className="text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => handleExecuteResolution(activeAction.actionType, candidate)}
                      disabled={isSubmitting || decisionNotes.trim().length < 5}
                      className="text-xs"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                          Recording...
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5 mr-1" />
                          Confirm &amp; Record Decision
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-bridge-almond-100">
                  <div className="text-[11px] text-bridge-charcoal-500">
                    Record official verification decision for this cluster match.
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleInitiateAction('MARK_DISTINCT', candidate)}
                      className="text-xs"
                    >
                      <Split className="w-3.5 h-3.5 mr-1 text-bridge-charcoal-600" />
                      Mark Distinct
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleInitiateAction('MARK_RELATED', candidate)}
                      className="text-xs"
                    >
                      <Link className="w-3.5 h-3.5 mr-1 text-bridge-charcoal-600" />
                      Link in Cluster
                    </Button>
                    {currentComplaint.status !== 'CLOSED' && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => handleInitiateAction('MERGE_DUPLICATES', candidate)}
                        className="text-xs font-semibold text-rose-800 bg-rose-50 border-rose-200 hover:bg-rose-100"
                      >
                        <Copy className="w-3.5 h-3.5 mr-1 text-rose-700" />
                        Confirm Duplicate of #{candidate.id}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Persisted Cluster Resolution Audit History */}
      <div className="bg-white border border-bridge-almond-200 rounded-xl p-4 shadow-civic-sm space-y-3">
        <button
          type="button"
          onClick={() => setShowAuditHistory((prev) => !prev)}
          className="w-full flex items-center justify-between text-left cursor-pointer focus:outline-none"
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-bridge-gold-600" />
            <span className="text-xs font-bold text-bridge-charcoal-800">
              Persisted Cluster Resolution Audit History
            </span>
            <Badge variant="neutral" size="sm">
              {auditRecords.length} Decision{auditRecords.length === 1 ? '' : 's'}
            </Badge>
          </div>
          {showAuditHistory ? (
            <ChevronUp className="w-4 h-4 text-bridge-charcoal-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-bridge-charcoal-400" />
          )}
        </button>

        {showAuditHistory && (
          <div className="pt-2 border-t border-bridge-almond-100 space-y-3 animate-fadeIn">
            {isLoadingAudits ? (
              <div className="flex items-center gap-2 py-3 text-xs text-bridge-charcoal-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-bridge-gold-600" />
                <span>Loading audit trail...</span>
              </div>
            ) : auditRecords.length === 0 ? (
              <p className="text-xs text-bridge-charcoal-400 italic py-2">
                No prior duplicate resolution decisions recorded for this grievance or cluster.
              </p>
            ) : (
              <div className="space-y-2.5">
                {auditRecords.map((audit) => (
                  <div
                    key={audit.id}
                    className="p-3 bg-bridge-almond-50/70 border border-bridge-almond-200 rounded-lg text-xs space-y-1.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            audit.actionType === 'MERGE_DUPLICATES'
                              ? 'duplicate'
                              : audit.actionType === 'MARK_DISTINCT'
                              ? 'verified'
                              : 'info'
                          }
                          size="sm"
                        >
                          {audit.actionType.replace(/_/g, ' ')}
                        </Badge>
                        <span className="font-mono text-[11px] text-bridge-charcoal-500">
                          Primary: #{audit.primaryComplaintId}
                        </span>
                      </div>
                      <span className="text-[10px] text-bridge-charcoal-400 font-mono">
                        {new Date(audit.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-bridge-charcoal-800 font-medium text-[11px]">
                      {audit.decisionNotes}
                    </p>

                    <div className="text-[10px] text-bridge-charcoal-500 flex flex-wrap justify-between pt-1 border-t border-bridge-almond-200/60">
                      <span>
                        Adjudicated by: <strong className="text-bridge-charcoal-700">{audit.officerName}</strong>
                      </span>
                      <span className="font-mono">Audit ID: {audit.id}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
