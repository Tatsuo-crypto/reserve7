import { google } from 'googleapis'
import { env } from './env'

export class GoogleCalendarService {
  private calendar: any

  constructor() {
    try {
      if (!env.GOOGLE_SERVICE_ACCOUNT_KEY || !env.GOOGLE_CALENDAR_ID) {
        console.warn('Google Calendar credentials not configured')
        this.calendar = null
        return
      }

      // console.log('Initializing Google Calendar service...')
      // console.log('Calendar ID:', env.GOOGLE_CALENDAR_ID)
      // console.log('Service account key exists:', !!env.GOOGLE_SERVICE_ACCOUNT_KEY)
      
      const credentials = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY)
      // console.log('Service account email:', credentials.client_email)
      
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
  }): Promise<string> {
    if (!this.calendar) {
      throw new Error('Google Calendar service not initialized')
    }

    const event = {
      summary: reservation.title,
      description: [
        `クライアント: ${reservation.clientName} (${reservation.clientEmail})`,
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
      const response = await this.calendar.events.insert({
        calendarId: env.GOOGLE_CALENDAR_ID!,
        requestBody: event,
      })

      if (!response.data.id) {
        throw new Error('Event creation failed - no event ID returned')
      }

      return response.data.id
    } catch (error) {
      console.error('Google Calendar event creation error:', error)
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
  }): Promise<void> {
    if (!this.calendar) {
      throw new Error('Google Calendar service not initialized')
    }

    const event = {
      summary: reservation.title,
      description: [
        `クライアント: ${reservation.clientName} (${reservation.clientEmail})`,
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
        calendarId: env.GOOGLE_CALENDAR_ID!,
        eventId: eventId,
        requestBody: event,
      })
    } catch (error) {
      console.error('Google Calendar event update error:', error)
      throw error
    }
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent(eventId: string): Promise<void> {
    try {
      await this.calendar.events.delete({
        calendarId: env.GOOGLE_CALENDAR_ID!,
        eventId: eventId,
      })
    } catch (error) {
      console.error('Google Calendar event deletion error:', error)
      throw error
    }
  }

  /**
   * Check if Google Calendar is properly configured
   */
  static isConfigured(): boolean {
    return !!(env.GOOGLE_SERVICE_ACCOUNT_KEY && env.GOOGLE_CALENDAR_ID)
  }
}

/**
 * Create a Google Calendar service instance
 * Returns null if not configured
 */
export function createGoogleCalendarService(): GoogleCalendarService | null {
  try {
    if (!GoogleCalendarService.isConfigured()) {
      console.warn('Google Calendar not configured - calendar sync disabled')
      return null
    }
    return new GoogleCalendarService()
  } catch (error) {
    console.error('Failed to create Google Calendar service:', error)
    return null
  }
}
