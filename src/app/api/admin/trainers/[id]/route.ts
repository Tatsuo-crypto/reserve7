import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth, handleApiError } from '@/lib/api-utils'

// PUT /api/admin/trainers/[id] - update trainer fields
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdminAuth()
    if (auth instanceof NextResponse) return auth

    const body = await request.json()
    const { fullName, email, storeId, status, phone, notes, googleCalendarId } = body

    const updates: any = {}
    if (typeof fullName === 'string') updates.full_name = fullName
    if (typeof email === 'string') {
      const trimmed = email.trim()
      updates.email = trimmed === '' ? null : trimmed
    }
    if (typeof storeId === 'string') updates.store_id = storeId
    if (typeof status === 'string') updates.status = status
    if (typeof phone === 'string' || phone === null) updates.phone = phone
    if (typeof notes === 'string' || notes === null) updates.notes = notes
    if (typeof googleCalendarId === 'string' || googleCalendarId === null) updates.google_calendar_id = googleCalendarId
    if (typeof body?.payrollEnabled === 'boolean') updates.payroll_enabled = body.payrollEnabled
    if (body?.dailyTransportationCost !== undefined) {
      const dailyTransportationCost = Number(body.dailyTransportationCost)
      if (Number.isFinite(dailyTransportationCost)) {
        updates.daily_transportation_cost = Math.max(0, Math.floor(dailyTransportationCost))
      }
    }

    const hourlyWage = body?.hourlyWage === undefined ? null : Number(body.hourlyWage)
    const hourlyWageEffectiveFrom = typeof body?.hourlyWageEffectiveFrom === 'string' ? body.hourlyWageEffectiveFrom : null
    const shouldSaveRate = Number.isFinite(hourlyWage) && hourlyWageEffectiveFrom

    if (Object.keys(updates).length === 0 && !shouldSaveRate) {
      return NextResponse.json({ error: '更新対象のフィールドがありません' }, { status: 400 })
    }

    let data = null
    if (Object.keys(updates).length > 0) {
      const { data: updated, error } = await supabaseAdmin
        .from('trainers')
        .update(updates)
        .eq('id', params.id)
        .select('id, full_name, email, store_id, status, phone, notes, created_at, updated_at, google_calendar_id, payroll_enabled, daily_transportation_cost')
        .single()

      if (error) throw error
      data = updated
    }

    if (shouldSaveRate && hourlyWage !== null) {
      const wage = Math.max(0, Math.floor(hourlyWage))
      const { data: existingRate, error: existingRateError } = await supabaseAdmin
        .from('trainer_pay_rates')
        .select('id')
        .eq('trainer_id', params.id)
        .eq('effective_from', hourlyWageEffectiveFrom)
        .maybeSingle()

      if (existingRateError) throw existingRateError

      if (existingRate?.id) {
        const { error: rateUpdateError } = await supabaseAdmin
          .from('trainer_pay_rates')
          .update({ hourly_wage: wage })
          .eq('id', existingRate.id)
        if (rateUpdateError) throw rateUpdateError
      } else {
        const { error: rateInsertError } = await supabaseAdmin
          .from('trainer_pay_rates')
          .insert({
            trainer_id: params.id,
            hourly_wage: wage,
            effective_from: hourlyWageEffectiveFrom
          })
        if (rateInsertError) throw rateInsertError
      }
    }

    if (!data) {
      const { data: current, error: fetchError } = await supabaseAdmin
        .from('trainers')
        .select('id, full_name, email, store_id, status, phone, notes, created_at, updated_at, google_calendar_id, payroll_enabled, daily_transportation_cost')
        .eq('id', params.id)
        .single()
      if (fetchError) throw fetchError
      data = current
    }

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
      const { data: cur, error: fetchErr } = await supabaseAdmin
        .from('trainers')
        .select('status')
        .eq('id', params.id)
        .single()
      if (fetchErr || !cur) {
        return NextResponse.json({ error: '対象のトレーナーが見つかりません' }, { status: 404 })
      }
      newStatus = (cur.status === 'active' ? 'inactive' : 'active')
    }

    const { data, error } = await supabaseAdmin
      .from('trainers')
      .update({ status: newStatus })
      .eq('id', params.id)
      .select('id, full_name, email, store_id, status, phone, notes, created_at, updated_at, payroll_enabled, daily_transportation_cost')
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

    const { data, error } = await supabaseAdmin
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
