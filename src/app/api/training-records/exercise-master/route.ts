import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createErrorResponse, resolveTrainerOrAdmin } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

// AN-4: トレーニングカルテの種目マスタ(よく使う種目の選択肢)一覧取得・追加。
// トレーナー・管理者のみが利用する内部データ。

export async function GET(request: NextRequest) {
  try {
    const auth = await resolveTrainerOrAdmin(request)
    if (auth instanceof NextResponse) return auth

    const { data, error } = await supabaseAdmin
      .from('exercise_master')
      .select('id, name, sort_order')
      .order('sort_order', { ascending: true })

    if (error) return createErrorResponse('種目マスタの取得に失敗しました', 500)

    return NextResponse.json({ exercises: data || [] })
  } catch (error) {
    console.error('exercise-master GET error:', error)
    return createErrorResponse('種目マスタの取得に失敗しました', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await resolveTrainerOrAdmin(request)
    if (auth instanceof NextResponse) return auth

    const body = await request.json()
    const name = (body.name || '').trim()
    if (!name) return createErrorResponse('種目名を入力してください', 400)

    const { data: maxRow } = await supabaseAdmin
      .from('exercise_master')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .single()

    const nextSortOrder = (maxRow?.sort_order || 0) + 1

    const { data, error } = await supabaseAdmin
      .from('exercise_master')
      .upsert({ name, sort_order: nextSortOrder }, { onConflict: 'name', ignoreDuplicates: true })
      .select('id, name, sort_order')

    if (error) return createErrorResponse('種目の追加に失敗しました', 500)

    return NextResponse.json({ exercise: data?.[0] || { name } })
  } catch (error) {
    console.error('exercise-master POST error:', error)
    return createErrorResponse('種目の追加に失敗しました', 500)
  }
}
