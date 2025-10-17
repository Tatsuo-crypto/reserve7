/**
 * T&J GYM Reservation System - Type Definitions
 * 共通型定義ファイル
 */

// ==============================
// User & Member Types
// ==============================

export type UserStatus = 'active' | 'suspended' | 'withdrawn';

export interface Store {
  id: string;
  name: string;
}

export interface Member {
  id: string;
  full_name: string;
  email: string;
  plan?: string;
  status?: UserStatus;
  store_id: string;
  monthly_fee?: number;
  created_at: string;
  memo?: string;
  access_token?: string;
  stores?: Store;
}

export interface Trainer {
  id: string;
  name: string;
  email: string;
  storeId: string;
  token?: string;
  created_at?: string;
}

// ==============================
// Reservation Types
// ==============================

export interface Reservation {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  client_id: string | null;
  calendar_id: string;
  event_id?: string;
  created_at: string;
  client?: {
    id: string;
    full_name: string;
    plan?: string;
  };
}

// ==============================
// Authentication Types
// ==============================

export type UserRole = 'ADMIN' | 'TRAINER';

export interface AuthUser {
  email: string;
  role: UserRole;
  storeId: string;
  isAdmin: boolean;
}

// ==============================
// API Response Types
// ==============================

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface MembersResponse {
  members: Member[];
}

export interface ReservationsResponse {
  reservations: Reservation[];
}

// ==============================
// Form Types
// ==============================

export interface MemberFormData {
  fullName: string;
  email: string;
  plan?: string;
  status?: UserStatus;
  storeId: string;
  monthlyFee?: number;
  memo?: string;
}

export interface ReservationFormData {
  date: string;
  startTime: string;
  endTime: string;
  clientId: string | null;
  calendarId: string;
}
