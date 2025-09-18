import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-config'
import { supabase } from '@/lib/supabase'
import { isAdmin, getUserStoreId } from '@/lib/auth-utils'
import { createGoogleCalendarService } from '@/lib/google-calendar'
import { generateReservationTitle, updateMonthlyTitles } from '@/lib/title-utils'

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

    const userStoreId = getUserStoreId(userEmail)
    const body = await request.json()
    
    // Validate input
    const { clientId, startTime, duration, notes } = body
    const calendarId = userStoreId // Force use of user's store calendar
    
    if (!clientId || !startTime || !duration) {
      return NextResponse.json(
        { error: 'クライアントID、開始時間、セッション時間は必須です' },
        { status: 400 }
      )
    }

    // Calculate end time from duration
    const startDateTime = new Date(startTime)
    const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 1000)

    // Get client user by ID (remove store verification for now)
    const { data: clientUser, error: clientError } = await supabase
      .from('users')
      .select('id, full_name, email, store_id')
      .eq('id', clientId)
      .single()

    if (clientError || !clientUser) {
      return NextResponse.json(
        { error: 'クライアントユーザーが見つかりません' },
        { status: 404 }
      )
    }

    // Generate title based on chronological order
    const generatedTitle = await generateReservationTitle(
      clientUser.id,
      clientUser.full_name,
      startDateTime
    )

    // Check for overlapping reservations in the same calendar (excluding adjacent times)
    const { data: existingReservations, error: overlapError } = await supabase
      .from('reservations')
      .select('id')
      .eq('calendar_id', calendarId)
      .gt('end_time', startDateTime.toISOString())
      .lt('start_time', endDateTime.toISOString())

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
          title: generatedTitle,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          clientName: clientUser.full_name,
          clientEmail: clientUser.email,
          notes: notes || undefined,
          calendarId: calendarId,
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
        title: generatedTitle,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        notes: notes || null,
        calendar_id: calendarId,
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
      
      // If calendar event was created but reservation failed, try to clean up
      if (externalEventId && calendarService) {
        try {
          await calendarService.deleteEvent(externalEventId, calendarId)
          console.log('Cleaned up calendar event after reservation failure')
        } catch (cleanupError) {
          console.error('Failed to cleanup calendar event:', cleanupError)
        }
      }
      
      return NextResponse.json(
        { error: '予約の作成に失敗しました' },
        { status: 500 }
      )
    }

    // Update all titles in this month to ensure proper chronological order
    const startMonth = startDateTime.getMonth()
    const startYear = startDateTime.getFullYear()
    await updateMonthlyTitles(clientUser.id, startYear, startMonth)

    return NextResponse.json({
      message: '予約が作成されました',
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
