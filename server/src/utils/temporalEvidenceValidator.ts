import type { TemporalEvidenceResult } from '../types/verification.js';

export const TEMPORAL_THRESHOLDS = {
  // Device clock drift tolerance (covers realistic smartphone or manual camera clock skew)
  CLOCK_SKEW_TOLERANCE_MINUTES: 15,
  // Discrepancy between citizen's claimed observedDate and EXIF capture date
  OBSERVED_DATE_DISCREPANCY_DAYS: 30,
  // Excessive age of evidence relative to submission date
  EXCESSIVE_EVIDENCE_AGE_DAYS: 180,
  // Extreme stale evidence threshold
  MAX_HISTORICAL_AGE_DAYS: 365,
} as const;

/**
 * Safely parses raw EXIF date-time strings into a JavaScript Date object.
 * Standard EXIF format: "YYYY:MM:DD HH:MM:SS"
 * Also supports ISO strings: "YYYY-MM-DDTHH:MM:SS" or "YYYY-MM-DD"
 *
 * NOTE: EXIF specification does not record timezone offset in standard DateTimeOriginal.
 * Within the Mysuru municipal jurisdiction (MCC), wall-clock camera timestamps are evaluated
 * under Indian Standard Time (IST / UTC+05:30) with a 15-minute clock drift buffer.
 */
