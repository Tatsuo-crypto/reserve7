import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { getMailSettings, sendOnlineLessonReminder, sendPersonalSessionReminder } from '@/lib/email'
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

function isDummyEmail(email: string): boolean {
    const cleaned = email.trim().toLowerCase()
    return cleaned === '-' || cleaned.includes('@gym.internal') || cleaned.includes('no-email-')
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

        // Get current JST time. This cron is expected to run once per day at 21:00 JST.
        const jstDateStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" })
        const jstNow = new Date(jstDateStr)

        const personalTargetDate = new Date(jstNow)
        personalTargetDate.setDate(jstNow.getDate() + 1)
        const personalTargetDateStr = formatDateJST(personalTargetDate)
        const personalTargetStart = new Date(`${personalTargetDateStr}T00:00:00+09:00`).toISOString()
        const personalTargetEnd = new Date(`${personalTargetDateStr}T23:59:59+09:00`).toISOString()

        const sentPersonalReminders: { reservationId: string; clientName: string; email: string }[] = []

        if (settings.personal_reminder_enabled) {
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

                const storeName = res.calendar_id === 'tandjgym@gmail.com' ? 'T&J GYM 1号店' : 'T&J GYM 2号店'

                try {
                    let success = false

                    if (client.email && client.email.trim() !== '' && !isDummyEmail(client.email)) {
                        success = await sendPersonalSessionReminder({
                            email: client.email,
                            clientName: client.full_name,
                            title: res.title,
                            startTime: res.start_time,
                            endTime: res.end_time,
                            storeName,
                            notes: res.notes || undefined
                        }) || success
                    }

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
                        const pushCount = await sendPushNotificationToUser(client.id, {
                            title: 'ご予約前日のお知らせ',
                            body: `${dateStr} ${timeStr}のセッション予定があります。`,
                            url: `/client/${client.access_token}`
                        })
                        success = pushCount > 0 || success
                    }

                    if (success) {
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
                        email: client.email
                    })
                    }
                } catch (err) {
                    console.error(`Failed to send personal reminder for reservation ${res.id}:`, err)
                }
            }
        }

        const onlineTargetTime = new Date(jstNow)
        onlineTargetTime.setMinutes(jstNow.getMinutes() + settings.reminder_before_minutes)
        const onlineTargetDateStr = formatDateJST(onlineTargetTime)
        const onlineTargetTimeStr = formatTimeJST(onlineTargetTime)
        const onlineTargetDow = onlineTargetTime.getDay() // 0: Sun, 1: Mon, ... 6: Sat

        console.log(`[Online Lesson Cron] Running reminder check for ${onlineTargetDateStr} ${onlineTargetTimeStr} JST (DOW: ${onlineTargetDow})`)

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

        for (const lesson of lessons) {
            const isScheduledForTargetDay = lesson.day_of_week && Array.isArray(lesson.day_of_week) && lesson.day_of_week.includes(onlineTargetDow)
            if (!isScheduledForTargetDay) {
                continue
            }

            if (!lesson.start_time || lesson.start_time.substring(0, 5) !== onlineTargetTimeStr) {
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

            if (existingReminder) {
                console.log(`[Online Lesson Cron] Reminder already sent for lesson: ${lesson.title} (${lesson.id}) on ${onlineTargetDateStr}`)
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

            const validUsers = targetUsers
                .filter((u: any) =>
                    u.email && 
                    u.email.trim() !== '' && 
                    !u.email.endsWith('@gym.internal') && 
                    !u.email.endsWith('@example.com')
                )

            const pushUsers = targetUsers.filter((u: any) => u.push_notification_enabled && u.access_token)

            if (validUsers.length === 0 && pushUsers.length === 0) {
                console.log(`[Online Lesson Cron] No target users found for lesson: ${lesson.title} (${lesson.id})`)
                continue
            }

            console.log(`[Online Lesson Cron] Sending reminders for "${lesson.title}" at ${lesson.start_time} to ${validUsers.length} users`)

            let successCount = 0
            for (const user of validUsers) {
                try {
                    const formattedStartTime = lesson.start_time.substring(0, 5)
                    const formattedEndTime = lesson.end_time ? lesson.end_time.substring(0, 5) : ''
                    const success = await sendOnlineLessonReminder({
                        email: user.email,
                        clientName: user.full_name,
                        title: lesson.title,
                        startTime: formattedStartTime,
                        endTime: formattedEndTime,
                        meetUrl: lesson.meet_url,
                        description: lesson.description || undefined,
                        difficulty: lesson.difficulty || undefined
                    })
                    if (success) successCount++
                } catch (emailError) {
                    console.error(`Failed to send email to user ${user.id} (${user.email}):`, emailError)
                }
            }

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

            if (successCount > 0) {
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
                processedCount: sentReminders.length,
                sentReminders
            }
        })
    } catch (error) {
        console.error('[Online Lesson Cron] Error in cron handler:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
