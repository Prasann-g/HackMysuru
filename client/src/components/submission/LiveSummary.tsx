import React from 'react';
import {
  Tag,
  FileText,
  MapPin,
  Camera,
  Navigation,
  CheckCircle2,
} from 'lucide-react';
import type { ComplaintFormData } from './types';

const CATEGORY_LABELS: Record<string, string> = {
  pothole: 'Pothole & Road Damage',
  garbage_dumping: 'Garbage Dumping',
  broken_streetlight: 'Broken Streetlight',
  overflowing_bin: 'Overflowing Public Bin',
  construction_debris: 'Construction Debris',
  unsegregated_waste: 'Unsegregated Waste Pile',
  other: 'Other Civic Grievance',
};

interface LiveSummaryProps {
  formData: ComplaintFormData;
  currentSection: number;
  totalSections: number;
}

interface SummaryRowProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  isEmpty?: boolean;
}

const SummaryRow: React.FC<SummaryRowProps> = ({ icon, label, value, isEmpty }) => (
  <div className="flex items-start gap-2.5">
    <span className={`mt-0.5 shrink-0 ${isEmpty ? 'text-bridge-charcoal-300' : 'text-bridge-gold-600'}`}>
      {icon}
    </span>
    <div className="min-w-0 flex-1">
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-bridge-charcoal-400 mb-0.5">
        {label}
      </span>
      <span
        className={`block text-xs leading-relaxed ${
          isEmpty ? 'text-bridge-charcoal-300 italic' : 'text-bridge-charcoal-800 font-medium'
        }`}
      >
        {value}
      </span>
    </div>
  </div>
);

export const LiveSummary: React.FC<LiveSummaryProps> = ({
  formData,
  currentSection,
  totalSections,
}) => {
  const categoryLabel = formData.category
    ? CATEGORY_LABELS[formData.category] || formData.category
    : null;

  const descWords = formData.description.trim()
    ? formData.description.trim().slice(0, 80) + (formData.description.trim().length > 80 ? '…' : '')
    : null;

  const locationDisplay = formData.locationArea.trim() || null;

  const evidenceDisplay = formData.imageFile
    ? `${formData.imageFile.name.slice(0, 20)}${formData.imageFile.name.length > 20 ? '…' : ''}`
    : null;

  const hasAnyContent =
    !!formData.category ||
    !!formData.description.trim() ||
    !!formData.locationArea.trim() ||
    !!formData.imageFile;

  const completedPercent = Math.max(0, ((currentSection - 1) / totalSections) * 100);

  return (
    <aside
      aria-label="Request summary"
      className="flex flex-col bg-white border border-bridge-almond-200 rounded-xl shadow-bridge-sm overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-bridge-almond-200 bg-bridge-almond-50/60">
        <h3 className="text-xs font-bold text-bridge-charcoal-900 uppercase tracking-wider">
          Your Request
        </h3>
        <p className="text-[10px] text-bridge-charcoal-500 mt-0.5">
          Updates as you fill in each section
        </p>
      </div>

      {/* Content rows */}
      <div className="flex-1 p-4 space-y-4">
        {!hasAnyContent && (
          <p className="text-[11px] text-bridge-charcoal-400 italic text-center py-4">
            Your details will appear here as you complete each section.
          </p>
        )}

        <SummaryRow
          icon={<Tag className="w-3.5 h-3.5" />}
          label="Issue Type"
          value={categoryLabel || 'Not selected yet'}
          isEmpty={!categoryLabel}
        />

        <SummaryRow
          icon={<FileText className="w-3.5 h-3.5" />}
          label="Description"
          value={descWords || 'Not described yet'}
          isEmpty={!descWords}
        />

        <SummaryRow
          icon={<MapPin className="w-3.5 h-3.5" />}
          label="Location"
          value={locationDisplay || 'Not specified yet'}
          isEmpty={!locationDisplay}
        />

        {/* GPS mini-indicator */}
        {formData.gpsStatus === 'success' && formData.latitude && formData.longitude && (
          <div className="flex items-center gap-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
            <Navigation className="w-3 h-3 text-emerald-600 shrink-0" />
            <span className="text-[10px] text-emerald-700 font-mono font-medium">
              {formData.latitude.toFixed(4)}° N, {formData.longitude.toFixed(4)}° E
            </span>
            <CheckCircle2 className="w-3 h-3 text-emerald-600 ml-auto shrink-0" />
          </div>
        )}

        <SummaryRow
          icon={<Camera className="w-3.5 h-3.5" />}
          label="Evidence"
          value={evidenceDisplay || 'No photo attached'}
          isEmpty={!evidenceDisplay}
        />

        {/* Photo thumbnail if attached */}
        {formData.imagePreviewUrl && (
          <div className="rounded-lg overflow-hidden border border-bridge-almond-200 bg-bridge-charcoal-900 aspect-video flex items-center justify-center">
            <img
              src={formData.imagePreviewUrl}
              alt="Evidence thumbnail"
              className="w-full h-full object-cover opacity-90"
            />
          </div>
        )}
      </div>

      {/* Progress footer */}
      <div className="px-4 py-3 border-t border-bridge-almond-200 bg-bridge-almond-50/40">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-bridge-charcoal-400">
            Readiness
          </span>
          <span className="text-[10px] font-bold text-bridge-charcoal-600">
            {Math.round(completedPercent)}%
          </span>
        </div>
        <div className="w-full h-1.5 bg-bridge-almond-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-bridge-gold-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${completedPercent}%` }}
          />
        </div>
        {completedPercent === 0 && (
          <p className="text-[10px] text-bridge-charcoal-400 mt-1.5">
            Begin with Section 1 to get started.
          </p>
        )}
        {completedPercent > 0 && completedPercent < 100 && (
          <p className="text-[10px] text-bridge-charcoal-500 mt-1.5">
            {totalSections - (currentSection - 1)} section(s) remaining.
          </p>
        )}
      </div>
    </aside>
  );
};
