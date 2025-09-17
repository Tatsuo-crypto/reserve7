import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { supabase } from '@/lib/supabase'
import { isAdmin } from '@/lib/auth-utils'
import { createGoogleCalendarService } from '@/lib/google-calendar'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const reservationId = params.id

    // Get the reservation first to check ownership
    const { data: reservation, error: fetchError } = await supabase
      .from('reservations')
      .select(`
        id,
        client_id,
        external_event_id,
        calendar_id,
        users!client_id (
          email
        )
      `)
      .eq('id', reservationId)
      .single()

    if (fetchError || !reservation) {
      return NextResponse.json(
        { error: '予約が見つかりません' },
        { status: 404 }
      )
    }

    // Check if user can delete this reservation
    const canDelete = isUserAdmin || (reservation.users as any).email === userEmail

    if (!canDelete) {
      return NextResponse.json(
        { error: 'この予約を削除する権限がありません' },
        { status: 403 }
      )
    }

    // Delete from Google Calendar first (if event exists)
    if (reservation.external_event_id) {
      const calendarService = createGoogleCalendarService()
      if (calendarService) {
        try {
          await calendarService.deleteEvent(reservation.external_event_id, reservation.calendar_id)
          console.log('Google Calendar event deleted:', reservation.external_event_id)
        } catch (calendarError) {
          console.error('Calendar event deletion failed:', calendarError)
          // Continue with reservation deletion even if calendar sync fails
        }
      }
    }

    // Delete the reservation
    const { error: deleteError } = await supabase
      .from('reservations')
      .delete()
      .eq('id', reservationId)

    if (deleteError) {
      console.error('Reservation deletion error:', deleteError)
      return NextResponse.json(
        { error: '予約の削除に失敗しました' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: '予約が正常にキャンセルされました'
    })

  } catch (error) {
    console.error('Reservation deletion API error:', error)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const reservationId = params.id

    // Parse request body
    const body = await request.json()
    const { title, startTime, endTime, notes } = body

    if (!title || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'タイトル、開始時間、終了時間は必須です' },
        { status: 400 }
      )
    }

    // Get the reservation first to check ownership
    const { data: reservation, error: fetchError } = await supabase
      .from('reservations')
      .select(`
        id,
        client_id,
        title,
        external_event_id,
        calendar_id,
        users!client_id (
          email,
          full_name
        )
      `)
      .eq('id', reservationId)
      .single()

    if (fetchError || !reservation) {
      return NextResponse.json(
        { error: '予約が見つかりません' },
        { status: 404 }
      )
    }

    // Check if user can update this reservation
    const canUpdate = isUserAdmin || (reservation.users as any).email === userEmail

    if (!canUpdate) {
      return NextResponse.json(
        { error: 'この予約を変更する権限がありません' },
        { status: 403 }
      )
    }

    // Validate time format
    const startDateTime = new Date(startTime)
    const endDateTime = new Date(endTime)

    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
      return NextResponse.json(
        { error: '無効な日時形式です' },
        { status: 400 }
      )
    }

    if (startDateTime >= endDateTime) {
      return NextResponse.json(
        { error: '開始時間は終了時間より前である必要があります' },
        { status: 400 }
      )
    }

    // Check for time conflicts with other reservations
    const { data: conflicts, error: conflictError } = await supabase
      .from('reservations')
      .select('id')
      .neq('id', reservationId) // Exclude current reservation
      .or(`and(start_time.lt.${endDateTime.toISOString()},end_time.gt.${startDateTime.toISOString()})`)

    if (conflictError) {
      console.error('Conflict check error:', conflictError)
      return NextResponse.json(
        { error: '時間の重複チェックに失敗しました' },
        { status: 500 }
      )
    }

    if (conflicts && conflicts.length > 0) {
      return NextResponse.json(
        { error: '指定された時間は他の予約と重複しています' },
        { status: 409 }
      )
    }

    // Update Google Calendar event first (if event exists)
    if (reservation.external_event_id) {
      const calendarService = createGoogleCalendarService()
      if (calendarService) {
        try {
          await calendarService.updateEvent(reservation.external_event_id, {
            title,
            startTime: startDateTime.toISOString(),
            endTime: endDateTime.toISOString(),
            clientName: (reservation.users as any).full_name,
            clientEmail: (reservation.users as any).email,
            notes: notes || undefined,
            calendarId: reservation.calendar_id,
          })
          console.log('Google Calendar event updated:', reservation.external_event_id)
        } catch (calendarError) {
          console.error('Calendar event update failed:', calendarError)
          // Continue with reservation update even if calendar sync fails
        }
      }
    }

    // Update the reservation
    const { error: updateError } = await supabase
      .from('reservations')
      .update({
        title: title,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        notes: notes || null
      })
      .eq('id', reservationId)

    if (updateError) {
      console.error('Reservation update error:', updateError)
      return NextResponse.json(
        { error: '予約の更新に失敗しました' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: '予約が正常に更新されました'
    })

  } catch (error) {
    console.error('Reservation update API error:', error)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
