import { supabaseAdmin } from './supabase'
import { createGoogleCalendarService } from './google-calendar'

// Parse max count from plan string like "6回", "8回", fallback mapping for known labels
function getPlanMaxCount(plan: string | undefined): number {
  if (!plan) return 4
  // explicit label
  if (plan === 'ダイエットコース') return 8
  // numeric like "6回", "8回", "3回" etc.
  const m = plan.match(/(\d+)\s*回/)
  if (m && m[1]) {
    const n = parseInt(m[1], 10)
    if (Number.isFinite(n) && n > 0) return n
  }
  // fallbacks
  if (plan.includes('8回')) return 8
  if (plan.includes('6回')) return 6
  if (plan.includes('2回')) return 2
  return 4
}

function monthStartJST(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 1) - 9 * 60 * 60 * 1000)
}

function jstMonthKey(value: string | Date): string {
  const date = new Date(value)
  date.setHours(date.getHours() + 9)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth()).padStart(2, '0')}`
}

/**
 * Monthly personal-training allowance, including unused sessions from only
 * the previous two calendar months.
 */
async function getMonthlyPersonalAllowance(clientId: string, year: number, month: number, baseCount: number): Promise<number> {
  const rangeStart = monthStartJST(year, month - 2)
  const rangeEnd = monthStartJST(year, month)
  const [{ data, error }, { data: histories, error: historyError }, { data: user, error: userError }] = await Promise.all([
    supabaseAdmin
      .from('reservations')
      .select('start_time')
      .eq('client_id', clientId)
      .gte('start_time', rangeStart.toISOString())
      .lt('start_time', rangeEnd.toISOString()),
    supabaseAdmin
      .from('membership_history')
      .select('start_date, end_date, status, plan')
      .eq('user_id', clientId)
      .order('start_date', { ascending: false }),
    supabaseAdmin
      .from('users')
      .select('billing_start_month')
      .eq('id', clientId)
      .single(),
  ])

  if (error || historyError || userError) {
    console.error('Error fetching carryover data:', error || historyError || userError)
    return baseCount
  }

  const counts = new Map<string, number>()
  for (const reservation of data || []) {
    const key = jstMonthKey(reservation.start_time)
    counts.set(key, (counts.get(key) || 0) + 1)
  }

  const previousMonth = new Date(Date.UTC(year, month - 1, 1))
  const twoMonthsAgo = new Date(Date.UTC(year, month - 2, 1))
  const previousKey = `${previousMonth.getUTCFullYear()}-${String(previousMonth.getUTCMonth()).padStart(2, '0')}`
  const twoMonthsAgoKey = `${twoMonthsAgo.getUTCFullYear()}-${String(twoMonthsAgo.getUTCMonth()).padStart(2, '0')}`
  const previousUsage = counts.get(previousKey) || 0
  const twoMonthsAgoUsage = counts.get(twoMonthsAgoKey) || 0

  const monthlyEntitlement = (target: Date): number => {
    const targetYear = target.getUTCFullYear()
    const targetMonth = target.getUTCMonth()
    const monthStart = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-01`
    const nextMonthStart = new Date(Date.UTC(targetYear, targetMonth + 1, 1))
    nextMonthStart.setUTCDate(nextMonthStart.getUTCDate() - 1)
    const monthEnd = nextMonthStart.toISOString().slice(0, 10)

    if (user?.billing_start_month && user.billing_start_month > monthEnd) return 0

    const history = (histories || []).find(record =>
      record.start_date <= monthEnd &&
      (!record.end_date || record.end_date >= monthStart)
    )

    if (!history || history.status !== 'active' || usesCumulativeCount(history.plan || '')) return 0
    return getPlanMaxCount(history.plan || '')
  }

  const previousEntitlement = monthlyEntitlement(previousMonth)
  const twoMonthsAgoEntitlement = monthlyEntitlement(twoMonthsAgo)

  // Older carryover is consumed first. This prevents the same unused session
  // from being counted again after it was already used in the next month.
  const twoMonthsAgoCarryover = Math.max(0, twoMonthsAgoEntitlement - twoMonthsAgoUsage)
  const remainingOlderCarryover = Math.max(0, twoMonthsAgoCarryover - previousUsage)
  const previousMonthUsageAfterCarryover = Math.max(0, previousUsage - twoMonthsAgoCarryover)
  const previousMonthCarryover = Math.max(0, previousEntitlement - previousMonthUsageAfterCarryover)

  return baseCount + remainingOlderCarryover + previousMonthCarryover
}

