import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth, handleApiError } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const auth = await requireAdminAuth()
    if (auth instanceof NextResponse) return auth

    const { data: members, error } = await supabaseAdmin
      .from('users')
      .select('id, full_name, email, status, store_id, online_reminder_enabled, push_notification_enabled')
      .neq('email', 'tandjgym@gmail.com')
      .neq('email', 'tandjgym2goutenn@gmail.com')
      .order('full_name', { ascending: true })

    if (error) throw error

    const { data: stores, error: storesError } = await supabaseAdmin
      .from('stores')
      .select('id, name')

    if (storesError) throw storesError

    const storeNames = new Map<string, string>()
    for (const store of stores || []) {
      storeNames.set((store as any).id, (store as any).name)
    }

    let subscriptionCounts = new Map<string, number>()

    try {
      const { data: subscriptions, error: subscriptionError } = await supabaseAdmin
        .from('push_subscriptions')
        .select('user_id')

      if (!subscriptionError) {
        for (const subscription of subscriptions || []) {
          const userId = (subscription as any).user_id
          subscriptionCounts.set(userId, (subscriptionCounts.get(userId) || 0) + 1)
        }
      }
    } catch (error) {
      console.warn('push_subscriptions table is not ready yet.')
    }

    return NextResponse.json({
      members: (members || []).map((member: any) => ({
        id: member.id,
        fullName: member.full_name,
        email: member.email,
        status: member.status || 'active',
        storeId: member.store_id || null,
        storeName: member.store_id ? storeNames.get(member.store_id) || '店舗未設定' : '店舗未設定',
        emailEnabled: member.online_reminder_enabled !== false,
        pushEnabled: member.push_notification_enabled === true,
        pushSubscriptionCount: subscriptionCounts.get(member.id) || 0,
      })),
    })
  } catch (error) {
    return handleApiError(error, 'Admin member-notification-settings GET')
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (auth instanceof NextResponse) return auth

    const { members } = await request.json()

    if (!Array.isArray(members)) {
      return NextResponse.json({ error: '更新対象が不正です' }, { status: 400 })
    }

    const errors: string[] = []

    for (const member of members) {
      if (!member?.id) continue

      const { error } = await supabaseAdmin
        .from('users')
        .update({
          online_reminder_enabled: member.emailEnabled === true,
          push_notification_enabled: member.pushEnabled === true,
        })
        .eq('id', member.id)
        .neq('email', 'tandjgym@gmail.com')
        .neq('email', 'tandjgym2goutenn@gmail.com')

      if (error) {
        errors.push(`${member.id}: ${error.message}`)
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: '一部の更新に失敗しました', details: errors }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'Admin member-notification-settings PATCH')
  }
}
