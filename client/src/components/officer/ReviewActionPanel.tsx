import React, { useState, useEffect, useRef } from 'react';
import {
  Save,
  CheckCircle,
  FileEdit,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../ui/Button';
import type { ComplaintRecord } from '../../services/api';
import type { CitizenUser } from '../../types/auth';

interface ReviewActionPanelProps {
  complaint: ComplaintRecord;
  onUpdate: (payload: {
    status?: string;
    assignedDepartment?: string;
    reviewNotes?: string;
  }) => Promise<void>;
  isUpdating: boolean;
  currentOfficer?: CitizenUser | null;
  initialNotePreFill?: string;
}

const MCC_DEPARTMENTS = [
  'MCC Engineering Division',
  'MCC Health & Sanitation Department',
  'CHAMUNDESHWARI Electricity Supply Corp (CESC)',
  'Mysuru City Police - Traffic Ward',
  'Mysuru City Corporation - General Grievance Cell',
];

const STATUS_OPTIONS = [
  { value: 'SUBMITTED', label: 'Submitted (Awaiting Initial Triage)' },
  { value: 'UNDER_REVIEW', label: 'Under Review (Field Verification Underway)' },
  { value: 'FORWARDED', label: 'Forwarded (Transferred to Specialized Ward Wing)' },
  { value: 'IN_PROGRESS', label: 'In Progress (Active Field Crew Dispatched)' },
  { value: 'RESOLVED', label: 'Resolved (Remediation Work Complete)' },
  { value: 'CLOSED', label: 'Closed (Consolidated or Verified Duplicate)' },
];

export const ReviewActionPanel: React.FC<ReviewActionPanelProps> = ({
  complaint,
  onUpdate,
  isUpdating,
  currentOfficer,
  initialNotePreFill,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<string>(complaint.status);
  const [selectedDepartment, setSelectedDepartment] = useState<string>(
    complaint.assignedDepartment || currentOfficer?.department || 'MCC Engineering Division'
  );
  const [reviewNotes, setReviewNotes] = useState<string>(
    initialNotePreFill || complaint.reviewNotes || ''
  );
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const lastPreFillRef = useRef(initialNotePreFill);
  useEffect(() => {
    if (initialNotePreFill && initialNotePreFill !== lastPreFillRef.current) {
      lastPreFillRef.current = initialNotePreFill;
      setReviewNotes(initialNotePreFill);
    }
  }, [initialNotePreFill]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSaveSuccess(false);

    try {
      await onUpdate({
        status: selectedStatus,
        assignedDepartment: selectedDepartment,
        reviewNotes: reviewNotes.trim(),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update review status.');
    }
  };

  const applyTemplate = (status: string, templateNote: string) => {
    setSelectedStatus(status);
    setReviewNotes((prev) => (prev ? `${prev}\n${templateNote}` : templateNote));
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-bridge-almond-200 rounded-xl p-5 shadow-civic-sm space-y-4"
    >
      <div className="flex items-center justify-between pb-3 border-b border-bridge-almond-100">
        <div className="flex items-center gap-2">
          <FileEdit className="w-4 h-4 text-bridge-gold-600" />
          <h4 className="font-semibold text-bridge-charcoal-800 text-sm">
            Officer Verification & Lifecycle Decision
          </h4>
        </div>
        <span className="text-xs text-bridge-charcoal-500 font-mono">
          Officer: {currentOfficer?.name || 'Authorized Staff'}
        </span>
      </div>

      {/* Quick Action Decision Presets */}
      <div>
        <label className="block text-xs font-semibold text-bridge-charcoal-600 mb-1.5">
          Quick Decision Presets:
        </label>
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={() =>
              applyTemplate(
                'UNDER_REVIEW',
                'Visual evidence inspection required on site to corroborate citizen-submitted photo stamp.'
              )
            }
            className="px-2.5 py-1 bg-amber-50 text-amber-800 hover:bg-amber-100 active:scale-95 border border-amber-200 rounded-lg text-xs transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
          >
            Request On-Site Inspection
          </button>
          <button
            type="button"
            onClick={() =>
              applyTemplate(
                'IN_PROGRESS',
                'Dispatched junior engineer and field team for physical remediation.'
              )
            }
            className="px-2.5 py-1 bg-bridge-gold-50 text-bridge-gold-800 hover:bg-bridge-gold-100 active:scale-95 border border-bridge-gold-200 rounded-lg text-xs transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bridge-gold-500"
          >
            Dispatch Field Crew
          </button>
          <button
            type="button"
            onClick={() =>
              applyTemplate(
                'RESOLVED',
                'Field repair verified by ward supervisor. Remediation confirmed completed.'
              )
            }
            className="px-2.5 py-1 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 active:scale-95 border border-emerald-200 rounded-lg text-xs transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500"
          >
            Mark Resolved
          </button>
        </div>
      </div>

      {/* Lifecycle Status & Department Routing */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="review-status" className="block text-xs font-semibold text-bridge-charcoal-700 mb-1">
            Review Status
          </label>
          <select
            id="review-status"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            disabled={isUpdating}
            className="civic-input w-full rounded-lg px-3 py-2 text-xs font-medium text-bridge-charcoal-800 cursor-pointer transition-all duration-150"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-bridge-charcoal-700 mb-1">
            Assigned Responsible Department
          </label>
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            disabled={isUpdating}
            className="civic-input w-full rounded-lg px-3 py-2 text-xs font-medium text-bridge-charcoal-800 cursor-pointer transition-all duration-150"
          >
            {MCC_DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Internal Review Notes */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="reviewNotes" className="block text-xs font-semibold text-bridge-charcoal-700">
            Internal Verification & Review Notes
          </label>
          <span className="text-[11px] text-bridge-charcoal-500 italic">
            Confidential — restricted to municipal staff
          </span>
        </div>
        <textarea
          id="reviewNotes"
          rows={3}
          value={reviewNotes}
          onChange={(e) => setReviewNotes(e.target.value)}
          placeholder="Record inspection findings, contractor dispatch numbers, duplicate cross-references, or on-site notes..."
          disabled={isUpdating}
          className="civic-input w-full rounded-lg p-3 text-xs text-bridge-charcoal-800 placeholder-bridge-charcoal-400 transition-all duration-150"
        />
      </div>

      {/* Feedback Messages */}
      {errorMsg && (
        <div className="flex items-center gap-2 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {saveSuccess && (
        <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-xs">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>Complaint lifecycle decision updated and logged successfully.</span>
        </div>
      )}

      {/* Submit Button */}
      <div className="flex items-center justify-between pt-2">
        <span className="text-[11px] text-bridge-charcoal-500">
          Last status: <strong className="font-semibold">{complaint.status}</strong>
        </span>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={isUpdating}
          className="text-xs px-4"
        >
          {isUpdating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              Saving Decision...
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5 mr-1.5" />
              Save Review Decision
            </>
          )}
        </Button>
      </div>
    </form>
  );
};
