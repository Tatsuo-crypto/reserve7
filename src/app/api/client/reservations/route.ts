import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /api/client/reservations?token=xxx
// Get reservations for a specific client using their access token
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'トークンが指定されていません' },
        { status: 400 }
      )
    }

    // Find user by access_token
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('access_token', token)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { error: '無効なトークンです' },
        { status: 401 }
      )
    }

    // Get reservations for this client
    const { data: reservations, error: reservationsError } = await supabase
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
      .order('start_time', { ascending: false })

    if (reservationsError) {
      console.error('Reservations fetch error:', reservationsError)
      return NextResponse.json(
        { error: '予約の取得に失敗しました' },
        { status: 500 }
      )
    }

    // Separate past and future reservations on server side
    const nowISO = new Date().toISOString()
    const allReservations = reservations || []
    const futureReservations = allReservations.filter(r => r.start_time >= nowISO)
    const pastReservations = allReservations.filter(r => r.start_time < nowISO)

    return NextResponse.json({
      data: {
        reservations: allReservations,
        futureReservations,
        pastReservations
      }
    })

  } catch (error) {
    console.error('Client reservations API error:', error)
    return NextResponse.json(
      { error: '予約の取得に失敗しました' },
      { status: 500 }
    )
  }
}
