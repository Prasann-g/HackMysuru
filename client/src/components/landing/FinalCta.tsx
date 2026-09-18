import React from 'react';
import { UserPlus, LogIn, FileText } from 'lucide-react';
import { Button } from '../ui/Button';

interface FinalCtaProps {
  isAuthenticated: boolean;
  onOpenAuth: (mode: 'login' | 'signup') => void;
  onNavigateToSubmit: () => void;
  onNavigateToTrack: () => void;
}

export const FinalCta: React.FC<FinalCtaProps> = ({
  isAuthenticated,
  onOpenAuth,
  onNavigateToSubmit,
  onNavigateToTrack,
}) => {
  return (
    <section className="py-16 sm:py-20 bg-gradient-to-b from-bridge-ivory-50 to-bridge-almond-100/60 border-b border-bridge-almond-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-bridge-charcoal-900 tracking-tight">
          Ready to report a civic issue?
        </h2>
        <p className="mt-3 text-sm sm:text-base text-bridge-charcoal-600 max-w-xl mx-auto leading-relaxed">
          {isAuthenticated
            ? 'Your citizen account is active. Report a new issue in your Mysuru locality or track the status of existing complaints.'
            : 'Join residents across Mysuru helping maintain cleaner streets, safer roads, and reliable public infrastructure.'}
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
          {isAuthenticated ? (
            <>
              <Button
                variant="primary"
                size="lg"
                icon={<FileText className="w-4 h-4" />}
                onClick={onNavigateToSubmit}
              >
                Report an Issue Now
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={onNavigateToTrack}
              >
                Track a Complaint
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="primary"
                size="lg"
                icon={<UserPlus className="w-4 h-4" />}
                onClick={() => onOpenAuth('signup')}
              >
                Create an Account
              </Button>
              <Button
                variant="outline"
                size="lg"
                icon={<LogIn className="w-4 h-4" />}
                onClick={() => onOpenAuth('login')}
              >
                Log In
              </Button>
            </>
          )}
        </div>
      </div>
    </section>
  );
};
