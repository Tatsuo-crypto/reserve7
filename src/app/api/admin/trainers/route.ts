import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
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
      .select('id, full_name, email, store_id, status, phone, notes, created_at, updated_at, access_token')
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
    const rawFullName = body?.fullName
    const rawEmail = body?.email
    const rawStoreId = body?.storeId
    const status = body?.status ?? 'active'
    const phone = body?.phone
    const notes = body?.notes

    const fullName = typeof rawFullName === 'string' ? rawFullName.trim() : ''
    const email = typeof rawEmail === 'string' ? rawEmail.trim() : ''
    const storeId = typeof rawStoreId === 'string' ? rawStoreId.trim() : ''

    const missing: string[] = []
    if (!fullName) missing.push('氏名')
    if (!email) missing.push('メール')
    if (!storeId) missing.push('担当店舗')
    if (missing.length > 0) {
      console.warn('Admin trainers POST missing fields:', { body, parsed: { fullName, email, storeId } })
      return NextResponse.json({ error: `${missing.join('、')} は必須です` }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('trainers')
      .insert({ full_name: fullName, email, store_id: storeId, status, phone, notes })
      .select('id, full_name, email, store_id, status, phone, notes, created_at, updated_at, access_token')
      .single()

    if (error) throw error

    return NextResponse.json({ trainer: data })
  } catch (error) {
    return handleApiError(error, 'Admin trainers POST')
  }
}
