import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthenticatedUser, createErrorResponse, createSuccessResponse } from '@/lib/api-utils'
import { format, startOfMonth, endOfMonth } from 'date-fns'

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

        // Fetch active members during this month from membership_history
        // Condition: status = 'active' AND start_date <= monthEnd AND (end_date IS NULL OR end_date >= monthStart)
        let membershipQuery = supabaseAdmin
            .from('membership_history')
            .select('user_id, start_date, end_date, status, store_id, plan, monthly_fee, users:user_id(full_name, plan, monthly_fee, billing_start_month)')
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

        // Deduplicate active members (keep the latest record per user for the month)
        const activeMembersMap = new Map()
        if (rawActiveMembers) {
            for (const m of rawActiveMembers) {
                activeMembersMap.set(m.user_id, m)
            }
        }
        const activeMembers = Array.from(activeMembersMap.values())

        // Build member list with amounts
        const memberList: any[] = []
        let totalAmount = 0

        for (const m of activeMembers) {
            const user = Array.isArray(m.users) ? m.users[0] : m.users

            // Exclude months before billing start month (if configured)
            if (user?.billing_start_month) {
                const billingStart = startOfMonth(new Date(user.billing_start_month))
                if (targetDateStart < billingStart) continue
            }

            // Determine amount: history fee -> user fee -> 0
            let amount = m.monthly_fee
            if (amount === null || amount === undefined) {
                amount = user?.monthly_fee ?? 0
            }

            if (amount > 0) {
                totalAmount += amount
                memberList.push({
                    user_id: m.user_id,
                    full_name: user?.full_name || '-',
                    plan: m.plan || user?.plan || '-',
                    amount: amount
                })
            }
        }

        // Sort by plan name
        memberList.sort((a, b) => a.plan.localeCompare(b.plan, 'ja'))

        return createSuccessResponse({
            members: memberList,
            totalAmount
        })
    } catch (error: any) {
        console.error('Sales API error:', error)
        return createErrorResponse(error.message, 500)
    }
}
