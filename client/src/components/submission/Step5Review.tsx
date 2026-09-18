import React, { useState } from 'react';
import {
  Edit3,
  Calendar,
  MapPin,
  Tag,
  Image as ImageIcon,
  Send,
  CheckCircle2,
  Copy,
  Check,
  AlertCircle,
  ShieldCheck,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import type { ComplaintFormData } from './types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card, CardBody } from '../ui/Card';
import { apiCreateComplaint, type ComplaintRecord } from '../../services/api';

interface Step5Props {
  formData: ComplaintFormData;
  onEditStep: (step: number) => void;
  onReset: () => void;
  onNavigateToTrack?: (token: string) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  garbage_dumping: 'Garbage dumping',
  overflowing_bin: 'Overflowing bin',
  pothole: 'Pothole',
  broken_streetlight: 'Broken streetlight',
  unsegregated_waste: 'Unsegregated waste',
  construction_debris: 'Construction debris',
  other: 'Other issue',
};

export const Step5Review: React.FC<Step5Props> = ({
  formData,
  onEditStep,
  onReset,
  onNavigateToTrack,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submittedComplaint, setSubmittedComplaint] = useState<ComplaintRecord | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  const categoryName = formData.category
    ? CATEGORY_LABELS[formData.category] || formData.category
    : 'Not selected';

  const handleCopyToken = () => {
    if (submittedComplaint) {
      navigator.clipboard.writeText(submittedComplaint.trackingToken);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      const response = await apiCreateComplaint({
        category: formData.category,
        customCategory: formData.customCategory || undefined,
        description: formData.description,
        observedDate: formData.observedDate,
        locationArea: formData.locationSearch || 'Mysuru (General)',
        addressText: formData.addressText || undefined,
        hasImage: !!formData.imageFile,
        evidenceMetadata: formData.imageFile
          ? {
              filename: formData.imageFile.name,
              sizeBytes: formData.imageFile.size,
              mimetype: formData.imageFile.type,
              submittedAt: new Date().toISOString(),
              note: 'Photo accepted as citizen-submitted evidence only. Authenticity unverified.',
            }
          : undefined,
      });

      setSubmittedComplaint(response.complaint);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setSubmissionError(err.message || 'Failed to submit complaint. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // SUCCESS RECEIPT SCREEN
  if (submittedComplaint) {
    const vr = submittedComplaint.verificationResult;
    return (
      <div className="space-y-6 animate-fadeIn">
        {/* Success Banner */}
        <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-emerald-950">
            Complaint Registered Successfully
          </h2>
          <p className="text-xs sm:text-sm text-emerald-800 max-w-lg mx-auto">
            Your civic complaint has been saved in the municipal registry and processed through the automated verification engine.
          </p>
        </div>

        {/* Tracking Token & Complaint ID Card */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="border-brand-teal-200 bg-brand-teal-50/50">
            <CardBody className="p-4 space-y-1">
              <span className="text-[11px] font-semibold text-brand-teal-800 uppercase tracking-wider">
                Public Tracking Token
              </span>
              <div className="flex items-center justify-between pt-1">
                <span className="font-mono text-base sm:text-lg font-bold text-brand-slate-900">
                  {submittedComplaint.trackingToken}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyToken}
                  icon={copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                >
                  {copiedToken ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <p className="text-[11px] text-brand-slate-600 pt-1">
                Use this token to track resolution progress publicly without exposing your personal information.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="p-4 space-y-1">
              <span className="text-[11px] font-semibold text-brand-slate-500 uppercase tracking-wider">
                Assigned Department
              </span>
              <p className="text-sm font-bold text-brand-slate-900 pt-1">
                {submittedComplaint.assignedDepartment || 'MCC Engineering Division'}
              </p>
              <div className="pt-2 flex items-center gap-2">
                <span className="text-[11px] text-brand-slate-500">Lifecycle Status:</span>
                <Badge variant="verified" size="sm">
                  {submittedComplaint.status}
                </Badge>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Explainable Verification Breakdown */}
        {vr && (
          <Card className="border-brand-slate-200">
            <CardBody className="p-5 space-y-3">
              <div className="flex items-center gap-2 border-b border-brand-slate-100 pb-2">
                <ShieldCheck className="w-4 h-4 text-brand-teal-700" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-brand-slate-900">
                  Automated Evidence & Similarity Signals
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-brand-slate-500 font-medium">Duplicate Risk Assessment:</span>
                  <div className="mt-1">
                    <Badge
                      variant={
                        vr.duplicateRisk === 'HIGH'
                          ? 'duplicate'
                          : vr.duplicateRisk === 'MEDIUM'
                          ? 'review'
                          : 'verified'
                      }
                      size="sm"
                    >
                      {vr.duplicateRisk} RISK ({vr.outcome})
                    </Badge>
                  </div>
                </div>

                <div>
                  <span className="text-brand-slate-500 font-medium">Recommended Action:</span>
                  <p className="text-brand-slate-800 font-medium mt-1">
                    {vr.recommendedAction}
                  </p>
                </div>
              </div>

              {vr.signals.length > 0 && (
                <div className="pt-2">
                  <span className="text-[11px] font-semibold text-brand-slate-600">Signals Detected:</span>
                  <ul className="mt-1 space-y-1 list-disc list-inside text-xs text-brand-slate-700">
                    {vr.signals.map((sig, idx) => (
                      <li key={idx}>{sig}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Uncertainties & Limitations (Honest Disclosure) */}
              <div className="pt-2 border-t border-brand-slate-100 space-y-1 text-[11px] text-brand-slate-500 italic">
                <p>• Photo evidence is treated as citizen-submitted evidence only. Authenticity unverified.</p>
                <p>• Text and proximity similarity scores support human decision-making and do not prove whether a claim is genuine.</p>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onReset}
          >
            Submit Another Complaint
          </Button>

          {onNavigateToTrack && (
            <Button
              type="button"
              variant="primary"
              size="md"
              icon={<ExternalLink className="w-4 h-4" />}
              onClick={() => onNavigateToTrack(submittedComplaint.trackingToken)}
            >
              Track Complaint Progress
            </Button>
          )}
        </div>
      </div>
    );
  }

  // REVIEW & SUBMIT FORM
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-brand-slate-900">
          Review your complaint details
        </h2>
        <p className="text-xs sm:text-sm text-brand-slate-600 mt-1">
          Verify that all information is accurate before submitting. You can click &quot;Edit&quot; on any section to make corrections.
        </p>
      </div>

      {submissionError && (
        <div
          role="alert"
          className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-start gap-2 animate-fadeIn"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
          <span>{submissionError}</span>
        </div>
      )}

      {/* Summary Review Cards */}
      <div className="space-y-4">
        {/* Item 1: Issue Category */}
        <Card>
          <CardBody className="p-4 sm:p-5 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Tag className="w-3.5 h-3.5 text-brand-teal-700 shrink-0" />
                <span className="text-xs font-semibold text-brand-slate-500 uppercase tracking-wider">
                  Issue Type
                </span>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Badge variant="info" size="md">
                  {categoryName}
                </Badge>
                {formData.category === 'other' && formData.customCategory && (
                  <span className="text-xs text-brand-slate-700 font-medium">
                    ({formData.customCategory})
                  </span>
                )}
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={<Edit3 className="w-3 h-3" />}
              onClick={() => onEditStep(1)}
              aria-label="Edit Issue Category"
            >
              Edit
            </Button>
          </CardBody>
        </Card>

        {/* Item 2: Description & Date */}
        <Card>
          <CardBody className="p-4 sm:p-5 flex items-start justify-between gap-4">
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-brand-teal-700 shrink-0" />
                <span className="text-xs font-semibold text-brand-slate-500 uppercase tracking-wider">
                  Description & Date Observed
                </span>
              </div>
              <p className="text-sm text-brand-slate-900 whitespace-pre-wrap leading-relaxed">
                {formData.description || <span className="text-brand-slate-400 italic">No description provided</span>}
              </p>
              <div className="flex items-center gap-1.5 text-xs text-brand-slate-600 pt-1">
                <span className="font-semibold text-brand-slate-800">Observed On:</span>
                <span>{formData.observedDate || 'Not specified'}</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={<Edit3 className="w-3 h-3" />}
              onClick={() => onEditStep(2)}
              aria-label="Edit Description and Date"
            >
              Edit
            </Button>
          </CardBody>
        </Card>

        {/* Item 3: Location */}
        <Card>
          <CardBody className="p-4 sm:p-5 flex items-start justify-between gap-4">
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-brand-teal-700 shrink-0" />
                <span className="text-xs font-semibold text-brand-slate-500 uppercase tracking-wider">
                  Location in Mysuru
                </span>
              </div>
              <p className="text-sm font-semibold text-brand-slate-900">
                {formData.locationSearch || 'Not selected'}
              </p>
              {formData.addressText && (
                <p className="text-xs text-brand-slate-600">
                  {formData.addressText}
                </p>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={<Edit3 className="w-3 h-3" />}
              onClick={() => onEditStep(3)}
              aria-label="Edit Location"
            >
              Edit
            </Button>
          </CardBody>
        </Card>

        {/* Item 4: Evidence */}
        <Card>
          <CardBody className="p-4 sm:p-5 flex items-start justify-between gap-4">
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-3.5 h-3.5 text-brand-teal-700 shrink-0" />
                <span className="text-xs font-semibold text-brand-slate-500 uppercase tracking-wider">
                  Photo Evidence
                </span>
              </div>

              {formData.imageFile ? (
                <div className="flex items-center gap-3 pt-1">
                  {formData.imagePreviewUrl && (
                    <img
                      src={formData.imagePreviewUrl}
                      alt="Uploaded evidence thumbnail"
                      className="w-14 h-14 object-cover rounded-lg border border-brand-slate-200"
                    />
                  )}
                  <div>
                    <p className="text-xs font-semibold text-brand-slate-900 truncate max-w-xs">
                      {formData.imageFile.name}
                    </p>
                    <p className="text-[11px] text-brand-slate-500">
                      {(formData.imageFile.size / 1024).toFixed(1)} KB • {formData.imageFile.type}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-brand-slate-500 italic">
                  No photo evidence attached
                </p>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={<Edit3 className="w-3 h-3" />}
              onClick={() => onEditStep(4)}
              aria-label="Edit Evidence"
            >
              Edit
            </Button>
          </CardBody>
        </Card>
      </div>

      {/* Action Bar */}
      <div className="pt-4 border-t border-brand-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isSubmitting}
          onClick={onReset}
        >
          Reset Form
        </Button>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button
            type="button"
            variant="outline"
            size="md"
            disabled={isSubmitting}
            onClick={() => onEditStep(4)}
            className="flex-1 sm:flex-initial"
          >
            Back
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={isSubmitting}
            icon={isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            onClick={handleSubmit}
            className="flex-1 sm:flex-initial"
          >
            {isSubmitting ? 'Registering & Verifying...' : 'Submit Complaint'}
          </Button>
        </div>
      </div>
    </div>
  );
};
