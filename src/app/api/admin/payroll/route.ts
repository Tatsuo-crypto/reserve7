import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth, handleApiError } from '@/lib/api-utils'
import {
  calculatePayrollTotals,
  getPayrollMonthRange,
  PayRate,
  PayrollWorkRow,
  toTokyoDateString
} from '@/lib/payroll'

type TrainerRow = {
  id: string
  full_name: string
  store_id: string
  status: string
  payroll_enabled: boolean
  daily_transportation_cost: number
  trainer_pay_rates?: PayRate[]
}

type ShiftRow = {
  id: string
  trainer_id: string
  start_time: string
  end_time: string
  is_template?: boolean
}

type ShiftTemplateRow = {
  id: string
  trainer_id: string
  day_of_week: number
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
  transportation_enabled: boolean
  memo: string | null
}

type PayrollMonthRow = {
  id: string
  trainer_id: string
  payroll_month: string
  allowance_amount: number
  adjustment_amount: number
  memo: string | null
  status: 'draft' | 'confirmed'
  confirmed_at: string | null
  confirmed_total_amount: number | null
  changed_after_confirm: boolean
}

function buildRows(trainerId: string, shifts: ShiftRow[], attendance: AttendanceRow[]) {
  const byShiftId = new Map<string, AttendanceRow>()
  const manualAttendance: AttendanceRow[] = []
  const consumedManualAttendanceIds = new Set<string>()

  attendance.forEach(row => {
    if (row.trainer_id !== trainerId) return
    if (row.shift_id) byShiftId.set(row.shift_id, row)
    else manualAttendance.push(row)
  })

  const shiftRows = shifts
    .filter(shift => shift.trainer_id === trainerId)
    .map(shift => {
      if (shift.is_template) {
        const savedTemplateAttendance = manualAttendance.find(row => (
          row.scheduled_start === shift.start_time &&
          row.scheduled_end === shift.end_time
        ))

        if (savedTemplateAttendance) {
          consumedManualAttendanceIds.add(savedTemplateAttendance.id)
          return {
            id: savedTemplateAttendance.id,
            shiftId: null,
            workDate: savedTemplateAttendance.work_date,
            scheduledStart: savedTemplateAttendance.scheduled_start,
            scheduledEnd: savedTemplateAttendance.scheduled_end,
            clockIn: savedTemplateAttendance.clock_in,
            clockOut: savedTemplateAttendance.clock_out,
            breakMinutes: savedTemplateAttendance.break_minutes,
            transportationEnabled: savedTemplateAttendance.transportation_enabled,
            memo: savedTemplateAttendance.memo || '',
            source: 'saved' as const
          }
        }

        return {
          id: null,
          shiftId: null,
          workDate: toTokyoDateString(shift.start_time),
          scheduledStart: shift.start_time,
          scheduledEnd: shift.end_time,
          clockIn: shift.start_time,
          clockOut: shift.end_time,
          breakMinutes: 0,
          transportationEnabled: true,
          memo: '',
          source: 'shift' as const
        }
      }

      const saved = byShiftId.get(shift.id)
      if (saved) {
        return {
          id: saved.id,
          shiftId: saved.shift_id,
          workDate: saved.work_date,
          scheduledStart: saved.scheduled_start,
          scheduledEnd: saved.scheduled_end,
          clockIn: saved.clock_in,
          clockOut: saved.clock_out,
          breakMinutes: saved.break_minutes,
          transportationEnabled: saved.transportation_enabled,
          memo: saved.memo || '',
          source: 'saved' as const
        }
      }

      return {
        id: null,
        shiftId: shift.id,
        workDate: toTokyoDateString(shift.start_time),
        scheduledStart: shift.start_time,
        scheduledEnd: shift.end_time,
        clockIn: shift.start_time,
        clockOut: shift.end_time,
        breakMinutes: 0,
        transportationEnabled: true,
        memo: '',
        source: 'shift' as const
      }
    })

  const manualRows = manualAttendance.map(row => ({
    id: row.id,
    shiftId: null,
    workDate: row.work_date,
    scheduledStart: row.scheduled_start,
    scheduledEnd: row.scheduled_end,
    clockIn: row.clock_in,
    clockOut: row.clock_out,
    breakMinutes: row.break_minutes,
    transportationEnabled: row.transportation_enabled,
    memo: row.memo || '',
    source: 'saved' as const
  })).filter(row => !consumedManualAttendanceIds.has(row.id))

  return [...shiftRows, ...manualRows].sort((a, b) => a.clockIn.localeCompare(b.clockIn))
}

