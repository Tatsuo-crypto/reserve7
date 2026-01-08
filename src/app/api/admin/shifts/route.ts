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
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    if (!trainerId || !start || !end) {
      return NextResponse.json({ error: 'Missing required parameters (trainerId, start, end)' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('trainer_shifts')
      .select('*')
      .eq('trainer_id', trainerId)
      .gte('end_time', start) // Shifts ending after query start
      .lte('start_time', end) // Shifts starting before query end
      .order('start_time')

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
