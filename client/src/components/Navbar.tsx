import React, { useState, useRef, useEffect } from 'react';
import {
  ShieldCheck,
  Menu,
  X,
  FileText,
  Search,
  BarChart3,
  Home,
  User as UserIcon,
  LogOut,
  ChevronDown,
  UserCheck,
  Building2,
} from 'lucide-react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import type { CitizenUser } from '../types/auth';

export type NavTab = 'home' | 'submit' | 'track' | 'dashboard' | 'officer';

interface NavbarProps {
  activeTab: NavTab;
  currentUser: CitizenUser | null;
  onTabChange: (tab: NavTab) => void;
  onOpenAuth: (mode: 'login' | 'signup') => void;
  onLogout: () => void;
  onOpenMyComplaints: () => void;
  onOpenProfile: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  currentUser,
  onTabChange,
  onOpenAuth,
  onLogout,
  onOpenMyComplaints,
  onOpenProfile,
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

  const navItems: { id: NavTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'home', label: 'Home', icon: <Home className="w-4 h-4" /> },
    { id: 'submit', label: 'Report Issue', icon: <FileText className="w-4 h-4" /> },
    { id: 'track', label: 'Track Complaint', icon: <Search className="w-4 h-4" /> },
    { id: 'dashboard', label: 'Public Map', icon: <BarChart3 className="w-4 h-4" />, badge: 'Coming Soon' },
    ...(currentUser?.role === 'OFFICER'
      ? [
          {
            id: 'officer' as NavTab,
            label: 'Officer Queue',
            icon: <Building2 className="w-4 h-4 text-brand-teal-700" />,
            badge: 'MCC',
          },
        ]
      : []),
  ];

  const handleNavClick = (tab: NavTab) => {
    onTabChange(tab);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-brand-slate-200 shadow-civic-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleNavClick('home')}
              className="flex items-center gap-2.5 text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal-600 rounded-lg p-1"
              aria-label="Civic Trust Home"
            >
              <div className="w-10 h-10 rounded-lg bg-brand-teal-600 flex items-center justify-center text-white shadow-civic-sm group-hover:bg-brand-teal-700 transition-colors">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="font-bold text-lg text-brand-slate-900 tracking-tight block leading-tight">
                  Civic Trust
                </span>
                <p className="text-xs text-brand-slate-600 font-medium leading-none mt-0.5">
                  Mysuru City Corporation
                </p>
              </div>
            </button>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Main Navigation">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-brand-teal-50 text-brand-teal-700 border border-brand-teal-200'
                      : 'text-brand-slate-700 hover:text-brand-slate-900 hover:bg-brand-slate-100'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="text-[10px] font-medium bg-brand-slate-100 text-brand-slate-600 px-1.5 py-0.2 rounded border border-brand-slate-200">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Desktop Authentication / Profile Area */}
          <div className="hidden md:flex items-center gap-2.5">
            {currentUser ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-brand-slate-200 bg-brand-slate-50 hover:bg-brand-slate-100 text-brand-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-brand-teal-600 cursor-pointer"
                  aria-expanded={profileDropdownOpen}
                  aria-label="Citizen account menu"
                >
                  <div className="w-7 h-7 rounded-full bg-brand-teal-600 text-white flex items-center justify-center text-xs font-bold">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-semibold max-w-[120px] truncate">
                    {currentUser.name}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-brand-slate-500" />
                </button>

                {/* Profile Dropdown Menu */}
                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-civic-lg border border-brand-slate-200 py-2 z-50 animate-fadeIn">
                    {/* User Info Header */}
                    <div className="px-4 py-2.5 border-b border-brand-slate-100">
                      <p className="text-xs font-bold text-brand-slate-900 truncate">
                        {currentUser.name}
                      </p>
                      <p className="text-[11px] text-brand-slate-500 truncate mt-0.5">
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
                          <span className="text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-medium">
                            {currentUser.department}
                          </span>
                        )}
                        {currentUser.ward && (
                          <span className="text-[10px] text-brand-slate-600 bg-brand-slate-100 px-1.5 py-0.5 rounded border border-brand-slate-200">
                            {currentUser.ward}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Menu Actions */}
                    <div className="py-1">
                      {currentUser.role === 'OFFICER' && (
                        <button
                          onClick={() => {
                            setProfileDropdownOpen(false);
                            onTabChange('officer');
                          }}
                          className="w-full text-left px-4 py-2 text-xs font-semibold text-brand-teal-800 bg-brand-teal-50/60 hover:bg-brand-teal-50 flex items-center gap-2 cursor-pointer border-b border-brand-slate-100"
                        >
                          <Building2 className="w-3.5 h-3.5 text-brand-teal-700" />
                          <span>Officer Review Queue</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          onOpenMyComplaints();
                        }}
                        className="w-full text-left px-4 py-2 text-xs text-brand-slate-700 hover:bg-brand-slate-50 hover:text-brand-slate-900 flex items-center gap-2 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-brand-teal-700" />
                        <span>My Complaints</span>
                      </button>

                      <button
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          onOpenProfile();
                        }}
                        className="w-full text-left px-4 py-2 text-xs text-brand-slate-700 hover:bg-brand-slate-50 hover:text-brand-slate-900 flex items-center gap-2 cursor-pointer"
                      >
                        <UserIcon className="w-3.5 h-3.5 text-brand-teal-700" />
                        <span>Citizen Profile</span>
                      </button>
                    </div>

                    {/* Log out */}
                    <div className="border-t border-brand-slate-100 pt-1">
                      <button
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          onLogout();
                        }}
                        className="w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer font-medium"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Log Out</span>
                      </button>
                    </div>
                  </div>
                )}
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
              </div>
            )}
          </div>

          {/* Mobile Menu Hamburger */}
          <div className="flex md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-brand-slate-600 hover:text-brand-slate-900 hover:bg-brand-slate-100 focus-visible:ring-2 focus-visible:ring-brand-teal-600"
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
        <div className="md:hidden border-t border-brand-slate-200 bg-white px-4 pt-3 pb-5 space-y-3 shadow-civic-md animate-fadeIn">
          {/* User Status Card if Logged in */}
          {currentUser ? (
            <div className="p-3 bg-brand-teal-50/70 border border-brand-teal-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-brand-teal-600 text-white flex items-center justify-center text-xs font-bold">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-brand-slate-900">{currentUser.name}</p>
                    <p className="text-[11px] text-brand-slate-500">{currentUser.email}</p>
                  </div>
                </div>
                <Badge variant="verified" size="sm">
                  Active
                </Badge>
              </div>

              <div className="pt-2 border-t border-brand-teal-200 flex items-center justify-between text-xs">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenMyComplaints();
                  }}
                  className="text-brand-teal-800 font-semibold hover:underline"
                >
                  My Complaints
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLogout();
                  }}
                  className="text-rose-600 font-semibold hover:underline"
                >
                  Log Out
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 pt-1 pb-2">
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
          )}

          {/* Navigation Links */}
          <div className="space-y-1 pt-1 border-t border-brand-slate-100">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg text-left cursor-pointer ${
                    isActive
                      ? 'bg-brand-teal-50 text-brand-teal-700 border border-brand-teal-200'
                      : 'text-brand-slate-700 hover:bg-brand-slate-100'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <div className="flex items-center gap-2">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] font-medium bg-brand-slate-100 text-brand-slate-600 px-1.5 py-0.5 rounded border border-brand-slate-200">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
};
