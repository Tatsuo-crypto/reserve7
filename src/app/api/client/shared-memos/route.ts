import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveMemberViewer } from '@/lib/materials'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  const limit = Math.min(Number(searchParams.get('limit')) || 20, 50)
  const viewer = await resolveMemberViewer(token)

  if (!viewer?.id) {
    return NextResponse.json({ error: '無効なトークンです' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('shared_memos')
    .select('id, body, created_at')
    .eq('user_id', viewer.id)
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('client shared memos GET error:', error)
    return NextResponse.json({ memos: [] })
  }

  return NextResponse.json({ memos: data || [] })
}
