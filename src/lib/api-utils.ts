/**
 * API utility functions for common operations
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { cookies } from 'next/headers'
import { authOptions } from '@/lib/auth-config'
import { isAdmin, getUserStoreId } from './auth-utils'
import { ApiResponse } from '@/types/common'
import { supabaseAdmin } from '@/lib/supabase'

export async function getAuthenticatedUser(existingSession?: Awaited<ReturnType<typeof getServerSession>>) {
  try {
    const session = existingSession || await getServerSession(authOptions)

    if (!session?.user?.email) {
      console.error('No session or email found')
      return null
    }

    // Check if admin
    const adminCheck = isAdmin(session.user.email)

    // If admin, get store UUID from stores table
    if (adminCheck) {
      // Map email to calendar_id (for Google Calendar)
      const calendarId = session.user.email === 'tandjgym@gmail.com'
        ? 'tandjgym@gmail.com'
        : 'tandjgym2goutenn@gmail.com'

      // Try to get store UUID from stores table
      let { data: store, error: storeError } = await supabaseAdmin
        .from('stores')
        .select('id, calendar_id')
        .eq('calendar_id', calendarId)
        .single()

      // Override with cookie preference if available
      try {
        const cookieStore = cookies()
        const pref = cookieStore.get('admin_store_preference')
        if (pref?.value) {
          const { data: overrideStore } = await supabaseAdmin
            .from('stores')
            .select('id, calendar_id')
            .eq('id', pref.value)
            .single()

          if (overrideStore) {
            store = overrideStore
            storeError = null
          }
        }
      } catch (e) {
        // Ignore cookie errors
      }

      // If stores table doesn't exist or no store found, use email as storeId (fallback)
      if (storeError || !store) {
        console.warn('Store not found, using email as storeId. Error:', storeError?.message)
        return {
          id: session.user.email,
          email: session.user.email,
          name: session.user.name || '',
          isAdmin: true,
          storeId: calendarId, // Use email as fallback
          calendarId: calendarId
        }
      }

      return {
        id: session.user.email,
        email: session.user.email,
        name: session.user.name || '',
        isAdmin: true,
        storeId: store.id, // UUID for users.store_id
        calendarId: store.calendar_id // Email for reservations.calendar_id
      }
    }

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

  const user = await getAuthenticatedUser(session)
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

// AN-4: トレーニングカルテAPI用の共通認証。/api/reservations/[id]で使われている
// 「?token=あり→トレーナー、なし→管理者セッション」というパターンを共通化したもの。
// カルテはトレーナー・管理者のみが入力・閲覧できる(会員には非公開)。
export type TrainerOrAdminAuth = {
  actorType: 'trainer' | 'admin'
  trainerId: string | null
}

export async function resolveTrainerOrAdmin(request: NextRequest): Promise<NextResponse | TrainerOrAdminAuth> {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (token) {
    const { data: trainer, error } = await supabaseAdmin
      .from('trainers')
      .select('id')
      .eq('access_token', token)
      .eq('status', 'active')
      .single()

    if (error || !trainer) {
      return createErrorResponse('無効なトークンです', 401)
    }

    return { actorType: 'trainer', trainerId: trainer.id }
  }

  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  if (!authResult.isAdmin) {
    return createErrorResponse('権限がありません', 403)
  }
  return { actorType: 'admin', trainerId: null }
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
