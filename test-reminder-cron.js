const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role to bypass RLS

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey)

async function testReminderCron() {
  try {
    console.log('=== Starting Online Lesson Reminder Diagnostic ===')
    
    // Get current JST time
    const jstDateStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" })
    const jstNow = new Date(jstDateStr)
    const todayDow = jstNow.getDay() // 0: Sun, 1: Mon, ... 6: Sat
    const year = jstNow.getFullYear()
    const month = String(jstNow.getMonth() + 1).padStart(2, '0')
    const date = String(jstNow.getDate()).padStart(2, '0')
    const todayDateStr = `${year}-${month}-${date}`

    console.log(`Current JST Time: ${jstNow.toLocaleTimeString()} (${todayDateStr}, Day of Week: ${todayDow})`)

    // 1. Fetch active online lessons
    console.log('\nFetching active online lessons...')
    const { data: lessons, error: lessonsError } = await supabaseAdmin
      .from('online_lessons')
      .select('*')
      .eq('is_active', true)

    if (lessonsError) {
      console.error('❌ Failed to fetch online lessons:', lessonsError)
      return
    }

    if (!lessons || lessons.length === 0) {
      console.log('⚠️ No active online lessons found in database.')
      return
    }

    console.log(`Found ${lessons.length} active online lessons.`)
    console.table(lessons.map(l => ({
      id: l.id,
      title: l.title,
      days: l.day_of_week,
      start: l.start_time,
      end: l.end_time,
      store: l.store_id
    })))

    for (const lesson of lessons) {
      console.log(`\n--- Evaluating Lesson: "${lesson.title}" (${lesson.id}) ---`)
      
      // Check day of week
      const isScheduledForToday = lesson.day_of_week && Array.isArray(lesson.day_of_week) && lesson.day_of_week.includes(todayDow)
      console.log(`- Scheduled for today? ${isScheduledForToday ? '✅ Yes' : '❌ No (DOW list: ' + JSON.stringify(lesson.day_of_week) + ')'} (Bypassing for test)`)
      
      if (!lesson.start_time) {
        console.log('- ❌ Missing start_time')
        continue
      }

      // Time calculation
      const [startHour, startMinute] = lesson.start_time.split(':').map(Number)
      const lessonStart = new Date(jstNow)
      lessonStart.setHours(startHour, startMinute, 0, 0)

      const diffMinutes = (lessonStart.getTime() - jstNow.getTime()) / (1000 * 60)
      console.log(`- Start time: ${lesson.start_time}`)
      console.log(`- Diff from now: ${diffMinutes.toFixed(1)} minutes (Bypassing for test)`)
      
      const isInReminderWindow = diffMinutes > 0 && diffMinutes <= 30
      console.log(`- Is in 30-min reminder window? ${isInReminderWindow ? '✅ Yes' : '❌ No'}`)

      // Check database reminder history
      const { data: existingReminder, error: reminderCheckError } = await supabaseAdmin
        .from('online_lesson_reminders')
        .select('*')
        .eq('online_lesson_id', lesson.id)
        .eq('sent_date', todayDateStr)
        .maybeSingle()

      if (reminderCheckError) {
        console.error(`- ❌ Error checking existing reminder (table online_lesson_reminders might not exist yet):`, reminderCheckError.message)
      } else {
        console.log(`- Already sent today? ${existingReminder ? '⚠️ Yes (Skipping)' : '✅ No'}`)
      }

      // Fetch users
      console.log(`- Fetching users linked to online lesson ${lesson.id}...`)
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
        console.error(`- ❌ Failed to fetch users:`, usersError)
        continue
      }

      const validUsers = (lessonUsers || [])
        .map(lu => lu.users)
        .filter(u => 
          u &&
          u.email && 
          u.email.trim() !== '' && 
          !u.email.endsWith('@gym.internal') && 
          !u.email.endsWith('@example.com')
        )
      console.log(`- Found ${validUsers.length} users with email linked to this lesson.`)
      if (validUsers.length > 0) {
        console.log(`- Recipients: ${validUsers.map(u => `${u.full_name} (${u.email})`).join(', ')}`)
      }
    }

  } catch (error) {
    console.error('❌ Diagnostics failed:', error)
  }
}

testReminderCron()
