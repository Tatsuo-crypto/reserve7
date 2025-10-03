import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAdminAuth, handleApiError } from '@/lib/api-utils'

// PUT /api/admin/stores/[id]
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdminAuth()
    if (auth instanceof NextResponse) return auth

    const body = await request.json()
    const { name, email, calendarId, status, address, phone } = body

    const updates: any = {}
    if (typeof name === 'string') updates.name = name
    if (typeof calendarId === 'string') updates.calendar_id = calendarId
    if (typeof email === 'string' || email === null) updates.email = email
    if (typeof status === 'string') updates.status = status
    if (typeof address === 'string' || address === null) updates.address = address
    if (typeof phone === 'string' || phone === null) updates.phone = phone

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: '更新対象のフィールドがありません' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('stores')
      .update(updates)
      .eq('id', params.id)
      .select('id, name, email, calendar_id, status, address, phone, created_at, updated_at')
      .single()

    if (error) throw error

    return NextResponse.json({ store: data })
  } catch (error) {
    return handleApiError(error, 'Admin stores PUT')
  }
}

// PATCH /api/admin/stores/[id] - toggle or set status
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdminAuth()
    if (auth instanceof NextResponse) return auth

    let newStatus: 'active' | 'inactive' | null = null
    try {
      const body = await request.json().catch(() => null)
      if (body && body.status && (body.status === 'active' || body.status === 'inactive')) {
        newStatus = body.status
      }
    } catch {}

    if (!newStatus) {
      const { data: cur, error: fetchErr } = await supabase
        .from('stores')
        .select('status')
        .eq('id', params.id)
        .single()
      if (fetchErr || !cur) {
        return NextResponse.json({ error: '対象の店舗が見つかりません' }, { status: 404 })
      }
      newStatus = (cur.status === 'active' ? 'inactive' : 'active')
    }

    const { data, error } = await supabase
      .from('stores')
      .update({ status: newStatus })
      .eq('id', params.id)
      .select('id, name, calendar_id, status, address, phone, created_at, updated_at')
      .single()

    if (error) throw error

    return NextResponse.json({ store: data })
  } catch (error) {
    return handleApiError(error, 'Admin stores PATCH')
  }
}
