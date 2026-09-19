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

export interface EvidenceQualityAnalysis {
  isValidImage: boolean;
  mimeType?: string;
  format?: string;
  width?: number;
  height?: number;
  fileSizeBytes: number;
  qualityScore: number; // 0-100 explainable score
  sharpness: {
    laplacianVariance: number;
    isBlurry: boolean;
    explanation: string;
  };
  brightness: {
    mean: number; // 0-255 scale
    isSeverelyDark: boolean;
    isSeverelyOverexposed: boolean;
    explanation: string;
  };
  contrast: {
    stdev: number;
    isBlankOrUniform: boolean;
    explanation: string;
  };
  metadata: {
    hasExif: boolean;
    cameraMake?: string;
    cameraModel?: string;
    software?: string;
    dateTimeOriginal?: string;
    hasGpsMetadata: boolean;
    gpsLatitude?: number;
    gpsLongitude?: number;
    gpsDisclaimer: string;
  };
  signals: string[];
  warnings: string[];
  uncertainties: string[];
  limitations: string[];
  recommendedReviewLevel: 'NONE' | 'ADVISORY' | 'MANUAL_REVIEW_RECOMMENDED' | 'REJECT';
}

export type GeoEvidenceStatus =
  | 'VALID'
  | 'MISSING'
  | 'MISMATCH'
  | 'INVALID'
  | 'UNAVAILABLE'
  | 'OUT_OF_BOUNDS';

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

export interface GeoEvidenceResult {
  imageRequired: boolean;
  imagePresent: boolean;
  exifGpsPresent: boolean;
  exifCoordinates?: GeoCoordinates;
  capturedCoordinates?: GeoCoordinates;
  distanceMeters?: number;
  withinServiceArea?: boolean;
  status: GeoEvidenceStatus;
  reviewRequired: boolean;
  signals: string[];
  limitations: string[];
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
  spamAnalysis?: {
    isSpam: boolean;
    riskLevel: 'CLEAN' | 'SUSPICIOUS' | 'FLAGGED_SPAM';
    reasons: string[];
    metrics: {
      charCount: number;
      wordCount: number;
      distinctWordCount: number;
      shannonEntropy: number;
      symbolRatio: number;
    };
  };
  evidenceQuality?: EvidenceQualityAnalysis;
  geoEvidence?: GeoEvidenceResult;
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
  latitude?: number;
  longitude?: number;
  hasImage?: boolean;
  imageSha256?: string;
  imagePhash?: string;
  evidenceQuality?: EvidenceQualityAnalysis;
  geoEvidence?: GeoEvidenceResult;
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
