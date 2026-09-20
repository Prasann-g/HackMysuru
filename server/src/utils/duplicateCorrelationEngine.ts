import { calculateHammingDistance } from './imageHash.js';
import { calculateCosineSimilarity } from './imageEmbedding.js';

export interface VisualResemblanceSignal {
  sha256Match: boolean;
  hammingDistance?: number;
  embeddingSimilarity?: number;
  score: number; // 0.00 to 1.00
  level: 'EXACT' | 'HIGH' | 'MODERATE' | 'LOW' | 'NONE';
}

export interface LocationProximitySignal {
  distanceMeters?: number;
  sameAreaText: boolean;
  score: number; // 0.00 to 1.00
  level: 'IMMEDIATE' | 'NEARBY' | 'SAME_NEIGHBORHOOD' | 'SAME_WARD' | 'DISTANT' | 'UNAVAILABLE';
}

export interface TemporalProximitySignal {
  diffHours?: number;
  diffDays?: number;
  score: number; // 0.00 to 1.00
  level: 'SAME_DAY' | 'WITHIN_WEEK' | 'WITHIN_MONTH' | 'WITHIN_QUARTER' | 'HISTORIC' | 'UNAVAILABLE';
}

export type DuplicateConfidenceLevel =
  | 'HIGH_CONFIDENCE_DUPLICATE'
  | 'POTENTIAL_NEARBY_DUPLICATE'
  | 'VISUALLY_SIMILAR_DIFFERENT_LOCATION'
  | 'LOW_SIMILARITY';

export interface DuplicateCorrelation {
  candidateComplaintId: string;
  visualResemblance: VisualResemblanceSignal;
  locationProximity: LocationProximitySignal;
  temporalProximity: TemporalProximitySignal;
  confidenceScore: number; // 0.00 to 1.00
  confidenceLevel: DuplicateConfidenceLevel;
  isPotentialDuplicate: boolean;
  explanation: string;
}

export interface CorrelationSubject {
  id?: string;
  latitude?: number;
  longitude?: number;
  locationArea?: string;
  observedDate: string;
  createdAt?: string;
  imageSha256?: string;
  imagePhash?: string;
  imageEmbedding?: number[];
}

/**
 * Calculates geographic distance in meters between two lat/lon coordinates using the Haversine formula.
 * Returns distance in meters rounded to nearest meter, or null if coordinates are invalid.
 */
