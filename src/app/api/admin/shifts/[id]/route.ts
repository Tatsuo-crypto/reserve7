import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth, handleApiError } from '@/lib/api-utils'

// PUT /api/admin/shifts/[id]
// Update a shift
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdminAuth()
    if (auth instanceof NextResponse) return auth

    const body = await request.json()
    const { startTime, endTime } = body

    if (!startTime || !endTime) {
      return NextResponse.json({ error: 'Missing start/end time' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('trainer_shifts')
      .update({
        start_time: startTime,
        end_time: endTime,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ shift: data })
  } catch (error) {
    return handleApiError(error, 'Admin shift PUT')
  }
}

// DELETE /api/admin/shifts/[id]
// Delete a shift
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdminAuth()
    if (auth instanceof NextResponse) return auth

    const { error } = await supabaseAdmin
      .from('trainer_shifts')
      .delete()
      .eq('id', params.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'Admin shift DELETE')
  }
}
