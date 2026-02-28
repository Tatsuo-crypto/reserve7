import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth, handleApiError } from '@/lib/api-utils'
import { createGoogleCalendarService } from '@/lib/google-calendar'
import { generateReservationTitle, updateMonthlyTitles, updateAllTitles, usesCumulativeCount } from '@/lib/title-utils'
import { sendTrainerNotification } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    let user = null
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

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
        isAdmin: false,
        isTrainer: true,
        storeId: trainer.store_id,
        calendarId: store?.calendar_id // Use calendar_id from stores table (email format)
      }
    } else {
      // Admin session authentication
      const authResult = await requireAdminAuth()
      if (authResult instanceof NextResponse) {
        return authResult
      }
      user = authResult.user
    }

    const body = await request.json()

    // Validate input
    const { clientId, startTime, duration, notes, skipShiftCheck } = body
    let trainerId = body.trainerId || null

    // Use calendarId for reservations (email format)
    const calendarId = (user as any).calendarId || user.storeId

    if (!clientId || !startTime || !duration) {
      return NextResponse.json(
        { error: '会員ID、開始時間、セッション時間は必須です' },
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
    let trainerCalendarEmail: string | null = null
    let trainerNotifyEmail: string | null = null

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
    } else if (clientId === 'GUEST') {
      // For guest reservation, use provided title from request
      generatedTitle = body.title || 'ゲスト予約'
    } else if (clientId === 'TRAINING') {
      // For training reservation
      generatedTitle = body.title || '研修'
    } else {
      // Get client user by ID for regular reservations
      const { data: fetchedUser, error: clientError } = await supabaseAdmin
        .from('users')
        .select('id, full_name, email, google_calendar_email, store_id, plan')
        .eq('id', clientId)
        .single()

      if (clientError || !fetchedUser) {
        return NextResponse.json(
          { error: '会員が見つかりません' },
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
    // Skip overlap check for 2nd store, BLOCKED, and TRAINING types
    if (calendarId !== 'tandjgym2goutenn@gmail.com' && clientId !== 'BLOCKED' && clientId !== 'TRAINING') {
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

    // Check for trainer shift availability
    // Skip this check for BLOCKED type (we want to be able to block off-hours)
    // Also skip for GUEST/TRIAL if we want to be flexible, but usually they should respect shifts too.
    // Let's enforce for all "active" reservation types (Client, Trial, Guest)
    if (clientId !== 'BLOCKED' && clientId !== 'TRAINING') {
      try {
        // 1. Get all active trainers for this store (use UUID storeId, not email calendarId)
        const storeUUID = user.storeId
        console.log('🔍 Shift check - storeUUID:', storeUUID)
        const { data: trainers, error: trainersError } = await supabaseAdmin
          .from('trainers')
          .select('id')
          .eq('store_id', storeUUID)
          .eq('status', 'active')

        const isTrainerAuth = !!(user as any).isTrainer

        if (trainersError) {
          console.error('Error fetching trainers for shift check:', trainersError)
        } else if (trainers && trainers.length > 0) {
          const trainerIds = trainers.map(t => t.id)

          // --- Compute JST-based day of week and time strings for template comparison ---
          const jstOffset = 9 * 60 * 60 * 1000
          const startJst = new Date(startDateTime.getTime() + jstOffset)
          const endJst = new Date(endDateTime.getTime() + jstOffset)
          const dayOfWeekJst = startJst.getUTCDay() // 0=Sun, 1=Mon, ...6=Sat
          const startHHMM = `${String(startJst.getUTCHours()).padStart(2, '0')}:${String(startJst.getUTCMinutes()).padStart(2, '0')}`
          const endHHMM = `${String(endJst.getUTCHours()).padStart(2, '0')}:${String(endJst.getUTCMinutes()).padStart(2, '0')}`

          console.log(`🔍 Shift check - JST day: ${dayOfWeekJst}, time: ${startHHMM}-${endHHMM}`)

          // Check 1: Actual trainer_shifts record - auto-assign trainer if found
          const { data: shifts, error: shiftsError } = await supabaseAdmin
            .from('trainer_shifts')
            .select('id, trainer_id')
            .in('trainer_id', trainerIds)
            .lte('start_time', startDateTime.toISOString())
            .gte('end_time', endDateTime.toISOString())
            .limit(1)

          if (!shiftsError && shifts && shifts.length > 0) {
            if (!trainerId) {
              trainerId = shifts[0].trainer_id
              console.log('Auto-assigned trainerId from shift:', trainerId)
            }
          } else {
            // Check 2: trainer_shift_templates for auto-assignment
            const { data: templates } = await supabaseAdmin
              .from('trainer_shift_templates')
              .select('id, trainer_id, day_of_week, start_time, end_time')
              .in('trainer_id', trainerIds)
              .eq('day_of_week', dayOfWeekJst)

            const matchingTemplate = templates && templates.find(t =>
              t.start_time <= startHHMM && t.end_time >= endHHMM
            )

            if (matchingTemplate) {
              console.log('Template shift covers this time. Template:', matchingTemplate)
              if (!trainerId) {
                trainerId = matchingTemplate.trainer_id
                console.log('Auto-assigned trainerId from template:', trainerId)
              }
            } else {
              // シフトもテンプレートも見つからない場合でも予約は通過させる
              // (タイムライン上での視覚的なシフト表示で制御する方針)
              console.log(`No shift/template found for this time - allowing reservation anyway (isTrainerAuth: ${isTrainerAuth})`)
            }
          }
        }
      } catch (error) {
        console.error('Shift availability check failed:', error)
      }
    }

    // Fetch trainer info after shift auto-assignment
    if (trainerId) {
      const { data: trainerInfo, error: trainerErr } = await supabaseAdmin
        .from('trainers')
        .select('id, full_name, email, google_calendar_id')
        .eq('id', trainerId)
        .single()

      if (!trainerErr && trainerInfo) {
        trainerName = trainerInfo.full_name
        trainerCalendarEmail = trainerInfo.google_calendar_id || null
        // 招待メール送信先: google_calendar_id（Gmail）を優先、なければemailを使用
        trainerNotifyEmail = trainerInfo.google_calendar_id || trainerInfo.email || null
        console.log('Trainer info resolved:', { trainerName, trainerCalendarEmail, trainerNotifyEmail })
      }
    }

    // Try to create Google Calendar event first (if configured)
    let externalEventId: string | null = null
    let trainerExternalEventId: string | null = null
    let calendarDebug: string = 'not attempted'
    const calendarService = createGoogleCalendarService()

    console.log('📅 Google Calendar Service:', calendarService ? 'Initialized' : 'Not configured')

    if (calendarService) {
      try {
        const clientName = clientId === 'BLOCKED'
          ? '予約不可時間'
          : clientId === 'TRIAL'
            ? generatedTitle
            : clientId === 'GUEST'
              ? generatedTitle
              : clientId === 'TRAINING'
                ? generatedTitle
                : clientUser!.full_name
        const clientEmail = clientId === 'BLOCKED'
          ? 'blocked@system'
          : clientId === 'TRIAL'
            ? 'trial@system'
            : clientId === 'GUEST'
              ? 'guest@system'
              : clientId === 'TRAINING'
                ? 'training@system'
                : clientUser!.email

        // 会員のGoogleカレンダーメールが設定されている場合、出席者として追加
        const memberCalendarEmail = clientUser?.google_calendar_email || null

        // TRAINING タイプは後のループで各トレーナーの店舗カレンダーにイベントを個別作成するためここではスキップ
        if (clientId !== 'TRAINING') {
          console.log('📅 Creating calendar event:', {
            title: generatedTitle,
            calendarId: calendarId,
            memberCalendarEmail: memberCalendarEmail || '(not set)',
          })

          const calResult = await calendarService.createEvent({
            title: generatedTitle,
            startTime: startDateTime.toISOString(),
            endTime: endDateTime.toISOString(),
            clientName,
            clientEmail,
            notes: notes || undefined,
            calendarId: calendarId,
            memberCalendarEmail, // 会員のカレンダーメールを渡す
            trainerCalendarEmail, // トレーナーのカレンダーメールを渡す
            trainerNotifyEmail, // トレーナーへの招待メール送信用
          })
          externalEventId = calResult.eventId
          trainerExternalEventId = calResult.trainerEventId || null

          calendarDebug = 'success: ' + externalEventId
        } else {
          calendarDebug = 'training: handled per-trainer below'
        }

        // TRAINING type: store calendar events are created per-store in the DB insert block below.
        // No separate personal calendar events needed to avoid duplication.
      } catch (calendarError) {
        calendarDebug = 'error: ' + (calendarError instanceof Error ? calendarError.message : String(calendarError))
        console.error('❌ Calendar event creation failed:', calendarDebug)
      }
    } else {
      calendarDebug = 'service not configured'
    }

    // Create reservation
    // Store notes as-is from user input. If empty, store null.
    const mergedNotes = notes || null

    // For TRAINING type: create one reservation per trainer on their store's calendar
    if (clientId === 'TRAINING' && body.trainingTrainerIds && body.trainingTrainerIds.length > 0) {
      const { data: trainingTrainers } = await supabaseAdmin
        .from('trainers')
        .select('id, full_name, store_id')
        .in('id', body.trainingTrainerIds)

      // Build a map from store UUID to calendar_id
      const trainerStoreIds = Array.from(new Set((trainingTrainers || []).map(t => t.store_id).filter(Boolean)))
      const { data: allStores } = await supabaseAdmin
        .from('stores')
        .select('id, calendar_id')
        .in('id', trainerStoreIds)

      const storeCalendarMap = new Map<string, string>()
      if (allStores) {
        for (const s of allStores) {
          if (s.calendar_id) storeCalendarMap.set(s.id, s.calendar_id)
        }
      }

      // Googleカレンダーには「店舗ごとに1イベントのみ」作成する
      // 同じ店舗に複数トレーナーがいても、カレンダーへの登録は1件に止める
      const storeEventIdMap = new Map<string, string | null>() // storeId -> eventId

      if (calendarService) {
        for (const storeId of trainerStoreIds) {
          const trainerCalId = storeCalendarMap.get(storeId) || calendarId
          try {
            const calResult = await calendarService.createEvent({
              title: generatedTitle,
              startTime: startDateTime.toISOString(),
              endTime: endDateTime.toISOString(),
              clientName: generatedTitle,
              clientEmail: 'training@system',
              notes: notes || undefined,
              calendarId: trainerCalId,
            })
            storeEventIdMap.set(storeId, calResult.eventId)
            console.log(`✅ Training calendar event created for store ${storeId} on ${trainerCalId}: ${calResult.eventId}`)
          } catch (calErr) {
            storeEventIdMap.set(storeId, null)
            console.error(`⚠️ Failed to create training calendar event for store ${storeId}:`, calErr instanceof Error ? calErr.message : calErr)
          }
        }
      }

      // Create one DB record per trainer, all sharing the same store-level event ID
      const reservationRows: any[] = []
      for (const t of (trainingTrainers || [])) {
        const trainerCalId = storeCalendarMap.get(t.store_id) || calendarId
        const trainingEventId = storeEventIdMap.get(t.store_id) || null

        reservationRows.push({
          client_id: null,
          title: generatedTitle,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          notes: mergedNotes,
          calendar_id: trainerCalId,
          external_event_id: trainingEventId,  // ← 店舗単位のイベントIDを全トレーナーで共有
          trainer_id: t.id,
        })
      }

      const { data: reservations, error } = await supabaseAdmin
        .from('reservations')
        .insert(reservationRows)
        .select('id, title, start_time, end_time, notes, created_at, trainer_id')

      if (error) {
        console.error('Training reservation creation error:', error)
        return NextResponse.json(
          { error: '研修予約の作成に失敗しました', details: (error as any)?.message },
          { status: 500 }
        )
      }

      console.log(`✅ Created ${reservations?.length} training reservation records (1 per trainer)`)

      return NextResponse.json({
        reservation: reservations?.[0],
        totalRecords: reservations?.length,
        calendarDebug,
      }, { status: 201 })
    }

    const reservationData = {
      client_id: (clientId === 'BLOCKED' || clientId === 'TRIAL' || clientId === 'GUEST') ? null : clientUser!.id,
      title: generatedTitle,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      notes: mergedNotes,
      calendar_id: calendarId,
      external_event_id: externalEventId,
      trainer_external_event_id: trainerExternalEventId,
      trainer_id: trainerId || null,
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
    // Update all titles for this client to maintain correct numbering
    // For diet/counseling: use cumulative count (all time)
    // For personal training: use monthly count
    if (clientId !== 'BLOCKED' && clientId !== 'TRIAL' && clientId !== 'GUEST' && clientUser) {
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

    console.log('=== RESERVATION CREATED ===', JSON.stringify({
      trainerId,
      trainerName,
      trainerCalendarEmail,
      externalEventId,
      calendarId,
      calendarDebug,
      title: reservation.title,
    }))

    // トレーナーにメール通知を送信（バックグラウンド、失敗しても予約作成には影響しない）
    if (trainerNotifyEmail && trainerName && clientId !== 'BLOCKED' && clientId !== 'TRAINING') {
      const clientName = clientId === 'TRIAL'
        ? generatedTitle
        : clientId === 'GUEST'
          ? generatedTitle
          : clientUser?.full_name || '不明'

      const storeName = calendarId === 'tandjgym@gmail.com' ? 'T&J GYM 1号店' : 'T&J GYM 2号店'

      sendTrainerNotification({
        trainerEmail: trainerNotifyEmail,
        trainerName,
        clientName,
        title: reservation.title,
        startTime: reservation.start_time,
        endTime: reservation.end_time,
        storeName,
        notes: reservation.notes || undefined,
      }).catch(err => console.error('Email notification error:', err))
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
        } : clientId === 'GUEST' ? {
          id: 'guest',
          fullName: 'ゲスト予約',
          email: 'guest@system',
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
