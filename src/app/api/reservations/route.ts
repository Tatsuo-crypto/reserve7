import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { supabase } from '@/lib/supabase'
import { isAdmin } from '@/lib/env'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      )
    }

    const userEmail = session.user.email
    const isUserAdmin = isAdmin(userEmail)

    let query = supabase
      .from('reservations')
      .select(`
        id,
        title,
        start_time,
        end_time,
        notes,
        created_at,
        users!client_id (
          id,
          full_name,
          email
        )
      `)
      .order('start_time', { ascending: true })

    // If not admin, only show user's own reservations
    if (!isUserAdmin) {
      // First get user ID
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('email', userEmail)
        .single()

      if (!userData) {
        return NextResponse.json(
          { error: 'ユーザーが見つかりません' },
          { status: 404 }
        )
      }

      query = query.eq('client_id', userData.id)
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
