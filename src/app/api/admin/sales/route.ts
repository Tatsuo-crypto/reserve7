import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthenticatedUser, createErrorResponse, createSuccessResponse } from '@/lib/api-utils'
import { japanDate, monthBounds, monthlySales } from '@/lib/membership-ledger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user?.isAdmin) return createErrorResponse('管理者権限が必要です', 403)
    const month = request.nextUrl.searchParams.get('month') || japanDate().slice(0, 7)
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return createErrorResponse('対象月を確認してください', 400)
    const storeId = request.nextUrl.searchParams.get('storeId')
    const [history, users, payments] = await Promise.all([
      supabaseAdmin.from('membership_history').select('*').limit(100000),
      supabaseAdmin.from('users').select('id, full_name, billing_start_month, store_id').limit(100000),
      supabaseAdmin.from('sales').select('user_id, store_id, amount, payment_date, target_date, status').eq('type', 'monthly_fee').gte('target_date', `${month}-01`).lte('target_date', monthBounds(month).end),
    ])
    if (history.error) throw history.error
    if (users.error) throw users.error
    if (payments.error) throw payments.error
    const usersById = new Map((users.data || []).map(row => [row.id, row]))
    const contracts = monthlySales(history.data || [], usersById, month, storeId)
    const members = contracts.map(contract => ({
      user_id: contract.userId,
      full_name: usersById.get(contract.userId)?.full_name || '-',
      plan: contract.plan || '未設定',
      amount: contract.amount,
      needsReview: contract.needsReview,
    })).sort((a, b) => a.plan.localeCompare(b.plan, 'ja'))
    const paidAmount = (payments.data || []).filter(row => row.status === 'paid' && row.payment_date && (!storeId || storeId === 'all' || (row.store_id || usersById.get(row.user_id)?.store_id) === storeId)).reduce((sum, row) => sum + row.amount, 0)
    return createSuccessResponse({ members, totalAmount: members.reduce((sum, row) => sum + (row.amount ?? 0), 0), paidAmount, needsReviewCount: contracts.filter(row => row.needsReview).length })
  } catch (error) {
    console.error('Sales API error:', error)
    return createErrorResponse('売上を取得できませんでした', 500)
  }
}
