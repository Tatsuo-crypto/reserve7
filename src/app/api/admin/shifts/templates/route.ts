import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth, handleApiError } from '@/lib/api-utils'

type ShiftTemplateInput = {
  dayOfWeek: number
  startTime: string
  endTime: string
}

type StoredShiftTemplate = {
  day_of_week: number
  start_time: string
  end_time: string
}

const JST_OFFSET_MS = 9 * 60 * 60 * 1000

function normalizeTime(value: string) {
  return value.length === 5 ? `${value}:00` : value
}

function templateKey(template: StoredShiftTemplate | ShiftTemplateInput) {
  const dayOfWeek = 'day_of_week' in template ? template.day_of_week : template.dayOfWeek
  const startTime = 'start_time' in template ? template.start_time : template.startTime
  const endTime = 'end_time' in template ? template.end_time : template.endTime
  return `${dayOfWeek}-${normalizeTime(startTime)}-${normalizeTime(endTime)}`
}

function getJstTimeParts(value: string) {
  const jstDate = new Date(new Date(value).getTime() + JST_OFFSET_MS)
  const hh = String(jstDate.getUTCHours()).padStart(2, '0')
  const mm = String(jstDate.getUTCMinutes()).padStart(2, '0')
  const ss = String(jstDate.getUTCSeconds()).padStart(2, '0')
  return {
    dayOfWeek: jstDate.getUTCDay(),
    time: `${hh}:${mm}:${ss}`
  }
}

function shiftMatchesTemplate(shift: any, template: StoredShiftTemplate) {
  const start = getJstTimeParts(shift.start_time)
  const end = getJstTimeParts(shift.end_time)
  return (
    start.dayOfWeek === template.day_of_week &&
    start.time === normalizeTime(template.start_time) &&
    end.time === normalizeTime(template.end_time)
  )
}

async function deleteShiftsForRemovedTemplates(
  trainerId: string,
  previousTemplates: StoredShiftTemplate[],
  nextTemplates: ShiftTemplateInput[]
) {
  const nextKeys = new Set(nextTemplates.map(templateKey))
  const removedTemplates = previousTemplates.filter(template => !nextKeys.has(templateKey(template)))
  if (removedTemplates.length === 0) return

  const { data: futureShifts, error: shiftsError } = await supabaseAdmin
    .from('trainer_shifts')
    .select('id, start_time, end_time')
    .eq('trainer_id', trainerId)
    .gte('start_time', new Date().toISOString())

  if (shiftsError) throw shiftsError

  const shiftIdsToDelete = (futureShifts || [])
    .filter(shift => removedTemplates.some(template => shiftMatchesTemplate(shift, template)))
    .map(shift => shift.id)

  if (shiftIdsToDelete.length === 0) return

  const { error: deleteError } = await supabaseAdmin
    .from('trainer_shifts')
    .delete()
    .in('id', shiftIdsToDelete)

  if (deleteError) throw deleteError
}

// GET /api/admin/shifts/templates?trainerId=...
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(request.url)
    const trainerId = searchParams.get('trainerId')
    const storeId = searchParams.get('storeId')

    if (!trainerId && !storeId) {
      return NextResponse.json({ error: 'Trainer ID or Store ID is required' }, { status: 400 })
    }

    let query = supabaseAdmin
      .from('trainer_shift_templates')
      .select('*, trainers!inner(store_id)')

    if (trainerId) {
      query = query.eq('trainer_id', trainerId)
    } else if (storeId) {
      query = query.eq('trainers.store_id', storeId)
    }

    const { data, error } = await query
      .order('day_of_week')
      .order('start_time')

    if (error) throw error

    return NextResponse.json({ templates: data })
  } catch (error) {
    return handleApiError(error, 'Admin shift templates GET')
  }
}

// POST /api/admin/shifts/templates
// Replace all templates for a trainer
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (auth instanceof NextResponse) return auth

    const body = await request.json()
    const { trainerId, templates } = body

    if (!trainerId || !Array.isArray(templates)) {
      return NextResponse.json({ error: 'Trainer ID and templates array are required' }, { status: 400 })
    }

    const { data: previousTemplates, error: previousTemplatesError } = await supabaseAdmin
      .from('trainer_shift_templates')
      .select('day_of_week, start_time, end_time')
      .eq('trainer_id', trainerId)

    if (previousTemplatesError) throw previousTemplatesError

    // Start a transaction-like operation (delete then insert)
    // Supabase doesn't support transactions in REST API directly like this, but we can do it sequentially
    
    // 1. Delete existing templates for this trainer
    const { error: deleteError } = await supabaseAdmin
      .from('trainer_shift_templates')
      .delete()
      .eq('trainer_id', trainerId)

    if (deleteError) throw deleteError

    await deleteShiftsForRemovedTemplates(
      trainerId,
      (previousTemplates || []) as StoredShiftTemplate[],
      templates as ShiftTemplateInput[]
    )

    // 2. Insert new templates
    if (templates.length > 0) {
      const templatesToInsert = templates.map((t: any) => ({
        trainer_id: trainerId,
        day_of_week: t.dayOfWeek,
        start_time: t.startTime,
        end_time: t.endTime
      }))

      const { error: insertError } = await supabaseAdmin
        .from('trainer_shift_templates')
        .insert(templatesToInsert)

      if (insertError) throw insertError
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'Admin shift templates POST')
  }
}
