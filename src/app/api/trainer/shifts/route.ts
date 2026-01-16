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

// GET /api/trainer/shifts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    if (!token || !start || !end) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    const trainer = await verifyTrainerToken(token)
    if (!trainer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: shifts, error } = await supabaseAdmin
      .from('trainer_shifts')
      .select('*')
      .eq('trainer_id', trainer.id)
      .gte('end_time', start)
      .lte('start_time', end)
      .order('start_time')

    if (error) throw error

    return NextResponse.json({ shifts })
  } catch (error) {
    console.error('Trainer shifts GET error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST /api/trainer/shifts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, startTime, endTime } = body

    if (!token || !startTime || !endTime) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    const trainer = await verifyTrainerToken(token)
    if (!trainer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: shift, error } = await supabaseAdmin
      .from('trainer_shifts')
      .insert({
        trainer_id: trainer.id,
        start_time: startTime,
        end_time: endTime
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ shift })
  } catch (error) {
    console.error('Trainer shifts POST error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PUT /api/trainer/shifts
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, id, startTime, endTime } = body

    if (!token || !id || !startTime || !endTime) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    const trainer = await verifyTrainerToken(token)
    if (!trainer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify ownership
    const { data: existing } = await supabaseAdmin
      .from('trainer_shifts')
      .select('trainer_id')
      .eq('id', id)
      .single()

    if (!existing || existing.trainer_id !== trainer.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { data: shift, error } = await supabaseAdmin
      .from('trainer_shifts')
      .update({
        start_time: startTime,
        end_time: endTime
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ shift })
  } catch (error) {
    console.error('Trainer shifts PUT error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE /api/trainer/shifts
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    const id = searchParams.get('id')

    if (!token || !id) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    const trainer = await verifyTrainerToken(token)
    if (!trainer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify ownership
    const { data: existing } = await supabaseAdmin
      .from('trainer_shifts')
      .select('trainer_id')
      .eq('id', id)
      .single()

    if (!existing || existing.trainer_id !== trainer.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { error } = await supabaseAdmin
      .from('trainer_shifts')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Trainer shifts DELETE error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
