import React from 'react';
import { Shield, Lock, MapPin } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-brand-slate-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          {/* Brand Info */}
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-brand-teal-600 flex items-center justify-center text-white">
                <Shield className="w-4 h-4" />
              </div>
              <span className="font-bold text-base text-brand-slate-900">Civic Trust</span>
            </div>
            <p className="mt-2 text-xs text-brand-slate-600 leading-relaxed max-w-sm">
              A civic grievance service helping Mysuru citizens report neighborhood issues and stay informed through resolution.
            </p>
          </div>

          {/* Privacy & Evidence Principles */}
          <div>
            <h4 className="text-xs font-semibold text-brand-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-brand-teal-700" />
              Citizen Privacy &amp; Data
            </h4>
            <p className="text-xs text-brand-slate-600 leading-relaxed">
              Your personal contact details are protected and never made public. Photo uploads are used solely as evidence to assist ward engineers during on-site inspections.
            </p>
          </div>

          {/* Jurisdiction */}
          <div>
            <h4 className="text-xs font-semibold text-brand-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-brand-teal-700" />
              Coverage Area
            </h4>
            <p className="text-xs text-brand-slate-600 leading-relaxed">
              Serving all 65 wards and 9 administrative zones under the Mysuru City Corporation (MCC) jurisdiction.
            </p>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-brand-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-brand-slate-500">
          <p>© {new Date().getFullYear()} Civic Trust — Mysuru Civic Services.</p>
          <p className="text-brand-slate-600">Citizen-Focused • Accessible • Transparent</p>
        </div>
      </div>
    </footer>
  );
};
