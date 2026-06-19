import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { getMailSettings } from '@/lib/email'
import { sendPushNotificationToUser } from '@/lib/push'

export async function GET(request: NextRequest) {
  try {
    // Simple security check (Vercel Cron uses Authorization header with Bearer token)
    const authHeader = request.headers.get('authorization')
    const { searchParams } = new URL(request.url)
    const secretParam = searchParams.get('secret')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret) {
      const expectedAuth = `Bearer ${cronSecret}`
      if (authHeader !== expectedAuth && secretParam !== cronSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // Get current JST time
    const jstDateStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" })
    const jstNow = new Date(jstDateStr)
    const currentHour = jstNow.getHours()

    const settings = await getMailSettings()

    const force = searchParams.get('force') === 'true'

    if (!settings.personal_reminder_enabled) {
      return NextResponse.json({ message: 'Personal session reminders are disabled in settings.' })
    }

    if (!force && currentHour !== settings.personal_reminder_hour) {
      return NextResponse.json({ 
        message: `Skipping: current hour (${currentHour}) does not match configured reminder hour (${settings.personal_reminder_hour}).` 
      })
    }

    // Calculate target date based on settings
    const targetDate = new Date(jstNow)
    targetDate.setDate(targetDate.getDate() + settings.personal_reminder_days_before)
    const year = targetDate.getFullYear()
    const month = String(targetDate.getMonth() + 1).padStart(2, '0')
    const day = String(targetDate.getDate()).padStart(2, '0')
    const targetDateStr = `${year}-${month}-${day}` // YYYY-MM-DD in JST

    const targetStart = new Date(`${targetDateStr}T00:00:00+09:00`).toISOString()
    const targetEnd = new Date(`${targetDateStr}T23:59:59+09:00`).toISOString()

    console.log(`[Personal Reminder Cron] Checking reservations for ${targetDateStr} JST (Start: ${targetStart}, End: ${targetEnd})`)

    // Fetch active reservations with clients
    const { data: reservations, error: fetchError } = await supabaseAdmin
      .from('reservations')
      .select(`
        id,
        title,
        start_time,
        end_time,
        notes,
        client_id,
        trainer_id,
        calendar_id,
        users!client_id (
          id,
          full_name,
          email,
          access_token,
          push_notification_enabled
        )
      `)
      .gte('start_time', targetStart)
      .lte('start_time', targetEnd)
      .not('client_id', 'is', null)

    if (fetchError) {
      console.error('Failed to fetch reservations:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch reservations' }, { status: 500 })
    }

    if (!reservations || reservations.length === 0) {
      return NextResponse.json({ message: `No reservations found for date: ${targetDateStr}` })
    }

    const sentReminders: { reservationId: string; clientName: string; pushCount: number }[] = []

    for (const res of reservations) {
      const client = res.users as any
      if (!client || !client.push_notification_enabled || !client.access_token) {
        continue
      }

      // 1. Check if we already sent a reminder for this reservation today/target date
      const { data: existingLog, error: logCheckError } = await supabaseAdmin
        .from('reservation_reminders')
        .select('*')
        .eq('reservation_id', res.id)
        .eq('sent_date', targetDateStr)
        .maybeSingle()

      if (logCheckError) {
        console.error(`Error checking existing log for reservation ${res.id}:`, logCheckError)
        continue
      }

      if (!force && existingLog) {
        console.log(`[Personal Reminder Cron] Reminder already sent for reservation: ${res.id}`)
        continue
      }

    // 2. Send push notification only. Email delivery is intentionally off for now.
    try {
      console.log(`[Personal Reminder Cron] Sending push reminder to ${client.full_name} for reservation ${res.id}`)
      const startDate = new Date(res.start_time)
      const dateStr = startDate.toLocaleDateString('ja-JP', {
        timeZone: 'Asia/Tokyo',
        month: 'long',
        day: 'numeric',
        weekday: 'short',
      })
      const timeStr = startDate.toLocaleTimeString('ja-JP', {
        timeZone: 'Asia/Tokyo',
        hour: '2-digit',
        minute: '2-digit',
      })
      const pushCount = await sendPushNotificationToUser(client.id, {
        title: 'ご予約前日のお知らせ',
        body: `${dateStr} ${timeStr}のセッション予定があります。`,
        url: `/client/${client.access_token}`
      })

        if (pushCount > 0) {
          // 3. Record log
          const { error: insertError } = await supabaseAdmin
            .from('reservation_reminders')
            .insert({
              reservation_id: res.id,
              sent_date: targetDateStr
            })

          if (insertError) {
            console.error(`Failed to insert sent log for reservation ${res.id}:`, insertError)
          }

          sentReminders.push({
            reservationId: res.id,
            clientName: client.full_name,
            pushCount
          })
        }
      } catch (err) {
        console.error(`Failed to send personal reminder for reservation ${res.id}:`, err)
      }
    }

    return NextResponse.json({
      success: true,
      processedCount: sentReminders.length,
      sentReminders
    })
  } catch (error) {
    console.error('[Personal Reminder Cron] Error in handler:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
