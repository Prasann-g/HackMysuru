import React, { useRef, useState } from 'react';
import { Camera, Upload, AlertCircle, X, CheckCircle2, Info } from 'lucide-react';
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

    if (!ACCEPTED_TYPES.includes(file.type)) {
      onError('Unsupported image format. Please upload a JPEG, PNG, or WebP photo.');
      return;
    }

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

  const handleRemove = () => {
    onImageRemoved();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-bridge-charcoal-900">
            Attach Visual Evidence
          </h2>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-bridge-almond-100 text-bridge-charcoal-600">
            Optional
          </span>
        </div>
        <p className="text-xs sm:text-sm text-bridge-charcoal-600 mt-1">
          Upload a clear photograph of the civic problem. If you don't have a photo right now, you can skip this step.
        </p>
      </div>

      {/* Clear Evidence Notice (AGENTS.md Section 7 Compliance) */}
      <div className="p-3.5 rounded-xl bg-bridge-almond-50 border border-bridge-almond-200 text-bridge-charcoal-800 space-y-1">
        <div className="flex items-center gap-2 font-semibold text-xs text-bridge-charcoal-900">
          <Info className="w-4 h-4 text-bridge-gold-700 shrink-0" />
          <span>Evidence Guidelines</span>
        </div>
        <p className="text-xs text-bridge-charcoal-600 leading-relaxed">
          Photos taken with GPS Map Camera applications (displaying location and time stamps) are welcomed as supporting visual evidence. In accordance with platform policy, visual stamps are evaluated as submitted evidence during verification.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2 animate-fadeIn"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Upload Box or Image Preview */}
      {!imagePreviewUrl ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-150 flex flex-col items-center justify-center gap-3 ${
            isDragging
              ? 'border-bridge-gold-500 bg-bridge-gold-50/60'
              : 'border-bridge-almond-300 hover:border-bridge-gold-400 bg-white hover:bg-bridge-almond-50/30'
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
          <div className="w-12 h-12 rounded-xl bg-bridge-gold-50 border border-bridge-gold-200 flex items-center justify-center text-bridge-gold-700">
            <Upload className="w-6 h-6" />
          </div>

          <div>
            <span className="text-sm font-semibold text-bridge-charcoal-900 block">
              Click to browse or drag and drop photo here
            </span>
            <span className="text-xs text-bridge-charcoal-500 block mt-1">
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
        <div className="bg-white border border-bridge-almond-200 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-semibold text-bridge-charcoal-900 truncate max-w-xs">
                {imageFile?.name || 'Photo Attached'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleRemove}
              className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1 p-1 rounded hover:bg-rose-50 cursor-pointer transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>Remove</span>
            </button>
          </div>

          <div className="relative rounded-xl overflow-hidden bg-bridge-charcoal-900 max-h-72 flex items-center justify-center border border-bridge-almond-200">
            <img
              src={imagePreviewUrl}
              alt="Submitted evidence preview"
              className="max-h-72 object-contain w-auto rounded-lg"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-bridge-charcoal-500 pt-2 border-t border-bridge-almond-100">
            <span>
              Size: {imageFile ? (imageFile.size / 1024).toFixed(0) : 0} KB
            </span>
            <span>
              Type: {imageFile?.type || 'Image'}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              Replace Photo
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
