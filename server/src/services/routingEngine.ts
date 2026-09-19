import type {
  AuthorityType,
  CoordinateValidationResult,
  JurisdictionVersion,
  OfficerRerouteInput,
  RoutingDecision,
  RoutingInput,
  RoutingOverrideAudit,
  RoutingProvenance,
  RoutingStatus,
} from '../types/routing.js';
import { getWardForCoordinates, loadWardsDataset, type WardLookupResult } from './wardService.js';

/**
 * Validates geographic coordinates for syntactic and range validity.
 * Latitude must be in [-90, +90], longitude in [-180, +180].
 * Values must be finite numbers (not NaN, not Infinity).
 */
export function validateCoordinates(
  rawLat?: any,
  rawLng?: any
): CoordinateValidationResult {
  const hasLat = rawLat !== undefined && rawLat !== null && rawLat !== '';
  const hasLng = rawLng !== undefined && rawLng !== null && rawLng !== '';

  if (!hasLat && !hasLng) {
    return { valid: true, hasCoordinates: false };
  }

  if (hasLat !== hasLng) {
    return {
      valid: false,
      hasCoordinates: false,
      error: 'Both latitude and longitude must be provided together.',
    };
  }

  const lat = typeof rawLat === 'string' ? Number(rawLat.trim()) : Number(rawLat);
  const lng = typeof rawLng === 'string' ? Number(rawLng.trim()) : Number(rawLng);

  if (!Number.isFinite(lat) || Number.isNaN(lat)) {
    return {
      valid: false,
      hasCoordinates: false,
      error: 'Latitude must be a valid finite number.',
    };
  }

  if (!Number.isFinite(lng) || Number.isNaN(lng)) {
    return {
      valid: false,
      hasCoordinates: false,
      error: 'Longitude must be a valid finite number.',
    };
  }

  if (lat < -90 || lat > 90) {
    return {
      valid: false,
      hasCoordinates: true,
      latitude: lat,
      longitude: lng,
      error: `Latitude ${lat} is out of bounds. Must be between -90.0 and +90.0 degrees.`,
    };
  }

  if (lng < -180 || lng > 180) {
    return {
      valid: false,
      hasCoordinates: true,
      latitude: lat,
      longitude: lng,
      error: `Longitude ${lng} is out of bounds. Must be between -180.0 and +180.0 degrees.`,
    };
  }

  return {
    valid: true,
    hasCoordinates: true,
    latitude: lat,
    longitude: lng,
  };
}

/**
 * Current repository jurisdiction data source status.
 * Checks whether the authentic Mysuru 65-ward GIS dataset is available in the system.
 */
export function getJurisdictionDataSourceStatus(): 'AVAILABLE' | 'UNAVAILABLE' {
  const dataset = loadWardsDataset();
  return dataset && dataset.totalWards > 0 ? 'AVAILABLE' : 'UNAVAILABLE';
}

/**
 * Maps an issue category to a provisional operating department recommendation.
 * This is an operational rule-based triage recommendation, completely separated
 * from geographic jurisdiction determination.
 */
export function resolveDepartmentRecommendation(category: string): {
  department: string;
  provenance: RoutingProvenance;
  validCategory: boolean;
} {
  const normalized = (category || '').trim().toLowerCase();

  switch (normalized) {
    case 'pothole':
      return {
        department: 'MCC Engineering Division',
        provenance: 'RULE_BASED',
        validCategory: true,
      };
    case 'garbage_dumping':
    case 'overflowing_bin':
    case 'unsegregated_waste':
      return {
        department: 'MCC Health & Sanitation Department',
        provenance: 'RULE_BASED',
        validCategory: true,
      };
    case 'broken_streetlight':
      return {
        department: 'CHESCOM / MCC Electrical Division',
        provenance: 'RULE_BASED',
        validCategory: true,
      };
    case 'construction_debris':
      return {
        department: 'MCC Town Planning & Public Works',
        provenance: 'RULE_BASED',
        validCategory: true,
      };
    case 'other':
      return {
        department: 'MCC General Grievance Cell',
        provenance: 'RULE_BASED',
        validCategory: true,
      };
    default:
      return {
        department: 'MCC General Grievance Cell',
        provenance: 'RULE_BASED',
        validCategory: false,
      };
  }
}

/**
 * Evaluates routing for a civic complaint.
 * Adheres strictly to the zero-hallucination policy:
 * - Coordinates are validated syntactically.
 * - When coordinates are provided, ward boundaries are evaluated via wardService against authentic 65-ward GeoJSON.
 * - If matched inside MCC ward polygon, jurisdiction confirms MCC; status becomes ROUTED if category is valid & no flags.
 * - If outside boundary, safe outside_boundary status is assigned without assigning default ward/authority.
 * - If GIS dataset is unavailable, jurisdiction is marked UNKNOWN and reviewRequired is true.
 * - Category provides an operational department recommendation.
 * - Verification signals (duplicates, inconsistencies) inform reviewRequired.
 */
