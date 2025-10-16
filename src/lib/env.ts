import { z } from 'zod';

const envSchema = z.object({
  // Database
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  
  // Authentication
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(1),
  
  // Admin configuration
  ADMIN_EMAILS: z.string().min(1),
  
  // Google Calendar (optional for now)
  GOOGLE_CALENDAR_ID_1: z.string().optional(),
  GOOGLE_CALENDAR_ID_2: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_KEY: z.string().optional(),
});

// In CI, we provide dummy defaults to allow build-time validation to pass.
const rawEnv = {
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'http://localhost:54321',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'dummy_anon',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy_service_role',
  NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'http://localhost:3000',
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || 'dummy_secret_32chars_minimum________________',
  ADMIN_EMAILS: process.env.ADMIN_EMAILS || 'dummy@example.com',
  GOOGLE_CALENDAR_ID_1: process.env.GOOGLE_CALENDAR_ID_1,
  GOOGLE_CALENDAR_ID_2: process.env.GOOGLE_CALENDAR_ID_2,
  GOOGLE_SERVICE_ACCOUNT_KEY: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
}

// Validate environment variables at runtime
export const env = envSchema.parse(rawEnv);

// Calendar configurations
export const CALENDARS = [
  { id: 'tandjgym@gmail.com', name: 'T&J GYM1号店' },
  { id: 'tandjgym2goutenn@gmail.com', name: 'T&J GYM2号店' },
] as const;

// Type-safe calendar configuration
export type CalendarConfig = typeof CALENDARS[number];
