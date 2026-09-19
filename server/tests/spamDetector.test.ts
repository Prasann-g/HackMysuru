import { describe, it, expect } from 'vitest';
import {
  detectSpamAndAnomalies,
  calculateShannonEntropy,
  getMaxConsecutiveCharRepeat,
  getMaxConsecutiveWordRepeat,
  getMaxConsonantCluster,
} from '../src/utils/spamDetector.js';

describe('Deterministic Spam & Abuse Gate (Stage 1)', () => {
  describe('calculateShannonEntropy', () => {
    it('returns 0 for empty string', () => {
      expect(calculateShannonEntropy('')).toBe(0);
    });

    it('returns low entropy (< 1.5) for single or two character repetitive strings', () => {
      const entropy = calculateShannonEntropy('aaaaaaaaaaaaaaaa');
      expect(entropy).toBeLessThan(1.0);
    });

    it('returns standard entropy (>= 3.0) for natural English descriptions', () => {
      const text = 'Large deep pothole on Kuvempunagar 5th Main near court junction.';
      const entropy = calculateShannonEntropy(text);
      expect(entropy).toBeGreaterThanOrEqual(3.0);
    });
  });

  describe('getMaxConsecutiveCharRepeat', () => {
    it('detects 5 consecutive repeats', () => {
      const result = getMaxConsecutiveCharRepeat('Road issue aaaaa is here');
      expect(result.char).toBe('a');
      expect(result.maxRepeat).toBe(5);
    });

    it('returns 1 for string with no repeats', () => {
      const result = getMaxConsecutiveCharRepeat('quick brown fox');
      expect(result.maxRepeat).toBe(1);
    });
  });

  describe('getMaxConsecutiveWordRepeat', () => {
    it('detects 4 consecutive words', () => {
      const words = ['pothole', 'pothole', 'pothole', 'pothole', 'near', 'road'];
      const result = getMaxConsecutiveWordRepeat(words);
      expect(result.word).toBe('pothole');
      expect(result.maxRepeat).toBe(4);
    });
  });

  describe('getMaxConsonantCluster', () => {
    it('detects long consonant cluster', () => {
      expect(getMaxConsonantCluster('check bcdfghjkl road')).toBeGreaterThanOrEqual(7);
    });

    it('returns low number for normal words with vowels', () => {
      expect(getMaxConsonantCluster('Mysuru City Corporation')).toBeLessThanOrEqual(3);
    });
  });

  describe('detectSpamAndAnomalies Integration', () => {
    it('passes authentic, well-written citizen grievances as CLEAN', () => {
      const valid = 'Severe road depression and broken asphalt near Saraswathipuram swimming pool.';
      const res = detectSpamAndAnomalies(valid);
      expect(res.isSpam).toBe(false);
      expect(res.riskLevel).toBe('CLEAN');
      expect(res.reasons.length).toBe(0);
      expect(res.signals[0]).toContain('Spam gate passed');
    });

    it('rejects character repetition flood (e.g. 5+ of same character)', () => {
      const spam = 'Road has a big pothole aaaaaaaaaaaa help please';
      const res = detectSpamAndAnomalies(spam);
      expect(res.isSpam).toBe(true);
      expect(res.riskLevel).toBe('FLAGGED_SPAM');
      expect(res.reasons.some((r) => r.includes('Repetitive character'))).toBe(true);
    });

    it('rejects word repetition flooding (4+ of same word)', () => {
      const spam = 'pothole pothole pothole pothole on the street';
      const res = detectSpamAndAnomalies(spam);
      expect(res.isSpam).toBe(true);
      expect(res.riskLevel).toBe('FLAGGED_SPAM');
      expect(res.reasons.some((r) => r.includes('Repetitive word flooding'))).toBe(true);
    });

    it('rejects single-word dominance where all words are identical', () => {
      const spam = 'garbage garbage garbage garbage garbage';
      const res = detectSpamAndAnomalies(spam);
      expect(res.isSpam).toBe(true);
      expect(res.riskLevel).toBe('FLAGGED_SPAM');
      expect(res.reasons.some((r) => r.includes('only 1 unique word'))).toBe(true);
    });

    it('rejects keyboard smash sequences (e.g. asdfghjkl)', () => {
      const smash = 'Pothole near asdfghjkl junction area';
      const res = detectSpamAndAnomalies(smash);
      expect(res.isSpam).toBe(true);
      expect(res.riskLevel).toBe('FLAGGED_SPAM');
      expect(res.reasons.some((r) => r.includes('keyboard smash'))).toBe(true);
    });

    it('rejects extreme symbol flooding (> 60% symbols)', () => {
      const symbols = 'pothole !!!!!!!!!!!???????????#############$$$$$$$$';
      const res = detectSpamAndAnomalies(symbols);
      expect(res.isSpam).toBe(true);
      expect(res.riskLevel).toBe('FLAGGED_SPAM');
      expect(res.reasons.some((r) => r.includes('Excessive non-alphanumeric symbols'))).toBe(true);
    });

    it('flags suspicious text for officer review without rejecting citizen submission', () => {
      // 3 word repeats is suspicious but might be citizen urgency
      const suspicious = 'pothole pothole pothole causing road block';
      const res = detectSpamAndAnomalies(suspicious);
      expect(res.isSpam).toBe(false);
      expect(res.riskLevel).toBe('SUSPICIOUS');
      expect(res.signals.some((s) => s.includes('ANOMALY_SIGNAL'))).toBe(true);
    });

    it('rejects empty or whitespace-only strings', () => {
      const empty = '   ';
      const res = detectSpamAndAnomalies(empty);
      expect(res.isSpam).toBe(true);
      expect(res.riskLevel).toBe('FLAGGED_SPAM');
    });
  });
});
