import { NextRequest } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabase } from '@/lib/supabase'
import { getAuthenticatedUser, createErrorResponse, createSuccessResponse } from '@/lib/api-utils'

// POST: 年次目標を作成または更新
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    
    if (!user) {
      return createErrorResponse('認証が必要です', 401)
    }

    if (!user.isAdmin) {
      return createErrorResponse('管理者権限が必要です', 403)
    }

    const { userId, year, goalText } = await request.json()

    if (!userId || !year || !goalText) {
      return createErrorResponse('必須項目が不足しています', 400)
    }

    // Upsert: 存在すれば更新、存在しなければ挿入
    const { data, error } = await supabase
      .from('yearly_goals')
      .upsert({
        user_id: userId,
        year,
        goal_text: goalText
      }, {
        onConflict: 'user_id,year'
      })
      .select()

    if (error) throw error

    return createSuccessResponse({ goal: data })
  } catch (error) {
    console.error('Yearly goals API error:', error)
    return createErrorResponse('Internal server error', 500)
  }
}