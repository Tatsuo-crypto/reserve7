import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /api/auth/token?token=xxx
// Verify token and return user info
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const token = searchParams.get('token')

    console.log('[Token Auth] Received token request:', token ? 'トークンあり' : 'トークンなし')

    if (!token) {
      console.error('[Token Auth] No token provided')
      return NextResponse.json(
        { error: 'トークンが指定されていません' },
        { status: 400 }
      )
    }

    // Find user by access_token
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, full_name, email, store_id, plan, status')
      .eq('access_token', token)
      .single()

    if (error || !user) {
      console.error('[Token Auth] Token lookup error:', error?.message || 'User not found')
      return NextResponse.json(
        { error: '無効なトークンです' },
        { status: 401 }
      )
    }

    // Check if user is active
    if (user.status !== 'active') {
      console.error('[Token Auth] User status is not active:', user.status)
      return NextResponse.json(
        { error: 'このアカウントは現在利用できません' },
        { status: 403 }
      )
    }

    console.log('[Token Auth] Authentication successful for user:', user.email)

    // Return user info (excluding sensitive data)
    return NextResponse.json({
      user: {
        id: user.id,
        name: user.full_name,
        email: user.email,
        storeId: user.store_id,
        plan: user.plan || '月4回',
      }
    })

  } catch (error) {
    console.error('Token auth error:', error)
    return NextResponse.json(
      { error: '認証に失敗しました' },
      { status: 500 }
    )
  }
}
