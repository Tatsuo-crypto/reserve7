import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { autoBreakMinutes } from '@/lib/payroll'

export const dynamic = 'force-dynamic'

type TrainerRow = {
  id: string
  full_name: string
  store_id: string
  break_rule_threshold_minutes?: number | null
  break_rule_minutes?: number | null
}

type ShiftRow = {
  id: string
  start_time: string
  end_time: string
}

type ShiftTemplateRow = {
  id: string
  trainer_id: string
  day_of_week: number
  start_time: string
  end_time: string
}

type ShiftTemplateExceptionRow = {
  trainer_id: string
  template_id: string | null
  work_date: string
  start_time: string
  end_time: string
}

type AttendanceRow = {
  id: string
  trainer_id: string
  shift_id: string | null
  work_date: string
  scheduled_start: string | null
  scheduled_end: string | null
  clock_in: string
  clock_out: string
  break_minutes: number
  attended?: boolean
}

function tokyoToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
}

function dayRange(date: string) {
  return {
    startIso: new Date(`${date}T00:00:00+09:00`).toISOString(),
    endIso: new Date(`${date}T24:00:00+09:00`).toISOString()
  }
}

function addDays(date: string, days: number) {
  const base = new Date(`${date}T00:00:00+09:00`)
  base.setDate(base.getDate() + days)
  return base.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
}

function normalizeTime(value: string) {
  return value.slice(0, 8)
}

function buildTemplateShiftsForDate(
  trainerId: string,
  date: string,
  templates: ShiftTemplateRow[],
  exceptions: ShiftTemplateExceptionRow[],
  existingShifts: ShiftRow[]
): ShiftRow[] {
  const dayOfWeek = new Date(`${date}T00:00:00+09:00`).getDay()

  return templates
    .filter(template => template.trainer_id === trainerId && template.day_of_week === dayOfWeek)
    .flatMap(template => {
      const startTime = normalizeTime(template.start_time)
      const endTime = normalizeTime(template.end_time)

      const isDeleted = exceptions.some(exception => (
        exception.trainer_id === trainerId &&
        exception.work_date === date &&
        (exception.template_id ? exception.template_id === template.id : true) &&
        normalizeTime(exception.start_time) === startTime &&
        normalizeTime(exception.end_time) === endTime
      ))

      if (isDeleted) return []

      const startIso = new Date(`${date}T${startTime}+09:00`).toISOString()
      const endIso = new Date(`${date}T${endTime}+09:00`).toISOString()
      const hasOverlap = existingShifts.some(shift => (
        new Date(startIso).getTime() < new Date(shift.end_time).getTime() &&
        new Date(endIso).getTime() > new Date(shift.start_time).getTime()
      ))

      if (hasOverlap) return []

      return [{
        id: `template:${template.id}:${date}`,
        start_time: startIso,
        end_time: endIso
      }]
    })
}

function isMissingColumnError(error: any) {
  const message = `${error?.message || ''} ${error?.details || ''}`
  return message.includes('break_rule') || message.includes('attended')
}

async function verifyTrainerToken(token: string | null): Promise<TrainerRow | null> {
  if (!token) return null

  const result = await supabaseAdmin
    .from('trainers')
    .select('id, full_name, store_id, break_rule_threshold_minutes, break_rule_minutes')
    .eq('access_token', token)
    .eq('status', 'active')
    .single()

  if (!result.error && result.data) return result.data as TrainerRow

  if (!isMissingColumnError(result.error)) return null

  const fallback = await supabaseAdmin
    .from('trainers')
    .select('id, full_name, store_id')
    .eq('access_token', token)
    .eq('status', 'active')
    .single()

  if (fallback.error || !fallback.data) return null
  return fallback.data as TrainerRow
}

