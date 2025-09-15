import { NextRequest, NextResponse } from 'next/server'
import { createGoogleCalendarService } from '@/lib/google-calendar'

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

    try {
      const eventId = await calendarService.createEvent({
        title,
        startTime,
        endTime,
        clientName,
        clientEmail,
        notes
      })

      return NextResponse.json({
        success: true,
        eventId,
        message: 'Googleカレンダーにテストイベントが正常に作成されました'
      })
    } catch (calendarError) {
      console.error('Calendar test error:', calendarError)
      return NextResponse.json(
        { error: `Googleカレンダーエラー: ${calendarError}` },
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