function normalizeTime(value: string) {
  return value.slice(0, 8)
}

function buildTemplateShifts(templates: ShiftTemplateRow[], month: string, existingShifts: ShiftRow[]): ShiftRow[] {
  const [year, monthIndex] = month.split('-').map(Number)
  const lastDay = new Date(year, monthIndex, 0).getDate()
  const generated: ShiftRow[] = []

  for (let day = 1; day <= lastDay; day += 1) {
    const dateText = `${month}-${String(day).padStart(2, '0')}`
    const date = new Date(`${dateText}T00:00:00+09:00`)
    const dayOfWeek = date.getDay()

    templates
      .filter(template => template.day_of_week === dayOfWeek)
      .forEach(template => {
        const startTime = normalizeTime(template.start_time)
        const endTime = normalizeTime(template.end_time)
        const startIso = new Date(`${dateText}T${startTime}+09:00`).toISOString()
        const endIso = new Date(`${dateText}T${endTime}+09:00`).toISOString()

        const hasOverlap = existingShifts.some(shift => {
          if (shift.trainer_id !== template.trainer_id) return false
          const shiftStart = new Date(shift.start_time).getTime()
          const shiftEnd = new Date(shift.end_time).getTime()
          const templateStart = new Date(startIso).getTime()
          const templateEnd = new Date(endIso).getTime()
          return templateStart < shiftEnd && templateEnd > shiftStart
        })

        if (hasOverlap) return

        generated.push({
          id: `template:${template.id}:${dateText}`,
          trainer_id: template.trainer_id,
          start_time: startIso,
          end_time: endIso,
          is_template: true
        })
      })
  }

  return generated
}

