import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth, handleApiError } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(request.url)
    const trainerId = searchParams.get('trainerId')
    const storeId = searchParams.get('storeId')
    const start = searchParams.get('start')
    const end = searchParams.get('end')
    const status = searchParams.get('status')

    if ((!trainerId && !storeId) || !start || !end) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    let query = supabaseAdmin
      .from('trainer_shift_requests')
      .select('*, trainer:trainers(id, full_name, store_id)')
      .gte('end_time', start)
      .lte('start_time', end)
      .order('start_time')

    if (trainerId) {
      query = query.eq('trainer_id', trainerId)
    } else if (storeId) {
      const { data: trainers } = await supabaseAdmin
        .from('trainers')
        .select('id')
        .eq('store_id', storeId)

      if (!trainers || trainers.length === 0) {
        return NextResponse.json({ requests: [] })
      }

      query = query.in('trainer_id', trainers.map(trainer => trainer.id))
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query
    if (error) {
      if ((error as any).code === 'PGRST205') {
        return NextResponse.json({ requests: [] })
      }
      throw error
    }

    return NextResponse.json({ requests: data || [] })
  } catch (error) {
    return handleApiError(error, 'Admin shift requests GET')
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (auth instanceof NextResponse) return auth

    const body = await request.json()
    const { id, status } = body

    if (!id || !['approved', 'rejected', 'cancelled'].includes(status)) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    const { data: requestRow, error: fetchError } = await supabaseAdmin
      .from('trainer_shift_requests')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !requestRow) throw fetchError || new Error('Request not found')

    if (status === 'approved' && requestRow.status !== 'approved') {
      const { error: shiftError } = await supabaseAdmin
        .from('trainer_shifts')
        .insert({
          trainer_id: requestRow.trainer_id,
          start_time: requestRow.start_time,
          end_time: requestRow.end_time
        })

      if (shiftError) throw shiftError
    }

    const { data, error } = await supabaseAdmin
      .from('trainer_shift_requests')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, trainer:trainers(id, full_name, store_id)')
      .single()

    if (error) throw error

    return NextResponse.json({ request: data })
  } catch (error) {
    return handleApiError(error, 'Admin shift requests PATCH')
  }
}
