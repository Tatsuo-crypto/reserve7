import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { createGoogleCalendarService } from '@/lib/google-calendar'
import { env } from '@/lib/env'

// GET: サービスアカウント情報を返す
export async function GET() {
  try {
    if (!env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      return NextResponse.json({ error: 'GOOGLE_SERVICE_ACCOUNT_KEY not set' })
    }
    const creds = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY)
    return NextResponse.json({ serviceAccountEmail: creds.client_email })
  } catch (e) {
    return NextResponse.json({ error: String(e) })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Skip authentication for testing purposes
    console.log('Calendar test API called')

    const body = await request.json()
    const { title, startTime, endTime, clientName, clientEmail, notes } = body

    if (!title || !startTime || !endTime || !clientName || !clientEmail) {
      return NextResponse.json(
        { error: 'すべての必須フィールドを入力してください' },
        { status: 400 }
      )
    }

    // Test Google Calendar service
    const calendarService = createGoogleCalendarService()
    
    if (!calendarService) {
      return NextResponse.json(
        { error: 'Googleカレンダーサービスが設定されていません。環境変数を確認してください。' },
        { status: 500 }
      )
    }

    // テスト: ジムのカレンダーにイベント作成後、attendeesなしで作成→PATCHでattendees追加
    const trainerEmail = body.trainerEmail || null
    const calendarId = body.calendarId || 'tandjgym@gmail.com'

    try {
      // Step 1: ジムのカレンダーにattendeesなしでイベント作成
      const calResult = await calendarService.createEvent({
        title,
        startTime,
        endTime,
        clientName,
        clientEmail,
        notes,
        calendarId,
      })
      const eventId = calResult.eventId

      // Step 2: trainerEmailがあれば、ジムのカレンダー上でattendees付きイベントを作成して招待
      let trainerResult = null
      if (trainerEmail) {
        try {
          const trainerEventId = await calendarService.createEventWithAttendees({
            title: title + '（招待テスト）',
            startTime,
            endTime,
            clientName,
            clientEmail,
            notes,
            attendeeEmails: [trainerEmail],
            calendarId,
          })
          trainerResult = { success: true, eventId: trainerEventId, method: 'attendees on gym calendar' }
        } catch (trainerError) {
          trainerResult = { success: false, error: trainerError instanceof Error ? trainerError.message : String(trainerError) }
        }
      }

      return NextResponse.json({
        success: true,
        eventId,
        trainerResult,
        message: 'Googleカレンダーにイベントが作成されました'
      })
    } catch (calendarError) {
      console.error('Calendar test error:', calendarError)
      return NextResponse.json(
        { error: `Googleカレンダーエラー: ${calendarError instanceof Error ? calendarError.message : calendarError}` },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Calendar test API error:', error)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
