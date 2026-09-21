import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/api-utils'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

async function resolveAdminUserId(email: string) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', email.toLowerCase())
    .maybeSingle()
  if (error || !data) return null
  return data.id as string
}

function memberIdFromUrl(url?: string | null) {
  if (!url) return null
  try {
    return new URL(url, 'https://reserve7.local').searchParams.get('userId')
  } catch {
    return null
  }
}

export async function GET() {
  const auth = await requireAdminAuth()
  if (auth instanceof NextResponse) return auth

  const adminUserId = await resolveAdminUserId(auth.user.email)
  if (!adminUserId) return NextResponse.json({ unreadMemberIds: [], unreadCount: 0 })

  const { data, error } = await supabaseAdmin
    .from('user_notifications')
    .select('url')
    .eq('user_id', adminUserId)
    .eq('category', 'diet_update')
    .is('read_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('admin diet updates GET error:', error)
    return NextResponse.json({ error: '未確認件数を取得できませんでした' }, { status: 500 })
  }

  const unreadMemberIds = Array.from(new Set((data || []).map(item => memberIdFromUrl(item.url)).filter(Boolean)))
  return NextResponse.json({ unreadMemberIds, unreadCount: unreadMemberIds.length })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminAuth()
  if (auth instanceof NextResponse) return auth

  const body = await request.json().catch(() => ({}))
  const memberId = typeof body.memberId === 'string' ? body.memberId : ''
  if (!memberId) return NextResponse.json({ error: '会員を指定してください' }, { status: 400 })

  const adminUserId = await resolveAdminUserId(auth.user.email)
  if (!adminUserId) return NextResponse.json({ success: true })

  const { error } = await supabaseAdmin
    .from('user_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', adminUserId)
    .eq('category', 'diet_update')
    .eq('url', `/admin/diet-plan?userId=${memberId}`)
    .is('read_at', null)

  if (error) {
    console.error('admin diet updates PATCH error:', error)
    return NextResponse.json({ error: '確認済みにできませんでした' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
