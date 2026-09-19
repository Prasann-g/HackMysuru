import React, { useState, useRef } from 'react';
import {
  Edit3,
  Calendar,
  MapPin,
  Tag,
  Image as ImageIcon,
  CheckCircle2,
  Copy,
  Check,
  AlertCircle,
  AlertTriangle,
  ShieldCheck,
  ExternalLink,
  Navigation,
  MapPinOff,
} from 'lucide-react';
import type { ComplaintFormData } from './types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card, CardBody } from '../ui/Card';
import {
  type ComplaintRecord,
  type SafeExistingComplaint,
} from '../../services/api';

interface Step5Props {
  formData: ComplaintFormData;
  onEditStep: (step: number) => void;
  onReset: () => void;
  onNavigateToTrack?: (token: string) => void;
  onSuccess?: (complaint: ComplaintRecord) => void;
  onDone?: () => void;
  onDeclarationChange?: (val: boolean) => void;
  isSubmitting?: boolean;
  submissionError?: string | null;
  submittedComplaint?: ComplaintRecord | null;
  duplicateConflict?: {
    message: string;
    code: string;
    duplicateType: string;
    existingComplaint?: SafeExistingComplaint;
  } | null;
  declarationError?: string | null;
  onClearDuplicateConflict?: () => void;
  outOfServiceAreaError?: {
    message: string;
    code: string;
  } | null;
  onClearOutOfServiceAreaError?: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  pothole: 'Pothole & Road Damage',
  garbage_dumping: 'Garbage Dumping',
  broken_streetlight: 'Broken Streetlight',
  overflowing_bin: 'Overflowing Public Bin',
  construction_debris: 'Construction Debris',
  unsegregated_waste: 'Unsegregated Waste Pile',
  other: 'Other Civic Grievance',
};

