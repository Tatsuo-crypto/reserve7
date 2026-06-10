import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

async function getUserByToken(token: string | null) {
  if (!token) return null

  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('id, push_notification_enabled')
    .eq('access_token', token)
    .eq('status', 'active')
    .single()

  if (error || !user) return null
  return user
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  const user = await getUserByToken(token)

  if (!user) {
    return NextResponse.json({ error: '無効なトークンです' }, { status: 401 })
  }

  const { data: subscriptions, error } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)

  if (error) {
    console.error('Failed to fetch push subscription status:', error)
    return NextResponse.json({ error: '通知設定の確認に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({
    enabledByAdmin: user.push_notification_enabled === true,
    subscribed: (subscriptions || []).length > 0,
  })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const user = await getUserByToken(body.token)

  if (!user) {
    return NextResponse.json({ error: '無効なトークンです' }, { status: 401 })
  }

  const subscription = body.subscription
  const endpoint = subscription?.endpoint
  const p256dh = subscription?.keys?.p256dh
  const auth = subscription?.keys?.auth

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: '通知先情報が不足しています' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('push_subscriptions')
    .upsert({
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      user_agent: request.headers.get('user-agent') || null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'endpoint'
    })

  if (error) {
    console.error('Failed to save push subscription:', error)
    return NextResponse.json({ error: '通知設定の保存に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({ success: true, enabledByAdmin: user.push_notification_enabled === true })
}

export async function DELETE(request: NextRequest) {
  const body = await request.json()
  const user = await getUserByToken(body.token)

  if (!user) {
    return NextResponse.json({ error: '無効なトークンです' }, { status: 401 })
  }

  if (!body.endpoint) {
    return NextResponse.json({ error: '通知先情報が不足しています' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', body.endpoint)

  if (error) {
    console.error('Failed to delete push subscription:', error)
    return NextResponse.json({ error: '通知設定の解除に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
