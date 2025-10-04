import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabase } from '@/lib/supabase'
import { requireAdminAuth, handleApiError } from '@/lib/api-utils'

// PUT /api/admin/trainers/[id] - update trainer fields
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdminAuth()
    if (auth instanceof NextResponse) return auth

    const body = await request.json()
    const { fullName, email, storeId, status, phone, notes } = body

    const updates: any = {}
    if (typeof fullName === 'string') updates.full_name = fullName
    if (typeof email === 'string') updates.email = email
    if (typeof storeId === 'string') updates.store_id = storeId
    if (typeof status === 'string') updates.status = status
    if (typeof phone === 'string' || phone === null) updates.phone = phone
    if (typeof notes === 'string' || notes === null) updates.notes = notes

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: '更新対象のフィールドがありません' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('trainers')
      .update(updates)
      .eq('id', params.id)
      .select('id, full_name, email, store_id, status, phone, notes, created_at, updated_at')
      .single()

    if (error) throw error

    return NextResponse.json({ trainer: data })
  } catch (error) {
    return handleApiError(error, 'Admin trainers PUT')
  }
}

// PATCH /api/admin/trainers/[id] - toggle or set status
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
      // toggle from current
      const { data: cur, error: fetchErr } = await supabase
        .from('trainers')
        .select('status')
        .eq('id', params.id)
        .single()
      if (fetchErr || !cur) {
        return NextResponse.json({ error: '対象のトレーナーが見つかりません' }, { status: 404 })
      }
      newStatus = (cur.status === 'active' ? 'inactive' : 'active')
    }

    const { data, error } = await supabase
      .from('trainers')
      .update({ status: newStatus })
      .eq('id', params.id)
      .select('id, full_name, email, store_id, status, phone, notes, created_at, updated_at')
      .single()

    if (error) throw error

    return NextResponse.json({ trainer: data })
  } catch (error) {
    return handleApiError(error, 'Admin trainers PATCH')
  }
}

// DELETE /api/admin/trainers/[id] - delete a trainer
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdminAuth()
    if (auth instanceof NextResponse) return auth

    const { data, error } = await supabase
      .from('trainers')
      .delete()
      .eq('id', params.id)
      .select('id')
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, id: data?.id })
  } catch (error) {
    return handleApiError(error, 'Admin trainers DELETE')
  }
}
