import React, { useState } from 'react';
import {
  Compass,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  UserCheck,
  History,
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { apiRerouteComplaint, type ComplaintRecord } from '../../services/api';
import type {
  AuthorityType,
  RoutingDecision,
  RoutingProvenance,
  RoutingStatus,
} from '../../types/routing';
import type { CitizenUser } from '../../types/auth';

interface RoutingDecisionCardProps {
  complaint: ComplaintRecord;
  currentOfficer?: CitizenUser | null;
  onRerouted?: (updated: ComplaintRecord) => void;
}

const DEPARTMENTS = [
  'MCC Engineering Division',
  'MCC Health & Sanitation Department',
  'CHESCOM / MCC Electrical Division',
  'MCC Town Planning & Public Works',
  'MCC General Grievance Cell',
];

export const RoutingDecisionCard: React.FC<RoutingDecisionCardProps> = ({
  complaint,
  currentOfficer,
  onRerouted,
}) => {
  const routing: RoutingDecision | undefined = complaint.routingDecision;

  const [isOverrideOpen, setIsOverrideOpen] = useState(false);
  const [overrideAuthority, setOverrideAuthority] = useState<AuthorityType>(
    routing?.authorityType || 'MCC'
  );
  const [overrideDepartment, setOverrideDepartment] = useState<string>(
    routing?.department || complaint.assignedDepartment || 'MCC Engineering Division'
  );
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const handleOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideReason.trim()) {
      setErrorMsg('Please specify a mandatory administrative reason for this routing override.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await apiRerouteComplaint(complaint.id, {
        authorityType: overrideAuthority,
        department: overrideDepartment,
        overrideReason: overrideReason.trim(),
      });

      setSuccessMsg('Routing decision successfully overridden and recorded in the audit trail.');
      setIsOverrideOpen(false);
      setOverrideReason('');
      if (onRerouted) {
        onRerouted(res.complaint);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit routing override.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getProvenanceBadge = (prov?: RoutingProvenance) => {
    switch (prov) {
      case 'HUMAN_CONFIRMED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-md">
            <UserCheck className="w-3 h-3 text-purple-600" />
            HUMAN CONFIRMED
          </span>
        );
      case 'RULE_BASED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md">
            RULE BASED
          </span>
        );
      case 'VERIFIED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            VERIFIED
          </span>
        );
      case 'ESTIMATED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md">
            ESTIMATED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200 px-2 py-0.5 rounded-md">
            UNKNOWN
          </span>
        );
    }
  };

  const getStatusBadge = (status?: RoutingStatus) => {
    switch (status) {
      case 'ROUTED':
        return <Badge variant="verified" size="sm">ROUTED</Badge>;
      case 'INVALID_LOCATION':
        return <Badge variant="duplicate" size="sm">INVALID LOCATION</Badge>;
      case 'INVALID_CATEGORY':
        return <Badge variant="duplicate" size="sm">INVALID CATEGORY</Badge>;
      case 'MISSING_INFORMATION':
        return <Badge variant="duplicate" size="sm">MISSING INFO</Badge>;
      default:
        return <Badge variant="review" size="sm">REVIEW REQUIRED</Badge>;
    }
  };

  return (
    <div className="bg-white border border-bridge-almond-200 rounded-xl p-5 shadow-civic-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-bridge-almond-100">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-bridge-gold-600" />
          <h3 className="text-sm font-semibold text-bridge-charcoal-800">
            Routing & Jurisdiction Dossier
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {routing && getStatusBadge(routing.status)}
          {routing && getProvenanceBadge(routing.provenance)}
        </div>
      </div>

      {/* Main Dual Grid: Jurisdiction vs Department Recommendation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Geographic Jurisdiction */}
        <div className="p-3.5 rounded-xl bg-bridge-almond-50/70 border border-bridge-almond-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-bridge-charcoal-600 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-bridge-gold-600" />
              Administrative Jurisdiction:
            </span>
            {getProvenanceBadge(routing?.jurisdictionProvenance || 'UNKNOWN')}
          </div>

          <div>
            <div className="font-bold text-sm text-bridge-charcoal-900">
              {routing?.authorityName || 'Jurisdiction Unverified'}
            </div>
            <div className="text-[11px] text-bridge-charcoal-500 font-mono mt-0.5">
              Authority Type: {routing?.authorityType || 'UNKNOWN'}
            </div>
          </div>

          <div className="text-[11px] text-bridge-charcoal-600 bg-white/80 p-2 rounded border border-bridge-almond-200 leading-relaxed">
            {routing?.authorityType === 'UNKNOWN' ? (
              <span className="text-amber-800">
                ⚠️ Authoritative GIS boundaries are currently <strong>UNAVAILABLE</strong> in the system. Official jurisdiction cannot be inferred from coordinates alone.
              </span>
            ) : (
              <span className="text-emerald-800 font-medium">
                Official jurisdiction verified or confirmed by municipal officer.
              </span>
            )}
          </div>
        </div>

        {/* Card 2: Operating Department Recommendation */}
        <div className="p-3.5 rounded-xl bg-bridge-almond-50/70 border border-bridge-almond-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-bridge-charcoal-600 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-bridge-gold-600" />
              Department Recommendation:
            </span>
            {getProvenanceBadge(routing?.departmentProvenance || 'RULE_BASED')}
          </div>

          <div>
            <div className="font-bold text-sm text-bridge-charcoal-900">
              {routing?.department || complaint.assignedDepartment || 'MCC General Grievance Cell'}
            </div>
            <div className="text-[11px] text-bridge-charcoal-500 font-mono mt-0.5">
              Category: {complaint.category}
            </div>
          </div>

          <div className="text-[11px] text-bridge-charcoal-600 bg-white/80 p-2 rounded border border-bridge-almond-200 leading-relaxed">
            Provisional operating assignment derived from category triage rules. Distinct from geographic jurisdiction determination.
          </div>
        </div>
      </div>

      {/* Review Required Warning Banner */}
      {routing?.reviewRequired && (
        <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-xl text-amber-950 text-xs flex items-start gap-2.5 leading-relaxed">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold block text-amber-950">
              Manual Administrative Review Required
            </strong>
            <span>
              This complaint requires officer review before dispatch due to unverified geographic jurisdiction, high duplicate risk, or location ambiguity.
            </span>
          </div>
        </div>
      )}

      {/* Explainable Decision Signals */}
      {routing?.explanation && routing.explanation.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-bridge-charcoal-700 block">
            Explainable Routing Signals ({routing.explanation.length}):
          </span>
          <ul className="space-y-1 bg-bridge-almond-50/40 p-3 rounded-xl border border-bridge-almond-200 text-xs text-bridge-charcoal-700">
            {routing.explanation.map((exp, idx) => (
              <li key={idx} className="flex items-start gap-2 leading-relaxed">
                <span className="text-bridge-gold-600 font-bold shrink-0">•</span>
                <span>{exp}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Officer Manual Override Action Bar */}
      <div className="pt-2 border-t border-bridge-almond-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {routing?.overrideHistory && routing.overrideHistory.length > 0 && (
            <button
              type="button"
              onClick={() => setHistoryOpen(!historyOpen)}
              className="text-xs text-bridge-charcoal-600 hover:text-bridge-charcoal-900 font-medium flex items-center gap-1.5 py-1 px-2 rounded hover:bg-bridge-almond-50 transition cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-bridge-gold-600" />
              <span>Audit History ({routing.overrideHistory.length})</span>
              {historyOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setIsOverrideOpen(!isOverrideOpen);
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
          className="text-xs"
        >
          {isOverrideOpen ? 'Cancel Override' : 'Manual Officer Override'}
        </Button>
      </div>

      {/* Feedback Messages */}
      {errorMsg && (
        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Expandable Override Form */}
      {isOverrideOpen && (
        <form
          onSubmit={handleOverrideSubmit}
          className="p-4 rounded-xl bg-bridge-almond-50/80 border border-bridge-gold-200 space-y-3 animate-fadeIn"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-bridge-charcoal-900 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-bridge-gold-600" />
              Officer Routing Override Panel
            </span>
            <span className="text-[11px] font-mono text-bridge-charcoal-500">
              Officer: {currentOfficer?.name || 'Authenticated Staff'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-bridge-charcoal-700 mb-1">
                Assign Authority:
              </label>
              <select
                value={overrideAuthority}
                onChange={(e) => setOverrideAuthority(e.target.value as AuthorityType)}
                className="w-full bg-white border border-bridge-almond-300 rounded-lg px-2.5 py-1.5 text-xs text-bridge-charcoal-800 focus:ring-2 focus:ring-bridge-gold-500 focus:outline-none"
              >
                <option value="MCC">Mysuru City Corporation (MCC)</option>
                <option value="TOWN_PANCHAYAT">Town Panchayat</option>
                <option value="GRAM_PANCHAYAT">Gram Panchayat</option>
                <option value="UNKNOWN">Jurisdiction Unverified (UNKNOWN)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-bridge-charcoal-700 mb-1">
                Assign Department:
              </label>
              <select
                value={overrideDepartment}
                onChange={(e) => setOverrideDepartment(e.target.value)}
                className="w-full bg-white border border-bridge-almond-300 rounded-lg px-2.5 py-1.5 text-xs text-bridge-charcoal-800 focus:ring-2 focus:ring-bridge-gold-500 focus:outline-none"
              >
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-bridge-charcoal-700 mb-1">
              Administrative Reason for Override <span className="text-rose-500">*</span>:
            </label>
            <textarea
              rows={2}
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="e.g. Confirmed site lies within MCC Ward 48 boundary via official municipal gazette map..."
              className="w-full bg-white border border-bridge-almond-300 rounded-lg p-2.5 text-xs text-bridge-charcoal-800 placeholder-bridge-charcoal-400 focus:ring-2 focus:ring-bridge-gold-500 focus:outline-none"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsOverrideOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting}
              className="text-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                  Recording Override...
                </>
              ) : (
                <>
                  <Send className="w-3 h-3 mr-1" />
                  Commit Override
                </>
              )}
            </Button>
          </div>
        </form>
      )}

      {/* Expandable Append-Only Audit History */}
      {historyOpen && routing?.overrideHistory && routing.overrideHistory.length > 0 && (
        <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2 text-xs animate-fadeIn">
          <div className="font-bold text-zinc-800 flex items-center gap-1.5 text-xs">
            <History className="w-3.5 h-3.5 text-bridge-gold-600" />
            <span>Append-Only Officer Routing Override History</span>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {routing.overrideHistory.map((audit, idx) => (
              <div
                key={idx}
                className="bg-white p-2.5 rounded-lg border border-zinc-200 text-[11px] space-y-1"
              >
                <div className="flex items-center justify-between text-zinc-500">
                  <span className="font-semibold text-zinc-700">
                    {audit.officerName} ({audit.officerId})
                  </span>
                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3" />
                    {new Date(audit.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className="text-zinc-600">
                  <span>Previous: </span>
                  <span className="font-mono text-zinc-800">
                    {audit.previousDecision.authorityType} / {audit.previousDecision.department}
                  </span>
                  {' → '}
                  <span>New: </span>
                  <span className="font-mono text-zinc-900 font-bold">
                    {audit.newDecision.authorityType} / {audit.newDecision.department}
                  </span>
                </div>
                <div className="text-zinc-700 italic bg-zinc-50 p-1.5 rounded">
                  Reason: &quot;{audit.overrideReason}&quot;
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
