/**
 * Common type definitions used across the application
 */

export interface User {
  id: string
  full_name: string
  email: string
  store_id: number
  status?: 'active' | 'suspended' | 'withdrawn'
  created_at: string
}

export interface Reservation {
  id: string
  client_id: string
  title: string
  start: string
  end: string
  notes?: string
  calendar_id: number
  external_event_id?: string
  created_at: string
  client?: {
    full_name: string
    email: string
  }
}

export interface ApiResponse<T = any> {
  data?: T
  error?: string
  message?: string
}

export interface SessionUser {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'USER'
  store_id: number
}

export type UserStatus = 'active' | 'suspended' | 'withdrawn'

export type SessionDuration = 30 | 60 | 90 | 120

export interface ReservationFormData {
  clientId: string
  date: string
  startTime: string
  duration: SessionDuration
  notes?: string
}
