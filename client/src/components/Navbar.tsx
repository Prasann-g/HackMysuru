import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  X,
  User as UserIcon,
  LogOut,
  ChevronDown,
  UserCheck,
  Building2,
  PlusCircle,
  ShieldCheck,
  Search,
} from 'lucide-react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { BrandLogo } from './common/BrandLogo';
import type { CitizenUser } from '../types/auth';

export type NavTab = 'home' | 'dashboard' | 'officer' | 'submit' | 'track' | 'analytics';

interface NavbarProps {
  activeTab: NavTab;
  currentUser: CitizenUser | null;
  onTabChange: (tab: NavTab) => void;
  onOpenAuth: (mode: 'login' | 'signup' | 'officer') => void;
  onLogout: () => void;
  onOpenProfile: () => void;
  onOpenReportGrievance?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  currentUser,
  onTabChange,
  onOpenAuth,
  onLogout,
  onOpenProfile,
  onOpenReportGrievance,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogoClick = () => {
    if (currentUser?.role === 'OFFICER') {
      onTabChange('officer');
    } else if (currentUser?.role === 'CITIZEN') {
      onTabChange('dashboard');
    } else {
      onTabChange('home');
    }
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-bridge-almond-200 shadow-bridge-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleLogoClick}
              className="flex items-center text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-gold-500 rounded-lg p-1 cursor-pointer transition-transform duration-200 active:scale-[0.98] motion-reduce:active:scale-100"
              aria-label="CivicBridge Home"
            >
              <BrandLogo size="md" variant="full" />
            </button>
          </div>

          {/* Desktop Center Context Indicator (Zero separate page links when authenticated) */}
          <div className="hidden md:flex items-center gap-2">
            {currentUser?.role === 'OFFICER' ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-bridge-gold-700 bg-bridge-gold-50 border border-bridge-gold-200 px-3 py-1 rounded-full flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-bridge-gold-700" />
                  <span>MCC Verification Console</span>
                </span>
                {currentUser.ward && (
                  <span className="text-xs text-bridge-charcoal-600 bg-bridge-almond-100 border border-bridge-almond-200 px-2.5 py-0.5 rounded-full">
                    Ward: {currentUser.ward}
                  </span>
                )}
              </div>
            ) : currentUser?.role === 'CITIZEN' ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-bridge-gold-700 bg-bridge-gold-50 border border-bridge-gold-200 px-3 py-1 rounded-full flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-bridge-gold-700" />
                  <span>Mysuru Citizen Workspace</span>
                </span>
                {currentUser.ward && (
                  <span className="text-xs text-bridge-charcoal-600 bg-bridge-almond-100 border border-bridge-almond-200 px-2.5 py-0.5 rounded-full">
                    Ward: {currentUser.ward}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1 text-xs text-bridge-charcoal-500">
                <span>Mysuru City Corporation</span>
                <span>•</span>
                <span>Explainable Civic Verification Platform</span>
              </div>
            )}
          </div>

