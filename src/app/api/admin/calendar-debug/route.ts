import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { createGoogleCalendarService } from '@/lib/google-calendar'
import { requireAdminAuth, handleApiError } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth()
    if (authResult instanceof NextResponse) return authResult

    const calendarService = createGoogleCalendarService()
    if (!calendarService) {
      return NextResponse.json({ error: 'Google Calendar service not initialized' }, { status: 500 })
    }

    // Get all trainers
    const { data: trainers } = await supabaseAdmin
      .from('trainers')
      .select('id, full_name, email, google_calendar_id, store_id, status')
      .eq('status', 'active')

    const results: any[] = []

    for (const t of trainers || []) {
      const result: any = {
        name: t.full_name,
        email: t.email,
        google_calendar_id: t.google_calendar_id,
      }

      // Test writing to trainer's calendar
      if (t.google_calendar_id) {
        try {
          // Try to list events (read access test)
          const listRes = await (calendarService as any).calendar.events.list({
            calendarId: t.google_calendar_id,
            maxResults: 1,
            timeMin: new Date().toISOString(),
          })
          result.calendar_access = 'OK'
          result.events_count = listRes.data.items?.length || 0
        } catch (e: any) {
          result.calendar_access = 'FAILED'
          result.calendar_error = e.message?.substring(0, 200) || String(e)
        }
      } else {
        result.calendar_access = 'NO_CALENDAR_ID'
      }

      // Test sending invite to trainer email
      if (t.email) {
        result.notify_email = t.email
      }

      results.push(result)
    }

    return NextResponse.json({ trainers: results })
  } catch (error) {
    return handleApiError(error, 'Calendar debug')
  }
}