export function calculateHaversineDistanceMeters(
  lat1?: number,
  lon1?: number,
  lat2?: number,
  lon2?: number
): number | null {
  if (
    lat1 === undefined ||
    lon1 === undefined ||
    lat2 === undefined ||
    lon2 === undefined ||
    !Number.isFinite(lat1) ||
    !Number.isFinite(lon1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lon2)
  ) {
    return null;
  }

  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Calculates time difference between two dates in hours and days.
 */
export function calculateTimeDelta(
  dateA?: string,
  dateB?: string
): { diffHours?: number; diffDays?: number } {
  if (!dateA || !dateB) return {};

  const timeA = new Date(dateA).getTime();
  const timeB = new Date(dateB).getTime();

  if (isNaN(timeA) || isNaN(timeB)) return {};

  const diffMs = Math.abs(timeA - timeB);
  const diffHours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
  const diffDays = Math.round((diffMs / (1000 * 60 * 60 * 24)) * 10) / 10;

  return { diffHours, diffDays };
}

/**
 * Multi-Signal Correlation Engine:
 * Synthesizes visual resemblance, geographic proximity, and temporal delta into an explainable duplicate confidence score.
 * 
 * Strict Guardrail:
 * A visually similar image from a DIFFERENT location (> 1500 meters) is NEVER classified as a high-confidence duplicate.
 * It is designated as VISUALLY_SIMILAR_DIFFERENT_LOCATION to avoid conflating identical streetlights or common pothole shapes.
 */
export function correlateDuplicateSignals(
  input: CorrelationSubject,
  candidate: CorrelationSubject & { id: string }
): DuplicateCorrelation {
  // 1. Visual Resemblance Signal
  const sha256Match = Boolean(
    input.imageSha256 &&
    candidate.imageSha256 &&
    input.imageSha256 === candidate.imageSha256
  );

  const hammingDistance =
    input.imagePhash && candidate.imagePhash
      ? calculateHammingDistance(input.imagePhash, candidate.imagePhash) ?? undefined
      : undefined;

  const embeddingSimilarity =
    input.imageEmbedding && candidate.imageEmbedding
      ? calculateCosineSimilarity(input.imageEmbedding, candidate.imageEmbedding) ?? undefined
      : undefined;

  let visualScore = 0.0;
  let visualLevel: VisualResemblanceSignal['level'] = 'NONE';

  if (sha256Match) {
    visualScore = 1.0;
    visualLevel = 'EXACT';
  } else {
    // Calculate normalized visual components
    const dHashScore =
      hammingDistance !== undefined ? Math.max(0, 1 - hammingDistance / 32) : null;
    const embedScore = embeddingSimilarity !== undefined ? embeddingSimilarity : null;

    if (dHashScore !== null && embedScore !== null) {
      // Harmonic mean or weighted blend favoring the stronger signal
      visualScore = Math.max(dHashScore, embedScore) * 0.6 + Math.min(dHashScore, embedScore) * 0.4;
    } else if (dHashScore !== null) {
      visualScore = dHashScore;
    } else if (embedScore !== null) {
      visualScore = embedScore;
    }

    visualScore = Math.round(visualScore * 100) / 100;

    if (visualScore >= 0.85 || (hammingDistance !== undefined && hammingDistance <= 5)) {
      visualLevel = 'HIGH';
    } else if (visualScore >= 0.70 || (hammingDistance !== undefined && hammingDistance <= 10)) {
      visualLevel = 'MODERATE';
    } else if (visualScore >= 0.40) {
      visualLevel = 'LOW';
    } else {
      visualLevel = 'NONE';
    }
  }

  const visualResemblance: VisualResemblanceSignal = {
    sha256Match,
    hammingDistance,
    embeddingSimilarity,
    score: visualScore,
    level: visualLevel,
  };

  // 2. Geographic Proximity Signal
  const distanceMeters =
    calculateHaversineDistanceMeters(
      input.latitude,
      input.longitude,
      candidate.latitude,
      candidate.longitude
    ) ?? undefined;

  const sameAreaText = Boolean(
    input.locationArea &&
    candidate.locationArea &&
    input.locationArea.trim().toLowerCase() === candidate.locationArea.trim().toLowerCase()
  );

  let locScore = 0.3; // neutral default if no geo info
  let locLevel: LocationProximitySignal['level'] = 'UNAVAILABLE';

  if (distanceMeters !== undefined) {
    if (distanceMeters <= 50) {
      locScore = 1.0;
      locLevel = 'IMMEDIATE';
    } else if (distanceMeters <= 200) {
      locScore = 0.85;
      locLevel = 'NEARBY';
    } else if (distanceMeters <= 500) {
      locScore = 0.60;
      locLevel = 'SAME_NEIGHBORHOOD';
    } else if (distanceMeters <= 1500) {
      locScore = 0.30;
      locLevel = 'SAME_WARD';
    } else {
      locScore = 0.05;
      locLevel = 'DISTANT';
    }
  } else if (sameAreaText) {
    locScore = 0.60;
    locLevel = 'SAME_WARD';
  }

  const locationProximity: LocationProximitySignal = {
    distanceMeters,
    sameAreaText,
    score: locScore,
    level: locLevel,
  };

  // 3. Temporal Proximity Signal
  const timeDelta = calculateTimeDelta(
    input.observedDate || input.createdAt,
    candidate.observedDate || candidate.createdAt
  );

  let tempScore = 0.5;
  let tempLevel: TemporalProximitySignal['level'] = 'UNAVAILABLE';

  if (timeDelta.diffDays !== undefined) {
    if (timeDelta.diffDays <= 1) {
      tempScore = 1.0;
      tempLevel = 'SAME_DAY';
    } else if (timeDelta.diffDays <= 7) {
      tempScore = 0.85;
      tempLevel = 'WITHIN_WEEK';
    } else if (timeDelta.diffDays <= 30) {
      tempScore = 0.60;
      tempLevel = 'WITHIN_MONTH';
    } else if (timeDelta.diffDays <= 90) {
      tempScore = 0.30;
      tempLevel = 'WITHIN_QUARTER';
    } else {
      tempScore = 0.10;
      tempLevel = 'HISTORIC';
    }
  }

  const temporalProximity: TemporalProximitySignal = {
    diffHours: timeDelta.diffHours,
    diffDays: timeDelta.diffDays,
    score: tempScore,
    level: tempLevel,
  };

  // 4. Combined Multi-Signal Confidence Synthesis
  let confidenceLevel: DuplicateConfidenceLevel = 'LOW_SIMILARITY';
  let isPotentialDuplicate = false;
  let confidenceScore = 0.0;
  let explanation = '';

  const hasHighVisual = visualLevel === 'EXACT' || visualLevel === 'HIGH';
  const hasModerateVisual = visualLevel === 'MODERATE';
  const isGeographicallyDistant = locLevel === 'DISTANT' || (distanceMeters !== undefined && distanceMeters > 1500);

  if ((hasHighVisual || hasModerateVisual) && isGeographicallyDistant) {
    // RULE ENFORCEMENT: Similar image from different location is NOT a duplicate
    confidenceLevel = 'VISUALLY_SIMILAR_DIFFERENT_LOCATION';
    isPotentialDuplicate = false;
    confidenceScore = Number((visualScore * 0.3).toFixed(2));
    const distKm = (distanceMeters! / 1000).toFixed(1);
    explanation = `High visual resemblance detected (${visualResemblance.hammingDistance !== undefined ? `dHash ${visualResemblance.hammingDistance}/64` : ''}${visualResemblance.embeddingSimilarity !== undefined ? `embedding ${Math.round(visualResemblance.embeddingSimilarity * 100)}%` : ''}), but physical sites are separated by ${distKm} km. Likely standard municipal infrastructure or independent incident; not classified as a duplicate.`;
  } else if (hasHighVisual && (locLevel === 'IMMEDIATE' || locLevel === 'NEARBY') && tempScore >= 0.60) {
    confidenceLevel = 'HIGH_CONFIDENCE_DUPLICATE';
    isPotentialDuplicate = true;
    confidenceScore = Number((visualScore * 0.50 + locScore * 0.35 + tempScore * 0.15).toFixed(2));
    const distText = distanceMeters !== undefined ? `${distanceMeters}m apart` : 'same locality';
    const timeText = timeDelta.diffDays !== undefined ? `${timeDelta.diffDays} days apart` : 'recent timeframe';
    explanation = `High visual resemblance + Close physical proximity (${distText}) + Close timeframe (${timeText}). High confidence duplicate candidate for field review.`;
  } else if ((hasHighVisual || hasModerateVisual) && (locLevel === 'IMMEDIATE' || locLevel === 'NEARBY' || locLevel === 'SAME_NEIGHBORHOOD' || locLevel === 'SAME_WARD')) {
    confidenceLevel = 'POTENTIAL_NEARBY_DUPLICATE';
    isPotentialDuplicate = true;
    confidenceScore = Number((visualScore * 0.45 + locScore * 0.35 + tempScore * 0.20).toFixed(2));
    const distText = distanceMeters !== undefined ? `${distanceMeters}m apart` : (sameAreaText ? 'same ward' : 'adjacent area');
    explanation = `Visual similarity detected in adjacent or same ward area (${distText}). Potential duplicate candidate requiring officer inspection.`;
  } else {
    confidenceLevel = 'LOW_SIMILARITY';
    isPotentialDuplicate = false;
    confidenceScore = Number((visualScore * 0.50 + locScore * 0.30 + tempScore * 0.20).toFixed(2));
    explanation = `Insufficient combined visual, geographic, and temporal signals to indicate duplicate submission.`;
  }

  return {
    candidateComplaintId: candidate.id,
    visualResemblance,
    locationProximity,
    temporalProximity,
    confidenceScore,
    confidenceLevel,
    isPotentialDuplicate,
    explanation,
  };
}
