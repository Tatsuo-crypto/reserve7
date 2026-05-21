import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { sendOnlineLessonReminder } from '@/lib/email'

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
        const todayDow = jstNow.getDay() // 0: Sun, 1: Mon, ... 6: Sat
        // Format date in YYYY-MM-DD JST timezone safely
        const year = jstNow.getFullYear()
        const month = String(jstNow.getMonth() + 1).padStart(2, '0')
        const date = String(jstNow.getDate()).padStart(2, '0')
        const todayDateStr = `${year}-${month}-${date}`

        console.log(`[Online Lesson Cron] Running reminder check for ${todayDateStr} (DOW: ${todayDow}), JST time: ${jstNow.toLocaleTimeString()}`)

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
            // 1. Check if the lesson is scheduled for today
            const isScheduledForToday = lesson.day_of_week && Array.isArray(lesson.day_of_week) && lesson.day_of_week.includes(todayDow)
            if (!isScheduledForToday) {
                continue
            }

            if (!lesson.start_time) {
                continue
            }

            // 2. Parse lesson start time and calculate difference
            const [startHour, startMinute] = lesson.start_time.split(':').map(Number)
            const lessonStart = new Date(jstNow)
            lessonStart.setHours(startHour, startMinute, 0, 0)

            const diffMinutes = (lessonStart.getTime() - jstNow.getTime()) / (1000 * 60)

            // Reminder window: Send reminder if the lesson starts in the next 30 minutes
            const isInReminderWindow = diffMinutes > 0 && diffMinutes <= 30

            if (!isInReminderWindow) {
                continue
            }

            // 3. Check if we already sent a reminder for this lesson today
            const { data: existingReminder, error: reminderCheckError } = await supabaseAdmin
                .from('online_lesson_reminders')
                .select('*')
                .eq('online_lesson_id', lesson.id)
                .eq('sent_date', todayDateStr)
                .maybeSingle()

            if (reminderCheckError) {
                console.error(`Error checking existing reminder for lesson ${lesson.id}:`, reminderCheckError)
                continue
            }

            if (existingReminder) {
                console.log(`[Online Lesson Cron] Reminder already sent today for lesson: ${lesson.title} (${lesson.id})`)
                continue
            }

            // 4. Fetch users belonging to the store with online reminder enabled
            const { data: users, error: usersError } = await supabaseAdmin
                .from('users')
                .select('id, full_name, email')
                .eq('store_id', lesson.store_id)
                .eq('online_reminder_enabled', true)

            if (usersError) {
                console.error(`Failed to fetch users for store ${lesson.store_id}:`, usersError)
                continue
            }

            const validUsers = (users || []).filter(u => 
                u.email && 
                u.email.trim() !== '' && 
                !u.email.endsWith('@gym.internal') && 
                !u.email.endsWith('@example.com')
            )
            if (validUsers.length === 0) {
                console.log(`[Online Lesson Cron] No users found with email for store ${lesson.store_id}`)
                continue
            }

            console.log(`[Online Lesson Cron] Sending reminders for "${lesson.title}" starting at ${lesson.start_time} to ${validUsers.length} users`)

            // 5. Send reminder emails
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

            // 6. Record that we sent the reminder today
            if (successCount > 0) {
                const { error: insertError } = await supabaseAdmin
                    .from('online_lesson_reminders')
                    .insert({
                        online_lesson_id: lesson.id,
                        sent_date: todayDateStr
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
            processedCount: sentReminders.length,
            sentReminders
        })
    } catch (error) {
        console.error('[Online Lesson Cron] Error in cron handler:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
