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
    // Normalize to start of month
    startDate = startOfMonth(startDate)

    // End date: current month (do not show future months)
    const endDate = endOfMonth(today)

    const timeline = []
    let current = startDate

    while (current <= endDate) {
      const monthStr = format(current, 'yyyy-MM')
      const monthStart = startOfMonth(current)
      const monthEnd = endOfMonth(current)

      // A. Determine Plan & Fee for this month from History
      // Find the history record active at the END of the month (or start)
      // Rule: If active at any point in the month? Usually monthly fee is based on status at start of month or majority.
      // Let's use the status as of the 1st of the month, or if started mid-month, that record.
      
      let activeRecord = history?.find(h => {
        const hStart = new Date(h.start_date)
        const hEnd = h.end_date ? new Date(h.end_date) : null
        return hStart <= monthEnd && (!hEnd || hEnd >= monthStart)
      })

      // If multiple records in a month (e.g. plan change), which one takes precedence?
      // Usually the latest one that started before or in this month.
      const monthlyRecords = history?.filter(h => {
         const hStart = new Date(h.start_date)
         const hEnd = h.end_date ? new Date(h.end_date) : null
         return hStart <= monthEnd && (!hEnd || hEnd >= monthStart)
      })
      
      if (monthlyRecords && monthlyRecords.length > 0) {
          // Sort by start_date desc to get latest
          monthlyRecords.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
          activeRecord = monthlyRecords[0]
      }

      // If no history found (maybe before history tracking started), fallback to current user info if it's recent?
      // Or just assume no plan.
      
      // B. Find actual payment
      const actualPayment = sales?.find(s => {
          // target_date is typically 'yyyy-MM-01'
          if (s.target_date) {
              return s.target_date.startsWith(monthStr) && s.type === 'monthly_fee'
          }
          // Fallback: check payment_date if target_date is missing (unlikely for monthly_fee)
          return s.payment_date.startsWith(monthStr) && s.type === 'monthly_fee'
      })
      
      if (actualPayment) {
        console.log(`Found payment for ${monthStr}, memo:`, actualPayment.memo)
      }

      // C. Determine Status & Amount
      let planName = activeRecord?.plan || ''
      let fee = activeRecord?.monthly_fee ?? 0
      let status = 'unpaid' // default

      // If no active record in history, but we have member.created_at...
      // Maybe use current member info if date > created_at and no history? 
      // (For old data compatibility)
      if (!activeRecord && current >= startOfMonth(new Date(member.created_at))) {
         // This logic might be flawed if they quit. 
         // But if they are active now, and we lack history, maybe assume current plan?
         // Safer to just show 'Unknown' or empty if no history.
      }

      // Check if "Recess" (recess / 休会)
      // Usually represented by a specific plan name or status='recess' (if that existed)
      // Or simply fee is 0.
      
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
        membershipStatus: activeRecord?.status ?? 'active',
        memo: actualPayment?.memo ?? null
      })

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
