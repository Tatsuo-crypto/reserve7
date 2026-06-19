import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { getMailSettings } from '@/lib/email'
import { sendPushNotificationToUser } from '@/lib/push'

function formatDateJST(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

function formatTimeJST(date: Date): string {
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    return `${hour}:${minute}`
}

function minutesFromTime(time?: string | null): number | null {
    if (!time) return null
    const [hour, minute] = time.substring(0, 5).split(':').map(Number)
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
    return hour * 60 + minute
}

function addMinutes(date: Date, minutes: number): Date {
    const next = new Date(date)
    next.setMinutes(next.getMinutes() + minutes)
    return next
}

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

        const settings = await getMailSettings()
        const dryRun = searchParams.get('dryRun') === 'true'
        const force = searchParams.get('force') === 'true'
        const configuredGraceMinutes = Number(searchParams.get('graceMinutes') || process.env.ONLINE_REMINDER_GRACE_MINUTES || 10)
        const graceMinutes = Number.isFinite(configuredGraceMinutes) ? Math.max(0, configuredGraceMinutes) : 10

        // Get current JST time. This cron is expected to run once per day at 21:00 JST.
        const nowParam = searchParams.get('now')
        const jstDateStr = nowParam
            ? new Date(nowParam).toLocaleString("en-US", { timeZone: "Asia/Tokyo" })
            : new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" })
        const jstNow = new Date(jstDateStr)

        const personalTargetDate = new Date(jstNow)
        personalTargetDate.setDate(jstNow.getDate() + 1)
        const personalTargetDateStr = formatDateJST(personalTargetDate)
        const personalTargetStart = new Date(`${personalTargetDateStr}T00:00:00+09:00`).toISOString()
        const personalTargetEnd = new Date(`${personalTargetDateStr}T23:59:59+09:00`).toISOString()

        const sentPersonalReminders: { reservationId: string; clientName: string; pushCount: number }[] = []

        if (settings.personal_reminder_enabled && !dryRun) {
            const { data: reservations, error: fetchError } = await supabaseAdmin
                .from('reservations')
                .select(`
                    id,
                    title,
                    start_time,
                    end_time,
                    notes,
                    client_id,
                    calendar_id,
                    users!client_id (
                        id,
                        full_name,
                        email,
                        access_token,
                        push_notification_enabled
                    )
                `)
                .gte('start_time', personalTargetStart)
                .lte('start_time', personalTargetEnd)
                .not('client_id', 'is', null)

            if (fetchError) {
                console.error('Failed to fetch personal reservations:', fetchError)
            }

            for (const res of reservations || []) {
                const client = res.users as any
                if (!client) {
                    continue
                }

                const { data: existingLog, error: logCheckError } = await supabaseAdmin
                    .from('reservation_reminders')
                    .select('*')
                    .eq('reservation_id', res.id)
                    .eq('sent_date', personalTargetDateStr)
                    .maybeSingle()

                if (logCheckError || existingLog) {
                    if (logCheckError) console.error(`Error checking existing personal reminder for reservation ${res.id}:`, logCheckError)
                    continue
                }

                try {
                    let pushCount = 0

                    if (client.push_notification_enabled && client.access_token) {
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
                        pushCount = await sendPushNotificationToUser(client.id, {
                            title: 'ご予約前日のお知らせ',
                            body: `${dateStr} ${timeStr}のセッション予定があります。`,
                            url: `/client/${client.access_token}`
                        })
                    }

                    if (pushCount > 0) {
                        const { error: insertError } = await supabaseAdmin
                            .from('reservation_reminders')
                            .insert({
                                reservation_id: res.id,
                                sent_date: personalTargetDateStr
                            })

                        if (insertError) {
                            console.error(`Failed to insert personal reminder log for reservation ${res.id}:`, insertError)
                        }

                        sentPersonalReminders.push({
                            reservationId: res.id,
                            clientName: client.full_name,
                            pushCount
                        })
                    }
                } catch (err) {
                    console.error(`Failed to send personal reminder for reservation ${res.id}:`, err)
                }
            }
        }

        const reminderBeforeMinutes = settings.reminder_before_minutes ?? 30
        const onlineTargetTime = addMinutes(jstNow, reminderBeforeMinutes)
        const onlineWindowStart = addMinutes(onlineTargetTime, -graceMinutes)
        const onlineWindowEnd = addMinutes(onlineTargetTime, graceMinutes)
        const onlineTargetDateStr = formatDateJST(onlineTargetTime)
        const onlineTargetTimeStr = formatTimeJST(onlineTargetTime)
        const onlineWindowStartStr = formatTimeJST(onlineWindowStart)
        const onlineWindowEndStr = formatTimeJST(onlineWindowEnd)
        const onlineTargetDow = onlineTargetTime.getDay() // 0: Sun, 1: Mon, ... 6: Sat
        const onlineWindowStartMinutes = minutesFromTime(onlineWindowStartStr) ?? 0
        const onlineWindowEndMinutes = minutesFromTime(onlineWindowEndStr) ?? 0

        console.log(`[Online Lesson Cron] Running reminder check for ${onlineTargetDateStr} ${onlineTargetTimeStr} JST (DOW: ${onlineTargetDow}, window: ${onlineWindowStartStr}-${onlineWindowEndStr}, dryRun: ${dryRun})`)

        // Fetch active online lessons
        const { data: lessons, error: lessonsError } = await supabaseAdmin
            .from('online_lessons')
            .select('*')
            .eq('is_active', true)

        if (lessonsError) {
            console.error('Failed to fetch online lessons:', lessonsError)
            return NextResponse.json({ error: 'Failed to fetch lessons' }, { status: 500 })
        }

        if (!lessons || lessons.length === 0) {
            return NextResponse.json({ message: 'No active online lessons found' })
        }

        const sentReminders: { lessonId: string; title: string; recipientCount: number }[] = []
        const matchedLessons: { lessonId: string; title: string; startTime: string; recipientCount: number; pushRecipientCount: number; emailRecipientCount: number }[] = []
        const skippedLessons: { lessonId: string; title: string; reason: string; startTime?: string | null; dayOfWeek?: number[] | null }[] = []

        for (const lesson of lessons) {
            const isScheduledForTargetDay = lesson.day_of_week && Array.isArray(lesson.day_of_week) && lesson.day_of_week.includes(onlineTargetDow)
            if (!isScheduledForTargetDay) {
                skippedLessons.push({
                    lessonId: lesson.id,
                    title: lesson.title,
                    reason: 'target-day-mismatch',
                    startTime: lesson.start_time,
                    dayOfWeek: lesson.day_of_week
                })
                continue
            }

            const lessonStartMinutes = minutesFromTime(lesson.start_time)
            if (lessonStartMinutes === null || lessonStartMinutes < onlineWindowStartMinutes || lessonStartMinutes > onlineWindowEndMinutes) {
                skippedLessons.push({
                    lessonId: lesson.id,
                    title: lesson.title,
                    reason: 'target-time-window-mismatch',
                    startTime: lesson.start_time,
                    dayOfWeek: lesson.day_of_week
                })
                continue
            }

            const { data: existingReminder, error: reminderCheckError } = await supabaseAdmin
                .from('online_lesson_reminders')
                .select('*')
                .eq('online_lesson_id', lesson.id)
                .eq('sent_date', onlineTargetDateStr)
                .maybeSingle()

            if (reminderCheckError) {
                console.error(`Error checking existing reminder for lesson ${lesson.id}:`, reminderCheckError)
                continue
            }

            if (!force && existingReminder) {
                console.log(`[Online Lesson Cron] Reminder already sent for lesson: ${lesson.title} (${lesson.id}) on ${onlineTargetDateStr}`)
                skippedLessons.push({
                    lessonId: lesson.id,
                    title: lesson.title,
                    reason: 'already-sent',
                    startTime: lesson.start_time,
                    dayOfWeek: lesson.day_of_week
                })
                continue
            }

            const { data: lessonUsers, error: usersError } = await supabaseAdmin
                .from('online_lesson_users')
                .select(`
                    user_id,
                    users (
                        id,
                        full_name,
                        email,
                        access_token,
                        push_notification_enabled
                    )
                `)
                .eq('online_lesson_id', lesson.id)

            if (usersError) {
                console.error(`Failed to fetch users for online lesson ${lesson.id}:`, usersError)
                continue
            }

            const targetUsers = (lessonUsers || [])
                .map((lu: any) => lu.users)
                .filter((u: any) => 
                    u
                )

            const pushUsers = targetUsers.filter((u: any) => u.push_notification_enabled && u.access_token)

            if (pushUsers.length === 0) {
                console.log(`[Online Lesson Cron] No target users found for lesson: ${lesson.title} (${lesson.id})`)
                skippedLessons.push({
                    lessonId: lesson.id,
                    title: lesson.title,
                    reason: 'no-target-users',
                    startTime: lesson.start_time,
                    dayOfWeek: lesson.day_of_week
                })
                continue
            }

            console.log(`[Online Lesson Cron] Sending push reminders for "${lesson.title}" at ${lesson.start_time} to ${pushUsers.length} users`)

            let successCount = 0
            matchedLessons.push({
                lessonId: lesson.id,
                title: lesson.title,
                startTime: lesson.start_time,
                recipientCount: pushUsers.length,
                pushRecipientCount: pushUsers.length,
                emailRecipientCount: 0
            })

            if (!dryRun) {
                for (const user of pushUsers) {
                    try {
                        const formattedStartTime = lesson.start_time.substring(0, 5)
                        const pushCount = await sendPushNotificationToUser(user.id, {
                            title: 'オンラインセッションのお知らせ',
                            body: `${lesson.title}が${formattedStartTime}から始まります。`,
                            url: `/client/${user.access_token}?tab=online`
                        })
                        if (pushCount > 0) successCount++
                    } catch (pushError) {
                        console.error(`Failed to send push notification to user ${user.id}:`, pushError)
                    }
                }
            }

            if (!dryRun && successCount > 0) {
                const { error: insertError } = await supabaseAdmin
                    .from('online_lesson_reminders')
                    .insert({
                        online_lesson_id: lesson.id,
                        sent_date: onlineTargetDateStr
                    })

                if (insertError) {
                    console.error(`Failed to insert online_lesson_reminder log for lesson ${lesson.id}:`, insertError)
                }

                sentReminders.push({
                    lessonId: lesson.id,
                    title: lesson.title,
                    recipientCount: successCount
                })
            }
        }

        return NextResponse.json({
            success: true,
            personal: {
                targetDate: personalTargetDateStr,
                processedCount: sentPersonalReminders.length,
                sentReminders: sentPersonalReminders
            },
            online: {
                targetDate: onlineTargetDateStr,
                targetTime: onlineTargetTimeStr,
                targetWindow: {
                    start: onlineWindowStartStr,
                    end: onlineWindowEndStr,
                    graceMinutes
                },
                dryRun,
                processedCount: sentReminders.length,
                matchedLessons,
                skippedLessons,
                sentReminders
            }
        })
    } catch (error) {
        console.error('[Online Lesson Cron] Error in cron handler:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
