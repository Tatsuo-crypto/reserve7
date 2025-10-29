import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth, handleApiError } from '@/lib/api-utils'
import { createGoogleCalendarService } from '@/lib/google-calendar'
import { generateReservationTitle, updateMonthlyTitles, updateAllTitles, usesCumulativeCount } from '@/lib/title-utils'

export async function POST(request: NextRequest) {
  try {
    // Check authentication and admin role
    const authResult = await requireAdminAuth()
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { user } = authResult
    const body = await request.json()
    
    // Validate input
    const { clientId, startTime, duration, notes, trainerId } = body
    
    // Use calendarId for reservations (email format)
    const calendarId = (user as any).calendarId || user.storeId
    
    if (!clientId || !startTime || !duration) {
      return NextResponse.json(
        { error: 'クライアントID、開始時間、セッション時間は必須です' },
        { status: 400 }
      )
    }

    // Calculate end time from duration
    const startDateTime = new Date(startTime)
    const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 1000)

    // Handle blocked time vs trial vs regular reservation
    let clientUser = null
    let generatedTitle = ''
    
    let trainerName: string | null = null
    if (clientId === 'BLOCKED') {
      // For blocked time, use special values
      generatedTitle = body.title || '予約不可'
      // If trainerId specified, fetch trainer name to display under the blocked label
      if (trainerId) {
        const { data: trainer, error: trainerErr } = await supabaseAdmin
          .from('trainers')
          .select('id, full_name')
          .eq('id', trainerId)
          .single()
        if (!trainerErr && trainer) {
          trainerName = trainer.full_name
        }
      }
    } else if (clientId === 'TRIAL') {
      // For trial reservation, use provided title from request
      generatedTitle = body.title || '体験予約'
    } else {
      // Get client user by ID for regular reservations
      const { data: fetchedUser, error: clientError } = await supabaseAdmin
        .from('users')
        .select('id, full_name, email, google_calendar_email, store_id, plan')
        .eq('id', clientId)
        .single()

      if (clientError || !fetchedUser) {
        return NextResponse.json(
          { error: 'クライアントユーザーが見つかりません' },
          { status: 404 }
        )
      }
      
      clientUser = fetchedUser
      // Generate title based on chronological order
      generatedTitle = await generateReservationTitle(
        clientUser.id,
        clientUser.full_name,
        startDateTime
      )
    }


    // Check for overlapping reservations in the same calendar (excluding adjacent times)
    // Skip overlap check for 2nd store (tandjgym2goutenn@gmail.com) to allow multiple concurrent reservations
    if (calendarId !== 'tandjgym2goutenn@gmail.com') {
      const { data: existingReservations, error: overlapError } = await supabaseAdmin
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
    }

    // Check for blocked times that overlap with the reservation (skip if table doesn't exist)
    try {
      const { data: blockedTimes, error: blockedTimeError } = await supabaseAdmin
        .from('blocked_times')
        .select('id, reason, start_time, end_time')
        .eq('calendar_id', calendarId)
        .gt('end_time', startDateTime.toISOString())
        .lt('start_time', endDateTime.toISOString())

      if (blockedTimeError) {
        // If table doesn't exist, just log and continue
        if (blockedTimeError.code === 'PGRST116' || blockedTimeError.message.includes('does not exist')) {
          console.log('blocked_times table does not exist, skipping blocked time check')
        } else {
          console.error('Blocked time check error:', blockedTimeError)
          return NextResponse.json(
            { error: 'ブロック時間のチェックに失敗しました' },
            { status: 500 }
          )
        }
      } else if (blockedTimes && blockedTimes.length > 0) {
        const blockedTime = blockedTimes[0]
        return NextResponse.json(
          { 
            error: `この時間帯は予約不可です（${blockedTime.reason}）`,
            blockedTime: {
              reason: blockedTime.reason,
              startTime: blockedTime.start_time,
              endTime: blockedTime.end_time
            }
          },
          { status: 409 }
        )
      }
    } catch (error) {
      console.log('Error checking blocked times, continuing with reservation creation:', error)
    }

    // Try to create Google Calendar event first (if configured)
    let externalEventId: string | null = null
    const calendarService = createGoogleCalendarService()
    
    console.log('📅 Google Calendar Service:', calendarService ? 'Initialized' : 'Not configured')
    
    if (calendarService) {
      try {
        const clientName = clientId === 'BLOCKED' 
          ? '予約不可時間' 
          : clientId === 'TRIAL'
          ? generatedTitle
          : clientUser!.full_name
        const clientEmail = clientId === 'BLOCKED' 
          ? 'blocked@system' 
          : clientId === 'TRIAL'
          ? 'trial@system'
          : clientUser!.email
        
        // 会員のGoogleカレンダーメールが設定されている場合、出席者として追加
        const memberCalendarEmail = clientUser?.google_calendar_email || null
        
        console.log('📅 Creating calendar event:', {
          title: generatedTitle,
          calendarId: calendarId,
          memberCalendarEmail: memberCalendarEmail || '(not set)',
        })
        
        externalEventId = await calendarService.createEvent({
          title: generatedTitle,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          clientName,
          clientEmail,
          notes: notes || undefined,
          calendarId: calendarId,
          memberCalendarEmail, // 会員のカレンダーメールを渡す
        })
        
        console.log('✅ Google Calendar event created:', externalEventId)
      } catch (calendarError) {
        console.error('❌ Calendar event creation failed:', calendarError)
        if (calendarError instanceof Error) {
          console.error('Error message:', calendarError.message)
          console.error('Error stack:', calendarError.stack)
        }
        // Continue with reservation creation even if calendar sync fails
      }
    } else {
      console.warn('⚠️ Calendar service not available - skipping Google Calendar sync')
    }

    // Create reservation
    // For trial reservations, don't include notes
    const mergedNotes = clientId === 'TRIAL' ? null : [
      notes || null,
      trainerName ? `担当: ${trainerName}` : null,
    ].filter(Boolean).join(' / ')
    const reservationData = {
      client_id: (clientId === 'BLOCKED' || clientId === 'TRIAL') ? null : clientUser!.id,
      title: generatedTitle,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      notes: mergedNotes || null,
      calendar_id: calendarId,
      external_event_id: externalEventId,
    }

    const { data: reservation, error } = await supabaseAdmin
      .from('reservations')
      .insert(reservationData)
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
        { error: '予約の作成に失敗しました', details: (error as any)?.message || (error as any)?.hint || (error as any)?.code || null },
        { status: 500 }
      )
    }

    // Update all titles for this client to maintain correct numbering
    // For diet/counseling: use cumulative count (all time)
    // For personal training: use monthly count
    if (clientId !== 'BLOCKED' && clientId !== 'TRIAL' && clientUser) {
      const plan = clientUser.plan || ''
      const isCumulative = usesCumulativeCount(plan)
      
      console.log('[Reservation API] Title update decision:', {
        clientName: clientUser.full_name,
        plan,
        isCumulative,
        willUse: isCumulative ? 'updateAllTitles (cumulative)' : 'updateMonthlyTitles (monthly)'
      })
      
      if (isCumulative) {
        // Diet/Counseling: cumulative count across all months
        await updateAllTitles(clientUser.id)
      } else {
        // Personal training: monthly reset
        const startMonth = startDateTime.getMonth()
        const startYear = startDateTime.getFullYear()
        await updateMonthlyTitles(clientUser.id, startYear, startMonth)
      }
    }

    return NextResponse.json({
      message: '予約が作成されました',
      reservation: {
        id: reservation.id,
        title: reservation.title,
        startTime: reservation.start_time,
        endTime: reservation.end_time,
        notes: reservation.notes,
        createdAt: reservation.created_at,
        client: clientId === 'BLOCKED' ? {
          id: 'blocked',
          fullName: '予約不可時間',
          email: 'blocked@system',
        } : clientId === 'TRIAL' ? {
          id: 'trial',
          fullName: '体験予約',
          email: 'trial@system',
        } : !reservation.users ? {
          id: 'unknown',
          fullName: '不明',
          email: 'unknown@system',
        } : {
          id: (reservation.users as any).id,
          fullName: (reservation.users as any).full_name,
          email: (reservation.users as any).email,
        }
      }
    })

  } catch (error) {
    console.error('Admin reservation API error:', error)
    
    return handleApiError(error, 'Admin reservations POST')
  }
}
