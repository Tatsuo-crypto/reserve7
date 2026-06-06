import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local BEFORE importing email.ts
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

async function run() {
  console.log('Sending test personal session reminder for tomorrow at 9:00 JST to mitsuoo@icloud.com...')
  try {
    const { sendPersonalSessionReminder } = await import('../src/lib/email')
    const success = await sendPersonalSessionReminder({
      email: 'mitsuoo@icloud.com',
      clientName: 'テスト',
      trainerName: '三井　達雄',
      title: 'テスト1/4',
      startTime: '2026-06-06T00:00:00+00:00', // Saturday, June 6, 2026 at 09:00 JST
      endTime: '2026-06-06T01:00:00+00:00',
      storeName: 'T&J GYM 1号店'
    })
    console.log(`Result: ${success ? '✅ Success' : '❌ Failed'}`)
  } catch (error) {
    console.error('❌ Error sending email:', error)
  }
}

run()
