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
      // Token-based authentication for members
      const { data: userData, error: tokenError } = await supabaseAdmin
        .from('users')
        .select('id, email, full_name, store_id, access_token')
        .eq('access_token', token)
        .single()
      
      if (tokenError || !userData) {
        return createErrorResponse('無効なアクセストークンです', 401)
      }
      
      tokenUser = userData
      user = {
        id: userData.id,
        email: userData.email,
        name: userData.full_name,
        isAdmin: false,
        storeId: userData.store_id
      }
    } else {
      // Session-based authentication
      user = await getAuthenticatedUser()
      
      if (!user) {
        return createErrorResponse('認証が必要です', 401)
      }
    }

    console.log('Reservations API - User:', user.email, 'Admin:', user.isAdmin, 'StoreId:', user.storeId, 'Token:', !!token)

    // Use calendarId if available (for admins), otherwise use storeId
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
        users!client_id (
          id,
          full_name,
          email,
          store_id,
          plan
        )
      `)
      .order('start_time', { ascending: true })

    // Filter by store and user permissions
    query = query.eq('calendar_id', calendarId)
    
    if (!user.isAdmin) {
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
      // calendar_id is already filtered above
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
      client: reservation.client_id ? {
        id: (reservation.users as any).id,
        fullName: (reservation.users as any).full_name,
        email: (reservation.users as any).email,
        plan: (reservation.users as any).plan,
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
