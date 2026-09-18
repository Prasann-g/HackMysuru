import React, { useState } from 'react';
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
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { AuthenticatedEvidenceImage } from '../common/AuthenticatedEvidenceImage';
import type { ComplaintRecord } from '../../services/api';

interface DuplicateClusterInspectorProps {
  currentComplaint: ComplaintRecord;
  matchedCandidates: ComplaintRecord[];
  onConfirmDuplicate?: (candidate: ComplaintRecord) => void;
  onMarkDistinct?: (candidate: ComplaintRecord) => void;
}

export const DuplicateClusterInspector: React.FC<DuplicateClusterInspectorProps> = ({
  currentComplaint,
  matchedCandidates,
  onConfirmDuplicate,
  onMarkDistinct,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const matchesInfo = currentComplaint.verificationResult?.matches || [];

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).catch(() => {
      // ignore clipboard error
    });
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (matchedCandidates.length === 0) {
    return (
      <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-5 text-emerald-800">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <h4 className="font-semibold text-emerald-900 text-sm">
              No Duplicate Clusters Detected
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

              {/* Action Buttons for Officer Triage Decision */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-bridge-almond-100">
                <div className="text-[11px] text-bridge-charcoal-500">
                  Select an action to record your verification decision for this cluster match.
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {onMarkDistinct && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onMarkDistinct(candidate)}
                      className="text-xs"
                    >
                      <Split className="w-3.5 h-3.5 mr-1 text-bridge-charcoal-600" />
                      Mark Distinct Grievance
                    </Button>
                  )}
                  {onConfirmDuplicate && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => onConfirmDuplicate(candidate)}
                      className="text-xs font-semibold text-rose-800 bg-rose-50 border-rose-200 hover:bg-rose-100"
                    >
                      <Copy className="w-3.5 h-3.5 mr-1 text-rose-700" />
                      Confirm Duplicate of {candidate.id}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
