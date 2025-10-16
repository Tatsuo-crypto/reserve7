import { NextRequest } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabase } from '@/lib/supabase'
import { getAuthenticatedUser, createErrorResponse, createSuccessResponse } from '@/lib/api-utils'

// POST: SQ記録を作成または更新
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    
    if (!user) {
      return createErrorResponse('認証が必要です', 401)
    }

    if (!user.isAdmin) {
      return createErrorResponse('管理者権限が必要です', 403)
    }

    const { userId, recordedDate, weightKg, reps, sets, notes } = await request.json()

    if (!userId || !recordedDate || !weightKg) {
      return createErrorResponse('必須項目が不足しています', 400)
    }

    const { data, error } = await supabase
      .from('squat_records')
      .upsert({
        user_id: userId,
        recorded_date: recordedDate,
        weight_kg: weightKg,
        reps: reps || null,
        sets: sets || null,
        notes: notes || null
      }, {
        onConflict: 'user_id,recorded_date'
      })
      .select()

    if (error) throw error

    return createSuccessResponse({ record: data })
  } catch (error) {
    console.error('Squat records API error:', error)
    return createErrorResponse('Internal server error', 500)
  }
}