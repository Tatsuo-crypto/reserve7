import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthenticatedUser, createErrorResponse } from '@/lib/api-utils'
import { addMonths, eachMonthOfInterval, format, parseISO, subMonths } from 'date-fns'
import { contractAtDate, countsAsMember, japanDate, monthlyMovement, monthlySales } from '@/lib/membership-ledger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const admin = await getAuthenticatedUser()
    if (!admin?.isAdmin) return createErrorResponse('Unauthorized', 401)
    const [histories, users, settings, stores] = await Promise.all([
      supabaseAdmin.from('membership_history').select('*').limit(100000),
      supabaseAdmin.from('users').select('id, full_name, plan, monthly_fee, store_id, billing_start_month, created_at, status').neq('role', 'ADMIN'),
      supabaseAdmin.from('lifestyle_settings').select('user_id, habit_targets'),
      supabaseAdmin.from('stores').select('id, name'),
    ])
    for (const result of [histories, users, settings, stores]) if (result.error) throw result.error
    const history = histories.data || []
    const allUsers = users.data || []
    const members = new Map(allUsers.map(row => [row.id, row]))
    const storeNames = new Map((stores.data || []).map(row => [row.id, row.name]))
    const routes = new Map((settings.data || []).map(row => [row.user_id, row.habit_targets?.counseling_profile?.route || '未入力']))
    const currentMonth = japanDate().slice(0, 7)
    const currentStart = parseISO(`${currentMonth}-01`)
    const monthly = eachMonthOfInterval({ start: subMonths(currentStart, 6), end: subMonths(currentStart, 1) }).map(date => {
      const movement = monthlyMovement(history, members, format(date, 'yyyy-MM'))
      const counts = new Map<string, number>()
      for (const member of movement.newMembers) {
        const route = routes.get(member.user_id) || '未入力'
        counts.set(route, (counts.get(route) || 0) + 1)
      }
      return { month: movement.month, activeEnd: movement.active, newCount: movement.new, withdrawnCount: movement.withdrawn, newByRoute: Array.from(counts, ([route, count]) => ({ route, count })) }
    })
    const currentMembers = allUsers.flatMap(member => {
      const rows = history.filter(row => row.user_id === member.id)
      const current = contractAtDate(member, rows)
      if (!countsAsMember(current)) return []
      const first = rows.filter(row => row.status === 'active').sort((a, b) => a.start_date.localeCompare(b.start_date))[0]
      return [{ id: member.id, name: member.full_name, plan: current.plan, monthlyFee: current.monthly_fee, storeName: storeNames.get(current.store_id || ''), joinDate: member.billing_start_month || first?.start_date || member.created_at.slice(0, 10) }]
    }).sort((a, b) => a.joinDate.localeCompare(b.joinDate))
    const planCounts = new Map<string, number>()
    for (const member of currentMembers) planCounts.set(member.plan || '未設定', (planCounts.get(member.plan || '未設定') || 0) + 1)
    const contracts = monthlySales(history, members, currentMonth)
    const [payments, trials] = await Promise.all([
      supabaseAdmin.from('sales').select('amount').eq('type', 'monthly_fee').eq('status', 'paid').not('payment_date', 'is', null).gte('target_date', `${currentMonth}-01`).lt('target_date', format(addMonths(currentStart, 1), 'yyyy-MM-dd')),
      supabaseAdmin.from('reservations').select('id').ilike('title', '体験%').gte('start_time', subMonths(currentStart, 6).toISOString()),
    ])
    if (payments.error) throw payments.error
    if (trials.error) throw trials.error
    return NextResponse.json({
      generatedAt: new Date().toISOString(), stores: stores.data || [], monthly, currentMembers,
      planBreakdown: Array.from(planCounts, ([plan, count]) => ({ plan, count })),
      revenue: { activeMemberCount: currentMembers.length, activeMonthlyFeeSum: contracts.reduce((sum, row) => sum + (row.amount ?? 0), 0), salesTableThisMonth: (payments.data || []).reduce((sum, row) => sum + row.amount, 0), needsReviewCount: contracts.filter(row => row.needsReview).length },
      trial: { periodMonths: 6, count: trials.data?.length || 0 },
    })
  } catch (error) {
    console.error('BusinessReport API error:', error)
    return createErrorResponse('経営レポートを取得できませんでした', 500)
  }
}
