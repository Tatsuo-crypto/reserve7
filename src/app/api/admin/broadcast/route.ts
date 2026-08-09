import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth, createErrorResponse } from '@/lib/api-utils'
import { sendPushNotificationToUser, isPushConfigured } from '@/lib/push'

export const dynamic = 'force-dynamic'

// AO-1: 「配信」機能。テンプレートは無し(自由記述のみ)。通知ON(push_notification_enabled=true)の
// 会員全員にアプリのプッシュ通知でお知らせを送る。
export async function GET() {
  try {
    const auth = await requireAdminAuth()
    if (auth instanceof NextResponse) return auth

    const { data, error } = await supabaseAdmin
      .from('broadcast_messages')
      .select('id, title, body, important, target_count, success_count, target_label, created_at')
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) return createErrorResponse('配信履歴の取得に失敗しました', 500)

    return NextResponse.json({ messages: data || [] })
  } catch (error) {
    console.error('broadcast GET error:', error)
    return createErrorResponse('配信履歴の取得に失敗しました', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (auth instanceof NextResponse) return auth

    if (!isPushConfigured()) {
      return createErrorResponse('アプリ通知が設定されていないため配信できません(VAPIDキー未設定)', 500)
    }

    const body = await request.json()
    const title = (body.title || '').trim()
    const message = (body.body || '').trim()
    const important = !!body.important
    // AO-2: 配信先の絞り込み。'all'=通知ON会員全員(既定/後方互換)、'lesson'=特定オンラインレッスンの参加者、
    // 'individual'=個別に選んだ会員のみ。
    const targetMode: 'all' | 'lesson' | 'individual' = body.targetMode || 'all'
    const lessonId: string | undefined = body.lessonId
    const userIds: string[] | undefined = Array.isArray(body.userIds) ? body.userIds : undefined

    if (!title || !message) {
      return createErrorResponse('タイトルと本文を入力してください', 400)
    }

    let targetUsers: Array<{ id: string; access_token: string | null }> = []
    let targetLabel = '全員'

    if (targetMode === 'lesson') {
      if (!lessonId) return createErrorResponse('オンラインレッスンを選択してください', 400)

      const { data: lesson, error: lessonError } = await supabaseAdmin
        .from('online_lessons')
        .select('id, title')
        .eq('id', lessonId)
        .single()

      if (lessonError || !lesson) return createErrorResponse('対象のオンラインレッスンが見つかりませんでした', 404)

      const { data: lessonUsers, error: lessonUsersError } = await supabaseAdmin
        .from('online_lesson_users')
        .select('users (id, access_token, push_notification_enabled)')
        .eq('online_lesson_id', lessonId)

      if (lessonUsersError) return createErrorResponse('送信対象会員の取得に失敗しました', 500)

      let lessonTargetUsers = (lessonUsers || [])
        .map((lu: any) => lu.users)
        .filter((u: any) => u?.push_notification_enabled === true && Boolean(u.access_token))

      // AO-3: 画面側で参加者一覧からチェックを外した人がいる場合、その絞り込みをここでも適用する
      if (userIds && userIds.length > 0) {
        const idSet = new Set(userIds)
        lessonTargetUsers = lessonTargetUsers.filter((u: any) => idSet.has(u.id))
      }

      targetUsers = lessonTargetUsers
      targetLabel = `オンラインレッスン: ${lesson.title}(${targetUsers.length}名)`
    } else if (targetMode === 'individual') {
      if (!userIds || userIds.length === 0) return createErrorResponse('送信する会員を選択してください', 400)

      const { data: selectedUsers, error: selectedError } = await supabaseAdmin
        .from('users')
        .select('id, access_token, push_notification_enabled')
        .in('id', userIds)

      if (selectedError) return createErrorResponse('送信対象会員の取得に失敗しました', 500)

      targetUsers = (selectedUsers || []).filter((u: any) =>
        u?.push_notification_enabled === true && Boolean(u.access_token)
      )
      targetLabel = `個別選択(${targetUsers.length}名)`
    } else {
      const { data: users, error: usersError } = await supabaseAdmin
        .from('users')
        .select('id, access_token')
        .eq('push_notification_enabled', true)
        .not('access_token', 'is', null)
        .neq('email', 'tandjgym@gmail.com')
        .neq('email', 'tandjgym2goutenn@gmail.com')

      if (usersError) return createErrorResponse('送信対象会員の取得に失敗しました', 500)

      targetUsers = users || []
      targetLabel = '全員'
    }

    if (targetUsers.length === 0) {
      return createErrorResponse('アプリ通知が有効な送信対象会員が選択されていないか、登録されていません', 400)
    }

    const finalTitle = important ? `【重要】${title}` : title

    let successCount = 0
    for (const user of targetUsers) {
      try {
        const pushCount = await sendPushNotificationToUser(user.id, {
          title: finalTitle,
          body: message,
          url: `/client/${user.access_token}`,
        })
        if (pushCount > 0) successCount++
      } catch (err) {
        console.error(`Failed to send broadcast to user ${user.id}:`, err)
      }
    }

    await supabaseAdmin.from('broadcast_messages').insert({
      title: finalTitle,
      body: message,
      important,
      target_count: targetUsers.length,
      success_count: successCount,
      target_label: targetLabel,
    })

    return NextResponse.json({
      success: true,
      targetCount: targetUsers.length,
      successCount,
    })
  } catch (error) {
    console.error('broadcast POST error:', error)
    return createErrorResponse('配信の送信に失敗しました', 500)
  }
}
