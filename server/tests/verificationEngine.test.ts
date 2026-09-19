import { describe, it, expect } from 'vitest';
import {
  validateDescription,
  validateObservedDate,
  tokenizeAndNormalize,
  calculateJaccardSimilarity,
  calculateNgramOverlap,
  checkCategoryKeywordAlignment,
  verifyComplaint,
} from '../src/services/verificationEngine.js';
import type { ComplaintInput, ExistingComplaint } from '../src/types/verification.js';

describe('Civic Trust Verification Engine Foundation (Step 4.2)', () => {
  // 1. Description Length Validation
  describe('validateDescription', () => {
    it('accepts valid descriptions between 10 and 1000 characters', () => {
      const result = validateDescription('Pothole on Kuvempunagar 5th Main Road near bakery.');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects empty or missing description', () => {
      const result = validateDescription('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('rejects descriptions shorter than 10 characters', () => {
      const result = validateDescription('Pothole');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too short');
    });

    it('rejects descriptions longer than 1000 characters', () => {
      const longText = 'A'.repeat(1001);
      const result = validateDescription(longText);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum');
    });

    it('rejects repetitive spam text in description', () => {
      const spamText = 'Road is damaged aaaaaaaaaaaa very badly';
      const result = validateDescription(spamText);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Repetitive character sequence detected');
    });

    it('rejects keyboard smash text in description', () => {
      const smashText = 'Pothole at asdfghjkl cross road';
      const result = validateDescription(smashText);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('keyboard smash');
    });
  });

  // 2. Observed Date Validation
  describe('validateObservedDate', () => {
    const fixedToday = new Date('2026-09-18T10:00:00Z');

    it('accepts valid date matching today or recent past', () => {
      const result = validateObservedDate('2026-09-18', fixedToday);
      expect(result.valid).toBe(true);
    });

    it('accepts past date within 365 days', () => {
      const result = validateObservedDate('2026-06-01', fixedToday);
      expect(result.valid).toBe(true);
    });

    it('rejects future observed dates', () => {
      const result = validateObservedDate('2026-09-25', fixedToday);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cannot be in the future');
    });

    it('rejects observed dates older than 365 days', () => {
      const result = validateObservedDate('2025-01-01', fixedToday);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too old');
    });

    it('rejects invalid format dates', () => {
      const result = validateObservedDate('18-09-2026', fixedToday);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('YYYY-MM-DD');
    });
  });

  // 3. Tokenization and Normalization
  describe('tokenizeAndNormalize', () => {
    it('lowercases, removes punctuation, and filters common stop words', () => {
      const tokens = tokenizeAndNormalize('The large pothole is near the junction, causing hazard!');
      expect(tokens).toEqual(['large', 'pothole', 'junction', 'causing', 'hazard']);
      expect(tokens).not.toContain('the');
      expect(tokens).not.toContain('is');
      expect(tokens).not.toContain('near');
    });
  });

  // 4. Jaccard Similarity Computation
  describe('calculateJaccardSimilarity', () => {
    it('returns 1.0 for identical token sets', () => {
      const tokens = ['deep', 'pothole', 'kuvempunagar', 'road'];
      const similarity = calculateJaccardSimilarity(tokens, tokens);
      expect(similarity).toBe(1.0);
    });

    it('returns 0.0 for completely disjoint token sets', () => {
      const tokensA = ['pothole', 'crater', 'asphalt'];
      const tokensB = ['streetlight', 'darkness', 'lamp'];
      const similarity = calculateJaccardSimilarity(tokensA, tokensB);
      expect(similarity).toBe(0.0);
    });

    it('calculates accurate partial overlap', () => {
      // Intersection: [pothole, road] (2)
      // Union: [deep, pothole, kuvempunagar, road, hazard, junction] (6)
      // Jaccard: 2 / 6 = 0.33
      const tokensA = ['deep', 'pothole', 'road', 'kuvempunagar'];
      const tokensB = ['hazard', 'pothole', 'junction', 'road'];
      const similarity = calculateJaccardSimilarity(tokensA, tokensB);
      expect(similarity).toBeCloseTo(0.33, 2);
    });
  });

  // 5. N-gram Phrase Matching
  describe('calculateNgramOverlap', () => {
    it('identifies shared bigrams', () => {
      const tokensA = ['large', 'pothole', 'double', 'road', 'junction'];
      const tokensB = ['severe', 'pothole', 'double', 'road', 'crossing'];
      const overlap = calculateNgramOverlap(tokensA, tokensB, 2);

      expect(overlap.count).toBe(2);
      expect(overlap.matchingPhrases).toContain('pothole double');
      expect(overlap.matchingPhrases).toContain('double road');
    });
  });

  // 6. Category Keyword Alignment
  describe('checkCategoryKeywordAlignment', () => {
    it('confirms alignment when description matches selected category', () => {
      const result = checkCategoryKeywordAlignment(
        'pothole',
        'Large road crater and damaged asphalt near court circle.'
      );
      expect(result.aligned).toBe(true);
      expect(result.detectedKeywords).toContain('crater');
      expect(result.detectedKeywords).toContain('road');
      expect(result.detectedKeywords).toContain('asphalt');
    });

    it('flags potential misalignment when text discusses another category', () => {
      // User selected garbage_dumping, but text discusses broken streetlight with no garbage keywords
      const result = checkCategoryKeywordAlignment(
        'garbage_dumping',
        'Streetlight pole is broken and bulb is dark at night.'
      );
      expect(result.aligned).toBe(false);
      expect(result.competingCategoryKeywords?.category).toBe('broken_streetlight');
    });
  });

  // 7. Full verifyComplaint Flow & Outcome Synthesis
  describe('verifyComplaint integration', () => {
    const existingPool: ExistingComplaint[] = [
      {
        id: 'MCC-2026-0010',
        category: 'pothole',
        description: 'Dangerous large pothole on Kuvempunagar 5th Main Road near bakery.',
        observedDate: '2026-09-17',
        locationArea: 'Kuvempunagar',
        status: 'SUBMITTED',
      },
      {
        id: 'MCC-2026-0011',
        category: 'garbage_dumping',
        description: 'Illegal waste and plastic dumping on vacant plot in Gokulam 3rd Stage.',
        observedDate: '2026-09-16',
        locationArea: 'Gokulam',
        status: 'ASSIGNED',
      },
    ];

    it('detects POSSIBLE_DUPLICATE when report closely matches existing complaint', () => {
      const duplicateInput: ComplaintInput = {
        category: 'pothole',
        description: 'Dangerous large pothole on Kuvempunagar 5th Main Road near bakery causing hazards.',
        observedDate: '2026-09-18',
        locationArea: 'Kuvempunagar',
      };

      const result = verifyComplaint(duplicateInput, existingPool);
      expect(result.outcome).toBe('POSSIBLE_DUPLICATE');
      expect(result.duplicateRisk).toBe('HIGH');
      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.matches[0].existingComplaintId).toBe('MCC-2026-0010');
      expect(result.recommendedAction).toContain('MCC-2026-0010');
    });

    it('recommends RECOMMENDED_VERIFIED for distinct, valid complaint', () => {
      const distinctInput: ComplaintInput = {
        category: 'pothole',
        description: 'Deep road crater in Vijayanagar 2nd Stage near water tank damaging vehicles.',
        observedDate: '2026-09-18',
        locationArea: 'Vijayanagar',
      };

      const result = verifyComplaint(distinctInput, existingPool);
      expect(result.outcome).toBe('RECOMMENDED_VERIFIED');
      expect(result.duplicateRisk).toBe('LOW');
      expect(result.signals.length).toBeGreaterThan(0);
    });

    it('returns INCONSISTENT_EVIDENCE when category conflicts with description keywords', () => {
      const inconsistentInput: ComplaintInput = {
        category: 'garbage_dumping',
        description: 'Streetlight bulb is completely dark and wiring pole is broken.',
        observedDate: '2026-09-18',
      };

      const result = verifyComplaint(inconsistentInput, existingPool);
      expect(result.outcome).toBe('INCONSISTENT_EVIDENCE');
      expect(result.recommendedAction).toContain('reclassified');
    });

    it('returns INCOMPLETE_EVIDENCE on deterministic validation failure', () => {
      const invalidInput: ComplaintInput = {
        category: 'pothole',
        description: 'Short', // < 10 chars
        observedDate: '2026-09-18',
      };

      const result = verifyComplaint(invalidInput, existingPool);
      expect(result.outcome).toBe('INCOMPLETE_EVIDENCE');
      expect(result.validationErrors?.length).toBeGreaterThan(0);
    });

    it('strictly includes uncertainties and limitations in all outputs', () => {
      const input: ComplaintInput = {
        category: 'pothole',
        description: 'Legitimate distinct road depression in Saraswathipuram 1st Main.',
        observedDate: '2026-09-18',
        hasImage: true,
      };

      const result = verifyComplaint(input, existingPool);
      expect(result.uncertainties.length).toBeGreaterThan(0);
      expect(result.limitations.length).toBeGreaterThan(0);
      expect(result.uncertainties.some((u) => u.includes('submitted visual evidence only'))).toBe(true);
    });

    it('populates spamAnalysis metrics on successful verification', () => {
      const input: ComplaintInput = {
        category: 'pothole',
        description: 'Legitimate distinct road depression in Saraswathipuram 1st Main.',
        observedDate: '2026-09-18',
      };

      const result = verifyComplaint(input, existingPool);
      expect(result.spamAnalysis).toBeDefined();
      expect(result.spamAnalysis?.riskLevel).toBe('CLEAN');
      expect(result.spamAnalysis?.isSpam).toBe(false);
      expect(result.spamAnalysis?.metrics.shannonEntropy).toBeGreaterThanOrEqual(2.5);
    });

    it('escalates to REQUIRES_HUMAN_REVIEW when text is suspicious (e.g. repeated emphasis)', () => {
      const input: ComplaintInput = {
        category: 'pothole',
        description: 'pothole pothole pothole near the water tank on 3rd cross road',
        observedDate: '2026-09-18',
      };

      const result = verifyComplaint(input, existingPool);
      expect(result.outcome).toBe('REQUIRES_HUMAN_REVIEW');
      expect(result.spamAnalysis?.riskLevel).toBe('SUSPICIOUS');
      expect(result.recommendedAction).toContain('Officer review recommended');
      expect(result.uncertainties.some((u) => u.includes('repetitive or non-standard'))).toBe(true);
    });

    it('escalates to REQUIRES_HUMAN_REVIEW when temporal evidence is FUTURE_DATED', () => {
      const input: ComplaintInput = {
        category: 'pothole',
        description: 'Legitimate distinct road depression in Saraswathipuram 1st Main.',
        observedDate: '2026-09-18',
        temporalEvidence: {
          hasTimestamp: true,
          submissionDate: '2026-09-18T12:00:00Z',
          observedDate: '2026-09-18',
          status: 'FUTURE_DATED',
          reviewRequired: true,
          signals: ['TEMPORAL_FUTURE_TIMESTAMP: Evidence capture timestamp is in the future.'],
          uncertainties: ['Device clock might be unsynchronized.'],
          limitations: ['Timezone evaluated in IST.'],
        },
      };

      const result = verifyComplaint(input, existingPool);
      expect(result.outcome).toBe('REQUIRES_HUMAN_REVIEW');
      expect(result.recommendedAction).toContain('future-dated');
      expect(result.temporalEvidence?.status).toBe('FUTURE_DATED');
    });

    it('escalates to REQUIRES_HUMAN_REVIEW when temporal evidence indicates EXCESSIVE_AGE', () => {
      const input: ComplaintInput = {
        category: 'pothole',
        description: 'Legitimate distinct road depression in Saraswathipuram 1st Main.',
        observedDate: '2026-09-18',
        temporalEvidence: {
          hasTimestamp: true,
          submissionDate: '2026-09-18T12:00:00Z',
          observedDate: '2026-09-18',
          status: 'EXCESSIVE_AGE',
          reviewRequired: true,
          signals: ['TEMPORAL_EXCESSIVE_AGE: Evidence photo captured 200 days prior.'],
          uncertainties: [],
          limitations: [],
        },
      };

      const result = verifyComplaint(input, existingPool);
      expect(result.outcome).toBe('REQUIRES_HUMAN_REVIEW');
      expect(result.recommendedAction).toContain('over 180 days prior');
    });

    it('preserves signal transparency and prioritizes image reuse in recommendedAction when image-reuse and temporal issues coexist', () => {
      const existingWithImage: ExistingComplaint[] = [
        {
          id: 'MCC-2026-0044',
          category: 'pothole',
          description: 'Water logging near railway underpass causing vehicular stoppage.',
          observedDate: '2026-09-10',
          locationArea: 'Mandi Mohalla',
          status: 'SUBMITTED',
          imageSha256: 'abc123def456exactimagesha256',
        },
      ];

      const input: ComplaintInput = {
        category: 'pothole',
        description: 'Deep road cavity and asphalt breakdown in Saraswathipuram 1st Main Road.',
        observedDate: '2026-09-18',
        hasImage: true,
        imageSha256: 'abc123def456exactimagesha256',
        temporalEvidence: {
          hasTimestamp: true,
          submissionDate: '2026-09-18T12:00:00Z',
          observedDate: '2026-09-18',
          status: 'FUTURE_DATED',
          reviewRequired: true,
          signals: ['TEMPORAL_FUTURE_TIMESTAMP: Evidence capture timestamp is in the future.'],
          uncertainties: ['Device clock might be unsynchronized.'],
          limitations: ['Timezone evaluated in IST.'],
        },
      };

      const result = verifyComplaint(input, existingWithImage);

      // Outcome escalates to REQUIRES_HUMAN_REVIEW
      expect(result.outcome).toBe('REQUIRES_HUMAN_REVIEW');

      // Recommended action prioritizes the image reuse signal for field dispatch safety
      expect(result.recommendedAction).toContain('Image reuse signal detected');
      expect(result.recommendedAction).toContain('MCC-2026-0044');

      // Full transparency: BOTH image reuse signal and temporal signal are preserved in signals
      expect(result.signals.some((s) => s.includes('EXACT_IMAGE_REUSE'))).toBe(true);
      expect(result.signals.some((s) => s.includes('TEMPORAL_FUTURE_TIMESTAMP'))).toBe(true);

      // Temporal evidence object and status remain fully accessible for municipal officer review
      expect(result.temporalEvidence?.status).toBe('FUTURE_DATED');
      expect(result.temporalEvidence?.reviewRequired).toBe(true);
    });
  });
});
