import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { createGoogleCalendarService } from '@/lib/google-calendar'
import { getAuthenticatedUser } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    let user = null

    if (token) {
      // Trainer token authentication
      const { data: trainerData } = await supabaseAdmin
        .from('trainers')
        .select('id, email, full_name, store_id')
        .eq('access_token', token)
        .eq('status', 'active')
        .single()

      if (!trainerData) {
        return NextResponse.json({ error: '無効なトークンです' }, { status: 401 })
      }

      const { data: store } = await supabaseAdmin
        .from('stores')
        .select('calendar_id')
        .eq('id', trainerData.store_id)
        .single()

      user = {
        id: trainerData.id,
        email: trainerData.email,
        isAdmin: false,
        isTrainer: true,
        storeId: trainerData.store_id,
        calendarId: store?.calendar_id,
      }
    } else {
      user = await getAuthenticatedUser()
      if (!user || !user.isAdmin) {
        return NextResponse.json({ error: '権限がありません' }, { status: 403 })
      }
    }

    const calendarService = createGoogleCalendarService()
    if (!calendarService) {
      return NextResponse.json({ error: 'Google Calendar未設定' }, { status: 500 })
    }

    const calendarId = (user as any).calendarId || user.storeId

    // Get future reservations with external_event_id for this store
    const now = new Date()
    const { data: reservations, error } = await supabaseAdmin
      .from('reservations')
      .select('id, external_event_id, trainer_external_event_id, calendar_id, title, start_time, trainer_id')
      .eq('calendar_id', calendarId)
      .gte('start_time', now.toISOString())
      .not('external_event_id', 'is', null)
      .order('start_time', { ascending: true })

    if (error) {
      console.error('Sync: Error fetching reservations:', error)
      return NextResponse.json({ error: 'データ取得エラー' }, { status: 500 })
    }

    if (!reservations || reservations.length === 0) {
      return NextResponse.json({ synced: 0, deleted: 0 })
    }

    console.log(`🔄 Sync: Checking ${reservations.length} reservations against Google Calendar`)

    let deletedCount = 0
    const deletedTitles: string[] = []

    // Check each reservation's event in Google Calendar (batch with concurrency limit)
    const BATCH_SIZE = 5
    for (let i = 0; i < reservations.length; i += BATCH_SIZE) {
      const batch = reservations.slice(i, i + BATCH_SIZE)
      const results = await Promise.all(
        batch.map(async (r) => {
          try {
            const exists = await calendarService.eventExists(r.external_event_id!, r.calendar_id)
            return { reservation: r, exists }
          } catch {
            return { reservation: r, exists: true } // Assume exists on error
          }
        })
      )

      for (const { reservation, exists } of results) {
        if (!exists) {
          console.log(`🗑️ Sync: Event deleted from Google Calendar: ${reservation.title} (${reservation.external_event_id})`)

          // Also delete from trainer's personal calendar if we have the event ID
          if (reservation.trainer_external_event_id && reservation.trainer_id) {
            try {
              const { data: trainer } = await supabaseAdmin
                .from('trainers')
                .select('google_calendar_id')
                .eq('id', reservation.trainer_id)
                .single()
              if (trainer?.google_calendar_id) {
                await calendarService.deleteEvent(
                  reservation.trainer_external_event_id,
                  trainer.google_calendar_id
                ).catch(() => {}) // Ignore errors (may already be deleted)
                console.log(`🗑️ Sync: Trainer calendar event also deleted`)
              }
            } catch { /* ignore */ }
          }

          const { error: delError } = await supabaseAdmin
            .from('reservations')
            .delete()
            .eq('id', reservation.id)

          if (!delError) {
            deletedCount++
            deletedTitles.push(reservation.title || '不明')
          } else {
            console.error('Sync: Failed to delete reservation:', delError)
          }
        }
      }
    }

    console.log(`🔄 Sync complete: checked=${reservations.length}, deleted=${deletedCount}`)

    return NextResponse.json({
      synced: reservations.length,
      deleted: deletedCount,
      deletedTitles,
    })
  } catch (error) {
    console.error('Sync API error:', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
