import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getAuthenticatedUser, createErrorResponse, createSuccessResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    
    if (!user) {
      return createErrorResponse('認証が必要です', 401)
    }

    if (!user.isAdmin) {
      return createErrorResponse('管理者権限が必要です', 403)
    }

    // Use user.storeId from authenticated user

    // Get members from the same store (exclude admin accounts)
    const { data: members, error } = await supabase
      .from('users')
      .select('id, full_name, email, status, store_id, created_at')
      .eq('store_id', user.storeId)
      .neq('email', 'tandjgym@gmail.com')
      .neq('email', 'tandjgym2goutenn@gmail.com')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error:', error)
      return createErrorResponse('Failed to fetch members', 500)
    }

    return createSuccessResponse(members)
  } catch (error) {
    console.error('Members API error:', error)
    return createErrorResponse('Internal server error', 500)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    
    if (!user) {
      return createErrorResponse('認証が必要です', 401)
    }

    if (!user.isAdmin) {
      return createErrorResponse('管理者権限が必要です', 403)
    }

    const { memberId, status } = await request.json()

    // Validate status
    if (!['active', 'suspended', 'withdrawn'].includes(status)) {
      return createErrorResponse('Invalid status', 400)
    }

    // First check if the member exists and belongs to the same store
    const { data: member, error: fetchError } = await supabase
      .from('users')
      .select('id, email, store_id')
      .eq('id', memberId)
      .eq('store_id', user.storeId)
      .neq('email', 'tandjgym@gmail.com')
      .neq('email', 'tandjgym2goutenn@gmail.com')
      .single()

    if (fetchError || !member) {
      return createErrorResponse('Member not found or access denied', 404)
    }

    // Update member status
    const { data, error } = await supabase
      .from('users')
      .update({ status })
      .eq('id', memberId)
      .select()

    if (error) {
      console.error('Database error:', error)
      return createErrorResponse('Failed to update member status', 500)
    }

    return createSuccessResponse({ success: true })
  } catch (error) {
    console.error('Members API error:', error)
    return createErrorResponse('Internal server error', 500)
  }
}
