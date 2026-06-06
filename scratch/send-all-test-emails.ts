import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

async function run() {
  const { 
    sendClientNotification, 
    sendClientUpdateNotification, 
    sendPersonalSessionReminder 
  } = await import('../src/lib/email')

  console.log('=== Starting Test Email Deliveries ===\n')

  // 1. New Reservation Confirmation
  console.log('1. Sending [Reservation Confirmation]...')
  const createSuccess = await sendClientNotification({
    clientEmail: 'mitsuoo@icloud.com',
    clientName: 'テスト会員',
    trainerName: '三井　達雄',
    title: 'テスト予約（パーソナル）',
    startTime: '2026-06-08T00:00:00+00:00', // Monday, June 8 at 09:00 AM JST
    endTime: '2026-06-08T01:00:00+00:00',
    storeName: 'T&J GYM 1号店'
  })
  console.log(`   Result: ${createSuccess ? '✅ Success' : '❌ Failed'}\n`)

  // 2. Reservation Update
  console.log('2. Sending [Reservation Update Confirmation]...')
  const updateSuccess = await sendClientUpdateNotification({
    clientEmail: 'mitsuoo@icloud.com',
    clientName: 'テスト会員',
    trainerName: '三井　達雄',
    title: 'テスト予約（パーソナル）',
    startTime: '2026-06-08T01:00:00+00:00', // Monday, June 8 at 10:00 AM JST (updated time)
    endTime: '2026-06-08T02:00:00+00:00',
    storeName: 'T&J GYM 1号店'
  })
  console.log(`   Result: ${updateSuccess ? '✅ Success' : '❌ Failed'}\n`)

  // 3. Personal Session Reminder
  console.log('3. Sending [Session Reminder]...')
  const reminderSuccess = await sendPersonalSessionReminder({
    email: 'mitsuoo@icloud.com',
    clientName: 'テスト会員',
    trainerName: '三井　達雄',
    title: 'テスト予約（パーソナル）',
    startTime: '2026-06-08T00:00:00+00:00', // Monday, June 8 at 09:00 AM JST
    endTime: '2026-06-08T01:00:00+00:00',
    storeName: 'T&J GYM 1号店'
  })
  console.log(`   Result: ${reminderSuccess ? '✅ Success' : '❌ Failed'}\n`)

  console.log('=== All Test Deliveries Finished ===')
}

run()