export function parseExifDateTime(raw?: string): Date | null {
  if (!raw || typeof raw !== 'string') {
    return null;
  }

  const trimmed = raw.trim();
  if (trimmed.length < 10) {
    return null;
  }

  // Reject zero-dates common in corrupt EXIF headers (e.g. "0000:00:00 00:00:00")
  if (/^0000[:\-]00[:\-]00/.test(trimmed)) {
    return null;
  }

  // Standard EXIF format: YYYY:MM:DD HH:MM:SS
  const exifRegex = /^(\d{4}):(\d{2}):(\d{2})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/;
  const match = trimmed.match(exifRegex);

  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    const hour = match[4] ? parseInt(match[4], 10) : 0;
    const minute = match[5] ? parseInt(match[5], 10) : 0;
    const second = match[6] ? parseInt(match[6], 10) : 0;

    // Validate calendar ranges
    if (
      year < 1970 ||
      year > 2100 ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31 ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59 ||
      second < 0 ||
      second > 59
    ) {
      return null;
    }

    // Validate exact days in the specific month/year (reject impossible calendar dates e.g. 2026:02:31, 2026:04:31)
    const maxDaysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    if (day > maxDaysInMonth) {
      return null;
    }

    // Treat as local wall-clock time (assumed IST / UTC+05:30 for Mysuru municipal civic context)
    const isoString = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}+05:30`;
    const parsed = new Date(isoString);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  // Fallback: Check if it's already an ISO or standard parsable date
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2}))?/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    const maxD = new Date(Date.UTC(y, m, 0)).getUTCDate();
    if (m < 1 || m > 12 || d < 1 || d > maxD) {
      return null;
    }
    const isoParsed = new Date(trimmed);
    if (!isNaN(isoParsed.getTime())) {
      return isoParsed;
    }
  }

  return null;
}

/**
 * Strictly parses and validates a citizen-reported observed date.
 * Enforces YYYY-MM-DD format, calendar ranges, and exact days in month
 * (rejects impossible calendar dates like 2026-02-31, 2026-04-31).
 */
export function parseObservedDate(raw?: string): Date | null {
  if (!raw || typeof raw !== 'string') {
    return null;
  }

  const trimmed = raw.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (year < 1970 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const maxDaysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > maxDaysInMonth) {
    return null;
  }

  // Construct local noon timestamp (IST / UTC+05:30) to avoid midnight edge rollovers
  const parsed = new Date(`${trimmed}T12:00:00+05:30`);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export interface ValidateTemporalEvidenceOptions {
  hasImage: boolean;
  rawExifDateTime?: string;
  submissionDate: string | Date;
  observedDate: string;
}

/**
 * Validates the temporal evidence of a complaint by cross-referencing:
 * 1. Image EXIF capture timestamp (DateTimeOriginal)
 * 2. Citizen-declared observedDate (incident occurrence)
 * 3. Complaint submissionDate (platform intake timestamp)
 *
 * NOTE: Non-authoritative disclosure is strictly enforced. Missing EXIF timestamp
 * is common due to social messaging compression and does NOT indicate dishonesty.
 */
export function validateTemporalEvidence(
  options: ValidateTemporalEvidenceOptions
): TemporalEvidenceResult {
  const {
    hasImage,
    rawExifDateTime,
    submissionDate,
    observedDate,
  } = options;

  const subDateObj = typeof submissionDate === 'string' ? new Date(submissionDate) : submissionDate;
  const validSubDate = !isNaN(subDateObj.getTime()) ? subDateObj : new Date();
  const submissionIso = validSubDate.toISOString();

  const signals: string[] = [];
  const uncertainties: string[] = [
    'EXIF capture timestamp is citizen-submitted metadata and non-authoritative; device clocks can be altered or unsynchronized.',
    'Absence of EXIF timestamps does not indicate fraud as messaging apps, screenshots, and privacy tools routinely strip metadata.',
  ];
  const limitations: string[] = [
    'Wall-clock EXIF timestamps are evaluated under local Indian Standard Time (IST / UTC+05:30) with a 15-minute drift buffer.',
    `Discrepancy threshold is set to ${TEMPORAL_THRESHOLDS.OBSERVED_DATE_DISCREPANCY_DAYS} days; stale age threshold is ${TEMPORAL_THRESHOLDS.EXCESSIVE_EVIDENCE_AGE_DAYS} days; archival threshold is ${TEMPORAL_THRESHOLDS.MAX_HISTORICAL_AGE_DAYS} days.`,
  ];

  // 1. Strict Observed Date Validation (YYYY-MM-DD calendar date)
  const obsDateObj = parseObservedDate(observedDate);
  if (!obsDateObj) {
    signals.push(
      `TEMPORAL_INVALID_OBSERVED_DATE: Citizen-reported incident observed date "${observedDate}" is malformed or an impossible calendar date (required format: YYYY-MM-DD). Requires officer verification.`
    );
    return {
      hasTimestamp: false,
      exifDateTime: rawExifDateTime,
      submissionDate: submissionIso,
      observedDate,
      status: 'INVALID',
      reviewRequired: true,
      signals,
      uncertainties,
      limitations,
    };
  }

  // 2. Missing Image Handling
  if (!hasImage) {
    signals.push('No photographic evidence attached for temporal cross-referencing.');
    return {
      hasTimestamp: false,
      submissionDate: submissionIso,
      observedDate,
      status: 'UNAVAILABLE',
      reviewRequired: false,
      signals,
      uncertainties,
      limitations,
    };
  }

  // 3. Missing EXIF Timestamp Handling
  if (!rawExifDateTime || rawExifDateTime.trim().length === 0) {
    signals.push(
      'Image metadata does not contain an embedded capture timestamp (common for photos shared via messaging apps or screenshot utilities).'
    );
    return {
      hasTimestamp: false,
      submissionDate: submissionIso,
      observedDate,
      status: 'MISSING',
      reviewRequired: false,
      signals,
      uncertainties,
      limitations,
    };
  }

  // 4. Corrupt or Unparseable Timestamp
  const captureDate = parseExifDateTime(rawExifDateTime);
  if (!captureDate) {
    signals.push(
      `Embedded EXIF capture timestamp contains malformed or unparseable date format: "${rawExifDateTime}".`
    );
    return {
      hasTimestamp: false,
      exifDateTime: rawExifDateTime,
      submissionDate: submissionIso,
      observedDate,
      status: 'INVALID',
      reviewRequired: true,
      signals,
      uncertainties,
      limitations,
    };
  }

  const captureIso = captureDate.toISOString();
  const captureDateOnly = captureIso.split('T')[0];

  // Calculate differences
  const diffMinutesWithSubmission = Math.round(
    (captureDate.getTime() - validSubDate.getTime()) / (1000 * 60)
  );

  const evidenceAgeDays = Math.max(
    0,
    Math.floor((validSubDate.getTime() - captureDate.getTime()) / (1000 * 60 * 60 * 24))
  );

  // Calculate day difference between capture date and validated observed date (no silent fallback)
  const captureDateMidnight = new Date(`${captureDateOnly}T00:00:00Z`).getTime();
  const obsDateMidnight = new Date(`${obsDateObj.toISOString().split('T')[0]}T00:00:00Z`).getTime();

  const diffDaysWithObservedDate = Math.round(
    Math.abs(captureDateMidnight - obsDateMidnight) / (1000 * 60 * 60 * 24)
  );

  // 5. Future Timestamp Check
  if (diffMinutesWithSubmission > TEMPORAL_THRESHOLDS.CLOCK_SKEW_TOLERANCE_MINUTES) {
    const captureFormattedUtc = `${captureIso.slice(0, 10)} ${captureIso.slice(11, 19)} UTC`;
    const submissionFormattedUtc = `${submissionIso.slice(0, 10)} ${submissionIso.slice(11, 19)} UTC`;
    signals.push(
      `TEMPORAL_FUTURE_TIMESTAMP: Evidence capture timestamp (${captureFormattedUtc}) is in the future relative to submission time (${submissionFormattedUtc}). Requires officer verification.`
    );
    return {
      hasTimestamp: true,
      exifDateTime: rawExifDateTime,
      parsedCaptureDate: captureIso,
      submissionDate: submissionIso,
      observedDate,
      status: 'FUTURE_DATED',
      diffMinutesWithSubmission,
      diffDaysWithObservedDate,
      evidenceAgeDays,
      reviewRequired: true,
      signals,
      uncertainties,
      limitations,
    };
  }

  // 5. Excessive Age Check (Photo taken > 180 days before submission)
  if (evidenceAgeDays > TEMPORAL_THRESHOLDS.EXCESSIVE_EVIDENCE_AGE_DAYS) {
    if (evidenceAgeDays > TEMPORAL_THRESHOLDS.MAX_HISTORICAL_AGE_DAYS) {
      signals.push(
        `TEMPORAL_HISTORICAL_ARCHIVE: Photographic evidence was captured ${evidenceAgeDays} days ago (exceeds 1-year archival threshold of ${TEMPORAL_THRESHOLDS.MAX_HISTORICAL_AGE_DAYS} days). High likelihood that physical site condition has substantially changed or been previously remediated.`
      );
    }
    signals.push(
      `TEMPORAL_EXCESSIVE_AGE: Photographic evidence was captured ${evidenceAgeDays} days prior to submission (exceeds ${TEMPORAL_THRESHOLDS.EXCESSIVE_EVIDENCE_AGE_DAYS}-day freshness threshold). Physical site condition may have evolved or been previously addressed.`
    );
    return {
      hasTimestamp: true,
      exifDateTime: rawExifDateTime,
      parsedCaptureDate: captureIso,
      submissionDate: submissionIso,
      observedDate,
      status: 'EXCESSIVE_AGE',
      diffMinutesWithSubmission,
      diffDaysWithObservedDate,
      evidenceAgeDays,
      reviewRequired: true,
      signals,
      uncertainties,
      limitations,
    };
  }

  // 6. Testimonial Discrepancy Check (Capture Date vs Reported Observed Date > 30 days)
  if (diffDaysWithObservedDate > TEMPORAL_THRESHOLDS.OBSERVED_DATE_DISCREPANCY_DAYS) {
    signals.push(
      `TEMPORAL_DISCREPANCY: Photographic evidence timestamp (${captureDateOnly}) diverges from citizen-reported observed date (${observedDate}) by ${diffDaysWithObservedDate} days (threshold: ${TEMPORAL_THRESHOLDS.OBSERVED_DATE_DISCREPANCY_DAYS} days). Indicates potential historical photo reuse or inaccurate date recollection.`
    );
    return {
      hasTimestamp: true,
      exifDateTime: rawExifDateTime,
      parsedCaptureDate: captureIso,
      submissionDate: submissionIso,
      observedDate,
      status: 'DISCREPANCY',
      diffMinutesWithSubmission,
      diffDaysWithObservedDate,
      evidenceAgeDays,
      reviewRequired: true,
      signals,
      uncertainties,
      limitations,
    };
  }

  // 7. Valid & Consistent
  signals.push(
    `TEMPORAL_CONSISTENCY: Evidence capture timestamp (${captureDateOnly}) correlates with citizen-reported incident date (${observedDate}) and submission timeframe (${evidenceAgeDays} days ago).`
  );

  return {
    hasTimestamp: true,
    exifDateTime: rawExifDateTime,
    parsedCaptureDate: captureIso,
    submissionDate: submissionIso,
    observedDate,
    status: 'VALID',
    diffMinutesWithSubmission,
    diffDaysWithObservedDate,
    evidenceAgeDays,
    reviewRequired: false,
    signals,
    uncertainties,
    limitations,
  };
}
