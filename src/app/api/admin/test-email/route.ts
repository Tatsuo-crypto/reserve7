import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { requireAdminAuth, handleApiError } from '@/lib/api-utils'
import { sendTrainerNotification } from '@/lib/email'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth()
    if (authResult instanceof NextResponse) return authResult

    const resendKey = process.env.RESEND_API_KEY ? `SET (${process.env.RESEND_API_KEY.length} chars)` : 'NOT SET'

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
        RESEND_API_KEY: resendKey,
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
