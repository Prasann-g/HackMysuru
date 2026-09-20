import React, { useState, useEffect } from 'react';
import {
  X,
  Lock,
  Mail,
  Building2,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { BrandLogo } from '../common/BrandLogo';
import type { CitizenUser } from '../../types/auth';
import { apiLogin, clearStoredToken } from '../../services/api';

export interface OfficerLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: CitizenUser) => void;
  onSwitchToCitizen?: () => void;
}

export const OfficerLoginModal: React.FC<OfficerLoginModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  onSwitchToCitizen,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Reset form when modal opens
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setEmail('');
      setPassword('');
      setError(null);
    }
  }

  // Keyboard accessibility: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError('Please enter a valid official MCC email address.');
      return;
    }

    if (!password) {
      setError('Please enter your officer account password.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiLogin({
        email: trimmedEmail,
        password,
      });

      // RBAC Gate: Ensure unauthorized non-officer accounts cannot enter the Officer Console
      if (response.user.role !== 'OFFICER' && response.user.role !== 'ADMIN') {
        clearStoredToken();
        setError(
          'Access restricted to verified MCC Officers and Administrators. Citizen accounts cannot access the Officer Console. Please use Citizen Login.'
        );
        return;
      }

      onAuthSuccess(response.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bridge-charcoal-900/50 backdrop-blur-xs animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="officer-portal-title"
    >
      <div className="bg-surface-white rounded-2xl max-w-md w-full p-6 sm:p-7 shadow-bridge-modal border border-bridge-almond-200 relative">
        {/* Modal Top Bar: Emblem & Close */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo variant="full" size="md" />
          </div>
          <button
            onClick={onClose}
            className="text-bridge-charcoal-400 hover:text-bridge-charcoal-700 hover:bg-bridge-almond-100 active:scale-95 transition-all duration-150 p-1.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-gold-500 cursor-pointer"
            aria-label="Close officer portal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Official Jurisdiction Sub-Header */}
        <div className="mt-5 pb-4 border-b border-bridge-almond-200">
          <div className="flex items-center gap-2 mb-1.5">
            <Badge variant="verified" size="sm">
              <span className="flex items-center gap-1 font-mono tracking-wider text-[10px]">
                <Building2 className="w-3 h-3 text-emerald-700" />
                MCC INTERNAL SYSTEMS
              </span>
            </Badge>
            <span className="text-[11px] font-medium text-bridge-charcoal-500">
              Restricted Access
            </span>
          </div>
          <h2
            id="officer-portal-title"
            className="text-lg font-bold text-bridge-charcoal-900 tracking-tight"
          >
            MCC Officer Portal
          </h2>
          <p className="text-xs text-bridge-charcoal-600 mt-1 leading-relaxed">
            Mysuru City Corporation — Municipal Grievance Verification &amp; Review Console.
          </p>
        </div>

        {/* Security & Official Advisory Notice */}
        <div className="mt-4 p-3 rounded-lg bg-bridge-almond-50 border border-bridge-almond-200/80 text-[11px] text-bridge-charcoal-700 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-bridge-charcoal-900">
            <ShieldCheck className="w-3.5 h-3.5 text-bridge-gold-600 shrink-0" />
            <span>Authorized Personnel Authentication</span>
          </div>
          <p className="leading-normal text-bridge-charcoal-600">
            Access to this console is restricted to designated MCC ward engineers and administrative officers. All login sessions are audited.
          </p>
        </div>

        {/* Officer Authentication Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-start gap-2 animate-fadeIn"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <div>
            <label
              htmlFor="officer-email"
              className="block text-xs font-semibold text-bridge-charcoal-900 mb-1"
            >
              Official MCC Email / ID <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-bridge-charcoal-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                id="officer-email"
                type="email"
                disabled={isLoading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="officer.ward48@mcc.gov.in"
                className="civic-input w-full pl-9 pr-3 py-2 text-sm rounded-lg text-bridge-charcoal-900 disabled:opacity-60 transition-all duration-150"
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="officer-password"
              className="block text-xs font-semibold text-bridge-charcoal-900 mb-1"
            >
              Security Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-bridge-charcoal-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                id="officer-password"
                type="password"
                disabled={isLoading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="civic-input w-full pl-9 pr-3 py-2 text-sm rounded-lg text-bridge-charcoal-900 disabled:opacity-60 transition-all duration-150"
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isLoading}
              className="w-full"
              icon={
                isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )
              }
            >
              {isLoading ? 'Verifying Credentials...' : 'Sign In to Officer Console'}
            </Button>
          </div>
        </form>

        {/* Back to Citizen Login Link */}
        <div className="mt-5 pt-3.5 border-t border-bridge-almond-200 text-center text-xs text-bridge-charcoal-500">
          <span>
            Citizen looking to submit or track a grievance?{' '}
            <button
              type="button"
              onClick={() => {
                if (onSwitchToCitizen) {
                  onSwitchToCitizen();
                } else {
                  onClose();
                }
              }}
              className="text-bridge-gold-700 font-semibold hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bridge-gold-500 rounded px-1 py-0.5"
            >
              Back to Citizen Login
            </button>
          </span>
        </div>
      </div>
    </div>
  );
};
