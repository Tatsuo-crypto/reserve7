import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAdminAuth, handleApiError } from '@/lib/api-utils'

// GET /api/admin/trainers?storeId=...&status=active|inactive&query=...
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')
    const status = searchParams.get('status') // active | inactive | all
    const query = searchParams.get('query') // name or email partial

    let q = supabase
      .from('trainers')
      .select('id, full_name, email, store_id, status, phone, notes, created_at, updated_at')
      .order('full_name', { ascending: true })

    if (storeId) q = q.eq('store_id', storeId)
    if (status && status !== 'all') q = q.eq('status', status)
    if (query && query.trim()) {
      // simple ilike on name OR email
      q = q.or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
    }

    const { data, error } = await q
    if (error) throw error

    return NextResponse.json({ trainers: data ?? [] })
  } catch (error) {
    return handleApiError(error, 'Admin trainers GET')
  }
}

// POST /api/admin/trainers
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (auth instanceof NextResponse) return auth

    const body = await request.json()
    const { fullName, email, storeId, status = 'active', phone, notes } = body

    if (!fullName || !email || !storeId) {
      return NextResponse.json({ error: '氏名、メール、担当店舗は必須です' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('trainers')
      .insert({ full_name: fullName, email, store_id: storeId, status, phone, notes })
      .select('id, full_name, email, store_id, status, phone, notes, created_at, updated_at')
      .single()

    if (error) throw error

    return NextResponse.json({ trainer: data })
  } catch (error) {
    return handleApiError(error, 'Admin trainers POST')
  }
}
