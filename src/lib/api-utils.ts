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
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.email) {
    return null
  }

  // Check if admin
  const adminCheck = isAdmin(session.user.email)
  
  // If admin, get store ID from stores table using calendar_id
  if (adminCheck) {
    // Map admin email to calendar_id (from env vars)
    const calendarId = session.user.email === 'tandjgym@gmail.com' 
      ? process.env.GOOGLE_CALENDAR_ID_1 
      : process.env.GOOGLE_CALENDAR_ID_2
    
    console.log('Admin authentication attempt:', {
      email: session.user.email,
      calendarId
    })
    
    // Get store ID from database using calendar_id
    const { data: store, error: storeError } = await supabaseAdmin
      .from('stores')
      .select('id, name, calendar_id')
      .eq('calendar_id', calendarId)
      .single()
    
    console.log('Store lookup result:', {
      foundStore: store,
      error: storeError
    })
    
    // If no store found, query all stores to see what's available
    if (!store) {
      const { data: allStores } = await supabaseAdmin
        .from('stores')
        .select('id, name, calendar_id')
      console.log('All stores in database:', allStores)
    }
    
    // For store_id, use calendar_id (email) directly instead of store UUID
    // This matches how data is stored in users.store_id
    const storeId = calendarId || getUserStoreId(session.user.email)
    
    console.log('Using storeId:', storeId)
    
    return {
      id: session.user.email, // Use email as ID for admins
      email: session.user.email,
      name: session.user.name || '',
      isAdmin: true,
      storeId: storeId
    }
  }

  // For non-admin users, get from database
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('id, store_id')
    .eq('email', session.user.email)
    .single()

  if (error || !user) {
    return null
  }

  return {
    id: user.id,
    email: session.user.email,
    name: session.user.name || '',
    isAdmin: false,
    storeId: user.store_id || getUserStoreId(session.user.email)
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
