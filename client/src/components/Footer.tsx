import React from 'react';
import { Lock, MapPin } from 'lucide-react';
import { BrandLogo } from './common/BrandLogo';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-bridge-almond-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          {/* Brand Info */}
          <div>
            <BrandLogo size="sm" variant="full" showSubtitle={false} />
            <p className="mt-2 text-xs text-bridge-charcoal-600 leading-relaxed max-w-sm">
              A civic grievance service helping Mysuru citizens report neighborhood issues and stay informed through resolution.
            </p>
          </div>

          {/* Privacy & Evidence Principles */}
          <div>
            <h4 className="text-xs font-semibold text-bridge-charcoal-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-bridge-gold-700" />
              Citizen Privacy &amp; Data
            </h4>
            <p className="text-xs text-bridge-charcoal-600 leading-relaxed">
              Your personal contact details are protected and never made public. Photo uploads are used solely as evidence to assist ward engineers during on-site inspections.
            </p>
          </div>

          {/* Jurisdiction */}
          <div>
            <h4 className="text-xs font-semibold text-bridge-charcoal-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-bridge-gold-700" />
              Coverage Area
            </h4>
            <p className="text-xs text-bridge-charcoal-600 leading-relaxed">
              Serving all 65 wards and 9 administrative zones under the Mysuru City Corporation (MCC) jurisdiction.
            </p>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-bridge-almond-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-bridge-charcoal-500">
          <p>© {new Date().getFullYear()} CivicBridge — Mysuru Civic Services.</p>
          <p className="text-bridge-charcoal-600">Citizen-Focused • Accessible • Transparent</p>
        </div>
      </div>
    </footer>
  );
};
