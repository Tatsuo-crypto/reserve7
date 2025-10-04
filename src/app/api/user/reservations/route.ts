import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { getAuthenticatedUser, createErrorResponse, createSuccessResponse } from '@/lib/api-utils'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    
    if (!user) {
      return createErrorResponse('認証が必要です', 401)
    }

    // Get user's reservations
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select(`
        id,
        title,
        start_time,
        end_time,
        notes,
        created_at
      `)
      .eq('client_id', user.id)
      .order('start_time', { ascending: true })

    if (error) {
      console.error('Database error:', error)
      return createErrorResponse('予約データの取得に失敗しました', 500)
    }

    // Sort reservations by start_time to calculate sequence numbers
    const sortedReservations = reservations.sort((a, b) => 
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    )

    // Format reservations for display
    const formattedReservations = sortedReservations.map((reservation, index) => ({
      id: reservation.id,
      sequenceNumber: index + 1,
      date: new Date(reservation.start_time).toLocaleDateString('ja-JP'),
      time: `${new Date(reservation.start_time).toLocaleTimeString('ja-JP', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Tokyo'
      })} - ${new Date(reservation.end_time).toLocaleTimeString('ja-JP', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Tokyo'
      })}`,
      notes: reservation.notes,
      isPast: new Date(reservation.end_time) < new Date(),
      createdAt: reservation.created_at
    }))

    return createSuccessResponse({
      reservations: formattedReservations,
      total: formattedReservations.length
    })
  } catch (error) {
    console.error('User reservations API error:', error)
    return createErrorResponse('Internal server error', 500)
  }
}
