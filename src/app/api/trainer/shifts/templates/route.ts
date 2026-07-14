import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'

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

// Helper to verify trainer token
async function verifyTrainerToken(token: string | null) {
  if (!token) return null
  
  const { data: trainer, error } = await supabaseAdmin
    .from('trainers')
    .select('id, full_name, store_id')
    .eq('access_token', token)
    .eq('status', 'active')
    .single()
    
  if (error || !trainer) return null
  return trainer
}

// GET /api/trainer/shifts/templates
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    const trainer = await verifyTrainerToken(token)
    if (!trainer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: templates, error } = await supabaseAdmin
      .from('trainer_shift_templates')
      .select('*')
      .eq('trainer_id', trainer.id)

    if (error) throw error

    return NextResponse.json({ templates })
  } catch (error) {
    console.error('Trainer templates GET error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST /api/trainer/shifts/templates
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, templates } = body

    if (!token || !templates) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    const trainer = await verifyTrainerToken(token)
    if (!trainer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: previousTemplates, error: previousTemplatesError } = await supabaseAdmin
      .from('trainer_shift_templates')
      .select('day_of_week, start_time, end_time')
      .eq('trainer_id', trainer.id)

    if (previousTemplatesError) throw previousTemplatesError

    // Delete existing templates for this trainer
    const { error: deleteError } = await supabaseAdmin
      .from('trainer_shift_templates')
      .delete()
      .eq('trainer_id', trainer.id)

    if (deleteError) throw deleteError

    await deleteShiftsForRemovedTemplates(
      trainer.id,
      (previousTemplates || []) as StoredShiftTemplate[],
      templates as ShiftTemplateInput[]
    )

    // Insert new templates
    if (templates.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('trainer_shift_templates')
        .insert(
          templates.map((t: any) => ({
            trainer_id: trainer.id,
            day_of_week: t.dayOfWeek,
            start_time: t.startTime,
            end_time: t.endTime
          }))
        )

      if (insertError) throw insertError
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Trainer templates POST error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
