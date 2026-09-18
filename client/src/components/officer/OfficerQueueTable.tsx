import React from 'react';
import {
  Search,
  RotateCcw,
  Eye,
  AlertCircle,
  MapPin,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import type { ComplaintRecord, OfficerComplaintsFilter } from '../../services/api';

interface OfficerQueueTableProps {
  complaints: ComplaintRecord[];
  selectedId: string | null;
  onSelectComplaint: (id: string) => void;
  isLoading: boolean;
  filters: OfficerComplaintsFilter;
  onFilterChange: (filters: OfficerComplaintsFilter) => void;
  onRefresh: () => void;
}

const LOCALITY_OPTIONS = [
  'All Localities',
  'Kuvempunagar',
  'Gokulam',
  'Jayalakshmipuram',
  'Vijayanagar',
  'Saraswathipuram',
  'Hebbal',
  'Chamundipuram',
  'Vontikoppal',
  'Nazarbad',
  'Krishnaraja Boulevard',
];

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'pothole', label: 'Roads & Potholes' },
  { value: 'waste', label: 'Waste & Sanitation' },
  { value: 'streetlight', label: 'Street Lighting' },
  { value: 'drainage', label: 'Drainage & Sewage' },
  { value: 'water', label: 'Water Supply' },
  { value: 'other', label: 'Other Grievances' },
];

