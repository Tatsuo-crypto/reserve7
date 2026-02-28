import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth, handleApiError } from '@/lib/api-utils'

// GET /api/admin/online-lesson - Get all lessons for the store
export async function GET(request: NextRequest) {
    try {
        const auth = await requireAdminAuth()
        if (auth instanceof NextResponse) return auth
        const { user } = auth

        const { data, error } = await supabaseAdmin
            .from('online_lessons')
            .select('*')
            .eq('store_id', user.storeId)
            .order('created_at', { ascending: true })

        if (error) {
            console.error('Online lesson fetch error:', error)
            return NextResponse.json({ lessons: [] })
        }

        return NextResponse.json({ lessons: data ?? [] })
    } catch (error) {
        return handleApiError(error, 'Online lesson GET')
    }
}

// POST /api/admin/online-lesson - Create a new lesson
export async function POST(request: NextRequest) {
    try {
        const auth = await requireAdminAuth()
        if (auth instanceof NextResponse) return auth
        const { user } = auth

        const body = await request.json()
        const { title, meetUrl, scheduleText, description, isActive, dayOfWeek, startTime, endTime } = body

        if (!meetUrl) {
            return NextResponse.json({ error: 'Google Meetリンクは必須です' }, { status: 400 })
        }

        const { data, error } = await supabaseAdmin
            .from('online_lessons')
            .insert({
                store_id: user.storeId,
                title: title || 'オンラインレッスン',
                meet_url: meetUrl,
                schedule_text: scheduleText || '',
                description: description || '',
                is_active: isActive !== false,
                day_of_week: dayOfWeek || null,
                start_time: startTime || null,
                end_time: endTime || null,
            })
            .select()
            .single()

        if (error) throw error
        return NextResponse.json({ lesson: data })
    } catch (error) {
        return handleApiError(error, 'Online lesson POST')
    }
}

// PUT /api/admin/online-lesson?id=xxx - Update a lesson
export async function PUT(request: NextRequest) {
    try {
        const auth = await requireAdminAuth()
        if (auth instanceof NextResponse) return auth
        const { user } = auth

        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')
        if (!id) return NextResponse.json({ error: 'IDが必要です' }, { status: 400 })

        const body = await request.json()
        const { title, meetUrl, scheduleText, description, isActive, dayOfWeek, startTime, endTime } = body

        const { data, error } = await supabaseAdmin
            .from('online_lessons')
            .update({
                title: title || 'オンラインレッスン',
                meet_url: meetUrl,
                schedule_text: scheduleText || '',
                description: description || '',
                is_active: isActive !== false,
                day_of_week: dayOfWeek || null,
                start_time: startTime || null,
                end_time: endTime || null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .eq('store_id', user.storeId)
            .select()
            .single()

        if (error) throw error
        return NextResponse.json({ lesson: data })
    } catch (error) {
        return handleApiError(error, 'Online lesson PUT')
    }
}

// DELETE /api/admin/online-lesson?id=xxx
export async function DELETE(request: NextRequest) {
    try {
        const auth = await requireAdminAuth()
        if (auth instanceof NextResponse) return auth
        const { user } = auth

        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')
        if (!id) return NextResponse.json({ error: 'IDが必要です' }, { status: 400 })

        const { error } = await supabaseAdmin
            .from('online_lessons')
            .delete()
            .eq('id', id)
            .eq('store_id', user.storeId)

        if (error) throw error
        return NextResponse.json({ success: true })
    } catch (error) {
        return handleApiError(error, 'Online lesson DELETE')
    }
}
