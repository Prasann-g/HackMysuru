import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  RotateCcw,
  UserCheck,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  apiGetOfficerComplaints,
  type ComplaintRecord,
  type OfficerComplaintsFilter,
} from '../../services/api';
import type { CitizenUser } from '../../types/auth';
import { OfficerQueueTable } from './OfficerQueueTable';
import { OfficerDetailDrawer } from './OfficerDetailDrawer';

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
  const pendingReviewCount = complaints.filter(
    (c) => c.status === 'SUBMITTED' || c.status === 'UNDER_REVIEW'
  ).length;
  const highDuplicateCount = complaints.filter(
    (c) => c.verificationResult?.duplicateRisk === 'HIGH'
  ).length;
  const inProgressCount = complaints.filter(
    (c) => c.status === 'IN_PROGRESS' || c.status === 'FORWARDED'
  ).length;
  const resolvedCount = complaints.filter(
    (c) => c.status === 'RESOLVED' || c.status === 'CLOSED'
  ).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fadeIn">
      {/* Officer Profile & Jurisdiction Header */}
      <div className="bg-white border border-brand-slate-200 rounded-2xl p-6 shadow-civic-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-brand-teal-50 border border-brand-teal-200 flex items-center justify-center shrink-0 text-brand-teal-700">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-brand-slate-900">
                  MCC Grievance Verification & Review Console
                </h1>
                <Badge variant="verified" size="sm">
                  MCC OFFICER
                </Badge>
                <span className="text-xs text-brand-slate-500 font-mono bg-brand-slate-100 px-2 py-0.5 rounded">
                  {currentOfficer.department || 'MCC Engineering Division'}
                </span>
              </div>
              <p className="text-xs text-brand-slate-500 mt-1">
                Authenticated Officer: <strong className="text-brand-slate-700">{currentOfficer.name}</strong> ({currentOfficer.email})
                {currentOfficer.ward && (
                  <>
                    {' '}• Jurisdiction:{' '}
                    <strong className="text-brand-teal-700">{currentOfficer.ward}</strong>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <div className="text-right hidden sm:block">
              <span className="text-[11px] text-brand-slate-400 block">Session Status</span>
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
              <RotateCcw className="w-3.5 h-3.5 mr-1 text-brand-slate-600" />
              Sync Queue
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Queue */}
        <div className="bg-white border border-brand-slate-200 rounded-xl p-4 shadow-civic-sm">
          <div className="flex items-center justify-between text-brand-slate-500 text-xs">
            <span>Total in Queue</span>
            <Layers className="w-4 h-4 text-brand-slate-400" />
          </div>
          <div className="text-2xl font-bold text-brand-slate-900 mt-2">
            {totalCount}
          </div>
          <span className="text-[11px] text-brand-slate-400">Current matching filters</span>
        </div>

        {/* Pending Review */}
        <div className="bg-white border border-brand-slate-200 rounded-xl p-4 shadow-civic-sm">
          <div className="flex items-center justify-between text-amber-800 text-xs">
            <span>Pending Review</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-900 mt-2">
            {pendingReviewCount}
          </div>
          <span className="text-[11px] text-amber-700/80">Awaiting officer triage</span>
        </div>

        {/* High Duplicate Risk */}
        <div className="bg-white border border-brand-slate-200 rounded-xl p-4 shadow-civic-sm">
          <div className="flex items-center justify-between text-rose-700 text-xs">
            <span>Duplicate Alerts</span>
            <ShieldAlert className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold text-rose-900 mt-2">
            {highDuplicateCount}
          </div>
          <span className="text-[11px] text-rose-600/80">Requires consolidation</span>
        </div>

        {/* In Progress */}
        <div className="bg-white border border-brand-slate-200 rounded-xl p-4 shadow-civic-sm">
          <div className="flex items-center justify-between text-brand-teal-800 text-xs">
            <span>In Progress</span>
            <Building2 className="w-4 h-4 text-brand-teal-600" />
          </div>
          <div className="text-2xl font-bold text-brand-teal-900 mt-2">
            {inProgressCount}
          </div>
          <span className="text-[11px] text-brand-teal-700/80">Active field remediation</span>
        </div>

        {/* Resolved / Closed */}
        <div className="bg-white border border-brand-slate-200 rounded-xl p-4 shadow-civic-sm col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-emerald-800 text-xs">
            <span>Resolved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-900 mt-2">
            {resolvedCount}
          </div>
          <span className="text-[11px] text-emerald-700/80">Remediated & verified</span>
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

      {/* Main Review Queue Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-brand-slate-900">
              Incoming Complaints & Verification Ledger
            </h2>
            <p className="text-xs text-brand-slate-500">
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
