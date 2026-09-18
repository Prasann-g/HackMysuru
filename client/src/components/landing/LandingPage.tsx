import React from 'react';
import { Hero } from '../Hero';
import { WhyCivicTrust } from './WhyCivicTrust';
import { HowItWorks } from '../HowItWorks';
import { TrustTransparency } from './TrustTransparency';
import { FinalCta } from './FinalCta';
import type { AuthMode } from '../../types/auth';

interface LandingPageProps {
  isAuthenticated: boolean;
  onInitiateReport: () => void;
  onOpenTracker: (token?: string) => void;
  onOpenAuth: (mode: AuthMode) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  isAuthenticated,
  onInitiateReport,
  onOpenTracker,
  onOpenAuth,
}) => {
  return (
    <div className="animate-fadeIn">
      {/* 1. Hero Section */}
      <Hero
        onReportIssueClick={onInitiateReport}
        onTrackComplaintClick={() => onOpenTracker()}
      />

      {/* 2. Platform Capabilities & Positioning */}
      <div id="capabilities">
        <WhyCivicTrust />
      </div>

      {/* 3. How It Works (Citizen Journey & Verification Engine) */}
      <div id="how-it-works">
        <HowItWorks />
      </div>

      {/* 4. Municipal Trust & Anti-Hallucination Standards */}
      <div id="transparency">
        <TrustTransparency />
      </div>

      {/* 5. Final Call to Action */}
      <FinalCta
        isAuthenticated={isAuthenticated}
        onOpenAuth={onOpenAuth}
        onNavigateToSubmit={onInitiateReport}
        onNavigateToTrack={() => onOpenTracker()}
      />
    </div>
  );
};
