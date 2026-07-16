import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth, handleApiError } from '@/lib/api-utils'

const JST_OFFSET_MS = 9 * 60 * 60 * 1000

function toJstDateString(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  const jst = new Date(date.getTime() + JST_OFFSET_MS)
  return jst.toISOString().slice(0, 10)
}

function normalizeTime(value: string) {
  return value.length === 5 ? `${value}:00` : value
}

function isMissingTableError(error: any) {
  return error?.code === '42P01' || String(error?.message || '').includes('trainer_shift_template_exceptions')
}

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
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    let trainerIds: string[] = []
    if (trainerId) {
      trainerIds = [trainerId]
    } else if (storeId) {
      const { data: trainers, error: trainersError } = await supabaseAdmin
        .from('trainers')
        .select('id')
        .eq('store_id', storeId)

      if (trainersError) throw trainersError
      trainerIds = (trainers || []).map(trainer => trainer.id)
    }

    if (trainerIds.length === 0) {
      return NextResponse.json({ exceptions: [] })
    }

    const { data, error } = await supabaseAdmin
      .from('trainer_shift_template_exceptions')
      .select('*')
      .in('trainer_id', trainerIds)
      .gte('work_date', toJstDateString(start))
      .lte('work_date', toJstDateString(end))
      .order('work_date')

    if (error) {
      if (isMissingTableError(error)) return NextResponse.json({ exceptions: [] })
      throw error
    }

    return NextResponse.json({ exceptions: data || [] })
  } catch (error) {
    return handleApiError(error, 'Admin shift template exceptions GET')
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (auth instanceof NextResponse) return auth

    const body = await request.json()
    const { trainerId, templateId, workDate, startTime, endTime } = body

    if (!trainerId || !workDate || !startTime || !endTime) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('trainer_shift_template_exceptions')
      .upsert({
        trainer_id: trainerId,
        template_id: templateId || null,
        work_date: workDate,
        start_time: normalizeTime(startTime),
        end_time: normalizeTime(endTime),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'trainer_id,work_date,template_id,start_time,end_time'
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ exception: data })
  } catch (error) {
    return handleApiError(error, 'Admin shift template exceptions POST')
  }
}
