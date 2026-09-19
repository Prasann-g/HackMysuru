import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, X, Loader2, Send } from 'lucide-react';
import { SectionRail, type SectionDef } from './SectionRail';
import { LiveSummary } from './LiveSummary';
import { Step1IssueDetails } from './Step1IssueDetails';
import { Step2Description } from './Step2Description';
import { Section3PlaceEvidence } from './Section3PlaceEvidence';
import { Step5Review } from './Step5Review';
import type { ComplaintFormData, FormErrors, IssueCategory, GpsStatus } from './types';
import {
  apiCreateComplaint,
  type ComplaintRecord,
  type SafeExistingComplaint,
} from '../../services/api';
import { Button } from '../ui/Button';

interface ComplaintSubmissionPortalProps {
  onBackToHome?: () => void;
  onNavigateToTrack?: (token: string) => void;
  onSuccess?: (complaint: ComplaintRecord) => void;
  isModal?: boolean;
}

const SECTIONS: SectionDef[] = [
  {
    id: 1,
    label: 'Issue Type',
    sublabel: 'Select grievance category',
    required: true,
  },
  {
    id: 2,
    label: 'Details',
    sublabel: 'Description & date',
    required: true,
  },
  {
    id: 3,
    label: 'Place & Evidence',
    sublabel: 'Location & photo evidence',
    required: true,
  },
  {
    id: 4,
    label: 'Review & Submit',
    sublabel: 'Confirm and file',
    required: true,
  },
];

const TOTAL_SECTIONS = SECTIONS.length;

const INITIAL_FORM_DATA: ComplaintFormData = {
  category: '',
  customCategory: '',
  description: '',
  observedDate: new Date().toISOString().split('T')[0],
  locationArea: '',
  addressText: '',
  latitude: null,
  longitude: null,
  gpsAccuracy: null,
  gpsStatus: 'idle',
  imageFile: null,
  imagePreviewUrl: null,
  declarationConfirmed: false,
};

