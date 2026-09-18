export type IssueCategory =
  | 'garbage_dumping'
  | 'overflowing_bin'
  | 'pothole'
  | 'broken_streetlight'
  | 'unsegregated_waste'
  | 'construction_debris'
  | 'other';

export type VerificationOutcome =
  | 'RECOMMENDED_VERIFIED'
  | 'POSSIBLE_DUPLICATE'
  | 'INCONSISTENT_EVIDENCE'
  | 'INCOMPLETE_EVIDENCE'
  | 'REQUIRES_HUMAN_REVIEW';

export interface DuplicateMatch {
  existingComplaintId: string;
  category: IssueCategory;
  jaccardSimilarity: number;        // 0.00 to 1.00
  ngramOverlapCount: number;
  matchingPhrases: string[];
  sharedTokens: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface VerificationResult {
  outcome: VerificationOutcome;
  duplicateRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  matches: DuplicateMatch[];
  signals: string[];
  uncertainties: string[];
  limitations: string[];
  recommendedAction: string;
  categoryAlignment: {
    aligned: boolean;
    detectedKeywords: string[];
    competingCategoryKeywords?: { category: IssueCategory; keywords: string[] };
  };
  validationErrors?: string[];
  processedAt: string;
}

export interface ComplaintInput {
  id?: string;
  category: IssueCategory;
  customCategory?: string;
  description: string;
  observedDate: string;
  locationArea?: string;
  addressText?: string;
  hasImage?: boolean;
}

export interface ExistingComplaint {
  id: string;
  category: IssueCategory;
  description: string;
  observedDate: string;
  locationArea?: string;
  status: string;
}