export function evaluateRouting(input: RoutingInput): RoutingDecision {
  const explanation: string[] = [];

  // 1. Coordinate Validation
  const coordResult = validateCoordinates(input.latitude, input.longitude);

  // 2. Department Recommendation (Rule-based operational triage)
  const deptResult = resolveDepartmentRecommendation(input.category);

  let status: RoutingStatus = 'REVIEW_REQUIRED';
  let authorityType: AuthorityType = 'UNKNOWN';
  let authorityName = 'Jurisdiction Unverified';
  let reviewRequired = true;
  let jurisdictionProvenance: RoutingProvenance = 'UNKNOWN';
  let overallProvenance: RoutingProvenance = 'UNKNOWN';
  let jurisdictionId: string | undefined;
  let jurisdictionVersion: string | undefined;
  let wardResult: WardLookupResult | undefined;

  // Check Location Validation & Ward Resolution
  if (!coordResult.valid) {
    status = 'INVALID_LOCATION';
    explanation.push(`Coordinate validation failed: ${coordResult.error}`);
  } else if (!coordResult.hasCoordinates && (!input.locationArea || input.locationArea.trim().length === 0)) {
    status = 'MISSING_INFORMATION';
    explanation.push('Missing location data: Neither coordinates nor location area were provided.');
  } else if (coordResult.hasCoordinates) {
    // Real GPS coordinates provided -> Evaluate against authentic 65-ward GeoJSON
    wardResult = getWardForCoordinates(coordResult.latitude, coordResult.longitude);

    if (wardResult.status === 'matched') {
      // Point confirmed inside one of the 65 Mysuru MCC wards
      authorityType = 'MCC';
      authorityName = 'Mysuru City Corporation';
      jurisdictionProvenance = 'RULE_BASED';
      overallProvenance = 'RULE_BASED';
      jurisdictionId = `MCC-WARD-${wardResult.wardNumber}`;
      jurisdictionVersion = wardResult.boundaryVersion;
      reviewRequired = false;
      status = 'ROUTED';

      explanation.push(
        `Administrative jurisdiction confirmed as Mysuru City Corporation (Ward ${wardResult.wardNumber} — ${wardResult.wardName}) based on municipal boundary dataset (${wardResult.boundaryVersion}).`
      );
    } else if (wardResult.status === 'outside_boundary') {
      // Coordinates outside all 65 MCC ward polygons
      status = 'REVIEW_REQUIRED';
      authorityType = 'UNKNOWN';
      authorityName = 'Jurisdiction Unverified';
      reviewRequired = true;

      explanation.push(
        `Coordinates provided (${coordResult.latitude?.toFixed(5)}°, ${coordResult.longitude?.toFixed(5)}°) fall outside the 65 Mysuru City Corporation ward boundaries (${wardResult.boundaryVersion}). Safe routing held for administrative review.`
      );
    } else {
      // boundary_unavailable
      status = 'REVIEW_REQUIRED';
      authorityType = 'UNKNOWN';
      authorityName = 'Jurisdiction Unverified';
      reviewRequired = true;

      explanation.push('Authoritative GIS jurisdiction dataset is UNAVAILABLE in system.');
      explanation.push('Administrative jurisdiction cannot be inferred from coordinates or locality names.');
      explanation.push(
        `Coordinates provided (${coordResult.latitude?.toFixed(5)}°, ${coordResult.longitude?.toFixed(5)}°) are syntactically valid but require manual jurisdictional verification.`
      );
    }
  } else {
    // Only locality area text provided without GPS coordinates
    status = 'REVIEW_REQUIRED';
    explanation.push('No GPS coordinates provided for automated polygon boundary matching.');
    explanation.push(
      `Locality area "${input.locationArea?.trim()}" requires officer ward jurisdiction assignment.`
    );
  }

  // Check Category Validation
  if (!deptResult.validCategory) {
    if (status !== 'INVALID_LOCATION' && status !== 'MISSING_INFORMATION') {
      status = 'INVALID_CATEGORY';
      reviewRequired = true;
    }
    explanation.push(
      `Issue category "${input.category}" is unclassified or unrecognized. Assigned to General Grievance Cell for triage.`
    );
  } else {
    explanation.push(
      `Department recommendation "${deptResult.department}" assigned via rule-based category mapping (provisional).`
    );
  }

  // Check Verification Context (influences reviewRequired)
  if (input.duplicateRisk === 'HIGH' || input.verificationOutcome === 'POSSIBLE_DUPLICATE') {
    reviewRequired = true;
    if (status === 'ROUTED') {
      status = 'REVIEW_REQUIRED';
    }
    explanation.push(
      'Verification Engine flagged high duplicate risk. Officer review required prior to field dispatch.'
    );
  }

  if (input.verificationOutcome === 'INCONSISTENT_EVIDENCE') {
    reviewRequired = true;
    if (status === 'ROUTED') {
      status = 'REVIEW_REQUIRED';
    }
    explanation.push(
      'Verification Engine detected inconsistent evidence signals. Officer physical corroboration advised.'
    );
  }

  return {
    status,
    authorityType,
    authorityName,
    department: deptResult.department,
    departmentProvenance: deptResult.provenance,
    jurisdictionProvenance,
    provenance: overallProvenance,
    reviewRequired,
    explanation,
    jurisdictionId,
    jurisdictionVersion,
    wardId: wardResult?.wardId ?? undefined,
    wardName: wardResult?.wardName ?? undefined,
    wardNumber: wardResult?.wardNumber ?? undefined,
    wardCode: wardResult?.wardCode ?? undefined,
    lgdWardCode: wardResult?.lgdWardCode ?? undefined,
    boundaryVersion: wardResult?.boundaryVersion ?? undefined,
    wardStatus: wardResult?.status ?? undefined,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Creates a safe fallback routing decision if routing engine evaluation throws unexpectedly.
 * Ensures complaint creation is never crashed by an unexpected routing error.
 */
export function createFallbackRoutingDecision(error: unknown): RoutingDecision {
  const errMsg = error instanceof Error ? error.message : String(error);
  return {
    status: 'REVIEW_REQUIRED',
    authorityType: 'UNKNOWN',
    authorityName: 'Jurisdiction Unverified',
    department: 'MCC General Grievance Cell',
    departmentProvenance: 'UNKNOWN',
    jurisdictionProvenance: 'UNKNOWN',
    provenance: 'UNKNOWN',
    reviewRequired: true,
    explanation: [
      'Routing engine encountered an internal evaluation exception. Safe fallback engaged.',
      `Diagnostic detail: ${errMsg}`,
    ],
    timestamp: new Date().toISOString(),
  };
}

/**
 * Applies a manual officer routing override.
 * - Authenticated officer identity is derived strictly server-side.
 * - Complete previous decision is preserved in the append-only audit trail.
 * - Non-empty override reason is strictly required.
 * - Provenance transitions to 'HUMAN_CONFIRMED'.
 */
export function applyOfficerOverride(
  currentDecision: RoutingDecision,
  officer: { id: string; name: string; role: string },
  override: OfficerRerouteInput
): RoutingDecision {
  if (!override.overrideReason || override.overrideReason.trim().length === 0) {
    throw new Error('Override reason is mandatory and cannot be empty.');
  }

  const newAuthorityType: AuthorityType = override.authorityType || currentDecision.authorityType;
  let newAuthorityName = currentDecision.authorityName;
  if (override.authorityType) {
    switch (override.authorityType) {
      case 'MCC':
        newAuthorityName = 'Mysuru City Corporation';
        break;
      case 'TOWN_PANCHAYAT':
        newAuthorityName = 'Town Panchayat';
        break;
      case 'GRAM_PANCHAYAT':
        newAuthorityName = 'Gram Panchayat';
        break;
      default:
        newAuthorityName = 'Jurisdiction Unverified';
    }
  }

  const newDepartment = override.department ? override.department.trim() : currentDecision.department;
  const isAuthorityConfirmed = newAuthorityType !== 'UNKNOWN';
  const newStatus: RoutingStatus = isAuthorityConfirmed ? 'ROUTED' : currentDecision.status;
  const newReviewRequired = !isAuthorityConfirmed;

  const newExplanation = [
    ...currentDecision.explanation,
    `[Officer Override] ${officer.name} (${officer.id}) updated routing: Authority=${newAuthorityType}, Department=${newDepartment}. Reason: "${override.overrideReason.trim()}".`,
  ];

  const auditRecord: RoutingOverrideAudit = {
    officerId: officer.id,
    officerName: officer.name,
    previousDecision: JSON.parse(JSON.stringify(currentDecision)),
    newDecision: {
      authorityType: newAuthorityType,
      authorityName: newAuthorityName,
      department: newDepartment,
      status: newStatus,
      reviewRequired: newReviewRequired,
      explanation: newExplanation,
    },
    overrideReason: override.overrideReason.trim(),
    timestamp: new Date().toISOString(),
  };

  const overrideHistory = [
    ...(currentDecision.overrideHistory || []),
    auditRecord,
  ];

  return {
    status: newStatus,
    authorityType: newAuthorityType,
    authorityName: newAuthorityName,
    department: newDepartment,
    departmentProvenance: 'HUMAN_CONFIRMED',
    jurisdictionProvenance: isAuthorityConfirmed ? 'HUMAN_CONFIRMED' : currentDecision.jurisdictionProvenance,
    provenance: 'HUMAN_CONFIRMED',
    reviewRequired: newReviewRequired,
    explanation: newExplanation,
    jurisdictionId: currentDecision.jurisdictionId,
    jurisdictionVersion: currentDecision.jurisdictionVersion,
    effectiveDateUsed: currentDecision.effectiveDateUsed,
    timestamp: new Date().toISOString(),
    overrideHistory,
  };
}
