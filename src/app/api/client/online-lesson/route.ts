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

        // Resolve user by token to get store_id
        const { data: user, error: userError } = await supabaseAdmin
            .from('users')
            .select('id, store_id')
            .eq('access_token', token)
            .maybeSingle()

        if (userError || !user) {
            return NextResponse.json({ error: '無効なトークンです' }, { status: 401 })
        }

        const { data: lesson, error: lessonError } = await supabaseAdmin
            .from('online_lessons')
            .select('meet_url, schedule_text, description, is_active')
            .eq('store_id', user.store_id)
            .eq('is_active', true)
            .maybeSingle()

        if (lessonError) {
            console.error('Online lesson fetch error:', lessonError)
            return NextResponse.json({ lesson: null })
        }

        return NextResponse.json({ lesson: lesson ?? null })
    } catch (error) {
        console.error('Client online lesson API error:', error)
        return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
    }
}
