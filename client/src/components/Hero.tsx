import React from 'react';
import { ArrowRight, Search, Building2, MapPin, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';

interface HeroProps {
  onReportIssueClick: () => void;
  onTrackComplaintClick: () => void;
}

export const Hero: React.FC<HeroProps> = ({
  onReportIssueClick,
  onTrackComplaintClick,
}) => {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-bridge-almond-100/80 via-bridge-ivory-50 to-bridge-ivory-50 py-16 sm:py-24 border-b border-bridge-almond-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          {/* Locality Badge */}
          <div className="inline-flex items-center gap-2 mb-6">
            <Badge variant="info" size="md" icon={<MapPin className="w-3.5 h-3.5" />}>
              Mysuru City Corporation (MCC) Citizen Services
            </Badge>
          </div>

          {/* Main Headline */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-bridge-charcoal-900 tracking-tight leading-tight sm:leading-tight">
            Report and follow up on civic issues in{' '}
            <span className="text-bridge-charcoal-900 underline decoration-bridge-gold-400 decoration-4 underline-offset-4">
              Mysuru
            </span>
          </h1>

          {/* Citizen-friendly Supporting Text */}
          <p className="mt-6 text-base sm:text-lg text-bridge-charcoal-600 leading-relaxed max-w-2xl mx-auto">
            CivicBridge connects residents directly with local ward engineers to resolve potholes, waste accumulation, streetlight outages, and neighborhood civic concerns with transparent progress tracking.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <Button
              variant="primary"
              size="lg"
              icon={<ArrowRight className="w-4 h-4" />}
              onClick={onReportIssueClick}
            >
              Report a Civic Issue
            </Button>
            <Button
              variant="secondary"
              size="lg"
              icon={<Search className="w-4 h-4" />}
              onClick={onTrackComplaintClick}
            >
              Track a Complaint
            </Button>
          </div>

          {/* Citizen Assurance Highlights */}
          <div className="mt-12 pt-6 border-t border-bridge-almond-200 flex flex-wrap items-center justify-center gap-6 text-xs text-bridge-charcoal-600">
            <div className="flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-bridge-gold-700 shrink-0" />
              <span>MCC Wards 1 to 65 Supported</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-bridge-gold-700 shrink-0" />
              <span>Direct Ward Engineer Routing</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Real-Time Stage Updates</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
