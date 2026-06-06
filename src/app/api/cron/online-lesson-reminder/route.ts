import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { sendOnlineLessonReminder, getMailSettings } from '@/lib/email'

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

        // Get tomorrow's JST date
        const jstDateStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" })
        const jstNow = new Date(jstDateStr)
        
        // Calculate tomorrow JST
        const jstTomorrow = new Date(jstNow)
        jstTomorrow.setDate(jstNow.getDate() + 1)
        
        const tomorrowDow = jstTomorrow.getDay() // 0: Sun, 1: Mon, ... 6: Sat
        
        // Skip weekend lessons (Saturday: 6, Sunday: 0)
        if (tomorrowDow === 0 || tomorrowDow === 6) {
            console.log(`[Online Lesson Cron] Tomorrow is weekend (DOW: ${tomorrowDow}). Skipping reminder emails.`)
            return NextResponse.json({ message: 'Tomorrow is weekend. Skipping reminders.' })
        }

        // Format tomorrow's date in YYYY-MM-DD
        const year = jstTomorrow.getFullYear()
        const month = String(jstTomorrow.getMonth() + 1).padStart(2, '0')
        const date = String(jstTomorrow.getDate()).padStart(2, '0')
        const tomorrowDateStr = `${year}-${month}-${date}`

        console.log(`[Online Lesson Cron] Running reminder check for tomorrow: ${tomorrowDateStr} (DOW: ${tomorrowDow})`)

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
            // 1. Check if the lesson is scheduled for tomorrow (which is a weekday)
            const isScheduledForTomorrow = lesson.day_of_week && Array.isArray(lesson.day_of_week) && lesson.day_of_week.includes(tomorrowDow)
            if (!isScheduledForTomorrow) {
                continue
            }

            if (!lesson.start_time) {
                continue
            }

            // 2. Check if we already sent a reminder for this lesson for tomorrow's date
            const { data: existingReminder, error: reminderCheckError } = await supabaseAdmin
                .from('online_lesson_reminders')
                .select('*')
                .eq('online_lesson_id', lesson.id)
                .eq('sent_date', tomorrowDateStr)
                .maybeSingle()

            if (reminderCheckError) {
                console.error(`Error checking existing reminder for lesson ${lesson.id}:`, reminderCheckError)
                continue
            }

            if (existingReminder) {
                console.log(`[Online Lesson Cron] Reminder already sent for tomorrow for lesson: ${lesson.title} (${lesson.id})`)
                continue
            }

            // 3. Fetch users linked to this specific online lesson
            const { data: lessonUsers, error: usersError } = await supabaseAdmin
                .from('online_lesson_users')
                .select(`
                    user_id,
                    users (
                        id,
                        full_name,
                        email
                    )
                `)
                .eq('online_lesson_id', lesson.id)

            if (usersError) {
                console.error(`Failed to fetch users for online lesson ${lesson.id}:`, usersError)
                continue
            }

            const validUsers = (lessonUsers || [])
                .map((lu: any) => lu.users)
                .filter((u: any) => 
                    u &&
                    u.email && 
                    u.email.trim() !== '' && 
                    !u.email.endsWith('@gym.internal') && 
                    !u.email.endsWith('@example.com')
                )

            if (validUsers.length === 0) {
                console.log(`[Online Lesson Cron] No target users with email found for lesson: ${lesson.title} (${lesson.id})`)
                continue
            }

            console.log(`[Online Lesson Cron] Sending reminders for "${lesson.title}" tomorrow at ${lesson.start_time} to ${validUsers.length} users`)

            // 4. Send reminder emails
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

            // 5. Record that we sent the reminder for tomorrow's date
            if (successCount > 0) {
                const { error: insertError } = await supabaseAdmin
                    .from('online_lesson_reminders')
                    .insert({
                        online_lesson_id: lesson.id,
                        sent_date: tomorrowDateStr
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
