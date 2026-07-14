import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth, handleApiError } from '@/lib/api-utils'
import { sendPushNotificationToUser } from '@/lib/push'

const DAYS_JA = ['日', '月', '火', '水', '木', '金', '土']

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (auth instanceof NextResponse) return auth

    const body = await request.json()
    const { lessonId, userIds } = body

    if (!lessonId) {
      return NextResponse.json({ error: 'レッスンIDが指定されていません' }, { status: 400 })
    }

    // 1. Fetch lesson details
    const { data: lesson, error: lessonError } = await supabaseAdmin
      .from('online_lessons')
      .select('*')
      .eq('id', lessonId)
      .single()

    if (lessonError || !lesson) {
      console.error('Failed to fetch online lesson:', lessonError)
      return NextResponse.json({ error: '対象のオンラインレッスンが見つかりませんでした' }, { status: 404 })
    }

    let validUsers = []

    if (userIds && Array.isArray(userIds) && userIds.length > 0) {
      // 2. Fetch specific users by ID
      const { data: selectedUsers, error: usersError } = await supabaseAdmin
        .from('users')
        .select('id, full_name, access_token, push_notification_enabled')
        .in('id', userIds)

      if (usersError) {
        console.error('Failed to fetch selected users:', usersError)
        return NextResponse.json({ error: '送信対象会員の取得に失敗しました' }, { status: 500 })
      }

      validUsers = (selectedUsers || []).filter((u: any) =>
        u?.push_notification_enabled === true && Boolean(u.access_token)
      )
    } else {
      // 2. Fetch users linked to this specific online lesson
      const { data: lessonUsers, error: usersError } = await supabaseAdmin
        .from('online_lesson_users')
        .select(`
          user_id,
          users (
            id,
            full_name,
            access_token,
            push_notification_enabled
          )
        `)
        .eq('online_lesson_id', lessonId)

      if (usersError) {
        console.error(`Failed to fetch users for online lesson ${lessonId}:`, usersError)
        return NextResponse.json({ error: '送信対象会員の取得に失敗しました' }, { status: 500 })
      }

      validUsers = (lessonUsers || [])
        .map((lu: any) => lu.users)
        .filter((u: any) =>
          u?.push_notification_enabled === true && Boolean(u.access_token)
        )
    }

    if (validUsers.length === 0) {
      return NextResponse.json(
        { error: 'アプリ通知が有効な送信対象会員が選択されていないか、登録されていません。' },
        { status: 400 }
      )
    }

    // 3. Format schedule string
    const days = lesson.day_of_week?.map((d: number) => DAYS_JA[d]).join('・') ?? ''
    const start = lesson.start_time ? lesson.start_time.substring(0, 5) : ''
    const end = lesson.end_time ? lesson.end_time.substring(0, 5) : ''
    const scheduleStr = `毎週${days} ${start}${end ? `〜${end}` : ''}`

    // 4. Send push notifications
    let successCount = 0
    const errors: string[] = []

    for (const user of validUsers) {
      try {
        const pushCount = await sendPushNotificationToUser(user.id, {
          title: 'オンラインレッスンのお知らせ',
          body: `${lesson.title}（${scheduleStr}）のお知らせです。`,
          url: `/client/${user.access_token}?tab=online`
        })
        if (pushCount > 0) successCount++
      } catch (err: any) {
        console.error(`Failed to send announcement to user ${user.id}:`, err)
        errors.push(`${user.full_name}: ${err.message || err}`)
      }
    }

    return NextResponse.json({
      success: true,
      sentCount: successCount,
      totalCount: validUsers.length,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    return handleApiError(error, 'Admin online-lesson announcement POST')
  }
}
