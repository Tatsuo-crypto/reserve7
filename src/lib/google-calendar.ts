import { google } from 'googleapis'
import { env } from './env'

export class GoogleCalendarService {
  private calendar: any

  constructor() {
    try {
      if (!env.GOOGLE_SERVICE_ACCOUNT_KEY) {
        console.warn('Google Calendar credentials not configured')
        this.calendar = null
        return
      }
      
      const credentials = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY)
      
      const auth = new google.auth.JWT(
        credentials.client_email,
        undefined,
        credentials.private_key,
        ['https://www.googleapis.com/auth/calendar']
      )

      this.calendar = google.calendar({ version: 'v3', auth })
      console.log('Google Calendar service initialized successfully')
    } catch (error) {
      console.error('Failed to initialize Google Calendar service:', error)
      this.calendar = null
    }
  }

  /**
   * Create a calendar event for a reservation
   */
  async createEvent(reservation: {
    title: string
    startTime: string
    endTime: string
    clientName: string
    clientEmail: string
    notes?: string
    calendarId: string
    memberCalendarEmail?: string | null
    trainerCalendarEmail?: string | null
  }): Promise<string> {
    if (!this.calendar) {
      throw new Error('Google Calendar service not initialized')
    }

    const event: any = {
      summary: reservation.title,
      description: [
        `会員: ${reservation.clientName} (${reservation.clientEmail})`,
        reservation.notes ? `メモ: ${reservation.notes}` : '',
      ].filter(Boolean).join('\n'),
      start: {
        dateTime: reservation.startTime,
        timeZone: 'Asia/Tokyo',
      },
      end: {
        dateTime: reservation.endTime,
        timeZone: 'Asia/Tokyo',
      },
    }

    try {
      // ジムのカレンダーにイベント作成（attendeesなし）
      const response = await this.calendar.events.insert({
        calendarId: reservation.calendarId,
        requestBody: event,
        sendUpdates: 'none',
      })

      if (!response.data.id) {
        throw new Error('Event creation failed - no event ID returned')
      }

      const eventId = response.data.id
      console.log(`✅ Google Calendar event created: ${eventId}`)

      // トレーナーのカレンダーにも直接イベントを作成
      if (reservation.trainerCalendarEmail && reservation.trainerCalendarEmail.trim() !== '') {
        try {
          await this.calendar.events.insert({
            calendarId: reservation.trainerCalendarEmail,
            requestBody: event,
            sendUpdates: 'none',
          })
          console.log(`✅ Trainer calendar event created: ${reservation.trainerCalendarEmail}`)
        } catch (trainerError) {
          console.error(`⚠️ Failed to create event on trainer calendar (${reservation.trainerCalendarEmail}):`, trainerError instanceof Error ? trainerError.message : trainerError)
        }
      }

      return eventId
    } catch (error) {
      console.error('Google Calendar event creation error:', error)
      throw error
    }
  }

  /**
   * Create an event on the service account's primary calendar with attendees
   * This sends a Google Calendar invitation to the attendee
   */
  async createEventWithAttendees(params: {
    title: string
    startTime: string
    endTime: string
    clientName: string
    clientEmail: string
    notes?: string
    attendeeEmails: string[]
    calendarId: string
  }): Promise<string> {
    if (!this.calendar) {
      throw new Error('Google Calendar service not initialized')
    }

    const event: any = {
      summary: params.title,
      description: [
        `会員: ${params.clientName} (${params.clientEmail})`,
        params.notes ? `メモ: ${params.notes}` : '',
      ].filter(Boolean).join('\n'),
      start: {
        dateTime: params.startTime,
        timeZone: 'Asia/Tokyo',
      },
      end: {
        dateTime: params.endTime,
        timeZone: 'Asia/Tokyo',
      },
      attendees: params.attendeeEmails.map(email => ({ email })),
    }

    try {
      const response = await this.calendar.events.insert({
        calendarId: params.calendarId,
        requestBody: event,
        sendUpdates: 'all',
      })

      if (!response.data.id) {
        throw new Error('Event creation failed - no event ID returned')
      }

      console.log(`✅ Invitation event created for ${params.attendeeEmails.join(', ')}: ${response.data.id}`)
      return response.data.id
    } catch (error) {
      console.error(`Google Calendar invitation error for ${params.attendeeEmails.join(', ')}:`, error instanceof Error ? error.message : error)
      throw error
    }
  }

  /**
   * Update a calendar event
   */
  async updateEvent(eventId: string, reservation: {
    title: string
    startTime: string
    endTime: string
    clientName: string
    clientEmail: string
    notes?: string
    calendarId: string
    memberCalendarEmail?: string | null
    trainerCalendarEmail?: string | null
  }): Promise<void> {
    if (!this.calendar) {
      throw new Error('Google Calendar service not initialized')
    }

    const event: any = {
      summary: reservation.title,
      description: [
        `会員: ${reservation.clientName} (${reservation.clientEmail})`,
        reservation.notes ? `メモ: ${reservation.notes}` : '',
      ].filter(Boolean).join('\n'),
      start: {
        dateTime: reservation.startTime,
        timeZone: 'Asia/Tokyo',
      },
      end: {
        dateTime: reservation.endTime,
        timeZone: 'Asia/Tokyo',
      },
    }

    try {
      await this.calendar.events.update({
        calendarId: reservation.calendarId,
        eventId: eventId,
        requestBody: event,
        sendUpdates: 'none',
      })
      
      console.log(`✅ Google Calendar event updated: ${eventId}`)

    } catch (error) {
      console.error('Google Calendar event update error:', error)
      throw error
    }
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent(eventId: string, calendarId: string, options?: {
    memberCalendarEmail?: string | null,
    trainerCalendarEmail?: string | null
  }): Promise<void> {
    try {
      // Delete from main calendar - this automatically cancels for all attendees
      await this.calendar.events.delete({
        calendarId: calendarId,
        eventId: eventId,
        sendUpdates: 'none', // キャンセル通知を送る
      })

      console.log(`✅ Google Calendar event deleted: ${eventId}`)
    } catch (error) {
      console.error('Google Calendar event deletion error:', error)
      throw error
    }
  }

  /**
   * Check if a calendar event exists (returns true if exists, false if deleted/not found)
   */
  async eventExists(eventId: string, calendarId: string): Promise<boolean> {
    if (!this.calendar) return true // Assume exists if service not available
    try {
      const response = await this.calendar.events.get({
        calendarId: calendarId,
        eventId: eventId,
      })
      // Event exists but may be cancelled
      return response.data.status !== 'cancelled'
    } catch (error: any) {
      if (error?.code === 404 || error?.response?.status === 404) {
        return false
      }
      // For other errors (network, auth), assume event exists to avoid accidental deletion
      console.error('Error checking event existence:', error?.message || error)
      return true
    }
  }

  /**
   * Check if Google Calendar is properly configured
   */
  static isConfigured(): boolean {
    return !!(env.GOOGLE_SERVICE_ACCOUNT_KEY)
  }
}

/**
 * Create a Google Calendar service instance
 * Returns null if not configured
 */
export function createGoogleCalendarService(): GoogleCalendarService | null {
  try {
    if (!GoogleCalendarService.isConfigured()) {
      console.warn('⚠️ Google Calendar not configured - calendar sync disabled')
      console.warn('Missing environment variables:')
      if (!env.GOOGLE_SERVICE_ACCOUNT_KEY) console.warn('  - GOOGLE_SERVICE_ACCOUNT_KEY')
      if (!env.GOOGLE_CALENDAR_ID_1) console.warn('  - GOOGLE_CALENDAR_ID_1')
      if (!env.GOOGLE_CALENDAR_ID_2) console.warn('  - GOOGLE_CALENDAR_ID_2')
      return null
    }
    console.log('✅ Creating Google Calendar service...')
    return new GoogleCalendarService()
  } catch (error) {
    console.error('❌ Failed to create Google Calendar service:', error)
    return null
  }
}
