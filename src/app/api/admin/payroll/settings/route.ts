import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth, handleApiError } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (auth instanceof NextResponse) return auth

    const body = await request.json()
    const trainerId = typeof body?.trainerId === 'string' ? body.trainerId : ''
    const dailyTransportationCost = Number.isFinite(Number(body?.dailyTransportationCost))
      ? Math.max(0, Math.floor(Number(body.dailyTransportationCost)))
      : null
    const breakRuleThresholdMinutes = Number.isFinite(Number(body?.breakRuleThresholdMinutes))
      ? Math.max(0, Math.floor(Number(body.breakRuleThresholdMinutes)))
      : null
    const breakRuleMinutes = Number.isFinite(Number(body?.breakRuleMinutes))
      ? Math.max(0, Math.floor(Number(body.breakRuleMinutes)))
      : null
    const hourlyWage = Number.isFinite(Number(body?.hourlyWage))
      ? Math.max(0, Math.floor(Number(body.hourlyWage)))
      : null
    const hourlyWageEffectiveFrom = typeof body?.hourlyWageEffectiveFrom === 'string' && body.hourlyWageEffectiveFrom
      ? body.hourlyWageEffectiveFrom
      : null

    if (!trainerId) {
      return NextResponse.json({ error: 'スタッフを指定してください' }, { status: 400 })
    }

    const trainerUpdates: Record<string, number> = {}
    if (dailyTransportationCost !== null) trainerUpdates.daily_transportation_cost = dailyTransportationCost
    if (breakRuleThresholdMinutes !== null) trainerUpdates.break_rule_threshold_minutes = breakRuleThresholdMinutes
    if (breakRuleMinutes !== null) trainerUpdates.break_rule_minutes = breakRuleMinutes

    if (Object.keys(trainerUpdates).length > 0) {
      const { error } = await supabaseAdmin
        .from('trainers')
        .update(trainerUpdates)
        .eq('id', trainerId)
      if (error) throw error
    }

    if (hourlyWage !== null && hourlyWageEffectiveFrom) {
      const { data: existingRate, error: existingRateError } = await supabaseAdmin
        .from('trainer_pay_rates')
        .select('id')
        .eq('trainer_id', trainerId)
        .eq('effective_from', hourlyWageEffectiveFrom)
        .maybeSingle()
      if (existingRateError) throw existingRateError

      if (existingRate?.id) {
        const { error } = await supabaseAdmin
          .from('trainer_pay_rates')
          .update({ hourly_wage: hourlyWage })
          .eq('id', existingRate.id)
        if (error) throw error
      } else {
        const { error } = await supabaseAdmin
          .from('trainer_pay_rates')
          .insert({
            trainer_id: trainerId,
            hourly_wage: hourlyWage,
            effective_from: hourlyWageEffectiveFrom
          })
        if (error) throw error
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'Admin payroll settings POST')
  }
}
