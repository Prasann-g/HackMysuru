import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react';
import { Stepper } from './Stepper';
import { Step1IssueDetails } from './Step1IssueDetails';
import { Step2Description } from './Step2Description';
import { Step3Location } from './Step3Location';
import { Step4Evidence } from './Step4Evidence';
import { Step5Review } from './Step5Review';
import type { ComplaintFormData, FormErrors, IssueCategory } from './types';
import { Button } from '../ui/Button';
import { Card, CardBody } from '../ui/Card';

interface ComplaintSubmissionPortalProps {
  onBackToHome: () => void;
  onNavigateToTrack?: (token: string) => void;
}

const STEP_LABELS = [
  'Issue Details',
  'Description',
  'Location',
  'Evidence',
  'Review',
];

const INITIAL_FORM_DATA: ComplaintFormData = {
  category: '',
  customCategory: '',
  description: '',
  observedDate: new Date().toISOString().split('T')[0],
  locationSearch: '',
  addressText: '',
  imageFile: null,
  imagePreviewUrl: null,
};

export const ComplaintSubmissionPortal: React.FC<ComplaintSubmissionPortalProps> = ({
  onBackToHome,
  onNavigateToTrack,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [formData, setFormData] = useState<ComplaintFormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<FormErrors>({});

  // Clean up object URLs on unmount or reset
  const handleReset = () => {
    if (formData.imagePreviewUrl) {
      URL.revokeObjectURL(formData.imagePreviewUrl);
    }
    setFormData(INITIAL_FORM_DATA);
    setErrors({});
    setCurrentStep(1);
  };

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
    setFormData((prev) => ({
      ...prev,
      imageFile: file,
      imagePreviewUrl: previewUrl,
    }));
    setErrors((prev) => ({ ...prev, image: undefined }));
  };

  const handleImageRemoved = () => {
    if (formData.imagePreviewUrl) {
      URL.revokeObjectURL(formData.imagePreviewUrl);
    }
    setFormData((prev) => ({
      ...prev,
      imageFile: null,
      imagePreviewUrl: null,
    }));
  };

  // Step Validation Logic
  const validateStep = (step: number): boolean => {
    const newErrors: FormErrors = {};

    if (step === 1) {
      if (!formData.category) {
        newErrors.category = 'Please select an issue category before continuing.';
      }
    } else if (step === 2) {
      if (!formData.description.trim()) {
        newErrors.description = 'Complaint description is required.';
      } else if (formData.description.trim().length < 10) {
        newErrors.description = 'Please provide at least 10 characters describing the issue.';
      }

      if (!formData.observedDate) {
        newErrors.observedDate = 'Please select the date when this issue was observed.';
      } else {
        const today = new Date().toISOString().split('T')[0];
        if (formData.observedDate > today) {
          newErrors.observedDate = 'Observed date cannot be in the future.';
        }
      }
    } else if (step === 3) {
      if (!formData.locationSearch.trim()) {
        newErrors.locationSearch = 'Please specify the Mysuru area or landmark.';
      } else if (formData.locationSearch.trim().length < 3) {
        newErrors.locationSearch = 'Area or landmark must be at least 3 characters.';
      }
    } else if (step === 4) {
      // Photo is optional or recommended, but if image error exists, block
      if (errors.image) {
        return false;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 5));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStepJump = (step: number) => {
    // Can jump to any step that has been completed or next available
    if (step < currentStep) {
      setCurrentStep(step);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="py-8 sm:py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <button
            type="button"
            onClick={onBackToHome}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-teal-700 hover:text-brand-teal-800 p-1 rounded-md focus-visible:ring-2 focus-visible:ring-brand-teal-600 cursor-pointer mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-brand-slate-900 tracking-tight">
              Submit a Civic Complaint
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-brand-slate-600 mt-1">
            Mysuru City Corporation (MCC) Citizen Verification Portal
          </p>
        </div>

        <div className="flex items-center gap-2 bg-brand-teal-50 border border-brand-teal-200 rounded-lg px-3 py-1.5 text-xs text-brand-teal-800 self-start sm:self-center">
          <ShieldCheck className="w-4 h-4 text-brand-teal-700 shrink-0" />
          <span>Evidence-Guided Reporting</span>
        </div>
      </div>

      {/* Stepper Navigation */}
      <div className="mb-8 bg-white p-4 sm:p-6 rounded-2xl border border-brand-slate-200 shadow-civic-sm">
        <Stepper
          currentStep={currentStep}
          totalSteps={5}
          stepLabels={STEP_LABELS}
          onStepClick={handleStepJump}
        />
      </div>

      {/* Step Content Container */}
      <Card className="border-brand-slate-200 shadow-civic">
        <CardBody className="p-6 sm:p-8">
          {currentStep === 1 && (
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

          {currentStep === 2 && (
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

          {currentStep === 3 && (
            <Step3Location
              locationSearch={formData.locationSearch}
              addressText={formData.addressText}
              errors={{
                locationSearch: errors.locationSearch,
                addressText: errors.addressText,
              }}
              onChangeLocationSearch={(val) => {
                setFormData((prev) => ({ ...prev, locationSearch: val }));
                if (errors.locationSearch) {
                  setErrors((prev) => ({ ...prev, locationSearch: undefined }));
                }
              }}
              onChangeAddressText={(val) =>
                setFormData((prev) => ({ ...prev, addressText: val }))
              }
            />
          )}

          {currentStep === 4 && (
            <Step4Evidence
              imageFile={formData.imageFile}
              imagePreviewUrl={formData.imagePreviewUrl}
              error={errors.image}
              onImageSelected={handleImageSelected}
              onImageRemoved={handleImageRemoved}
              onError={(msg) => setErrors((prev) => ({ ...prev, image: msg }))}
              onClearError={() => setErrors((prev) => ({ ...prev, image: undefined }))}
            />
          )}

          {currentStep === 5 && (
            <Step5Review
              formData={formData}
              onEditStep={(step) => {
                setCurrentStep(step);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onReset={handleReset}
              onNavigateToTrack={onNavigateToTrack}
            />
          )}

          {/* Navigation Buttons for Steps 1 - 4 */}
          {currentStep < 5 && (
            <div className="mt-8 pt-6 border-t border-brand-slate-100 flex items-center justify-between">
              {currentStep > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={handleBack}
                  icon={<ArrowLeft className="w-4 h-4" />}
                >
                  Back
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onBackToHome}
                >
                  Cancel
                </Button>
              )}

              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleNext}
                className="ml-auto"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};
