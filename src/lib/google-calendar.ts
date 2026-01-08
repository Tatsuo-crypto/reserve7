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
      // ジムのカレンダーにイベント作成
      const response = await this.calendar.events.insert({
        calendarId: reservation.calendarId,
        requestBody: event,
      })

      if (!response.data.id) {
        throw new Error('Event creation failed - no event ID returned')
      }

      const eventId = response.data.id

      // 会員のGoogleカレンダーメールが設定されている場合、会員のカレンダーにも別イベントとして作成
      if (reservation.memberCalendarEmail && reservation.memberCalendarEmail.trim() !== '') {
        try {
          console.log(`📅 Creating event in member calendar: ${reservation.memberCalendarEmail}`)
          await this.calendar.events.insert({
            calendarId: reservation.memberCalendarEmail,
            requestBody: event,
          })
          console.log(`✅ Event created in member calendar`)
        } catch (memberCalError) {
          console.error(`⚠️ Failed to create event in member calendar:`, memberCalError)
          // 会員カレンダーへの作成失敗はエラーとせず、ジムのカレンダーのイベントIDを返す
        }
      }

      return eventId
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
      // ジムのカレンダーのイベントを更新
      await this.calendar.events.update({
        calendarId: reservation.calendarId,
        eventId: eventId,
        requestBody: event,
      })
      
      // Note: 会員カレンダーのイベントは title-utils.ts で削除→再作成する方式で対応
    } catch (error) {
      console.error('Google Calendar event update error:', error)
      throw error
    }
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent(eventId: string, calendarId: string): Promise<void> {
    try {
      await this.calendar.events.delete({
        calendarId: calendarId,
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
