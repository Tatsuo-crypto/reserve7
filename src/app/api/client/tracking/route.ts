import { NextRequest } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-utils'

// GET: 会員自身のトラッキングデータを取得（トークンベース）
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

    console.log('=== Debug Info ===')
    console.log('User ID:', userId)
    console.log('Token:', token)

    // 年次目標を取得
    const { data: yearlyGoals, error: yearlyError } = await supabaseAdmin
      .from('yearly_goals')
      .select('*')
      .eq('user_id', userId)
      .order('year', { ascending: false })

    console.log('Yearly goals:', yearlyGoals)
    console.log('Yearly goals error:', yearlyError)

    if (yearlyError) {
      console.error('Yearly goals error:', yearlyError)
    }

    // 月次目標を取得
    const { data: monthlyGoals, error: monthlyError } = await supabaseAdmin
      .from('monthly_goals')
      .select('*')
      .eq('user_id', userId)
      .order('year', { ascending: false })
      .order('month', { ascending: false })

    console.log('Monthly goals:', monthlyGoals)
    console.log('Monthly goals error:', monthlyError)

    if (monthlyError) {
      console.error('Monthly goals error:', monthlyError)
    }

    // 体重記録を取得
    const { data: weightRecords, error: weightError } = await supabaseAdmin
      .from('weight_records')
      .select('*')
      .eq('user_id', userId)
      .order('recorded_date', { ascending: false })
      .limit(50)

    console.log('Weight records:', weightRecords)
    console.log('Weight records error:', weightError)

    if (weightError) {
      console.error('Weight records error:', weightError)
    }

    // SQ記録を取得
    const { data: squatRecords, error: squatError } = await supabaseAdmin
      .from('squat_records')
      .select('*')
      .eq('user_id', userId)
      .order('recorded_date', { ascending: false })
      .limit(50)

    console.log('Squat records:', squatRecords)
    console.log('Squat records error:', squatError)

    if (squatError) {
      console.error('Squat records error:', squatError)
    }

    console.log('=== Returning data ===')
    console.log('Total items:', {
      yearly: yearlyGoals?.length || 0,
      monthly: monthlyGoals?.length || 0,
      weight: weightRecords?.length || 0,
      squat: squatRecords?.length || 0
    })

    return createSuccessResponse({
      yearlyGoals: yearlyGoals || [],
      monthlyGoals: monthlyGoals || [],
      weightRecords: weightRecords || [],
      squatRecords: squatRecords || []
    })
  } catch (error) {
    console.error('Client tracking API error:', error)
    return createErrorResponse('Internal server error', 500)
  }
}

// POST: 会員が自分のトラッキングデータを追加
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, type, data } = body

    if (!token || !type || !data) {
      return createErrorResponse('必要なパラメータが不足しています', 400)
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
    let result
    let error

    switch (type) {
      case 'monthly_goal':
        ({ data: result, error } = await supabaseAdmin
          .from('monthly_goals')
          .insert({ user_id: userId, ...data })
          .select()
          .single())
        break

      case 'weight_record':
        ({ data: result, error } = await supabaseAdmin
          .from('weight_records')
          .insert({ user_id: userId, ...data })
          .select()
          .single())
        break

      case 'squat_record':
        ({ data: result, error } = await supabaseAdmin
          .from('squat_records')
          .insert({ user_id: userId, ...data })
          .select()
          .single())
        break

      default:
        return createErrorResponse('無効なtypeです', 400)
    }

    if (error) {
      console.error('Insert error:', error)
      return createErrorResponse('データの保存に失敗しました', 500)
    }

    return createSuccessResponse({ data: result })
  } catch (error) {
    console.error('Client tracking POST error:', error)
    return createErrorResponse('Internal server error', 500)
  }
}

// PUT: 会員が自分のトラッキングデータを更新
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, type, id, data } = body

    if (!token || !type || !id || !data) {
      return createErrorResponse('必要なパラメータが不足しています', 400)
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
    let result
    let error

    switch (type) {
      case 'yearly_goal':
        ({ data: result, error } = await supabaseAdmin
          .from('yearly_goals')
          .update(data)
          .eq('id', id)
          .eq('user_id', userId) // 自分のデータのみ更新可能
          .select()
          .single())
        break

      case 'monthly_goal':
        ({ data: result, error } = await supabaseAdmin
          .from('monthly_goals')
          .update(data)
          .eq('id', id)
          .eq('user_id', userId)
          .select()
          .single())
        break

      case 'weight_record':
        ({ data: result, error } = await supabaseAdmin
          .from('weight_records')
          .update(data)
          .eq('id', id)
          .eq('user_id', userId)
          .select()
          .single())
        break

      case 'squat_record':
        ({ data: result, error } = await supabaseAdmin
          .from('squat_records')
          .update(data)
          .eq('id', id)
          .eq('user_id', userId)
          .select()
          .single())
        break

      default:
        return createErrorResponse('無効なtypeです', 400)
    }

    if (error) {
      console.error('Update error:', error)
      return createErrorResponse('データの更新に失敗しました', 500)
    }

    return createSuccessResponse({ data: result })
  } catch (error) {
    console.error('Client tracking PUT error:', error)
    return createErrorResponse('Internal server error', 500)
  }
}

// DELETE: 会員が自分のトラッキングデータを削除
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, type, id } = body

    if (!token || !type || !id) {
      return createErrorResponse('必要なパラメータが不足しています', 400)
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
    let error

    switch (type) {
      case 'monthly_goal':
        ({ error } = await supabaseAdmin
          .from('monthly_goals')
          .delete()
          .eq('id', id)
          .eq('user_id', userId)) // 自分のデータのみ削除可能
        break

      case 'weight_record':
        ({ error } = await supabaseAdmin
          .from('weight_records')
          .delete()
          .eq('id', id)
          .eq('user_id', userId))
        break

      case 'squat_record':
        ({ error } = await supabaseAdmin
          .from('squat_records')
          .delete()
          .eq('id', id)
          .eq('user_id', userId))
        break

      default:
        return createErrorResponse('無効なtypeです', 400)
    }

    if (error) {
      console.error('Delete error:', error)
      return createErrorResponse('データの削除に失敗しました', 500)
    }

    return createSuccessResponse({ success: true })
  } catch (error) {
    console.error('Client tracking DELETE error:', error)
    return createErrorResponse('Internal server error', 500)
  }
}