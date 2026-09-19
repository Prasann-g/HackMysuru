import type {
  IssueCategory,
  VerificationResult,
  ComplaintInput,
  ExistingComplaint,
  DuplicateMatch,
  ImageComparisonSignal,
} from '../types/verification.js';
import { calculateHammingDistance, DHASH_THRESHOLDS } from '../utils/imageHash.js';
import { detectSpamAndAnomalies } from '../utils/spamDetector.js';

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

  // Deterministic spam and anomaly check
  const spamCheck = detectSpamAndAnomalies(trimmed);
  if (spamCheck.isSpam) {
    return {
      valid: false,
      error: `Description appears invalid or automated: ${spamCheck.reasons.join(' ')}`,
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
  const spamCheck = detectSpamAndAnomalies(input.description);
  const descCheck = validateDescription(input.description);
  if (!descCheck.valid && descCheck.error) {
    validationErrors.push(descCheck.error);
  } else {
    signals.push(`Description length verified (${input.description.trim().length} characters).`);
    if (spamCheck.riskLevel === 'SUSPICIOUS') {
      signals.push(...spamCheck.signals);
      uncertainties.push(
        'Description exhibits repetitive or non-standard linguistic patterns; field officer review advised.'
      );
    } else {
      signals.push(...spamCheck.signals);
    }
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

  // 1. Text Duplicate Matching against Candidate Pool
  const matchesMap = new Map<string, DuplicateMatch>();
  let highestSimilarity = 0;

  for (const existing of existingComplaints) {
    // Self-match prevention: Never match a complaint against itself
    if (input.id && existing.id === input.id) continue;

    const existingTokens = tokenizeAndNormalize(existing.description);
    const jaccard = calculateJaccardSimilarity(tokens, existingTokens);
    const bigramOverlap = calculateNgramOverlap(tokens, existingTokens, 2);

    if (jaccard > highestSimilarity) {
      highestSimilarity = jaccard;
    }

    // Capture matches with notable text similarity (>= 0.35)
    if (jaccard >= 0.35 || bigramOverlap.count >= 2) {
      let risk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
      if (jaccard >= 0.70 || (jaccard >= 0.55 && bigramOverlap.count >= 3)) {
        risk = 'HIGH';
      } else if (jaccard >= 0.40 || bigramOverlap.count >= 2) {
        risk = 'MEDIUM';
      }

      matchesMap.set(existing.id, {
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

  // 2. Image Evidence Comparison & Duplication Detection (Explainable Signals)
  let imageComparisonSignal: ImageComparisonSignal = 'IMAGE_COMPARISON_UNAVAILABLE';
  const hasInputImage = Boolean(input.hasImage && (input.imageSha256 || input.imagePhash));

  if (!hasInputImage) {
    imageComparisonSignal = 'IMAGE_COMPARISON_UNAVAILABLE';
    signals.push('IMAGE_COMPARISON_UNAVAILABLE: No photographic evidence attached with this complaint.');
  } else {
    // Check if any reference candidate has image hashes
    const candidatesWithImages = existingComplaints.filter(
      (c) => (!input.id || c.id !== input.id) && (c.imageSha256 || c.imagePhash)
    );

    if (candidatesWithImages.length === 0) {
      imageComparisonSignal = 'IMAGE_COMPARISON_UNAVAILABLE';
      signals.push(
        'IMAGE_COMPARISON_UNAVAILABLE: No reference candidate images available in current database for comparison.'
      );
    } else {
      let exactMatchesFound = 0;
      let perceptualMatchesFound = 0;

      // Phase 2A: Check Exact SHA-256 Checksum Equality (EXACT_IMAGE_REUSE)
      if (input.imageSha256) {
        for (const candidate of candidatesWithImages) {
          if (candidate.imageSha256 && candidate.imageSha256 === input.imageSha256) {
            exactMatchesFound++;
            imageComparisonSignal = 'EXACT_IMAGE_REUSE';

            // Independent perceptual distance calculation if both pHashes are present
            const calculatedDist =
              input.imagePhash && candidate.imagePhash
                ? calculateHammingDistance(input.imagePhash, candidate.imagePhash)
                : null;

            signals.push(
              `EXACT_IMAGE_REUSE: Attached image checksum matches complaint #${candidate.id} (SHA-256: ${input.imageSha256.slice(0, 10)}...). Identical image file reuse across submissions.`
            );

            // Populate or attach to match entry
            const existingMatch = matchesMap.get(candidate.id);
            if (existingMatch) {
              existingMatch.imageMatch = {
                matchType: 'EXACT_IMAGE_REUSE',
                sha256Matched: true,
                hammingDistance: calculatedDist !== null ? calculatedDist : undefined,
                explanation: `Identical cryptographic image hash (SHA-256) matches complaint #${candidate.id}. Separate submissions share exact same image file.`,
              };
            } else {
              matchesMap.set(candidate.id, {
                existingComplaintId: candidate.id,
                category: candidate.category,
                jaccardSimilarity: 0,
                ngramOverlapCount: 0,
                matchingPhrases: [],
                sharedTokens: [],
                riskLevel: 'LOW', // Independent: does not elevate text risk level
                imageMatch: {
                  matchType: 'EXACT_IMAGE_REUSE',
                  sha256Matched: true,
                  hammingDistance: calculatedDist !== null ? calculatedDist : undefined,
                  explanation: `Identical cryptographic image hash (SHA-256) matches complaint #${candidate.id}. Separate submissions share exact same image file.`,
                },
              });
            }
          }
        }
      }

      // Phase 2B: Check Perceptual dHash Similarity (LIKELY_VISUAL_SIMILARITY)
      // Only runs if SHA-256 did not match that specific candidate
      if (input.imagePhash) {
        for (const candidate of candidatesWithImages) {
          // Skip if already matched via exact SHA-256
          if (candidate.imageSha256 && input.imageSha256 && candidate.imageSha256 === input.imageSha256) {
            continue;
          }

          if (candidate.imagePhash) {
            const dist = calculateHammingDistance(input.imagePhash, candidate.imagePhash);
            if (dist !== null && dist <= DHASH_THRESHOLDS.MODERATE_SIMILARITY_MAX_DISTANCE) {
              perceptualMatchesFound++;
              if (imageComparisonSignal !== 'EXACT_IMAGE_REUSE') {
                imageComparisonSignal = 'LIKELY_VISUAL_SIMILARITY';
              }

              signals.push(
                `LIKELY_VISUAL_SIMILARITY: Perceptual difference hash shows close visual gradient resemblance (Hamming distance ${dist}/64) with complaint #${candidate.id}. Possible resized or recompressed image.`
              );

              const existingMatch = matchesMap.get(candidate.id);
              if (existingMatch) {
                existingMatch.imageMatch = {
                  matchType: 'LIKELY_VISUAL_SIMILARITY',
                  sha256Matched: false,
                  hammingDistance: dist,
                  explanation: `Perceptual difference hash (dHash) distance ${dist}/64 indicates high visual resemblance to complaint #${candidate.id}.`,
                };
              } else {
                matchesMap.set(candidate.id, {
                  existingComplaintId: candidate.id,
                  category: candidate.category,
                  jaccardSimilarity: 0,
                  ngramOverlapCount: 0,
                  matchingPhrases: [],
                  sharedTokens: [],
                  riskLevel: 'LOW',
                  imageMatch: {
                    matchType: 'LIKELY_VISUAL_SIMILARITY',
                    sha256Matched: false,
                    hammingDistance: dist,
                    explanation: `Perceptual difference hash (dHash) distance ${dist}/64 indicates high visual resemblance to complaint #${candidate.id}.`,
                  },
                });
              }
            }
          }
        }
      }

      // If candidates with images exist, but zero exact or perceptual matches were found
      if (exactMatchesFound === 0 && perceptualMatchesFound === 0) {
        imageComparisonSignal = 'NO_IMAGE_MATCH';
        signals.push(
          'NO_IMAGE_MATCH: Submitted image does not match any existing reference images in the candidate pool.'
        );
      }
    }
  }

  // Convert map to array and sort by jaccard similarity descending
  const matches = Array.from(matchesMap.values());
  matches.sort((a, b) => {
    if (b.jaccardSimilarity !== a.jaccardSimilarity) {
      return b.jaccardSimilarity - a.jaccardSimilarity;
    }
    return (b.imageMatch ? 1 : 0) - (a.imageMatch ? 1 : 0);
  });

  // Determine overall duplicate risk (PRESERVES DETERMINISTIC TEXT RISK LOGIC)
  // Per Rule 1: Image similarity does NOT automatically elevate duplicateRisk to HIGH or MEDIUM.
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
    uncertainties.push(
      'Image duplication matching is an explainable decision-support signal; visual similarity does not prove intentional fraud or claim illegitimacy.'
    );
  } else {
    uncertainties.push('No photographic evidence was attached with this complaint.');
  }

  // System Limitations disclosure (Strict compliance with Rule 4 & 8)
  limitations.push('Text similarity computation is based on Jaccard token overlap and bi-gram phrase intersection.');
  limitations.push(
    'Perceptual difference hashing (dHash) measures 64-bit luminance gradient differences across a 9x8 grid. It is an image-processing heuristic, NOT a trained machine-learning model.'
  );
  limitations.push(
    'Image comparison is resilient to standard recompression and scaling, but cannot reliably detect heavy cropping, 90-degree rotations, perspective distortion, or major edits. On-site human verification is required.'
  );
  limitations.push(
    `Comparison candidate pool evaluated against ${existingComplaints.length} existing reference complaints.`
  );

  // 3. Evidence Quality & Forensic Signal Integration
  if (input.evidenceQuality) {
    const eq = input.evidenceQuality;
    signals.push(...eq.signals);
    if (eq.warnings.length > 0) {
      signals.push(...eq.warnings);
    }
    uncertainties.push(...eq.uncertainties);
    limitations.push(...eq.limitations);
  }

  // Synthesize Final Outcome & Recommended Next Action
  let outcome: VerificationResult['outcome'] = 'RECOMMENDED_VERIFIED';
  let recommendedAction = 'Proceed with ward engineer review and department assignment.';

  if (overallDuplicateRisk === 'HIGH') {
    outcome = 'POSSIBLE_DUPLICATE';
    recommendedAction = `Compare with existing ticket ${matches[0].existingComplaintId}. If confirmed identical, merge with the existing open record.`;
  } else if (!alignment.aligned) {
    outcome = 'INCONSISTENT_EVIDENCE';
    recommendedAction = `Ward officer review recommended: verify if complaint should be reclassified from '${input.category}' to '${alignment.competingCategoryKeywords?.category}'.`;
  } else if (input.evidenceQuality && !input.evidenceQuality.isValidImage) {
    outcome = 'INCONSISTENT_EVIDENCE';
    recommendedAction = 'Officer review recommended: attached photographic evidence is corrupted or possesses an invalid binary signature.';
  } else if (overallDuplicateRisk === 'MEDIUM') {
    outcome = 'REQUIRES_HUMAN_REVIEW';
    recommendedAction = `Review similarities with ${matches[0].existingComplaintId} before dispatching field team.`;
  } else if (imageComparisonSignal === 'EXACT_IMAGE_REUSE' || imageComparisonSignal === 'LIKELY_VISUAL_SIMILARITY') {
    outcome = 'REQUIRES_HUMAN_REVIEW';
    const matchedImageCandidate = matches.find((m) => m.imageMatch)?.existingComplaintId || 'existing grievance';
    recommendedAction = `Officer visual review recommended: Image reuse signal detected (${imageComparisonSignal.replace(/_/g, ' ')}) matching complaint #${matchedImageCandidate}. Inspect evidence photos before field dispatch.`;
  } else if (input.evidenceQuality && input.evidenceQuality.recommendedReviewLevel === 'MANUAL_REVIEW_RECOMMENDED') {
    outcome = 'REQUIRES_HUMAN_REVIEW';
    recommendedAction = `Officer visual review recommended: uploaded evidence exhibits significant quality degradation or near-blank content (Quality Score: ${input.evidenceQuality.qualityScore}/100). Inspect physical site before dispatching work orders.`;
  } else if (spamCheck.riskLevel === 'SUSPICIOUS') {
    outcome = 'REQUIRES_HUMAN_REVIEW';
    recommendedAction = 'Officer review recommended: evaluate description authenticity due to unusual repetitive phrasing or elevated symbol patterns.';
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
    imageComparisonSignal,
    spamAnalysis: {
      isSpam: spamCheck.isSpam,
      riskLevel: spamCheck.riskLevel,
      reasons: spamCheck.reasons,
      metrics: {
        charCount: spamCheck.metrics.charCount,
        wordCount: spamCheck.metrics.wordCount,
        distinctWordCount: spamCheck.metrics.distinctWordCount,
        shannonEntropy: spamCheck.metrics.shannonEntropy,
        symbolRatio: spamCheck.metrics.symbolRatio,
      },
    },
    evidenceQuality: input.evidenceQuality,
    processedAt: new Date().toISOString(),
  };
}
