import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth, handleApiError } from '@/lib/api-utils'

// GET /api/admin/trainers?storeId=...&status=active|inactive&query=...
export async function GET(request: NextRequest) {
  try {
    // Check authentication (Session or Token)
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    
    let user = null

    if (token) {
      // Trainer token authentication
      const { data: trainer, error } = await supabaseAdmin
        .from('trainers')
        .select('id, full_name, email, store_id')
        .eq('access_token', token)
        .eq('status', 'active')
        .single()

      if (error || !trainer) {
        return NextResponse.json({ error: '無効なトークンです' }, { status: 401 })
      }
      
      // Valid trainer
    } else {
      // Admin session authentication
      const auth = await requireAdminAuth()
      if (auth instanceof NextResponse) return auth
    }

    const storeId = searchParams.get('storeId')
    const status = searchParams.get('status') // active | inactive | all
    const query = searchParams.get('query') // name or email partial

    let q = supabaseAdmin
      .from('trainers')
      .select('id, full_name, email, store_id, status, phone, notes, created_at, updated_at, access_token, google_calendar_id')
      .order('full_name', { ascending: true })

    if (storeId) {
      // storeId could be a UUID or a calendar email - resolve to UUID if needed
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storeId)
      if (isUUID) {
        q = q.eq('store_id', storeId)
      } else {
        // Assume it's a calendar_id (email), resolve to store UUID
        const { data: store } = await supabaseAdmin
          .from('stores')
          .select('id')
          .eq('calendar_id', storeId)
          .single()
        if (store) {
          q = q.eq('store_id', store.id)
        } else {
          q = q.eq('store_id', storeId) // fallback
        }
      }
    }
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
    const googleCalendarId = body?.googleCalendarId

    const fullName = typeof rawFullName === 'string' ? rawFullName.trim() : ''
    const emailStr = typeof rawEmail === 'string' ? rawEmail.trim() : ''
    const email = emailStr === '' ? null : emailStr
    const storeId = typeof rawStoreId === 'string' ? rawStoreId.trim() : ''

    const missing: string[] = []
    if (!fullName) missing.push('氏名')
    // if (!email) missing.push('メール') // Email is now optional
    if (!storeId) missing.push('担当店舗')
    if (missing.length > 0) {
      console.warn('Admin trainers POST missing fields:', { body, parsed: { fullName, email, storeId } })
      return NextResponse.json({ error: `${missing.join('、')} は必須です` }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('trainers')
      .insert({ 
        full_name: fullName, 
        email, 
        store_id: storeId, 
        status, 
        phone, 
        notes,
        google_calendar_id: googleCalendarId || null
      })
      .select('id, full_name, email, store_id, status, phone, notes, created_at, updated_at, access_token, google_calendar_id')
      .single()

    if (error) throw error

    return NextResponse.json({ trainer: data })
  } catch (error) {
    return handleApiError(error, 'Admin trainers POST')
  }
}
