export type AuthorityType =
  | 'MCC'
  | 'TOWN_PANCHAYAT'
  | 'GRAM_PANCHAYAT'
  | 'UNKNOWN';

export type RoutingStatus =
  | 'ROUTED'
  | 'UNKNOWN'
  | 'REVIEW_REQUIRED'
  | 'INVALID_LOCATION'
  | 'INVALID_CATEGORY'
  | 'MISSING_INFORMATION';

export type RoutingProvenance =
  | 'RULE_BASED'
  | 'VERIFIED'
  | 'ESTIMATED'
  | 'HUMAN_CONFIRMED'
  | 'UNKNOWN';

export interface JurisdictionVersion {
  jurisdictionId: string;
  authorityType: AuthorityType;
  authorityName: string;
  version: string;
  effectiveFrom: string;
  effectiveTo?: string;
  boundaryReference?: string;
  source: string;
  verificationStatus: 'VERIFIED' | 'PARTIAL' | 'UNAVAILABLE';
  notes?: string;
}

export interface RoutingOverrideAudit {
  officerId: string;
  officerName: string;
  previousDecision: RoutingDecision;
  newDecision: {
    authorityType: AuthorityType;
    authorityName: string;
    department: string;
    status: RoutingStatus;
    reviewRequired: boolean;
    explanation: string[];
  };
  overrideReason: string;
  timestamp: string;
}

export interface RoutingDecision {
  status: RoutingStatus;
  authorityType: AuthorityType;
  authorityName: string;
  department: string;
  departmentProvenance: RoutingProvenance;
  jurisdictionProvenance: RoutingProvenance;
  provenance: RoutingProvenance;
  reviewRequired: boolean;
  explanation: string[];
  jurisdictionId?: string;
  jurisdictionVersion?: string;
  effectiveDateUsed?: string;
  wardId?: number;
  wardName?: string;
  wardNumber?: string;
  wardCode?: string;
  lgdWardCode?: number;
  boundaryVersion?: string;
  wardStatus?: 'matched' | 'outside_boundary' | 'boundary_unavailable';
  timestamp: string;
  overrideHistory?: RoutingOverrideAudit[];
}

export interface RoutingInput {
  latitude?: any;
  longitude?: any;
  locationArea?: string;
  addressText?: string;
  category: string;
  observedDate?: string;
  verificationOutcome?: string;
  duplicateRisk?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface CoordinateValidationResult {
  valid: boolean;
  hasCoordinates: boolean;
  latitude?: number;
  longitude?: number;
  error?: string;
}

export interface OfficerRerouteInput {
  authorityType?: AuthorityType;
  department?: string;
  overrideReason: string;
}
