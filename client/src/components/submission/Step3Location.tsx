import React, { useState } from 'react';
import {
  MapPin,
  AlertCircle,
  Building,
  Navigation,
  CheckCircle2,
  RefreshCw,
  Compass,
} from 'lucide-react';
import { MYSURU_LOCALITIES, type GpsStatus } from './types';

interface Step3Props {
  locationArea: string;
  addressText: string;
  latitude: number | null;
  longitude: number | null;
  gpsAccuracy: number | null;
  gpsStatus: GpsStatus;
  errors: {
    locationArea?: string;
    addressText?: string;
  };
  onChangeLocationArea: (val: string) => void;
  onChangeAddressText: (val: string) => void;
  onGpsCapture: (lat: number, lng: number, accuracy: number) => void;
  onGpsStatusChange: (status: GpsStatus) => void;
}

export const Step3Location: React.FC<Step3Props> = ({
  locationArea,
  addressText,
  latitude,
  longitude,
  gpsAccuracy,
  gpsStatus,
  errors,
  onChangeLocationArea,
  onChangeAddressText,
  onGpsCapture,
  onGpsStatusChange,
}) => {
  const [gpsErrorMsg, setGpsErrorMsg] = useState<string | null>(null);

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
          msg = 'Location permission was denied. You can still enter your Mysuru locality manually below.';
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
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-bridge-charcoal-900">
            Specify Location in Mysuru
          </h2>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-bridge-almond-100 text-bridge-charcoal-600">
            Required
          </span>
        </div>
        <p className="text-xs sm:text-sm text-bridge-charcoal-600 mt-1">
          Tell us where this problem is located so the relevant ward jurisdiction and field team can respond.
        </p>
      </div>

      {/* GPS Location Capture Section */}
      <div className="p-4 rounded-xl bg-bridge-almond-50 border border-bridge-almond-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-bridge-gold-100 flex items-center justify-center shrink-0 mt-0.5">
              <Navigation className="w-4 h-4 text-bridge-gold-700" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-semibold text-bridge-charcoal-900 flex items-center gap-1.5">
                <span>Auto-Detect Device Location</span>
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

        {/* GPS Active Result */}
        {gpsStatus === 'success' && latitude && longitude && (
          <div className="mt-3.5 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between gap-2 animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>GPS Coordinates Detected:</strong> {latitude.toFixed(5)}° N, {longitude.toFixed(5)}° E
                {gpsAccuracy && ` (Accuracy: ~${gpsAccuracy}m)`}
              </span>
            </div>
            <span className="text-[10px] font-semibold uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
              Captured
            </span>
          </div>
        )}

        {/* GPS Error or Denied Note */}
        {gpsErrorMsg && (
          <div className="mt-3.5 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{gpsErrorMsg}</span>
          </div>
        )}
      </div>

      {/* Locality Quick Selection Chips */}
      <div>
        <label className="block text-xs font-semibold text-bridge-charcoal-900 mb-1.5">
          Common Mysuru Localities <span className="text-bridge-charcoal-500 font-normal">(Click to select)</span>:
        </label>
        <div className="flex flex-wrap gap-1.5">
          {MYSURU_LOCALITIES.slice(0, 8).map((area) => (
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

      {/* Area / Landmark Search Input */}
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
          placeholder="e.g. Kuvempunagar, Gokulam 3rd Stage, Vijayanagar, Court Circle..."
          aria-invalid={!!errors.locationArea}
          aria-describedby={errors.locationArea ? 'location-error' : 'location-hint'}
          className={`w-full px-3.5 py-2.5 text-sm bg-white border rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-gold-500 text-bridge-charcoal-900 placeholder:text-bridge-charcoal-400 transition-colors ${
            errors.locationArea
              ? 'border-rose-400 bg-rose-50/20'
              : 'border-bridge-almond-300'
          }`}
        />

        {errors.locationArea ? (
          <p id="location-error" className="text-xs text-rose-600 flex items-center gap-1.5 animate-fadeIn">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{errors.locationArea}</span>
          </p>
        ) : (
          <p id="location-hint" className="text-[11px] text-bridge-charcoal-500">
            Specify the known residential locality, commercial area, or prominent junction in Mysuru.
          </p>
        )}
      </div>

      {/* Specific Street Address Text Input */}
      <div className="space-y-1.5">
        <label
          htmlFor="address-text"
          className="text-xs font-semibold text-bridge-charcoal-900 flex items-center gap-1.5"
        >
          <Building className="w-3.5 h-3.5 text-bridge-gold-700" />
          <span>Street Address / Door Number / Landmark Reference</span>
          <span className="text-bridge-charcoal-500 font-normal">(Optional)</span>
        </label>

        <textarea
          id="address-text"
          rows={3}
          value={addressText}
          onChange={(e) => onChangeAddressText(e.target.value)}
          placeholder="e.g. 5th Main, 2nd Cross, opposite government high school, near overhead water tank..."
          className="w-full px-3.5 py-2.5 text-sm bg-white border border-bridge-almond-300 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-gold-500 text-bridge-charcoal-900 placeholder:text-bridge-charcoal-400 transition-colors"
        />

        <p className="text-[11px] text-bridge-charcoal-500">
          Specific physical clues that will assist the municipal crew in locating the exact spot on the ground.
        </p>
      </div>
    </div>
  );
};