export const ComplaintSubmissionPortal: React.FC<ComplaintSubmissionPortalProps> = ({
  onBackToHome,
  onNavigateToTrack,
  onSuccess,
  isModal = false,
}) => {
  const [currentSection, setCurrentSection] = useState<number>(1);
  const [maxVisitedSection, setMaxVisitedSection] = useState<number>(1);
  const [formData, setFormData] = useState<ComplaintFormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<FormErrors>({});

  // Lifted submission states to power both the Review view and the pinned Action Bar
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submittedComplaint, setSubmittedComplaint] = useState<ComplaintRecord | null>(null);
  const [duplicateConflict, setDuplicateConflict] = useState<{
    message: string;
    code: string;
    duplicateType: string;
    existingComplaint?: SafeExistingComplaint;
  } | null>(null);
  const [outOfServiceAreaError, setOutOfServiceAreaError] = useState<{
    message: string;
    code: string;
  } | null>(null);
  const [declarationError, setDeclarationError] = useState<string | null>(null);

  const formBodyRef = useRef<HTMLDivElement>(null);

  // Scroll to top on section change.
  // In modal context (isModal=true) we target the data-modal-body container.
  // Outside a modal we use the local formBodyRef or window fallback.
  const scrollToTop = () => {
    if (isModal) {
      const modalBody = document.querySelector('[data-modal-body="true"]');
      if (modalBody) {
        modalBody.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }
    if (formBodyRef.current) {
      formBodyRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Revoke object URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (formData.imagePreviewUrl) {
        URL.revokeObjectURL(formData.imagePreviewUrl);
      }
    };
  }, [formData.imagePreviewUrl]);

  // ---- Form data handlers ----
  const handleSelectCategory = (cat: IssueCategory) => {
    setFormData((prev) => ({ ...prev, category: cat }));
    if (errors.category) {
      setErrors((prev) => ({ ...prev, category: undefined }));
    }
  };

  const handleImageSelected = (file: File) => {
    if (formData.imagePreviewUrl) {
      URL.revokeObjectURL(formData.imagePreviewUrl);
    }
    const previewUrl = URL.createObjectURL(file);
    setFormData((prev) => ({ ...prev, imageFile: file, imagePreviewUrl: previewUrl }));
    setErrors((prev) => ({ ...prev, image: undefined }));
  };

  const handleImageRemoved = () => {
    if (formData.imagePreviewUrl) {
      URL.revokeObjectURL(formData.imagePreviewUrl);
    }
    setFormData((prev) => ({ ...prev, imageFile: null, imagePreviewUrl: null }));
  };

  const handleGpsCapture = (lat: number, lng: number, accuracy: number) => {
    setFormData((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lng,
      gpsAccuracy: accuracy,
      gpsStatus: 'success',
    }));
  };

  const handleGpsStatusChange = (status: GpsStatus) => {
    setFormData((prev) => ({ ...prev, gpsStatus: status }));
  };

  const handleReset = () => {
    if (formData.imagePreviewUrl) {
      URL.revokeObjectURL(formData.imagePreviewUrl);
    }
    setFormData(INITIAL_FORM_DATA);
    setErrors({});
    setIsSubmitting(false);
    setSubmissionError(null);
    setSubmittedComplaint(null);
    setDuplicateConflict(null);
    setOutOfServiceAreaError(null);
    setDeclarationError(null);
    setCurrentSection(1);
    setMaxVisitedSection(1);
    scrollToTop();
  };

  // ---- Validation per section ----
  const validateSection = (section: number): boolean => {
    const newErrors: FormErrors = {};

    if (section === 1) {
      if (!formData.category) {
        newErrors.category = 'Please choose a grievance category to continue.';
      }
    } else if (section === 2) {
      const trimmedDesc = formData.description.trim();
      if (!trimmedDesc) {
        newErrors.description = 'Please describe the civic issue.';
      } else if (trimmedDesc.length < 10) {
        newErrors.description = 'Please provide at least 10 characters describing the issue.';
      } else if (trimmedDesc.length > 1000) {
        newErrors.description = 'Description cannot exceed 1000 characters.';
      }
      if (!formData.observedDate) {
        newErrors.observedDate = 'Please specify the date when this issue was observed.';
      } else {
        const today = new Date().toISOString().split('T')[0];
        if (formData.observedDate > today) {
          newErrors.observedDate = 'Observation date cannot be in the future.';
        }
      }
    } else if (section === 3) {
      const trimmedLoc = formData.locationArea.trim();
      if (!trimmedLoc) {
        newErrors.locationArea = 'Please enter the Mysuru locality, ward, or landmark.';
      } else if (trimmedLoc.length < 3) {
        newErrors.locationArea = 'Locality must be at least 3 characters.';
      }
      if (formData.latitude === null || formData.longitude === null) {
        newErrors.locationArea = newErrors.locationArea
          ? `${newErrors.locationArea} Also, device GPS location is required.`
          : 'Device GPS location is required for verification. Please click "Detect My Location".';
      }
      if (!formData.imageFile) {
        newErrors.image = 'Photographic evidence is mandatory for complaint verification. Please attach a photo.';
      } else if (errors.image) {
        newErrors.image = errors.image;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ---- Check if Continue button should be enabled ----
  const isContinueEnabled = (): boolean => {
    if (currentSection === 1) {
      return !!formData.category;
    }
    if (currentSection === 2) {
      return (
        formData.description.trim().length >= 10 &&
        formData.description.trim().length <= 1000 &&
        !!formData.observedDate
      );
    }
    if (currentSection === 3) {
      return (
        formData.locationArea.trim().length >= 3 &&
        formData.latitude !== null &&
        formData.longitude !== null &&
        formData.imageFile !== null &&
        !errors.image
      );
    }
    return true;
  };

  // ---- Section navigation ----
  const handleNext = () => {
    if (validateSection(currentSection)) {
      const next = Math.min(currentSection + 1, TOTAL_SECTIONS);
      setCurrentSection(next);
      setMaxVisitedSection((prev) => Math.max(prev, next));
      scrollToTop();
    }
  };

  const handleBack = () => {
    const prev = Math.max(currentSection - 1, 1);
    setCurrentSection(prev);
    scrollToTop();
  };

  const handleSectionJump = (id: number) => {
    if (id <= maxVisitedSection && id !== currentSection) {
      setCurrentSection(id);
      scrollToTop();
    }
  };

  const handleEditSection = (sectionNumber: number) => {
    setOutOfServiceAreaError(null);
    setCurrentSection(sectionNumber);
    scrollToTop();
  };

  // ---- Final Grievance Submission ----
  const handleSubmit = async () => {
    if (isSubmitting) return;

    if (!formData.declarationConfirmed) {
      setDeclarationError('Please check the confirmation box before submitting your grievance.');
      const declEl = document.getElementById('citizen-declaration-card');
      if (declEl) {
        declEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    if (!formData.imageFile) {
      setSubmissionError('Photographic evidence is mandatory for complaint verification. Please attach a photo in Section 3.');
      return;
    }

    if (formData.latitude === null || formData.longitude === null) {
      setSubmissionError('Device GPS location is required for verification. Please capture your location in Section 3.');
      return;
    }

    setIsSubmitting(true);
    setSubmissionError(null);
    setDuplicateConflict(null);
    setOutOfServiceAreaError(null);
    setDeclarationError(null);

    try {
      const response = await apiCreateComplaint({
        category: formData.category,
        customCategory: formData.customCategory || undefined,
        description: formData.description.trim(),
        observedDate: formData.observedDate,
        locationArea: formData.locationArea.trim(),
        addressText: formData.addressText.trim() || undefined,
        latitude: formData.latitude ?? undefined,
        longitude: formData.longitude ?? undefined,
        hasImage: !!formData.imageFile,
        imageFile: formData.imageFile || undefined,
        evidenceMetadata: formData.imageFile
          ? {
              filename: formData.imageFile.name,
              sizeBytes: formData.imageFile.size,
              mimetype: formData.imageFile.type,
              submittedAt: new Date().toISOString(),
              note: 'Submitted evidence only. Verification evaluated by automated signals.',
            }
          : undefined,
      });

      setSubmittedComplaint(response.complaint);
      onSuccess?.(response.complaint);
      scrollToTop();
    } catch (err: any) {
      if (
        err.name === 'DuplicateComplaintError' ||
        err.code === 'EXACT_IMAGE_DUPLICATE' ||
        err.code === 'EXACT_TEXT_DUPLICATE'
      ) {
        setDuplicateConflict({
          message: err.message,
          code: err.code || 'DUPLICATE_COMPLAINT',
          duplicateType: err.duplicateType || 'UNKNOWN_DUPLICATE',
          existingComplaint: err.existingComplaint,
        });
        scrollToTop();
      } else if (err.name === 'OutOfServiceAreaError' || err.code === 'OUT_OF_SERVICE_AREA') {
        setOutOfServiceAreaError({
          message: err.message,
          code: err.code || 'OUT_OF_SERVICE_AREA',
        });
        scrollToTop();
      } else {
        setSubmissionError(
          err.message || 'Failed to submit grievance. Please check your connection and try again.'
        );
        scrollToTop();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full flex flex-col h-full overflow-hidden">
      {/* ── DESKTOP 3-COLUMN / MOBILE STACKED WORKSPACE AREA ── */}
      <div className="flex flex-col lg:flex-row lg:gap-0 flex-1 min-h-0 overflow-hidden">
        {/* Left: Section Rail (desktop) & Mobile progress pills */}
        <aside className="lg:w-52 xl:w-56 shrink-0 lg:border-r lg:border-bridge-almond-200 p-4 lg:p-5 lg:pt-6 overflow-y-auto">
          {/* Mobile: compact horizontal progress pills */}
          <div className="lg:hidden flex items-center gap-2 mb-4">
            {SECTIONS.map((s) => (
              <div
                key={s.id}
                className={`flex-1 h-1.5 rounded-full transition-all duration-300 ease-out motion-reduce:transition-none ${
                  s.id < currentSection
                    ? 'bg-bridge-gold-500 shadow-2xs'
                    : s.id === currentSection
                    ? 'bg-bridge-gold-400 ring-2 ring-bridge-gold-400/25'
                    : 'bg-bridge-almond-200'
                }`}
              />
            ))}
          </div>

          <div className="hidden lg:block">
            <SectionRail
              sections={SECTIONS}
              currentSection={currentSection}
              maxVisitedSection={maxVisitedSection}
              onSectionClick={handleSectionJump}
            />
          </div>

          {/* Mobile section label */}
          <div className="lg:hidden">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-bridge-charcoal-400">
              Section {currentSection} of {TOTAL_SECTIONS}
            </p>
            <p className="text-sm font-bold text-bridge-charcoal-900 mt-0.5">
              {SECTIONS[currentSection - 1]?.label}
            </p>
          </div>
        </aside>

        {/* Center: Scrollable Active Section Form Area */}
        <main
          ref={formBodyRef}
          data-modal-body="true"
          className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 lg:p-7 pb-8 space-y-6"
          aria-live="polite"
          aria-atomic="false"
        >
          {/* Animated section container: smooth gentle transition on section change */}
          <div key={`section-step-${currentSection}`} className="animate-fadeIn">
            {/* Section 1: Issue Type */}
            {currentSection === 1 && (
              <Step1IssueDetails
                selectedCategory={formData.category}
                customCategory={formData.customCategory}
                error={errors.category}
                onSelectCategory={handleSelectCategory}
                onChangeCustomCategory={(val) =>
                  setFormData((prev) => ({ ...prev, customCategory: val }))
                }
              />
            )}

            {/* Section 2: Details */}
            {currentSection === 2 && (
              <Step2Description
                description={formData.description}
                observedDate={formData.observedDate}
                errors={{
                  description: errors.description,
                  observedDate: errors.observedDate,
                }}
                onChangeDescription={(val) => {
                  setFormData((prev) => ({ ...prev, description: val }));
                  if (errors.description) {
                    setErrors((prev) => ({ ...prev, description: undefined }));
                  }
                }}
                onChangeObservedDate={(val) => {
                  setFormData((prev) => ({ ...prev, observedDate: val }));
                  if (errors.observedDate) {
                    setErrors((prev) => ({ ...prev, observedDate: undefined }));
                  }
                }}
              />
            )}

            {/* Section 3: Place & Evidence (merged) */}
            {currentSection === 3 && (
              <Section3PlaceEvidence
                locationArea={formData.locationArea}
                addressText={formData.addressText}
                latitude={formData.latitude}
                longitude={formData.longitude}
                gpsAccuracy={formData.gpsAccuracy}
                gpsStatus={formData.gpsStatus}
                locationErrors={{
                  locationArea: errors.locationArea,
                  addressText: errors.addressText,
                }}
                onChangeLocationArea={(val) => {
                  setFormData((prev) => ({ ...prev, locationArea: val }));
                  if (errors.locationArea) {
                    setErrors((prev) => ({ ...prev, locationArea: undefined }));
                  }
                }}
                onChangeAddressText={(val) =>
                  setFormData((prev) => ({ ...prev, addressText: val }))
                }
                onGpsCapture={handleGpsCapture}
                onGpsStatusChange={handleGpsStatusChange}
                imageFile={formData.imageFile}
                imagePreviewUrl={formData.imagePreviewUrl}
                imageError={errors.image}
                onImageSelected={handleImageSelected}
                onImageRemoved={handleImageRemoved}
                onImageError={(msg) => setErrors((prev) => ({ ...prev, image: msg }))}
                onImageClearError={() =>
                  setErrors((prev) => ({ ...prev, image: undefined }))
                }
              />
            )}

            {/* Section 4: Review & Submit */}
            {currentSection === 4 && (
              <Step5Review
                formData={formData}
                onEditStep={handleEditSection}
                onReset={handleReset}
                onNavigateToTrack={onNavigateToTrack}
                onSuccess={onSuccess}
                onDone={onBackToHome}
                onDeclarationChange={(val) => {
                  setFormData((prev) => ({ ...prev, declarationConfirmed: val }));
                  if (val) setDeclarationError(null);
                }}
                isSubmitting={isSubmitting}
                submissionError={submissionError}
                submittedComplaint={submittedComplaint}
                duplicateConflict={duplicateConflict}
                declarationError={declarationError}
                onClearDuplicateConflict={() => setDuplicateConflict(null)}
                outOfServiceAreaError={outOfServiceAreaError}
                onClearOutOfServiceAreaError={() => setOutOfServiceAreaError(null)}
              />
            )}
          </div>
        </main>

        {/* Right: Live Summary (hidden on mobile and tablet, shown on xl+) */}
        <aside className="hidden xl:flex xl:flex-col xl:w-60 2xl:w-64 shrink-0 border-l border-bridge-almond-200 p-4 xl:p-5 overflow-y-auto">
          <LiveSummary
            formData={formData}
            currentSection={currentSection}
            totalSections={TOTAL_SECTIONS}
          />
        </aside>
      </div>

      {/* ── PINNED / STICKY BOTTOM ACTION BAR: ALWAYS VISIBLE! ── */}
      {!submittedComplaint && !duplicateConflict && !outOfServiceAreaError && (
        <footer className="shrink-0 border-t border-bridge-almond-200 bg-white px-4 sm:px-6 py-3 sm:py-3.5 flex items-center justify-between gap-3 z-20 shadow-bridge-sm">
          {/* Left Action Button */}
          {currentSection === 1 ? (
            onBackToHome ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onBackToHome}
                icon={<X className="w-3.5 h-3.5" />}
                className="transition-all duration-200 ease-out active:scale-[0.98] motion-reduce:active:scale-100 hover:bg-bridge-almond-100/90"
              >
                Cancel
              </Button>
            ) : (
              <div />
            )
          ) : currentSection === 4 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isSubmitting}
              onClick={handleReset}
              className="transition-all duration-200 ease-out active:scale-[0.98] motion-reduce:active:scale-100 hover:bg-bridge-almond-100/90"
            >
              Reset Form
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={handleBack}
              icon={<ArrowLeft className="w-4 h-4" />}
              className="transition-all duration-200 ease-out active:scale-[0.98] motion-reduce:active:scale-100 hover:border-bridge-gold-400 hover:bg-bridge-almond-50 hover:shadow-bridge-sm"
            >
              Back
            </Button>
          )}

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3">
            {currentSection === 4 ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  disabled={isSubmitting}
                  onClick={handleBack}
                  icon={<ArrowLeft className="w-4 h-4" />}
                  className="transition-all duration-200 ease-out active:scale-[0.98] motion-reduce:active:scale-100 hover:border-bridge-gold-400 hover:bg-bridge-almond-50 hover:shadow-bridge-sm"
                >
                  Back
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  disabled={isSubmitting}
                  icon={
                    isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )
                  }
                  onClick={handleSubmit}
                  className="transition-all duration-200 ease-out active:scale-[0.98] motion-reduce:active:scale-100 hover:bg-bridge-charcoal-900 hover:shadow-bridge-card"
                >
                  {isSubmitting ? 'Registering...' : 'Submit Grievance'}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="primary"
                size="md"
                disabled={!isContinueEnabled()}
                onClick={handleNext}
                className="transition-all duration-200 ease-out active:scale-[0.98] motion-reduce:active:scale-100 hover:bg-bridge-charcoal-900 hover:shadow-bridge-card group"
              >
                <span>{currentSection === 3 ? 'Review Grievance' : 'Continue'}</span>
                <ArrowRight className="w-4 h-4 ml-1.5 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:group-hover:translate-x-0" />
              </Button>
            )}
          </div>
        </footer>
      )}
    </div>
  );
};
