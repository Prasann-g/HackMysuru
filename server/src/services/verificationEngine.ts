import type {
  IssueCategory,
  VerificationResult,
  ComplaintInput,
  ExistingComplaint,
  DuplicateMatch,
} from '../types/verification.js';

// Common English stop words to filter during tokenization
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'it', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or',
  'by', 'with', 'from', 'this', 'that', 'there', 'here', 'near', 'as', 'be', 'was',
  'are', 'were', 'been', 'has', 'have', 'had', 'do', 'does', 'did', 'but', 'if',
  'my', 'our', 'your', 'we', 'they', 'them', 'he', 'she', 'its', 'so', 'very',
]);

// Verified civic keywords for MCC complaint categories
const CATEGORY_KEYWORDS: Record<Exclude<IssueCategory, 'other'>, string[]> = {
  pothole: [
    'pothole', 'potholes', 'crater', 'asphalt', 'tar', 'road', 'damage', 'surface',
    'cracked', 'two wheeler', 'skid', 'hazard', 'manhole', 'junction', 'cross',
  ],
  broken_streetlight: [
    'streetlight', 'streetlights', 'street light', 'lamp', 'pole', 'bulb', 'lighting',
    'dark', 'darkness', 'wiring', 'fuse', 'fused', 'blackout', 'tubelight',
  ],
  garbage_dumping: [
    'garbage', 'trash', 'waste', 'dump', 'dumping', 'rubbish', 'litter', 'plastic',
    'rotting', 'foul', 'smell', 'odor', 'stray dogs', 'unattended',
  ],
  overflowing_bin: [
    'bin', 'dustbin', 'container', 'overflow', 'overflowing', 'spill', 'spilling',
    'kasa', 'collection', 'full', 'dumper',
  ],
  unsegregated_waste: [
    'segregation', 'unsegregated', 'mixed', 'wet waste', 'dry waste', 'sanitary',
    'sorting', 'unseparated', 'segregated',
  ],
  construction_debris: [
    'debris', 'construction', 'rubble', 'cement', 'bricks', 'sand', 'stones',
    'gravel', 'demolition', 'mortar', 'tiles', 'excavation',
  ],
};

/**
 * 1. Validate description length
 */
export function validateDescription(description?: string): { valid: boolean; error?: string } {
  if (!description || typeof description !== 'string') {
    return { valid: false, error: 'Complaint description is required.' };
  }
  const trimmed = description.trim();
  if (trimmed.length < 10) {
    return {
      valid: false,
      error: `Description is too short (${trimmed.length} chars). Minimum 10 characters required.`,
    };
  }
  if (trimmed.length > 1000) {
    return {
      valid: false,
      error: `Description exceeds maximum allowed limit of 1000 characters (${trimmed.length} chars).`,
    };
  }
  return { valid: true };
}

/**
 * 2. Validate observed date
 */
export function validateObservedDate(
  dateStr?: string,
  referenceDate: Date = new Date()
): { valid: boolean; error?: string } {
  if (!dateStr || typeof dateStr !== 'string') {
    return { valid: false, error: 'Observed date is required.' };
  }

  // Regex check for YYYY-MM-DD
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) {
    return { valid: false, error: 'Observed date must be in YYYY-MM-DD format.' };
  }

  const parsedDate = new Date(`${dateStr}T00:00:00Z`);
  if (isNaN(parsedDate.getTime())) {
    return { valid: false, error: 'Observed date is invalid.' };
  }

  // Reference date normalized to UTC midnight
  const refIso = referenceDate.toISOString().split('T')[0];
  const todayUtc = new Date(`${refIso}T00:00:00Z`);

  if (parsedDate > todayUtc) {
    return { valid: false, error: 'Observed date cannot be in the future.' };
  }

  // Check not older than 365 days
  const diffDays = (todayUtc.getTime() - parsedDate.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays > 365) {
    return { valid: false, error: 'Observed date is too old (greater than 365 days).' };
  }

  return { valid: true };
}

/**
 * 4. Transparent text tokenization
 */
export function tokenizeAndNormalize(text: string): string[] {
  if (!text) return [];

  // Replace punctuation and special characters with spaces, lowercase
  const cleaned = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');

  // Split on whitespace
  const rawTokens = cleaned.split(/\s+/).filter((t) => t.length > 1);

  // Filter out stop words
  return rawTokens.filter((token) => !STOP_WORDS.has(token));
}

/**
 * 5. Jaccard similarity for set overlap
 */
export function calculateJaccardSimilarity(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  let intersectionCount = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      intersectionCount++;
    }
  }

  const unionSize = new Set([...tokensA, ...tokensB]).size;
  if (unionSize === 0) return 0;

  const similarity = intersectionCount / unionSize;
  return Math.round(similarity * 100) / 100;
}

