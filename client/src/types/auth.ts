export type UserRole = 'CITIZEN' | 'OFFICER' | 'ADMIN';

export interface CitizenUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  ward?: string;
  department?: string;
  createdAt?: string;
}

export type AuthMode = 'login' | 'signup' | 'officer';
