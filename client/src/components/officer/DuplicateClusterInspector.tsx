import React from 'react';
import {
  Copy,
  CheckCircle2,
  Calendar,
  MapPin,
  Split,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
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
  const matchesInfo = currentComplaint.verificationResult?.matches || [];

  if (matchedCandidates.length === 0) {
    return (
      <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-5 text-emerald-800">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
          <div>
            <h4 className="font-semibold text-emerald-900 text-sm">
              No Duplicate Clusters Detected
            </h4>
            <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
              Deterministic similarity indexing and phrase matching found no overlapping
              complaints in the current database for this locality and category. This appears to
              be an isolated, distinct grievance.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-amber-600" />
          <h4 className="font-semibold text-brand-slate-800 text-sm">
            Potential Duplicate Matches ({matchedCandidates.length})
          </h4>
        </div>
        <span className="text-xs text-brand-slate-500">
          Ranked by phrase & vocabulary overlap
        </span>
      </div>

      <div className="space-y-4">
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
              className="bg-white border border-brand-slate-200 rounded-xl p-4 shadow-civic-sm space-y-3"
            >
              {/* Match Header & Risk */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-brand-slate-100">
                <div className="flex items-center gap-2">
                  <Badge variant={riskBadgeVariant} size="sm">
                    {matchMeta?.riskLevel || 'MEDIUM'} RISK OVERLAP
                  </Badge>
                  {similarityPct !== null && (
                    <span className="text-xs font-semibold text-brand-slate-700 bg-brand-slate-100 px-2 py-0.5 rounded-full">
                      {similarityPct}% Vocabulary Similarity
                    </span>
                  )}
                </div>
                <div className="text-xs font-mono text-brand-slate-500">
                  Target: {candidate.id} ({candidate.trackingToken})
                </div>
              </div>

              {/* Side by side comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Current Complaint */}
                <div className="bg-brand-slate-50 rounded-lg p-3 border border-brand-slate-200/70 space-y-2">
                  <div className="flex items-center justify-between font-semibold text-brand-slate-700">
                    <span className="text-brand-teal-700">Current Complaint ({currentComplaint.id})</span>
                    <span className="text-brand-slate-500">{currentComplaint.status}</span>
                  </div>
                  <div className="flex items-center gap-2 text-brand-slate-600">
                    <MapPin className="w-3.5 h-3.5 text-brand-teal-600" />
                    <span>{currentComplaint.locationArea}</span>
                  </div>
                  <div className="flex items-center gap-2 text-brand-slate-500">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Observed: {currentComplaint.observedDate}</span>
                  </div>
                  <p className="text-brand-slate-800 bg-white p-2 rounded border border-brand-slate-200/80 leading-relaxed font-normal">
                    {currentComplaint.description}
                  </p>
                </div>

                {/* Candidate Complaint */}
                <div className="bg-amber-50/50 rounded-lg p-3 border border-amber-200/70 space-y-2">
                  <div className="flex items-center justify-between font-semibold text-amber-900">
                    <span className="text-amber-800">Existing Grievance ({candidate.id})</span>
                    <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[11px]">
                      {candidate.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-brand-slate-600">
                    <MapPin className="w-3.5 h-3.5 text-amber-600" />
                    <span>{candidate.locationArea}</span>
                  </div>
                  <div className="flex items-center gap-2 text-brand-slate-500">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Observed: {candidate.observedDate}</span>
                  </div>
                  <p className="text-brand-slate-800 bg-white p-2 rounded border border-amber-200/80 leading-relaxed font-normal">
                    {candidate.description}
                  </p>
                </div>
              </div>

              {/* Shared Overlap Highlights */}
              {matchingPhrases.length > 0 && (
                <div className="bg-brand-slate-50 p-2.5 rounded-lg border border-brand-slate-200/60 text-xs">
                  <span className="font-semibold text-brand-slate-700 mr-2">
                    Key Overlapping Phrases:
                  </span>
                  <div className="inline-flex flex-wrap gap-1 mt-1">
                    {matchingPhrases.map((phrase, idx) => (
                      <span
                        key={idx}
                        className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-mono text-[11px]"
                      >
                        "{phrase}"
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Officer Action Buttons for Duplicate Decision */}
              <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-brand-slate-100">
                {onMarkDistinct && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onMarkDistinct(candidate)}
                    className="text-xs"
                  >
                    <Split className="w-3.5 h-3.5 mr-1 text-brand-slate-600" />
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
          );
        })}
      </div>
    </div>
  );
};
