import React from 'react';
import { MapPin, Info, AlertCircle, Building } from 'lucide-react';

interface Step3Props {
  locationSearch: string;
  addressText: string;
  errors: {
    locationSearch?: string;
    addressText?: string;
  };
  onChangeLocationSearch: (val: string) => void;
  onChangeAddressText: (val: string) => void;
}

export const Step3Location: React.FC<Step3Props> = ({
  locationSearch,
  addressText,
  errors,
  onChangeLocationSearch,
  onChangeAddressText,
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-bridge-charcoal-900">
          Specify the location in Mysuru
        </h2>
        <p className="text-xs sm:text-sm text-bridge-charcoal-600 mt-1">
          Provide the Mysuru area, landmark, or street name to assist in ward assignment and duplicate detection.
        </p>
      </div>

      {/* Mandatory Notice: Live Map Integration Not Implemented */}
      <div className="p-4 rounded-xl bg-bridge-almond-50 border border-bridge-almond-200 text-bridge-charcoal-800 space-y-2">
        <div className="flex items-center gap-2 font-semibold text-xs sm:text-sm text-bridge-charcoal-900">
          <Info className="w-4 h-4 text-bridge-gold-700 shrink-0" />
          <span>Notice: Live Map Integration is Not Implemented Yet</span>
        </div>
        <p className="text-xs text-bridge-charcoal-600 leading-relaxed">
          Interactive map pinpointing and reverse geocoding will be connected in subsequent phases. Please enter the area, landmark, or street name manually. In compliance with the anti-hallucination rules, coordinates or map pins are not invented or faked.
        </p>
      </div>

      {/* Area / Landmark Search Input */}
      <div className="space-y-1.5">
        <label
          htmlFor="location-search"
          className="block text-xs font-semibold text-bridge-charcoal-900 flex items-center gap-1.5"
        >
          <MapPin className="w-3.5 h-3.5 text-bridge-gold-700" />
          <span>Mysuru Area or Landmark</span>
          <span className="text-rose-500 font-bold">*</span>
        </label>

        <input
          id="location-search"
          type="text"
          value={locationSearch}
          onChange={(e) => onChangeLocationSearch(e.target.value)}
          placeholder="e.g. Kuvempunagar, Gokulam 3rd Stage, Court Circle, Vijayanagar..."
          aria-invalid={!!errors.locationSearch}
          aria-describedby={errors.locationSearch ? 'location-error' : 'location-hint'}
          className={`w-full px-3.5 py-2.5 text-sm bg-white border rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-gold-500 text-bridge-charcoal-900 placeholder:text-bridge-charcoal-400 transition-colors ${
            errors.locationSearch
              ? 'border-rose-400 bg-rose-50/20'
              : 'border-bridge-almond-300'
          }`}
        />

        {errors.locationSearch ? (
          <p id="location-error" className="text-xs text-rose-600 flex items-center gap-1 mt-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{errors.locationSearch}</span>
          </p>
        ) : (
          <p id="location-hint" className="text-[11px] text-bridge-charcoal-500">
            Specify the known locality or major junction in Mysuru.
          </p>
        )}
      </div>

      {/* Specific Street Address Text Input */}
      <div className="space-y-1.5">
        <label
          htmlFor="address-text"
          className="block text-xs font-semibold text-bridge-charcoal-900 flex items-center gap-1.5"
        >
          <Building className="w-3.5 h-3.5 text-bridge-gold-700" />
          <span>Street Address / Door Number / Additional Directions</span>
          <span className="text-bridge-charcoal-500 font-normal">(Optional)</span>
        </label>

        <textarea
          id="address-text"
          rows={3}
          value={addressText}
          onChange={(e) => onChangeAddressText(e.target.value)}
          placeholder="e.g. 5th Cross, Near water tank, opposite government primary school..."
          className="w-full px-3.5 py-2.5 text-sm bg-white border border-bridge-almond-300 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-gold-500 text-bridge-charcoal-900 placeholder:text-bridge-charcoal-400 transition-colors"
        />

        <p className="text-[11px] text-bridge-charcoal-500">
          Additional physical reference points to help the ward engineer locate the site.
        </p>
      </div>
    </div>
  );
};
