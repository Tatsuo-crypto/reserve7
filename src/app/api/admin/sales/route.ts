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

        if (storeId && storeId !== 'all') {
            query = query.eq('store_id', storeId)
        }

        const { data: sales, error } = await query.order('payment_date', { ascending: false })

        if (error) {
            console.error('Sales fetch error:', error)
            return createErrorResponse(error.message, 500)
        }

        // 2. Calculate Unpaid (Projected - Paid Monthly Fees)
        
        // Fetch active members during this month
        // Condition: status = 'active' AND start_date <= monthEnd AND (end_date IS NULL OR end_date >= monthStart)
        let membershipQuery = supabaseAdmin
            .from('membership_history')
            .select('user_id, start_date, end_date, status, store_id, plan, monthly_fee, users:user_id(full_name, plan, monthly_fee)')
            .eq('status', 'active')
            .lte('start_date', format(targetDateEnd, 'yyyy-MM-dd'))
            .or(`end_date.is.null,end_date.gte.${format(targetDateStart, 'yyyy-MM-dd')}`)
            .order('start_date', { ascending: true })

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

        // Identify users who have already paid 'monthly_fee'
        const paidUserIds = new Set(
            sales
                .filter((s: any) => s.type === 'monthly_fee')
                .map((s: any) => s.user_id)
        )

        // Identify Unpaid Members
        const unpaidMembersList = (activeMembers || []).filter((m: any) => !paidUserIds.has(m.user_id))
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
            unpaidDetails = unpaidMembersList.map((m: any) => {
                // Priority: 
                // 1. History Snapshot (m.monthly_fee) - The fee at the time of status/plan validity
                // 2. Current User Fee (m.users.monthly_fee) - Fallback
                // 3. Recent Sales Amount - Last resort
                
                let amount = m.monthly_fee
                if (amount === null || amount === undefined) {
                    amount = m.users?.monthly_fee
                }
                
                // If still no amount (e.g. 0 is valid, but null/undefined is not), try recent sales
                if (amount === null || amount === undefined) {
                    amount = userLatestAmount.get(m.user_id) || 0
                }
                
                totalUnpaid += amount
                return {
                    user_id: m.user_id,
                    full_name: m.users?.full_name,
                    plan: m.plan || m.users?.plan, // Use history plan if available
                    estimated_amount: amount
                }
            }).filter((d: any) => d.estimated_amount > 0)
            
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
            unpaidDetails // Optional: if frontend wants to list them
        })
    } catch (error: any) {
        console.error('Sales API error:', error)
        return createErrorResponse(error.message, 500)
    }
}
