import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { getMailSettings, sendPersonalSessionReminder } from '@/lib/email'

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
          email
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

    const sentReminders: { reservationId: string; clientName: string; email: string }[] = []

    for (const res of reservations) {
      const client = res.users as any
      if (!client || !client.email || client.email.trim() === '') {
        continue
      }

      // Check if client email is dummy
      const isDummy = (email: string) => {
        const cleaned = email.trim().toLowerCase()
        return cleaned === '-' || cleaned.includes('@gym.internal') || cleaned.includes('no-email-')
      }
      if (isDummy(client.email)) {
        console.log(`[Personal Reminder Cron] Skipping dummy email: ${client.email}`)
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

    // Determine store name
    const storeName = res.calendar_id === 'tandjgym@gmail.com' ? 'T&J GYM 1号店' : 'T&J GYM 2号店'

    // 2. Send reminder email
    try {
      console.log(`[Personal Reminder Cron] Sending reminder to ${client.full_name} (${client.email}) for reservation ${res.id}`)
      const success = await sendPersonalSessionReminder({
        email: client.email,
        clientName: client.full_name,
        title: res.title,
        startTime: res.start_time,
        endTime: res.end_time,
        storeName,
        notes: res.notes || undefined
      })

        if (success) {
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
            email: client.email
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
