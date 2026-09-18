import React, { useState, useEffect } from 'react';
import {
  X,
  Lock,
  Mail,
  User as UserIcon,
  ShieldCheck,
  ArrowRight,
  MapPin,
  Briefcase,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import type { CitizenUser, AuthMode } from '../../types/auth';
import { apiLogin, apiRegisterCitizen } from '../../services/api';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: AuthMode;
  reasonMessage?: string;
  onClose: () => void;
  onAuthSuccess: (user: CitizenUser) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'login',
  reasonMessage,
  onClose,
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [ward, setWard] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setMode(initialMode);
      setError(null);
    }
  }

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

  const handleFillDemoOfficer = () => {
    setEmail('officer.ward48@mcc.gov.in');
    setPassword('Officer@Mysuru48');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (mode === 'signup' && !name.trim()) {
      setError('Please provide your full name to register as a citizen.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    if (mode === 'signup' && password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);

    try {
      if (mode === 'signup') {
        const response = await apiRegisterCitizen({
          name: name.trim(),
          email: trimmedEmail,
          password,
          ward: ward.trim() || undefined,
        });
        onAuthSuccess(response.user);
        onClose();
      } else {
        // 'login' or 'officer' mode both authenticate through the server
        const response = await apiLogin({
          email: trimmedEmail,
          password,
        });
        onAuthSuccess(response.user);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-slate-900/50 backdrop-blur-xs animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-7 shadow-civic-lg border border-brand-slate-200">
        {/* Modal Header */}
        <div className="flex items-start justify-between">
          <div>
            <Badge
              variant={mode === 'officer' ? 'review' : 'info'}
              size="sm"
              className="mb-1.5"
            >
              {mode === 'officer' ? 'MCC Officer Portal' : 'Citizen Access'}
            </Badge>
            <h2 id="auth-modal-title" className="text-xl font-bold text-brand-slate-900">
              {mode === 'login' && 'Log in to Civic Trust'}
              {mode === 'signup' && 'Create Citizen Account'}
              {mode === 'officer' && 'MCC Officer Login'}
            </h2>
            <p className="text-xs text-brand-slate-600 mt-0.5">
              {mode === 'login' &&
                'Sign in to submit complaints and track your neighborhood reports.'}
              {mode === 'signup' &&
                'Register with Civic Trust to report civic issues and follow resolution.'}
              {mode === 'officer' &&
                'Secure access for verified Mysuru City Corporation ward engineers.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-brand-slate-400 hover:text-brand-slate-700 p-1 rounded-lg focus-visible:ring-2 focus-visible:ring-brand-teal-600 cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Reason Banner */}
        {reasonMessage && (
          <div className="mt-4 p-3 rounded-lg bg-brand-teal-50 border border-brand-teal-200 text-xs text-brand-teal-900 leading-normal">
            {reasonMessage}
          </div>
        )}

        {/* Security & Authentication Notice */}
        <div className="mt-3.5 p-3 rounded-lg bg-emerald-50/80 border border-emerald-200 text-[11px] text-emerald-950 leading-normal space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-emerald-900">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span>Server-Verified Authentication</span>
          </div>
          <p className="text-emerald-800">
            Protected by salted bcrypt key derivation and cryptographic JSON Web Tokens (JWT) with server-enforced role access control.
          </p>
        </div>

        {/* Mode Toggle Tabs */}
        <div className="mt-5 flex border-b border-brand-slate-200">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`flex-1 pb-2.5 text-xs font-semibold text-center border-b-2 transition-colors cursor-pointer ${
              mode === 'login'
                ? 'border-brand-teal-600 text-brand-teal-700'
                : 'border-transparent text-brand-slate-500 hover:text-brand-slate-800'
            }`}
          >
            Citizen Login
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setError(null);
            }}
            className={`flex-1 pb-2.5 text-xs font-semibold text-center border-b-2 transition-colors cursor-pointer ${
              mode === 'signup'
                ? 'border-brand-teal-600 text-brand-teal-700'
                : 'border-transparent text-brand-slate-500 hover:text-brand-slate-800'
            }`}
          >
            Register
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('officer');
              setError(null);
            }}
            className={`flex-1 pb-2.5 text-xs font-semibold text-center border-b-2 transition-colors cursor-pointer ${
              mode === 'officer'
                ? 'border-amber-600 text-amber-700'
                : 'border-transparent text-brand-slate-500 hover:text-brand-slate-800'
            }`}
          >
            MCC Officer
          </button>
        </div>

        {/* Form Inputs */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          {error && (
            <div
              role="alert"
              className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'officer' && (
            <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-2">
              <div className="flex items-center gap-1.5 font-semibold text-amber-950">
                <Briefcase className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>Officer Access Credentials</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-normal">
                Officer accounts are pre-provisioned for MCC ward engineers and sanitation officers.
              </p>
              <button
                type="button"
                onClick={handleFillDemoOfficer}
                className="w-full text-left py-1 px-2 bg-amber-100/70 hover:bg-amber-100 rounded text-[11px] font-medium text-amber-900 border border-amber-300/60 cursor-pointer transition-colors"
              >
                Use Demo Officer: <span className="font-mono font-semibold">officer.ward48@mcc.gov.in</span>
              </button>
            </div>
          )}

          {mode === 'signup' && (
            <div>
              <label
                htmlFor="auth-name"
                className="block text-xs font-semibold text-brand-slate-900 mb-1"
              >
                Full Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-brand-slate-400 absolute left-3 top-2.5" />
                <input
                  id="auth-name"
                  type="text"
                  disabled={isLoading}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ramesh Rao"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-brand-slate-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal-600 text-brand-slate-900 disabled:opacity-60"
                />
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="auth-email"
              className="block text-xs font-semibold text-brand-slate-900 mb-1"
            >
              {mode === 'officer' ? 'Official MCC Email' : 'Email Address'}{' '}
              <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-brand-slate-400 absolute left-3 top-2.5" />
              <input
                id="auth-email"
                type="email"
                disabled={isLoading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={
                  mode === 'officer' ? 'officer.ward48@mcc.gov.in' : 'name@example.com'
                }
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-brand-slate-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal-600 text-brand-slate-900 disabled:opacity-60"
              />
            </div>
          </div>

          {mode === 'signup' && (
            <div>
              <label
                htmlFor="auth-ward"
                className="block text-xs font-semibold text-brand-slate-900 mb-1"
              >
                Mysuru Locality / Ward{' '}
                <span className="text-brand-slate-400 font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-brand-slate-400 absolute left-3 top-2.5" />
                <input
                  id="auth-ward"
                  type="text"
                  disabled={isLoading}
                  value={ward}
                  onChange={(e) => setWard(e.target.value)}
                  placeholder="e.g. Kuvempunagar, Ward 48"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-brand-slate-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal-600 text-brand-slate-900 disabled:opacity-60"
                />
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="auth-password"
              className="block text-xs font-semibold text-brand-slate-900 mb-1"
            >
              Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-brand-slate-400 absolute left-3 top-2.5" />
              <input
                id="auth-password"
                type="password"
                disabled={isLoading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-brand-slate-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal-600 text-brand-slate-900 disabled:opacity-60"
              />
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              variant={mode === 'officer' ? 'primary' : 'primary'}
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
              {isLoading && 'Authenticating...'}
              {!isLoading && mode === 'login' && 'Log In as Citizen'}
              {!isLoading && mode === 'signup' && 'Create Citizen Account'}
              {!isLoading && mode === 'officer' && 'Log In as MCC Officer'}
            </Button>
          </div>
        </form>

        <div className="mt-4 pt-3 border-t border-brand-slate-100 text-center text-xs text-brand-slate-500">
          {mode === 'login' && (
            <span>
              Don&apos;t have an account yet?{' '}
              <button
                type="button"
                onClick={() => setMode('signup')}
                className="text-brand-teal-700 font-semibold hover:underline cursor-pointer"
              >
                Create one now
              </button>
            </span>
          )}
          {mode === 'signup' && (
            <span>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-brand-teal-700 font-semibold hover:underline cursor-pointer"
              >
                Log in
              </button>
            </span>
          )}
          {mode === 'officer' && (
            <span>
              Citizen seeking to report an issue?{' '}
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-brand-teal-700 font-semibold hover:underline cursor-pointer"
              >
                Citizen Login
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
