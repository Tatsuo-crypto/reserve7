import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, createErrorResponse, createSuccessResponse } from '@/lib/api-utils'
import { getMonthlyReservationCount, getPlanMaxCount } from '@/lib/reservation-utils'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    
    if (!user) {
      return createErrorResponse('認証が必要です', 401)
    }

    if (!user.isAdmin) {
      return createErrorResponse('管理者権限が必要です', 403)
    }

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString())

    if (!clientId) {
      return createErrorResponse('クライアントIDが必要です', 400)
    }

    // Get client's plan
    const { data: client, error: clientError } = await supabase
      .from('users')
      .select('plan')
      .eq('id', clientId)
      .eq('store_id', user.storeId)
      .single()

    if (clientError || !client) {
      return createErrorResponse('クライアントが見つかりません', 404)
    }

    const planName = client.plan || '月4回'
    const maxCount = getPlanMaxCount(planName)
    const currentCount = await getMonthlyReservationCount(clientId, year, month)

    return createSuccessResponse({
      currentCount,
      maxCount,
      planName,
      year,
      month
    })
  } catch (error) {
    console.error('Monthly count API error:', error)
    return createErrorResponse('Internal server error', 500)
  }
}
