import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdminAuth } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  const limit = Math.min(Number(searchParams.get('limit')) || 20, 50)

  if (!userId) return NextResponse.json({ error: '会員を指定してください' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('shared_memos')
    .select('id, body, is_published, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('admin shared memos GET error:', error)
    return NextResponse.json({ error: '共有メモを取得できませんでした' }, { status: 500 })
  }

  return NextResponse.json({ memos: data || [] })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminAuth()
  if (auth instanceof NextResponse) return auth

  try {
    const body = await request.json()
    const userId = String(body.userId || '')
    const memoBody = String(body.body || '').trim()

    if (!userId) return NextResponse.json({ error: '会員を指定してください' }, { status: 400 })
    if (!memoBody) return NextResponse.json({ error: 'メモを入力してください' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('shared_memos')
      .insert({
        user_id: userId,
        body: memoBody,
        is_published: body.isPublished !== false,
        created_by: auth.user.email,
      })
      .select('id, body, is_published, created_at')
      .single()

    if (error) throw error
    return NextResponse.json({ memo: data })
  } catch (error) {
    console.error('admin shared memos POST error:', error)
    return NextResponse.json({ error: '共有メモを保存できませんでした' }, { status: 500 })
  }
}
