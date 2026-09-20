import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  User as UserIcon,
  ShieldCheck,
  ArrowRight,
  MapPin,
  AlertCircle,
  Loader2,
  Smartphone,
  RefreshCw,
  ArrowLeft
} from 'lucide-react';
import { Button } from '../ui/Button';
import { OfficerLoginModal } from './OfficerLoginModal';
import type { CitizenUser, AuthMode } from '../../types/auth';
import { apiOtpRequest, apiOtpVerify } from '../../services/api';

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
  const [step, setStep] = useState<'REQUEST' | 'VERIFY'>('REQUEST');
  const [deliveryMethod, setDeliveryMethod] = useState<'EMAIL' | 'SMS'>('EMAIL');
  
  const [identifier, setIdentifier] = useState('');
  const [name, setName] = useState('');
  const [ward, setWard] = useState('');
  const [otpCode, setOtpCode] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setMode(initialMode);
      setStep('REQUEST');
      setError(null);
      setOtpCode('');
      setResendCooldown(0);
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

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  if (!isOpen) return null;

  if (mode === 'officer') {
    return (
      <OfficerLoginModal
        isOpen={isOpen}
        onClose={onClose}
        onAuthSuccess={onAuthSuccess}
        onSwitchToCitizen={() => {
          setMode('login');
          setStep('REQUEST');
          setError(null);
        }}
      />
    );
  }

  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (!identifier.trim()) throw new Error('Please enter your email or phone number.');
      if (mode === 'signup' && !name.trim()) throw new Error('Full name is required for registration.');
      
      await apiOtpRequest({
        identifier: identifier.trim(),
        method: deliveryMethod,
        purpose: mode === 'login' ? 'LOGIN' : 'REGISTER'
      });
      
      setStep('VERIFY');
      setResendCooldown(30);
    } catch (err: any) {
      setError(err.message || 'Failed to request OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (!otpCode || otpCode.length < 6) throw new Error('Please enter the 6-digit OTP code.');
      
      const response = await apiOtpVerify({
        identifier: identifier.trim(),
        method: deliveryMethod,
        purpose: mode === 'login' ? 'LOGIN' : 'REGISTER',
        code: otpCode.trim(),
        name: mode === 'signup' ? name.trim() : undefined,
        ward: mode === 'signup' ? ward.trim() : undefined
      });

      onAuthSuccess(response.user as CitizenUser);
      onClose();
    } catch (err: any) {
      setError(err.message || 'OTP verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bridge-charcoal-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative animate-slideUp">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-bridge-charcoal-400 hover:text-bridge-charcoal-700 bg-bridge-almond-50 hover:bg-bridge-almond-100 rounded-full p-1.5 transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="pt-6 px-6 pb-4 border-b border-bridge-almond-100">
          <h2 className="text-xl font-bold text-bridge-charcoal-900 font-serif flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-bridge-gold-600" />
            CivicTrust <span className="font-sans font-normal text-bridge-charcoal-500 text-lg">| Citizen</span>
          </h2>
          <p className="text-sm text-bridge-charcoal-500 mt-1">
            {reasonMessage || 'Securely log in to verify and track civic issues.'}
          </p>
        </div>

        <div className="p-6">
          {step === 'REQUEST' && (
            <>
              <div className="flex mb-5">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                  className={`flex-1 pb-2.5 text-xs font-semibold text-center border-b-2 transition-all duration-150 cursor-pointer focus-visible:outline-none ${
                    mode === 'login'
                      ? 'border-bridge-gold-500 text-bridge-charcoal-900 font-bold'
                      : 'border-transparent text-bridge-charcoal-500 hover:text-bridge-charcoal-800'
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
                  className={`flex-1 pb-2.5 text-xs font-semibold text-center border-b-2 transition-all duration-150 cursor-pointer focus-visible:outline-none ${
                    mode === 'signup'
                      ? 'border-bridge-gold-500 text-bridge-charcoal-900 font-bold'
                      : 'border-transparent text-bridge-charcoal-500 hover:text-bridge-charcoal-800'
                  }`}
                >
                  Register
                </button>
              </div>

              <form onSubmit={handleRequestOtp} className="space-y-4 animate-fadeIn">
                {error && (
                  <div role="alert" className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {mode === 'signup' && (
                  <div>
                    <label htmlFor="auth-name" className="block text-xs font-semibold text-bridge-charcoal-900 mb-1">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-bridge-charcoal-400 absolute left-3 top-2.5" />
                      <input
                        id="auth-name"
                        type="text"
                        disabled={isLoading}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Ramesh Rao"
                        className="civic-input w-full pl-9 pr-3 py-2 text-sm rounded-lg text-bridge-charcoal-900 disabled:opacity-60 transition-all duration-150"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="auth-identifier" className="block text-xs font-semibold text-bridge-charcoal-900">
                      {deliveryMethod === 'EMAIL' ? 'Email Address' : 'Phone Number'} <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setDeliveryMethod(deliveryMethod === 'EMAIL' ? 'SMS' : 'EMAIL')}
                      className="text-xs text-bridge-gold-700 font-medium hover:underline flex items-center gap-1"
                    >
                      {deliveryMethod === 'EMAIL' ? <Smartphone className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
                      Use {deliveryMethod === 'EMAIL' ? 'Phone' : 'Email'} instead
                    </button>
                  </div>
                  <div className="relative">
                    {deliveryMethod === 'EMAIL' ? (
                      <Mail className="w-4 h-4 text-bridge-charcoal-400 absolute left-3 top-2.5 pointer-events-none" />
                    ) : (
                      <Smartphone className="w-4 h-4 text-bridge-charcoal-400 absolute left-3 top-2.5 pointer-events-none" />
                    )}
                    <input
                      id="auth-identifier"
                      type={deliveryMethod === 'EMAIL' ? 'email' : 'tel'}
                      disabled={isLoading}
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder={deliveryMethod === 'EMAIL' ? 'name@example.com' : '+91 98765 43210'}
                      className="civic-input w-full pl-9 pr-3 py-2 text-sm rounded-lg text-bridge-charcoal-900 disabled:opacity-60 transition-all duration-150"
                    />
                  </div>
                </div>

                {mode === 'signup' && (
                  <div>
                    <label htmlFor="auth-ward" className="block text-xs font-semibold text-bridge-charcoal-900 mb-1">
                      Mysuru Locality / Ward <span className="text-bridge-charcoal-400 font-normal">(Optional)</span>
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-bridge-charcoal-400 absolute left-3 top-2.5 pointer-events-none" />
                      <input
                        id="auth-ward"
                        type="text"
                        disabled={isLoading}
                        value={ward}
                        onChange={(e) => setWard(e.target.value)}
                        placeholder="e.g. Kuvempunagar, Ward 48"
                        className="civic-input w-full pl-9 pr-3 py-2 text-sm rounded-lg text-bridge-charcoal-900 disabled:opacity-60 transition-all duration-150"
                      />
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={isLoading}
                    className="w-full"
                    icon={isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  >
                    {isLoading ? 'Sending OTP...' : 'Send OTP Code'}
                  </Button>
                </div>
              </form>
            </>
          )}

          {step === 'VERIFY' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4 animate-fadeIn">
              <div className="text-center mb-4">
                <div className="mx-auto w-12 h-12 bg-bridge-gold-50 text-bridge-gold-600 rounded-full flex items-center justify-center mb-3">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-bridge-charcoal-900">Enter Verification Code</h3>
                <p className="text-sm text-bridge-charcoal-500 mt-1">
                  We've sent a 6-digit code to <strong>{identifier}</strong>.
                </p>
              </div>

              {error && (
                <div role="alert" className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label htmlFor="auth-otp" className="block text-xs font-semibold text-bridge-charcoal-900 mb-1 text-center">
                  6-Digit OTP Code
                </label>
                <input
                  id="auth-otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  disabled={isLoading}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="------"
                  className="civic-input w-full text-center text-2xl tracking-[0.5em] font-mono py-3 rounded-lg text-bridge-charcoal-900 disabled:opacity-60 transition-all duration-150"
                  autoFocus
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={isLoading || otpCode.length !== 6}
                  className="w-full"
                  icon={isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                >
                  {isLoading ? 'Verifying...' : 'Verify & Log In'}
                </Button>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-bridge-almond-100">
                <button
                  type="button"
                  onClick={() => {
                    setStep('REQUEST');
                    setOtpCode('');
                    setError(null);
                  }}
                  className="text-xs text-bridge-charcoal-500 hover:text-bridge-charcoal-800 flex items-center gap-1 font-medium"
                >
                  <ArrowLeft className="w-3 h-3" /> Change {deliveryMethod === 'EMAIL' ? 'Email' : 'Number'}
                </button>
                
                <button
                  type="button"
                  onClick={() => handleRequestOtp()}
                  disabled={resendCooldown > 0 || isLoading}
                  className="text-xs text-bridge-gold-700 font-medium hover:underline flex items-center gap-1 disabled:opacity-50 disabled:no-underline"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoading && 'animate-spin'}`} />
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                </button>
              </div>
            </form>
          )}

          {step === 'REQUEST' && (
            <div className="mt-4 pt-3 border-t border-bridge-almond-200/80 text-center text-[11px] text-bridge-charcoal-500">
              Authorized MCC Personnel?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('officer');
                  setError(null);
                }}
                className="text-bridge-gold-700 font-semibold hover:underline cursor-pointer"
              >
                Access MCC Officer Portal
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
