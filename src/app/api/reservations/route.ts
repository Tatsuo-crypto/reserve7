import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getAuthenticatedUser, createErrorResponse, createSuccessResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    // Check authentication - get session with request context
    const user = await getAuthenticatedUser()
    
    if (!user) {
      return createErrorResponse('認証が必要です', 401)
    }

    console.log('Reservations API - User:', user.email, 'Admin:', user.isAdmin, 'StoreId:', user.storeId)

    let query = supabase
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
        users!client_id (
          id,
          full_name,
          email,
          store_id
        )
      `)
      .order('start_time', { ascending: true })

    // Filter by store and user permissions
    query = query.eq('calendar_id', user.storeId)
    
    if (!user.isAdmin) {
      // Regular users can only see their own reservations
      const { data: userData } = await supabase
        .from('users')
        .select('id, store_id')
        .eq('email', user.email)
        .single()
      
      if (!userData) {
        return createErrorResponse('ユーザーが見つかりません', 404)
      }
      
      // Ensure user can only see reservations from their store
      query = query.eq('client_id', userData.id)
      query = query.eq('calendar_id', userData.store_id)
    } else {
      // Admin users can see all reservations from their store
      query = query.eq('calendar_id', user.storeId)
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
      client: {
        id: (reservation.users as any).id,
        fullName: (reservation.users as any).full_name,
        email: (reservation.users as any).email,
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
