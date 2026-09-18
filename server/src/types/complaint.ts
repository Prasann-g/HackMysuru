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
  status: ComplaintStatus;
  verificationResult?: VerificationResult;
  assignedOfficerId?: string;
  assignedDepartment?: string;
  reviewNotes?: string;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
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
