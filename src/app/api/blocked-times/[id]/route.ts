import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabase } from '@/lib/supabase'
import { isAdmin, getUserStoreId } from '@/lib/auth-utils'
import { authOptions } from '@/lib/auth-config'

// PUT: Update blocked time
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check admin authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { id } = params
    const { start_time, end_time, reason, recurrence_type, recurrence_end } = body

    // Validate required fields
    if (!start_time || !end_time || !reason) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate time range
    if (new Date(start_time) >= new Date(end_time)) {
      return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 })
    }

    // Check if the blocked time exists and belongs to the user's store
    const calendarId = getUserStoreId(session.user.email)
    const { data: existingBlockedTime, error: fetchError } = await supabase
      .from('blocked_times')
      .select('*')
      .eq('id', id)
      .eq('calendar_id', calendarId)
      .single()

    if (fetchError || !existingBlockedTime) {
      return NextResponse.json({ error: 'Blocked time not found' }, { status: 404 })
    }

    // Update the blocked time
    const updateData = {
      start_time,
      end_time,
      reason,
      recurrence_type: recurrence_type || 'none',
      recurrence_end: recurrence_end || null,
      updated_at: new Date().toISOString()
    }

    const { data: updatedBlockedTime, error: updateError } = await supabase
      .from('blocked_times')
      .update(updateData)
      .eq('id', id)
      .eq('calendar_id', calendarId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating blocked time:', updateError)
      return NextResponse.json({ error: 'Failed to update blocked time' }, { status: 500 })
    }

    return NextResponse.json(updatedBlockedTime)
  } catch (error) {
    console.error('Error in PUT /api/blocked-times/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: Delete blocked time
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check admin authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { id } = params

    // Check if the blocked time exists and belongs to the user's store
    const calendarId = getUserStoreId(session.user.email)
    const { data: existingBlockedTime, error: fetchError } = await supabase
      .from('blocked_times')
      .select('*')
      .eq('id', id)
      .eq('calendar_id', calendarId)
      .single()

    if (fetchError || !existingBlockedTime) {
      return NextResponse.json({ error: 'Blocked time not found' }, { status: 404 })
    }

    // Delete the blocked time
    const { error: deleteError } = await supabase
      .from('blocked_times')
      .delete()
      .eq('id', id)
      .eq('calendar_id', calendarId)

    if (deleteError) {
      console.error('Error deleting blocked time:', deleteError)
      return NextResponse.json({ error: 'Failed to delete blocked time' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Blocked time deleted successfully' })
  } catch (error) {
    console.error('Error in DELETE /api/blocked-times/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