function toWorkRows(rows: ReturnType<typeof buildRows>): PayrollWorkRow[] {
  return rows.map(row => ({
    work_date: row.workDate,
    clock_in: row.clockIn,
    clock_out: row.clockOut,
    break_minutes: row.breakMinutes,
    transportation_enabled: row.transportationEnabled
  }))
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')
    const storeId = searchParams.get('storeId')
    if (!month) {
      return NextResponse.json({ error: '月を指定してください' }, { status: 400 })
    }

    const range = getPayrollMonthRange(month)

    let trainerQuery = supabaseAdmin
      .from('trainers')
      .select('id, full_name, store_id, status, payroll_enabled, daily_transportation_cost, trainer_pay_rates(hourly_wage, effective_from, effective_to)')
      .eq('payroll_enabled', true)
      .order('full_name', { ascending: true })

    if (storeId && storeId !== 'all') {
      trainerQuery = trainerQuery.eq('store_id', storeId)
    }

    const { data: trainers, error: trainerError } = await trainerQuery
    if (trainerError) throw trainerError

    const trainerRows = (trainers || []) as TrainerRow[]
    const trainerIds = trainerRows.map(trainer => trainer.id)

    if (trainerIds.length === 0) {
      return NextResponse.json({ month, payroll: [] })
    }

    const [{ data: shifts, error: shiftError }, { data: templates, error: templateError }, { data: attendance, error: attendanceError }, { data: payrollMonths, error: payrollError }] = await Promise.all([
      supabaseAdmin
        .from('trainer_shifts')
        .select('id, trainer_id, start_time, end_time')
        .in('trainer_id', trainerIds)
        .gte('end_time', range.startIso)
        .lt('start_time', range.endIso)
        .order('start_time'),
      supabaseAdmin
        .from('trainer_shift_templates')
        .select('id, trainer_id, day_of_week, start_time, end_time')
        .in('trainer_id', trainerIds)
        .order('day_of_week')
        .order('start_time'),
      supabaseAdmin
        .from('trainer_attendance_records')
        .select('id, trainer_id, shift_id, work_date, scheduled_start, scheduled_end, clock_in, clock_out, break_minutes, transportation_enabled, memo')
        .in('trainer_id', trainerIds)
        .gte('work_date', range.monthStartDate)
        .lt('work_date', range.nextMonthStartDate)
        .order('work_date'),
      supabaseAdmin
        .from('trainer_payroll_months')
        .select('id, trainer_id, payroll_month, allowance_amount, adjustment_amount, memo, status, confirmed_at, confirmed_total_amount, changed_after_confirm')
        .in('trainer_id', trainerIds)
        .eq('payroll_month', range.monthStartDate)
    ])

    if (shiftError) throw shiftError
    if (templateError) throw templateError
    if (attendanceError) throw attendanceError
    if (payrollError) throw payrollError

    const shiftRows = (shifts || []) as ShiftRow[]
    const templateRows = buildTemplateShifts((templates || []) as ShiftTemplateRow[], month, shiftRows)
    const scheduledRows = [...shiftRows, ...templateRows]
    const attendanceRows = (attendance || []) as AttendanceRow[]
    const payrollRows = (payrollMonths || []) as PayrollMonthRow[]
    const payrollByTrainer = new Map(payrollRows.map(row => [row.trainer_id, row]))

    const payroll = trainerRows.map(trainer => {
      const monthRow = payrollByTrainer.get(trainer.id)
      const detailRows = buildRows(trainer.id, scheduledRows, attendanceRows)
      const rates = (trainer.trainer_pay_rates || []).sort((a, b) => a.effective_from.localeCompare(b.effective_from))
      const totals = calculatePayrollTotals(
        toWorkRows(detailRows),
        rates,
        trainer.daily_transportation_cost || 0,
        monthRow?.allowance_amount || 0,
        monthRow?.adjustment_amount || 0
      )

      return {
        trainer: {
          id: trainer.id,
          fullName: trainer.full_name,
          storeId: trainer.store_id,
          dailyTransportationCost: trainer.daily_transportation_cost || 0
        },
        rates,
        month: monthRow || null,
        totals,
        rows: detailRows
      }
    })

    return NextResponse.json({ month, payroll })
  } catch (error) {
    return handleApiError(error, 'Admin payroll GET')
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (auth instanceof NextResponse) return auth

    const body = await request.json()
    const trainerId = typeof body?.trainerId === 'string' ? body.trainerId : ''
    const month = typeof body?.month === 'string' ? body.month : ''
    const rows = Array.isArray(body?.rows) ? body.rows : []
    const allowanceAmount = Number.isFinite(Number(body?.allowanceAmount)) ? Math.floor(Number(body.allowanceAmount)) : 0
    const adjustmentAmount = Number.isFinite(Number(body?.adjustmentAmount)) ? Math.floor(Number(body.adjustmentAmount)) : 0
    const memo = typeof body?.memo === 'string' ? body.memo : null
    const status = body?.status === 'confirmed' ? 'confirmed' : 'draft'

    if (!trainerId || !month) {
      return NextResponse.json({ error: 'スタッフと月を指定してください' }, { status: 400 })
    }

    const range = getPayrollMonthRange(month)

    const { data: existingMonth, error: existingMonthError } = await supabaseAdmin
      .from('trainer_payroll_months')
      .select('id, status, confirmed_total_amount')
      .eq('trainer_id', trainerId)
      .eq('payroll_month', range.monthStartDate)
      .maybeSingle()
    if (existingMonthError) throw existingMonthError

    for (const row of rows) {
      const clockIn = typeof row.clockIn === 'string' ? row.clockIn : ''
      const clockOut = typeof row.clockOut === 'string' ? row.clockOut : ''
      const workDate = typeof row.workDate === 'string' ? row.workDate : ''
      if (!clockIn || !clockOut || !workDate) continue

      const payload = {
        trainer_id: trainerId,
        shift_id: typeof row.shiftId === 'string' && row.shiftId ? row.shiftId : null,
        work_date: workDate,
        scheduled_start: typeof row.scheduledStart === 'string' && row.scheduledStart ? row.scheduledStart : null,
        scheduled_end: typeof row.scheduledEnd === 'string' && row.scheduledEnd ? row.scheduledEnd : null,
        clock_in: clockIn,
        clock_out: clockOut,
        break_minutes: Number.isFinite(Number(row.breakMinutes)) ? Math.max(0, Math.floor(Number(row.breakMinutes))) : 0,
        transportation_enabled: row.transportationEnabled !== false,
        memo: typeof row.memo === 'string' && row.memo.trim() ? row.memo.trim() : null
      }

      if (typeof row.id === 'string' && row.id) {
        const { error } = await supabaseAdmin
          .from('trainer_attendance_records')
          .update(payload)
          .eq('id', row.id)
          .eq('trainer_id', trainerId)
        if (error) throw error
      } else {
        const { error } = await supabaseAdmin
          .from('trainer_attendance_records')
          .insert(payload)
        if (error) throw error
      }
    }

    const { data: trainer, error: trainerError } = await supabaseAdmin
      .from('trainers')
      .select('daily_transportation_cost, trainer_pay_rates(hourly_wage, effective_from, effective_to)')
      .eq('id', trainerId)
      .single()
    if (trainerError) throw trainerError

    const { data: savedAttendance, error: savedAttendanceError } = await supabaseAdmin
      .from('trainer_attendance_records')
      .select('work_date, clock_in, clock_out, break_minutes, transportation_enabled')
      .eq('trainer_id', trainerId)
      .gte('work_date', range.monthStartDate)
      .lt('work_date', range.nextMonthStartDate)
    if (savedAttendanceError) throw savedAttendanceError

    const totals = calculatePayrollTotals(
      ((savedAttendance || []) as AttendanceRow[]).map(row => ({
        work_date: row.work_date,
        clock_in: row.clock_in,
        clock_out: row.clock_out,
        break_minutes: row.break_minutes,
        transportation_enabled: row.transportation_enabled
      })),
      ((trainer as any).trainer_pay_rates || []) as PayRate[],
      Number((trainer as any).daily_transportation_cost || 0),
      allowanceAmount,
      adjustmentAmount
    )

    const changedAfterConfirm = existingMonth?.status === 'confirmed' && status !== 'confirmed'
      ? true
      : existingMonth?.status === 'confirmed' && existingMonth.confirmed_total_amount !== totals.totalPay

    const monthPayload = {
      trainer_id: trainerId,
      payroll_month: range.monthStartDate,
      allowance_amount: allowanceAmount,
      adjustment_amount: adjustmentAmount,
      memo,
      status,
      confirmed_at: status === 'confirmed' ? new Date().toISOString() : null,
      confirmed_total_amount: status === 'confirmed' ? totals.totalPay : existingMonth?.confirmed_total_amount || null,
      changed_after_confirm: status === 'confirmed' ? false : Boolean(changedAfterConfirm)
    }

    if (existingMonth?.id) {
      const { error } = await supabaseAdmin
        .from('trainer_payroll_months')
        .update(monthPayload)
        .eq('id', existingMonth.id)
      if (error) throw error
    } else {
      const { error } = await supabaseAdmin
        .from('trainer_payroll_months')
        .insert(monthPayload)
      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'Admin payroll POST')
  }
}
