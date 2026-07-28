import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/client/online-lesson?token=xxx
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const token = searchParams.get('token')

        if (!token) {
            return NextResponse.json({ error: 'トークンが指定されていません' }, { status: 400 })
        }

        // Resolve user token to store_id
        const { data: user, error: userError } = await supabaseAdmin
            .from('users')
            .select('id, store_id')
            .eq('access_token', token)
            .maybeSingle()

        if (userError || !user) {
            return NextResponse.json({ error: '無効なトークンです' }, { status: 401 })
        }

        const { data: lessons, error: lessonError } = await supabaseAdmin
            .from('online_lessons')
            .select('id, title, meet_url, description, day_of_week, start_time, end_time, difficulty')
            .eq('store_id', user.store_id)
            .eq('is_active', true)
            .order('created_at', { ascending: true })

        if (lessonError) {
            console.error('Online lesson fetch error:', lessonError)
            return NextResponse.json({ lessons: [] })
        }

        // AP-1/AP-3: 「この日だけ休講」「別の日に振替」を会員側にも出す(今日以降の分のみ)
        const lessonIds = (lessons ?? []).map(l => l.id)
        let exceptionsByLesson: Record<string, any[]> = {}

        if (lessonIds.length > 0) {
            const todayJst = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
            const { data: exceptions } = await supabaseAdmin
                .from('online_lesson_exceptions')
                .select('online_lesson_id, exception_date, moved_to_date, moved_to_start_time, moved_to_end_time')
                .in('online_lesson_id', lessonIds)
                .or(`exception_date.gte.${todayJst},moved_to_date.gte.${todayJst}`)
                .order('exception_date', { ascending: true })

            exceptionsByLesson = (exceptions ?? []).reduce((acc: Record<string, any[]>, ex: any) => {
                acc[ex.online_lesson_id] = [...(acc[ex.online_lesson_id] || []), {
                    date: ex.exception_date,
                    movedToDate: ex.moved_to_date,
                    movedToStartTime: ex.moved_to_start_time,
                    movedToEndTime: ex.moved_to_end_time,
                }]
                return acc
            }, {})
        }

        const lessonsWithExceptions = (lessons ?? []).map(lesson => ({
            ...lesson,
            exceptions: exceptionsByLesson[lesson.id] || [],
        }))

        return NextResponse.json({ lessons: lessonsWithExceptions })
    } catch (error) {
        console.error('Client online lesson API error:', error)
        return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
    }
}
