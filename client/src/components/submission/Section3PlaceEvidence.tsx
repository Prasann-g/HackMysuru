import React, { useRef, useState } from 'react';
import {
  MapPin,
  Building,
  Navigation,
  CheckCircle2,
  RefreshCw,
  Compass,
  AlertCircle,
  Camera,
  Upload,
  X,
  Info,
} from 'lucide-react';
import { MYSURU_LOCALITIES, isWithinMysuruServiceArea, type GpsStatus } from './types';
import { Button } from '../ui/Button';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

interface Section3Props {
  // Location props
  locationArea: string;
  addressText: string;
  latitude: number | null;
  longitude: number | null;
  gpsAccuracy: number | null;
  gpsStatus: GpsStatus;
  locationErrors: {
    locationArea?: string;
    addressText?: string;
  };
  onChangeLocationArea: (val: string) => void;
  onChangeAddressText: (val: string) => void;
  onGpsCapture: (lat: number, lng: number, accuracy: number) => void;
  onGpsStatusChange: (status: GpsStatus) => void;
  // Evidence props
  imageFile: File | null;
  imagePreviewUrl: string | null;
  imageError?: string;
  onImageSelected: (file: File) => void;
  onImageRemoved: () => void;
  onImageError: (msg: string) => void;
  onImageClearError: () => void;
}