/**
 * Recalculate and update titles for all reservations of a specific client in a given month
 * This ensures proper chronological numbering when reservations are added out of order
 * Also updates Google Calendar events if they exist
 */
export async function updateMonthlyTitles(clientId: string, year: number, month: number) {
  try {
    // Get all reservations for this client in the specified month, ordered by start_time
    const { data: reservations, error } = await supabaseAdmin
      .from('reservations')
      .select(`
        id, 
        start_time, 
        end_time,
        title, 
        notes,
        calendar_id,
        external_event_id,
        users!client_id (
          id,
          full_name,
          email
        )
      `)
      .eq('client_id', clientId)
      .gte('start_time', new Date(Date.UTC(year, month, 1) - 9 * 60 * 60 * 1000).toISOString())
      .lt('start_time', new Date(Date.UTC(year, month + 1, 1) - 9 * 60 * 60 * 1000).toISOString())
      .order('start_time', { ascending: true })

    if (error) {
      console.error('Error fetching monthly reservations:', error)
      return false
    }

    if (!reservations || reservations.length === 0) {
      return true // No reservations to update
    }

    // Get client information directly from users table
    const { data: clientData, error: clientError } = await supabaseAdmin
      .from('users')
      .select('full_name, plan')
      .eq('id', clientId)
      .single()

    let clientName = 'Unknown'
    if (clientData && !clientError) {
      clientName = clientData.full_name
    } else {
      console.error('Error fetching client data:', clientError)
    }

    // Extract last name for title
    const lastName = extractLastName(clientName)

    // Determine plan max count for this client (fallback safe)
    const plan = (clientData as any)?.plan || ''
    const maxCount = getPlanMaxCount(plan)
    
    // Check if plan uses cumulative count
    const isCumulative = usesCumulativeCount(plan)

    // Initialize Google Calendar service
    const calendarService = createGoogleCalendarService()
    const monthlyAllowance = isCumulative
      ? maxCount
      : await getMonthlyPersonalAllowance(clientId, year, month, maxCount)

    // Update each reservation with correct sequential number
    const updates = reservations.map(async (reservation, index) => {
      // Generate title based on plan type
      const newTitle = isCumulative 
        ? `${lastName}${index + 1}`  // Diet/Counseling: "山口1"
        : `${lastName}${index + 1}/${monthlyAllowance}`  // Personal: "山口1/4"

      // Skip if title hasn't changed (no need to update DB or Google Calendar)
      if (reservation.title === newTitle) {
        return true
      }

      // Normalize user shape (object or single-element array)
      const userRel: any = Array.isArray((reservation as any).users)
        ? (reservation as any).users[0]
        : (reservation as any).users

      // Keep the existing Google event and update it in place. Deleting first can
      // leave the old event behind when Google rejects the delete, which creates
      // duplicates when the replacement is inserted.
      // For newly-created reservations external_event_id is still empty; creating here would
      // duplicate the later calendar-create flow.
      if (calendarService && userRel && reservation.external_event_id) {
        try {
          await calendarService.updateEvent(reservation.external_event_id, {
            title: getReservationCalendarTitle(newTitle),
            startTime: reservation.start_time,
            endTime: reservation.end_time,
            clientName: userRel.full_name,
            clientEmail: userRel.email,
            notes: reservation.notes || undefined,
            calendarId: reservation.calendar_id,
          })

          await supabaseAdmin
            .from('reservations')
            .update({
              title: newTitle,
              calendar_sync_status: 'synced',
              calendar_sync_action: 'update',
              calendar_sync_error: null,
              calendar_synced_at: new Date().toISOString(),
            })
            .eq('id', reservation.id)

          return true
        } catch (calendarError) {
          console.error(`Failed to update calendar event for reservation ${reservation.id}:`, calendarError)
          // Keep the event ID and leave a retryable sync state. The retry worker
          // will update the same event instead of creating another one.
          await supabaseAdmin
            .from('reservations')
            .update({
              title: newTitle,
              calendar_sync_status: 'failed',
              calendar_sync_action: 'update',
              calendar_sync_error: calendarError instanceof Error ? calendarError.message : String(calendarError),
            })
            .eq('id', reservation.id)
          return false
        }
      } else {
        // Calendar not configured or no event yet: DB-only title update.
        await supabaseAdmin
          .from('reservations')
          .update({ title: newTitle })
          .eq('id', reservation.id)
        return false
      }
    })

    // Execute all updates
    await Promise.all(updates)
    
    console.log(`Updated ${reservations.length} reservation titles (DB + Calendar) for client ${clientId} in ${year}/${month + 1}`)
    return true
  } catch (error) {
    console.error('Error updating monthly titles:', error)
    return false
  }
}

