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

export type ImageComparisonSignal =
  | 'EXACT_IMAGE_REUSE'
  | 'LIKELY_VISUAL_SIMILARITY'
  | 'NO_IMAGE_MATCH'
  | 'IMAGE_COMPARISON_UNAVAILABLE';

export interface ImageMatchDetail {
  matchType: 'EXACT_IMAGE_REUSE' | 'LIKELY_VISUAL_SIMILARITY';
  sha256Matched: boolean;
  hammingDistance?: number;
  explanation: string;
}

export interface DuplicateMatch {
  existingComplaintId: string;
  category: IssueCategory;
  jaccardSimilarity: number;        // 0.00 to 1.00
  ngramOverlapCount: number;
  matchingPhrases: string[];
  sharedTokens: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  imageMatch?: ImageMatchDetail;
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
  imageComparisonSignal?: ImageComparisonSignal;
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
  imageSha256?: string;
  imagePhash?: string;
}

export interface ExistingComplaint {
  id: string;
  category: IssueCategory;
  description: string;
  observedDate: string;
  locationArea?: string;
  status: string;
  imageSha256?: string;
  imagePhash?: string;
}
