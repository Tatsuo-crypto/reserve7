import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /api/auth/token?token=xxx
// Verify token and return user info
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'トークンが指定されていません' },
        { status: 400 }
      )
    }

    // Find user by access_token
    const { data: user, error } = await supabase
      .from('users')
      .select('id, full_name, email, store_id')
      .eq('access_token', token)
      .single()

    if (error || !user) {
      console.error('Token lookup error:', error)
      return NextResponse.json(
        { error: '無効なトークンです' },
        { status: 401 }
      )
    }

    // Return user info (excluding sensitive data)
    return NextResponse.json({
      user: {
        id: user.id,
        name: user.full_name,
        email: user.email,
        storeId: user.store_id,
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
