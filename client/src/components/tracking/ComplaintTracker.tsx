import React, { useState } from 'react';
import {
  Search,
  AlertCircle,
  Info,
  Loader2,
  X,
  ShieldCheck,
  FileSearch,
  ArrowUpRight,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { apiTrackComplaint } from '../../services/api';

export interface ComplaintTrackerProps {
  initialToken?: string;
  onTrack?: (token: string) => void;
  onOpenFullPage?: (token?: string) => void;
  onReportIssue?: () => void;
  onBackToHome?: () => void;
  className?: string;
}

/**
 * ComplaintTracker — Visible Track Complaint Box
 * 
 * Enterprise municipal search card displayed on the citizen dashboard.
 * Designed with the CivicBridge warm ivory, almond, champagne gold, and charcoal design system.
 * Submits to the real backend tracking API and opens the detailed lifecycle tracking drawer upon success.
 */
export const ComplaintTracker: React.FC<ComplaintTrackerProps> = ({
  initialToken = '',
  onTrack,
  onOpenFullPage,
  className = '',
}) => {
  const [tokenInput, setTokenInput] = useState(initialToken);
  const [prevInitialToken, setPrevInitialToken] = useState(initialToken);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (initialToken !== prevInitialToken) {
    setPrevInitialToken(initialToken);
    setTokenInput(initialToken);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = tokenInput.trim();

    if (!clean) {
      setError('Please enter your tracking token to check status.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Query the real backend tracking endpoint
      const result = await apiTrackComplaint(clean);
      // Valid token confirmed by backend -> open full tracking portal or drawer
      if (onOpenFullPage) {
        onOpenFullPage(result.trackingToken || clean);
      } else {
        onTrack?.(result.trackingToken || clean);
      }
    } catch (err: any) {
      setError(
        err.message ||
          'Grievance not found with the provided tracking token. Please verify the code and try again.'
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
            <FileSearch className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-bridge-charcoal-900 tracking-tight">
                Track Your Civic Request
              </h2>
              <Badge variant="neutral" size="sm" icon={<ShieldCheck className="w-3.5 h-3.5 text-bridge-gold-700" />}>
                MCC Public Registry
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-bridge-charcoal-600 mt-0.5 leading-relaxed">
              Check real-time remediation progress, verification signals, and department follow-through for any submitted Mysuru complaint.
            </p>
          </div>
        </div>

        {onOpenFullPage && (
          <button
            type="button"
            onClick={() => onOpenFullPage(tokenInput.trim() || undefined)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-bridge-gold-300 bg-bridge-gold-50 hover:bg-bridge-gold-100 text-bridge-gold-900 text-xs font-bold shadow-2xs transition-all duration-150 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-gold-500 self-start sm:self-center"
          >
            <span>Open Full Tracking Portal</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-bridge-gold-700" />
          </button>
        )}
      </div>

      {/* 2. Interactive Search Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <label
            htmlFor="civic-track-token-input"
            className="block text-xs font-semibold text-bridge-charcoal-700 uppercase tracking-wider"
          >
            Tracking Token <span className="text-rose-500 font-bold">*</span>
          </label>

          <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-bridge-charcoal-400">
                <Search className="w-4 h-4" />
              </div>

              <input
                id="civic-track-token-input"
                type="text"
                value={tokenInput}
                onChange={(e) => {
                  setTokenInput(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Enter your tracking token (e.g. TRK-XXXX-XXXX or DEMO-2026-0001)"
                aria-invalid={!!error}
                aria-describedby={error ? 'track-token-error' : 'track-token-hint'}
                className={`w-full pl-10 pr-10 py-2.5 sm:py-3 text-xs sm:text-sm font-mono tracking-wide bg-white border rounded-xl text-bridge-charcoal-900 placeholder:text-bridge-charcoal-400 placeholder:font-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-gold-500 transition-all shadow-2xs ${
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
                  aria-label="Clear tracking token input"
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
                  <Search className="w-4 h-4" />
                )
              }
            >
              {loading ? 'Verifying...' : 'Track Complaint'}
            </Button>
          </div>
        </div>

        {/* 3. Inline Error State (Shown on invalid token or 404 from backend) */}
        {error && (
          <div
            id="track-token-error"
            role="alert"
            className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2.5 animate-fadeIn"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5 flex-1">
              <span className="font-semibold block text-rose-900">Grievance Not Found</span>
              <span className="leading-relaxed">{error}</span>
            </div>
          </div>
        )}

        {/* 4. Secondary Helper Text */}
        <div
          id="track-token-hint"
          className="pt-2 border-t border-bridge-almond-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] sm:text-xs text-bridge-charcoal-500"
        >
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-bridge-gold-700 shrink-0" />
            <span>
              Tracking tokens follow the format <code className="px-1 py-0.5 rounded bg-bridge-almond-100 font-mono font-semibold text-bridge-charcoal-800 text-[11px]">TRK-XXXX-XXXX</code> or demo format <code className="px-1 py-0.5 rounded bg-bridge-almond-100 font-mono font-semibold text-bridge-charcoal-800 text-[11px]">DEMO-2026-XXXX</code>.
            </span>
          </div>
          <span className="text-bridge-charcoal-400">
            Tokens can also be copied directly from your submitted grievances ledger below.
          </span>
        </div>
      </form>
    </div>
  );
};