/**
 * Check if plan uses cumulative (non-resetting) count
 * Diet courses and counseling use cumulative counting
 */
export function usesCumulativeCount(plan: string): boolean {
  if (!plan) return false
  
  // Normalize: trim whitespace and convert to lowercase for comparison
  const normalized = plan.trim().toLowerCase()
  
  // Check for diet/counseling in various formats
  const isDiet = 
    plan.includes('ダイエット') ||
    normalized.includes('diet')
  
  const isCounseling = 
    plan.includes('カウンセリング') ||
    normalized.includes('counseling')
  
  // Log for debugging
  if (isDiet || isCounseling) {
    console.log('[usesCumulativeCount] Cumulative plan detected:', { 
      plan, 
      normalized, 
      isDiet, 
      isCounseling 
    })
  }
  
  return isDiet || isCounseling
}

/**
 * Extract last name (surname) from full name
 * Handles both half-width and full-width spaces
 */
function extractLastName(fullName: string): string {
  if (!fullName) return ''
  // Split by half-width or full-width space
  const nameParts = fullName.split(/\s|　/)
  return nameParts[0] || fullName
}

/** Build a member-facing label from the existing monthly reservation suffix. */
export function getPersonalSessionNotificationLabel(title?: string | null): string | null {
  const match = title?.match(/(\d+)\/(\d+)$/)
  return match ? `パーソナルトレーニング${match[1]}/${match[2]}回目` : null
}

export function getReservationCalendarTitle(title?: string | null): string {
  return title || '予約'
}

/**
 * Get the correct title for a new reservation based on chronological order
 */
export async function generateReservationTitle(
  clientId: string, 
  clientName: string, 
  startDateTime: Date
): Promise<string> {
  // Fetch membership history for that specific date to determine the plan
  const { data: historyRecord } = await supabaseAdmin
    .from('membership_history')
    .select('plan')
    .eq('user_id', clientId)
    .lte('start_date', startDateTime.toISOString().split('T')[0])
    .or(`end_date.is.null,end_date.gte.${startDateTime.toISOString().split('T')[0]}`)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  let plan = (historyRecord as any)?.plan || ''
  if (!plan) {
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('plan')
      .eq('id', clientId)
      .single()
    plan = userData?.plan || ''
  }
  const maxCount = getPlanMaxCount(plan)
  const isCumulative = usesCumulativeCount(plan)
  const lastName = extractLastName(clientName)

  if (isCumulative) {
    // Diet/Counseling: cumulative count across all time
    const { data: existingReservations, error } = await supabaseAdmin
      .from('reservations')
      .select('id, start_time')
      .eq('client_id', clientId)
      .order('start_time', { ascending: true })

    if (error) {
      console.error('Error fetching existing reservations:', error)
      return `${lastName}1`
    }

    const reservationsBeforeThis = existingReservations?.filter(r => 
      new Date(r.start_time) < startDateTime
    ) || []
    
    return `${lastName}${reservationsBeforeThis.length + 1}`
  } else {
    // Personal training: monthly count
    const startJst = new Date(startDateTime.getTime() + 9 * 60 * 60 * 1000)
    const targetYear = startJst.getUTCFullYear()
    const targetMonth = startJst.getUTCMonth()
    const monthStart = monthStartJST(targetYear, targetMonth)
    const monthEnd = monthStartJST(targetYear, targetMonth + 1)

    const { data: monthReservations, error } = await supabaseAdmin
      .from('reservations')
      .select('id, start_time')
      .eq('client_id', clientId)
      .gte('start_time', monthStart.toISOString())
      .lt('start_time', monthEnd.toISOString())
      .order('start_time', { ascending: true })

    if (error) {
      console.error('Error fetching monthly reservations:', error)
      return `${lastName}1/${maxCount}`
    }

    const reservationsBeforeThis = monthReservations?.filter(r =>
      new Date(r.start_time) < startDateTime
    ) || []

    const monthlyAllowance = await getMonthlyPersonalAllowance(
      clientId,
      targetYear,
      targetMonth,
      maxCount
    )

    return `${lastName}${reservationsBeforeThis.length + 1}/${monthlyAllowance}`
  }
}

