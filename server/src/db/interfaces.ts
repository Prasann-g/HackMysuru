import type { UserRecord } from '../types/auth.js';
import type {
  ComplaintRecord,
  ComplaintResolutionAuditRecord,
  PublicAnalyticsData,
} from '../types/complaint.js';
import type { ExistingComplaint } from '../types/verification.js';

export const AUTHENTIC_USER_IDS = [
  'USR-OFFICER-48',
  'USR-OFFICER-SAN',
  'USR-CITIZEN-DEMO',
  'USR-CITIZEN-MU74EWAB-KCZ6',
  'USR-CITIZEN-MU74EWCE-3UGO',
  'USR-CITIZEN-MU74EX7R-6W44',
  'USR-CITIZEN-MU74EX9M-XRLQ',
  'USR-OFFICER-MU74EXBC-B3UE',
  'USR-CITIZEN-MU74EXWW-LSKD',
  'USR-CITIZEN-MU74EXYS-VM25',
  'USR-OFFICER-MU74EY0R-VPSI',
  'USR-CITIZEN-MU74EYLZ-B6UU',
  'USR-CITIZEN-MU74EZA8-HSV4',
] as const;

export const AUTHENTIC_COMPLAINT_IDS = [
  'MCC-2026-MU74EXCE-PGH6',
  'MCC-HISTORICAL-1789745758319',
  'MCC-2026-MU74EXDZ-M02C',
  'MCC-2026-MU74EY1P-LW9J',
  'MCC-2026-MU74EY3L-LKMW',
  'MCC-2026-MU74EY42-V4PI',
  'MCC-2026-MU74EY4S-S3BZ',
  'MCC-2026-MU74EYOO-FFDE',
  'MCC-2026-MU74EZAY-DK2Z',
  'MCC-2026-MU74EZBL-I5LM',
  'MCC-2026-MU74EZBY-GX3I',
] as const;

export interface IUserStore {
  findByEmail(email: string): Promise<UserRecord | undefined>;
  findById(id: string): Promise<UserRecord | undefined>;
  save(user: UserRecord): Promise<UserRecord>;
  listAll(): Promise<UserRecord[]>;
  clearNonDefault(): Promise<void>;
  resetAll(): Promise<void>;
}

export interface ComplaintOfficerFilters {
  status?: string;
  locationArea?: string;
  category?: string;
  duplicateRisk?: string;
  q?: string;
}

export interface IComplaintStore {
  create(complaint: ComplaintRecord): Promise<ComplaintRecord>;
  findByImageSha256(sha256: string, excludeId?: string): Promise<ComplaintRecord[]>;
  findById(id: string): Promise<ComplaintRecord | undefined>;
  findByTrackingToken(token: string): Promise<ComplaintRecord | undefined>;
  findByCitizenId(citizenId: string): Promise<ComplaintRecord[]>;
  listOpenCandidates(): Promise<ExistingComplaint[]>;
  listCandidatesForVerification(limit?: number): Promise<ExistingComplaint[]>;
  listForOfficer(filters?: ComplaintOfficerFilters): Promise<ComplaintRecord[]>;
  findMatchesForComplaint(id: string): Promise<ComplaintRecord[]>;
  update(id: string, updates: Partial<ComplaintRecord>): Promise<ComplaintRecord | undefined>;
  listDemoComplaints(): Promise<ComplaintRecord[]>;
  getPublicAnalytics(): Promise<PublicAnalyticsData>;
  createAuditRecord(record: ComplaintResolutionAuditRecord): Promise<ComplaintResolutionAuditRecord>;
  listAuditRecords(clusterId?: string): Promise<ComplaintResolutionAuditRecord[]>;
  clearNonDemo(): Promise<void>;
  resetAll(): Promise<void>;
}