export const OfficerQueueTable: React.FC<OfficerQueueTableProps> = ({
  complaints,
  selectedId,
  onSelectComplaint,
  isLoading,
  filters,
  onFilterChange,
  onRefresh,
}) => {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, q: e.target.value });
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({
      ...filters,
      status: e.target.value === 'ALL' ? undefined : e.target.value,
    });
  };

  const handleRiskChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({
      ...filters,
      duplicateRisk: e.target.value === 'ALL' ? undefined : e.target.value,
    });
  };

  const handleLocalityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({
      ...filters,
      locationArea: e.target.value === 'All Localities' ? undefined : e.target.value,
    });
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({
      ...filters,
      category: e.target.value || undefined,
    });
  };

  const handleResetFilters = () => {
    onFilterChange({});
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'RESOLVED':
        return 'verified';
      case 'IN_PROGRESS':
        return 'info';
      case 'UNDER_REVIEW':
      case 'FORWARDED':
        return 'review';
      case 'CLOSED':
        return 'neutral';
      default:
        return 'neutral';
    }
  };

  const getRiskBadgeVariant = (risk?: string) => {
    switch (risk) {
      case 'HIGH':
        return 'duplicate';
      case 'MEDIUM':
        return 'review';
      case 'LOW':
      default:
        return 'verified';
    }
  };

  return (
    <div className="bg-white border border-brand-slate-200 rounded-xl shadow-civic-sm overflow-hidden flex flex-col">
      {/* Search & Filter Bar */}
      <div className="p-4 border-b border-brand-slate-100 bg-brand-slate-50/70 space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Free Text Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-brand-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filters.q || ''}
              onChange={handleSearchChange}
              placeholder="Search by ID, Tracking Token, description, street..."
              className="w-full bg-white border border-brand-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-brand-slate-800 placeholder-brand-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-teal-500 transition"
            />
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRefresh}
              className="text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Refresh
            </Button>
            {(filters.q ||
              filters.status ||
              filters.duplicateRisk ||
              filters.locationArea ||
              filters.category) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="text-xs text-brand-slate-500 hover:text-brand-slate-800"
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>

        {/* Dropdown Filters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
          {/* Status */}
          <div>
            <select
              value={filters.status || 'ALL'}
              onChange={handleStatusChange}
              className="w-full bg-white border border-brand-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-brand-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-teal-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="FORWARDED">Forwarded</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>

          {/* Duplicate Risk */}
          <div>
            <select
              value={filters.duplicateRisk || 'ALL'}
              onChange={handleRiskChange}
              className="w-full bg-white border border-brand-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-brand-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-teal-500"
            >
              <option value="ALL">All Duplicate Risks</option>
              <option value="HIGH">High Duplicate Risk</option>
              <option value="MEDIUM">Medium Duplicate Risk</option>
              <option value="LOW">Low Duplicate Risk</option>
            </select>
          </div>

          {/* Locality */}
          <div>
            <select
              value={filters.locationArea || 'All Localities'}
              onChange={handleLocalityChange}
              className="w-full bg-white border border-brand-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-brand-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-teal-500"
            >
              {LOCALITY_OPTIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          {/* Category */}
          <div>
            <select
              value={filters.category || ''}
              onChange={handleCategoryChange}
              className="w-full bg-white border border-brand-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-brand-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-teal-500"
            >
              {CATEGORY_OPTIONS.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-brand-slate-50/80 border-b border-brand-slate-200 text-brand-slate-600 font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-3 px-4">Grievance & Token</th>
              <th className="py-3 px-4">Category & Locality</th>
              <th className="py-3 px-4">Observed Date</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Duplicate Risk</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-brand-slate-500">
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-6 h-6 border-2 border-brand-teal-600 border-t-transparent rounded-full animate-spin mb-2" />
                    <span>Loading municipal complaints queue...</span>
                  </div>
                </td>
              </tr>
            ) : complaints.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-brand-slate-500">
                  <div className="max-w-sm mx-auto space-y-2">
                    <AlertCircle className="w-8 h-8 text-brand-slate-300 mx-auto" />
                    <p className="font-semibold text-brand-slate-700 text-sm">
                      No complaints match the selected criteria
                    </p>
                    <p className="text-xs text-brand-slate-400">
                      Try clearing or adjusting search filters to view more records.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleResetFilters}
                      className="mt-2 text-xs"
                    >
                      Reset All Filters
                    </Button>
                  </div>
                </td>
              </tr>
            ) : (
              complaints.map((item) => {
                const isSelected = item.id === selectedId;
                const risk = item.verificationResult?.duplicateRisk || 'LOW';

                return (
                  <tr
                    key={item.id}
                    onClick={() => onSelectComplaint(item.id)}
                    className={`cursor-pointer transition-colors hover:bg-brand-teal-50/30 ${
                      isSelected ? 'bg-brand-teal-50/60 border-l-4 border-l-brand-teal-600' : ''
                    }`}
                  >
                    {/* ID & Token */}
                    <td className="py-3 px-4">
                      <div className="font-mono font-semibold text-brand-slate-800">
                        {item.id}
                      </div>
                      <div className="font-mono text-[11px] text-brand-slate-400">
                        {item.trackingToken}
                      </div>
                      {item.isDemo && (
                        <span className="inline-block mt-0.5 text-[10px] text-purple-700 font-medium bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                          Demo
                        </span>
                      )}
                    </td>

                    {/* Category & Locality */}
                    <td className="py-3 px-4">
                      <div className="font-medium text-brand-slate-800 capitalize">
                        {item.category}
                      </div>
                      <div className="text-brand-slate-500 text-[11px] flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-brand-teal-600 shrink-0" />
                        <span>{item.locationArea}</span>
                      </div>
                    </td>

                    {/* Observed Date */}
                    <td className="py-3 px-4 text-brand-slate-600 whitespace-nowrap">
                      <div>{item.observedDate}</div>
                      <div className="text-[10px] text-brand-slate-400">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <Badge variant={getStatusBadgeVariant(item.status)} size="sm">
                        {item.status}
                      </Badge>
                    </td>

                    {/* Duplicate Risk */}
                    <td className="py-3 px-4">
                      <Badge variant={getRiskBadgeVariant(risk)} size="sm">
                        {risk} RISK
                      </Badge>
                      {item.verificationResult?.matches &&
                        item.verificationResult.matches.length > 0 && (
                          <div className="text-[10px] text-brand-slate-500 mt-0.5">
                            {item.verificationResult.matches.length} cluster match
                            {item.verificationResult.matches.length > 1 ? 'es' : ''}
                          </div>
                        )}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectComplaint(item.id);
                        }}
                        className="text-xs py-1 px-2.5"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1 text-brand-teal-700" />
                        Inspect Dossier
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div className="p-3 bg-brand-slate-50 border-t border-brand-slate-100 flex items-center justify-between text-[11px] text-brand-slate-500">
        <span>
          Showing <strong className="text-brand-slate-700">{complaints.length}</strong> grievance record
          {complaints.length === 1 ? '' : 's'}
        </span>
        <span className="italic">
          Click any row to open the complete inspection dossier & verification audit ledger
        </span>
      </div>
    </div>
  );
};
