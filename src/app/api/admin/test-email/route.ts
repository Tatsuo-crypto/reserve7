import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { requireAdminAuth, handleApiError } from '@/lib/api-utils'
import { 
  sendTrainerNotification, 
  sendClientNotification,
  sendClientUpdateNotification,
  sendClientCancellationNotification,
  sendTrainerUpdateNotification,
  sendTrainerCancellationNotification,
  sendPersonalSessionReminder,
  sendOnlineLessonReminder,
  sendOnlineLessonAnnouncement
} from '@/lib/email'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth()
    if (authResult instanceof NextResponse) return authResult

    const gmailUser = process.env.GMAIL_USER || 'NOT SET'
    const gmailPass = process.env.GMAIL_APP_PASSWORD ? `SET (${process.env.GMAIL_APP_PASSWORD.length} chars)` : 'NOT SET'

    // Test send params
    const testEmail = request.nextUrl.searchParams.get('to') || 'diet.30.40.50@gmail.com'
    const type = request.nextUrl.searchParams.get('type') || 'personal-reminder'
    
    let sendResult = 'not attempted'
    let sendError = ''
    
    try {
      if (type === 'client') {
        const success = await sendClientNotification({
          clientEmail: testEmail,
          clientName: 'テスト会員',
          trainerName: 'テストトレーナー',
          title: 'テスト予約（パーソナル）',
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          storeName: 'T&J GYM 1号店',
        })
        sendResult = success ? 'SUCCESS' : 'FAILED (returned false)'
      } else if (type === 'client-update') {
        const success = await sendClientUpdateNotification({
          clientEmail: testEmail,
          clientName: 'テスト会員',
          trainerName: 'テストトレーナー',
          title: 'テスト予約（パーソナル）',
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          storeName: 'T&J GYM 1号店',
        })
        sendResult = success ? 'SUCCESS' : 'FAILED (returned false)'
      } else if (type === 'client-cancel') {
        const success = await sendClientCancellationNotification({
          clientEmail: testEmail,
          clientName: 'テスト会員',
          trainerName: 'テストトレーナー',
          title: 'テスト予約（パーソナル）',
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          storeName: 'T&J GYM 1号店',
        })
        sendResult = success ? 'SUCCESS' : 'FAILED (returned false)'
      } else if (type === 'trainer') {
        const success = await sendTrainerNotification({
          trainerEmail: testEmail,
          trainerName: 'テストトレーナー',
          clientName: 'テスト会員',
          title: 'テスト予約（パーソナル）',
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          storeName: 'T&J GYM 1号店',
        })
        sendResult = success ? 'SUCCESS' : 'FAILED (returned false)'
      } else if (type === 'trainer-update') {
        const success = await sendTrainerUpdateNotification({
          trainerEmail: testEmail,
          trainerName: 'テストトレーナー',
          clientName: 'テスト会員',
          title: 'テスト予約（パーソナル）',
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          storeName: 'T&J GYM 1号店',
        })
        sendResult = success ? 'SUCCESS' : 'FAILED (returned false)'
      } else if (type === 'trainer-cancel') {
        const success = await sendTrainerCancellationNotification({
          trainerEmail: testEmail,
          trainerName: 'テストトレーナー',
          clientName: 'テスト会員',
          title: 'テスト予約（パーソナル）',
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          storeName: 'T&J GYM 1号店',
        })
        sendResult = success ? 'SUCCESS' : 'FAILED (returned false)'
      } else if (type === 'personal-reminder') {
        const success = await sendPersonalSessionReminder({
          email: testEmail,
          clientName: 'テスト会員',
          trainerName: 'テストトレーナー',
          title: 'テスト予約（パーソナル）',
          startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
          endTime: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
          storeName: 'T&J GYM 1号店',
          notes: '持ち物: タオル、水、インドアシューズ'
        })
        sendResult = success ? 'SUCCESS' : 'FAILED (returned false)'
      } else if (type === 'online-reminder') {
        const success = await sendOnlineLessonReminder({
          email: testEmail,
          clientName: 'テスト会員',
          title: 'テスト・オンラインヨガ',
          startTime: '10:00',
          endTime: '11:00',
          meetUrl: 'https://meet.google.com/abc-defg-hij',
          description: '朝のリフレッシュに最適な初心者向けヨガクラスです。',
          difficulty: '初心者'
        })
        sendResult = success ? 'SUCCESS' : 'FAILED (returned false)'
      } else if (type === 'online-announcement') {
        const success = await sendOnlineLessonAnnouncement({
          email: testEmail,
          clientName: 'テスト会員',
          title: 'テスト・オンラインヨガ',
          startTime: '10:00',
          endTime: '11:00',
          meetUrl: 'https://meet.google.com/abc-defg-hij',
          description: '朝のリフレッシュに最適な初心者向けヨガクラスです。',
          difficulty: '初心者',
          scheduleStr: '毎週月曜 10:00〜11:00'
        })
        sendResult = success ? 'SUCCESS' : 'FAILED (returned false)'
      } else {
        throw new Error(`無効な送信タイプです: ${type}`)
      }
    } catch (e: any) {
      sendResult = 'ERROR'
      sendError = e.message || String(e)
    }

    return NextResponse.json({
      config: {
        GMAIL_USER: gmailUser,
        GMAIL_APP_PASSWORD: gmailPass,
      },
      test: {
        to: testEmail,
        type,
        result: sendResult,
        error: sendError || undefined,
      }
    })
  } catch (error) {
    return handleApiError(error, 'Test email')
  }
}
