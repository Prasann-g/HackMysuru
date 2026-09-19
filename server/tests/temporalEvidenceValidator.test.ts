import { describe, it, expect } from 'vitest';
import {
  parseExifDateTime,
  parseObservedDate,
  validateTemporalEvidence,
  TEMPORAL_THRESHOLDS,
} from '../src/utils/temporalEvidenceValidator.js';
import { verifyComplaint } from '../src/services/verificationEngine.js';
import type { ComplaintInput } from '../src/types/verification.js';

describe('Phase 2 - Stage 3: TemporalEvidenceValidator (Timestamp and Temporal Evidence)', () => {
  describe('1. EXIF Date-Time Parsing (parseExifDateTime)', () => {
    it('accurately parses standard EXIF "YYYY:MM:DD HH:MM:SS" format', () => {
      const parsed = parseExifDateTime('2026:03:18 10:15:30');
      expect(parsed).not.toBeNull();
      expect(parsed).toBeInstanceOf(Date);
      expect(parsed!.getFullYear()).toBe(2026);
      expect(parsed!.getMonth()).toBe(2); // 0-indexed March = 2
      expect(parsed!.getDate()).toBe(18);
    });

    it('rejects corrupt zero-dates (e.g. "0000:00:00 00:00:00")', () => {
      expect(parseExifDateTime('0000:00:00 00:00:00')).toBeNull();
      expect(parseExifDateTime('0000-00-00T00:00:00Z')).toBeNull();
    });

    it('rejects impossible calendar dates (e.g. Feb 31, April 31, non-leap Feb 29)', () => {
      // Impossible calendar dates that roll over in lax date parsers
      expect(parseExifDateTime('2026:02:31 10:00:00')).toBeNull(); // February 31
      expect(parseExifDateTime('2026:04:31 10:00:00')).toBeNull(); // April 31 (April has 30 days)
      expect(parseExifDateTime('2026:06:31 10:00:00')).toBeNull(); // June 31 (June has 30 days)
      expect(parseExifDateTime('2026:09:31 10:00:00')).toBeNull(); // September 31 (Sept has 30 days)
      expect(parseExifDateTime('2026:11:31 10:00:00')).toBeNull(); // November 31 (Nov has 30 days)
      expect(parseExifDateTime('2026:02:29 10:00:00')).toBeNull(); // Feb 29 in non-leap year (2026)
    });

    it('accepts valid leap year calendar date (Feb 29 on leap year 2024)', () => {
      const leapParsed = parseExifDateTime('2024:02:29 10:00:00');
      expect(leapParsed).not.toBeNull();
      expect(leapParsed!.getFullYear()).toBe(2024);
      expect(leapParsed!.getMonth()).toBe(1); // February = 1
      expect(leapParsed!.getDate()).toBe(29);
    });

    it('rejects malformed strings or impossible out-of-range fields', () => {
      expect(parseExifDateTime('invalid-date-string')).toBeNull();
      expect(parseExifDateTime('2026:13:01 10:00:00')).toBeNull(); // Month 13
      expect(parseExifDateTime('2026:02:35 10:00:00')).toBeNull(); // Day 35
      expect(parseExifDateTime('2026:05:10 25:00:00')).toBeNull(); // Hour 25
      expect(parseExifDateTime('')).toBeNull();
      expect(parseExifDateTime(undefined)).toBeNull();
    });

    it('supports standard ISO timestamp strings gracefully as fallback', () => {
      const parsed = parseExifDateTime('2026-03-18T10:15:30Z');
      expect(parsed).not.toBeNull();
      expect(parsed!.toISOString()).toBe('2026-03-18T10:15:30.000Z');
    });
  });

  describe('2. Citizen-Reported Observed Date Parsing (parseObservedDate)', () => {
    it('accepts valid YYYY-MM-DD calendar dates', () => {
      const parsed = parseObservedDate('2026-03-18');
      expect(parsed).not.toBeNull();
      expect(parsed).toBeInstanceOf(Date);
      expect(parsed!.getFullYear()).toBe(2026);
      expect(parsed!.getMonth()).toBe(2); // March = 2
      expect(parsed!.getDate()).toBe(18);
    });

    it('accepts valid leap year date (Feb 29 on leap year 2024)', () => {
      const parsed = parseObservedDate('2024-02-29');
      expect(parsed).not.toBeNull();
      expect(parsed!.getFullYear()).toBe(2024);
      expect(parsed!.getMonth()).toBe(1); // February = 1
      expect(parsed!.getDate()).toBe(29);
    });

    it('rejects impossible calendar dates (Feb 31, April 31, non-leap Feb 29)', () => {
      expect(parseObservedDate('2026-02-31')).toBeNull(); // Feb 31 does not exist
      expect(parseObservedDate('2026-04-31')).toBeNull(); // April 31 does not exist
      expect(parseObservedDate('2026-06-31')).toBeNull(); // June 31 does not exist
      expect(parseObservedDate('2026-09-31')).toBeNull(); // Sept 31 does not exist
      expect(parseObservedDate('2026-11-31')).toBeNull(); // Nov 31 does not exist
      expect(parseObservedDate('2026-02-29')).toBeNull(); // 2026 is not a leap year
    });

    it('rejects invalid months and day ranges', () => {
      expect(parseObservedDate('2026-13-01')).toBeNull(); // Month 13
      expect(parseObservedDate('2026-00-15')).toBeNull(); // Month 0
      expect(parseObservedDate('2026-05-00')).toBeNull(); // Day 0
      expect(parseObservedDate('2026-05-32')).toBeNull(); // Day 32
    });

    it('rejects non-conforming date formats (requires strict YYYY-MM-DD)', () => {
      expect(parseObservedDate('18-03-2026')).toBeNull(); // DD-MM-YYYY
      expect(parseObservedDate('2026/03/18')).toBeNull(); // Slashing separator
      expect(parseObservedDate('03/18/2026')).toBeNull(); // US format
      expect(parseObservedDate('2026-3-18')).toBeNull(); // Missing pad
      expect(parseObservedDate('invalid-date')).toBeNull();
      expect(parseObservedDate('')).toBeNull();
      expect(parseObservedDate(undefined)).toBeNull();
    });
  });

  describe('3. Missing or Unavailable Evidence Handling', () => {
    it('returns UNAVAILABLE without review requirement when no image is attached but observedDate is valid', () => {
      const result = validateTemporalEvidence({
        hasImage: false,
        submissionDate: '2026-03-18T12:00:00Z',
        observedDate: '2026-03-18',
      });

      expect(result.status).toBe('UNAVAILABLE');
      expect(result.hasTimestamp).toBe(false);
      expect(result.reviewRequired).toBe(false);
      expect(result.signals.some((s) => s.includes('No photographic evidence'))).toBe(true);
    });

    it('returns INVALID and requires review when observedDate is an impossible calendar date (e.g. 2026-02-31)', () => {
      const result = validateTemporalEvidence({
        hasImage: true,
        rawExifDateTime: '2026:02:20 10:00:00',
        submissionDate: '2026-03-18T12:00:00Z',
        observedDate: '2026-02-31', // Impossible date
      });

      expect(result.status).toBe('INVALID');
      expect(result.reviewRequired).toBe(true);
      expect(result.signals.some((s) => s.includes('TEMPORAL_INVALID_OBSERVED_DATE'))).toBe(true);
      // Ensures it did NOT silently fall back to EXIF capture date
      expect(result.diffDaysWithObservedDate).toBeUndefined();
    });

    it('returns INVALID and requires review when observedDate is malformed even without image', () => {
      const result = validateTemporalEvidence({
        hasImage: false,
        submissionDate: '2026-03-18T12:00:00Z',
        observedDate: 'malformed-date-string',
      });

      expect(result.status).toBe('INVALID');
      expect(result.reviewRequired).toBe(true);
      expect(result.signals.some((s) => s.includes('TEMPORAL_INVALID_OBSERVED_DATE'))).toBe(true);
    });

    it('returns MISSING with non-punitive explanation when EXIF timestamp is absent', () => {
      const result = validateTemporalEvidence({
        hasImage: true,
        rawExifDateTime: undefined,
        submissionDate: '2026-03-18T12:00:00Z',
        observedDate: '2026-03-18',
      });

      expect(result.status).toBe('MISSING');
      expect(result.hasTimestamp).toBe(false);
      expect(result.reviewRequired).toBe(false);
      expect(result.signals.some((s) => s.includes('does not contain an embedded capture timestamp'))).toBe(true);
      expect(result.uncertainties.some((u) => u.includes('messaging apps'))).toBe(true);
    });

    it('returns INVALID when EXIF timestamp is corrupt or malformed', () => {
      const result = validateTemporalEvidence({
        hasImage: true,
        rawExifDateTime: '0000:00:00 00:00:00',
        submissionDate: '2026-03-18T12:00:00Z',
        observedDate: '2026-03-18',
      });

      expect(result.status).toBe('INVALID');
      expect(result.hasTimestamp).toBe(false);
      expect(result.reviewRequired).toBe(true);
      expect(result.signals.some((s) => s.includes('malformed or unparseable'))).toBe(true);
    });
  });

  describe('4. Future Timestamp Detection & Bounded Clock Drift', () => {
    it('flags FUTURE_DATED and requires review when photo is timestamped hours ahead of submission', () => {
      const submissionDate = '2026-03-18T12:00:00+05:30';
      // Photo claims to be taken 2 hours in the future
      const futureExif = '2026:03:18 14:00:00';

      const result = validateTemporalEvidence({
        hasImage: true,
        rawExifDateTime: futureExif,
        submissionDate,
        observedDate: '2026-03-18',
      });

      expect(result.status).toBe('FUTURE_DATED');
      expect(result.reviewRequired).toBe(true);
      expect(result.diffMinutesWithSubmission).toBeGreaterThan(TEMPORAL_THRESHOLDS.CLOCK_SKEW_TOLERANCE_MINUTES);
      expect(result.signals.some((s) => s.includes('TEMPORAL_FUTURE_TIMESTAMP'))).toBe(true);
      // Asserts that timestamps are consistently formatted with UTC
      expect(result.signals.some((s) => s.includes('UTC) is in the future relative to submission time ('))).toBe(true);
      expect(result.signals.some((s) => s.endsWith('UTC). Requires officer verification.'))).toBe(true);
    });

    it('tolerates minor clock drift within the 15-minute tolerance buffer', () => {
      const submissionDate = '2026-03-18T12:00:00+05:30';
      // Photo timestamp is 5 minutes ahead of server clock (minor device clock skew)
      const nearFutureExif = '2026:03:18 12:05:00';

      const result = validateTemporalEvidence({
        hasImage: true,
        rawExifDateTime: nearFutureExif,
        submissionDate,
        observedDate: '2026-03-18',
      });

      expect(result.status).toBe('VALID');
      expect(result.reviewRequired).toBe(false);
    });
  });

  describe('5. Discrepancy vs. Excessive Evidence Age', () => {
    it('returns VALID when photo capture date closely matches observed date and submission timeframe', () => {
      const submissionDate = '2026-03-18T15:30:00+05:30';
      const sameDayExif = '2026:03:18 10:15:00';

      const result = validateTemporalEvidence({
        hasImage: true,
        rawExifDateTime: sameDayExif,
        submissionDate,
        observedDate: '2026-03-18',
      });

      expect(result.status).toBe('VALID');
      expect(result.reviewRequired).toBe(false);
      expect(result.diffDaysWithObservedDate).toBe(0);
      expect(result.signals.some((s) => s.includes('TEMPORAL_CONSISTENCY'))).toBe(true);
    });

    it('detects DISCREPANCY when photo date diverges from citizen-reported observedDate by >30 days', () => {
      const submissionDate = '2026-03-18T12:00:00+05:30';
      // Citizen claimed observation on 2026-03-18, but photo was taken on 2026-01-15 (~62 days earlier)
      const oldCaptureExif = '2026:01:15 11:30:00';

      const result = validateTemporalEvidence({
        hasImage: true,
        rawExifDateTime: oldCaptureExif,
        submissionDate,
        observedDate: '2026-03-18',
      });

      expect(result.status).toBe('DISCREPANCY');
      expect(result.reviewRequired).toBe(true);
      expect(result.diffDaysWithObservedDate).toBeGreaterThan(TEMPORAL_THRESHOLDS.OBSERVED_DATE_DISCREPANCY_DAYS);
      expect(result.signals.some((s) => s.includes('TEMPORAL_DISCREPANCY'))).toBe(true);
      // Strictly tests that there is a space: "by X days" (not "byX days")
      expect(result.signals.some((s) => s.includes(`by ${result.diffDaysWithObservedDate} days`))).toBe(true);
    });

    it('detects EXCESSIVE_AGE when photo is older than 180 days relative to submission', () => {
      const submissionDate = '2026-03-18T12:00:00+05:30';
      // Photo taken 250 days ago (July 2025)
      const veryOldExif = '2025:07:10 14:00:00';

      const result = validateTemporalEvidence({
        hasImage: true,
        rawExifDateTime: veryOldExif,
        submissionDate,
        observedDate: '2025-07-10', // Citizen was honest about date, but evidence is too stale for current civic triage
      });

      expect(result.status).toBe('EXCESSIVE_AGE');
      expect(result.reviewRequired).toBe(true);
      expect(result.evidenceAgeDays).toBeGreaterThan(TEMPORAL_THRESHOLDS.EXCESSIVE_EVIDENCE_AGE_DAYS);
      expect(result.signals.some((s) => s.includes('TEMPORAL_EXCESSIVE_AGE'))).toBe(true);
      expect(result.signals.some((s) => s.includes('TEMPORAL_HISTORICAL_ARCHIVE'))).toBe(false);
    });

    it('emits TEMPORAL_HISTORICAL_ARCHIVE signal when evidence age exceeds 365 days (MAX_HISTORICAL_AGE_DAYS)', () => {
      const submissionDate = '2026-03-18T12:00:00+05:30';
      // Photo taken over a year ago (January 2025, ~435 days)
      const archivalExif = '2025:01:05 10:00:00';

      const result = validateTemporalEvidence({
        hasImage: true,
        rawExifDateTime: archivalExif,
        submissionDate,
        observedDate: '2025-01-05',
      });

      expect(result.status).toBe('EXCESSIVE_AGE');
      expect(result.reviewRequired).toBe(true);
      expect(result.evidenceAgeDays).toBeGreaterThan(TEMPORAL_THRESHOLDS.MAX_HISTORICAL_AGE_DAYS);
      expect(result.signals.some((s) => s.includes('TEMPORAL_HISTORICAL_ARCHIVE'))).toBe(true);
      expect(result.signals.some((s) => s.includes('TEMPORAL_EXCESSIVE_AGE'))).toBe(true);
    });
  });

  describe('6. Verification Engine Integration with Temporal Signals', () => {
    const baseInput: ComplaintInput = {
      category: 'pothole',
      description: 'Severe deep pothole on main road causing two-wheeler accidents and vehicle damage.',
      observedDate: '2026-03-18',
      locationArea: 'Kuvempunagar',
      latitude: 12.2855,
      longitude: 76.635,
      hasImage: true,
    };

    it('escalates verification outcome to REQUIRES_HUMAN_REVIEW when temporal evidence is FUTURE_DATED', () => {
      const temporalEvidence = validateTemporalEvidence({
        hasImage: true,
        rawExifDateTime: '2026:03:19 14:00:00', // Tomorrow
        submissionDate: '2026-03-18T12:00:00+05:30',
        observedDate: '2026-03-18',
      });

      const verification = verifyComplaint(
        {
          ...baseInput,
          temporalEvidence,
        },
        []
      );

      expect(verification.outcome).toBe('REQUIRES_HUMAN_REVIEW');
      expect(verification.recommendedAction).toContain('future-dated');
      expect(verification.signals.some((s) => s.includes('TEMPORAL_FUTURE_TIMESTAMP'))).toBe(true);
      expect(verification.temporalEvidence?.status).toBe('FUTURE_DATED');
    });

    it('escalates verification outcome to REQUIRES_HUMAN_REVIEW when temporal evidence has DISCREPANCY', () => {
      const temporalEvidence = validateTemporalEvidence({
        hasImage: true,
        rawExifDateTime: '2026:01:10 10:00:00', // 67 days before reported observation
        submissionDate: '2026-03-18T12:00:00+05:30',
        observedDate: '2026-03-18',
      });

      const verification = verifyComplaint(
        {
          ...baseInput,
          temporalEvidence,
        },
        []
      );

      expect(verification.outcome).toBe('REQUIRES_HUMAN_REVIEW');
      expect(verification.recommendedAction).toContain('diverges by >30 days');
      expect(verification.signals.some((s) => s.includes('TEMPORAL_DISCREPANCY'))).toBe(true);
    });

    it('escalates verification outcome to REQUIRES_HUMAN_REVIEW with specific action when observedDate is invalid', () => {
      const temporalEvidence = validateTemporalEvidence({
        hasImage: true,
        rawExifDateTime: '2026:03:18 10:00:00',
        submissionDate: '2026-03-18T12:00:00+05:30',
        observedDate: '2026-02-31', // Impossible date
      });

      const verification = verifyComplaint(
        {
          ...baseInput,
          temporalEvidence,
        },
        []
      );

      expect(verification.outcome).toBe('REQUIRES_HUMAN_REVIEW');
      expect(verification.recommendedAction).toContain('malformed or an invalid calendar date');
      expect(verification.signals.some((s) => s.includes('TEMPORAL_INVALID_OBSERVED_DATE'))).toBe(true);
      expect(verification.temporalEvidence?.status).toBe('INVALID');
    });

    it('maintains RECOMMENDED_VERIFIED when temporal evidence is VALID and all other signals are clean', () => {
      const temporalEvidence = validateTemporalEvidence({
        hasImage: true,
        rawExifDateTime: '2026:03:18 10:00:00',
        submissionDate: '2026-03-18T12:00:00+05:30',
        observedDate: '2026-03-18',
      });

      const verification = verifyComplaint(
        {
          ...baseInput,
          temporalEvidence,
        },
        []
      );

      expect(verification.outcome).toBe('RECOMMENDED_VERIFIED');
      expect(verification.signals.some((s) => s.includes('TEMPORAL_CONSISTENCY'))).toBe(true);
    });
  });
});
