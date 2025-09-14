import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { supabase } from '@/lib/supabase'
import { isAdmin } from '@/lib/env'
import { createReservationSchema } from '@/lib/validations'
import { createGoogleCalendarService } from '@/lib/google-calendar'

export async function POST(request: NextRequest) {
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      )
    }

    const userEmail = session.user.email
    if (!isAdmin(userEmail)) {
      return NextResponse.json(
        { error: '管理者権限が必要です' },
        { status: 403 }
      )
    }

    const body = await request.json()
    
    // Validate input
    const { clientEmail, title, startTime, notes } = createReservationSchema.parse(body)

    // Get client user ID
    const { data: clientUser, error: clientError } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('email', clientEmail.toLowerCase())
      .single()

    if (clientError || !clientUser) {
      return NextResponse.json(
        { error: 'クライアントユーザーが見つかりません' },
        { status: 404 }
      )
    }

    // Calculate end time (60 minutes after start)
    const startDateTime = new Date(startTime)
    const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000) // Add 60 minutes

    // Check for overlapping reservations
    const { data: existingReservations, error: overlapError } = await supabase
      .from('reservations')
      .select('id')
      .gte('end_time', startDateTime.toISOString())
      .lte('start_time', endDateTime.toISOString())

    if (overlapError) {
      console.error('Overlap check error:', overlapError)
      return NextResponse.json(
        { error: '予約の重複チェックに失敗しました' },
        { status: 500 }
      )
    }

    if (existingReservations && existingReservations.length > 0) {
      return NextResponse.json(
        { error: 'この時間帯は既に予約されています' },
        { status: 409 }
      )
    }

    // Try to create Google Calendar event first (if configured)
    let externalEventId: string | null = null
    const calendarService = createGoogleCalendarService()
    
    if (calendarService) {
      try {
        externalEventId = await calendarService.createEvent({
          title,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          clientName: clientUser.full_name,
          clientEmail: clientUser.email,
          notes: notes || undefined,
        })
        console.log('Google Calendar event created:', externalEventId)
      } catch (calendarError) {
        console.error('Calendar event creation failed:', calendarError)
        // Continue with reservation creation even if calendar sync fails
      }
    }

    // Create reservation
    const { data: reservation, error } = await supabase
      .from('reservations')
      .insert({
        client_id: clientUser.id,
        title,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        notes: notes || null,
        external_event_id: externalEventId,
      })
      .select(`
        id,
        title,
        start_time,
        end_time,
        notes,
        created_at,
        external_event_id,
        users!client_id (
          id,
          full_name,
          email
        )
      `)
      .single()

    if (error) {
      console.error('Reservation creation error:', error)
      
      // If reservation creation fails but calendar event was created, try to clean up
      if (externalEventId && calendarService) {
        try {
          await calendarService.deleteEvent(externalEventId)
          console.log('Cleaned up calendar event due to reservation creation failure')
        } catch (cleanupError) {
          console.error('Failed to cleanup calendar event:', cleanupError)
        }
      }
      
      return NextResponse.json(
        { error: '予約の作成に失敗しました' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: '予約が正常に作成されました',
      reservation: {
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
      }
    })

  } catch (error) {
    console.error('Admin reservation API error:', error)
    
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: '入力データが正しくありません' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
