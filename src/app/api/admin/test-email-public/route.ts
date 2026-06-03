import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { sendTrainerNotification, sendClientNotification } from '@/lib/email'

export async function GET(request: NextRequest) {
  try {
    const gmailUser = process.env.GMAIL_USER || 'NOT SET'
    const gmailPass = process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_APP_PASSWORD2 ? 'SET' : 'NOT SET'

    // テスト送信
    const testEmail = request.nextUrl.searchParams.get('to') || 'diet.30.40.50@gmail.com'
    const type = request.nextUrl.searchParams.get('type') || 'trainer' // 'trainer' or 'client'
    
    let sendResult = 'not attempted'
    let sendError = ''
    
    try {
      if (type === 'client') {
        const success = await sendClientNotification({
          clientEmail: testEmail,
          clientName: 'テスト会員',
          trainerName: 'テストトレーナー',
          title: 'テスト予約',
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          storeName: 'T&J GYM テスト',
        })
        sendResult = success ? 'SUCCESS' : 'FAILED (returned false)'
      } else {
        const success = await sendTrainerNotification({
          trainerEmail: testEmail,
          trainerName: 'テスト',
          clientName: 'テスト会員',
          title: 'テスト予約',
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          storeName: 'T&J GYM テスト',
        })
        sendResult = success ? 'SUCCESS' : 'FAILED (returned false)'
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
    console.error('Test email error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
