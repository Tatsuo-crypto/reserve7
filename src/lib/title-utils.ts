import { supabase } from './supabase'
import { createGoogleCalendarService } from './google-calendar'

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

    // Get plan max count
    const getPlanMaxCount = (plan: string | undefined) => {
      if (!plan) return 4
      if (plan === 'ダイエットコース') return 8
      if (plan.includes('6回')) return 6
      if (plan.includes('8回')) return 8
      if (plan.includes('2回')) return 2
      return 4
    }

    const maxCount = getPlanMaxCount(clientData?.plan)

    // Initialize Google Calendar service
    const calendarService = createGoogleCalendarService()

    // Update each reservation with correct sequential number
    const updates = reservations.map(async (reservation, index) => {
      const newTitle = `${clientName}${index + 1}/${maxCount}`

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
 * Get the correct title for a new reservation based on chronological order
 */
export async function generateReservationTitle(
  clientId: string, 
  clientName: string, 
  startDateTime: Date
): Promise<string> {
  const startMonth = startDateTime.getMonth()
  const startYear = startDateTime.getFullYear()
  
  // Get client plan information
  const { data: clientData, error: clientError } = await supabase
    .from('users')
    .select('plan')
    .eq('id', clientId)
    .single()

  if (clientError) {
    console.error('Error fetching client plan:', clientError)
  }

  // Get plan max count
  const getPlanMaxCount = (plan: string | undefined) => {
    if (!plan) return 4
    if (plan === 'ダイエットコース') return 8
    if (plan.includes('6回')) return 6
    if (plan.includes('8回')) return 8
    if (plan.includes('2回')) return 2
    return 4
  }

  const maxCount = getPlanMaxCount(clientData?.plan)
  
  // Get existing reservations for this client in the same month
  const { data: existingReservations, error } = await supabase
    .from('reservations')
    .select('id, start_time')
    .eq('client_id', clientId)
    .gte('start_time', new Date(startYear, startMonth, 1).toISOString())
    .lt('start_time', new Date(startYear, startMonth + 1, 1).toISOString())
    .order('start_time', { ascending: true })

  if (error) {
    console.error('Error fetching existing reservations:', error)
    return `${clientName}1/${maxCount}` // Fallback
  }

  // Calculate the count for this reservation (chronological order)
  const reservationsBeforeThis = existingReservations?.filter(r => 
    new Date(r.start_time) < startDateTime
  ) || []
  
  const monthlyCount = reservationsBeforeThis.length + 1
  return `${clientName}${monthlyCount}/${maxCount}`
}
