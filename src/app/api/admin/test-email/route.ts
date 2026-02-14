import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { requireAdminAuth, handleApiError } from '@/lib/api-utils'
import { sendTrainerNotification } from '@/lib/email'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth()
    if (authResult instanceof NextResponse) return authResult

    const gmailUser = process.env.GMAIL_USER || 'NOT SET'
    const gmailPass = process.env.GMAIL_APP_PASSWORD ? `SET (${process.env.GMAIL_APP_PASSWORD.length} chars)` : 'NOT SET'

    // テスト送信
    const testEmail = request.nextUrl.searchParams.get('to') || 'diet.30.40.50@gmail.com'
    
    let sendResult = 'not attempted'
    let sendError = ''
    
    try {
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
        result: sendResult,
        error: sendError || undefined,
      }
    })
  } catch (error) {
    return handleApiError(error, 'Test email')
  }
}
