import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { getAuthenticatedUser, createErrorResponse, createSuccessResponse } from '@/lib/api-utils'
import { getPlanMaxCount } from '@/lib/reservation-utils'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    
    let user = null

    if (token) {
      // Trainer token authentication
      const { data: trainer, error } = await supabaseAdmin
        .from('trainers')
        .select('id, full_name, email, store_id')
        .eq('access_token', token)
        .eq('status', 'active')
        .single()

      if (error || !trainer) {
        return createErrorResponse('無効なトークンです', 401)
      }
      
      user = {
        id: trainer.id,
        email: trainer.email,
        name: trainer.full_name,
        isAdmin: false,
        isTrainer: true,
        storeId: trainer.store_id
      }
    } else {
      // Session authentication
      user = await getAuthenticatedUser()

      if (!user) {
        return createErrorResponse('認証が必要です', 401)
      }

      if (!user.isAdmin) {
        return createErrorResponse('管理者権限が必要です', 403)
      }
    }

    const clientId = searchParams.get('clientId')
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString())

    if (!clientId) {
      return createErrorResponse('会員IDが必要です', 400)
    }

    // Get client's plan using supabaseAdmin
    const { data: client, error: clientError } = await supabaseAdmin
      .from('users')
      .select('plan')
      .eq('id', clientId)
      .single()

    if (clientError || !client) {
      return createErrorResponse('会員が見つかりません', 404)
    }

    const planName = client.plan || '月4回'
    const maxCount = getPlanMaxCount(planName)
    
    // Calculate monthly count using supabaseAdmin
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01T00:00:00+00:00`
    const nextMonth = month === 12 ? 1 : month + 1
    const nextYear = month === 12 ? year + 1 : year
    const endDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01T00:00:00+00:00`

    const { count, error: countError } = await supabaseAdmin
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .gte('start_time', startDate)
      .lt('start_time', endDate)

    if (countError) {
      console.error('Error counting reservations:', countError)
      return createErrorResponse('予約数の取得に失敗しました', 500)
    }

    return createSuccessResponse({
      currentCount: count || 0,
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