/**
 * Recalculate and update titles for all reservations of a specific client (cumulative)
 * Keeps chronological numbering 1..N and updates Google Calendar events if configured.
 */
export async function updateAllTitles(clientId: string) {
  try {
    // Fetch all reservations for the client ordered by time
    const { data: reservations, error } = await supabaseAdmin
      .from('reservations')
      .select(`
        id,
        start_time,
        end_time,
        title,
        notes,
        calendar_id,
        external_event_id,
        users!client_id (
          id,
          full_name,
          email,
          plan
        )
      `)
      .eq('client_id', clientId)
      .order('start_time', { ascending: true })

    if (error) {
      console.error('Error fetching all reservations:', error)
      return false
    }

    if (!reservations || reservations.length === 0) return true

    // Client info
    const userRel: any = Array.isArray((reservations[0] as any).users)
      ? (reservations[0] as any).users[0]
      : (reservations[0] as any).users
    const clientName = userRel?.full_name || 'Unknown'
    const lastName = extractLastName(clientName)
    const plan = userRel?.plan || ''
    const maxCount = getPlanMaxCount(plan)
    
    // Check if plan uses cumulative count
    const isCumulative = usesCumulativeCount(plan)
    const reservationDate = new Date(reservations[0].start_time)
    const reservationJstDate = new Date(reservationDate)
    reservationJstDate.setHours(reservationJstDate.getHours() + 9)
    const monthlyAllowance = isCumulative
      ? maxCount
      : await getMonthlyPersonalAllowance(
        clientId,
        reservationJstDate.getUTCFullYear(),
        reservationJstDate.getUTCMonth(),
        maxCount
      )

    const calendarService = createGoogleCalendarService()

    const updates = reservations.map(async (reservation, index) => {
      // Generate title based on plan type
      const newTitle = isCumulative 
        ? `${lastName}${index + 1}`  // Diet/Counseling: "山口1"
        : `${lastName}${index + 1}/${monthlyAllowance}`  // Personal: "山口1/4"

      // Skip if title hasn't changed (no need to update DB or Google Calendar)
      if (reservation.title === newTitle) {
        return true
      }

      // Normalize user shape per row
      const u: any = Array.isArray((reservation as any).users)
        ? (reservation as any).users[0]
        : (reservation as any).users

      // Only touch Google Calendar if this reservation already has an event.
      // New reservations get their first event from the dedicated calendar-create flow.
      if (calendarService && u && reservation.external_event_id) {
        try {
          await calendarService.updateEvent(reservation.external_event_id, {
            title: getReservationCalendarTitle(newTitle),
            startTime: reservation.start_time,
            endTime: reservation.end_time,
            clientName: u.full_name,
            clientEmail: u.email,
            notes: reservation.notes || undefined,
            calendarId: reservation.calendar_id,
          })
          await supabaseAdmin.from('reservations').update({
            title: newTitle,
            calendar_sync_status: 'synced',
            calendar_sync_action: 'update',
            calendar_sync_error: null,
            calendar_synced_at: new Date().toISOString(),
          }).eq('id', reservation.id)
          return true
        } catch (err) {
          console.error('Calendar sync failed while updating titles:', err)
          await supabaseAdmin.from('reservations').update({
            title: newTitle,
            calendar_sync_status: 'failed',
            calendar_sync_action: 'update',
            calendar_sync_error: err instanceof Error ? err.message : String(err),
          }).eq('id', reservation.id)
          return false
        }
      } else {
        await supabaseAdmin.from('reservations').update({ title: newTitle }).eq('id', reservation.id)
        return false
      }
    })

    await Promise.all(updates)
    return true
  } catch (err) {
    console.error('updateAllTitles error:', err)
    return false
  }
}
