import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-config'
import { supabaseAdmin } from '@/lib/supabase'

// GET: 特定会員のトラッキングデータを取得
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userIdが必要です' }, { status: 400 })
    }

    // 年次目標を取得
    const { data: yearlyGoals, error: yearlyError } = await supabaseAdmin
      .from('yearly_goals')
      .select('*')
      .eq('user_id', userId)
      .order('year', { ascending: false })

    // 月次目標を取得
    const { data: monthlyGoals, error: monthlyError } = await supabaseAdmin
      .from('monthly_goals')
      .select('*')
      .eq('user_id', userId)
      .order('year', { ascending: false })
      .order('month', { ascending: false })

    // 体重記録を取得
    const { data: weightRecords, error: weightError } = await supabaseAdmin
      .from('weight_records')
      .select('*')
      .eq('user_id', userId)
      .order('recorded_date', { ascending: false })

    // SQ記録を取得
    const { data: squatRecords, error: squatError } = await supabaseAdmin
      .from('squat_records')
      .select('*')
      .eq('user_id', userId)
      .order('recorded_date', { ascending: false })

    if (yearlyError || monthlyError || weightError || squatError) {
      console.error('Data fetch error:', { yearlyError, monthlyError, weightError, squatError })
      return NextResponse.json({ error: 'データの取得に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({
      yearlyGoals: yearlyGoals || [],
      monthlyGoals: monthlyGoals || [],
      weightRecords: weightRecords || [],
      squatRecords: squatRecords || [],
    })
  } catch (error) {
    console.error('Tracking data fetch error:', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}

// POST: トラッキングデータを追加
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    const body = await request.json()
    const { type, userId, data } = body

    if (!type || !userId || !data) {
      return NextResponse.json({ error: '必要なパラメータが不足しています' }, { status: 400 })
    }

    let result
    let error

    switch (type) {
      case 'yearly_goal':
        ({ data: result, error } = await supabaseAdmin
          .from('yearly_goals')
          .insert({ user_id: userId, ...data })
          .select()
          .single())
        break

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
        return NextResponse.json({ error: '無効なtypeです' }, { status: 400 })
    }

    if (error) {
      console.error('Insert error:', error)
      return NextResponse.json({ error: 'データの保存に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('Tracking data insert error:', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}

// DELETE: トラッキングデータを削除
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    const body = await request.json()
    const { type, id } = body

    if (!type || !id) {
      return NextResponse.json({ error: '必要なパラメータが不足しています' }, { status: 400 })
    }

    let error

    switch (type) {
      case 'yearly_goal':
        ({ error } = await supabaseAdmin.from('yearly_goals').delete().eq('id', id))
        break

      case 'monthly_goal':
        ({ error } = await supabaseAdmin.from('monthly_goals').delete().eq('id', id))
        break

      case 'weight_record':
        ({ error } = await supabaseAdmin.from('weight_records').delete().eq('id', id))
        break

      case 'squat_record':
        ({ error } = await supabaseAdmin.from('squat_records').delete().eq('id', id))
        break

      default:
        return NextResponse.json({ error: '無効なtypeです' }, { status: 400 })
    }

    if (error) {
      console.error('Delete error:', error)
      return NextResponse.json({ error: 'データの削除に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Tracking data delete error:', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}

// PUT: トラッキングデータを更新
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    const body = await request.json()
    const { type, id, data } = body

    if (!type || !id || !data) {
      return NextResponse.json({ error: '必要なパラメータが不足しています' }, { status: 400 })
    }

    let result
    let error

    switch (type) {
      case 'yearly_goal':
        ({ data: result, error } = await supabaseAdmin
          .from('yearly_goals')
          .update(data)
          .eq('id', id)
          .select()
          .single())
        break

      case 'monthly_goal':
        ({ data: result, error } = await supabaseAdmin
          .from('monthly_goals')
          .update(data)
          .eq('id', id)
          .select()
          .single())
        break

      case 'weight_record':
        ({ data: result, error } = await supabaseAdmin
          .from('weight_records')
          .update(data)
          .eq('id', id)
          .select()
          .single())
        break

      case 'squat_record':
        ({ data: result, error } = await supabaseAdmin
          .from('squat_records')
          .update(data)
          .eq('id', id)
          .select()
          .single())
        break

      default:
        return NextResponse.json({ error: '無効なtypeです' }, { status: 400 })
    }

    if (error) {
      console.error('Update error:', error)
      return NextResponse.json({ error: 'データの更新に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('Tracking data update error:', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
