import type { IssueCategory, VerificationResult } from './verification.js';

export type ComplaintStatus =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'NEEDS_CLARIFICATION'
  | 'FORWARDED'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'CLOSED';

export interface EvidenceMetadata {
  filename: string;
  sizeBytes: number;
  mimetype: string;
  submittedAt: string;
  note: string;
}

export interface ComplaintRecord {
  id: string;
  trackingToken: string;
  citizenId: string;
  category: IssueCategory;
  customCategory?: string;
  description: string;
  observedDate: string;
  locationArea: string;
  addressText?: string;
  latitude?: number;
  longitude?: number;
  hasImage: boolean;
  evidenceMetadata?: EvidenceMetadata;
  imagePath?: string;
  imageSha256?: string;
  imagePhash?: string;
  status: ComplaintStatus;
  verificationResult?: VerificationResult;
  assignedOfficerId?: string;
  assignedDepartment?: string;
  reviewNotes?: string;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  primaryComplaintId?: string;
  duplicateClusterId?: string;
  resolutionAction?: string;
  resolvedByOfficerId?: string;
  resolvedAt?: string;
}

export type ResolutionActionType =
  | 'MARK_RELATED'
  | 'MERGE_DUPLICATES'
  | 'UNLINK'
  | 'MARK_DISTINCT';

export interface ComplaintResolutionAuditRecord {
  id: string;
  clusterId: string;
  primaryComplaintId: string;
  secondaryComplaintIds: string[];
  actionType: ResolutionActionType;
  officerId: string;
  officerName: string;
  decisionNotes: string;
  previousStates: Record<string, any>;
  createdAt: string;
}

export interface CreateComplaintInput {
  category: IssueCategory;
  customCategory?: string;
  description: string;
  observedDate: string;
  locationArea: string;
  addressText?: string;
  latitude?: number;
  longitude?: number;
  hasImage?: boolean;
  evidenceMetadata?: EvidenceMetadata;
  imagePath?: string;
  imageSha256?: string;
  imagePhash?: string;
}

export interface PublicTrackResult {
  id: string;
  trackingToken: string;
  category: IssueCategory;
  customCategory?: string;
  description: string;
  locationArea: string;
  observedDate: string;
  status: ComplaintStatus;
  assignedDepartment?: string;
  verificationOutcome?: string;
  duplicateRisk?: string;
  signals?: string[];
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  disclaimer: string;
}

export interface OfficerReviewInput {
  status?: ComplaintStatus;
  assignedDepartment?: string;
  assignedOfficerId?: string;
  reviewNotes?: string;
}

export interface PublicComplaintSummary {
  id: string;
  category: IssueCategory;
  customCategory?: string;
  locationArea: string;
  status: ComplaintStatus;
  observedDate: string;
  createdAt: string;
  verificationOutcome?: string;
  duplicateRisk?: string;
  hasCoordinates: boolean;
  latitude?: number;
  longitude?: number;
}

export interface PublicAnalyticsData {
  totalComplaints: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  byArea: Record<string, number>;
  byVerificationOutcome: Record<string, number>;
  byDuplicateRisk: Record<string, number>;
  coordinatesCoverage: {
    totalWithCoordinates: number;
    totalWithoutCoordinates: number;
  };
  resolutionRatePercent: number;
  verifiedRatePercent: number;
  recentComplaints: PublicComplaintSummary[];
  generatedAt: string;
}
