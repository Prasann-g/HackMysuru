import { useState, useEffect } from 'react';
import { Navbar, type NavTab } from './components/Navbar';
import { Hero } from './components/Hero';
import { WhyCivicTrust } from './components/landing/WhyCivicTrust';
import { HowItWorks } from './components/HowItWorks';
import { TrustTransparency } from './components/landing/TrustTransparency';
import { FinalCta } from './components/landing/FinalCta';
import { ComplaintSubmissionPortal } from './components/submission/ComplaintSubmissionPortal';
import { Footer } from './components/Footer';
import { AuthModal } from './components/auth/AuthModal';
import { CitizenProfileModal } from './components/auth/CitizenProfileModal';
import { PlaceholderModal } from './components/PlaceholderModal';
import type { CitizenUser, AuthMode } from './types/auth';
import { apiGetMe, clearStoredToken } from './services/api';

export function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [currentUser, setCurrentUser] = useState<CitizenUser | null>(() => {
    try {
      const stored = sessionStorage.getItem('civictrust_citizen_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Verify server session on initial boot
  useEffect(() => {
    apiGetMe().then((verifiedUser) => {
      if (verifiedUser) {
        setCurrentUser(verifiedUser);
        try {
          sessionStorage.setItem('civictrust_citizen_user', JSON.stringify(verifiedUser));
        } catch {
          // Ignore storage errors
        }
      } else {
        setCurrentUser(null);
        clearStoredToken();
        try {
          sessionStorage.removeItem('civictrust_citizen_user');
        } catch {
          // Ignore storage errors
        }
      }
    });
  }, []);

  // Auth Modal State
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthMode>('login');
  const [authReason, setAuthReason] = useState<string | undefined>(undefined);

  // Citizen Profile / My Complaints Modal State
  const [citizenModalView, setCitizenModalView] = useState<'profile' | 'complaints' | null>(null);

  // Placeholder Modal for unimplemented features (e.g. Public Map)
  const [modalFeature, setModalFeature] = useState<string | null>(null);

  const handleLoginSuccess = (user: CitizenUser) => {
    setCurrentUser(user);
    try {
      sessionStorage.setItem('civictrust_citizen_user', JSON.stringify(user));
    } catch {
      // Ignore storage errors
    }
    // If user was attempting to submit, transition to submit
    if (authReason && authReason.includes('submit')) {
      setActiveTab('submit');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    clearStoredToken();
    try {
      sessionStorage.removeItem('civictrust_citizen_user');
    } catch {
      // Ignore storage errors
    }
    if (activeTab === 'submit') {
      setActiveTab('home');
    }
  };

  // Protected Action: Report a Civic Issue
  const handleInitiateReport = () => {
    if (currentUser) {
      setActiveTab('submit');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setAuthModalMode('login');
      setAuthReason('Please log in or create a citizen account to submit a civic complaint.');
      setAuthModalOpen(true);
    }
  };

  // Protected Action: Track a Complaint
  const handleInitiateTrack = () => {
    if (currentUser) {
      setCitizenModalView('complaints');
    } else {
      setAuthModalMode('login');
      setAuthReason('Please log in or create a citizen account to track your submitted complaints.');
      setAuthModalOpen(true);
    }
  };

  // Top Nav Tab Switcher with Auth Gate
  const handleTabChange = (tab: NavTab) => {
    if (tab === 'home') {
      setActiveTab('home');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (tab === 'submit') {
      handleInitiateReport();
    } else if (tab === 'track') {
      handleInitiateTrack();
    } else if (tab === 'dashboard') {
      setModalFeature('Public Transparency Map & Corporation Analytics');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-brand-slate-50 text-brand-slate-900 selection:bg-brand-teal-100 selection:text-brand-teal-900">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        currentUser={currentUser}
        onTabChange={handleTabChange}
        onOpenAuth={(mode) => {
          setAuthModalMode(mode);
          setAuthReason(undefined);
          setAuthModalOpen(true);
        }}
        onLogout={handleLogout}
        onOpenMyComplaints={() => setCitizenModalView('complaints')}
        onOpenProfile={() => setCitizenModalView('profile')}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {activeTab === 'submit' && currentUser ? (
          <ComplaintSubmissionPortal onBackToHome={() => setActiveTab('home')} />
        ) : (
          <>
            {/* 1. Hero Section */}
            <Hero
              onReportIssueClick={handleInitiateReport}
              onTrackComplaintClick={handleInitiateTrack}
            />

            {/* 2. Why Civic Trust */}
            <WhyCivicTrust />

            {/* 3. How It Works (Citizen Journey) */}
            <HowItWorks />

            {/* 4. Trust & Transparency Section */}
            <TrustTransparency />

            {/* 5. Final CTA */}
            <FinalCta
              isAuthenticated={!!currentUser}
              onOpenAuth={(mode) => {
                setAuthModalMode(mode);
                setAuthReason(undefined);
                setAuthModalOpen(true);
              }}
              onNavigateToSubmit={handleInitiateReport}
              onNavigateToTrack={handleInitiateTrack}
            />
          </>
        )}
      </main>

      {/* 6. Simple Citizen-Focused Footer */}
      <Footer />

      {/* Authentication Modal */}
      <AuthModal
        key={authModalOpen ? `${authModalMode}-open` : 'closed'}
        isOpen={authModalOpen}
        initialMode={authModalMode}
        reasonMessage={authReason}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={handleLoginSuccess}
      />

      {/* Citizen Profile & My Complaints Modal */}
      <CitizenProfileModal
        isOpen={citizenModalView !== null}
        view={citizenModalView}
        user={currentUser}
        onClose={() => setCitizenModalView(null)}
        onNavigateToSubmit={handleInitiateReport}
      />

      {/* Placeholder Modal for Public Map */}
      <PlaceholderModal
        isOpen={modalFeature !== null}
        featureName={modalFeature || ''}
        onClose={() => setModalFeature(null)}
      />
    </div>
  );
}

export default App;
