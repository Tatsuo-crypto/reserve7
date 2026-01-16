import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'

// Helper to verify trainer token
async function verifyTrainerToken(token: string | null) {
  if (!token) return null
  
  const { data: trainer, error } = await supabaseAdmin
    .from('trainers')
    .select('id, full_name, store_id')
    .eq('access_token', token)
    .eq('status', 'active')
    .single()
    
  if (error || !trainer) return null
  return trainer
}

// GET /api/trainer/shifts/templates
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    const trainer = await verifyTrainerToken(token)
    if (!trainer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: templates, error } = await supabaseAdmin
      .from('trainer_shift_templates')
      .select('*')
      .eq('trainer_id', trainer.id)

    if (error) throw error

    return NextResponse.json({ templates })
  } catch (error) {
    console.error('Trainer templates GET error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST /api/trainer/shifts/templates
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, templates } = body

    if (!token || !templates) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    const trainer = await verifyTrainerToken(token)
    if (!trainer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Delete existing templates for this trainer
    const { error: deleteError } = await supabaseAdmin
      .from('trainer_shift_templates')
      .delete()
      .eq('trainer_id', trainer.id)

    if (deleteError) throw deleteError

    // Insert new templates
    if (templates.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('trainer_shift_templates')
        .insert(
          templates.map((t: any) => ({
            trainer_id: trainer.id,
            day_of_week: t.dayOfWeek,
            start_time: t.startTime,
            end_time: t.endTime
          }))
        )

      if (insertError) throw insertError
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Trainer templates POST error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
