import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * AX-2: 会員がアプリ内で通知を読み返すためのAPI。
 * 会員画面は magic-link 方式(users.access_token)なので、他のclient系APIと同じく
 * トークンからユーザーを解決する。
 */
async function resolveUserByToken(token: string | null) {
  if (!token) return null
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('access_token', token)
    .maybeSingle()
  if (error || !data) return null
  return data
}

// GET /api/client/notifications?token=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const user = await resolveUserByToken(searchParams.get('token'))
    if (!user) {
      return NextResponse.json({ error: '無効なトークンです' }, { status: 401 })
    }

    const { data, error } = await supabaseAdmin
      .from('user_notifications')
      .select('id, title, body, url, category, read_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Failed to fetch notifications:', error)
      return NextResponse.json({ notifications: [], unreadCount: 0 })
    }

    const notifications = data || []
    const unreadCount = notifications.filter(n => !n.read_at).length

    return NextResponse.json({ notifications, unreadCount })
  } catch (error) {
    console.error('client notifications GET error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

/**
 * PATCH /api/client/notifications?token=xxx
 * body: { id } で1件、または { all: true } でまとめて既読にする。
 */
export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const user = await resolveUserByToken(searchParams.get('token'))
    if (!user) {
      return NextResponse.json({ error: '無効なトークンです' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const now = new Date().toISOString()

    let query = supabaseAdmin
      .from('user_notifications')
      .update({ read_at: now })
      .eq('user_id', user.id)
      .is('read_at', null)

    if (!body.all) {
      if (!body.id) {
        return NextResponse.json({ error: 'idまたはallを指定してください' }, { status: 400 })
      }
      query = query.eq('id', body.id)
    }

    const { error } = await query

    if (error) {
      console.error('Failed to mark notifications as read:', error)
      return NextResponse.json({ error: '既読にできませんでした' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('client notifications PATCH error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
