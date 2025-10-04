import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Service role client for server-side/admin operations only.
// Note: Avoid throwing at import time to keep Next.js build/CI stable.
let cached: SupabaseClient | null = null

function resolveEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'http://localhost:54321'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy'
  return { url, key }
}

export const supabaseAdmin: SupabaseClient = (() => {
  const { url, key } = resolveEnv()
  // This will create a client even with dummy values on CI; handlers that actually call it
  // are protected by auth and dynamic routes, so they won't run during build.
  return createClient(url, key)
})()
