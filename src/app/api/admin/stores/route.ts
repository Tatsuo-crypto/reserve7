import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { requireAdminAuth, handleApiError } from '@/lib/api-utils'

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

// GET /api/admin/stores?status=active|inactive&query=...
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // active | inactive | all
    const query = searchParams.get('query')

    let q = supabase
      .from('stores')
      .select('id, name, email, calendar_id, status, address, phone, created_at, updated_at')
      .order('name', { ascending: true })

    if (status && status !== 'all') q = q.eq('status', status)
    if (query && query.trim()) {
      q = q.or(`name.ilike.%${query}%,calendar_id.ilike.%${query}%`)
    }

    const { data, error } = await runSupabaseQuery((signal) => q.abortSignal(signal))
    if (error) throw error

    const stores = data ?? []
    const storeIds = stores.map((s: any) => s.id)
    // Fetch user counts directly to avoid RPC issues
    let memberCounts: Record<string, number> = {}
    try {
      const { data: users, error: usersError } = await runSupabaseQuery((signal) =>
        supabase
          .from('users')
          .select('store_id, status, email')
          .abortSignal(signal)
      )

      if (usersError) throw usersError

      const adminEmails = ['tandjgym@gmail.com', 'tandjgym2goutenn@gmail.com'] // 除外する管理者メール

      if (users) {
        users.forEach((u: any) => {
          // 「現在在籍（active）」のみカウント。nullはレガシーデータとしてactive扱い
          // 管理者アカウントは除外
          if (u.store_id &&
            (!u.status || u.status === 'active') &&
            !adminEmails.includes(u.email)
          ) {
            memberCounts[u.store_id] = (memberCounts[u.store_id] || 0) + 1
          }
        })
      }
    } catch (e) {
      console.error('Failed to count members:', e)
    }

    const result = stores.map((s: any) => ({ ...s, memberCount: memberCounts[s.id] || 0 }))
    return NextResponse.json({ stores: result })
  } catch (error) {
    return handleApiError(error, 'Admin stores GET')
  }
}

// POST /api/admin/stores
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (auth instanceof NextResponse) return auth

    const body = await request.json()
    const { name, email, calendarId, status = 'active', address, phone } = body

    if (!name || !calendarId) {
      return NextResponse.json({ error: '店舗名とカレンダーIDは必須です' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('stores')
      .insert({ name, email, calendar_id: calendarId, status, address, phone })
      .select('id, name, email, calendar_id, status, address, phone, created_at, updated_at')
      .single()

    if (error) throw error

    return NextResponse.json({ store: data })
  } catch (error) {
    return handleApiError(error, 'Admin stores POST')
  }
}
