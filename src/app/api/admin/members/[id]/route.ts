import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthenticatedUser, createErrorResponse, createSuccessResponse } from '@/lib/api-utils'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUser()
    
    if (!user) {
      return createErrorResponse('認証が必要です', 401)
    }

    if (!user.isAdmin) {
      return createErrorResponse('管理者権限が必要です', 403)
    }

    const { id } = params

    // Get member by ID
    const { data: member, error } = await supabaseAdmin
      .from('users')
      .select(`
        id,
        full_name,
        email,
        google_calendar_email,
        plan,
        status,
        store_id,
        monthly_fee,
        created_at,
        memo,
        access_token
      `)
      .eq('id', id)
      .single()

    if (error || !member) {
      console.error('Database error:', error)
      return createErrorResponse('会員が見つかりません', 404)
    }

    return createSuccessResponse(member)
  } catch (error) {
    console.error('Member API error:', error)
    return createErrorResponse('Internal server error', 500)
  }
}
