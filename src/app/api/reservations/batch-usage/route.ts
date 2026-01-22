import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { getAuthenticatedUser, createErrorResponse, createSuccessResponse } from '@/lib/api-utils'
import { getPlanMaxCount } from '@/lib/reservation-utils'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { clientIds, year: yearParam, month: monthParam } = body

    if (!Array.isArray(clientIds) || clientIds.length === 0) {
      return createErrorResponse('会員IDのリストが必要です', 400)
    }

    const year = parseInt(yearParam || new Date().getFullYear().toString())
    const month = parseInt(monthParam || (new Date().getMonth() + 1).toString())

    // 1. Fetch plans for all clients
    const { data: clients, error: clientsError } = await supabaseAdmin
      .from('users')
      .select('id, plan')
      .in('id', clientIds)

    if (clientsError) {
      console.error('Error fetching clients:', clientsError)
      return createErrorResponse('会員情報の取得に失敗しました', 500)
    }

    // Map client plans
    const clientPlans: Record<string, string> = {}
    clients?.forEach(c => {
      clientPlans[c.id] = c.plan || '月4回'
    })

    // 2. Count reservations for all clients in the specified month
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01T00:00:00+00:00`
    const nextMonth = month === 12 ? 1 : month + 1
    const nextYear = month === 12 ? year + 1 : year
    const endDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01T00:00:00+00:00`

    // Fetch id and client_id for the month
    const { data: reservations, error: resError } = await supabaseAdmin
      .from('reservations')
      .select('client_id')
      .in('client_id', clientIds)
      .gte('start_time', startDate)
      .lt('start_time', endDate)

    if (resError) {
      console.error('Error fetching reservations:', resError)
      return createErrorResponse('予約データの取得に失敗しました', 500)
    }

    // Aggregate counts in memory
    const counts: Record<string, number> = {}
    reservations?.forEach(r => {
      if (r.client_id) {
        counts[r.client_id] = (counts[r.client_id] || 0) + 1
      }
    })

    // 3. Build response
    const result: Record<string, any> = {}
    clientIds.forEach(clientId => {
      // Skip blocked/special IDs if they somehow got in here
      if (clientId === 'blocked' || clientId === 'trial' || clientId === 'guest') return

      const planName = clientPlans[clientId] || '月4回'
      const maxCount = getPlanMaxCount(planName)
      const currentCount = counts[clientId] || 0

      result[clientId] = {
        currentCount,
        maxCount,
        planName,
        year,
        month
      }
    })

    return createSuccessResponse(result)
  } catch (error) {
    console.error('Batch usage API error:', error)
    return createErrorResponse('Internal server error', 500)
  }
}
