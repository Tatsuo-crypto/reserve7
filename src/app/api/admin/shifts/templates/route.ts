import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth, handleApiError } from '@/lib/api-utils'

// GET /api/admin/shifts/templates?trainerId=...
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(request.url)
    const trainerId = searchParams.get('trainerId')

    if (!trainerId) {
      return NextResponse.json({ error: 'Trainer ID is required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('trainer_shift_templates')
      .select('*')
      .eq('trainer_id', trainerId)
      .order('day_of_week')
      .order('start_time')

    if (error) throw error

    return NextResponse.json({ templates: data })
  } catch (error) {
    return handleApiError(error, 'Admin shift templates GET')
  }
}

// POST /api/admin/shifts/templates
// Replace all templates for a trainer
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (auth instanceof NextResponse) return auth

    const body = await request.json()
    const { trainerId, templates } = body

    if (!trainerId || !Array.isArray(templates)) {
      return NextResponse.json({ error: 'Trainer ID and templates array are required' }, { status: 400 })
    }

    // Start a transaction-like operation (delete then insert)
    // Supabase doesn't support transactions in REST API directly like this, but we can do it sequentially
    
    // 1. Delete existing templates for this trainer
    const { error: deleteError } = await supabaseAdmin
      .from('trainer_shift_templates')
      .delete()
      .eq('trainer_id', trainerId)

    if (deleteError) throw deleteError

    // 2. Insert new templates
    if (templates.length > 0) {
      const templatesToInsert = templates.map((t: any) => ({
        trainer_id: trainerId,
        day_of_week: t.dayOfWeek,
        start_time: t.startTime,
        end_time: t.endTime
      }))

      const { error: insertError } = await supabaseAdmin
        .from('trainer_shift_templates')
        .insert(templatesToInsert)

      if (insertError) throw insertError
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'Admin shift templates POST')
  }
}
