import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { addDays, format, parseISO, getDay } from 'date-fns'

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

// POST /api/trainer/shifts/batch
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, action, startDate, endDate, sourceStartDate } = body

    if (!token || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    const trainer = await verifyTrainerToken(token)
    if (!trainer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const trainerId = trainer.id

    const start = parseISO(startDate)
    const end = parseISO(endDate)

    // Helper to snap to JST Start of Day (00:00:00 JST)
    const toJstStart = (d: Date) => {
      const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
      jst.setUTCHours(0, 0, 0, 0)
      return new Date(jst.getTime() - 9 * 60 * 60 * 1000)
    }

    // Helper to snap to JST End of Day (23:59:59 JST)
    const toJstEnd = (d: Date) => {
      const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
      jst.setUTCHours(23, 59, 59, 999)
      return new Date(jst.getTime() - 9 * 60 * 60 * 1000)
    }

    const rangeStart = toJstStart(start)
    const rangeEnd = toJstEnd(end)

    // Action: Generate from Templates
    if (action === 'generate_from_templates') {
      // 1. Get templates
      const { data: templates, error: tmplError } = await supabaseAdmin
        .from('trainer_shift_templates')
        .select('*')
        .eq('trainer_id', trainerId)

      if (tmplError) throw tmplError
      if (!templates || templates.length === 0) {
        return NextResponse.json({ message: 'No templates found', count: 0 })
      }

      // 2. Delete existing shifts in range
      const { error: deleteError } = await supabaseAdmin
        .from('trainer_shifts')
        .delete()
        .eq('trainer_id', trainerId)
        .gte('start_time', rangeStart.toISOString())
        .lte('end_time', rangeEnd.toISOString())

      if (deleteError) throw deleteError

      // 3. Generate shifts
      const newShifts = []
      let current = rangeStart
      const JST_OFFSET = 9 * 60 * 60 * 1000

      while (current <= rangeEnd) {
        const jstDate = new Date(current.getTime() + JST_OFFSET)
        const dayOfWeek = getDay(jstDate)
        const dayTemplates = templates.filter(t => t.day_of_week === dayOfWeek)
        
        for (const tmpl of dayTemplates) {
          const dateStr = format(jstDate, 'yyyy-MM-dd')
          newShifts.push({
            trainer_id: trainerId,
            start_time: `${dateStr}T${tmpl.start_time}+09:00`, 
            end_time: `${dateStr}T${tmpl.end_time}+09:00`
          })
        }
        current = addDays(current, 1)
      }

      if (newShifts.length > 0) {
        const { error: insertError } = await supabaseAdmin
          .from('trainer_shifts')
          .insert(newShifts)
        if (insertError) throw insertError
      }

      return NextResponse.json({ success: true, count: newShifts.length })
    }

    // Action: Copy from Previous Week
    if (action === 'copy_previous_week') {
      if (!sourceStartDate) {
        return NextResponse.json({ error: 'Source start date required' }, { status: 400 })
      }
      
      const sourceStartRaw = parseISO(sourceStartDate)
      const sourceStart = toJstStart(sourceStartRaw)
      
      // Calculate exact time duration of the target range
      const rangeDuration = rangeEnd.getTime() - rangeStart.getTime()
      // Apply duration to source start to get exact source end
      const sourceEndFull = new Date(sourceStart.getTime() + rangeDuration)

      // 1. Fetch source shifts
      const { data: sourceShifts, error: fetchError } = await supabaseAdmin
        .from('trainer_shifts')
        .select('*')
        .eq('trainer_id', trainerId)
        .gte('start_time', sourceStart.toISOString())
        .lte('end_time', sourceEndFull.toISOString())

      if (fetchError) throw fetchError

      if (!sourceShifts || sourceShifts.length === 0) {
        return NextResponse.json({ message: 'No source shifts found', count: 0 })
      }

      // 2. Map to new dates
      const dayDiff = Math.round((rangeStart.getTime() - sourceStart.getTime()) / (1000 * 60 * 60 * 24))
      
      const newShifts = sourceShifts.map(shift => {
        const oldStart = new Date(shift.start_time)
        const oldEnd = new Date(shift.end_time)
        
        const newStart = addDays(oldStart, dayDiff)
        const newEnd = addDays(oldEnd, dayDiff)
        
        return {
          trainer_id: trainerId,
          start_time: newStart.toISOString(),
          end_time: newEnd.toISOString()
        }
      })

      // 3. Delete existing in target range
       const { error: deleteError } = await supabaseAdmin
        .from('trainer_shifts')
        .delete()
        .eq('trainer_id', trainerId)
        .gte('start_time', rangeStart.toISOString())
        .lte('end_time', rangeEnd.toISOString())

      if (deleteError) throw deleteError

      // 4. Insert
      if (newShifts.length > 0) {
        const { error: insertError } = await supabaseAdmin
          .from('trainer_shifts')
          .insert(newShifts)
        if (insertError) throw insertError
      }

      return NextResponse.json({ success: true, count: newShifts.length })
    }

    // Action: Bulk Delete
    if (action === 'bulk_delete') {
      const { shiftIds } = body
      if (!Array.isArray(shiftIds) || shiftIds.length === 0) {
        return NextResponse.json({ error: 'Shift IDs required' }, { status: 400 })
      }

      // Verify ownership implicitly by including trainer_id in the delete query
      const { error: deleteError, count } = await supabaseAdmin
        .from('trainer_shifts')
        .delete({ count: 'exact' })
        .eq('trainer_id', trainerId)
        .in('id', shiftIds)

      if (deleteError) throw deleteError

      return NextResponse.json({ success: true, count })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Trainer shifts batch POST error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
