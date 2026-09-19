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
import type { CitizenUser, AuthMode } from './types/auth';
import { apiGetMe, clearStoredToken } from './services/api';

export function App() {
  // Read existing session to avoid unauthenticated flash on refresh
  const [currentUser, setCurrentUser] = useState<CitizenUser | null>(() => {
    try {
      const stored = sessionStorage.getItem('civictrust_citizen_user');
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
    return currentUser ? (currentUser.role === 'OFFICER' ? 'officer' : 'dashboard') : 'home';
  });

  // Dedicated tracking page token state
  const [dedicatedTrackToken, setDedicatedTrackToken] = useState<string | null>(() => {
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

  // Verify server session with backend token on boot
  useEffect(() => {
    apiGetMe().then((verifiedUser) => {
      if (verifiedUser) {
        setCurrentUser(verifiedUser);
        try {
          sessionStorage.setItem('civictrust_citizen_user', JSON.stringify(verifiedUser));
        } catch {
          // Ignore storage error
        }
      } else {
        setCurrentUser(null);
        clearStoredToken();
        try {
          sessionStorage.removeItem('civictrust_citizen_user');
        } catch {
          // Ignore storage error
        }
      }
    });
  }, []);

  // Auth Modal State
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthMode>('login');
  const [authReason, setAuthReason] = useState<string | undefined>(undefined);

  // Citizen Profile Modal State
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  // Auth Success Handler
  const handleLoginSuccess = (user: CitizenUser) => {
    setCurrentUser(user);
    try {
      sessionStorage.setItem('civictrust_citizen_user', JSON.stringify(user));
    } catch {
      // Ignore storage error
    }

    // If user attempted to report, automatically trigger report modal inside CitizenDashboard
    if (user.role === 'CITIZEN' && authReason && authReason.includes('report')) {
      setActiveTab('dashboard');
      setOpenCitizenReportTrigger((prev) => prev + 1);
    } else if (activeTab !== 'track') {
      setActiveTab(user.role === 'OFFICER' ? 'officer' : 'dashboard');
    }

    setAuthModalOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Logout Handler (cleans credentials & routes directly to Public Landing Page)
  const handleLogout = () => {
    setCurrentUser(null);
    clearStoredToken();
    try {
      sessionStorage.removeItem('civictrust_citizen_user');
    } catch {
      // Ignore storage error
    }
    setActiveTab('home');
    setProfileModalOpen(false);
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

  // Public Tracking Action (Routes to Dedicated Track Complaint Page)
  const handleOpenTrackerFromLanding = (token?: string) => {
    setDedicatedTrackToken(token || null);
    setActiveTab('track');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Top Nav Tab Change (Routes authenticated users to their unified dashboard or dedicated tracking page)
  const handleTabChange = (tab: NavTab) => {
    if (tab === 'track') {
      setActiveTab('track');
    } else if (tab === 'home' || tab === 'dashboard' || tab === 'officer') {
      if (currentUser?.role === 'OFFICER') {
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

  return (
    <div className="min-h-screen flex flex-col bg-bridge-ivory-50 text-bridge-charcoal-900 selection:bg-bridge-gold-200 selection:text-bridge-charcoal-900">
      {/* Top Navigation Bar */}
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
        onOpenProfile={() => setProfileModalOpen(true)}
        onOpenReportGrievance={() => {
          setOpenCitizenReportTrigger((prev) => prev + 1);
        }}
      />

      {/* Main Unified Workspace Area */}
      <main className="flex-1">
        {activeTab === 'track' ? (
          /* DEDICATED TRACK COMPLAINT PAGE */
          <TrackComplaintPage
            initialToken={dedicatedTrackToken}
            currentUser={currentUser}
            onBackToDashboard={() => {
              setDedicatedTrackToken(null);
              if (currentUser?.role === 'OFFICER') {
                setActiveTab('officer');
              } else if (currentUser?.role === 'CITIZEN') {
                setActiveTab('dashboard');
              } else {
                setActiveTab('home');
              }
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onReportGrievance={() => {
              if (currentUser?.role === 'CITIZEN') {
                setActiveTab('dashboard');
                setOpenCitizenReportTrigger((prev) => prev + 1);
              } else {
                setAuthModalMode('login');
                setAuthReason('Please sign in or create a citizen account to report a municipal grievance.');
                setAuthModalOpen(true);
              }
            }}
          />
        ) : currentUser?.role === 'CITIZEN' ? (
          /* ONE UNIFIED CITIZEN DASHBOARD */
          <CitizenDashboard
            key={`citizen-dash-${openCitizenReportTrigger}`}
            currentUser={currentUser}
            initialOpenReportModal={openCitizenReportTrigger > 0}
            onNavigateToTrack={(token) => {
              setDedicatedTrackToken(token || null);
              setActiveTab('track');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        ) : currentUser?.role === 'OFFICER' ? (
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

      {/* Public Landing Page Tracking Drawer */}
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
