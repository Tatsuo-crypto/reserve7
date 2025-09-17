import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getAuthenticatedUser, createErrorResponse, createSuccessResponse } from '@/lib/api-utils'
import { getUserMonthlyUsage } from '@/lib/reservation-utils'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    
    if (!user) {
      return createErrorResponse('認証が必要です', 401)
    }

    // Get user profile information
    const { data: userProfile, error } = await supabase
      .from('users')
      .select('plan, status')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('Database error:', error)
      return createErrorResponse('Failed to fetch user profile', 500)
    }

    // Get monthly usage information
    const monthlyUsage = await getUserMonthlyUsage(user.id)

    return createSuccessResponse({
      ...userProfile,
      monthlyUsage
    })
  } catch (error) {
    console.error('User profile API error:', error)
    return createErrorResponse('Internal server error', 500)
  }
}
