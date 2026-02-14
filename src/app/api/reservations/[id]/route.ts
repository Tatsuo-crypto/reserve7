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

    // Check authentication (Session or Token)
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    
    let user = null
    let isUserAdmin = false
    let isTrainer = false

    if (token) {
      // Trainer token authentication
      const { data: trainer, error } = await supabaseAdmin
        .from('trainers')
        .select('id, full_name, email, store_id')
        .eq('access_token', token)
        .eq('status', 'active')
        .single()

      if (error || !trainer) {
        return NextResponse.json({ error: '無効なトークンです' }, { status: 401 })
      }

      // Get store calendar_id
      const { data: store, error: storeError } = await supabaseAdmin
        .from('stores')
        .select('calendar_id')
        .eq('id', trainer.store_id)
        .single()

      if (storeError) {
        console.error('Store lookup error:', storeError)
      }

      user = {
        id: trainer.id,
        email: trainer.email,
        name: trainer.full_name,
        storeId: trainer.store_id,
        calendarId: store?.calendar_id
      }
      isTrainer = true
    } else {
      // Session authentication
      const authResult = await requireAuth()
      if (authResult instanceof NextResponse) {
        console.log('❌ Authentication failed')
        return authResult
      }
      user = authResult.user
      isUserAdmin = authResult.isAdmin
    }

    const reservationId = params.id

    console.log('✅ User authenticated:', user.email, 'Admin:', isUserAdmin, 'Trainer:', isTrainer)

    // Get the reservation first to check ownership
    const { data: reservation, error: fetchError } = await supabaseAdmin
      .from('reservations')
      .select(`
        id,
        client_id,
        start_time,
        external_event_id,
        trainer_external_event_id,
        calendar_id,
        title,
        trainer_id,
        users!client_id (
          email,
          google_calendar_email,
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
    const canDelete = isUserAdmin || 
                      (reservation.users as any)?.email === user.email || 
                      (isTrainer && reservation.calendar_id === user.calendarId)

    console.log('🔐 Permission check:', { canDelete, isAdmin: isUserAdmin, isTrainer })

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
      
      // Prepare options for deletion from secondary calendars
      const deleteOptions: any = {
        memberCalendarEmail: (reservation.users as any)?.google_calendar_email,
        trainerExternalEventId: (reservation as any).trainer_external_event_id || null,
      }

      // If reservation has a trainer assigned, get their calendar ID
      if (reservation.trainer_id) {
        const { data: trainer } = await supabaseAdmin
          .from('trainers')
          .select('google_calendar_id')
          .eq('id', reservation.trainer_id)
          .single()
        
        if (trainer?.google_calendar_id) {
            deleteOptions.trainerCalendarEmail = trainer.google_calendar_id
        }
      }

      const calendarService = createGoogleCalendarService()
      if (calendarService) {
        try {
          await calendarService.deleteEvent(
            reservation.external_event_id, 
            reservation.calendar_id,
            deleteOptions
          )
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
    // Check authentication (Session or Token)
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    
    let user = null
    let isUserAdmin = false
    let isTrainer = false

    if (token) {
      // Trainer token authentication
      const { data: trainer, error } = await supabaseAdmin
        .from('trainers')
        .select('id, full_name, email, store_id')
        .eq('access_token', token)
        .eq('status', 'active')
        .single()

      if (error || !trainer) {
        return NextResponse.json({ error: '無効なトークンです' }, { status: 401 })
      }

      // Get store calendar_id
      const { data: store, error: storeError } = await supabaseAdmin
        .from('stores')
        .select('calendar_id')
        .eq('id', trainer.store_id)
        .single()

      if (storeError) {
        console.error('Store lookup error:', storeError)
      }

      user = {
        id: trainer.id,
        email: trainer.email,
        name: trainer.full_name,
        storeId: trainer.store_id,
        calendarId: store?.calendar_id
      }
      isTrainer = true
    } else {
      // Session authentication
      const authResult = await requireAuth()
      if (authResult instanceof NextResponse) {
        return authResult
      }
      user = authResult.user
      isUserAdmin = authResult.isAdmin
    }

    const reservationId = params.id

    // Parse request body
    const body = await request.json()
    const { title, startTime, endTime, notes, trainerId } = body

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
        start_time,
        end_time,
        external_event_id,
        calendar_id,
        trainer_id,
        users!client_id (
          email,
          full_name,
          google_calendar_email,
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
    const canUpdate = isUserAdmin || 
                      (reservation.users as any)?.email === user.email ||
                      (isTrainer && reservation.calendar_id === user.calendarId)

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

    // Check for time conflicts with other reservations (same store only)
    // Skip conflict check for BLOCKED reservations (予約不可 can overlap with other reservations)
    const isBlocked = !reservation.client_id
    if (!isBlocked) {
      const { data: conflicts, error: conflictError } = await supabaseAdmin
        .from('reservations')
        .select('id')
        .eq('calendar_id', reservation.calendar_id)
        .neq('id', reservationId)
        .lt('start_time', endDateTime.toISOString())
        .gt('end_time', startDateTime.toISOString())

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
    }

    // Update Google Calendar event first (if event exists)
    if (reservation.external_event_id) {
      const calendarService = createGoogleCalendarService()
      if (calendarService) {
        try {
          const userRel: any = reservation.users
          const updateOptions: any = {
            title,
            startTime: startDateTime.toISOString(),
            endTime: endDateTime.toISOString(),
            clientName: userRel?.full_name || '予約不可時間',
            clientEmail: userRel?.email || 'blocked@system',
            notes: notes || undefined,
            calendarId: reservation.calendar_id,
            memberCalendarEmail: userRel?.google_calendar_email || null
          }

          // Handle trainer calendar
          const targetTrainerId = trainerId !== undefined ? trainerId : reservation.trainer_id
          if (targetTrainerId) {
            const { data: trainer } = await supabaseAdmin
              .from('trainers')
              .select('google_calendar_id')
              .eq('id', targetTrainerId)
              .single()
            
            if (trainer?.google_calendar_id) {
              updateOptions.trainerCalendarEmail = trainer.google_calendar_id
            }
          }

          await calendarService.updateEvent(reservation.external_event_id, updateOptions)
          console.log('Google Calendar event updated:', reservation.external_event_id)
        } catch (calendarError) {
          console.error('Calendar event update failed:', calendarError)
          // Continue with reservation update even if calendar sync fails
        }
      }
    }

    // Update the reservation
    const updateData: any = {
      title: title,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      notes: notes || null
    }

    // Only update trainer_id if it's provided in the request (not for training)
    const isTrainingReservation = reservation.title === '研修' && !reservation.client_id
    if (trainerId !== undefined && !isTrainingReservation) {
      updateData.trainer_id = trainerId || null
    }

    // For training reservations: update ALL sibling records (same title, same original time)
    if (isTrainingReservation) {
      const trainingUpdateData = {
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        notes: notes || null,
      }

      const { error: trainingUpdateError } = await supabaseAdmin
        .from('reservations')
        .update(trainingUpdateData)
        .eq('title', '研修')
        .eq('start_time', reservation.start_time)
        .eq('end_time', reservation.end_time)
        .is('client_id', null)

      if (trainingUpdateError) {
        console.error('Training reservation group update error:', trainingUpdateError)
        return NextResponse.json(
          { error: '研修予約の一括更新に失敗しました' },
          { status: 500 }
        )
      }

      console.log(`✅ Updated all training reservation records (original time: ${reservation.start_time} - ${reservation.end_time})`)
    } else {
      const { error: updateError } = await supabaseAdmin
        .from('reservations')
        .update(updateData)
        .eq('id', reservationId)

      if (updateError) {
        console.error('Reservation update error:', updateError)
        return NextResponse.json(
          { error: '予約の更新に失敗しました' },
          { status: 500 }
        )
      }
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
