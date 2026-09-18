import React, { useState } from 'react';
import { Edit3, Info, Calendar, MapPin, Tag, Image as ImageIcon, Send } from 'lucide-react';
import type { ComplaintFormData } from './types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card, CardBody } from '../ui/Card';

interface Step5Props {
  formData: ComplaintFormData;
  onEditStep: (step: number) => void;
  onReset: () => void;
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
}) => {
  const [submissionAttempted, setSubmissionAttempted] = useState(false);

  const categoryName = formData.category
    ? CATEGORY_LABELS[formData.category] || formData.category
    : 'Not selected';

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

      {/* Submission Attempt Disclaimer Box */}
      {submissionAttempted && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 space-y-2 animate-fadeIn"
        >
          <div className="flex items-center gap-2 font-bold text-sm text-amber-950">
            <Info className="w-4 h-4 text-amber-700 shrink-0" />
            <span>Notice: Backend Submission API is Not Implemented Yet</span>
          </div>
          <p className="text-xs text-amber-900 leading-relaxed">
            The frontend complaint submission flow and client-side validation are fully functioning. Per the hackathon project plan, backend verification algorithms and MCC database ingestion will be connected in subsequent phases. <strong>Zero fake complaint IDs or simulated verification scores have been generated.</strong>
          </p>
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
              aria-label="Edit Description"
            >
              Edit
            </Button>
          </CardBody>
        </Card>

        {/* Item 3: Location */}
        <Card>
          <CardBody className="p-4 sm:p-5 flex items-start justify-between gap-4">
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-brand-teal-700 shrink-0" />
                <span className="text-xs font-semibold text-brand-slate-500 uppercase tracking-wider">
                  Location in Mysuru
                </span>
              </div>
              <p className="text-sm font-semibold text-brand-slate-900">
                {formData.locationSearch || <span className="text-brand-slate-400 font-normal italic">No area specified</span>}
              </p>
              {formData.addressText && (
                <p className="text-xs text-brand-slate-600 leading-normal">
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

        {/* Item 4: Photo Evidence */}
        <Card>
          <CardBody className="p-4 sm:p-5 flex items-start justify-between gap-4">
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-3.5 h-3.5 text-brand-teal-700 shrink-0" />
                <span className="text-xs font-semibold text-brand-slate-500 uppercase tracking-wider">
                  Submitted Photo Evidence
                </span>
              </div>

              {formData.imagePreviewUrl ? (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-1">
                  <img
                    src={formData.imagePreviewUrl}
                    alt="Evidence thumbnail"
                    className="w-20 h-20 object-cover rounded-lg border border-brand-slate-200"
                  />
                  <div className="text-xs text-brand-slate-600 space-y-0.5">
                    <p className="font-semibold text-brand-slate-900">{formData.imageFile?.name}</p>
                    <p>Size: {formData.imageFile ? (formData.imageFile.size / 1024).toFixed(0) : 0} KB</p>
                    <p className="text-amber-800 text-[11px] font-medium">
                      Status: Submitted evidence (Unverified until backend verification)
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-brand-slate-500 italic pt-1">
                  No image attached.
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
          onClick={onReset}
        >
          Reset Form
        </Button>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={() => onEditStep(4)}
            className="flex-1 sm:flex-initial"
          >
            Back
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            icon={<Send className="w-4 h-4" />}
            onClick={() => setSubmissionAttempted(true)}
            className="flex-1 sm:flex-initial"
          >
            Submit Complaint
          </Button>
        </div>
      </div>
    </div>
  );
};
