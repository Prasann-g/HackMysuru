import { useState, useEffect } from 'react';
import { Navbar, type NavTab } from './components/Navbar';
import { LandingPage } from './components/landing/LandingPage';
import { CitizenDashboard } from './components/citizen/CitizenDashboard';
import { OfficerDashboard } from './components/officer/OfficerDashboard';
import { Footer } from './components/Footer';
import { AuthModal } from './components/auth/AuthModal';
import { CitizenProfileModal } from './components/auth/CitizenProfileModal';
import { CitizenTrackingDrawer } from './components/citizen/CitizenTrackingDrawer';
import { TrackComplaintPage } from './pages/TrackComplaintPage';
import { FlowingBackground } from './components/common/FlowingBackground';
import { BrandLogo } from './components/common/BrandLogo';
import type { CitizenUser, AuthMode } from './types/auth';
import { apiGetMe, clearStoredToken, getStoredToken, UNAUTHORIZED_EVENT, USER_SESSION_KEY } from './services/api';

export function App() {
  // Explicit Authentication Hydration State (Phase 3.3.2)
  // If a stored token is present, verify against authoritative /api/auth/me before rendering protected dashboards
  const [isAuthHydrating, setIsAuthHydrating] = useState<boolean>(() => {
    try {
      return Boolean(getStoredToken());
    } catch {
      return false;
    }
  });

  // Read existing session only when a valid token exists
  const [currentUser, setCurrentUser] = useState<CitizenUser | null>(() => {
    try {
      if (!getStoredToken()) {
        sessionStorage.removeItem(USER_SESSION_KEY);
        return null;
      }
      const stored = sessionStorage.getItem(USER_SESSION_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Dedicated Active Tab Navigation State (supports 'track', 'dashboard', 'officer', 'home')
  const [activeTab, setActiveTab] = useState<NavTab>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'track' || window.location.hash === '#track') return 'track';
    } catch {
      // ignore
    }
    return currentUser ? (currentUser.role === 'OFFICER' || currentUser.role === 'ADMIN' ? 'officer' : 'dashboard') : 'home';
  });

  // Dedicated Tracking Portal State
  const [trackPortalOpen, setTrackPortalOpen] = useState<boolean>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      return tabParam === 'track' || window.location.hash === '#track';
    } catch {
      return false;
    }
  });

  // Dedicated tracking portal token state
  const [trackPortalToken, setTrackPortalToken] = useState<string | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('token');
    } catch {
      return null;
    }
  });

  // State to trigger Report modal inside CitizenDashboard from Navbar or post-login
  const [openCitizenReportTrigger, setOpenCitizenReportTrigger] = useState<number>(0);

  // Landing Page Public Tracker state
  const [landingTrackerOpen, setLandingTrackerOpen] = useState(false);
  const [landingTrackingToken, setLandingTrackingToken] = useState<string | null>(null);

  // Authoritative server session verification on boot (Phase 3.3.2)
  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      return;
    }

    let isMounted = true;

    apiGetMe()
      .then((verifiedUser) => {
        if (!isMounted) return;

        if (verifiedUser && getStoredToken()) {
          // Authoritative user verified from backend
          setCurrentUser(verifiedUser);
          try {
            sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify(verifiedUser));
          } catch {
            // Ignore storage error
          }
          setActiveTab((prev) => {
            if (prev === 'track') return 'track';
            return verifiedUser.role === 'OFFICER' || verifiedUser.role === 'ADMIN' ? 'officer' : 'dashboard';
          });
        } else {
          // Invalid, expired, or rejected session
          setCurrentUser(null);
          clearStoredToken();
          try {
            sessionStorage.removeItem(USER_SESSION_KEY);
          } catch {
            // Ignore storage error
          }
          setActiveTab((prev) => (prev === 'track' ? 'track' : 'home'));
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setCurrentUser(null);
        clearStoredToken();
        try {
          sessionStorage.removeItem(USER_SESSION_KEY);
        } catch {
          // Ignore storage error
        }
        setActiveTab((prev) => (prev === 'track' ? 'track' : 'home'));
      })
      .finally(() => {
        if (isMounted) {
          setIsAuthHydrating(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Auth Modal State
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthMode>('login');
  const [authReason, setAuthReason] = useState<string | undefined>(undefined);

  // Citizen Profile Modal State
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  // Centralized 401 Session Eviction Listener (Phase 3.3.1)
  useEffect(() => {
    const handleUnauthorized = () => {
      setCurrentUser(null);
      clearStoredToken();
      try {
        sessionStorage.removeItem(USER_SESSION_KEY);
      } catch {
        // Ignore storage error
      }
      setActiveTab('home');
      setProfileModalOpen(false);
      setAuthModalOpen(false);
      setIsAuthHydrating(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => {
      window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    };
  }, []);

  // Auth Success Handler
  const handleLoginSuccess = (user: CitizenUser) => {
    setCurrentUser(user);
    try {
      sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify(user));
    } catch {
      // Ignore storage error
    }
    setIsAuthHydrating(false);

    // If user attempted to report, automatically trigger report modal inside CitizenDashboard
    if (user.role === 'CITIZEN' && authReason && authReason.includes('report')) {
      setActiveTab('dashboard');
      setOpenCitizenReportTrigger((prev) => prev + 1);
    } else if (activeTab !== 'track') {
      setActiveTab(user.role === 'OFFICER' || user.role === 'ADMIN' ? 'officer' : 'dashboard');
    }

    setAuthModalOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Logout Handler (cleans credentials & routes directly to Public Landing Page)
  const handleLogout = () => {
    setCurrentUser(null);
    clearStoredToken();
    try {
      sessionStorage.removeItem(USER_SESSION_KEY);
    } catch {
      // Ignore storage error
    }
    setActiveTab('home');
    setProfileModalOpen(false);
    setIsAuthHydrating(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Protected Action: Initiate Report Grievance from Landing Page
  const handleInitiateReportFromLanding = () => {
    if (currentUser?.role === 'CITIZEN') {
      setOpenCitizenReportTrigger((prev) => prev + 1);
    } else {
      setAuthModalMode('login');
      setAuthReason('Please sign in or create a citizen account to report a municipal grievance.');
      setAuthModalOpen(true);
    }
  };

  // Public Tracking Action (Opens Dedicated Track Complaint Portal)
  const handleOpenTrackerFromLanding = (token?: string) => {
    setTrackPortalToken(token || null);
    setTrackPortalOpen(true);
  };

  // Top Nav Tab Change (Routes authenticated users to their unified dashboard or dedicated tracking page)
  const handleTabChange = (tab: NavTab) => {
    if (tab === 'track') {
      setTrackPortalOpen(true);
    } else if (tab === 'home' || tab === 'dashboard' || tab === 'officer') {
      if (currentUser?.role === 'OFFICER' || currentUser?.role === 'ADMIN') {
        setActiveTab('officer');
      } else if (currentUser?.role === 'CITIZEN') {
        setActiveTab('dashboard');
      } else {
        setActiveTab('home');
      }
    } else {
      setActiveTab(tab);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Active Citizen Sub-Section ('home' | 'my-complaints' | 'map')
  const [citizenActiveSection, setCitizenActiveSection] = useState<'home' | 'my-complaints' | 'map'>('home');

  // During initial authentication verification, render clean CivicBridge loading screen
  // Prevents flash of wrong dashboard, wrong navbar, or public guest landing page
  if (isAuthHydrating) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="Verifying CivicBridge authentication"
        className="min-h-screen flex flex-col items-center justify-center bg-bridge-ivory-50 text-bridge-charcoal-900 relative selection:bg-bridge-gold-200 selection:text-bridge-charcoal-900 px-4"
      >
        {/* Ambient flowing background — decorative only, pointer-events: none, z-index: 0 */}
        <FlowingBackground />

        <div className="relative z-10 w-full max-w-sm p-8 bg-surface-white/95 backdrop-blur-md border border-bridge-ivory-300 rounded-2xl shadow-bridge-modal text-center space-y-6">
          <div className="flex justify-center">
            <BrandLogo variant="full" size="lg" />
          </div>

          <div className="flex flex-col items-center justify-center space-y-3 pt-2">
            <div className="w-8 h-8 rounded-full border-2 border-bridge-gold-200 border-t-bridge-gold-600 animate-spin" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-bridge-charcoal-900">
                Verifying Session
              </h3>
              <p className="text-xs text-bridge-charcoal-600 leading-relaxed">
                Authenticating municipal credentials with Mysuru City Corporation...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-bridge-ivory-50 text-bridge-charcoal-900 selection:bg-bridge-gold-200 selection:text-bridge-charcoal-900 relative">
      {/* Ambient flowing background — decorative only, pointer-events: none, z-index: 0 */}
      <FlowingBackground />

      {/* Top Navigation Bar */}
      <Navbar
        activeTab={
          trackPortalOpen
            ? 'track'
            : citizenActiveSection === 'my-complaints'
            ? 'my-complaints'
            : activeTab
        }
        currentUser={currentUser}
        onTabChange={handleTabChange}
        onOpenTrackGrievance={() => setTrackPortalOpen(true)}
        onOpenAuth={(mode) => {
          setAuthModalMode(mode);
          setAuthReason(undefined);
          setAuthModalOpen(true);
        }}
        onLogout={handleLogout}
        onOpenProfile={() => setProfileModalOpen(true)}
        onOpenReportGrievance={() => {
          setOpenCitizenReportTrigger((prev) => prev + 1);
        }}
        onSelectCitizenTab={(section) => {
          setCitizenActiveSection(section);
          setTrackPortalOpen(false);
          setActiveTab('dashboard');
        }}
      />

      {/* Main Unified Workspace Area */}
      <main className="flex-1">
        {currentUser?.role === 'CITIZEN' ? (
          /* ONE UNIFIED CITIZEN DASHBOARD */
          <CitizenDashboard
            key={`citizen-dash-${openCitizenReportTrigger}`}
            currentUser={currentUser}
            initialOpenReportModal={openCitizenReportTrigger > 0}
            activeSection={citizenActiveSection}
            onSectionChange={setCitizenActiveSection}
            onNavigateToTrack={(token) => {
              setTrackPortalToken(token || null);
              setTrackPortalOpen(true);
            }}
          />
        ) : currentUser?.role === 'OFFICER' || currentUser?.role === 'ADMIN' ? (
          /* ONE UNIFIED MCC OFFICER CONSOLE */
          <OfficerDashboard currentOfficer={currentUser} />
        ) : (
          /* PUBLIC UNAUTHENTICATED LANDING PAGE */
          <LandingPage
            isAuthenticated={false}
            onInitiateReport={handleInitiateReportFromLanding}
            onOpenTracker={handleOpenTrackerFromLanding}
            onOpenAuth={(mode) => {
              setAuthModalMode(mode);
              setAuthReason(undefined);
              setAuthModalOpen(true);
            }}
          />
        )}
      </main>

      {/* Municipal Governance Enterprise Footer */}
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

      {/* Citizen Profile Details Modal */}
      <CitizenProfileModal
        isOpen={profileModalOpen}
        view="profile"
        user={currentUser}
        onClose={() => setProfileModalOpen(false)}
        onNavigateToSubmit={() => {
          setProfileModalOpen(false);
          setOpenCitizenReportTrigger((prev) => prev + 1);
        }}
        onNavigateToTrack={(token) => {
          setProfileModalOpen(false);
          handleOpenTrackerFromLanding(token);
        }}
      />

      {/* Dedicated Track Complaint Portal (Report Grievance style full-screen portal) */}
      <TrackComplaintPage
        isOpen={trackPortalOpen}
        initialToken={trackPortalToken}
        onClose={() => {
          setTrackPortalOpen(false);
          setTrackPortalToken(null);
        }}
        onReportGrievance={() => {
          setTrackPortalOpen(false);
          if (currentUser?.role === 'CITIZEN') {
            setOpenCitizenReportTrigger((prev) => prev + 1);
          } else {
            setAuthModalMode('login');
            setAuthReason('Please sign in or create a citizen account to report a municipal grievance.');
            setAuthModalOpen(true);
          }
        }}
        currentUser={currentUser}
      />

      {/* Public Landing Page Tracking Drawer (Legacy fallback) */}
      <CitizenTrackingDrawer
        isOpen={landingTrackerOpen}
        token={landingTrackingToken}
        onClose={() => {
          setLandingTrackerOpen(false);
          setLandingTrackingToken(null);
        }}
        onReportIssue={() => {
          setLandingTrackerOpen(false);
          handleInitiateReportFromLanding();
        }}
      />
    </div>
  );
}

export default App;
