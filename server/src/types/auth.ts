export type UserRole = 'CITIZEN' | 'OFFICER' | 'ADMIN';

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  ward?: string;
  department?: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  ward?: string;
  department?: string;
}

export interface AuthTokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  ward?: string;
}

export interface CitizenRegisterInput {
  name: string;
  email: string;
  password: string;
  ward?: string;
}

export interface OfficerRegisterInput {
  name: string;
  email: string;
  password: string;
  ward: string;
  department: string;
  inviteCode: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
}

export interface OtpRequestInput {
  identifier: string;
  method: 'EMAIL' | 'SMS';
  purpose: 'REGISTER' | 'LOGIN';
}

export interface OtpVerifyInput {
  identifier: string;
  method: 'EMAIL' | 'SMS';
  purpose: 'REGISTER' | 'LOGIN';
  code: string;
  name?: string; // required for REGISTER
  ward?: string;
}
