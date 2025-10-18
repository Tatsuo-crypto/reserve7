import { supabase } from './supabase'
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

/**
 * Recalculate and update titles for all reservations of a specific client in a given month
 * This ensures proper chronological numbering when reservations are added out of order
 * Also updates Google Calendar events if they exist
 */
export async function updateMonthlyTitles(clientId: string, year: number, month: number) {
  try {
    // Get all reservations for this client in the specified month, ordered by start_time
    const { data: reservations, error } = await supabase
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
      .gte('start_time', new Date(year, month, 1).toISOString())
      .lt('start_time', new Date(year, month + 1, 1).toISOString())
      .order('start_time', { ascending: true })

    if (error) {
      console.error('Error fetching monthly reservations:', error)
      return false
    }

    if (!reservations || reservations.length === 0) {
      return true // No reservations to update
    }

    // Get client information directly from users table
    const { data: clientData, error: clientError } = await supabase
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

    // Update each reservation with correct sequential number
    const updates = reservations.map(async (reservation, index) => {
      // Generate title based on plan type
      const newTitle = isCumulative 
        ? `${lastName}${index + 1}`  // Diet/Counseling: "山口1"
        : `${lastName}${index + 1}/${maxCount}`  // Personal: "山口1/4"

      // Skip if title hasn't changed (no need to update DB or Google Calendar)
      if (reservation.title === newTitle) {
        return true
      }

      // Normalize user shape (object or single-element array)
      const userRel: any = Array.isArray((reservation as any).users)
        ? (reservation as any).users[0]
        : (reservation as any).users

      // If Google Calendar is configured and we have client info, delete and recreate the event
      if (calendarService && userRel) {
        try {
          // Delete existing event if any
          if (reservation.external_event_id) {
            try {
              await calendarService.deleteEvent(reservation.external_event_id, reservation.calendar_id)
            } catch (delErr) {
              console.error(`Failed to delete calendar event ${reservation.external_event_id}:`, delErr)
              // continue to recreate regardless
            }
          }

          // Create new event with updated title
          const newEventId = await calendarService.createEvent({
            title: newTitle,
            startTime: reservation.start_time,
            endTime: reservation.end_time,
            clientName: userRel.full_name,
            clientEmail: userRel.email,
            notes: reservation.notes || undefined,
            calendarId: reservation.calendar_id,
          })

          // Update DB: title and external_event_id
          await supabase
            .from('reservations')
            .update({ title: newTitle, external_event_id: newEventId })
            .eq('id', reservation.id)

          return true
        } catch (calendarError) {
          console.error(`Failed to recreate calendar event for reservation ${reservation.id}:`, calendarError)
          // Fallback to DB-only title update
          await supabase
            .from('reservations')
            .update({ title: newTitle })
            .eq('id', reservation.id)
          return false
        }
      } else {
        // Calendar not configured: DB-only title update
        await supabase
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

/**
 * Get the correct title for a new reservation based on chronological order
 */
export async function generateReservationTitle(
  clientId: string, 
  clientName: string, 
  startDateTime: Date
): Promise<string> {
  // Get client plan information
  const { data: clientData, error: clientError } = await supabase
    .from('users')
    .select('plan')
    .eq('id', clientId)
    .single()

  if (clientError) {
    console.error('Error fetching client plan:', clientError)
  }

  const maxCount = getPlanMaxCount(clientData?.plan)
  
  // Get existing reservations for this client across all time (cumulative)
  const { data: existingReservations, error } = await supabase
    .from('reservations')
    .select('id, start_time')
    .eq('client_id', clientId)
    .order('start_time', { ascending: true })

  if (error) {
    console.error('Error fetching existing reservations:', error)
    // Extract last name for fallback
    const lastName = extractLastName(clientName)
    return `${lastName}1/${maxCount}` // Fallback
  }

  // Calculate cumulative count for this reservation (chronological order)
  const reservationsBeforeThis = existingReservations?.filter(r => 
    new Date(r.start_time) < startDateTime
  ) || []
  
  const monthlyCount = reservationsBeforeThis.length + 1
  // Use only last name in the title
  const lastName = extractLastName(clientName)
  
  // Check if plan uses cumulative count
  const plan = clientData?.plan || ''
  const isCumulative = usesCumulativeCount(plan)
  
  if (isCumulative) {
    // For diet/counseling: show only count (e.g., "山口1")
    return `${lastName}${monthlyCount}`
  } else {
    // For personal training: show full format (e.g., "山口1/4")
    return `${lastName}${monthlyCount}/${maxCount}`
  }
}

/**
 * Recalculate and update titles for all reservations of a specific client (cumulative)
 * Keeps chronological numbering 1..N and updates Google Calendar events if configured.
 */
export async function updateAllTitles(clientId: string) {
  try {
    // Fetch all reservations for the client ordered by time
    const { data: reservations, error } = await supabase
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

    const calendarService = createGoogleCalendarService()

    const updates = reservations.map(async (reservation, index) => {
      // Generate title based on plan type
      const newTitle = isCumulative 
        ? `${lastName}${index + 1}`  // Diet/Counseling: "山口1"
        : `${lastName}${index + 1}/${maxCount}`  // Personal: "山口1/4"

      // Skip if title hasn't changed (no need to update DB or Google Calendar)
      if (reservation.title === newTitle) {
        return true
      }

      // Normalize user shape per row
      const u: any = Array.isArray((reservation as any).users)
        ? (reservation as any).users[0]
        : (reservation as any).users

      if (calendarService && u) {
        try {
          if (reservation.external_event_id) {
            try { await calendarService.deleteEvent(reservation.external_event_id, reservation.calendar_id) } catch {}
          }
          const newEventId = await calendarService.createEvent({
            title: newTitle,
            startTime: reservation.start_time,
            endTime: reservation.end_time,
            clientName: u.full_name,
            clientEmail: u.email,
            notes: reservation.notes || undefined,
            calendarId: reservation.calendar_id,
          })
          await supabase.from('reservations').update({ title: newTitle, external_event_id: newEventId }).eq('id', reservation.id)
          return true
        } catch (err) {
          console.error('Calendar sync failed while updating titles:', err)
          await supabase.from('reservations').update({ title: newTitle }).eq('id', reservation.id)
          return false
        }
      } else {
        await supabase.from('reservations').update({ title: newTitle }).eq('id', reservation.id)
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
