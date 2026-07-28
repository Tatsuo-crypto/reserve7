import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth, createErrorResponse } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

// AP-1: オンラインレッスンの「その日だけ休講」の登録・解除。
// 繰り返し設定(day_of_week)は触らずに、例外日を1行足す/消すだけで済むようにする。
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(request.url)
    const lessonId = searchParams.get('lessonId')

    // 過去の休講日は表示しても意味が無いので今日以降のみ返す
    const todayJst = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })

    let query = supabaseAdmin
      .from('online_lesson_exceptions')
      .select('id, online_lesson_id, exception_date, reason')
      .gte('exception_date', todayJst)
      .order('exception_date', { ascending: true })

    if (lessonId) query = query.eq('online_lesson_id', lessonId)

    const { data, error } = await query

    if (error) return createErrorResponse('休講日の取得に失敗しました', 500)

    return NextResponse.json({ exceptions: data || [] })
  } catch (error) {
    console.error('online-lesson exceptions GET error:', error)
    return createErrorResponse('休講日の取得に失敗しました', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (auth instanceof NextResponse) return auth

    const body = await request.json()
    const lessonId: string | undefined = body.lessonId
    const exceptionDate: string | undefined = body.exceptionDate
    const reason: string | null = (body.reason || '').trim() || null

    if (!lessonId || !exceptionDate) {
      return createErrorResponse('レッスンと休講日を指定してください', 400)
    }

    const { data, error } = await supabaseAdmin
      .from('online_lesson_exceptions')
      .upsert(
        { online_lesson_id: lessonId, exception_date: exceptionDate, reason },
        { onConflict: 'online_lesson_id,exception_date' }
      )
      .select('id, online_lesson_id, exception_date, reason')
      .single()

    if (error) {
      console.error('Failed to insert online lesson exception:', error)
      return createErrorResponse('休講日の登録に失敗しました', 500)
    }

    return NextResponse.json({ exception: data })
  } catch (error) {
    console.error('online-lesson exceptions POST error:', error)
    return createErrorResponse('休講日の登録に失敗しました', 500)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return createErrorResponse('IDが必要です', 400)

    const { error } = await supabaseAdmin
      .from('online_lesson_exceptions')
      .delete()
      .eq('id', id)

    if (error) return createErrorResponse('休講日の解除に失敗しました', 500)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('online-lesson exceptions DELETE error:', error)
    return createErrorResponse('休講日の解除に失敗しました', 500)
  }
}
