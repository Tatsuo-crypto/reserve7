import { supabaseAdmin } from '@/lib/supabase'
import { createGoogleCalendarService } from '@/lib/google-calendar'

type CalendarCreatePayload = {
  reservationId: string
  title: string
  startTime: string
  endTime: string
  clientName: string
  clientEmail: string
  notes?: string
  calendarId: string
  memberCalendarEmail?: string | null
  trainerCalendarEmail?: string | null
  trainerNotifyEmail?: string | null
}

type CalendarSyncStatus = 'pending' | 'synced' | 'failed' | 'skipped'

async function updateSyncStatus(
  reservationId: string,
  status: CalendarSyncStatus,
  updates: Record<string, unknown> = {}
) {
  const payload = {
    calendar_sync_status: status,
    calendar_sync_attempted_at: new Date().toISOString(),
    ...updates,
  }

  const { error } = await supabaseAdmin
    .from('reservations')
    .update(payload)
    .eq('id', reservationId)

  if (error) {
    console.error('Failed to update reservation calendar sync status:', error.message)
  }
}

export async function markCalendarCreatePending(reservationId: string) {
  await updateSyncStatus(reservationId, 'pending', {
    calendar_sync_action: 'create',
    calendar_sync_error: null,
  })
}

export async function createReservationCalendarEvent(payload: CalendarCreatePayload) {
  const calendarService = createGoogleCalendarService()

  if (!calendarService) {
    await updateSyncStatus(payload.reservationId, 'skipped', {
      calendar_sync_action: 'create',
      calendar_sync_error: 'Google Calendar service is not configured',
    })
    return
  }

  try {
    const result = await calendarService.createEvent({
      title: payload.title,
      startTime: payload.startTime,
      endTime: payload.endTime,
      clientName: payload.clientName,
      clientEmail: payload.clientEmail,
      notes: payload.notes,
      calendarId: payload.calendarId,
      memberCalendarEmail: payload.memberCalendarEmail,
      trainerCalendarEmail: payload.trainerCalendarEmail,
      trainerNotifyEmail: payload.trainerNotifyEmail,
    })

    const { error } = await supabaseAdmin
      .from('reservations')
      .update({
        external_event_id: result.eventId,
        trainer_external_event_id: result.trainerEventId || null,
        calendar_sync_status: 'synced',
        calendar_sync_action: 'create',
        calendar_sync_error: null,
        calendar_sync_attempted_at: new Date().toISOString(),
        calendar_synced_at: new Date().toISOString(),
      })
      .eq('id', payload.reservationId)

    if (error) {
      console.error('Failed to persist calendar event id:', error.message)
    }
  } catch (error) {
    await updateSyncStatus(payload.reservationId, 'failed', {
      calendar_sync_action: 'create',
      calendar_sync_error: error instanceof Error ? error.message : String(error),
    })
  }
}

export async function retryPendingCalendarCreates(limit = 20) {
  const { data: reservations, error } = await supabaseAdmin
    .from('reservations')
    .select(`
      id,
      title,
      start_time,
      end_time,
      notes,
      calendar_id,
      trainer_id,
      users!client_id (
        full_name,
        email,
        google_calendar_email
      )
    `)
    .in('calendar_sync_status', ['pending', 'failed'])
    .eq('calendar_sync_action', 'create')
    .is('external_event_id', null)
    .gte('start_time', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('start_time', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('Failed to fetch pending calendar sync reservations:', error.message)
    return { attempted: 0 }
  }

  let attempted = 0
  for (const reservation of reservations || []) {
    const user = Array.isArray((reservation as any).users)
      ? (reservation as any).users[0]
      : (reservation as any).users

    let trainerCalendarEmail: string | null = null
    let trainerNotifyEmail: string | null = null
    if ((reservation as any).trainer_id) {
      const { data: trainer } = await supabaseAdmin
        .from('trainers')
        .select('email, google_calendar_id')
        .eq('id', (reservation as any).trainer_id)
        .single()

      trainerCalendarEmail = trainer?.google_calendar_id || null
      trainerNotifyEmail = trainer?.google_calendar_id || trainer?.email || null
    }

    attempted += 1
    await createReservationCalendarEvent({
      reservationId: reservation.id,
      title: reservation.title,
      startTime: reservation.start_time,
      endTime: reservation.end_time,
      clientName: user?.full_name || reservation.title || '予約',
      clientEmail: user?.email || 'system@reservation',
      notes: reservation.notes || undefined,
      calendarId: reservation.calendar_id,
      memberCalendarEmail: user?.google_calendar_email || null,
      trainerCalendarEmail,
      trainerNotifyEmail,
    })
  }

  return { attempted }
}

