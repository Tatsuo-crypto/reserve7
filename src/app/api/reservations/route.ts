import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { supabase } from '@/lib/supabase'
import { isAdmin, getUserStoreId } from '@/lib/env'

export async function GET(request: NextRequest) {
  try {
    // Check authentication - get session with request context
    const session = await getServerSession(authOptions)
    console.log('Session check:', session)
    
    if (!session?.user?.email) {
      console.log('No session or email found')
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      )
    }

    const userEmail = session.user.email
    const isUserAdmin = isAdmin(userEmail)
    const userStoreId = getUserStoreId(userEmail)
    
    console.log('Reservations API - User:', userEmail, 'Admin:', isUserAdmin, 'StoreId:', userStoreId)

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

    // If not admin, only show user's own reservations
    if (!isUserAdmin) {
      // First get user ID and store_id
      const { data: userData } = await supabase
        .from('users')
        .select('id, store_id')
        .eq('email', userEmail)
        .single()

      if (!userData) {
        return NextResponse.json(
          { error: 'ユーザーが見つかりません' },
          { status: 404 }
        )
      }

      // Filter by client_id and user's store calendar_id
      query = query.eq('client_id', userData.id)
      query = query.eq('calendar_id', userData.store_id)
    } else {
      // Admin sees all reservations in their store
      query = query.eq('calendar_id', userStoreId)
    }

    const { data: reservations, error } = await query

    if (error) {
      console.error('Reservations fetch error:', error)
      return NextResponse.json(
        { error: '予約の取得に失敗しました' },
        { status: 500 }
      )
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

    return NextResponse.json({
      reservations: formattedReservations,
      isAdmin: isUserAdmin,
    })

  } catch (error) {
    console.error('Reservations API error:', error)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
