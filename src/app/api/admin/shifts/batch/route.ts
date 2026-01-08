import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth, handleApiError } from '@/lib/api-utils'
import { addDays, format, parseISO, getDay } from 'date-fns'

// POST /api/admin/shifts/batch
// Handle batch operations for shifts
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (auth instanceof NextResponse) return auth

    const body = await request.json()
    const { action, trainerId, startDate, endDate, sourceStartDate } = body

    if (!trainerId || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    const start = parseISO(startDate)
    const end = parseISO(endDate)

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

      // 2. Generate shifts for each day in range
      const newShifts = []
      let current = start
      while (current <= end) {
        const dayOfWeek = getDay(current) // 0=Sunday
        
        // Find templates for this day of week
        const dayTemplates = templates.filter(t => t.day_of_week === dayOfWeek)
        
        for (const tmpl of dayTemplates) {
          const dateStr = format(current, 'yyyy-MM-dd')
          newShifts.push({
            trainer_id: trainerId,
            start_time: `${dateStr}T${tmpl.start_time}`, // e.g., 2026-01-08T10:00:00
            end_time: `${dateStr}T${tmpl.end_time}`
          })
        }
        
        current = addDays(current, 1)
      }

      // 3. Insert shifts (skipping collisions could be complex, for now we just insert)
      // Ideally we should check for overlaps, but for MVP we might trust the user or DB constraints (if we added any)
      if (newShifts.length > 0) {
        const { error: insertError } = await supabaseAdmin
          .from('trainer_shifts')
          .insert(newShifts)
        
        if (insertError) throw insertError
      }

      return NextResponse.json({ success: true, count: newShifts.length })
    }

    // Action: Copy from Previous Week (or custom source range)
    if (action === 'copy_previous_week') {
      if (!sourceStartDate) {
        return NextResponse.json({ error: 'Source start date required for copy' }, { status: 400 })
      }
      
      const sourceStart = parseISO(sourceStartDate)
      // Assuming 7 days copy for now if not specified
      const durationDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      const sourceEnd = addDays(sourceStart, durationDays)

      // 1. Fetch source shifts
      const { data: sourceShifts, error: fetchError } = await supabaseAdmin
        .from('trainer_shifts')
        .select('*')
        .eq('trainer_id', trainerId)
        .gte('start_time', sourceStart.toISOString())
        .lte('end_time', sourceEnd.toISOString())

      if (fetchError) throw fetchError

      if (!sourceShifts || sourceShifts.length === 0) {
        return NextResponse.json({ message: 'No source shifts found', count: 0 })
      }

      // 2. Map to new dates
      // Calculate day difference
      const dayDiff = Math.round((start.getTime() - sourceStart.getTime()) / (1000 * 60 * 60 * 24))
      
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

      // 3. Insert
      if (newShifts.length > 0) {
        const { error: insertError } = await supabaseAdmin
          .from('trainer_shifts')
          .insert(newShifts)
        
        if (insertError) throw insertError
      }

      return NextResponse.json({ success: true, count: newShifts.length })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    return handleApiError(error, 'Admin shifts batch POST')
  }
}
