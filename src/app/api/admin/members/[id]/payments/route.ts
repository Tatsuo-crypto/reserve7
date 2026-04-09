import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthenticatedUser, createErrorResponse, createSuccessResponse } from '@/lib/api-utils'
import { format, startOfMonth, endOfMonth, addMonths, subMonths, isSameMonth, parseISO } from 'date-fns'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUser()
    if (!user || !user.isAdmin) {
      return createErrorResponse('管理者権限が必要です', 403)
    }

    const memberId = params.id
    const today = new Date()

    // 1. Fetch Membership History (to determine plan & fee for each period)
    const { data: history, error: historyError } = await supabaseAdmin
      .from('membership_history')
      .select('*')
      .eq('user_id', memberId)
      .order('start_date', { ascending: true })

    if (historyError) throw historyError

    // 2. Fetch Actual Sales (Past payments)
    const { data: sales, error: salesError } = await supabaseAdmin
      .from('sales')
      .select('*')
      .eq('user_id', memberId)
      .order('payment_date', { ascending: false })

    if (salesError) throw salesError

    console.log('Sales data fetched:', sales?.map(s => ({ target_date: s.target_date, memo: s.memo })))

    // 3. Fetch Current User Info (fallback for current plan)
    const { data: member, error: memberError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', memberId)
      .single()

    if (memberError) throw memberError

    // Generate a timeline of months
    // Start from the first membership history start_date, or created_at, or 1 year ago
    let startDate = new Date(member.created_at)
    if (history && history.length > 0) {
      const firstHistory = new Date(history[0].start_date)
      if (firstHistory < startDate) startDate = firstHistory
    }

    // Normalized registration/history start
    startDate = startOfMonth(startDate)

    // If billing start month is configured, it overrides the start date
    if (member.billing_start_month) {
      const billingStart = startOfMonth(parseISO(member.billing_start_month))
      startDate = billingStart
    }

    console.log('Timeline range calculated:', {
      member_created_at: member.created_at,
      billing_start_month: member.billing_start_month,
      final_startDate: format(startDate, 'yyyy-MM-dd')
    })

    // End date determination
    let endDate = endOfMonth(addMonths(today, 3))

    // If user has withdrawn or suspended in the latest history, stop the timeline there
    if (history && history.length > 0) {
      const latestRect = history[history.length - 1] // sorted ASC
      if (latestRect.status === 'withdrawn' || latestRect.status === 'suspended') {
        const hEnd = latestRect.end_date ? endOfMonth(parseISO(latestRect.end_date)) : endOfMonth(parseISO(latestRect.start_date))
        if (hEnd < endDate) {
          endDate = hEnd
        }
      }
    }

    const timeline = []
    let current = startDate

    while (current <= endDate) {
      const monthStr = format(current, 'yyyy-MM')
      const monthStart = startOfMonth(current)
      const monthEnd = endOfMonth(current)

      // A. Determine Plan & Fee for this month from History
      // Find history records that overlap with this month
      const monthlyRecords = history?.filter(h => {
        const hStart = startOfMonth(parseISO(h.start_date))
        const hEnd = h.end_date ? endOfMonth(parseISO(h.end_date)) : null
        return hStart <= monthEnd && (!hEnd || hEnd >= monthStart)
      }) || []

      let activeRecord = null
      if (monthlyRecords.length > 0) {
        // Sort by start_date descending to get the latest change in that month
        monthlyRecords.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
        activeRecord = monthlyRecords[0]
      }

      // If no history record covers this month, look for the most recent one BEFORE this month
      if (!activeRecord && history && history.length > 0) {
        activeRecord = history
          .filter(h => startOfMonth(parseISO(h.start_date)) < monthStart)
          .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())[0]
      }

      // Find actual payment
      const actualPayment = sales?.find(s => {
        if (s.target_date) {
          return s.target_date.startsWith(monthStr) && s.type === 'monthly_fee'
        }
        return s.payment_date.startsWith(monthStr) && s.type === 'monthly_fee'
      })

      // C. Determine Status & Amount
      let planName = activeRecord?.plan || member.plan || ''
      let fee = activeRecord?.monthly_fee ?? member.monthly_fee ?? 0
      let mStatus = activeRecord?.status ?? member.status ?? 'active'

      // If status is suspended or withdrawn, expected fee should be 0
      if (mStatus === 'suspended' || mStatus === 'withdrawn') {
        fee = 0
        if (!planName) {
          planName = mStatus === 'suspended' ? '休会' : '退会'
        }
      }

      let status = 'unpaid' // default

      // Override fee if actual payment exists (actual is truth)
      if (actualPayment) {
        status = 'paid'
        // If actual payment amount differs from plan fee, show actual?
      } else {
        // Future or Unpaid
        if (current > today) {
          status = 'future'
        } else {
          // Past or Current Month
          // If fee is 0, it's "free" or "recess", so effectively "paid" (nothing to pay)
          if (fee === 0) status = 'n/a'
        }
      }

      timeline.push({
        month: monthStr,
        plan: planName,
        expectedAmount: fee,
        actualAmount: actualPayment?.amount ?? null,
        status: status,
        paymentDate: actualPayment?.payment_date ?? null,
        targetDate: actualPayment?.target_date ?? null,
        membershipStatus: mStatus,
        memo: actualPayment?.memo ?? null
      })

      // If this month is suspended or withdrawn, and there are no ACTIVE history records after this month,
      // stop generating the timeline.
      const hasLaterActiveHistory = history?.some(h => {
        const hStart = startOfMonth(parseISO(h.start_date))
        return hStart > monthEnd && h.status === 'active'
      })
      if ((mStatus === 'suspended' || mStatus === 'withdrawn') && !hasLaterActiveHistory) {
        break
      }

      current = addMonths(current, 1)
    }

    // Sort timeline descending (newest first)
    timeline.reverse()

    console.log('Timeline with memos:', timeline.map(t => ({ month: t.month, memo: t.memo })))

    return createSuccessResponse({
      member: {
        id: member.id,
        fullName: member.full_name,
        email: member.email
      },
      payments: timeline
    })

  } catch (error: any) {
    console.error('Payment history API error:', error)
    return createErrorResponse(error.message || 'Internal server error', 500)
  }
}
