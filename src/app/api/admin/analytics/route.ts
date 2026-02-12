import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAuthenticatedUser, createErrorResponse } from '@/lib/api-utils'
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns'

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
        const today = new Date()
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
            .select('user_id, start_date, end_date, status, store_id, monthly_fee, plan, users:user_id(full_name, monthly_fee, plan, billing_start_month)')
            
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

        // Aggregate counts per month
        const memberHistory = monthList.map(date => {
            const monthStart = startOfMonth(date)
            const monthEnd = endOfMonth(date)
            
            // Count active members at the end of this month
            // Active condition: 
            // 1. status == 'active'
            // 2. start_date <= monthEnd
            // 3. (end_date is null OR end_date > monthEnd)

            // Filter active records for this month, then deduplicate by user_id
            const activeRecordsThisMonth = history.filter(h => {
                if (h.status !== 'active') return false

                const start = new Date(h.start_date)
                const end = h.end_date ? new Date(h.end_date) : null

                if (!(start <= monthEnd && (!end || end > monthEnd))) return false

                // Exclude months before billing start month
                const user = Array.isArray((h as any).users) ? (h as any).users[0] : (h as any).users
                if (user?.billing_start_month) {
                    const billingStart = startOfMonth(new Date(user.billing_start_month))
                    if (monthStart < billingStart) return false
                }

                return true
            })
            // Deduplicate: count unique users only
            const activeUserIds = new Set(activeRecordsThisMonth.map(h => h.user_id))
            const activeCount = activeUserIds.size

            // Withdrawn in this month
            // Logic:
            // Focus on ACTIVE records ending in this month.
            // If a user ends Jan 31, they are a Jan withdrawal (unless they renew).
            const withdrawnMembers = history.filter((h: any) => {
                // Only look at ACTIVE records that have an end date
                if (h.status === 'active') {
                    if (!h.end_date) return false
                    const end = new Date(h.end_date)
                    if (end < monthStart || end > monthEnd) return false

                    // Check for continuity (Renewal / Plan Change)
                    // Look for any OTHER record (active) that starts within 32 days
                    const isContinued = history.some((next: any) => {
                        if (next.user_id !== h.user_id || next === h) return false
                        if (next.status !== 'active') return false // Only active renewal counts as continuity
                        
                        const nextStart = new Date(next.start_date)
                        const diffTime = Math.abs(nextStart.getTime() - end.getTime())
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                        
                        if (diffDays > 32) return false
                        
                        // Check if there's a withdrawn status BETWEEN end and nextStart
                        const hasWithdrawnBetween = history.some((between: any) => {
                            if (between.user_id !== h.user_id) return false
                            if (between.status !== 'withdrawn') return false
                            
                            const betweenStart = new Date(between.start_date)
                            // If withdrawn period overlaps or is between the two active periods
                            return betweenStart > end && betweenStart < nextStart
                        })
                        
                        // If there's a withdrawn period in between, it's NOT a continuation
                        if (hasWithdrawnBetween) return false
                        
                        return true
                    })

                    if (isContinued) return false

                    return true
                }
                
                // We ignore 'withdrawn' status records for the count now, 
                // because we rely on the END of the active period to place the withdrawal.
                return false
            }).map((h: any) => {
                const user = Array.isArray(h.users) ? h.users[0] : h.users
                return {
                    user_id: h.user_id,
                    full_name: user?.full_name || '不明',
                    plan: h.plan,
                    date: h.end_date
                }
            })

            // Suspended members in this month
            const suspendedMembers = history.filter(h => {
                if (h.status !== 'suspended') return false
                const start = new Date(h.start_date)
                const end = h.end_date ? new Date(h.end_date) : null
                
                // Base condition: Overlaps with this month
                if (!(start <= monthEnd && (!end || end > monthEnd))) {
                    return false
                }

                // EXCLUSION: If this user is ALREADY counted as "Withdrawn" in this month, 
                // do not count them as "Suspended" to avoid double counting.
                // (e.g. User suspended on Jan 7, then withdrawn effective Jan 31/Feb 1)
                const isWithdrawnInThisMonth = withdrawnMembers.some((w: any) => w.user_id === h.user_id)
                if (isWithdrawnInThisMonth) return false

                return true
            }).map((h: any) => {
                const user = Array.isArray(h.users) ? h.users[0] : h.users
                return {
                    user_id: h.user_id,
                    full_name: user?.full_name || '不明',
                    plan: h.plan,
                    date: h.start_date
                }
            })

            const suspendedCount = suspendedMembers.length

            // New members in this month
            // start_date is within this month AND plan is recurring AND no immediate prior history
            const newMembers = history.filter((h: any) => {
                // Must be active to be a "new member"
                if (h.status !== 'active') return false

                const start = new Date(h.start_date)
                if (start < monthStart || start > monthEnd) return false

                // Check for continuity (Plan Change)
                // Look for any OTHER record for this user that ended just before this start date
                // Window increased to 32 days to catch renewals/returns within a month
                const isContinuation = history.some(prev => {
                    if (prev.user_id !== h.user_id || prev === h) return false
                    if (!prev.end_date) return false // Active ongoing record doesn't explain a new start
                    
                    const prevEnd = new Date(prev.end_date)
                    const diffTime = Math.abs(start.getTime() - prevEnd.getTime())
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) 
                    return diffDays <= 32 // Starts within 32 days of previous end
                })

                if (isContinuation) return false

                return true
            }).map((h: any) => {
                const user = Array.isArray(h.users) ? h.users[0] : h.users
                return {
                    user_id: h.user_id,
                    full_name: user?.full_name || '不明',
                    plan: h.plan,
                    date: h.start_date
                }
            })

            return {
                month: format(date, 'yyyy-MM'),
                active: activeCount,
                suspended: suspendedCount,
                new: newMembers.length,
                withdrawn: withdrawnMembers.length,
                newMembers,      // Detailed list
                withdrawnMembers, // Detailed list
                suspendedMembers // Detailed list
            }
        })

        const salesHistory = monthList.map(date => {
            const monthStart = startOfMonth(date)
            const monthEnd = endOfMonth(date)
            
            // Estimate from membership history (all active members' monthly fees)
            const activeRecords = history.filter(h => {
                if (h.status !== 'active') return false

                // Exclude months before billing start month (if configured)
                const user = Array.isArray((h as any).users) ? (h as any).users[0] : (h as any).users
                if (user?.billing_start_month) {
                    const billingStart = startOfMonth(new Date(user.billing_start_month))
                    if (monthStart < billingStart) return false
                }
                
                const start = new Date(h.start_date)
                const end = h.end_date ? new Date(h.end_date) : null
                
                // Active during this month
                return start <= monthEnd && (!end || end >= monthStart)
            })

            // Deduplicate: keep the record with the highest monthly_fee per user
            const userMap = new Map()
            for (const h of activeRecords) {
                const existing = userMap.get(h.user_id)
                if (!existing || (h.monthly_fee || 0) > (existing.monthly_fee || 0)) {
                    userMap.set(h.user_id, h)
                }
            }
            const estimatedSales = Array.from(userMap.values()).reduce((sum, h) => {
                const fee = h.monthly_fee || 0
                return sum + fee
            }, 0)

            return {
                month: format(date, 'yyyy-MM'),
                amount: estimatedSales
            }
        })

        // Calculate Projected Sales for current month
        // Simply sum all active members' monthly_fee (matches Sales API)
        const currentMonthSalesEntry = salesHistory.find(s => s.month === format(today, 'yyyy-MM'))
        const projectedSales = currentMonthSalesEntry?.amount || 0

        const response = NextResponse.json({
            memberHistory,
            salesHistory,
            projectedSales
        })

        // Prevent caching
        response.headers.set('Cache-Control', 'no-store, max-age=0')

        return response

    } catch (error: any) {
        console.error('Analytics API error:', error)
        return createErrorResponse(error.message, 500)
    }
}
