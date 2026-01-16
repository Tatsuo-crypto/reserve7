import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth, handleApiError } from '@/lib/api-utils'

// GET /api/admin/shifts
// List shifts with filters
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(request.url)
    const trainerId = searchParams.get('trainerId')
    const storeId = searchParams.get('storeId')
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    if ((!trainerId && !storeId) || !start || !end) {
      return NextResponse.json({ error: 'Missing required parameters (trainerId OR storeId, start, end)' }, { status: 400 })
    }

    let query = supabaseAdmin
      .from('trainer_shifts')
      .select('*, trainer:trainers(id, full_name, store_id)')
      .gte('end_time', start)
      .lte('start_time', end)
      .order('start_time')

    if (trainerId) {
      query = query.eq('trainer_id', trainerId)
    } else if (storeId) {
      // First find all trainers in this store
      const { data: trainers } = await supabaseAdmin
        .from('trainers')
        .select('id')
        .eq('store_id', storeId)
      
      if (!trainers || trainers.length === 0) {
        return NextResponse.json({ shifts: [] })
      }
      
      const trainerIds = trainers.map(t => t.id)
      query = query.in('trainer_id', trainerIds)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ shifts: data })
  } catch (error) {
    return handleApiError(error, 'Admin shifts GET')
  }
}

// POST /api/admin/shifts
// Create a single shift
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (auth instanceof NextResponse) return auth

    const body = await request.json()
    const { trainerId, startTime, endTime } = body

    if (!trainerId || !startTime || !endTime) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('trainer_shifts')
      .insert({
        trainer_id: trainerId,
        start_time: startTime,
        end_time: endTime
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ shift: data })
  } catch (error) {
    return handleApiError(error, 'Admin shifts POST')
  }
}