function breakRuleFor(trainer: TrainerRow) {
  return {
    thresholdMinutes: trainer.break_rule_threshold_minutes ?? 480,
    breakMinutes: trainer.break_rule_minutes ?? 120
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    const requestedDate = searchParams.get('date') || tokyoToday()
    const trainer = await verifyTrainerToken(token)

    if (!trainer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rangeStart = dayRange(requestedDate).startIso
    const rangeEnd = dayRange(addDays(requestedDate, 30)).endIso

    const [
      shiftsResult,
      templatesResult,
      exceptionsResult,
      attendanceResult
    ] = await Promise.all([
      supabaseAdmin
        .from('trainer_shifts')
        .select('id, start_time, end_time')
        .eq('trainer_id', trainer.id)
        .gte('start_time', rangeStart)
        .lt('start_time', rangeEnd)
        .order('start_time'),
      supabaseAdmin
        .from('trainer_shift_templates')
        .select('id, trainer_id, day_of_week, start_time, end_time')
        .eq('trainer_id', trainer.id)
        .order('day_of_week'),
      supabaseAdmin
        .from('trainer_shift_template_exceptions')
        .select('trainer_id, template_id, work_date, start_time, end_time')
        .eq('trainer_id', trainer.id)
        .gte('work_date', requestedDate)
        .lte('work_date', addDays(requestedDate, 30)),
      supabaseAdmin
        .from('trainer_attendance_records')
        .select('id, trainer_id, shift_id, work_date, scheduled_start, scheduled_end, clock_in, clock_out, break_minutes, attended')
        .eq('trainer_id', trainer.id)
        .gte('work_date', requestedDate)
        .lte('work_date', addDays(requestedDate, 30))
    ])

    const shifts = (shiftsResult as { data: ShiftRow[] | null, error: any }).data || []
    const shiftError = (shiftsResult as { data: ShiftRow[] | null, error: any }).error
    if (shiftError) throw shiftError
    if ((templatesResult as { error: any }).error) throw (templatesResult as { error: any }).error
    if ((exceptionsResult as { error: any }).error) throw (exceptionsResult as { error: any }).error

    const templates = ((templatesResult as { data: ShiftTemplateRow[] | null }).data || [])
    const exceptions = ((exceptionsResult as { data: ShiftTemplateExceptionRow[] | null }).data || [])

    let attendance = (attendanceResult as { data: AttendanceRow[] | null, error: any }).data || []
    const attendanceError = (attendanceResult as { data: AttendanceRow[] | null, error: any }).error

    if (attendanceError) {
      if (!isMissingColumnError(attendanceError)) throw attendanceError
      const fallbackAttendance = await supabaseAdmin
        .from('trainer_attendance_records')
        .select('id, trainer_id, shift_id, work_date, scheduled_start, scheduled_end, clock_in, clock_out, break_minutes')
        .eq('trainer_id', trainer.id)
        .gte('work_date', requestedDate)
        .lte('work_date', addDays(requestedDate, 30))
      if (fallbackAttendance.error) throw fallbackAttendance.error
      attendance = (fallbackAttendance.data || []).map(row => ({ ...row, attended: false })) as AttendanceRow[]
    }

    let date = requestedDate
    for (let offset = 0; offset <= 30; offset += 1) {
      const candidate = addDays(requestedDate, offset)
      const candidateRange = dayRange(candidate)
      const manualShifts = shifts.filter(shift => (
        shift.start_time >= candidateRange.startIso &&
        shift.start_time < candidateRange.endIso
      ))
      const templateShifts = buildTemplateShiftsForDate(trainer.id, candidate, templates, exceptions, manualShifts)

      if (manualShifts.length + templateShifts.length > 0 || offset === 30) {
        date = candidate
        break
      }
    }

    const selectedRange = dayRange(date)
    const selectedManualShifts = shifts.filter(shift => (
      shift.start_time >= selectedRange.startIso &&
      shift.start_time < selectedRange.endIso
    ))
    const selectedTemplateShifts = buildTemplateShiftsForDate(trainer.id, date, templates, exceptions, selectedManualShifts)
    const selectedShifts = [...selectedManualShifts, ...selectedTemplateShifts]

    const selectedAttendance = attendance.filter(row => row.work_date === date)
    const attendanceByShift = new Map(
      selectedAttendance
        .filter(row => row.shift_id)
        .map(row => [row.shift_id as string, row])
    )
    const attendanceByScheduledStart = new Map(
      selectedAttendance
        .filter(row => row.scheduled_start)
        .map(row => [row.scheduled_start as string, row])
    )

    const items = selectedShifts.map(shift => {
      const record = shift.id.startsWith('template:')
        ? attendanceByScheduledStart.get(shift.start_time)
        : attendanceByShift.get(shift.id)
      return {
        id: shift.id,
        startTime: shift.start_time,
        endTime: shift.end_time,
        attendanceId: record?.id || null,
        attended: record?.attended === true
      }
    })

    return NextResponse.json({
      trainer: {
        id: trainer.id,
        name: trainer.full_name,
        storeId: trainer.store_id
      },
      date,
      shifts: items
    })
  } catch (error) {
    console.error('Trainer attendance GET error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const token = typeof body?.token === 'string' ? body.token : ''
    const shiftId = typeof body?.shiftId === 'string' ? body.shiftId : ''
    const startTime = typeof body?.startTime === 'string' ? body.startTime : ''
    const endTime = typeof body?.endTime === 'string' ? body.endTime : ''
    const attended = body?.attended === true
    const trainer = await verifyTrainerToken(token)

    if (!trainer || !shiftId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let shift: { id: string | null, start_time: string, end_time: string } | null = null

    if (shiftId.startsWith('template:')) {
      if (!startTime || !endTime) {
        return NextResponse.json({ error: 'Missing template time' }, { status: 400 })
      }
      shift = {
        id: null,
        start_time: startTime,
        end_time: endTime
      }
    } else {
      const { data: savedShift, error: shiftError } = await supabaseAdmin
        .from('trainer_shifts')
        .select('id, trainer_id, start_time, end_time')
        .eq('id', shiftId)
        .single()

      if (shiftError || !savedShift || savedShift.trainer_id !== trainer.id) {
        return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
      }

      shift = savedShift
    }

    const workDate = new Date(shift.start_time).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
    if (workDate !== tokyoToday()) {
      return NextResponse.json({ error: 'Attendance can only be changed on the work date' }, { status: 403 })
    }

    const breakMinutes = autoBreakMinutes(shift.start_time, shift.end_time, breakRuleFor(trainer))

    const payload = {
      trainer_id: trainer.id,
      shift_id: shift.id,
      work_date: workDate,
      scheduled_start: shift.start_time,
      scheduled_end: shift.end_time,
      clock_in: shift.start_time,
      clock_out: shift.end_time,
      break_minutes: breakMinutes,
      transportation_enabled: true,
      attended
    }

    const existing = shift.id
      ? await supabaseAdmin
          .from('trainer_attendance_records')
          .select('id')
          .eq('shift_id', shift.id)
          .maybeSingle()
      : await supabaseAdmin
          .from('trainer_attendance_records')
          .select('id')
          .eq('trainer_id', trainer.id)
          .eq('work_date', workDate)
          .eq('scheduled_start', shift.start_time)
          .maybeSingle()

    const save = existing.data?.id
      ? await supabaseAdmin
          .from('trainer_attendance_records')
          .update(payload)
          .eq('id', existing.data.id)
      : await supabaseAdmin
          .from('trainer_attendance_records')
          .insert(payload)

    if (save.error) {
      if (!isMissingColumnError(save.error)) throw save.error
      const { attended: _attended, ...fallbackPayload } = payload
      const fallbackSave = existing.data?.id
        ? await supabaseAdmin
            .from('trainer_attendance_records')
            .update(fallbackPayload)
            .eq('id', existing.data.id)
        : await supabaseAdmin
            .from('trainer_attendance_records')
            .insert(fallbackPayload)
      if (fallbackSave.error) throw fallbackSave.error
    }

    return NextResponse.json({ success: true, attended })
  } catch (error) {
    console.error('Trainer attendance POST error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
