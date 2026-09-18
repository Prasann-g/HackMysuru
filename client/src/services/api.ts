import type { CitizenUser } from '../types/auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const TOKEN_KEY = 'civictrust_token';

export function getStoredToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    // SessionStorage may be restricted in private/sandboxed windows
  }
}

export function clearStoredToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore error on clearing
  }
}

interface AuthApiResponse {
  token: string;
  user: CitizenUser;
}

export async function apiLogin(credentials: {
  email: string;
  password: string;
}): Promise<AuthApiResponse> {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Login failed. Please check your credentials.');
  }

  setStoredToken(data.token);
  return data;
}

export async function apiRegisterCitizen(payload: {
  name: string;
  email: string;
  password: string;
  ward?: string;
}): Promise<AuthApiResponse> {
  const res = await fetch(`${API_BASE_URL}/api/auth/register/citizen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Registration failed. Please try again.');
  }

  setStoredToken(data.token);
  return data;
}

export async function apiGetMe(): Promise<CitizenUser | null> {
  const token = getStoredToken();
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      clearStoredToken();
      return null;
    }

    const data = await res.json();
    return data.user;
  } catch {
    // If backend is unreachable or network is offline, return null
    return null;
  }
}

// ----------------------------------------------------------------------------
// Complaint Service API
// ----------------------------------------------------------------------------

export interface CreateComplaintPayload {
  category: string;
  customCategory?: string;
  description: string;
  observedDate: string;
  locationArea: string;
  addressText?: string;
  hasImage?: boolean;
  evidenceMetadata?: {
    filename: string;
    sizeBytes: number;
    mimetype: string;
    submittedAt: string;
    note: string;
  };
}

export interface ComplaintRecord {
  id: string;
  trackingToken: string;
  citizenId: string;
  category: string;
  customCategory?: string;
  description: string;
  observedDate: string;
  locationArea: string;
  addressText?: string;
  hasImage: boolean;
  status: string;
  verificationResult?: {
    outcome: string;
    duplicateRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    matches: Array<{
      existingComplaintId: string;
      category: string;
      jaccardSimilarity: number;
      matchingPhrases: string[];
      riskLevel: string;
      imageMatch?: {
        matchType: 'EXACT_IMAGE_REUSE' | 'LIKELY_VISUAL_SIMILARITY';
        sha256Matched: boolean;
        hammingDistance?: number;
        explanation: string;
      };
    }>;
    signals: string[];
    uncertainties: string[];
    limitations: string[];
    recommendedAction: string;
    categoryAlignment: {
      aligned: boolean;
      detectedKeywords: string[];
    };
    imageComparisonSignal?: 'EXACT_IMAGE_REUSE' | 'LIKELY_VISUAL_SIMILARITY' | 'NO_IMAGE_MATCH' | 'IMAGE_COMPARISON_UNAVAILABLE';
  };
  assignedDepartment?: string;
  assignedOfficerId?: string;
  reviewNotes?: string;
  evidenceMetadata?: {
    filename: string;
    sizeBytes: number;
    mimetype: string;
    submittedAt: string;
    note: string;
  };
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function apiGetComplaintImageBlobUrl(complaintId: string): Promise<string | null> {
  const token = getStoredToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE_URL}/api/complaints/${complaintId}/image`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

export interface PublicTrackResult {
  id: string;
  trackingToken: string;
  category: string;
  customCategory?: string;
  description: string;
  locationArea: string;
  observedDate: string;
  status: string;
  assignedDepartment?: string;
  verificationOutcome?: string;
  duplicateRisk?: string;
  signals?: string[];
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  disclaimer: string;
}

export async function apiCreateComplaint(
  payload: CreateComplaintPayload
): Promise<{ complaint: ComplaintRecord; evidenceNotice: string }> {
  const token = getStoredToken();
  if (!token) {
    throw new Error('You must be logged in as a citizen to submit a complaint.');
  }

  const res = await fetch(`${API_BASE_URL}/api/complaints`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to register complaint. Please try again.');
  }

  return data;
}

export async function apiGetMyComplaints(): Promise<ComplaintRecord[]> {
  const token = getStoredToken();
  if (!token) return [];

  const res = await fetch(`${API_BASE_URL}/api/complaints/my`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to retrieve your complaints.');
  }

  return data.complaints || [];
}

export async function apiTrackComplaint(
  trackingToken: string
): Promise<PublicTrackResult> {
  const cleanToken = trackingToken.trim();
  const res = await fetch(
    `${API_BASE_URL}/api/complaints/track/${encodeURIComponent(cleanToken)}`
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      data.error || 'Complaint not found with the provided tracking token.'
    );
  }

  return data;
}

export async function apiGetDemoPool(): Promise<ComplaintRecord[]> {
  const res = await fetch(`${API_BASE_URL}/api/complaints/demo-pool`);
  const data = await res.json();
  if (!res.ok) return [];
  return data.complaints || [];
}

// ----------------------------------------------------------------------------
// MCC Officer Dashboard API (Step 4.4)
// ----------------------------------------------------------------------------

export interface OfficerComplaintDetail {
  complaint: ComplaintRecord;
  citizen?: {
    id: string;
    name: string;
    email: string;
    ward?: string;
  } | null;
  matchedCandidates: ComplaintRecord[];
}

export interface OfficerComplaintsFilter {
  status?: string;
  locationArea?: string;
  category?: string;
  duplicateRisk?: string;
  q?: string;
}

export interface OfficerUpdateReviewPayload {
  status?: string;
  assignedDepartment?: string;
  assignedOfficerId?: string;
  reviewNotes?: string;
}

export async function apiGetOfficerComplaints(
  filters?: OfficerComplaintsFilter
): Promise<ComplaintRecord[]> {
  const token = getStoredToken();
  if (!token) {
    throw new Error('You must be logged in as an MCC officer to access the review queue.');
  }

  const queryParams = new URLSearchParams();
  if (filters?.status) queryParams.set('status', filters.status);
  if (filters?.locationArea) queryParams.set('locationArea', filters.locationArea);
  if (filters?.category) queryParams.set('category', filters.category);
  if (filters?.duplicateRisk) queryParams.set('duplicateRisk', filters.duplicateRisk);
  if (filters?.q) queryParams.set('q', filters.q);

  const qs = queryParams.toString();
  const url = `${API_BASE_URL}/api/officer/complaints${qs ? `?${qs}` : ''}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to retrieve officer complaints queue.');
  }

  return data.complaints || [];
}

export async function apiGetOfficerComplaintById(
  id: string
): Promise<OfficerComplaintDetail> {
  const token = getStoredToken();
  if (!token) {
    throw new Error('You must be logged in as an MCC officer.');
  }

  const res = await fetch(`${API_BASE_URL}/api/officer/complaints/${encodeURIComponent(id)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to retrieve complaint details.');
  }

  return data;
}

export async function apiUpdateOfficerReview(
  id: string,
  payload: OfficerUpdateReviewPayload
): Promise<{ complaint: ComplaintRecord }> {
  const token = getStoredToken();
  if (!token) {
    throw new Error('You must be logged in as an MCC officer.');
  }

  const res = await fetch(
    `${API_BASE_URL}/api/officer/complaints/${encodeURIComponent(id)}/review`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update complaint review.');
  }

  return data;
}

