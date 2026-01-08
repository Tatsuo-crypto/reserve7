import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAuth, handleApiError } from '@/lib/api-utils'
import { updateMonthlyTitles, updateAllTitles, usesCumulativeCount } from '@/lib/title-utils'
import { createGoogleCalendarService } from '@/lib/google-calendar'

export const dynamic = 'force-dynamic'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('🗑️ DELETE request received for reservation:', params.id)

    // Check authentication
    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) {
      console.log('❌ Authentication failed')
      return authResult
    }

    const { user, isAdmin: isUserAdmin } = authResult
    const reservationId = params.id

    console.log('✅ User authenticated:', user.email, 'Admin:', isUserAdmin)

    // Get the reservation first to check ownership
    const { data: reservation, error: fetchError } = await supabaseAdmin
      .from('reservations')
      .select(`
        id,
        client_id,
        start_time,
        external_event_id,
        calendar_id,
        title,
        users!client_id (
          email,
          plan
        )
      `)
      .eq('id', reservationId)
      .single()

    console.log('📋 Reservation fetch result:', {
      found: !!reservation,
      error: fetchError?.message,
      title: reservation?.title,
      external_event_id: reservation?.external_event_id
    })

    if (fetchError || !reservation) {
      console.log('❌ Reservation not found')
      return NextResponse.json(
        { error: '予約が見つかりません' },
        { status: 404 }
      )
    }

    // Check if user can delete this reservation
    const canDelete = isUserAdmin || (reservation.users as any)?.email === user.email

    console.log('🔐 Permission check:', { canDelete, isAdmin: isUserAdmin })

    if (!canDelete) {
      console.log('❌ Permission denied')
      return NextResponse.json(
        { error: 'この予約を削除する権限がありません' },
        { status: 403 }
      )
    }

    // Delete from Google Calendar first (if event exists)
    if (reservation.external_event_id) {
      console.log('📅 Attempting to delete from Google Calendar:', reservation.external_event_id)
      const calendarService = createGoogleCalendarService()
      if (calendarService) {
        try {
          await calendarService.deleteEvent(reservation.external_event_id, reservation.calendar_id)
          console.log('✅ Google Calendar event deleted:', reservation.external_event_id)
        } catch (calendarError) {
          console.error('❌ Calendar event deletion failed:', calendarError)
          // Continue with reservation deletion even if calendar sync fails
        }
      } else {
        console.warn('⚠️ Calendar service not available')
      }
    } else {
      console.log('ℹ️ No external_event_id, skipping Google Calendar deletion')
    }

    // Delete the reservation
    console.log('🗄️ Deleting from database...')
    const { error: deleteError } = await supabaseAdmin
      .from('reservations')
      .delete()
      .eq('id', reservationId)

    if (deleteError) {
      console.error('❌ Reservation deletion error:', deleteError)
      return NextResponse.json(
        { error: '予約の削除に失敗しました: ' + deleteError.message },
        { status: 500 }
      )
    }

    console.log('✅ Database deletion successful')

    // After deletion, renumber titles for this client and update Google Calendar
    // For diet/counseling: use cumulative count (all time)
    // For personal training: use monthly count
    if (reservation.client_id && reservation.start_time) {
      console.log('🔄 Updating titles for client:', reservation.client_id)
      try {
        const userRel: any = Array.isArray((reservation as any).users)
          ? (reservation as any).users[0]
          : (reservation as any).users
        const plan = userRel?.plan || ''

        if (usesCumulativeCount(plan)) {
          // Diet/Counseling: cumulative count across all months
          await updateAllTitles(reservation.client_id as string)
          console.log('✅ Cumulative titles updated')
        } else {
          // Personal training: monthly reset
          const d = new Date((reservation as any).start_time)
          await updateMonthlyTitles((reservation as any).client_id as string, d.getFullYear(), d.getMonth())
          console.log('✅ Monthly titles updated')
        }
      } catch (e) {
        console.error('❌ Failed to update titles after deletion:', e)
      }
    }

    console.log('✅ DELETE completed successfully')
    return NextResponse.json({
      message: '予約が正常にキャンセルされました'
    })

  } catch (error) {
    console.error('💥 DELETE route error:', error)
    return handleApiError(error, 'Reservation deletion DELETE')
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { user, isAdmin: isUserAdmin } = authResult
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
    const { data: reservation, error: fetchError } = await supabaseAdmin
      .from('reservations')
      .select(`
        id,
        client_id,
        title,
        external_event_id,
        calendar_id,
        users!client_id (
          email,
          full_name,
          plan
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
    const canUpdate = isUserAdmin || (reservation.users as any).email === user.email

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
    const { data: conflicts, error: conflictError } = await supabaseAdmin
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
    const { error: updateError } = await supabaseAdmin
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

    // After update, renumber titles for this client and update Google Calendar as needed
    // For diet/counseling: use cumulative count (all time)
    // For personal training: use monthly count
    try {
      const d = new Date(startDateTime)
      const clientId = (reservation as any).client_id as string | null
      if (clientId) {
        const userRel: any = Array.isArray((reservation as any).users)
          ? (reservation as any).users[0]
          : (reservation as any).users
        const plan = userRel?.plan || ''

        if (usesCumulativeCount(plan)) {
          // Diet/Counseling: cumulative count across all months
          await updateAllTitles(clientId)
        } else {
          // Personal training: monthly reset
          await updateMonthlyTitles(clientId, d.getFullYear(), d.getMonth())
        }
      }
    } catch (e) {
      console.error('Failed to update titles after PUT:', e)
      // Do not fail the request; return success for the update itself
    }

    return NextResponse.json({
      message: '予約が正常に更新されました'
    })

  } catch (error) {
    return handleApiError(error, 'Reservation update PUT')
  }
}
