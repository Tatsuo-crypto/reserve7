import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthenticatedUser, createErrorResponse, createSuccessResponse } from '@/lib/api-utils'
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser()
        if (!user || !user.isAdmin) {
            return createErrorResponse('管理者権限が必要です', 403)
        }

        const { searchParams } = new URL(request.url)
        const storeId = searchParams.get('storeId')
        const monthStr = searchParams.get('month') || format(new Date(), 'yyyy-MM')
        
        // Parse month string (yyyy-MM)
        const targetDateStart = new Date(`${monthStr}-01`)
        const targetDateEnd = endOfMonth(targetDateStart)
        const targetDateStr = format(targetDateStart, 'yyyy-MM-01')

        // 1. Fetch Actual Sales (Paid)
        let query = supabaseAdmin
            .from('sales')
            .select(`
        id,
        amount,
        type,
        target_date,
        payment_date,
        user_id,
        store_id,
        users:user_id (
          full_name,
          plan
        )
      `)
            .eq('target_date', targetDateStr)
            .limit(100000)

        if (storeId && storeId !== 'all') {
            query = query.eq('store_id', storeId)
        }

        const { data: sales, error } = await query.order('payment_date', { ascending: false })

        if (error) {
            console.error('Sales fetch error:', error)
            return createErrorResponse(error.message, 500)
        }

        // 2. Calculate Unpaid (Projected - Paid Monthly Fees)
        
        // Fetch ALL monthly fee payments for this month to check payment status globally
        // This ensures a user who paid in Store A isn't marked as unpaid in Store B
        const { data: globalPayments } = await supabaseAdmin
            .from('sales')
            .select('user_id')
            .eq('target_date', targetDateStr)
            .eq('type', 'monthly_fee')
            .limit(100000)

        // Fetch active members during this month
        // Condition: status = 'active' AND start_date <= monthEnd AND (end_date IS NULL OR end_date >= monthStart)
        let membershipQuery = supabaseAdmin
            .from('membership_history')
            .select('user_id, start_date, end_date, status, store_id, plan, monthly_fee, users:user_id(full_name, plan, monthly_fee, transfer_day, created_at, billing_start_month)')
            .eq('status', 'active')
            .lte('start_date', format(targetDateEnd, 'yyyy-MM-dd'))
            .or(`end_date.is.null,end_date.gte.${format(targetDateStart, 'yyyy-MM-dd')}`)
            .order('start_date', { ascending: true })
            .limit(100000)

        if (storeId && storeId !== 'all') {
            membershipQuery = membershipQuery.eq('store_id', storeId)
        }

        const { data: rawActiveMembers, error: memberError } = await membershipQuery
        if (memberError) throw memberError

        // Deduplicate active members (keep the latest record for the month)
        const activeMembersMap = new Map()
        if (rawActiveMembers) {
            for (const m of rawActiveMembers) {
                activeMembersMap.set(m.user_id, m)
            }
        }
        const activeMembers = Array.from(activeMembersMap.values())

        // Identify users who have already paid 'monthly_fee' globally
        const paidUserIds = new Set(
            (globalPayments || [])
                .map((s: any) => s.user_id)
        )

        // Identify Unpaid Members
        const unpaidMembersList = (activeMembers || []).filter((m: any) => {
            if (paidUserIds.has(m.user_id)) return false

            // Exclude non-recurring plans
            // Check both history plan and current user plan
            // Note: users might be an array if the join returns multiple, though users:user_id should be one-to-one
            const user = Array.isArray(m.users) ? m.users[0] : m.users
            const planName = m.plan || user?.plan || ''

            // Exclude months before billing start month (if configured)
            // billing_start_month is stored as a date (YYYY-MM-01)
            if (user?.billing_start_month) {
                const billingStart = startOfMonth(new Date(user.billing_start_month))
                if (targetDateStart < billingStart) return false
            }
            
            if (planName.includes('ダイエット') || 
                planName.includes('都度') || 
                planName.includes('体験') || 
                planName.includes('カウンセリング') ||
                planName.includes('回コース')) {
                return false
            }

            return true
        })
        const unpaidUserIds = unpaidMembersList.map((m: any) => m.user_id)

        let totalUnpaid = 0
        let unpaidDetails: any[] = []

        if (unpaidUserIds.length > 0) {
            // Fetch recent sales to estimate fee for unpaid members (fallback)
            // Look back 6 months
            const recentSalesQuery = supabaseAdmin
                .from('sales')
                .select('user_id, amount')
                .eq('type', 'monthly_fee')
                .in('user_id', unpaidUserIds)
                .gte('target_date', format(subMonths(targetDateStart, 6), 'yyyy-MM-01'))
                .order('payment_date', { ascending: false })

            const { data: recentSales } = await recentSalesQuery

            // Map user to latest amount
            const userLatestAmount = new Map<string, number>()
            if (recentSales) {
                for (const sale of recentSales) {
                    if (!userLatestAmount.has(sale.user_id)) {
                        userLatestAmount.set(sale.user_id, sale.amount)
                    }
                }
            }

            // Calculate Total Unpaid
            for (const m of unpaidMembersList) {
                // Priority: 
                // 1. History Snapshot (m.monthly_fee) - The fee at the time of status/plan validity
                // 2. Current User Fee (m.users.monthly_fee) - Fallback
                // 3. Recent Sales Amount - Last resort
                
                const user = Array.isArray(m.users) ? m.users[0] : m.users

                let amount = m.monthly_fee
                if (amount === null || amount === undefined) {
                    amount = user?.monthly_fee
                }
                
                // If still no amount (e.g. 0 is valid, but null/undefined is not), try recent sales
                if (amount === null || amount === undefined) {
                    amount = userLatestAmount.get(m.user_id) || 0
                }

                if (amount > 0) {
                    // Determine Transfer Day
                    // Priority: Explicit transfer_day -> Membership Start Date day -> Default 27
                    let transferDay = 27
                    if (user?.transfer_day) {
                        transferDay = user.transfer_day
                    } else if (m.start_date) {
                        // Parse YYYY-MM-DD safely without timezone issues
                        const dayPart = m.start_date.split('-')[2]
                        if (dayPart) {
                            transferDay = parseInt(dayPart)
                        } else {
                            // Fallback if format is unexpected
                            transferDay = new Date(m.start_date).getDate()
                        }
                    }

                    totalUnpaid += amount
                    unpaidDetails.push({
                        user_id: m.user_id,
                        full_name: user?.full_name,
                        plan: m.plan || user?.plan, // Use history plan if available
                        estimated_amount: amount,
                        transfer_day: transferDay
                    })
                }
            }
            
            // Recalculate totalUnpaid
            totalUnpaid = unpaidDetails.reduce((sum, item) => sum + item.estimated_amount, 0)
        }

        const totalPaid = sales.reduce((sum: number, s: any) => sum + s.amount, 0)
        const projectedSales = totalPaid + totalUnpaid

        return createSuccessResponse({
            sales,
            summary: {
                totalPaid,
                totalUnpaid,
                projectedSales,
                unpaidCount: unpaidDetails.length
            },
            unpaidDetails
        })
    } catch (error: any) {
        console.error('Sales API error:', error)
        return createErrorResponse(error.message, 500)
    }
}
