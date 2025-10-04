import { createClient } from '@supabase/supabase-js'

// Service role client for server-side/admin operations only.
// Never import this in client components.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL) {
  throw new Error('SUPABASE_URL is required for supabase-admin client')
}
if (!SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for supabase-admin client')
}

export const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
