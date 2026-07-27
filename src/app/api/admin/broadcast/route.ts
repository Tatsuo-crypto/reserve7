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
      .select('id, title, body, important, target_count, success_count, created_at')
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
      return createErrorResponse('プッシュ通知が設定されていないため配信できません(VAPIDキー未設定)', 500)
    }

    const body = await request.json()
    const title = (body.title || '').trim()
    const message = (body.body || '').trim()
    const important = !!body.important

    if (!title || !message) {
      return createErrorResponse('タイトルと本文を入力してください', 400)
    }

    const { data: users, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, access_token')
      .eq('push_notification_enabled', true)
      .not('access_token', 'is', null)
      .neq('email', 'tandjgym@gmail.com')
      .neq('email', 'tandjgym2goutenn@gmail.com')

    if (usersError) return createErrorResponse('送信対象会員の取得に失敗しました', 500)

    const targetUsers = users || []
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
