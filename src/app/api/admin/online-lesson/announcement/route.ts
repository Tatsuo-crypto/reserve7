import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth, handleApiError } from '@/lib/api-utils'
import { sendOnlineLessonAnnouncement } from '@/lib/email'

const DAYS_JA = ['日', '月', '火', '水', '木', '金', '土']

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (auth instanceof NextResponse) return auth

    const body = await request.json()
    const { lessonId, userIds } = body

    if (!lessonId) {
      return NextResponse.json({ error: 'レッスンIDが指定されていません' }, { status: 400 })
    }

    // 1. Fetch lesson details
    const { data: lesson, error: lessonError } = await supabaseAdmin
      .from('online_lessons')
      .select('*')
      .eq('id', lessonId)
      .single()

    if (lessonError || !lesson) {
      console.error('Failed to fetch online lesson:', lessonError)
      return NextResponse.json({ error: '対象のオンラインレッスンが見つかりませんでした' }, { status: 404 })
    }

    let validUsers = []

    if (userIds && Array.isArray(userIds) && userIds.length > 0) {
      // 2. Fetch specific users by ID
      const { data: selectedUsers, error: usersError } = await supabaseAdmin
        .from('users')
        .select('id, full_name, email')
        .in('id', userIds)

      if (usersError) {
        console.error('Failed to fetch selected users:', usersError)
        return NextResponse.json({ error: '送信対象会員の取得に失敗しました' }, { status: 500 })
      }

      validUsers = (selectedUsers || []).filter((u: any) => 
        u &&
        u.email && 
        u.email.trim() !== '' && 
        !u.email.endsWith('@gym.internal') && 
        !u.email.endsWith('@example.com')
      )
    } else {
      // 2. Fetch users linked to this specific online lesson
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
        .eq('online_lesson_id', lessonId)

      if (usersError) {
        console.error(`Failed to fetch users for online lesson ${lessonId}:`, usersError)
        return NextResponse.json({ error: '送信対象会員の取得に失敗しました' }, { status: 500 })
      }

      validUsers = (lessonUsers || [])
        .map((lu: any) => lu.users)
        .filter((u: any) => 
          u &&
          u.email && 
          u.email.trim() !== '' && 
          !u.email.endsWith('@gym.internal') && 
          !u.email.endsWith('@example.com')
        )
    }

    if (validUsers.length === 0) {
      return NextResponse.json(
        { error: '有効なメールアドレスを持つ送信対象会員が選択されていないか、登録されていません。' },
        { status: 400 }
      )
    }

    // 3. Format schedule string
    const days = lesson.day_of_week?.map((d: number) => DAYS_JA[d]).join('・') ?? ''
    const start = lesson.start_time ? lesson.start_time.substring(0, 5) : ''
    const end = lesson.end_time ? lesson.end_time.substring(0, 5) : ''
    const scheduleStr = `毎週${days} ${start}${end ? `〜${end}` : ''}`

    // 4. Send emails
    let successCount = 0
    const errors: string[] = []

    for (const user of validUsers) {
      try {
        const success = await sendOnlineLessonAnnouncement({
          email: user.email,
          clientName: user.full_name,
          title: lesson.title,
          startTime: start,
          endTime: end,
          meetUrl: lesson.meet_url,
          description: lesson.description || undefined,
          difficulty: lesson.difficulty || undefined,
          scheduleStr
        })
        if (success) successCount++
      } catch (err: any) {
        console.error(`Failed to send announcement to user ${user.id} (${user.email}):`, err)
        errors.push(`${user.full_name}: ${err.message || err}`)
      }
    }

    return NextResponse.json({
      success: true,
      sentCount: successCount,
      totalCount: validUsers.length,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    return handleApiError(error, 'Admin online-lesson announcement POST')
  }
}