export const Section3PlaceEvidence: React.FC<Section3Props> = ({
  locationArea,
  addressText,
  latitude,
  longitude,
  gpsAccuracy,
  gpsStatus,
  locationErrors,
  onChangeLocationArea,
  onChangeAddressText,
  onGpsCapture,
  onGpsStatusChange,
  imageFile,
  imagePreviewUrl,
  imageError,
  onImageSelected,
  onImageRemoved,
  onImageError,
  onImageClearError,
}) => {
  const [gpsErrorMsg, setGpsErrorMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ------- GPS -------
  const requestGps = () => {
    if (!navigator.geolocation) {
      onGpsStatusChange('unavailable');
      setGpsErrorMsg('GPS geolocation is not supported by your browser.');
      return;
    }
    onGpsStatusChange('locating');
    setGpsErrorMsg(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        const acc = Math.round(position.coords.accuracy);
        onGpsCapture(lat, lng, acc);
        onGpsStatusChange('success');
      },
      (error) => {
        let msg = 'Could not acquire GPS position.';
        if (error.code === error.PERMISSION_DENIED) {
          onGpsStatusChange('denied');
          msg =
            'Location permission was denied. You can still enter your Mysuru locality manually below.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          onGpsStatusChange('unavailable');
          msg = 'Location signal is currently unavailable. Please enter your locality manually.';
        } else if (error.code === error.TIMEOUT) {
          onGpsStatusChange('unavailable');
          msg = 'Location request timed out. Please enter your locality manually.';
        } else {
          onGpsStatusChange('unavailable');
        }
        setGpsErrorMsg(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  // ------- Evidence file handling -------
  const handleProcessFile = (file: File) => {
    onImageClearError();
    if (!ACCEPTED_TYPES.includes(file.type)) {
      onImageError('Unsupported image format. Please upload a JPEG, PNG, or WebP photo.');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      onImageError(
        `File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed size is ${MAX_SIZE_MB} MB.`
      );
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

  const handleRemoveImage = () => {
    onImageRemoved();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-7">
      {/* ── LOCATION ── */}
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-bridge-charcoal-900">
              Location in Mysuru
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
              Required
            </span>
          </div>
          <p className="text-xs text-bridge-charcoal-600 mt-1">
            Tell us where the problem is so the relevant ward and field team can respond.
          </p>
        </div>

        {/* GPS capture */}
        <div className="p-4 rounded-xl bg-bridge-almond-50 border border-bridge-almond-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-bridge-gold-100 flex items-center justify-center shrink-0 mt-0.5">
                <Navigation className="w-4 h-4 text-bridge-gold-700" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-bridge-charcoal-900 flex items-center gap-1.5">
                  Auto-Detect Device Location
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                    Required
                  </span>
                </h3>
                <p className="text-xs text-bridge-charcoal-600 mt-0.5">
                  Device GPS capture is required for verified municipal dispatch.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={requestGps}
              disabled={gpsStatus === 'locating'}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all shrink-0 ${
                gpsStatus === 'locating'
                  ? 'bg-bridge-almond-200 text-bridge-charcoal-500 cursor-wait'
                  : 'bg-white border border-bridge-gold-500 text-bridge-gold-800 hover:bg-bridge-gold-50 shadow-sm cursor-pointer'
              }`}
            >
              {gpsStatus === 'locating' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Acquiring GPS...</span>
                </>
              ) : gpsStatus === 'success' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Re-detect Location</span>
                </>
              ) : (
                <>
                  <Compass className="w-3.5 h-3.5" />
                  <span>Detect My Location</span>
                </>
              )}
            </button>
          </div>

          {gpsStatus === 'success' && latitude !== null && longitude !== null && (
            isWithinMysuruServiceArea(latitude, longitude) ? (
              <div className="mt-3 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between gap-2 animate-fadeIn">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    <strong>GPS Captured:</strong> {latitude.toFixed(5)}° N,{' '}
                    {longitude.toFixed(5)}° E
                    {gpsAccuracy && ` (~${gpsAccuracy}m)`} — Within Mysuru Bounds
                  </span>
                </div>
                <span className="text-[10px] font-semibold uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded shrink-0">
                  Mysuru Verified
                </span>
              </div>
            ) : (
              <div className="mt-3 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start justify-between gap-2 animate-fadeIn">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block">Captured Device Location Outside Mysuru Service Area:</strong>
                    <span>
                      {latitude.toFixed(5)}° N, {longitude.toFixed(5)}° E. The captured device location is outside the supported Mysuru service area (12.15°–12.45° N, 76.50°–76.80° E). The locality entered below does not override the device GPS location. Submission will be rejected at intake.
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-semibold uppercase bg-rose-100 text-rose-800 px-2 py-0.5 rounded shrink-0">
                  Out of Bounds
                </span>
              </div>
            )
          )}

          {gpsErrorMsg && (
            <div className="mt-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>{gpsErrorMsg}</span>
            </div>
          )}
        </div>

        {/* Locality chips */}
        <div>
          <label className="block text-xs font-semibold text-bridge-charcoal-900 mb-1.5">
            Common Mysuru Localities{' '}
            <span className="text-bridge-charcoal-500 font-normal">(tap to select)</span>:
          </label>
          <div className="flex flex-wrap gap-1.5">
            {MYSURU_LOCALITIES.slice(0, 10).map((area) => (
              <button
                key={area}
                type="button"
                onClick={() => onChangeLocationArea(area)}
                className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                  locationArea.toLowerCase() === area.toLowerCase()
                    ? 'bg-bridge-charcoal-800 text-white border-bridge-charcoal-800 font-medium shadow-xs'
                    : 'bg-white border-bridge-almond-200 text-bridge-charcoal-700 hover:bg-bridge-almond-50 hover:border-bridge-gold-300'
                }`}
              >
                {area}
              </button>
            ))}
          </div>
        </div>

        {/* Locality input */}
        <div className="space-y-1.5">
          <label
            htmlFor="location-area"
            className="text-xs font-semibold text-bridge-charcoal-900 flex items-center gap-1.5"
          >
            <MapPin className="w-3.5 h-3.5 text-bridge-gold-700" />
            <span>Mysuru Locality / Ward / Major Landmark</span>
            <span className="text-rose-500 font-bold">*</span>
          </label>
          <input
            id="location-area"
            type="text"
            value={locationArea}
            onChange={(e) => onChangeLocationArea(e.target.value)}
            placeholder="e.g. Kuvempunagar, Gokulam 3rd Stage, Court Circle..."
            aria-invalid={!!locationErrors.locationArea}
            aria-describedby={
              locationErrors.locationArea ? 'location-error' : 'location-hint'
            }
            className={`w-full px-3.5 py-2.5 text-sm bg-white border rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-gold-500 text-bridge-charcoal-900 placeholder:text-bridge-charcoal-400 transition-colors ${
              locationErrors.locationArea
                ? 'border-rose-400 bg-rose-50/20'
                : 'border-bridge-almond-300'
            }`}
          />
          {locationErrors.locationArea ? (
            <p
              id="location-error"
              className="text-xs text-rose-600 flex items-center gap-1.5 animate-fadeIn"
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{locationErrors.locationArea}</span>
            </p>
          ) : (
            <p id="location-hint" className="text-[11px] text-bridge-charcoal-500">
              Specify the known residential locality, commercial area, or prominent junction in Mysuru.
            </p>
          )}
        </div>

        {/* Street address optional */}
        <div className="space-y-1.5">
          <label
            htmlFor="address-text"
            className="text-xs font-semibold text-bridge-charcoal-900 flex items-center gap-1.5"
          >
            <Building className="w-3.5 h-3.5 text-bridge-gold-700" />
            <span>Street Address / Door No. / Landmark Reference</span>
            <span className="text-bridge-charcoal-500 font-normal">(Optional)</span>
          </label>
          <textarea
            id="address-text"
            rows={2}
            value={addressText}
            onChange={(e) => onChangeAddressText(e.target.value)}
            placeholder="e.g. 5th Main, 2nd Cross, opposite government high school..."
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-bridge-almond-300 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-gold-500 text-bridge-charcoal-900 placeholder:text-bridge-charcoal-400 transition-colors resize-none"
          />
          <p className="text-[11px] text-bridge-charcoal-500">
            Specific clues that will help the municipal crew locate the exact spot.
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-bridge-almond-200" />

      {/* ── EVIDENCE ── */}
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-bridge-charcoal-900">
              Attach Photo Evidence
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
              Required
            </span>
          </div>
          <p className="text-xs text-bridge-charcoal-600 mt-1">
            Upload a clear photograph of the civic problem. Photographic evidence is mandatory for verification.
          </p>
        </div>

        {/* Evidence notice — AGENTS.md Section 7 compliance */}
        <div className="p-3.5 rounded-xl bg-bridge-almond-50 border border-bridge-almond-200 space-y-1">
          <div className="flex items-center gap-2 font-semibold text-xs text-bridge-charcoal-900">
            <Info className="w-3.5 h-3.5 text-bridge-gold-700 shrink-0" />
            <span>Evidence Guidelines</span>
          </div>
          <p className="text-xs text-bridge-charcoal-600 leading-relaxed">
            Photos taken with GPS Map Camera applications are welcomed as supporting visual
            evidence. Location and time stamps visible in photos are evaluated as submitted
            evidence during verification — not as proof of authenticity.
          </p>
        </div>

        {imageError && (
          <div
            role="alert"
            className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2 animate-fadeIn"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span className="font-medium">{imageError}</span>
          </div>
        )}

        {/* Upload zone or preview */}
        {!imagePreviewUrl ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-150 flex flex-col items-center justify-center gap-3 ${
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
            <div className="w-11 h-11 rounded-xl bg-bridge-gold-50 border border-bridge-gold-200 flex items-center justify-center text-bridge-gold-700">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <span className="text-sm font-semibold text-bridge-charcoal-900 block">
                Click to browse or drag and drop photo here
              </span>
              <span className="text-xs text-bridge-charcoal-500 block mt-0.5">
                JPEG, PNG, WebP · Max {MAX_SIZE_MB} MB
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
          <div className="bg-white border border-bridge-almond-200 rounded-xl p-4 shadow-bridge-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-xs font-semibold text-bridge-charcoal-900 truncate max-w-[16rem]">
                  {imageFile?.name || 'Photo Attached'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleRemoveImage}
                className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1 p-1 rounded hover:bg-rose-50 cursor-pointer transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>
            </div>
            <div className="relative rounded-lg overflow-hidden bg-bridge-charcoal-900 max-h-56 flex items-center justify-center border border-bridge-almond-200">
              <img
                src={imagePreviewUrl}
                alt="Submitted evidence preview"
                className="max-h-56 object-contain w-auto rounded-lg"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-bridge-charcoal-500 pt-2 border-t border-bridge-almond-100">
              <span>Size: {imageFile ? (imageFile.size / 1024).toFixed(0) : 0} KB</span>
              <span>Type: {imageFile?.type || 'Image'}</span>
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
    </div>
  );
};
