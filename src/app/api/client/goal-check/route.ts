import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

// GET: 本日のチェック状況とストリーク情報を取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return createErrorResponse('トークンが必要です', 400)
    }

    // トークンからユーザーIDを取得
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('access_token', token)
      .single()

    if (userError || !user) {
      return createErrorResponse('無効なトークンです', 401)
    }

    const userId = user.id
    const today = new Date().toISOString().split('T')[0]
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1

    // 今月の目標を取得
    const { data: monthlyGoals } = await supabaseAdmin
      .from('monthly_goals')
      .select('id, goal_text')
      .eq('user_id', userId)
      .eq('year', currentYear)
      .eq('month', currentMonth)

    if (!monthlyGoals || monthlyGoals.length === 0) {
      return createSuccessResponse({
        checks: [],
        streak: null,
        monthlyGoals: []
      })
    }

    // 本日のチェック状況を取得
    const { data: checks } = await supabaseAdmin
      .from('daily_goal_checks')
      .select('monthly_goal_id')
      .eq('user_id', userId)
      .eq('check_date', today)

    const checkedGoalIds = checks?.map(c => c.monthly_goal_id) || []

    // ストリーク情報を取得
    const { data: streak } = await supabaseAdmin
      .from('goal_streaks')
      .select('*')
      .eq('user_id', userId)
      .eq('year', currentYear)
      .eq('month', currentMonth)
      .single()

    return createSuccessResponse({
      checks: checkedGoalIds,
      streak: streak || { current_streak: 0, max_streak: 0, total_rewards: 0 },
      monthlyGoals: monthlyGoals.map(goal => ({
        id: goal.id,
        text: goal.goal_text,
        checked: checkedGoalIds.includes(goal.id)
      }))
    })
  } catch (error) {
    console.error('Goal check GET error:', error)
    return createErrorResponse('Internal server error', 500)
  }
}

// POST: 目標をチェック/アンチェック
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    const body = await request.json()
    const { goalId, checked } = body

    if (!token || !goalId) {
      return createErrorResponse('トークンと目標IDが必要です', 400)
    }

    // トークンからユーザーIDを取得
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('access_token', token)
      .single()

    if (userError || !user) {
      return createErrorResponse('無効なトークンです', 401)
    }

    const userId = user.id
    const today = new Date().toISOString().split('T')[0]
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1

    if (checked) {
      // チェックを追加
      const { error: insertError } = await supabaseAdmin
        .from('daily_goal_checks')
        .insert({
          user_id: userId,
          monthly_goal_id: goalId,
          check_date: today
        })

      if (insertError) {
        console.error('Insert check error:', insertError)
        return createErrorResponse('チェックの追加に失敗しました', 500)
      }
    } else {
      // チェックを削除
      const { error: deleteError } = await supabaseAdmin
        .from('daily_goal_checks')
        .delete()
        .eq('user_id', userId)
        .eq('monthly_goal_id', goalId)
        .eq('check_date', today)

      if (deleteError) {
        console.error('Delete check error:', deleteError)
        return createErrorResponse('チェックの削除に失敗しました', 500)
      }
    }

    // 本日の全チェック状況を確認
    const { data: todayChecks } = await supabaseAdmin
      .from('daily_goal_checks')
      .select('monthly_goal_id')
      .eq('user_id', userId)
      .eq('check_date', today)

    // 今月の目標数を取得
    const { data: monthlyGoals } = await supabaseAdmin
      .from('monthly_goals')
      .select('id')
      .eq('user_id', userId)
      .eq('year', currentYear)
      .eq('month', currentMonth)

    const totalGoals = monthlyGoals?.length || 0
    const checkedCount = todayChecks?.length || 0
    const isCompleted = totalGoals > 0 && checkedCount === totalGoals

    let streak = null
    let reward = 0

    if (isCompleted) {
      // 全ての目標がチェックされた場合、ストリークを更新
      const { data: existingStreak } = await supabaseAdmin
        .from('goal_streaks')
        .select('*')
        .eq('user_id', userId)
        .eq('year', currentYear)
        .eq('month', currentMonth)
        .single()

      const yesterday = new Date(now)
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]

      let newStreak = 1
      let newMaxStreak = 1

      if (existingStreak) {
        // 昨日が達成日かどうか確認
        const isConsecutive = existingStreak.last_completed_date === yesterdayStr
        newStreak = isConsecutive ? existingStreak.current_streak + 1 : 1
        newMaxStreak = Math.max(newStreak, existingStreak.max_streak)
        reward = newStreak // 連続日数 = 報酬ポイント

        const { data: updated } = await supabaseAdmin
          .from('goal_streaks')
          .update({
            current_streak: newStreak,
            max_streak: newMaxStreak,
            last_completed_date: today,
            total_rewards: existingStreak.total_rewards + reward,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingStreak.id)
          .select()
          .single()

        streak = updated
      } else {
        // 新規作成
        reward = 1
        const { data: created } = await supabaseAdmin
          .from('goal_streaks')
          .insert({
            user_id: userId,
            year: currentYear,
            month: currentMonth,
            current_streak: 1,
            max_streak: 1,
            last_completed_date: today,
            total_rewards: reward
          })
          .select()
          .single()

        streak = created
      }
    } else {
      // 全てチェックされていない場合、現在のストリーク情報を取得
      const { data: currentStreak } = await supabaseAdmin
        .from('goal_streaks')
        .select('*')
        .eq('user_id', userId)
        .eq('year', currentYear)
        .eq('month', currentMonth)
        .single()

      streak = currentStreak
    }

    return createSuccessResponse({
      success: true,
      isCompleted,
      checkedCount,
      totalGoals,
      streak,
      reward
    })
  } catch (error) {
    console.error('Goal check POST error:', error)
    return createErrorResponse('Internal server error', 500)
  }
}
