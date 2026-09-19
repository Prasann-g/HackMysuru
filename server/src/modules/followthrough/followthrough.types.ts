import type { ComplaintStatus } from '../../types/complaint.js';
import type { IssueCategory } from '../../types/verification.js';
import type { DelayRiskPredictionResult } from '../../services/ml/delayRiskPredictor.js';

// ============================================================================
// Activity Log Record (Database row)
// ============================================================================

export type ActivityEventType =
  | 'COMPLAINT_CREATED'
  | 'VERIFICATION_PROCESSED'
  | 'DEPARTMENT_ROUTED'
  | 'OFFICER_ASSIGNED'
  | 'STATUS_CHANGED'
  | 'OFFICER_REVIEW'
  | 'DUPLICATE_ACTION'
  | 'RESOLVED'
  | 'CLOSED';

export interface ActivityLogRecord {
  id: string;
  complaintId: string;
  eventType: ActivityEventType;
  sourceTable: string;
  sourceRecordId: string;
  actorId?: string;
  actorName?: string;
  actorRole?: 'CITIZEN' | 'OFFICER' | 'ADMIN' | 'SYSTEM';
  oldStatus?: ComplaintStatus;
  newStatus?: ComplaintStatus;
  notes?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

// ============================================================================
// Chronological Timeline Event (Presented to Citizen or Officer)
// ============================================================================

export interface TimelineEvent {
  id: string;
  eventType: ActivityEventType;
  timestamp: string;
  title: string;
  description: string;
  actor?: {
    name?: string;
    role?: string;
  };
  statusTransition?: {
    from?: ComplaintStatus;
    to?: ComplaintStatus;
  };
  details?: Record<string, any>;
  source: {
    table: string;
    recordId: string;
  };
}

// ============================================================================
// SLA Indicator (Derived Metric - Operational Monitoring Rule)
// ============================================================================

export type SlaState = 'ON_TRACK' | 'DUE_SOON' | 'OVERDUE' | 'COMPLETED' | 'UNKNOWN';

export interface SlaIndicator {
  slaStartTime: string;
  slaDueTime: string;
  targetHours: number;
  elapsedHours: number;
  remainingHours: number;
  overdue: boolean;
  slaState: SlaState;
  disclaimer: string;
}

// ============================================================================
// Inactivity Indicator (Derived Metric - Meaningful Activity)
// ============================================================================

export type ActivityState = 'ACTIVE' | 'INACTIVE' | 'COMPLETED';

export interface InactivityIndicator {
  lastMeaningfulActivityAt: string;
  inactivityHours: number;
  thresholdHours: number;
  activityState: ActivityState;
  explanation: string;
}

// ============================================================================
// Follow-Through Dossier (Composite Representation)
// ============================================================================

export interface FollowThroughDossier {
  complaintId: string;
  trackingToken: string;
  currentStatus: ComplaintStatus;
  category: IssueCategory;
  observed: {
    createdAt: string;
    observedDate: string;
    resolvedAt?: string;
    lastActivityAt: string;
    assignedDepartment?: string;
    assignedOfficerId?: string;
  };
  timeline: TimelineEvent[];
  sla: SlaIndicator;
  inactivity: InactivityIndicator;
  delayRisk: DelayRiskPredictionResult;
  generatedAt: string;
}
