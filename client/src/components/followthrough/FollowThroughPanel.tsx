import React from 'react';
import {
  Clock,
  Activity,
  AlertTriangle,
  Hourglass,
  CheckCircle2,
  HelpCircle,
  ShieldAlert,
} from 'lucide-react';
import type {
  SlaIndicator,
  InactivityIndicator,
  DelayRiskResult,
} from '../../services/api';

interface FollowThroughPanelProps {
  sla: SlaIndicator;
  inactivity: InactivityIndicator;
  delayRisk?: DelayRiskResult;
  isOfficer?: boolean;
}

export const FollowThroughPanel: React.FC<FollowThroughPanelProps> = ({
  sla,
  inactivity,
  delayRisk,
  isOfficer = false,
}) => {
  const getSlaBadgeVariant = (state: string) => {
    switch (state) {
      case 'ON_TRACK':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'DUE_SOON':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'OVERDUE':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      case 'COMPLETED':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      default:
        return 'bg-bridge-almond-50 text-bridge-charcoal-700 border-bridge-almond-200';
    }
  };

  const getActivityBadgeVariant = (state: string) => {
    switch (state) {
      case 'ACTIVE':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'INACTIVE':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'COMPLETED':
        return 'bg-slate-100 text-slate-800 border-slate-200';
      default:
        return 'bg-bridge-almond-50 text-bridge-charcoal-700 border-bridge-almond-200';
    }
  };

  const getRiskBadgeVariant = (level: string) => {
    switch (level) {
      case 'BREACHED':
      case 'HIGH':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      case 'MEDIUM':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'LOW':
      default:
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    }
  };

  // Calculate SLA progress percentage
  const progressPercent = Math.min(
    100,
    Math.round((sla.elapsedHours / Math.max(1, sla.targetHours)) * 100)
  );

  return (
    <div className="space-y-4">
      {/* 1. Operational SLA Monitoring Target Card */}
      <div className="bg-white border border-bridge-almond-200 rounded-xl p-4 shadow-civic-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-bridge-almond-100">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-bridge-gold-600 shrink-0" />
            <span className="font-semibold text-xs text-bridge-charcoal-800">
              Resolution Monitoring Benchmark
            </span>
          </div>
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${getSlaBadgeVariant(
              sla.slaState
            )}`}
          >
            {sla.slaState.replace(/_/g, ' ')}
          </span>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-bridge-charcoal-600 font-medium">
            <span>Elapsed: {sla.elapsedHours}h</span>
            <span>Target: {sla.targetHours}h</span>
          </div>
          <div className="w-full bg-bridge-almond-100 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                sla.slaState === 'OVERDUE'
                  ? 'bg-rose-500'
                  : sla.slaState === 'DUE_SOON'
                  ? 'bg-amber-500'
                  : sla.slaState === 'COMPLETED'
                  ? 'bg-emerald-500'
                  : 'bg-bridge-gold-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px]">
            {sla.slaState === 'COMPLETED' ? (
              <span className="text-emerald-700 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Grievance completed within operational window
              </span>
            ) : sla.overdue ? (
              <span className="text-rose-700 font-medium flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Benchmark exceeded by {Math.round(sla.elapsedHours - sla.targetHours)}h
              </span>
            ) : (
              <span className="text-bridge-charcoal-600 flex items-center gap-1">
                <Hourglass className="w-3.5 h-3.5 text-bridge-gold-600" />
                {sla.remainingHours}h remaining in target window
              </span>
            )}
          </div>
        </div>

        {/* Mandatory Prototype SLA Disclaimer */}
        <div className="bg-bridge-almond-50/70 border border-bridge-almond-200 rounded-lg p-2 text-[11px] text-bridge-charcoal-600 leading-relaxed flex items-start gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 text-bridge-gold-600 shrink-0 mt-0.5" />
          <span>{sla.disclaimer}</span>
        </div>
      </div>

      {/* 2. Inactivity Monitoring Card */}
      <div className="bg-white border border-bridge-almond-200 rounded-xl p-4 shadow-civic-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-bridge-almond-100">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-bridge-gold-600 shrink-0" />
            <span className="font-semibold text-xs text-bridge-charcoal-800">
              Activity &amp; Dormancy Status
            </span>
          </div>
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${getActivityBadgeVariant(
              inactivity.activityState
            )}`}
          >
            {inactivity.activityState}
          </span>
        </div>

        <p className="text-xs text-bridge-charcoal-700 leading-relaxed">
          {inactivity.explanation}
        </p>

        <div className="flex items-center justify-between text-[11px] text-bridge-charcoal-500 pt-1 border-t border-bridge-almond-100">
          <span>
            Last Meaningful Action:{' '}
            <strong className="text-bridge-charcoal-700">
              {new Date(inactivity.lastMeaningfulActivityAt).toLocaleDateString()}{' '}
              {new Date(inactivity.lastMeaningfulActivityAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </strong>
          </span>
          <span className="font-mono text-[10px]">
            Threshold: {inactivity.thresholdHours}h
          </span>
        </div>
      </div>

      {/* 3. Delay-Risk Decision Support (Officer View Only) */}
      {isOfficer && delayRisk && (
        <div className="bg-white border border-bridge-almond-200 rounded-xl p-4 shadow-civic-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-bridge-almond-100">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-bridge-gold-600 shrink-0" />
              <div>
                <span className="font-semibold text-xs text-bridge-charcoal-800 block">
                  Resolution Risk Assessment
                </span>
                <span className="text-[10px] font-mono text-bridge-charcoal-400">
                  {delayRisk.modelVersion}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded border uppercase tracking-wider ${getRiskBadgeVariant(
                  delayRisk.riskLevel
                )}`}
              >
                {delayRisk.riskLevel} RISK ({delayRisk.riskScore}/100)
              </span>
            </div>
          </div>

          {/* Itemized Contributing Factors */}
          {delayRisk.contributingFactors && delayRisk.contributingFactors.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-bridge-charcoal-700 block">
                Contributing Risk Factors:
              </span>
              <ul className="space-y-1 text-xs text-bridge-charcoal-700">
                {delayRisk.contributingFactors.map((factor, idx) => (
                  <li key={idx} className="flex items-start gap-1.5 leading-relaxed">
                    <span className="text-bridge-gold-600 font-bold shrink-0">&bull;</span>
                    <span>{factor}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommended Action */}
          {delayRisk.recommendedAction && (
            <div className="text-xs text-bridge-charcoal-800 bg-bridge-almond-50/50 p-2.5 rounded-lg border border-bridge-almond-100">
              <strong className="block text-[11px] font-semibold text-bridge-charcoal-900 mb-0.5">
                Recommended Action:
              </strong>
              {delayRisk.recommendedAction}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
