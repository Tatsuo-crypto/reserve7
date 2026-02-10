import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthenticatedUser, createErrorResponse, createSuccessResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    // Check for token-based authentication (for member-specific URLs)
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    const start = searchParams.get('start')
    const end = searchParams.get('end')
    const queryTrainerId = searchParams.get('trainerId') // Optional: check specific trainer's shift

    let user = null
    let storeId = null

    if (token) {
      // Try finding trainer first (Trainers have shifts)
      const { data: trainerData } = await supabaseAdmin
        .from('trainers')
        .select('id, email, full_name, store_id')
        .eq('access_token', token)
        .eq('status', 'active')
        .single()

      if (trainerData) {
        user = {
          id: trainerData.id,
          email: trainerData.email,
          name: trainerData.full_name,
          isAdmin: false,
          isTrainer: true,
          storeId: trainerData.store_id
        }
        storeId = trainerData.store_id
      } else {
        // Try user (Admin might use token? Or Client?)
        // Clients don't see shifts usually, but if this API is for client booking view too...
        const { data: userData } = await supabaseAdmin
          .from('users')
          .select('id, email, full_name, store_id')
          .eq('access_token', token)
          .single()

        if (userData) {
           user = {
             id: userData.id,
             email: userData.email,
             name: userData.full_name,
             isAdmin: false,
             storeId: userData.store_id
           }
           storeId = userData.store_id
        }
      }

      if (!user) {
        return createErrorResponse('無効なアクセストークンです', 401)
      }
    } else {
      // Session-based authentication
      user = await getAuthenticatedUser()

      if (!user) {
        return createErrorResponse('認証が必要です', 401)
      }
      storeId = user.storeId
    }

    if (!storeId) {
       return createErrorResponse('店舗情報が見つかりません', 400)
    }

    // If trainerId is specified, check that specific trainer's shifts (cross-store)
    // Otherwise, fetch shifts for the current store's trainers
    let trainers: { id: string; full_name: string; email: string }[] = []

    if (queryTrainerId) {
      const { data: trainerData, error: trainerError } = await supabaseAdmin
        .from('trainers')
        .select('id, full_name, email')
        .eq('id', queryTrainerId)
        .eq('status', 'active')
      if (trainerError) {
        console.error('Trainer fetch error:', trainerError)
        return createErrorResponse('トレーナー情報の取得に失敗しました', 500)
      }
      trainers = trainerData || []
    } else {
      const { data: trainerData, error: trainerError } = await supabaseAdmin
        .from('trainers')
        .select('id, full_name, email')
        .eq('store_id', storeId)
        .eq('status', 'active')
      if (trainerError) {
        console.error('Trainer fetch error:', trainerError)
        return createErrorResponse('トレーナー情報の取得に失敗しました', 500)
      }
      trainers = trainerData || []
    }

    const trainerIds = trainers.map(t => t.id)

    if (trainerIds.length === 0) {
      return createSuccessResponse({ shifts: [], templates: [], trainers: [] })
    }

    let query = supabaseAdmin
      .from('trainer_shifts')
      .select(`
        id,
        trainer_id,
        start_time,
        end_time,
        created_at,
        trainer:trainers (
          id,
          full_name
        )
      `)
      .in('trainer_id', trainerIds)
      .order('start_time', { ascending: true })

    if (start) {
      query = query.gte('end_time', start)
    }
    if (end) {
      query = query.lte('start_time', end)
    }

    const { data: shifts, error: shiftsError } = await query

    if (shiftsError) {
      console.error('Shifts fetch error:', shiftsError)
      return createErrorResponse('シフトの取得に失敗しました', 500)
    }

    // Fetch templates for these trainers
    const { data: templates, error: templatesError } = await supabaseAdmin
      .from('trainer_shift_templates')
      .select(`
        id,
        trainer_id,
        day_of_week,
        start_time,
        end_time,
        trainer:trainers (
          id,
          full_name
        )
      `)
      .in('trainer_id', trainerIds)

    if (templatesError) {
      console.error('Templates fetch error:', templatesError)
      // Don't fail the whole request if templates fail, just return empty? 
      // Or fail? Better to log and return empty or fail. 
      // Let's return what we have but log it.
    }

    return createSuccessResponse({
      shifts: shifts.map(s => ({
        id: s.id,
        trainerId: s.trainer_id,
        trainerName: (s.trainer as any)?.full_name,
        startTime: s.start_time,
        endTime: s.end_time
      })),
      templates: (templates || []).map(t => ({
        id: t.id,
        trainerId: t.trainer_id,
        trainerName: (t.trainer as any)?.full_name,
        dayOfWeek: t.day_of_week,
        startTime: t.start_time,
        endTime: t.end_time
      })),
      trainers: trainers.map(t => ({
        id: t.id,
        name: t.full_name,
        email: t.email
      }))
    })

  } catch (error) {
    console.error('Shifts API error:', error)
    return createErrorResponse('サーバーエラーが発生しました', 500)
  }
}
