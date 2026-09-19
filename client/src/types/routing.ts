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
  timestamp: string;
  overrideHistory?: RoutingOverrideAudit[];
}

export interface OfficerReroutePayload {
  authorityType?: AuthorityType;
  department?: string;
  overrideReason: string;
}
