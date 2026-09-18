import React, { useRef, useState } from 'react';
import { Camera, Upload, AlertCircle, X, CheckCircle, ShieldAlert } from 'lucide-react';
import { Button } from '../ui/Button';

interface Step4Props {
  imageFile: File | null;
  imagePreviewUrl: string | null;
  error?: string;
  onImageSelected: (file: File) => void;
  onImageRemoved: () => void;
  onError: (msg: string) => void;
  onClearError: () => void;
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export const Step4Evidence: React.FC<Step4Props> = ({
  imageFile,
  imagePreviewUrl,
  error,
  onImageSelected,
  onImageRemoved,
  onError,
  onClearError,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleProcessFile = (file: File) => {
    onClearError();

    // Validate type
    if (!ACCEPTED_TYPES.includes(file.type)) {
      onError('Unsupported image format. Please upload a JPEG, PNG, or WebP image.');
      return;
    }

    // Validate size
    if (file.size > MAX_SIZE_BYTES) {
      onError(`File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed size is ${MAX_SIZE_MB} MB.`);
      return;
    }

    onImageSelected(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleProcessFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-brand-slate-900">
          Upload photo evidence
        </h2>
        <p className="text-xs sm:text-sm text-brand-slate-600 mt-1">
          Attach a photograph of the civic problem, ideally taken with the GPS Map Camera app showing visible location and timestamp stamps.
        </p>
      </div>

      {/* Mandatory Evidence & GPS Map Camera Notice (AGENTS.md Section 7) */}
      <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-900 space-y-2">
        <div className="flex items-center gap-2 font-semibold text-xs sm:text-sm text-amber-950">
          <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
          <span>GPS Map Camera Evidence Notice (Section 7 Compliance)</span>
        </div>
        <div className="text-xs text-amber-900 leading-relaxed space-y-1">
          <p>
            Visible stamps (latitude, longitude, date, time) on photos from the GPS Map Camera application are treated as <strong>submitted evidence only</strong>, not definitive proof of authenticity or location.
          </p>
          <p className="text-amber-800 text-[11px] italic">
            Note: Automated OCR and EXIF metadata extraction are not active in this frontend prototype. We do not claim this photo has been verified.
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Upload Box or Image Preview */}
      {!imagePreviewUrl ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-150 flex flex-col items-center justify-center gap-3 ${
            isDragging
              ? 'border-brand-teal-600 bg-brand-teal-50/50'
              : 'border-brand-slate-300 hover:border-brand-teal-400 bg-white hover:bg-brand-slate-50'
          }`}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              fileInputRef.current?.click();
            }
          }}
          aria-label="Upload photo evidence"
        >
          <div className="w-12 h-12 rounded-xl bg-brand-teal-50 border border-brand-teal-200 flex items-center justify-center text-brand-teal-700">
            <Upload className="w-6 h-6" />
          </div>

          <div>
            <span className="text-sm font-semibold text-brand-slate-900 block">
              Click to browse or drag and drop image here
            </span>
            <span className="text-xs text-brand-slate-500 block mt-1">
              Supports JPEG, PNG, WebP (Max file size: {MAX_SIZE_MB} MB)
            </span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={<Camera className="w-3.5 h-3.5" />}
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            Select Photo
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileInputChange}
            className="hidden"
            aria-hidden="true"
          />
        </div>
      ) : (
        /* Image Preview Box */
        <div className="bg-white border border-brand-slate-200 rounded-2xl p-5 shadow-civic-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-semibold text-brand-slate-900">
                Photo Selected ({imageFile?.name})
              </span>
            </div>
            <button
              type="button"
              onClick={onImageRemoved}
              className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1 p-1 rounded hover:bg-rose-50 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Remove</span>
            </button>
          </div>

          <div className="relative rounded-xl overflow-hidden bg-brand-slate-900 max-h-80 flex items-center justify-center border border-brand-slate-200">
            <img
              src={imagePreviewUrl}
              alt="Submitted complaint evidence preview"
              className="max-h-80 object-contain w-auto rounded-lg"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-brand-slate-500 pt-2 border-t border-brand-slate-100">
            <span>
              Size: {imageFile ? (imageFile.size / 1024).toFixed(0) : 0} KB
            </span>
            <span>
              Format: {imageFile?.type || 'Image'}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              Change Photo
            </Button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileInputChange}
            className="hidden"
            aria-hidden="true"
          />
        </div>
      )}
    </div>
  );
};
