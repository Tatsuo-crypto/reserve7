/**
 * API utility functions for common operations
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-config'
import { isAdmin, getUserStoreId } from './auth-utils'
import { ApiResponse } from '@/types/common'
import { supabase } from '@/lib/supabase'

export async function getAuthenticatedUser() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.email) {
    return null
  }

  // Get user ID from database
  const { data: user, error } = await supabase
    .from('users')
    .select('id')
    .eq('email', session.user.email)
    .single()

  if (error || !user) {
    return null
  }

  return {
    id: user.id,
    email: session.user.email,
    name: session.user.name || '',
    isAdmin: isAdmin(session.user.email),
    storeId: getUserStoreId(session.user.email)
  }
}

export function createErrorResponse(message: string, status: number = 400): NextResponse {
  return NextResponse.json({ error: message }, { status })
}

export function createSuccessResponse<T>(data: T, message?: string): NextResponse {
  const response: ApiResponse<T> = { data }
  if (message) response.message = message
  return NextResponse.json(response)
}

export function handleApiError(error: any, context: string): NextResponse {
  console.error(`${context} error:`, error)
  return createErrorResponse('Internal server error', 500)
}
