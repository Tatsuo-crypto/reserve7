import { z } from 'zod';

const envSchema = z.object({
  // Database
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  
  // Authentication
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(1),
  
  // Admin configuration
  ADMIN_EMAILS: z.string().min(1),
  
  // Google Calendar (optional for now)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALENDAR_ID: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_KEY: z.string().optional(),
});

export const env = {
  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY!,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL!,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET!,
  ADMIN_EMAILS: process.env.ADMIN_EMAILS || '',
  GOOGLE_CALENDAR_ID: process.env.GOOGLE_CALENDAR_ID,
  GOOGLE_SERVICE_ACCOUNT_KEY: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
}

// Debug environment variables (remove in production)
// console.log('Environment variables loaded:')
// console.log('GOOGLE_CALENDAR_ID:', env.GOOGLE_CALENDAR_ID)
// console.log('GOOGLE_SERVICE_ACCOUNT_KEY exists:', !!env.GOOGLE_SERVICE_ACCOUNT_KEY)
// console.log('GOOGLE_SERVICE_ACCOUNT_KEY length:', env.GOOGLE_SERVICE_ACCOUNT_KEY?.length)

export function isAdminEmail(email: string): boolean {
  const adminEmails = env.ADMIN_EMAILS.split(',').map(e => e.trim().toLowerCase());
  return adminEmails.includes(email.toLowerCase());
}

export const isAdmin = isAdminEmail;
