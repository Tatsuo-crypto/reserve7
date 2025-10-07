import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
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
      .select('id, full_name, email, plan, status, store_id, created_at, memo, access_token')
      .eq('store_id', user.storeId)
      .neq('email', 'tandjgym@gmail.com')
      .neq('email', 'tandjgym2goutenn@gmail.com')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error:', error)
      return createErrorResponse('Failed to fetch members', 500)
    }

    return createSuccessResponse({ members })
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

    const { memberId, status, plan, memo } = await request.json()

    // Validate status if provided
    if (status && !['active', 'suspended', 'withdrawn'].includes(status)) {
      return createErrorResponse('Invalid status', 400)
    }

    // Validate plan if provided
    if (plan && !['月2回', '月4回', '月6回', '月8回', 'ダイエットコース'].includes(plan)) {
      return createErrorResponse('Invalid plan', 400)
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

    // Prepare update object
    const updateData: any = {}
    if (status) updateData.status = status
    if (plan) updateData.plan = plan
    if (memo !== undefined) updateData.memo = memo

    // Update member
    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', memberId)
      .select()

    if (error) {
      console.error('Database error:', error)
      return createErrorResponse('Failed to update member', 500)
    }

    return createSuccessResponse({ success: true })
  } catch (error) {
    console.error('Members API error:', error)
    return createErrorResponse('Internal server error', 500)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    
    if (!user) {
      return createErrorResponse('認証が必要です', 401)
    }

    if (!user.isAdmin) {
      return createErrorResponse('管理者権限が必要です', 403)
    }

    const { memberId } = await request.json()

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

    // Delete member's reservations first
    const { error: reservationsError } = await supabase
      .from('reservations')
      .delete()
      .eq('user_id', memberId)

    if (reservationsError) {
      console.error('Failed to delete member reservations:', reservationsError)
      return createErrorResponse('Failed to delete member reservations', 500)
    }

    // Delete member
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', memberId)

    if (deleteError) {
      console.error('Database error:', deleteError)
      return createErrorResponse('Failed to delete member', 500)
    }

    return createSuccessResponse({ success: true })
  } catch (error) {
    console.error('Members API error:', error)
    return createErrorResponse('Internal server error', 500)
  }
}
