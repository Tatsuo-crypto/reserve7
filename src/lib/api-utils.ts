/**
 * API utility functions for common operations
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-config'
import { isAdmin, getUserStoreId } from './auth-utils'
import { ApiResponse } from '@/types/common'
import { supabaseAdmin } from '@/lib/supabase'

export async function getAuthenticatedUser() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      console.error('No session or email found')
      return null
    }

    console.log('getAuthenticatedUser called for:', session.user.email)

    // Check if admin
    const adminCheck = isAdmin(session.user.email)
    
    // If admin, get store UUID from stores table using calendar_id
    if (adminCheck) {
      // Map email to calendar_id
      const calendarId = session.user.email === 'tandjgym@gmail.com' 
        ? 'tandjgym@gmail.com' 
        : 'tandjgym2goutenn@gmail.com'
      
      console.log('Admin authenticated, looking up store UUID for calendar_id:', calendarId)
      
      // Get store UUID from stores table
      const { data: store, error: storeError } = await supabaseAdmin
        .from('stores')
        .select('id, calendar_id')
        .eq('calendar_id', calendarId)
        .single()
      
      if (storeError || !store) {
        console.error('Failed to get store UUID:', storeError)
        // Fallback: return calendar_id as storeId
        return {
          id: session.user.email,
          email: session.user.email,
          name: session.user.name || '',
          isAdmin: true,
          storeId: calendarId, // Use email as fallback
          calendarId: calendarId
        }
      }
      
      console.log('Admin authenticated successfully:', {
        email: session.user.email,
        storeId: store.id,
        calendarId: store.calendar_id
      })
      
      return {
        id: session.user.email, // Use email as ID for admins
        email: session.user.email,
        name: session.user.name || '',
        isAdmin: true,
        storeId: store.id, // Use store UUID for database queries
        calendarId: store.calendar_id // Keep calendar_id for Google Calendar API
      }
    }

    // For non-admin users, get from database
    console.log('Non-admin user, querying database...')
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, store_id')
      .eq('email', session.user.email)
      .single()

    if (error) {
      console.error('Database error for non-admin user:', error)
      return null
    }
    
    if (!user) {
      console.error('User not found in database:', session.user.email)
      return null
    }

    console.log('Non-admin user found:', { id: user.id, storeId: user.store_id })

    return {
      id: user.id,
      email: session.user.email,
      name: session.user.name || '',
      isAdmin: false,
      storeId: user.store_id || getUserStoreId(session.user.email)
    }
  } catch (error) {
    console.error('getAuthenticatedUser error:', error)
    return null
  }
}

export async function requireAuth(): Promise<NextResponse | { user: any; isAdmin: boolean }> {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.email) {
    return createErrorResponse('認証が必要です', 401)
  }

  const user = await getAuthenticatedUser()
  if (!user) {
    return createErrorResponse('ユーザー情報の取得に失敗しました', 401)
  }

  return { user, isAdmin: user.isAdmin }
}

export async function requireAdminAuth(): Promise<NextResponse | { user: any }> {
  const authResult = await requireAuth()
  
  if (authResult instanceof NextResponse) {
    return authResult
  }

  if (!authResult.isAdmin) {
    return createErrorResponse('管理者権限が必要です', 403)
  }

  return { user: authResult.user }
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
  // Log full error on server
  console.error(`${context} error:`, error)

  // Try to surface useful info to client
  const message =
    (error && (error.message || error.msg || error.error || error.details))
      || (typeof error === 'string' ? error : null)
      || 'Internal server error'

  const status = (error && (error.status || error.code))
    && Number.isFinite(Number(error.status || error.code))
      ? Number(error.status || error.code)
      : 500

  return NextResponse.json({ error: String(message) }, { status })
}
