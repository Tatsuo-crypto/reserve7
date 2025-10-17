import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /api/auth/trainer-token?token=xxx
// Verify trainer token and return trainer info
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

    // Find trainer by access_token
    const { data: trainer, error } = await supabaseAdmin
      .from('trainers')
      .select('id, full_name, email, store_id, status')
      .eq('access_token', token)
      .eq('status', 'active')
      .single()

    if (error || !trainer) {
      console.error('Trainer token lookup error:', error)
      return NextResponse.json(
        { error: '無効なトークンです' },
        { status: 401 }
      )
    }

    // Return trainer info (excluding sensitive data)
    return NextResponse.json({
      trainer: {
        id: trainer.id,
        name: trainer.full_name,
        email: trainer.email,
        storeId: trainer.store_id,
      }
    })

  } catch (error) {
    console.error('Trainer token auth error:', error)
    return NextResponse.json(
      { error: '認証に失敗しました' },
      { status: 500 }
    )
  }
}
