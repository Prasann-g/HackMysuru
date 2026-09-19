import React from 'react';
import {
  FileText,
  ShieldCheck,
  Building2,
  UserCheck,
  ArrowRightCircle,
  FileEdit,
  Layers,
  CheckCircle2,
  Archive,
  Clock,
} from 'lucide-react';
import type { TimelineEvent } from '../../services/api';

interface ComplaintTimelineProps {
  timeline: TimelineEvent[];
  isCitizenView?: boolean;
}

export const ComplaintTimeline: React.FC<ComplaintTimelineProps> = ({
  timeline,
  isCitizenView = false,
}) => {
  if (!timeline || timeline.length === 0) {
    return (
      <div className="p-5 text-center text-xs text-bridge-charcoal-500 bg-bridge-almond-50/50 border border-dashed border-bridge-almond-200 rounded-xl">
        No lifecycle activity records have been logged yet for this grievance.
      </div>
    );
  }

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'COMPLAINT_CREATED':
        return <FileText className="w-4 h-4 text-bridge-gold-700" />;
      case 'VERIFICATION_PROCESSED':
        return <ShieldCheck className="w-4 h-4 text-emerald-700" />;
      case 'DEPARTMENT_ROUTED':
        return <Building2 className="w-4 h-4 text-blue-700" />;
      case 'OFFICER_ASSIGNED':
        return <UserCheck className="w-4 h-4 text-purple-700" />;
      case 'STATUS_CHANGED':
        return <ArrowRightCircle className="w-4 h-4 text-indigo-700" />;
      case 'OFFICER_REVIEW':
        return <FileEdit className="w-4 h-4 text-amber-700" />;
      case 'DUPLICATE_ACTION':
        return <Layers className="w-4 h-4 text-purple-700" />;
      case 'RESOLVED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-700" />;
      case 'CLOSED':
        return <Archive className="w-4 h-4 text-slate-700" />;
      default:
        return <Clock className="w-4 h-4 text-bridge-charcoal-600" />;
    }
  };

  const getEventBadgeClass = (eventType: string) => {
    switch (eventType) {
      case 'COMPLAINT_CREATED':
        return 'bg-bridge-gold-50 border-bridge-gold-200 text-bridge-gold-900';
      case 'VERIFICATION_PROCESSED':
        return 'bg-emerald-50 border-emerald-200 text-emerald-900';
      case 'DEPARTMENT_ROUTED':
        return 'bg-blue-50 border-blue-200 text-blue-900';
      case 'OFFICER_ASSIGNED':
        return 'bg-purple-50 border-purple-200 text-purple-900';
      case 'STATUS_CHANGED':
        return 'bg-indigo-50 border-indigo-200 text-indigo-900';
      case 'OFFICER_REVIEW':
        return 'bg-amber-50 border-amber-200 text-amber-900';
      case 'DUPLICATE_ACTION':
        return 'bg-purple-50 border-purple-200 text-purple-900';
      case 'RESOLVED':
        return 'bg-emerald-50 border-emerald-200 text-emerald-900';
      case 'CLOSED':
        return 'bg-slate-100 border-slate-200 text-slate-900';
      default:
        return 'bg-bridge-almond-50 border-bridge-almond-200 text-bridge-charcoal-800';
    }
  };

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-bridge-almond-200">
      {timeline.map((evt, idx) => {
        const isLatest = idx === timeline.length - 1;
        const formattedDate = new Date(evt.timestamp).toLocaleString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        return (
          <div key={evt.id} className="relative group">
            {/* Timeline node icon */}
            <div
              className={`absolute -left-6 top-1 w-5 h-5 rounded-full flex items-center justify-center bg-white border-2 ${
                isLatest ? 'border-bridge-gold-500 shadow-sm' : 'border-bridge-almond-300'
              }`}
            >
              <div className="scale-75">{getEventIcon(evt.eventType)}</div>
            </div>

            {/* Event Card */}
            <div className="bg-white border border-bridge-almond-200 rounded-xl p-3.5 shadow-civic-xs space-y-2 hover:border-bridge-almond-300 transition">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${getEventBadgeClass(
                      evt.eventType
                    )}`}
                  >
                    {evt.title}
                  </span>
                  {evt.statusTransition?.to && (
                    <span className="text-[11px] font-mono font-medium text-bridge-charcoal-700 bg-bridge-almond-100 px-2 py-0.5 rounded flex items-center gap-1">
                      {evt.statusTransition.from && (
                        <span>{evt.statusTransition.from} &rarr; </span>
                      )}
                      <strong>{evt.statusTransition.to}</strong>
                    </span>
                  )}
                </div>

                <span className="text-[11px] text-bridge-charcoal-500 font-mono">
                  {formattedDate}
                </span>
              </div>

              <p className="text-xs text-bridge-charcoal-700 leading-relaxed">
                {evt.description}
              </p>

              {/* Actor & Source Attribution */}
              <div className="flex items-center justify-between text-[11px] text-bridge-charcoal-500 pt-1 border-t border-bridge-almond-100">
                <span>
                  By:{' '}
                  <strong className="font-semibold text-bridge-charcoal-700">
                    {evt.actor?.name || evt.actor?.role || 'Municipal System'}
                  </strong>
                </span>
                {!isCitizenView && (
                  <span className="font-mono text-[10px] text-bridge-charcoal-400">
                    {evt.source.table}:{evt.source.recordId.substring(0, 14)}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
