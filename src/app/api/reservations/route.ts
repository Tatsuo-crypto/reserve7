import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthenticatedUser, createErrorResponse, createSuccessResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    // Check for token-based authentication (for member-specific URLs)
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    let user = null
    let tokenUser = null

    if (token) {
      // Try finding user first
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('id, email, full_name, store_id, access_token')
        .eq('access_token', token)
        .single()

      if (userData) {
        tokenUser = userData
        user = {
          id: userData.id,
          email: userData.email,
          name: userData.full_name,
          isAdmin: false,
          storeId: userData.store_id
        }
      } else {
        // Try finding trainer
        const { data: trainerData } = await supabaseAdmin
          .from('trainers')
          .select('id, email, full_name, store_id')
          .eq('access_token', token)
          .eq('status', 'active')
          .single()

        if (trainerData) {
          // Get store calendar_id
          const { data: store, error: storeError } = await supabaseAdmin
            .from('stores')
            .select('calendar_id')
            .eq('id', trainerData.store_id)
            .single()

          if (storeError) {
            console.error('Store lookup error:', storeError)
          }

          user = {
            id: trainerData.id,
            email: trainerData.email,
            name: trainerData.full_name,
            isAdmin: false, // Trainers aren't full admins but have special privileges
            isTrainer: true,
            storeId: trainerData.store_id,
            calendarId: store?.calendar_id
          }
        }
      }

      if (!user) {
        return createErrorResponse('無効なアクセストークンです', 401)
      }
    } else {
      // Session-based authentication
      user = await getAuthenticatedUser()

      if (!user) {
        return createErrorResponse('認証が必要です', 401)
      }
    }

    // Use calendarId for reservations (email format)
    const calendarId = (user as any).calendarId || user.storeId
    
    let query = supabaseAdmin
      .from('reservations')
      .select(`
        id,
        title,
        start_time,
        end_time,
        notes,
        calendar_id,
        created_at,
        external_event_id,
        client_id,
        trainer_id,
        users!client_id (
          id,
          full_name,
          email,
          store_id,
          plan
        )
      `)
      .order('start_time', { ascending: true })

    // Filter by store/calendar
    // If trainer, they should see their store's calendar
    query = query.eq('calendar_id', calendarId)

    // Optional date range filtering
    const startParam = searchParams.get('start')
    const endParam = searchParams.get('end')

    if (startParam) {
      query = query.gte('start_time', startParam)
    }
    if (endParam) {
      query = query.lte('start_time', endParam)
    }

    // Permission filtering
    // Admin: sees all (filtered by calendarId above if they have one, or maybe they want to see all?)
    // Trainer: sees all in their store
    // User: sees only their own
    
    if (!user.isAdmin && !(user as any).isTrainer) {
      // Regular users can only see their own reservations
      if (token && tokenUser) {
        // Token-based: use tokenUser.id directly
        query = query.eq('client_id', tokenUser.id)
      } else {
        // Session-based: fetch user ID from database
        const { data: userData } = await supabaseAdmin
          .from('users')
          .select('id, store_id')
          .eq('email', user.email)
          .single()

        if (!userData) {
          return createErrorResponse('ユーザーが見つかりません', 404)
        }

        // Ensure user can only see reservations from their store
        query = query.eq('client_id', userData.id)
      }
    }

    const { data: reservations, error } = await query

    if (error) {
      console.error('Reservations fetch error:', error)
      return createErrorResponse('Internal server error', 500)
    }

    // Format the response
    const formattedReservations = reservations?.map(reservation => ({
      id: reservation.id,
      title: reservation.title,
      startTime: reservation.start_time,
      endTime: reservation.end_time,
      notes: reservation.notes,
      calendarId: reservation.calendar_id,
      createdAt: reservation.created_at,
      trainerId: reservation.trainer_id,
      client: reservation.client_id ? {
        id: (reservation.users as any).id,
        fullName: (reservation.users as any).full_name,
        email: (reservation.users as any).email,
        plan: (reservation.users as any).plan,
      } : (reservation.title && reservation.title.includes('ゲスト')) ? {
        id: 'guest',
        fullName: 'ゲスト予約',
        email: 'guest@system',
        plan: '都度',
      } : (reservation.title && reservation.title.includes('体験')) ? {
        id: 'trial',
        fullName: '体験予約',
        email: 'trial@system',
        plan: null,
      } : (reservation.title && reservation.title === '研修') ? {
        id: 'training',
        fullName: '研修',
        email: 'training@system',
        plan: null,
      } : {
        id: 'blocked',
        fullName: '予約不可時間',
        email: 'blocked@system',
        plan: null,
      }
    })) || []

    return createSuccessResponse({
      reservations: formattedReservations,
      isAdmin: user.isAdmin,
    })

  } catch (error) {
    console.error('Reservations API error:', error)
    return createErrorResponse('サーバーエラーが発生しました', 500)
  }
}
