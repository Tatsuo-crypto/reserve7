import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-config'
import { isAdmin } from '@/lib/auth-utils'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { handleApiError } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

async function runSupabaseQuery<T>(
  operation: (signal: AbortSignal) => PromiseLike<T>,
  attempts = 2,
  timeoutMs = 2500
): Promise<T> {
  let lastResult: any

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    try {
      lastResult = await operation(controller.signal)
    } catch (error) {
      lastResult = { error }
    } finally {
      clearTimeout(timeoutId)
    }

    const message = lastResult?.error?.message || ''

    const shouldRetry = message.includes('fetch failed') || message.includes('aborted')
    if (!shouldRetry || attempt === attempts) {
      return lastResult
    }

    await new Promise(resolve => setTimeout(resolve, 250 * attempt))
  }

  return lastResult
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const email = session?.user?.email?.toLowerCase()

    if (!email) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    if (!isAdmin(email)) {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    const { data, error } = await runSupabaseQuery((signal) =>
      supabase
        .from('stores')
        .select('id, name')
        .eq('status', 'active')
        .order('name', { ascending: true })
        .abortSignal(signal)
    )

    if (error) throw error

    return NextResponse.json({ stores: data ?? [] })
  } catch (error) {
    return handleApiError(error, 'Admin store options GET')
  }
}
