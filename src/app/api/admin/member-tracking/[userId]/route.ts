import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabase } from '@/lib/supabase'
import { getAuthenticatedUser, createErrorResponse, createSuccessResponse } from '@/lib/api-utils'

// GET: 特定会員のトラッキングデータを取得
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const user = await getAuthenticatedUser()
    
    if (!user) {
      return createErrorResponse('認証が必要です', 401)
    }

    if (!user.isAdmin) {
      return createErrorResponse('管理者権限が必要です', 403)
    }

    const { userId } = params

    // 年次目標を取得
    const { data: yearlyGoals, error: yearlyError } = await supabase
      .from('yearly_goals')
      .select('*')
      .eq('user_id', userId)
      .order('year', { ascending: false })

    if (yearlyError) throw yearlyError

    // 月次目標を取得
    const { data: monthlyGoals, error: monthlyError } = await supabase
      .from('monthly_goals')
      .select('*')
      .eq('user_id', userId)
      .order('year', { ascending: false })
      .order('month', { ascending: false })

    if (monthlyError) throw monthlyError

    // 体重記録を取得
    const { data: weightRecords, error: weightError } = await supabase
      .from('weight_records')
      .select('*')
      .eq('user_id', userId)
      .order('recorded_date', { ascending: false })

    if (weightError) throw weightError

    // SQ記録を取得
    const { data: squatRecords, error: squatError } = await supabase
      .from('squat_records')
      .select('*')
      .eq('user_id', userId)
      .order('recorded_date', { ascending: false })

    if (squatError) throw squatError

    return createSuccessResponse({
      yearlyGoals: yearlyGoals || [],
      monthlyGoals: monthlyGoals || [],
      weightRecords: weightRecords || [],
      squatRecords: squatRecords || []
    })
  } catch (error) {
    console.error('Member tracking API error:', error)
    return createErrorResponse('Internal server error', 500)
  }
}