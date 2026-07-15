import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

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

    const { data, error } = await supabaseAdmin
      .from('trainer_shift_requests')
      .select('*')
      .eq('trainer_id', trainer.id)
      .gte('end_time', start)
      .lte('start_time', end)
      .order('start_time')

    if (error) {
      if ((error as any).code === 'PGRST205') {
        return NextResponse.json({ requests: [] })
      }
      throw error
    }

    return NextResponse.json({ requests: data || [] })
  } catch (error) {
    console.error('Trainer shift requests GET error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, requests } = body

    if (!token || !Array.isArray(requests) || requests.length === 0) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    const trainer = await verifyTrainerToken(token)
    if (!trainer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rows = requests.map((item: any) => ({
      trainer_id: trainer.id,
      start_time: item.startTime,
      end_time: item.endTime,
      note: item.note || null,
      status: 'submitted'
    }))

    const { data, error } = await supabaseAdmin
      .from('trainer_shift_requests')
      .insert(rows)
      .select()

    if (error) throw error

    return NextResponse.json({ requests: data || [] })
  } catch (error) {
    console.error('Trainer shift requests POST error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

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

    const { error } = await supabaseAdmin
      .from('trainer_shift_requests')
      .delete()
      .eq('id', id)
      .eq('trainer_id', trainer.id)
      .eq('status', 'submitted')

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Trainer shift requests DELETE error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
