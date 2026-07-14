import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthenticatedUser, createErrorResponse, createSuccessResponse } from '@/lib/api-utils'
import { format } from 'date-fns'

type MembershipHistoryStatus = {
  status: 'active' | 'suspended' | 'withdrawn'
  start_date: string
  end_date: string | null
}

function deriveCurrentStatus(member: any, histories: MembershipHistoryStatus[], today = format(new Date(), 'yyyy-MM-dd')) {
  const latest = histories
    .filter(history => history.start_date <= today)
    .sort((a, b) => b.start_date.localeCompare(a.start_date))[0]

  if (!latest) return member.status || 'active'
  if (latest.status === 'withdrawn') return 'withdrawn'
  if (latest.status === 'active' && latest.end_date && latest.end_date < today) return 'withdrawn'
  if (latest.status === 'suspended' && latest.end_date && latest.end_date < today) return 'withdrawn'

  return latest.status || member.status || 'active'
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUser()
    
    if (!user) {
      return createErrorResponse('認証が必要です', 401)
    }

    if (!user.isAdmin) {
      return createErrorResponse('管理者権限が必要です', 403)
    }

    const { id } = params

    // Get member by ID
    const { data: member, error } = await supabaseAdmin
      .from('users')
      .select(`
        id,
        full_name,
        email,
        google_calendar_email,
        plan,
        status,
        store_id,
        monthly_fee,
        billing_start_month,
        created_at,
        memo,
        access_token,
        online_reminder_enabled,
        push_notification_enabled,
        birth_date,
        gender,
        height_cm,
        activity_level,
        target_weight_kg
      `)
      .eq('id', id)
      .single()

    if (error || !member) {
      console.error('Database error:', error)
      return createErrorResponse('会員が見つかりません', 404)
    }

    const { data: histories, error: historyError } = await supabaseAdmin
      .from('membership_history')
      .select('status, start_date, end_date')
      .eq('user_id', id)
      .order('start_date', { ascending: true })

    if (historyError) {
      console.error('Membership history fetch error:', historyError)
    }

    return createSuccessResponse({
      ...member,
      status: deriveCurrentStatus(member, (histories || []) as MembershipHistoryStatus[])
    })
  } catch (error) {
    console.error('Member API error:', error)
    return createErrorResponse('Internal server error', 500)
  }
}
