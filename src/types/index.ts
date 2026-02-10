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
  billing_start_month?: string;
  created_at: string;
  memo?: string;
  access_token?: string;
  stores?: Store;
}

export interface Trainer {
  id: string;
  name: string;
  full_name?: string; // Added to match DB column
  email: string;
  storeId: string;
  store_id?: string; // Added to match DB column
  token?: string;
  created_at?: string;
  google_calendar_id?: string; // Added for calendar sync
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

// ==============================
// Shift Management Types
// ==============================

export interface ShiftTemplate {
  id: string;
  trainer_id: string;
  day_of_week: number; // 0=Sunday, 1=Monday, ...
  start_time: string; // "HH:MM:SS"
  end_time: string; // "HH:MM:SS"
  created_at?: string;
  updated_at?: string;
}

export interface Shift {
  id: string;
  trainer_id: string;
  start_time: string; // ISO String
  end_time: string; // ISO String
  created_at?: string;
  updated_at?: string;
  trainer?: {
    id: string;
    full_name: string;
  };
}
