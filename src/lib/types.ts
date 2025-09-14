export interface User {
  id: string;
  fullName: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

export interface Reservation {
  id: string;
  clientId: string;
  title: string;
  startTime: Date;
  endTime: Date;
  notes?: string;
  externalEventId?: string;
  createdAt: Date;
}

export interface CreateUserData {
  fullName: string;
  email: string;
  password: string;
}

export interface CreateReservationData {
  clientId: string;
  title: string;
  startTime: Date;
  notes?: string;
}

export type UserRole = 'CLIENT' | 'ADMIN';

export interface AuthUser extends Omit<User, 'passwordHash'> {
  role: UserRole;
}
