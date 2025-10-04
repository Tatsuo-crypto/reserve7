import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { requireAdminAuth, handleApiError } from '@/lib/api-utils'

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

    const { data, error } = await q
    if (error) throw error

    const stores = data ?? []
    const calendarIds = stores.map((s: any) => s.calendar_id)
    let memberCounts: Record<string, number> = {}
    if (calendarIds.length > 0) {
      try {
        const idsText = calendarIds.map((x: any) => String(x))
        const { data: counts, error: rpcErr } = await supabase.rpc('members_count_by_store', { store_ids: idsText })
        if (rpcErr) throw rpcErr
        memberCounts = (counts || []).reduce((acc: any, row: any) => {
          acc[row.store_id] = row.member_count
          return acc
        }, {})
      } catch (e) {
        console.error('members_count_by_store RPC failed:', e)
      }
    }

    const result = stores.map((s: any) => ({ ...s, memberCount: memberCounts[s.calendar_id] || 0 }))
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
