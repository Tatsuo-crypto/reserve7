import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabase } from '@/lib/supabase'
import { getUserStoreId } from '@/lib/env'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin role
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const userStoreId = getUserStoreId(session.user.email)

    // Get members from the same store (exclude admin accounts)
    const { data: members, error } = await supabase
      .from('users')
      .select('id, full_name, email, status, store_id, created_at')
      .eq('store_id', userStoreId)
      .neq('email', 'tandjgym@gmail.com')
      .neq('email', 'tandjgym2goutenn@gmail.com')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 })
    }

    return NextResponse.json({ members })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      console.error('PATCH /api/admin/members - No session')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin role
    if (session.user.role !== 'ADMIN') {
      console.error('PATCH /api/admin/members - Not admin:', session.user.role)
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { memberId, status } = await request.json()
    console.log('PATCH /api/admin/members - Request:', { memberId, status })

    // Validate status
    if (!['active', 'suspended', 'withdrawn'].includes(status)) {
      console.error('PATCH /api/admin/members - Invalid status:', status)
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const userStoreId = getUserStoreId(session.user.email)
    console.log('PATCH /api/admin/members - User store:', userStoreId)

    // First check if the member exists and belongs to the same store
    const { data: member, error: fetchError } = await supabase
      .from('users')
      .select('id, email, store_id')
      .eq('id', memberId)
      .eq('store_id', userStoreId)
      .neq('email', 'tandjgym@gmail.com')
      .neq('email', 'tandjgym2goutenn@gmail.com')
      .single()

    if (fetchError || !member) {
      console.error('PATCH /api/admin/members - Member not found or access denied:', fetchError)
      return NextResponse.json({ error: 'Member not found or access denied' }, { status: 404 })
    }

    console.log('PATCH /api/admin/members - Found member:', member)

    // Update member status
    const { data, error } = await supabase
      .from('users')
      .update({ status })
      .eq('id', memberId)
      .select()

    if (error) {
      console.error('PATCH /api/admin/members - Database error:', error)
      return NextResponse.json({ error: 'Failed to update member status' }, { status: 500 })
    }

    console.log('PATCH /api/admin/members - Update successful:', data)
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('PATCH /api/admin/members - API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
