import React, { useState } from 'react';
import {
  Search,
  AlertCircle,
  Info,
  Loader2,
  X,
  ShieldCheck,
  Eye,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { apiTrackComplaint, type ComplaintRecord } from '../../services/api';

export interface InspectDossierCardProps {
  complaints: ComplaintRecord[];
  onSelectComplaint: (id: string) => void;
  className?: string;
}

/**
 * InspectDossierCard — Dedicated "Inspect Dossier" Search & Lookup Box
 *
 * Visually matches the existing "Report Grievance" and "Track Complaint" boxes exactly.
 * Built with the CivicBridge warm ivory, almond, champagne gold, and charcoal design tokens.
 * Allows officers to query by complaint ID or tracking token to inspect evidence, GPS coordinates,
 * duplicate signals, and follow-through logs in the OfficerDetailDrawer.
 */
export const InspectDossierCard: React.FC<InspectDossierCardProps> = ({
  complaints,
  onSelectComplaint,
  className = '',
}) => {
  const [tokenInput, setTokenInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = tokenInput.trim().replace(/^#/, '');

    if (!clean) {
      setError('Please enter a complaint ID or tracking token to inspect.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const lower = clean.toLowerCase();
      // 1. Check local complaints queue in memory
      const matched = complaints.find(
        (c) =>
          c.id.toLowerCase() === lower ||
          c.trackingToken.toLowerCase() === lower
      );

      if (matched) {
        onSelectComplaint(matched.id);
        setLoading(false);
        return;
      }

      // 2. Query backend tracking endpoint if not in local memory
      const result = await apiTrackComplaint(clean);
      if (result && result.id) {
        onSelectComplaint(result.id);
      } else {
        setError(
          `No complaint record found matching "${clean}". Verify the ID or tracking token and retry.`
        );
      }
    } catch (err: any) {
      setError(
        err.message ||
          `No complaint record found matching "${clean}". Verify the ID or tracking token and retry.`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setTokenInput('');
    setError(null);
  };

  return (
    <div
      className={`bg-gradient-to-b from-white via-white to-bridge-ivory-50/80 border border-bridge-almond-200 rounded-2xl p-5 sm:p-6 lg:p-7 shadow-bridge-card space-y-5 transition-all ${className}`}
    >
      {/* 1. Header & Civic Identifier */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-bridge-gold-50 border border-bridge-gold-200 flex items-center justify-center text-bridge-gold-700 shrink-0 shadow-2xs">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-bridge-charcoal-900 tracking-tight">
                Inspect Dossier
              </h2>
              <Badge
                variant="neutral"
                size="sm"
                icon={<ShieldCheck className="w-3.5 h-3.5 text-bridge-gold-700" />}
              >
                MCC Officer Operations
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-bridge-charcoal-600 mt-0.5 leading-relaxed">
              Examine comprehensive verification signals, duplicate cluster evidence, GPS metadata, and timeline audit records for any complaint.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Interactive Search Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <label
            htmlFor="officer-dossier-search-input"
            className="block text-xs font-semibold text-bridge-charcoal-700 uppercase tracking-wider"
          >
            Complaint ID or Tracking Token <span className="text-rose-500 font-bold">*</span>
          </label>

          <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-bridge-charcoal-400">
                <Search className="w-4 h-4" />
              </div>

              <input
                id="officer-dossier-search-input"
                type="text"
                value={tokenInput}
                onChange={(e) => {
                  setTokenInput(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Enter complaint ID (e.g. MCC-2026-...) or tracking token (e.g. TRK-...)"
                aria-invalid={!!error}
                aria-describedby={error ? 'dossier-token-error' : 'dossier-token-hint'}
                className={`civic-input w-full pl-10 pr-10 py-2.5 sm:py-3 text-xs sm:text-sm font-mono tracking-wide bg-white border rounded-xl text-bridge-charcoal-900 placeholder:text-bridge-charcoal-400 placeholder:font-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-gold-500 transition-all shadow-2xs ${
                  error
                    ? 'border-rose-400 bg-rose-50/20 text-rose-900'
                    : 'border-bridge-almond-300 hover:border-bridge-gold-400 focus:border-bridge-gold-500'
                }`}
              />

              {tokenInput && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-bridge-charcoal-400 hover:text-bridge-charcoal-700 cursor-pointer transition-colors"
                  title="Clear input"
                  aria-label="Clear input"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={loading}
              className="shrink-0 px-6 py-2.5 sm:py-3 font-semibold shadow-xs transition-all duration-200"
              icon={
                loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Eye className="w-4 h-4" />
                )
              }
            >
              {loading ? 'Retrieving...' : 'Inspect Dossier'}
            </Button>
          </div>
        </div>

        {/* 3. Inline Error State */}
        {error && (
          <div
            id="dossier-token-error"
            role="alert"
            className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2.5 animate-fadeIn"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5 flex-1">
              <span className="font-semibold block text-rose-900">Dossier Not Found</span>
              <span className="leading-relaxed">{error}</span>
            </div>
          </div>
        )}

        {/* 4. Secondary Helper Text */}
        <div
          id="dossier-token-hint"
          className="pt-2 border-t border-bridge-almond-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] sm:text-xs text-bridge-charcoal-500"
        >
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-bridge-gold-700 shrink-0" />
            <span>
              Directly inspect complaint dossiers by ID format <code className="px-1 py-0.5 rounded bg-bridge-almond-100 font-mono font-semibold text-bridge-charcoal-800 text-[11px]">MCC-2026-XXXX</code> or token <code className="px-1 py-0.5 rounded bg-bridge-almond-100 font-mono font-semibold text-bridge-charcoal-800 text-[11px]">TRK-XXXX-XXXX</code>.
            </span>
          </div>
          <span className="text-bridge-charcoal-400">
            You can also click "Inspect Dossier" on any record in the queue below.
          </span>
        </div>
      </form>
    </div>
  );
};
