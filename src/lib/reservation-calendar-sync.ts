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

type CalendarUpdatePayload = {
  reservationId: string
  eventId: string
  title: string
  startTime: string
  endTime: string
  clientName: string
  clientEmail: string
  notes?: string
  calendarId: string
  memberCalendarEmail?: string | null
  trainerCalendarEmail?: string | null
}

type CalendarDeletePayload = {
  eventId: string
  calendarId: string
  memberCalendarEmail?: string | null
  trainerCalendarEmail?: string | null
  trainerExternalEventId?: string | null
}

type CalendarSyncStatus = 'pending' | 'synced' | 'failed' | 'skipped'
type CalendarJobStatus = CalendarSyncStatus | 'processing'

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

export async function markCalendarUpdatePending(reservationId: string) {
  await updateSyncStatus(reservationId, 'pending', {
    calendar_sync_action: 'update',
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

export async function updateReservationCalendarEvent(payload: CalendarUpdatePayload) {
  const calendarService = createGoogleCalendarService()

  if (!calendarService) {
    await updateSyncStatus(payload.reservationId, 'skipped', {
      calendar_sync_action: 'update',
      calendar_sync_error: 'Google Calendar service is not configured',
    })
    return
  }

  try {
    await calendarService.updateEvent(payload.eventId, {
      title: payload.title,
      startTime: payload.startTime,
      endTime: payload.endTime,
      clientName: payload.clientName,
      clientEmail: payload.clientEmail,
      notes: payload.notes,
      calendarId: payload.calendarId,
      memberCalendarEmail: payload.memberCalendarEmail,
      trainerCalendarEmail: payload.trainerCalendarEmail,
    })

    await updateSyncStatus(payload.reservationId, 'synced', {
      calendar_sync_action: 'update',
      calendar_sync_error: null,
      calendar_synced_at: new Date().toISOString(),
    })
  } catch (error) {
    await updateSyncStatus(payload.reservationId, 'failed', {
      calendar_sync_action: 'update',
      calendar_sync_error: error instanceof Error ? error.message : String(error),
    })
  }
}

export async function deleteReservationCalendarEvent(payload: CalendarDeletePayload) {
  const calendarService = createGoogleCalendarService()
  if (!calendarService) return

  try {
    await calendarService.deleteEvent(payload.eventId, payload.calendarId, {
      memberCalendarEmail: payload.memberCalendarEmail,
      trainerCalendarEmail: payload.trainerCalendarEmail,
      trainerExternalEventId: payload.trainerExternalEventId,
    })
  } catch (error: any) {
    if (error?.code === 404 || error?.response?.status === 404) return
    throw error
  }
}

async function updateCalendarSyncJob(
  jobId: string,
  status: CalendarJobStatus,
  updates: Record<string, unknown> = {}
) {
  const { error } = await supabaseAdmin
    .from('reservation_calendar_sync_jobs')
    .update({
      status,
      updated_at: new Date().toISOString(),
      ...updates,
    })
    .eq('id', jobId)

  if (error) {
    console.error('Failed to update calendar sync job:', error.message)
  }
}

export async function enqueueCalendarDeleteJob(payload: CalendarDeletePayload) {
  const { data, error } = await supabaseAdmin
    .from('reservation_calendar_sync_jobs')
    .insert({
      action: 'delete',
      status: 'pending',
      payload,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Failed to enqueue calendar delete job:', error.message)
    return null
  }

  return data?.id as string | null
}

export async function processCalendarDeleteJob(jobId: string, payload: CalendarDeletePayload) {
  await updateCalendarSyncJob(jobId, 'processing', {
    attempted_at: new Date().toISOString(),
    attempts: 1,
  })

  const calendarService = createGoogleCalendarService()
  if (!calendarService) {
    await updateCalendarSyncJob(jobId, 'skipped', {
      last_error: 'Google Calendar service is not configured',
      attempted_at: new Date().toISOString(),
    })
    return
  }

  try {
    await deleteReservationCalendarEvent(payload)
    await updateCalendarSyncJob(jobId, 'synced', {
      last_error: null,
      attempted_at: new Date().toISOString(),
      synced_at: new Date().toISOString(),
    })
  } catch (error) {
    await updateCalendarSyncJob(jobId, 'failed', {
      last_error: error instanceof Error ? error.message : String(error),
      attempted_at: new Date().toISOString(),
    })
  }
}

export async function retryPendingCalendarSyncJobs(limit = 20) {
  const { data: jobs, error } = await supabaseAdmin
    .from('reservation_calendar_sync_jobs')
    .select('id, action, payload, attempts')
    .in('status', ['pending', 'failed'])
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('Failed to fetch pending calendar sync jobs:', error.message)
    return { attempted: 0 }
  }

  let attempted = 0
  for (const job of jobs || []) {
    if (job.action !== 'delete') continue
    attempted += 1

    await updateCalendarSyncJob(job.id, 'processing', {
      attempted_at: new Date().toISOString(),
      attempts: (job.attempts || 0) + 1,
    })

    try {
      await deleteReservationCalendarEvent(job.payload as CalendarDeletePayload)
      await updateCalendarSyncJob(job.id, 'synced', {
        last_error: null,
        attempted_at: new Date().toISOString(),
        synced_at: new Date().toISOString(),
      })
    } catch (error) {
      await updateCalendarSyncJob(job.id, 'failed', {
        last_error: error instanceof Error ? error.message : String(error),
        attempted_at: new Date().toISOString(),
      })
    }
  }

  return { attempted }
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
      external_event_id,
      calendar_sync_action,
      trainer_id,
      users!client_id (
        full_name,
        email,
        google_calendar_email
      )
    `)
    .in('calendar_sync_status', ['pending', 'failed'])
    .in('calendar_sync_action', ['create', 'update'])
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
    const basePayload = {
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
    }

    if ((reservation as any).calendar_sync_action === 'update' && (reservation as any).external_event_id) {
      await updateReservationCalendarEvent({
        ...basePayload,
        eventId: (reservation as any).external_event_id,
      })
    } else if ((reservation as any).calendar_sync_action === 'create' && !(reservation as any).external_event_id) {
      await createReservationCalendarEvent({
        ...basePayload,
        trainerNotifyEmail,
      })
    }
  }

  return { attempted }
}