          {/* Desktop Authentication / Action Area */}
          <div className="hidden md:flex items-center gap-3">
            {/* Track Grievance Nav Link */}
            <button
              type="button"
              onClick={() => onTabChange('track')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-gold-500 ${
                activeTab === 'track'
                  ? 'bg-bridge-gold-100 text-bridge-gold-900 border border-bridge-gold-300 font-bold shadow-xs'
                  : 'text-bridge-charcoal-700 hover:text-bridge-charcoal-900 hover:bg-bridge-almond-100 border border-transparent'
              }`}
            >
              <Search className="w-3.5 h-3.5 text-bridge-gold-700" />
              <span>Track Grievance</span>
            </button>

            {currentUser ? (
              <div className="flex items-center gap-3">
                {/* Citizen Quick Report CTA right in header */}
                {currentUser.role === 'CITIZEN' && onOpenReportGrievance && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={onOpenReportGrievance}
                    icon={<PlusCircle className="w-4 h-4" />}
                  >
                    Report Grievance
                  </Button>
                )}

                {/* User Dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-bridge-almond-200 bg-bridge-almond-50 hover:bg-bridge-almond-100 hover:border-bridge-almond-300 hover:shadow-civic-sm text-bridge-charcoal-800 transition-all duration-200 active:scale-[0.985] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-gold-500 cursor-pointer"
                    aria-expanded={profileDropdownOpen}
                    aria-label="Account menu"
                  >
                    <div className="w-7 h-7 rounded-full bg-bridge-charcoal-800 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                      {currentUser.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs font-semibold max-w-[120px] truncate">
                      {currentUser.name}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-bridge-charcoal-500 transition-transform duration-200" />
                  </button>

                  {/* Profile Dropdown Menu */}
                  {profileDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-bridge-modal border border-bridge-almond-200 py-2 z-50 animate-fadeIn">
                      {/* User Info Header */}
                      <div className="px-4 py-2.5 border-b border-bridge-almond-200/80">
                        <p className="text-xs font-bold text-bridge-charcoal-900 truncate">
                          {currentUser.name}
                        </p>
                        <p className="text-[11px] text-bridge-charcoal-500 truncate mt-0.5">
                          {currentUser.email}
                        </p>
                        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                          <Badge
                            variant={currentUser.role === 'OFFICER' ? 'review' : 'verified'}
                            size="sm"
                            icon={<UserCheck className="w-3 h-3" />}
                          >
                            {currentUser.role === 'OFFICER' ? 'MCC Officer' : 'Active Citizen'}
                          </Badge>
                          {currentUser.department && (
                            <span className="text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-medium truncate max-w-[180px]">
                              {currentUser.department}
                            </span>
                          )}
                          {currentUser.ward && (
                            <span className="text-[10px] text-bridge-charcoal-600 bg-bridge-almond-100 px-1.5 py-0.5 rounded border border-bridge-almond-200 font-medium">
                              {currentUser.ward}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Menu Actions */}
                      <div className="py-1">
                        <button
                          onClick={() => {
                            setProfileDropdownOpen(false);
                            onTabChange('track');
                          }}
                          className="w-full text-left px-4 py-2 text-xs text-bridge-charcoal-700 hover:bg-bridge-almond-50 hover:text-bridge-charcoal-900 flex items-center gap-2 cursor-pointer transition-all duration-150 border-l-2 border-transparent hover:border-bridge-gold-500"
                        >
                          <Search className="w-3.5 h-3.5 text-bridge-gold-700" />
                          <span>Track Grievance</span>
                        </button>

                        <button
                          onClick={() => {
                            setProfileDropdownOpen(false);
                            onOpenProfile();
                          }}
                          className="w-full text-left px-4 py-2 text-xs text-bridge-charcoal-700 hover:bg-bridge-almond-50 hover:text-bridge-charcoal-900 flex items-center gap-2 cursor-pointer transition-all duration-150 border-l-2 border-transparent hover:border-bridge-gold-500"
                        >
                          <UserIcon className="w-3.5 h-3.5 text-bridge-gold-700" />
                          <span>Profile Details</span>
                        </button>
                      </div>

                      {/* Log out */}
                      <div className="border-t border-bridge-almond-200/80 pt-1">
                        <button
                          onClick={() => {
                            setProfileDropdownOpen(false);
                            onLogout();
                          }}
                          className="w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer font-medium transition-all duration-150 border-l-2 border-transparent hover:border-rose-500"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Log Out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenAuth('login')}
                >
                  Log In
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onOpenAuth('signup')}
                >
                  Create Account
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onOpenAuth('officer')}
                >
                  MCC Officer
                </Button>
              </div>
            )}
          </div>

          {/* Mobile Menu Hamburger */}
          <div className="flex md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-bridge-charcoal-600 hover:text-bridge-charcoal-900 hover:bg-bridge-almond-100 transition-all duration-200 active:scale-95 motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-gold-500 cursor-pointer"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-bridge-almond-200 bg-white px-4 pt-3 pb-5 space-y-3 shadow-bridge-modal animate-fadeIn">
          {/* User Status Card if Logged in */}
          {currentUser ? (
            <div className="p-3 bg-bridge-almond-50 border border-bridge-almond-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-bridge-charcoal-800 text-white flex items-center justify-center text-xs font-bold">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-bridge-charcoal-900">{currentUser.name}</p>
                    <p className="text-[11px] text-bridge-charcoal-500">{currentUser.email}</p>
                  </div>
                </div>
                <Badge variant="verified" size="sm">
                  {currentUser.role === 'OFFICER' ? 'Officer' : 'Citizen'}
                </Badge>
              </div>

              {currentUser.role === 'CITIZEN' && onOpenReportGrievance && (
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenReportGrievance();
                  }}
                  icon={<PlusCircle className="w-4 h-4" />}
                >
                  Report Grievance
                </Button>
              )}

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onTabChange('track');
                }}
                className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors ${
                  activeTab === 'track'
                    ? 'bg-bridge-gold-100 text-bridge-gold-900 font-bold border border-bridge-gold-300'
                    : 'text-bridge-charcoal-700 hover:bg-bridge-almond-100'
                }`}
              >
                <Search className="w-4 h-4 text-bridge-gold-700" />
                <span>Track Grievance</span>
              </button>

              <div className="pt-2 border-t border-bridge-almond-200 flex items-center justify-between text-xs">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenProfile();
                  }}
                  className="text-bridge-gold-700 font-semibold hover:underline cursor-pointer"
                >
                  Profile Details
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLogout();
                  }}
                  className="text-rose-600 font-semibold hover:underline cursor-pointer"
                >
                  Log Out
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2 pt-1 pb-2">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onTabChange('track');
                }}
                className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors ${
                  activeTab === 'track'
                    ? 'bg-bridge-gold-100 text-bridge-gold-900 font-bold border border-bridge-gold-300'
                    : 'text-bridge-charcoal-700 hover:bg-bridge-almond-100'
                }`}
              >
                <Search className="w-4 h-4 text-bridge-gold-700" />
                <span>Track Grievance</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAuth('login');
                  }}
                >
                  Log In
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAuth('signup');
                  }}
                >
                  Create Account
                </Button>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAuth('officer');
                }}
              >
                MCC Officer Portal
              </Button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
