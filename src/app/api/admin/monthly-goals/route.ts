import { NextRequest } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabase } from '@/lib/supabase'
import { getAuthenticatedUser, createErrorResponse, createSuccessResponse } from '@/lib/api-utils'

// POST: 月次目標を作成または更新
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    
    if (!user) {
      return createErrorResponse('認証が必要です', 401)
    }

    if (!user.isAdmin) {
      return createErrorResponse('管理者権限が必要です', 403)
    }

    const { userId, year, month, goalText } = await request.json()

    if (!userId || !year || !month || !goalText) {
      return createErrorResponse('必須項目が不足しています', 400)
    }

    const { data, error } = await supabase
      .from('monthly_goals')
      .upsert({
        user_id: userId,
        year,
        month,
        goal_text: goalText
      }, {
        onConflict: 'user_id,year,month'
      })
      .select()

    if (error) throw error

    return createSuccessResponse({ goal: data })
  } catch (error) {
    console.error('Monthly goals API error:', error)
    return createErrorResponse('Internal server error', 500)
  }
}