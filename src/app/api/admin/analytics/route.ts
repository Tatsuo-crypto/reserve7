import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAuthenticatedUser, createErrorResponse } from '@/lib/api-utils'
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval, addMonths, endOfDay } from 'date-fns'
import { japanDate, monthlyMovement, monthlySales } from '@/lib/membership-ledger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser()
        if (!user || !user.isAdmin) {
            return createErrorResponse('Unauthorized', 401)
        }

        const { searchParams } = new URL(request.url)
        // currently ignoring period params, defaulting to last 12 months or similar
        // storeId param could be used to filter
        const storeId = searchParams.get('storeId') || user.storeId
        const period = searchParams.get('period') || '1y'

        console.log('[Analytics Debug] Request params:', { storeId, period, userStoreId: user.storeId })

        // Determine date range based on period
        const today = new Date(`${japanDate()}T00:00:00`)
        let startDate: Date
        let endDate: Date = endOfMonth(today) // Default end is end of current month (or start of next?) - usually we want up to now. 
        // For charts, usually we want up to "this month".
        // Let's use startOfMonth(today) as the last point if we want completed months, or just use current month.
        // The previous code used `end: startOfMonth(today)` which gives up to current month (inclusive start of month).

        // Let's stick to "up to current month" logic for relative periods, and specific years for absolute periods.

        if (period === 'all') {
            startDate = new Date('2023-11-01') // Start of service
            endDate = startOfMonth(today)
        } else if (['2023', '2024', '2025', '2026'].includes(period)) {
            startDate = new Date(`${period}-01-01`)
            endDate = new Date(`${period}-12-01`)

            // If the year is in the future, maybe limit to today? 
            // But for "2025" chart when it's Jan 2025, we might want to show empty months?
            // Existing logic iterates over `monthList`. If we provide future months, it will try to fetch data.
            // Let's cap endDate at startOfMonth(today) if it exceeds it, unless we want to show empty space?
            // Usually analytics show what happened. Future is 0.
            // Let's let it run for the full year, so the X-axis is consistent for the year view.
        } else if (period === '3m') {
            startDate = subMonths(startOfMonth(today), 2) // Current + 2 prev = 3 months
            endDate = startOfMonth(today)
        } else {
            // Default '1y'
            startDate = subMonths(startOfMonth(today), 11) // Current + 11 prev = 12 months
            endDate = startOfMonth(today)
        }

        // Enforce minimum start date of 2023-11-01 (ignore data before 2023/10)
        const MIN_START_DATE = new Date('2023-11-01')
        if (startDate < MIN_START_DATE) {
            startDate = MIN_START_DATE
        }

        // Generate month list
        // Note: eachMonthOfInterval includes start and end
        // For 'all' (2023-11 to now), if now is 2026-01, it lists all months.
        const monthList = eachMonthOfInterval({
            start: startDate,
            end: endDate
        })

        // Fetch history
        let query = supabaseAdmin
            .from('membership_history')
            .select('id, user_id, start_date, end_date, status, store_id, monthly_fee, plan, created_at, users:user_id(full_name, monthly_fee, plan, billing_start_month, store_id)')

        // Filter by store if provided (and not 'all' or empty)
        // Note: storeId might be null in DB for some records?

        if (storeId && storeId !== 'all') {
            // Logic: store_id in history represents snapshot.
            query = query.eq('store_id', storeId)
        }

        let { data: historyData, error } = await query.order('start_date', { ascending: true }).limit(100000)

        let history = historyData || []

        // Defensive In-Memory Filter for History
        if (storeId && storeId !== 'all') {
            const originalLength = history.length
            history = history.filter(h => h.store_id === storeId)
            if (history.length !== originalLength) {
                console.warn(`[Analytics Warning] History DB filter leak detected! Filtered in-memory from ${originalLength} to ${history.length}`)
            }
        }

        if (error) throw error

        const getJoinedUser = (h: any) => Array.isArray(h.users) ? h.users[0] : h.users
        const billingMembers = new Map(history.map(h => [h.user_id, getJoinedUser(h) || {}]))
        const memberHistory = monthList.map(date =>
            monthlyMovement(history, billingMembers, format(date, 'yyyy-MM'), storeId)
        )
        const salesHistory = monthList.map(date => {
            const month = format(date, 'yyyy-MM')
            const contracts = monthlySales(history, billingMembers, month, storeId)
            return {
                month,
                amount: contracts.reduce((sum, row) => sum + (row.amount ?? 0), 0),
                needsReviewCount: contracts.filter(row => row.needsReview).length,
            }
        })

        // Calculate Projected Sales for current month
        // Simply sum all active members' monthly_fee (matches Sales API)
        const currentMonthSalesEntry = salesHistory.find(s => s.month === format(today, 'yyyy-MM'))
        const projectedSales = currentMonthSalesEntry?.amount || 0

        const response = NextResponse.json({
            memberHistory,
            salesHistory,
            projectedSales,
            needsReviewCount: currentMonthSalesEntry?.needsReviewCount || 0,
        })

        // Prevent caching
        response.headers.set('Cache-Control', 'no-store, max-age=0')

        return response

    } catch (error: any) {
        console.error('Analytics API error:', error)
        return createErrorResponse(error.message, 500)
    }
}
