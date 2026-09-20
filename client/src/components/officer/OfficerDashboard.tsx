import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  AlertTriangle,
  Clock,
  Layers,
  RotateCcw,
  UserCheck,
  ShieldAlert,
  MapPin,
  FileText,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  apiGetOfficerComplaints,
  apiTrackComplaint,
  type ComplaintRecord,
  type OfficerComplaintsFilter,
} from '../../services/api';
import type { CitizenUser } from '../../types/auth';
import { OfficerQueueTable } from './OfficerQueueTable';
import { OfficerDetailDrawer } from './OfficerDetailDrawer';
import { PublicMapAnalytics } from '../public/PublicMapAnalytics';
import { InspectDossierCard } from './InspectDossierCard';

interface OfficerDashboardProps {
  currentOfficer: CitizenUser;
}

export const OfficerDashboard: React.FC<OfficerDashboardProps> = ({
  currentOfficer,
}) => {
  const [complaints, setComplaints] = useState<ComplaintRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filters, setFilters] = useState<OfficerComplaintsFilter>({});
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Integrated Console View: 'queue' or 'map'
  const [activeView, setActiveView] = useState<'queue' | 'map'>('queue');

  const fetchComplaints = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await apiGetOfficerComplaints(filters);
      setComplaints(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load officer queue.');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    let active = true;
    apiGetOfficerComplaints(filters)
      .then((data) => {
        if (active) {
          setComplaints(data);
          setIsLoading(false);
        }
      })
      .catch((err: any) => {
        if (active) {
          setErrorMsg(err.message || 'Failed to load officer queue.');
          setIsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [filters]);

  // Compute live KPIs from the retrieved complaints dataset
  const totalCount = complaints.length;
  const pendingTriageCount = complaints.filter(
    (c) => c.status === 'SUBMITTED' || c.status === 'UNDER_REVIEW' || c.status === 'NEEDS_CLARIFICATION'
  ).length;
  const inProgressCount = complaints.filter(
    (c) => c.status === 'IN_PROGRESS' || c.status === 'FORWARDED'
  ).length;
  const atRiskCount = complaints.filter(
    (c) => c.delayRisk?.riskLevel === 'HIGH' || c.delayRisk?.slaStatus === 'AT_RISK'
  ).length;
  const breachedCount = complaints.filter(
    (c) => c.delayRisk?.riskLevel === 'BREACHED' || c.delayRisk?.slaStatus === 'BREACHED'
  ).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fadeIn">
      <h2 className="sr-only">Officer Dashboard</h2>

      {/* Officer Profile & Jurisdiction Header */}
      <div className="bg-white border border-bridge-almond-200 rounded-2xl p-6 shadow-civic-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-bridge-gold-50 border border-bridge-gold-200 flex items-center justify-center shrink-0 text-bridge-gold-700">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-bridge-charcoal-900">
                  MCC Grievance Verification &amp; Review Console
                </h1>
                <Badge variant="verified" size="sm">
                  {currentOfficer.role === 'ADMIN' ? 'MCC ADMINISTRATOR' : 'MCC OFFICER'}
                </Badge>
                <span className="text-xs text-bridge-charcoal-500 font-mono bg-bridge-almond-100 px-2 py-0.5 rounded">
                  {currentOfficer.department || (currentOfficer.role === 'ADMIN' ? 'Executive Administration' : 'MCC Engineering Division')}
                </span>
              </div>
              <p className="text-xs text-bridge-charcoal-500 mt-1">
                Authenticated {currentOfficer.role === 'ADMIN' ? 'Administrator' : 'Officer'}: <strong className="text-bridge-charcoal-700">{currentOfficer.name}</strong> ({currentOfficer.email})
                {currentOfficer.ward ? (
                  <>
                    {' '}• Jurisdiction:{' '}
                    <strong className="text-bridge-gold-700">{currentOfficer.ward}</strong>
                  </>
                ) : (
                  <>
                    {' '}• Jurisdiction:{' '}
                    <strong className="text-bridge-gold-700">All Wards (City-wide)</strong>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <div className="text-right hidden sm:block">
              <span className="text-[11px] text-bridge-charcoal-400 block">Session Status</span>
              <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5" />
                Verified Active
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchComplaints}
              className="text-xs ml-2"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1 text-bridge-charcoal-600" />
              Sync Queue
            </Button>
          </div>
        </div>
      </div>

      {/* 5 Operational KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* 1. Total in Queue */}
        <div className="kpi-card kpi-glow-default">
          <div className="kpi-card-inner">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-bridge-charcoal-500">Total in Queue</span>
              <Layers className="w-4 h-4 text-bridge-charcoal-400 kpi-icon" />
            </div>
            <div className="text-2xl font-bold text-bridge-charcoal-900 leading-none">
              {totalCount}
            </div>
            <span className="text-[11px] text-bridge-charcoal-400 mt-1.5">All matching filters</span>
          </div>
        </div>

        {/* 2. Pending Triage */}
        <div className="kpi-card kpi-glow-amber">
          <div className="kpi-card-inner">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-amber-800">Pending Triage</span>
              <Clock className="w-4 h-4 text-amber-600 kpi-icon" />
            </div>
            <div className="text-2xl font-bold text-amber-900 leading-none">
              {pendingTriageCount}
            </div>
            <span className="text-[11px] text-amber-700/80 mt-1.5">Awaiting officer action</span>
          </div>
        </div>

        {/* 3. In Progress */}
        <div className="kpi-card kpi-glow-gold">
          <div className="kpi-card-inner">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-bridge-gold-800">In Progress</span>
              <Building2 className="w-4 h-4 text-bridge-gold-600 kpi-icon" />
            </div>
            <div className="text-2xl font-bold text-bridge-gold-900 leading-none">
              {inProgressCount}
            </div>
            <span className="text-[11px] text-bridge-gold-700/80 mt-1.5">Active field work order</span>
          </div>
        </div>

        {/* 4. At Risk */}
        <div className="kpi-card kpi-glow-rose">
          <div className="kpi-card-inner">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-amber-800">At Risk</span>
              <AlertTriangle className="w-4 h-4 text-amber-600 kpi-icon" />
            </div>
            <div className="text-2xl font-bold text-amber-900 leading-none">
              {atRiskCount}
            </div>
            <span className="text-[11px] text-amber-700/80 mt-1.5">Approaching SLA deadline</span>
          </div>
        </div>

        {/* 5. SLA Breached */}
        <div className="kpi-card kpi-glow-rose col-span-2 sm:col-span-1">
          <div className="kpi-card-inner">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-rose-700">SLA Breached</span>
              <ShieldAlert className="w-4 h-4 text-rose-600 kpi-icon" />
            </div>
            <div className="text-2xl font-bold text-rose-900 leading-none">
              {breachedCount}
            </div>
            <span className="text-[11px] text-rose-600/80 mt-1.5">Resolution SLA exceeded</span>
          </div>
        </div>
      </div>

      {/* Error Notice */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchComplaints}
            className="text-xs"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Inspect Dossier Quick Access Card */}
      <InspectDossierCard
        complaints={complaints}
        onSelectComplaint={(id) => setSelectedComplaintId(id)}
      />

      {/* Integrated Console View Switcher Tabs */}
      <div className="flex items-center gap-3 border-b border-bridge-almond-200 pb-2">
        <button
          onClick={() => setActiveView('queue')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 cursor-pointer active:scale-[0.985] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-gold-500 ${
            activeView === 'queue'
              ? 'bg-bridge-charcoal-900 text-white shadow-civic'
              : 'bg-white text-bridge-charcoal-700 hover:bg-bridge-almond-100 hover:border-bridge-almond-300 border border-bridge-almond-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Verification &amp; Triage Queue ({totalCount})</span>
        </button>

        <button
          onClick={() => setActiveView('map')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 cursor-pointer active:scale-[0.985] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-gold-500 ${
            activeView === 'map'
              ? 'bg-bridge-charcoal-900 text-white shadow-civic'
              : 'bg-white text-bridge-charcoal-700 hover:bg-bridge-almond-100 hover:border-bridge-almond-300 border border-bridge-almond-200'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Mysuru Ward Spatial Map &amp; Hotspots</span>
        </button>
      </div>

      {/* Active Tab View */}
      {activeView === 'queue' ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-bridge-charcoal-900">
                Incoming Complaints &amp; Verification Ledger
              </h2>
              <p className="text-xs text-bridge-charcoal-500">
                Filter by status, duplicate risk, and ward locality to inspect evidence and dispatch field work.
              </p>
            </div>
          </div>

          <OfficerQueueTable
            complaints={complaints}
            selectedId={selectedComplaintId}
            onSelectComplaint={(id) => setSelectedComplaintId(id)}
            isLoading={isLoading}
            filters={filters}
            onFilterChange={(newFilters) => setFilters(newFilters)}
            onRefresh={fetchComplaints}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white border border-bridge-almond-200 rounded-2xl p-4 sm:p-5 shadow-bridge-card">
            <h3 className="text-base font-bold text-bridge-charcoal-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-bridge-gold-700" />
              <span>Ward-Level Complaint Distribution &amp; Geo-Spatial Density</span>
            </h3>
            <p className="text-xs text-bridge-charcoal-500 mt-0.5">
              Live geographic coordinates and cluster intensity across Mysuru wards to assist resource deployment and preventative maintenance.
            </p>
          </div>

          <PublicMapAnalytics
            onNavigateToReport={() => {}}
            onNavigateToTrack={(token) => {
              if (token) {
                // Find if complaint exists in queue or by token
                const found = complaints.find((c) => c.trackingToken === token || c.id === token);
                if (found) {
                  setSelectedComplaintId(found.id);
                } else {
                  apiTrackComplaint(token)
                    .then((res) => {
                      if (res && res.id) setSelectedComplaintId(res.id);
                    })
                    .catch(() => {
                      setSelectedComplaintId(token);
                    });
                }
              }
            }}
          />
        </div>
      )}

      {/* Inspection Detail Drawer / Modal */}
      <OfficerDetailDrawer
        complaintId={selectedComplaintId}
        onClose={() => setSelectedComplaintId(null)}
        onUpdated={fetchComplaints}
        currentOfficer={currentOfficer}
      />
    </div>
  );
};
