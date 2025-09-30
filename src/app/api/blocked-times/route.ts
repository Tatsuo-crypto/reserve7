import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabase } from '@/lib/supabase'
import { isAdmin, getUserStoreId } from '@/lib/auth-utils'
import { authOptions } from '@/lib/auth-config'

// GET: Fetch all blocked times
export async function GET() {
  try {
    // Check admin authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Fetch blocked times for the user's store
    const calendarId = getUserStoreId(session.user.email)
    const { data: blockedTimes, error } = await supabase
      .from('blocked_times')
      .select('*')
      .eq('calendar_id', calendarId)
      .order('start_time', { ascending: true })

    if (error) {
      console.error('Error fetching blocked times:', error)
      return NextResponse.json({ error: 'Failed to fetch blocked times' }, { status: 500 })
    }

    return NextResponse.json(blockedTimes)
  } catch (error) {
    console.error('Error in GET /api/blocked-times:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: Create a new blocked time
export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { start_time, end_time, reason, recurrence_type, recurrence_end } = body

    // Validate required fields
    if (!start_time || !end_time || !reason) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate time range
    if (new Date(start_time) >= new Date(end_time)) {
      return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 })
    }

    const calendarId = getUserStoreId(session.user.email)
    const blockedTimeData = {
      start_time,
      end_time,
      reason,
      calendar_id: calendarId,
      created_by: session.user.email,
      recurrence_type: recurrence_type || 'none',
      recurrence_end: recurrence_end || null
    }

    const { data: blockedTime, error } = await supabase
      .from('blocked_times')
      .insert(blockedTimeData)
      .select()
      .single()

    if (error) {
      console.error('Error creating blocked time:', error)
      return NextResponse.json({ error: 'Failed to create blocked time' }, { status: 500 })
    }

    return NextResponse.json(blockedTime, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/blocked-times:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
