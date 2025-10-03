import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
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
      .select('id, name, calendar_id, status, address, phone, created_at, updated_at')
      .order('name', { ascending: true })

    if (status && status !== 'all') q = q.eq('status', status)
    if (query && query.trim()) {
      q = q.or(`name.ilike.%${query}%,calendar_id.ilike.%${query}%`)
    }

    const { data, error } = await q
    if (error) throw error

    return NextResponse.json({ stores: data ?? [] })
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
    const { name, calendarId, status = 'active', address, phone } = body

    if (!name || !calendarId) {
      return NextResponse.json({ error: '店舗名とカレンダーIDは必須です' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('stores')
      .insert({ name, calendar_id: calendarId, status, address, phone })
      .select('id, name, calendar_id, status, address, phone, created_at, updated_at')
      .single()

    if (error) throw error

    return NextResponse.json({ store: data })
  } catch (error) {
    return handleApiError(error, 'Admin stores POST')
  }
}