export const Step5Review: React.FC<Step5Props> = ({
  formData,
  onEditStep,
  onReset,
  onNavigateToTrack,
  onDone,
  onDeclarationChange,
  submissionError = null,
  submittedComplaint = null,
  duplicateConflict = null,
  declarationError = null,
  onClearDuplicateConflict,
  outOfServiceAreaError = null,
  onClearOutOfServiceAreaError,
}) => {
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedExistingToken, setCopiedExistingToken] = useState(false);
  const confirmedDeclaration = formData.declarationConfirmed ?? false;

  const containerRef = useRef<HTMLDivElement>(null);

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

  const handleCopyExistingToken = () => {
    if (duplicateConflict?.existingComplaint?.trackingToken) {
      navigator.clipboard.writeText(duplicateConflict.existingComplaint.trackingToken);
      setCopiedExistingToken(true);
      setTimeout(() => setCopiedExistingToken(false), 2000);
    }
  };

  const handleToggleDeclaration = (checked: boolean) => {
    onDeclarationChange?.(checked);
  };

  // --------------------------------------------------------------------------
  // OUT OF SERVICE AREA REJECTION VIEW (HTTP 400 - Option B: Reject Intake)
  // --------------------------------------------------------------------------
  if (outOfServiceAreaError) {
    return (
      <div ref={containerRef} className="space-y-6 animate-fadeIn">
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-3">
          <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center text-rose-700 mx-auto">
            <MapPinOff className="w-6 h-6" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-rose-950">
            Grievance Not Registered — Out of Municipal Service Area
          </h2>
          <p className="text-xs sm:text-sm text-rose-800 max-w-lg mx-auto leading-relaxed">
            {outOfServiceAreaError.message}
          </p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-100 text-rose-800 text-xs rounded-full font-medium mt-1">
            <span className="w-2 h-2 rounded-full bg-rose-600"></span>
            Status: HTTP 400 Intake Rejection (OUT_OF_SERVICE_AREA)
          </div>
        </div>

        <Card className="border-rose-200 bg-rose-50/30">
          <CardBody className="p-5 space-y-4 text-xs">
            <div className="border-b border-rose-200/60 pb-3">
              <span className="text-[11px] font-semibold text-rose-900 uppercase tracking-wider block">
                Municipal Boundary Enforcement Notice
              </span>
              <p className="text-xs text-bridge-charcoal-600 mt-1 leading-relaxed">
                CivicBridge operates exclusively for complaints within the <strong>Mysuru City Corporation (MCC)</strong> jurisdiction (bounding box: 12.15°–12.45° N, 76.50°–76.80° E). Grievances outside these boundaries cannot be registered.
              </p>
            </div>

            <div className="p-3 bg-white rounded-xl border border-rose-200 shadow-xs space-y-2 text-bridge-charcoal-700">
              <p className="font-semibold text-bridge-charcoal-900">Intake Safeguard Confirmations:</p>
              <ul className="list-disc list-inside space-y-1 text-bridge-charcoal-600 text-[11px]">
                <li><strong>No complaint record</strong> was created in the municipal database.</li>
                <li><strong>No tracking token</strong> was generated or reserved.</li>
                <li><strong>No department</strong> was assigned or dispatched.</li>
                <li><strong>No uploaded evidence</strong> was retained.</li>
              </ul>
            </div>

            {/* Location Contrast Comparison: Captured device location vs Locality entered by citizen */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {/* Box 1: Captured device location */}
              <div className="p-3.5 bg-rose-50/70 rounded-xl border border-rose-200 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-rose-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Navigation className="w-3.5 h-3.5 text-rose-700 shrink-0" />
                    Captured Device Location
                  </span>
                  <span className="text-[10px] font-semibold uppercase bg-rose-100 text-rose-800 px-2 py-0.5 rounded shrink-0">
                    GPS Coordinates
                  </span>
                </div>
                <p className="font-mono text-xs text-rose-900 font-semibold pt-0.5">
                  {formData.latitude !== null && formData.latitude !== undefined
                    ? `${Number(formData.latitude).toFixed(6)}° N`
                    : 'N/A'},{' '}
                  {formData.longitude !== null && formData.longitude !== undefined
                    ? `${Number(formData.longitude).toFixed(6)}° E`
                    : 'N/A'}
                </p>
                <p className="text-[11px] text-rose-800 leading-relaxed">
                  The captured device location is outside the supported Mysuru service area (MCC municipal boundary: 12.15°–12.45° N, 76.50°–76.80° E).
                </p>
              </div>

              {/* Box 2: Locality entered by citizen */}
              <div className="p-3.5 bg-bridge-ivory-50 rounded-xl border border-bridge-almond-200 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-bridge-charcoal-700 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-bridge-gold-700 shrink-0" />
                    Locality Entered by Citizen
                  </span>
                  <span className="text-[10px] font-semibold uppercase bg-bridge-almond-100 text-bridge-charcoal-700 px-2 py-0.5 rounded shrink-0">
                    Form Input
                  </span>
                </div>
                <p className="text-xs text-bridge-charcoal-900 font-bold pt-0.5">
                  {formData.locationArea || 'Not specified'}
                </p>
                {formData.addressText && (
                  <p className="text-[11px] text-bridge-charcoal-600">
                    Landmark / Street: {formData.addressText}
                  </p>
                )}
                <p className="text-[11px] text-bridge-charcoal-500 italic">
                  Self-reported text entered manually in the grievance form.
                </p>
              </div>
            </div>

            {/* Location Inconsistency Warning */}
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1 text-amber-900">
              <div className="flex items-center gap-2 font-bold text-amber-950">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Location Inconsistency Warning</span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed pl-6">
                The locality entered in the form (<strong>{formData.locationArea || 'Specified Locality'}</strong>) does not override the device GPS location. CivicBridge enforces municipal boundaries based on authentic device GPS coordinates. The system does not assume that the device GPS location is {formData.locationArea || 'the reported area'}.
              </p>
            </div>
          </CardBody>
        </Card>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onReset}
          >
            Start Over
          </Button>

          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => {
              onClearOutOfServiceAreaError?.();
              onEditStep(3);
            }}
          >
            Correct Location in Section 3 &amp; Retry
          </Button>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // DUPLICATE CONFLICT VIEW (HTTP 409)
  // --------------------------------------------------------------------------
  if (duplicateConflict) {
    const existing = duplicateConflict.existingComplaint;
    const isImageDuplicate = duplicateConflict.code === 'EXACT_IMAGE_DUPLICATE';

    return (
      <div ref={containerRef} className="space-y-6 animate-fadeIn">
        <div className="p-6 bg-amber-50 border border-amber-200 rounded-2xl text-center space-y-2">
          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-700 mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-amber-950">
            Duplicate Grievance Detected
          </h2>
          <p className="text-xs sm:text-sm text-amber-800 max-w-lg mx-auto leading-relaxed">
            {duplicateConflict.message}
          </p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-800 text-xs rounded-full font-medium mt-1">
            <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse"></span>
            Status: 409 Conflict — Pre-intake deduplication
          </div>
        </div>

        {existing && (
          <Card className="border-amber-200 bg-amber-50/40">
            <CardBody className="p-5 space-y-4">
              <div className="border-b border-amber-200/60 pb-3">
                <span className="text-[11px] font-semibold text-amber-900 uppercase tracking-wider block">
                  Reference to Existing Grievance in Mysuru
                </span>
                <p className="text-xs text-bridge-charcoal-600 mt-0.5">
                  An active municipal ticket is already recorded for this issue. You can monitor its resolution directly.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="p-3 bg-white rounded-xl border border-amber-200 shadow-xs">
                  <span className="text-[10px] font-semibold text-bridge-charcoal-500 uppercase tracking-wider block">
                    Public Tracking Token
                  </span>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-mono text-sm sm:text-base font-bold text-bridge-charcoal-900">
                      {existing.trackingToken}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyExistingToken}
                      icon={
                        copiedExistingToken ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )
                      }
                    >
                      {copiedExistingToken ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                </div>

                <div className="p-3 bg-white rounded-xl border border-amber-200 shadow-xs">
                  <span className="text-[10px] font-semibold text-bridge-charcoal-500 uppercase tracking-wider block">
                    Current Status & Category
                  </span>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge variant="duplicate" size="sm">
                      {existing.status}
                    </Badge>
                    <span className="text-xs font-semibold text-bridge-charcoal-800">
                      {CATEGORY_LABELS[existing.category] || existing.category}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-white rounded-xl border border-amber-200 shadow-xs">
                  <span className="text-[10px] font-semibold text-bridge-charcoal-500 uppercase tracking-wider block">
                    Observed Area
                  </span>
                  <span className="text-xs font-semibold text-bridge-charcoal-800 mt-1 block">
                    {existing.locationArea || 'Mysuru'}
                  </span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-amber-200 shadow-xs">
                  <span className="text-[10px] font-semibold text-bridge-charcoal-500 uppercase tracking-wider block">
                    Observation Date
                  </span>
                  <span className="text-xs font-semibold text-bridge-charcoal-800 mt-1 block">
                    {existing.observedDate}
                  </span>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        <div className="p-4 bg-bridge-almond-50/70 border border-bridge-almond-200 rounded-xl space-y-1.5 text-xs text-bridge-charcoal-600">
          <div className="flex items-center gap-2 font-semibold text-bridge-charcoal-800">
            <ShieldCheck className="w-4 h-4 text-bridge-gold-600" />
            CivicTrust Explainable Deduplication
          </div>
          <p>
            {isImageDuplicate
              ? 'Cryptographic match detected identical image data already filed in the municipal system.'
              : 'High-confidence text and location similarity identified an identical active ticket in this ward.'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <Button
            variant="outline"
            onClick={() => {
              onClearDuplicateConflict?.();
              onEditStep(isImageDuplicate ? 3 : 1);
            }}
          >
            {isImageDuplicate ? 'Attach a Different Photo' : 'Modify Complaint Details'}
          </Button>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {existing && onNavigateToTrack && (
              <Button
                variant="primary"
                onClick={() => onNavigateToTrack(existing.trackingToken)}
                icon={<ExternalLink className="w-4 h-4" />}
              >
                Track Existing Grievance
              </Button>
            )}
            <Button variant="ghost" onClick={onReset}>
              Start Over
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // SUCCESS RECEIPT VIEW
  // --------------------------------------------------------------------------
  if (submittedComplaint) {
    const vr = submittedComplaint.verificationResult;
    return (
      <div ref={containerRef} className="space-y-6 animate-fadeIn">
        <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-emerald-950">
            Grievance Registered Successfully
          </h2>
          <p className="text-xs sm:text-sm text-emerald-800 max-w-lg mx-auto">
            Your complaint has been accepted into the Mysuru municipal registry.
          </p>
        </div>

        {/* Tracking Token & Lifecycle Card */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="border-bridge-gold-300 bg-bridge-gold-50/40">
            <CardBody className="p-4 space-y-1">
              <span className="text-[11px] font-semibold text-bridge-gold-800 uppercase tracking-wider">
                Public Tracking Token
              </span>
              <div className="flex items-center justify-between pt-1">
                <span className="font-mono text-base sm:text-lg font-bold text-bridge-charcoal-900">
                  {submittedComplaint.trackingToken}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyToken}
                  icon={
                    copiedToken ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )
                  }
                >
                  {copiedToken ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <p className="text-[11px] text-bridge-charcoal-600 pt-1">
                Save this token to track progress without revealing your identity.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="p-4 space-y-1">
              <span className="text-[11px] font-semibold text-bridge-charcoal-500 uppercase tracking-wider">
                Assigned Department
              </span>
              <p className="text-sm font-bold text-bridge-charcoal-900 pt-1">
                {submittedComplaint.assignedDepartment || 'Department Routing in Progress'}
              </p>
              <div className="pt-2 flex items-center gap-2">
                <span className="text-[11px] text-bridge-charcoal-500">Lifecycle Status:</span>
                <Badge variant="verified" size="sm">
                  {submittedComplaint.status}
                </Badge>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Explainable Verification Signals */}
        {vr && (
          <Card className="border-bridge-almond-200">
            <CardBody className="p-5 space-y-3">
              <div className="flex items-center gap-2 border-b border-bridge-almond-100 pb-2">
                <ShieldCheck className="w-4 h-4 text-bridge-gold-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-bridge-charcoal-900">
                  Automated Evidence & Verification Signals
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-bridge-charcoal-500 font-medium">Duplicate Risk Assessment:</span>
                  <div className="mt-1">
                    <Badge
                      variant={
                        vr.duplicateRisk === 'HIGH' || vr.outcome === 'POSSIBLE_DUPLICATE'
                          ? 'duplicate'
                          : vr.duplicateRisk === 'MEDIUM' ||
                            vr.outcome === 'REQUIRES_HUMAN_REVIEW' ||
                            vr.outcome === 'INCONSISTENT_EVIDENCE' ||
                            vr.outcome === 'INCOMPLETE_EVIDENCE'
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
                  <span className="text-bridge-charcoal-500 font-medium">Recommended Action:</span>
                  <p className="text-bridge-charcoal-800 font-medium mt-1">
                    {vr.recommendedAction}
                  </p>
                </div>
              </div>

              {vr.signals && vr.signals.length > 0 && (
                <div className="pt-2">
                  <span className="text-[11px] font-semibold text-bridge-charcoal-600">Signals Detected:</span>
                  <ul className="mt-1 space-y-1 list-disc list-inside text-xs text-bridge-charcoal-700">
                    {vr.signals.map((sig: string, idx: number) => (
                      <li key={idx}>{sig}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="pt-2 border-t border-bridge-almond-100 space-y-1 text-[11px] text-bridge-charcoal-500 italic">
                <p>• Photo evidence is treated as citizen-submitted evidence only. Authenticity unverified.</p>
                <p>• Text and proximity similarity scores support human decision-making and do not prove whether a claim is genuine.</p>
              </div>
            </CardBody>
          </Card>
        )}

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

          {onDone && (
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={onDone}
            >
              Done / Return to Dashboard
            </Button>
          )}
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // REVIEW & SUBMIT FORM
  // --------------------------------------------------------------------------
  return (
    <div ref={containerRef} className="space-y-6">
      <div>
        <h2 className="text-base sm:text-lg font-bold text-bridge-charcoal-900">
          Review Grievance Information
        </h2>
        <p className="text-xs sm:text-sm text-bridge-charcoal-600 mt-1">
          Verify that all details are accurate before final submission. You can click &quot;Edit&quot; on any section to make adjustments.
        </p>
      </div>

      {submissionError && (
        <div
          role="alert"
          className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2.5 animate-fadeIn"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
          <div>
            <span className="font-semibold block">Submission Error</span>
            <span>{submissionError}</span>
          </div>
        </div>
      )}

      {/* Summary Review Cards */}
      <div className="space-y-3">
        {/* Item 1: Category */}
        <Card>
          <CardBody className="p-4 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Tag className="w-3.5 h-3.5 text-bridge-gold-600 shrink-0" />
                <span className="text-[11px] font-semibold text-bridge-charcoal-500 uppercase tracking-wider">
                  Grievance Category
                </span>
              </div>
              <div className="flex items-center gap-2 pt-0.5">
                <Badge variant="info" size="md">
                  {categoryName}
                </Badge>
                {formData.category === 'other' && formData.customCategory && (
                  <span className="text-xs text-bridge-charcoal-700 font-medium">
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
          <CardBody className="p-4 flex items-start justify-between gap-4">
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-bridge-gold-600 shrink-0" />
                <span className="text-[11px] font-semibold text-bridge-charcoal-500 uppercase tracking-wider">
                  Description & Date Observed
                </span>
              </div>
              <p className="text-sm text-bridge-charcoal-900 whitespace-pre-wrap leading-relaxed">
                {formData.description || <span className="text-bridge-charcoal-400 italic">No description provided</span>}
              </p>
              <div className="flex items-center gap-1.5 text-xs text-bridge-charcoal-600 pt-1">
                <span className="font-semibold text-bridge-charcoal-800">Date:</span>
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
          <CardBody className="p-4 flex items-start justify-between gap-4">
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-bridge-gold-600 shrink-0" />
                <span className="text-[11px] font-semibold text-bridge-charcoal-500 uppercase tracking-wider">
                  Location in Mysuru
                </span>
              </div>
              <p className="text-sm font-semibold text-bridge-charcoal-900">
                {formData.locationArea || 'Not selected'}
              </p>
              {formData.addressText && (
                <p className="text-xs text-bridge-charcoal-600">
                  {formData.addressText}
                </p>
              )}
              {formData.latitude && formData.longitude && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-mono pt-1">
                  <Navigation className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span>GPS: {formData.latitude.toFixed(5)}° N, {formData.longitude.toFixed(5)}° E</span>
                </div>
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
          <CardBody className="p-4 flex items-start justify-between gap-4">
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-3.5 h-3.5 text-bridge-gold-600 shrink-0" />
                <span className="text-[11px] font-semibold text-bridge-charcoal-500 uppercase tracking-wider">
                  Photo Evidence
                </span>
              </div>

              {formData.imageFile ? (
                <div className="flex items-center gap-3 pt-1">
                  {formData.imagePreviewUrl && (
                    <img
                      src={formData.imagePreviewUrl}
                      alt="Uploaded evidence thumbnail"
                      className="w-14 h-14 object-cover rounded-lg border border-bridge-almond-200"
                    />
                  )}
                  <div>
                    <p className="text-xs font-semibold text-bridge-charcoal-900 truncate max-w-xs">
                      {formData.imageFile.name}
                    </p>
                    <p className="text-[11px] text-bridge-charcoal-500">
                      {(formData.imageFile.size / 1024).toFixed(0)} KB • {formData.imageFile.type}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-bridge-charcoal-500 italic">
                  No photo evidence attached (Optional)
                </p>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={<Edit3 className="w-3 h-3" />}
              onClick={() => onEditStep(3)}
              aria-label="Edit Evidence"
            >
              Edit
            </Button>
          </CardBody>
        </Card>
      </div>

      {/* Citizen Confirmation Checkbox */}
      <div id="citizen-declaration-card" className="p-4 rounded-xl bg-bridge-almond-50 border border-bridge-almond-200 space-y-2">
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={confirmedDeclaration}
            onChange={(e) => handleToggleDeclaration(e.target.checked)}
            className="w-4 h-4 rounded border-bridge-almond-300 text-bridge-gold-600 focus:ring-bridge-gold-500 mt-0.5 cursor-pointer"
          />
          <div className="text-xs text-bridge-charcoal-700 leading-relaxed">
            <span className="font-semibold text-bridge-charcoal-900 block">
              Citizen Declaration
            </span>
            I declare that this grievance report is based on personal observation within Mysuru City Corporation jurisdiction and represents accurate information to the best of my knowledge.
          </div>
        </label>

        {declarationError && (
          <p className="text-xs text-rose-600 flex items-center gap-1.5 pt-1 animate-fadeIn">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{declarationError}</span>
          </p>
        )}
      </div>


    </div>
  );
};
