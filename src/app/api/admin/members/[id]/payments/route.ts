import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthenticatedUser, createErrorResponse, createSuccessResponse } from '@/lib/api-utils'
import { addMonths, format, parseISO } from 'date-fns'
import { contractAtDate, japanDate, monthlyContract } from '@/lib/membership-ledger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthenticatedUser()
    if (!user?.isAdmin) return createErrorResponse('管理者権限が必要です', 403)
    const [members, histories, payments] = await Promise.all([
      supabaseAdmin.from('users').select('id, full_name, email, created_at, billing_start_month, plan, monthly_fee, status, store_id').eq('id', params.id).single(),
      supabaseAdmin.from('membership_history').select('*').eq('user_id', params.id).order('start_date'),
      supabaseAdmin.from('sales').select('*').eq('user_id', params.id).eq('type', 'monthly_fee'),
    ])
    if (members.error) throw members.error
    if (histories.error) throw histories.error
    if (payments.error) throw payments.error
    const member = members.data
    const history = histories.data || []
    const sales = payments.data || []
    const today = japanDate()
    const currentMonth = today.slice(0, 7)
    const current = contractAtDate(member, history, today)
    const firstMonth = (member.billing_start_month || history[0]?.start_date || member.created_at).slice(0, 7)
    const lastMonth = [currentMonth, ...history.flatMap(row => [row.start_date.slice(0, 7), row.end_date?.slice(0, 7) || currentMonth]), ...sales.map(row => (row.target_date || row.payment_date || today).slice(0, 7))].sort().pop()!
    const timeline = []

    for (let date = parseISO(`${firstMonth}-01`); format(date, 'yyyy-MM') <= lastMonth; date = addMonths(date, 1)) {
      const month = format(date, 'yyyy-MM')
      const contract = monthlyContract(member, history, month)
      const payment = sales.find(row => (row.target_date || row.payment_date || '').startsWith(month))
      const paid = payment?.status === 'paid' && Boolean(payment.payment_date)
      timeline.push({
        month,
        plan: contract.plan,
        expectedAmount: contract.amount,
        actualAmount: paid ? payment.amount : null,
        status: paid ? 'paid' : month > currentMonth ? 'future' : contract.amount === 0 ? 'n/a' : 'unpaid',
        paymentDate: payment?.payment_date || null,
        targetDate: payment?.target_date || null,
        membershipStatus: contract.status,
        memo: payment?.memo || null,
        needsReview: contract.needsReview,
      })
    }

    return createSuccessResponse({
      member: { id: member.id, fullName: member.full_name, email: member.email, plan: current.plan, monthlyFee: current.monthly_fee, status: current.status },
      payments: timeline.reverse(),
    })
  } catch (error) {
    console.error('Payment history API error:', error)
    return createErrorResponse('月額プラン履歴を取得できませんでした', 500)
  }
}
