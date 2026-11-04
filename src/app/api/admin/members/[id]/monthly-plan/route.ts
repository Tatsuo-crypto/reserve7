import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthenticatedUser, createErrorResponse, createSuccessResponse } from '@/lib/api-utils'
import { monthlyPlanChangeSchema } from '@/lib/monthly-membership'
import { monthBounds } from '@/lib/membership-ledger'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthenticatedUser()
    if (!user?.isAdmin) return createErrorResponse('管理者権限が必要です', 403)
    const parsed = monthlyPlanChangeSchema.safeParse(await request.json())
    if (!parsed.success) return createErrorResponse(parsed.error.issues[0]?.message || '入力内容を確認してください', 400)
    const change = parsed.data
    const { start, end } = monthBounds(change.month)
    // Commit the contract, payment and current snapshot in one transaction.
    const { data, error } = await supabaseAdmin.rpc('save_member_contract', {
      p_user_id: params.id,
      p_start_date: start,
      p_end_date: change.applyScope === 'month' ? end : null,
      p_status: change.status,
      p_plan: change.plan,
      p_monthly_fee: change.monthlyFee,
      p_store_id: null,
      p_actor: user.email,
      p_payment: { target_date: start, payment_date: change.paymentDate || null, memo: change.memo || null },
    })
    if (error) throw error
    return createSuccessResponse({ success: true, ...data })
  } catch (error) {
    console.error('Monthly plan update error:', error)
    return createErrorResponse('保存できませんでした。変更は反映されていません。画面を再読み込みしてお試しください。', 500)
  }
}
