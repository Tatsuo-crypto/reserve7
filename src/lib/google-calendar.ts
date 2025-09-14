import { google } from 'googleapis'
import { env } from './env'

export class GoogleCalendarService {
  private calendar
  private auth

  constructor() {
    if (!env.GOOGLE_SERVICE_ACCOUNT_KEY || !env.GOOGLE_CALENDAR_ID) {
      throw new Error('Google Calendar credentials not configured')
    }

    try {
      // Parse the service account key from environment variable
      const serviceAccountKey = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY)
      
      // Create JWT auth client
      this.auth = new google.auth.JWT(
        serviceAccountKey.client_email,
        undefined,
        serviceAccountKey.private_key,
        ['https://www.googleapis.com/auth/calendar'],
        undefined
      )

      // Initialize Calendar API
      this.calendar = google.calendar({ version: 'v3', auth: this.auth })
    } catch (error) {
      console.error('Failed to initialize Google Calendar service:', error)
      throw new Error('Google Calendar service initialization failed')
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
    try {
      const event = {
        summary: `${reservation.title} - ${reservation.clientName}`,
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
        attendees: [
          {
            email: reservation.clientEmail,
            displayName: reservation.clientName,
          }
        ],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 24 hours before
            { method: 'popup', minutes: 30 }, // 30 minutes before
          ],
        },
      }

      const response = await this.calendar.events.insert({
        calendarId: env.GOOGLE_CALENDAR_ID!,
        requestBody: event,
        sendUpdates: 'all', // Send email notifications to attendees
      })

      if (!response.data.id) {
        throw new Error('Failed to create calendar event - no event ID returned')
      }

      return response.data.id
    } catch (error) {
      console.error('Failed to create calendar event:', error)
      throw new Error('Calendar event creation failed')
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
    try {
      const event = {
        summary: `${reservation.title} - ${reservation.clientName}`,
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
        attendees: [
          {
            email: reservation.clientEmail,
            displayName: reservation.clientName,
          }
        ],
      }

      await this.calendar.events.update({
        calendarId: env.GOOGLE_CALENDAR_ID!,
        eventId: eventId,
        requestBody: event,
        sendUpdates: 'all',
      })
    } catch (error) {
      console.error('Failed to update calendar event:', error)
      throw new Error('Calendar event update failed')
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
        sendUpdates: 'all',
      })
    } catch (error) {
      console.error('Failed to delete calendar event:', error)
      throw new Error('Calendar event deletion failed')
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
