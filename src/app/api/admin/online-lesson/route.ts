import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth, handleApiError } from '@/lib/api-utils'

// GET /api/admin/online-lesson
export async function GET(request: NextRequest) {
    try {
        const auth = await requireAdminAuth()
        if (auth instanceof NextResponse) return auth
        const { user } = auth

        const { data, error } = await supabaseAdmin
            .from('online_lessons')
            .select('*')
            .eq('store_id', user.storeId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (error) {
            console.error('Online lesson fetch error:', error)
            return NextResponse.json({ lesson: null })
        }

        return NextResponse.json({ lesson: data ?? null })
    } catch (error) {
        return handleApiError(error, 'Online lesson GET')
    }
}

// POST /api/admin/online-lesson
export async function POST(request: NextRequest) {
    try {
        const auth = await requireAdminAuth()
        if (auth instanceof NextResponse) return auth
        const { user } = auth

        const body = await request.json()
        const { meetUrl, scheduleText, description, isActive } = body

        if (!meetUrl) {
            return NextResponse.json({ error: 'Google Meetリンクは必須です' }, { status: 400 })
        }

        // Check if existing record
        const { data: existing } = await supabaseAdmin
            .from('online_lessons')
            .select('id')
            .eq('store_id', user.storeId)
            .maybeSingle()

        if (existing?.id) {
            // Update existing
            const { data, error } = await supabaseAdmin
                .from('online_lessons')
                .update({
                    meet_url: meetUrl,
                    schedule_text: scheduleText || '',
                    description: description || '',
                    is_active: isActive !== false,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id)
                .select()
                .single()

            if (error) throw error
            return NextResponse.json({ lesson: data })
        } else {
            // Insert new
            const { data, error } = await supabaseAdmin
                .from('online_lessons')
                .insert({
                    store_id: user.storeId,
                    meet_url: meetUrl,
                    schedule_text: scheduleText || '',
                    description: description || '',
                    is_active: isActive !== false,
                })
                .select()
                .single()

            if (error) throw error
            return NextResponse.json({ lesson: data })
        }
    } catch (error) {
        return handleApiError(error, 'Online lesson POST')
    }
}