/**
 * 6. Basic n-gram phrase matching (e.g. bigrams)
 */
export function extractNgrams(tokens: string[], n = 2): string[] {
  if (tokens.length < n) return [];
  const ngrams: string[] = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    ngrams.push(tokens.slice(i, i + n).join(' '));
  }
  return ngrams;
}

export function calculateNgramOverlap(
  tokensA: string[],
  tokensB: string[],
  n = 2
): { count: number; matchingPhrases: string[] } {
  const ngramsA = extractNgrams(tokensA, n);
  const ngramsB = new Set(extractNgrams(tokensB, n));

  const matchingPhrases: string[] = [];
  for (const phrase of ngramsA) {
    if (ngramsB.has(phrase) && !matchingPhrases.includes(phrase)) {
      matchingPhrases.push(phrase);
    }
  }

  return {
    count: matchingPhrases.length,
    matchingPhrases,
  };
}

/**
 * 3. Basic category-description keyword alignment
 */
export function checkCategoryKeywordAlignment(
  category: IssueCategory,
  description: string
): {
  aligned: boolean;
  detectedKeywords: string[];
  competingCategoryKeywords?: { category: IssueCategory; keywords: string[] };
} {
  const lowerDesc = description.toLowerCase();

  if (category === 'other') {
    return { aligned: true, detectedKeywords: [] };
  }

  const targetKeywords = CATEGORY_KEYWORDS[category] || [];
  const detectedTarget = targetKeywords.filter((kw) => lowerDesc.includes(kw));

  // Check competing categories
  let strongestCompetitor: { category: IssueCategory; count: number; keywords: string[] } | null = null;

  for (const [otherCat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
    if (otherCat === category) continue;
    const matched = kws.filter((kw) => lowerDesc.includes(kw));
    if (matched.length > 0) {
      if (!strongestCompetitor || matched.length > strongestCompetitor.count) {
        strongestCompetitor = {
          category: otherCat as IssueCategory,
          count: matched.length,
          keywords: matched,
        };
      }
    }
  }

  // Misalignment if no target keywords are found, but a different category has 2+ strong keywords
  if (detectedTarget.length === 0 && strongestCompetitor && strongestCompetitor.count >= 2) {
    return {
      aligned: false,
      detectedKeywords: [],
      competingCategoryKeywords: {
        category: strongestCompetitor.category,
        keywords: strongestCompetitor.keywords,
      },
    };
  }

  return {
    aligned: true,
    detectedKeywords: detectedTarget,
  };
}

/**
 * Civic Trust Verification Engine (Main Coordinator)
 * Implements deterministic validation, explainable similarity, evidence signals,
 * uncertainties, limitations, and human-review recommendation.
 */
export function verifyComplaint(
  input: ComplaintInput,
  existingComplaints: ExistingComplaint[] = []
): VerificationResult {
  const signals: string[] = [];
  const uncertainties: string[] = [];
  const limitations: string[] = [];
  const validationErrors: string[] = [];

  // Deterministic checks
  const descCheck = validateDescription(input.description);
  if (!descCheck.valid && descCheck.error) {
    validationErrors.push(descCheck.error);
  } else {
    signals.push(`Description length verified (${input.description.trim().length} characters).`);
  }

  const dateCheck = validateObservedDate(input.observedDate);
  if (!dateCheck.valid && dateCheck.error) {
    validationErrors.push(dateCheck.error);
  } else {
    signals.push(`Observed date verified within valid historical window (${input.observedDate}).`);
  }

  // If deterministic validation fails, return INCOMPLETE_EVIDENCE immediately
  if (validationErrors.length > 0) {
    return {
      outcome: 'INCOMPLETE_EVIDENCE',
      duplicateRisk: 'LOW',
      matches: [],
      signals,
      uncertainties: ['Validation failed; underlying civic claim could not be processed.'],
      limitations: ['Deterministic pre-flight checks failed before similarity analysis.'],
      recommendedAction: 'Citizen must provide complete and valid required fields before submission.',
      categoryAlignment: { aligned: false, detectedKeywords: [] },
      validationErrors,
      processedAt: new Date().toISOString(),
    };
  }

  // Tokenization & Category alignment
  const tokens = tokenizeAndNormalize(input.description);
  signals.push(`Description parsed into ${tokens.length} meaningful tokens.`);

  const alignment = checkCategoryKeywordAlignment(input.category, input.description);
  if (!alignment.aligned && alignment.competingCategoryKeywords) {
    signals.push(
      `Potential category misalignment: description contains keywords for '${alignment.competingCategoryKeywords.category}' (${alignment.competingCategoryKeywords.keywords.join(', ')}) rather than selected category '${input.category}'.`
    );
  } else if (alignment.detectedKeywords.length > 0) {
    signals.push(`Category alignment confirmed: detected keywords [${alignment.detectedKeywords.join(', ')}].`);
  }

  // Duplicate Matching against Candidate Pool
  const matches: DuplicateMatch[] = [];
  let highestSimilarity = 0;

  for (const existing of existingComplaints) {
    const existingTokens = tokenizeAndNormalize(existing.description);
    const jaccard = calculateJaccardSimilarity(tokens, existingTokens);
    const bigramOverlap = calculateNgramOverlap(tokens, existingTokens, 2);

    if (jaccard > highestSimilarity) {
      highestSimilarity = jaccard;
    }

    // Capture matches with notable similarity (>= 0.35)
    if (jaccard >= 0.35 || bigramOverlap.count >= 2) {
      let risk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
      if (jaccard >= 0.70 || (jaccard >= 0.55 && bigramOverlap.count >= 3)) {
        risk = 'HIGH';
      } else if (jaccard >= 0.40 || bigramOverlap.count >= 2) {
        risk = 'MEDIUM';
      }

      matches.push({
        existingComplaintId: existing.id,
        category: existing.category,
        jaccardSimilarity: jaccard,
        ngramOverlapCount: bigramOverlap.count,
        matchingPhrases: bigramOverlap.matchingPhrases,
        sharedTokens: tokens.filter((t) => existingTokens.includes(t)),
        riskLevel: risk,
      });
    }
  }

  // Sort matches by similarity descending
  matches.sort((a, b) => b.jaccardSimilarity - a.jaccardSimilarity);

  // Determine overall duplicate risk
  let overallDuplicateRisk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  if (matches.some((m) => m.riskLevel === 'HIGH')) {
    overallDuplicateRisk = 'HIGH';
    const topMatch = matches[0];
    signals.push(
      `Possible duplicate detected: ${Math.round(topMatch.jaccardSimilarity * 100)}% word overlap with ${topMatch.existingComplaintId}. Shared key phrases: [${topMatch.matchingPhrases.slice(0, 3).join(', ')}].`
    );
  } else if (matches.some((m) => m.riskLevel === 'MEDIUM')) {
    overallDuplicateRisk = 'MEDIUM';
    const topMatch = matches[0];
    signals.push(
      `Moderate text similarity (${Math.round(topMatch.jaccardSimilarity * 100)}%) with ${topMatch.existingComplaintId}. Requires human inspection to determine if issue is identical or adjacent.`
    );
  } else {
    signals.push('No significant text overlap found with open complaints in the candidate pool.');
  }

  // Uncertainty disclosures (Anti-hallucination compliance)
  uncertainties.push('Physical site authenticity cannot be determined by text analysis alone.');
  uncertainties.push('Citizen intention or claim veracity is not evaluated by this automated tool.');
  if (input.hasImage) {
    uncertainties.push(
      'Photo evidence attached by citizen: treated as submitted visual evidence only. Automated stamp OCR and tamper-proof verification are NOT implemented in this foundation.'
    );
  } else {
    uncertainties.push('No photographic evidence was attached with this complaint.');
  }

  // System Limitations disclosure
  limitations.push('Similarity computation is based on Jaccard token overlap and bi-gram phrase intersection.');
  limitations.push(
    `Comparison candidate pool evaluated against ${existingComplaints.length} existing reference complaints.`
  );

  // Synthesize Final Outcome & Recommended Next Action
  let outcome: VerificationResult['outcome'] = 'RECOMMENDED_VERIFIED';
  let recommendedAction = 'Proceed with ward engineer review and department assignment.';

  if (overallDuplicateRisk === 'HIGH') {
    outcome = 'POSSIBLE_DUPLICATE';
    recommendedAction = `Compare with existing ticket ${matches[0].existingComplaintId}. If confirmed identical, merge with the existing open record.`;
  } else if (!alignment.aligned) {
    outcome = 'INCONSISTENT_EVIDENCE';
    recommendedAction = `Ward officer review recommended: verify if complaint should be reclassified from '${input.category}' to '${alignment.competingCategoryKeywords?.category}'.`;
  } else if (overallDuplicateRisk === 'MEDIUM') {
    outcome = 'REQUIRES_HUMAN_REVIEW';
    recommendedAction = `Review similarities with ${matches[0].existingComplaintId} before dispatching field team.`;
  }

  return {
    outcome,
    duplicateRisk: overallDuplicateRisk,
    matches,
    signals,
    uncertainties,
    limitations,
    recommendedAction,
    categoryAlignment: alignment,
    processedAt: new Date().toISOString(),
  };
}
