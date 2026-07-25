import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { requireAdminAuth, handleApiError } from '@/lib/api-utils'
import { format } from 'date-fns'

// AJ-2: users.statusを直接見るのではなく、/api/admin/membersと同じ
// deriveCurrentStatus(membership_historyの最新レコードから真の在籍状態を導出する)を使う。
function deriveCurrentStatus(
  rawStatus: string | null | undefined,
  histories: { status: string; start_date: string; end_date: string | null }[],
  today: string
): string {
  const latest = histories
    .filter((h) => h.start_date <= today)
    .sort((a, b) => b.start_date.localeCompare(a.start_date))[0]

  if (!latest) return rawStatus || 'active'
  if (latest.status === 'withdrawn') return 'withdrawn'
  if (latest.status === 'active' && latest.end_date && latest.end_date < today) return 'withdrawn'
  if (latest.status === 'suspended' && latest.end_date && latest.end_date < today) return 'withdrawn'

  return latest.status || rawStatus || 'active'
}

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
    // AJ-2: 「会員数」は都度(プラン)・休会・退会の人を含めない。真の在籍状態はusers.statusを
    // 直接見ず、membership_historyから導出する(/api/admin/membersと同じ考え方)。
    let memberCounts: Record<string, number> = {}
    try {
      const { data: users, error: usersError } = await runSupabaseQuery((signal) =>
        supabase
          .from('users')
          .select('id, store_id, status, email, plan')
          .abortSignal(signal)
      )

      if (usersError) throw usersError

      const adminEmails = ['tandjgym@gmail.com', 'tandjgym2goutenn@gmail.com'] // 除外する管理者メール
      const userIds = (users || []).map((u: any) => u.id)

      const { data: historyRows } = userIds.length
        ? await runSupabaseQuery((signal) =>
            supabase
              .from('membership_history')
              .select('user_id, status, start_date, end_date')
              .in('user_id', userIds)
              .abortSignal(signal)
          )
        : { data: [] as any[] }

      const historiesByUserId = new Map<string, { status: string; start_date: string; end_date: string | null }[]>()
      for (const h of historyRows || []) {
        const list = historiesByUserId.get(h.user_id) || []
        list.push(h)
        historiesByUserId.set(h.user_id, list)
      }
      const todayStr = format(new Date(), 'yyyy-MM-dd')

      if (users) {
        users.forEach((u: any) => {
          if (!u.store_id || adminEmails.includes(u.email)) return
          if (u.plan === '都度') return

          const derived = deriveCurrentStatus(u.status, historiesByUserId.get(u.id) || [], todayStr)
          if (derived === 'active') {
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
